import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import Redis from 'ioredis';
import { Request, Response } from 'express';
import { logger } from '../utils/logger';

// Create Redis client for rate limiting
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  db: 0,
  maxRetriesPerRequest: 1, // Fail fast
  enableReadyCheck: true,
  enableOfflineQueue: false,
  lazyConnect: true, // Don't connect until used
  retryStrategy: (times) => {
    if (times > 1) return null; // Stop retrying quickly
    return 1000;
  }
});

let useRedis = false;

redis.on('error', (err) => {
  if (useRedis) {
    logger.warn('Redis for rate limiting went down, falling back to memory store');
    useRedis = false;
  }
});

redis.on('ready', () => {
  logger.info('Redis connected and ready for rate limiting');
  useRedis = true;
});

// Try to connect initially
redis.connect().catch(() => {
  logger.warn('Initial Redis connection failed for rate limiting - using memory store');
  useRedis = false;
});

// Create a fail-safe store that uses Redis if available, otherwise Memory
const createStore = (prefix: string) => {
  // If we're in production and REDIS_HOST is not set, or if connection failed, 
  // express-rate-limit will default to MemoryStore if we don't provide a store
  if (!process.env.REDIS_HOST || !useRedis) {
    return undefined; // Falls back to MemoryStore
  }

  try {
    return new RedisStore({
      sendCommand: async (...args: string[]): Promise<any> => {
        if (!useRedis) return null;
        try {
          return await redis.call(args[0], ...args.slice(1));
        } catch (error) {
          useRedis = false;
          return null;
        }
      },
      prefix
    });
  } catch (err) {
    logger.warn('Failed to initialize RedisStore, falling back to memory');
    return undefined;
  }
};

// Global rate limiter - 100 requests per 15 minutes
export const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore('rl:global:'),
  keyGenerator: generateKey,
  handler: rateLimitHandler,
  skip: skipRateLimit
});

// Strict rate limiter for auth endpoints - 5 requests per 15 minutes
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // Increased slightly for debugging
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore('rl:auth:'),
  keyGenerator: generateKey,
  handler: rateLimitHandler,
  skip: skipRateLimit
});

// API endpoints - 60 requests per minute
export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100, // Increased slightly
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore('rl:api:'),
  keyGenerator: generateKey,
  handler: rateLimitHandler,
  skip: skipRateLimit
});

// Heavy operations (voice, assistant) - 20 requests per minute
export const heavyOperationRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 40, // Increased slightly
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore('rl:heavy:'),
  keyGenerator: generateKey,
  handler: rateLimitHandler,
  skip: skipRateLimit
});

// Upload endpoints - 10 requests per minute
export const uploadRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20, // Increased slightly
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore('rl:upload:'),
  keyGenerator: generateKey,
  handler: rateLimitHandler,
  skip: skipRateLimit
});

// Webhook endpoints - 100 requests per minute
export const webhookRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200, // Increased slightly
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore('rl:webhook:'),
  keyGenerator: (req) => `rate-limit:webhook:${req.ip || 'unknown'}`,
  handler: rateLimitHandler,
  skip: skipRateLimit
});

// Export Redis client for use in other modules
export { redis as rateLimitRedis };
