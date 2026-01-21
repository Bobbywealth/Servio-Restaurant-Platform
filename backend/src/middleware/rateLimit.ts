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
  maxRetriesPerRequest: 3, // Don't block forever
  enableReadyCheck: true,
  enableOfflineQueue: false, // FAIL FAST if Redis is down
  retryStrategy: (times) => {
    // Stop retrying after 3 attempts if we can't connect at all
    if (times > 3) return null;
    const delay = Math.min(times * 100, 2000);
    return delay;
  }
});

redis.on('error', (err) => {
  // Only log full error if it's not a connection refusal to reduce spam
  if (err.message && err.message.includes('ECONNREFUSED')) {
    logger.warn('Redis connection refused for rate limiting - falling back to fail-open mode');
  } else {
    logger.error('Redis client error for rate limiting:', err);
  }
});

redis.on('connect', () => {
  logger.info('Redis connected for rate limiting');
});

// Custom key generator for rate limiting
const generateKey = (req: Request): string => {
  // Use user ID if authenticated, otherwise use IP
  const userId = req.user?.id;
  if (userId) {
    return `rate-limit:user:${userId}`;
  }
  
  // Get real IP behind proxies
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  return `rate-limit:ip:${ip}`;
};

// Custom handler for rate limit exceeded
const rateLimitHandler = (req: Request, res: Response) => {
  logger.warn('Rate limit exceeded', {
    ip: req.ip,
    userId: req.user?.id,
    path: req.path,
    method: req.method
  });

  res.status(429).json({
    success: false,
    error: {
      message: 'Too many requests, please try again later',
      type: 'RateLimitExceeded',
      retryAfter: res.getHeader('Retry-After')
    }
  });
};

// Skip rate limiting for specific conditions
const skipRateLimit = (req: Request): boolean => {
  // Skip for health checks
  if (req.path === '/health' || req.path === '/api/health') {
    return true;
  }

  // Skip for whitelisted IPs (e.g., monitoring services)
  const whitelistedIPs = process.env.RATE_LIMIT_WHITELIST?.split(',') || [];
  const clientIP = req.ip || req.socket.remoteAddress;
  if (clientIP && whitelistedIPs.includes(clientIP)) {
    return true;
  }

  return false;
};

// Create Redis stores with fail-safe mechanism
const createRedisStore = (prefix: string) => {
  return new RedisStore({
    sendCommand: async (...args: string[]): Promise<any> => {
      // Fail-safe: if Redis is not ready, return a "neutral" response 
      // to let the request proceed instead of hanging
      if (redis.status !== 'ready') {
        return null; 
      }
      try {
        return await redis.call(args[0], ...args.slice(1));
      } catch (error) {
        logger.warn(`Redis rate limit error for ${prefix}, allowing request:`, error);
        return null;
      }
    },
    prefix
  });
};

// Global rate limiter - 100 requests per 15 minutes
export const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore('rl:global:'),
  keyGenerator: generateKey,
  handler: rateLimitHandler,
  skip: skipRateLimit
});

// Strict rate limiter for auth endpoints - 5 requests per 15 minutes
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore('rl:auth:'),
  keyGenerator: generateKey,
  handler: rateLimitHandler,
  skip: skipRateLimit
});

// API endpoints - 60 requests per minute
export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore('rl:api:'),
  keyGenerator: generateKey,
  handler: rateLimitHandler,
  skip: skipRateLimit
});

// Heavy operations (voice, assistant) - 20 requests per minute
export const heavyOperationRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore('rl:heavy:'),
  keyGenerator: generateKey,
  handler: rateLimitHandler,
  skip: skipRateLimit
});

// Upload endpoints - 10 requests per minute
export const uploadRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore('rl:upload:'),
  keyGenerator: generateKey,
  handler: rateLimitHandler,
  skip: skipRateLimit
});

// Webhook endpoints - 100 requests per minute (external services)
export const webhookRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore('rl:webhook:'),
  keyGenerator: (req) => {
    // For webhooks, use IP only (no user context)
    return `rate-limit:webhook:${req.ip || 'unknown'}`;
  },
  handler: rateLimitHandler,
  skip: skipRateLimit
});

// Export Redis client for use in other modules
export { redis as rateLimitRedis };
