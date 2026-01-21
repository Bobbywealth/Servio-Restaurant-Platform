import rateLimit from 'express-rate-limit';
import type { Request, Response } from 'express';

/**
 * NOTE:
 * We intentionally use the built-in in-memory store for rate limiting.
 *
 * Render deployments in this repo currently do not have Redis configured,
 * and `rate-limit-redis` was causing unhandled rejections / crashes when Redis
 * is unavailable. MemoryStore is safer than a broken distributed store.
 *
 * If you later add Redis, re-introduce a Redis store behind a feature flag
 * (e.g. REDIS_URL) and only enable it when connectivity is confirmed.
 */

/** Generate a consistent key per client. */
function generateKey(req: Request): string {
  // Prefer x-forwarded-for if present (common behind proxies)
  const xff = req.headers['x-forwarded-for'];
  const forwardedIp = typeof xff === 'string' ? xff.split(',')[0].trim() : undefined;

  const ip = forwardedIp || req.ip || req.socket?.remoteAddress || 'unknown';

  // If user is authenticated, prefer stable per-user throttling
  const userId = (req as any).user?.id;
  if (userId) return `user:${userId}`;

  return `ip:${ip}`;
}

/** Skip rate limiting for health checks, etc. */
function skipRateLimit(req: Request): boolean {
  if (req.path === '/health' || req.path === '/api/health' || req.path === '/health-basic') return true;
  if (process.env.NODE_ENV === 'test') return true;
  return false;
}

/** Standard response when limited. */
function rateLimitHandler(req: Request, res: Response) {
  return res.status(429).json({
    success: false,
    error: {
      type: 'RateLimitExceeded',
      message: 'Too many requests, please try again shortly'
    }
  });
}

function createLimiter(options: { windowMs: number; max: number }) {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: generateKey,
    skip: skipRateLimit,
    handler: (req, res) => rateLimitHandler(req, res)
  });
}

// Global rate limiter - 100 requests per 15 minutes
export const globalRateLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 100
});

// Auth endpoints - 10 requests per 15 minutes
export const authRateLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10
});

// API endpoints - 100 requests per minute
export const apiRateLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 100
});

// Heavy operations - 40 requests per minute
export const heavyOperationRateLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 40
});

// Upload endpoints - 20 requests per minute
export const uploadRateLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 20
});

// Webhook endpoints - 200 requests per minute
export const webhookRateLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 200
});
