// src/workers/outboxWorker.js
import { supabase } from '../services/supabaseClient.js';
import { sendKafkaEvent, connectProducer } from '../services/kafkaProducer.js';
import { logger } from '../utils/logger.js';
import { metrics } from '../utils/metrics.js';

let isRunning = false;
let timer = null;
const MAX_OUTBOX_RETRIES = 5;

export const pollOutboxEvents = async () => {
  if (isRunning) return;
  isRunning = true;

  try {
    // Connect Kafka Producer if needed
    await connectProducer();

    // Query pending events from outbox
    const { data: pendingEvents, error } = await supabase
      .from('outbox_events')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(20);

    if (error) {
      // Table 'outbox_events' may not exist yet in Supabase schema — ignore silently
      return;
    }

    const now = new Date();
    const eligibleEvents = (pendingEvents || []).filter((event) => {
      if (!event.next_retry_at) return true;
      return new Date(event.next_retry_at) <= now;
    });

    metrics.setGauge('outbox_pending_count', eligibleEvents.length);

    if (!eligibleEvents.length) {
      return;
    }

    logger.info(`[Outbox Worker] 📦 Found ${eligibleEvents.length} pending outbox events`);

    for (const event of eligibleEvents) {
      const currentRetries = (event.retry_count || 0) + 1;
      const topic = `${event.aggregate_type ? event.aggregate_type.toLowerCase() : 'trip'}-events`;

      const published = await sendKafkaEvent(topic, event.aggregate_id, event);

      if (published) {
        metrics.inc('outbox_published_total');
        await supabase
          .from('outbox_events')
          .update({
            status: 'published',
            published_at: new Date().toISOString(),
            retry_count: currentRetries,
            next_retry_at: null,
            error_message: null,
          })
          .eq('id', event.id)
          .eq('status', 'pending');
      } else {
        if (currentRetries >= MAX_OUTBOX_RETRIES) {
          metrics.inc('outbox_dead_letter_total');
          logger.error(`[Outbox Worker] 💀 Event ${event.id} reached max retries (${MAX_OUTBOX_RETRIES}). Moving to dead_letter state.`);
          await supabase
            .from('outbox_events')
            .update({
              status: 'dead_letter',
              retry_count: currentRetries,
              next_retry_at: null,
              error_message: `Kafka producer unreachable after ${currentRetries} attempts`,
            })
            .eq('id', event.id)
            .eq('status', 'pending');
        } else {
          metrics.inc('outbox_failed_total');
          const nextRetryDelaySec = Math.min(Math.pow(2, currentRetries) * 5, 60);
          logger.warn(`[Outbox Worker] ⚠️ Publishing event ${event.id} failed (attempt ${currentRetries}/${MAX_OUTBOX_RETRIES}). Retrying in ${nextRetryDelaySec}s`);

          await supabase
            .from('outbox_events')
            .update({
              retry_count: currentRetries,
              error_message: 'Kafka producer unreachable',
              next_retry_at: new Date(Date.now() + nextRetryDelaySec * 1000).toISOString(),
            })
            .eq('id', event.id)
            .eq('status', 'pending');
        }
      }
    }
  } catch (err) {
    logger.error(`[Outbox Worker] Unexpected error: ${err.message}`);
  } finally {
    isRunning = false;
  }
};

export const startOutboxWorker = (intervalMs = 3000) => {
  logger.info(`[Outbox Worker] 🚀 Transactional Outbox Poller started (polling every ${intervalMs}ms)`);
  pollOutboxEvents();
  timer = setInterval(pollOutboxEvents, intervalMs);
};

export const stopOutboxWorker = () => {
  if (timer) clearInterval(timer);
  logger.info('[Outbox Worker] 🛑 Worker stopped');
};
