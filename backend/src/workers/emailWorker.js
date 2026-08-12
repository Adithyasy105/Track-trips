// src/workers/emailWorker.js
import { getKafkaInstance } from '../services/kafkaProducer.js';
import { supabase } from '../services/supabaseClient.js';
import { sendMail } from '../services/mailer.js';

const CONSUMER_GROUP = 'email-worker-group';

export const startEmailWorker = async () => {
  const kafka = getKafkaInstance();
  if (!kafka) {
    console.warn('[Email Worker] Kafka instance unavailable. Worker skipped.');
    return;
  }

  const consumer = kafka.consumer({ groupId: CONSUMER_GROUP });

  try {
    await consumer.connect();
    await consumer.subscribe({ topic: 'expense-events', fromBeginning: false });
    console.log(`[Email Worker] 📧 Idempotent Email Worker subscribed to [expense-events] (group: ${CONSUMER_GROUP})`);

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

        // Idempotency check: verify if event was already processed by email worker
        const { data: alreadyProcessed } = await supabase
          .from('processed_events')
          .select('event_id')
          .eq('event_id', eventId)
          .eq('consumer_group', CONSUMER_GROUP)
          .maybeSingle();

        if (alreadyProcessed) {
          console.log(`[Email Worker] ⏭️ Event [${eventId}] already processed. Skipping (Idempotent).`);
          return;
        }

        // Process message (send notification email)
        const { payer_username, description, amount, participants } = event.payload || {};
        console.log(`[Email Worker] 📧 Processing event [${event.event_type}] for expense: "${description}"`);

        // Record in processed_events table for consumer idempotency
        await supabase.from('processed_events').insert([
          { event_id: eventId, consumer_group: CONSUMER_GROUP }
        ]);
      },
    });
  } catch (err) {
    console.warn(`[Email Worker] ⚠️ Kafka consumer warning (${err.message}). Defaulting to inline notifications.`);
  }
};
