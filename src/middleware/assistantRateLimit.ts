import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

interface AssistantRateLimitOptions {
  endpoint: string;
  maxRequests: number;
  windowMs: number;
}

type KeyType = 'user' | 'restaurant' | 'ip';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimitTelemetry {
  blockedRequestsTotal: number;
  blockedRequestsByEndpoint: Record<string, number>;
  blockedRequestsByKeyType: Record<KeyType, number>;
}

const rateLimitStore = new Map<string, RateLimitEntry>();
const telemetry: RateLimitTelemetry = {
  blockedRequestsTotal: 0,
  blockedRequestsByEndpoint: {},
  blockedRequestsByKeyType: {
    user: 0,
    restaurant: 0,
    ip: 0
  }
};

let requestCounter = 0;

const parseKeyValue = (value: unknown): string => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : '';
  }

  if (Array.isArray(value) && value.length > 0) {
    return parseKeyValue(value[0]);
  }

  return '';
};

const resolveRateLimitKey = (req: Request): { key: string; keyType: KeyType } => {
  const userId = parseKeyValue(req.user?.id);
  if (userId) {
    return { key: `user:${userId}`, keyType: 'user' };
  }

  const restaurantId = parseKeyValue(req.user?.restaurantId);
  if (restaurantId) {
    return { key: `restaurant:${restaurantId}`, keyType: 'restaurant' };
  }

  return {
    key: `ip:${parseKeyValue(req.ip) || 'unknown'}`,
    keyType: 'ip'
  };
};

const pruneExpiredEntries = (now: number): void => {
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt <= now) {
      rateLimitStore.delete(key);
    }
  }
};

const createRateLimitResponse = (retryAfterSeconds: number, options: AssistantRateLimitOptions) => ({
  success: false,
  error: {
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Rate limit exceeded for assistant endpoint. Please retry later.',
    retryAfterSeconds,
    limit: {
      maxRequests: options.maxRequests,
      windowMs: options.windowMs
    }
  }
});

export const assistantRateLimit = (options: AssistantRateLimitOptions) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();

    requestCounter += 1;
    if (requestCounter % 100 === 0) {
      pruneExpiredEntries(now);
    }

    const { key, keyType } = resolveRateLimitKey(req);
    const storeKey = `${options.endpoint}:${key}`;
    const existing = rateLimitStore.get(storeKey);

    if (!existing || existing.resetAt <= now) {
      rateLimitStore.set(storeKey, {
        count: 1,
        resetAt: now + options.windowMs
      });
      next();
      return;
    }

    if (existing.count >= options.maxRequests) {
      const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSeconds));

      telemetry.blockedRequestsTotal += 1;
      telemetry.blockedRequestsByEndpoint[options.endpoint] = (telemetry.blockedRequestsByEndpoint[options.endpoint] || 0) + 1;
      telemetry.blockedRequestsByKeyType[keyType] += 1;

      logger.warn('[assistant.rate-limit] Request blocked by rate limit', {
        endpoint: options.endpoint,
        key,
        keyType,
        retryAfterSeconds,
        windowMs: options.windowMs,
        maxRequests: options.maxRequests
      });

      res.status(429).json(createRateLimitResponse(retryAfterSeconds, options));
      return;
    }

    existing.count += 1;
    rateLimitStore.set(storeKey, existing);
    next();
  };
};

export const getAssistantRateLimitTelemetry = (): RateLimitTelemetry => ({
  blockedRequestsTotal: telemetry.blockedRequestsTotal,
  blockedRequestsByEndpoint: { ...telemetry.blockedRequestsByEndpoint },
  blockedRequestsByKeyType: { ...telemetry.blockedRequestsByKeyType }
});
