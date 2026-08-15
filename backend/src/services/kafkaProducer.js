// src/services/kafkaProducer.js
import { Kafka, logLevel } from 'kafkajs';
import { logger } from '../utils/logger.js';
import { metrics } from '../utils/metrics.js';

const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
const KAFKA_CLIENT_ID = process.env.KAFKA_CLIENT_ID || 'tripsync-backend';

let kafka = null;
let producer = null;
let isProducerConnected = false;

// Kafka is deliberately opt-in. A stale KAFKA_BROKERS value must not make the
// production API start retrying broker connections when no Kafka deployment is
// running.
const KAFKA_ENABLE = process.env.KAFKA_ENABLE === 'true';

try {
  if (KAFKA_ENABLE) {
    kafka = new Kafka({
      clientId: KAFKA_CLIENT_ID,
      brokers: KAFKA_BROKERS,
      logLevel: logLevel.NOTHING,
      retry: { initialRetryTime: 500, retries: 3 },
    });
    producer = kafka.producer();
  }
} catch (err) {
  // Fallback for non-kafka environments
}

export const connectProducer = async () => {
  if (!producer || isProducerConnected) return;
  try {
    await producer.connect();
    isProducerConnected = true;
    logger.info(`[Kafka Producer] ✅ Connected to broker(s): ${KAFKA_BROKERS.join(', ')}`);
  } catch (err) {
    logger.warn(`[Kafka Producer] ⚠️ Connection failed (${err.message}). Kafka messages will fallback.`);
  }
};

export const sendKafkaEvent = async (topic, key, value, retries = 2) => {
  if (!producer || !isProducerConnected) {
    await connectProducer();
  }

  if (!isProducerConnected) {
    logger.info(`[Kafka Fallback] Producer offline. Logged event [${topic}]: ${key}`);
    metrics.inc('kafka_publish_failed_total');
    return false;
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, Math.min(200 * Math.pow(2, attempt), 1000)));
      }

      await producer.send({
        topic,
        messages: [
          {
            key: String(key),
            value: typeof value === 'object' ? JSON.stringify(value) : String(value),
          },
        ],
      });
      
      metrics.inc('kafka_publish_success_total');
      logger.info(`[Kafka Producer] 📤 Event published to topic [${topic}] key [${key}]`);
      return true;
    } catch (err) {
      logger.warn(`[Kafka Producer] Attempt ${attempt + 1} failed for topic [${topic}]: ${err.message}`);
    }
  }

  metrics.inc('kafka_publish_failed_total');
  return false;
};

export const getKafkaHealth = () => {
  if (!producer) {
    return { status: 'disabled', details: 'Kafka producer not configured' };
  }

  if (isProducerConnected) {
    return { status: 'ready', details: 'Kafka producer connected' };
  }

  return { status: 'degraded', details: 'Kafka producer not connected' };
};

export const getKafkaInstance = () => kafka;
export const isKafkaEnabled = () => KAFKA_ENABLE;
