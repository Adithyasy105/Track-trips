// src/services/redisClient.js
import Redis from 'ioredis';
import dotenv from 'dotenv';
import { logger } from '../utils/logger.js';
import { metrics } from '../utils/metrics.js';

dotenv.config();

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

let redis = null;
let isConnected = false;
const readyListeners = new Set();

const notifyReadyListeners = () => {
  readyListeners.forEach((listener) => {
    try {
      listener();
    } catch (error) {
      logger.warn(`[Redis] Ready listener failed: ${error.message}`);
    }
  });
};

try {
  redis = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 3,
    enableOfflineQueue: false,
    connectTimeout: 10000,
    retryStrategy(times) {
      if (times > 3) {
        logger.warn('[Redis] ⚠️ Max reconnection attempts reached. Operating in fallback mode.');
        return null;
      }
      return Math.min(times * 200, 2000);
    },
  });

  let hasLoggedError = false;

  redis.on('ready', () => {
    isConnected = true;
    hasLoggedError = false;
    notifyReadyListeners();
    logger.info('[Redis] ✅ Connected to Redis server');
  });

  redis.on('error', (err) => {
    isConnected = false;
    if (!hasLoggedError) {
      hasLoggedError = true;
      logger.info('[Redis] ℹ️ Local Redis offline — operating in in-memory fallback mode');
    }
  });
} catch (err) {
  logger.info('[Redis] ℹ️ Local Redis offline — operating in fallback mode');
}

export { redis };

/**
 * Check if Redis is currently connected and operational
 * @returns {boolean}
 */
export const isRedisReady = () => isConnected && redis && redis.status === 'ready';

export const onRedisReady = (listener) => {
  readyListeners.add(listener);
  if (isRedisReady()) queueMicrotask(listener);
  return () => readyListeners.delete(listener);
};

export const getRedisHealth = () => {
  if (redis && isConnected && redis.status === 'ready') {
    return { status: 'ready', details: 'Redis connected' };
  }

  if (redis && isConnected) {
    return { status: 'degraded', details: redis.status || 'Redis reconnecting' };
  }

  return { status: 'down', details: 'Redis unavailable; using fallback mode' };
};

/**
 * Get JSON cached data from Redis
 * @param {string} key
 * @returns {Promise<any|null>}
 */
export const getCache = async (key) => {
  if (!isRedisReady()) {
    metrics.inc('redis_miss_total');
    return null;
  }
  try {
    const data = await redis.get(key);
    if (data) {
      metrics.inc('redis_hit_total');
      return JSON.parse(data);
    } else {
      metrics.inc('redis_miss_total');
      return null;
    }
  } catch (err) {
    metrics.inc('redis_miss_total');
    logger.warn(`[Redis] getCache failed for key ${key}: ${err.message}`);
    return null;
  }
};

/**
 * Set JSON data in Redis with TTL (in seconds)
 * @param {string} key
 * @param {any} value
 * @param {number} ttlSeconds
 */
export const setCache = async (key, value, ttlSeconds = 300) => {
  if (!isRedisReady()) return;
  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch (err) {
    logger.warn(`[Redis] setCache failed for key ${key}: ${err.message}`);
  }
};

/**
 * Delete key or keys matching pattern from Redis
 * @param {string|string[]} keysOrPattern
 */
export const invalidateCache = async (keysOrPattern) => {
  if (!isRedisReady()) return;
  try {
    if (Array.isArray(keysOrPattern)) {
      if (keysOrPattern.length > 0) {
        await redis.del(...keysOrPattern);
      }
    } else if (keysOrPattern.includes('*')) {
      const keys = await redis.keys(keysOrPattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } else {
      await redis.del(keysOrPattern);
    }
  } catch (err) {
    logger.warn(`[Redis] invalidateCache failed for ${keysOrPattern}: ${err.message}`);
  }
};

/**
 * Invalidate all cached data for a specific trip (analytics & settlements)
 * @param {string} tripId
 */
export const invalidateTripCaches = async (tripId) => {
  await invalidateCache([
    `analytics:trip:${tripId}`,
    `settlement:trip:${tripId}`
  ]);
};
