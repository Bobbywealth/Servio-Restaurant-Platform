import { getMetricsService } from '../services/MetricsService';
import { logger } from '../utils/logger';

/**
 * Performance monitoring decorator
 * Automatically tracks method execution time and reports to metrics service
 */
export function Track(operation?: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const opName = operation || `${target.constructor.name}.${propertyKey}`;

    descriptor.value = async function (...args: any[]) {
      const start = Date.now();
      const metrics = getMetricsService();
      
      try {
        const result = await originalMethod.apply(this, args);
        const duration = Date.now() - start;
        
        // Track successful execution
        metrics.timing(`performance.${opName}`, duration, {
          status: 'success'
        });

        // Log slow operations
        if (duration > 1000) {
          logger.warn(`Slow operation detected: ${opName}`, {
            duration,
            method: propertyKey
          });
        }

        return result;
      } catch (error) {
        const duration = Date.now() - start;
        
        // Track failed execution
        metrics.timing(`performance.${opName}`, duration, {
          status: 'error'
        });
        metrics.increment(`errors.${opName}`, 1);

        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Cache decorator - automatically cache method results
 */
export function Cacheable(options: {
  key: (args: any[]) => string;
  ttl: number;
  cacheServiceKey?: string;
}) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      // Get cache service from context
      const cacheService = (this as any).cache || (this as any).cacheService;
      
      if (!cacheService) {
        // No cache available, execute normally
        return originalMethod.apply(this, args);
      }

      const cacheKey = options.key(args);
      
      // Try to get from cache
      const cached = await cacheService.get(cacheKey);
      if (cached !== null) {
        getMetricsService().cacheHit(cacheKey);
        return cached;
      }

      getMetricsService().cacheMiss(cacheKey);

      // Execute and cache result
      const result = await originalMethod.apply(this, args);
      await cacheService.set(cacheKey, result, options.ttl);
      
      return result;
    };

    return descriptor;
  };
}

/**
 * Retry decorator - automatically retry failed operations
 */
export function Retry(options: {
  maxAttempts?: number;
  delay?: number;
  exponentialBackoff?: boolean;
  retryableErrors?: string[];
}) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const maxAttempts = options.maxAttempts || 3;
    const baseDelay = options.delay || 1000;
    const exponential = options.exponentialBackoff !== false;

    descriptor.value = async function (...args: any[]) {
      let lastError: Error;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
          return await originalMethod.apply(this, args);
        } catch (error: any) {
          lastError = error;

          // Check if error is retryable
          if (options.retryableErrors && options.retryableErrors.length > 0) {
            const isRetryable = options.retryableErrors.some((errType) =>
              error.message?.includes(errType) || error.code === errType
            );
            if (!isRetryable) {
              throw error;
            }
          }

          // Don't wait after last attempt
          if (attempt < maxAttempts - 1) {
            const delay = exponential
              ? baseDelay * Math.pow(2, attempt)
              : baseDelay;

            logger.warn(`Retrying ${propertyKey} (attempt ${attempt + 1}/${maxAttempts})`, {
              delay,
              error: error.message
            });

            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }
      }

      throw lastError!;
    };

    return descriptor;
  };
}

/**
 * Rate limit decorator - limit method execution rate
 */
export function RateLimit(options: {
  maxCalls: number;
  windowMs: number;
}) {
  const calls = new Map<string, number[]>();

  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const key = `${target.constructor.name}.${propertyKey}`;
      const now = Date.now();
      
      // Clean up old calls
      if (!calls.has(key)) {
        calls.set(key, []);
      }

      const timestamps = calls.get(key)!;
      const recentCalls = timestamps.filter((ts) => now - ts < options.windowMs);
      
      if (recentCalls.length >= options.maxCalls) {
        throw new Error(
          `Rate limit exceeded for ${propertyKey}: ${options.maxCalls} calls per ${options.windowMs}ms`
        );
      }

      recentCalls.push(now);
      calls.set(key, recentCalls);

      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}

/**
 * Timeout decorator - enforce method execution timeout
 */
export function Timeout(timeoutMs: number, errorMessage?: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      return Promise.race([
        originalMethod.apply(this, args),
        new Promise((_, reject) =>
          setTimeout(
            () =>
              reject(
                new Error(
                  errorMessage || `${propertyKey} timed out after ${timeoutMs}ms`
                )
              ),
            timeoutMs
          )
        )
      ]);
    };

    return descriptor;
  };
}

/**
 * Memoize decorator - cache method results in memory
 */
export function Memoize(ttlMs?: number) {
  const cache = new Map<string, { value: any; timestamp: number }>();

  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = function (...args: any[]) {
      const key = `${target.constructor.name}.${propertyKey}:${JSON.stringify(args)}`;
      const now = Date.now();

      if (cache.has(key)) {
        const cached = cache.get(key)!;
        if (!ttlMs || now - cached.timestamp < ttlMs) {
          return cached.value;
        }
      }

      const result = originalMethod.apply(this, args);
      cache.set(key, { value: result, timestamp: now });
      
      return result;
    };

    return descriptor;
  };
}

export default {
  Track,
  Cacheable,
  Retry,
  RateLimit,
  Timeout,
  Memoize
};
