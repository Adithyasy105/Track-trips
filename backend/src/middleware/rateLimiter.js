// src/middleware/rateLimiter.js
import crypto from 'crypto';
import { redis, isRedisReady } from '../services/redisClient.js';

// In-memory fallback tracking when Redis is offline (e.g. local dev without Docker)
const fallbackMemoryStore = new Map();

const LUA_RATE_LIMIT = `
local cooldownKey = KEYS[1]
local bucketKey   = KEYS[2]
local maxLimit    = tonumber(ARGV[1])
local cooldownTTL = tonumber(ARGV[2])
local bucketTTL   = tonumber(ARGV[3])

if redis.call("EXISTS", cooldownKey) == 1 then
    return -1 -- Blocked by cooldown
end

local current = tonumber(redis.call("GET", bucketKey) or "0")
if current >= maxLimit then
    return -2 -- Blocked by flood limit
end

redis.call("SET", cooldownKey, "1", "EX", cooldownTTL)
redis.call("INCR", bucketKey)
if current == 0 then
    redis.call("EXPIRE", bucketKey, bucketTTL)
end

return 1 -- Allowed
`;

/**
 * Factory for creating Redis-backed rate limiting middleware with Lua atomic scripts
 * @param {object} options
 * @param {number} options.maxRequests - Max requests allowed in bucket window (default 5)
 * @param {number} options.cooldownSeconds - Min seconds between consecutive requests (default 30)
 * @param {number} options.windowSeconds - Bucket window TTL in seconds (default 1800 / 30m)
 * @param {string} options.prefix - Key prefix
 */
export const createRateLimiter = (options = {}) => {
  const {
    maxRequests = 5,
    cooldownSeconds = 30,
    windowSeconds = 1800,
    prefix = 'ratelimit',
  } = options;

  return async (req, res, next) => {
    try {
      const identifier = req.body?.email || req.ip || 'unknown';
      const hashedId = crypto.createHash('sha256').update(identifier.toLowerCase().trim()).digest('hex');

      const cooldownKey = `${prefix}:cooldown:${hashedId}`;
      const bucketKey = `${prefix}:bucket:${hashedId}`;

      if (isRedisReady()) {
        const result = await redis.eval(
          LUA_RATE_LIMIT,
          2,
          cooldownKey,
          bucketKey,
          maxRequests,
          cooldownSeconds,
          windowSeconds
        );

        if (result === -1) {
          return res.status(429).json({
            error: `Too many requests. Please wait ${cooldownSeconds} seconds before trying again.`,
            retryAfter: cooldownSeconds,
          });
        }

        if (result === -2) {
          return res.status(429).json({
            error: 'Request limit reached for this window. Please try again later.',
          });
        }

        return next();
      }

      // Fallback in-memory rate limiting if Redis is unavailable
      const now = Date.now();
      const record = fallbackMemoryStore.get(hashedId) || { count: 0, lastRequest: 0, resetTime: now + windowSeconds * 1000 };

      if (now < record.resetTime && record.lastRequest > 0 && (now - record.lastRequest) < cooldownSeconds * 1000) {
        return res.status(429).json({
          error: `Please wait ${cooldownSeconds} seconds before requesting again.`,
        });
      }

      if (now > record.resetTime) {
        record.count = 0;
        record.resetTime = now + windowSeconds * 1000;
      }

      if (record.count >= maxRequests) {
        return res.status(429).json({
          error: 'Request limit reached. Please try again later.',
        });
      }

      record.count += 1;
      record.lastRequest = now;
      fallbackMemoryStore.set(hashedId, record);

      return next();
    } catch (err) {
      console.warn('[RateLimiter] Error evaluating rate limit, letting request pass:', err.message);
      return next();
    }
  };
};

export const authRateLimiter = createRateLimiter({
  maxRequests: 5,
  cooldownSeconds: 30,
  windowSeconds: 1800,
  prefix: 'ratelimit:auth',
});

export const paymentRateLimiter = createRateLimiter({
  maxRequests: 20,
  cooldownSeconds: 1,
  windowSeconds: 300,
  prefix: 'ratelimit:payments',
});
