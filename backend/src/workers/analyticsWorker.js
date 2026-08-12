// src/workers/analyticsWorker.js
import { getKafkaInstance } from '../services/kafkaProducer.js';
import { supabase } from '../services/supabaseClient.js';
import { invalidateTripCaches } from '../services/redisClient.js';

const CONSUMER_GROUP = 'analytics-worker-group';

export const startAnalyticsWorker = async () => {
  const kafka = getKafkaInstance();
  if (!kafka) {
    console.warn('[Analytics Worker] Kafka instance unavailable. Worker skipped.');
    return;
  }

  const consumer = kafka.consumer({ groupId: CONSUMER_GROUP });

  try {
    await consumer.connect();
    await consumer.subscribe({ topic: 'expense-events', fromBeginning: false });
    console.log(`[Analytics Worker] 📊 Idempotent Analytics Worker subscribed to [expense-events] (group: ${CONSUMER_GROUP})`);

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        const payloadStr = message.value.toString();
        let event;
        try {
          event = JSON.parse(payloadStr);
        } catch {
          return;
        }

        const eventId = event.id;
        if (!eventId) return;

        // Idempotency check: check processed_events
        const { data: alreadyProcessed } = await supabase
          .from('processed_events')
          .select('event_id')
          .eq('event_id', eventId)
          .eq('consumer_group', CONSUMER_GROUP)
          .maybeSingle();

        if (alreadyProcessed) {
          console.log(`[Analytics Worker] ⏭️ Event [${eventId}] already processed. Skipping (Idempotent).`);
          return;
        }

        // Invalidate trip analytics & settlement caches in Redis
        const tripId = event.payload?.trip_id || event.aggregate_id;
        if (tripId) {
          await invalidateTripCaches(tripId);
          console.log(`[Analytics Worker] ⚡ Invalidated Redis caches for trip [${tripId}]`);
        }

        // Record in processed_events table
        await supabase.from('processed_events').insert([
          { event_id: eventId, consumer_group: CONSUMER_GROUP }
        ]);
      },
    });
  } catch (err) {
    console.warn(`[Analytics Worker] ⚠️ Kafka consumer warning (${err.message}). Defaulting to synchronous cache invalidation.`);
  }
};
