import Bottleneck from 'bottleneck';
import CircuitBreaker from 'opossum';
import { logger } from './logger';

/**
 * Resilience utilities: Circuit breakers, rate limiters, and retry logic
 */

/**
 * Rate limiter for OpenAI API
 */
export const openAILimiter = new Bottleneck({
  reservoir: 100, // Initial requests
  reservoirRefreshAmount: 100, // Requests per refresh interval
  reservoirRefreshInterval: 60 * 1000, // 1 minute
  maxConcurrent: 10, // Max concurrent requests
  minTime: 100, // Minimum 100ms between requests
  trackDoneStatus: true,
  id: 'openai-limiter'
});

openAILimiter.on('error', (error: any) => {
  logger.error('OpenAI rate limiter error', { error: error.message });
});

openAILimiter.on('depleted', () => {
  logger.warn('OpenAI rate limit reservoir depleted');
});

/**
 * Rate limiter for Twilio API
 */
export const twilioLimiter = new Bottleneck({
  reservoir: 50,
  reservoirRefreshAmount: 50,
  reservoirRefreshInterval: 60 * 1000,
  maxConcurrent: 5,
  minTime: 200,
  trackDoneStatus: true,
  id: 'twilio-limiter'
});

twilioLimiter.on('error', (error: any) => {
  logger.error('Twilio rate limiter error', { error: error.message });
});

/**
 * Rate limiter for external API calls (generic)
 */
export const externalAPILimiter = new Bottleneck({
  reservoir: 100,
  reservoirRefreshAmount: 100,
  reservoirRefreshInterval: 60 * 1000,
  maxConcurrent: 20,
  minTime: 50,
  trackDoneStatus: true,
  id: 'external-api-limiter'
});

/**
 * Circuit breaker options
 */
export interface CircuitBreakerOptions {
  timeout?: number;              // Request timeout (ms)
  errorThresholdPercentage?: number; // Error % to open circuit
  resetTimeout?: number;         // Time before retry (ms)
  rollingCountTimeout?: number;  // Stats window (ms)
  rollingCountBuckets?: number;  // Number of buckets
  name?: string;                 // Circuit breaker name
}

/**
 * Create a circuit breaker for a function
 */
export const createCircuitBreaker = <T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options: CircuitBreakerOptions = {}
): any => {
  const defaultOptions: CircuitBreakerOptions = {
    timeout: 10000, // 10 seconds
    errorThresholdPercentage: 50, // Open circuit if 50% errors
    resetTimeout: 30000, // Try again after 30 seconds
    rollingCountTimeout: 10000, // 10 second rolling window
    rollingCountBuckets: 10,
    name: fn.name || 'unknown'
  };

  const finalOptions = { ...defaultOptions, ...options };
  const breaker = new CircuitBreaker(fn, finalOptions as any);

  // Event handlers
  breaker.on('open', () => {
    logger.warn(`Circuit breaker opened: ${finalOptions.name}`);
  });

  breaker.on('halfOpen', () => {
    logger.info(`Circuit breaker half-open: ${finalOptions.name}`);
  });

  breaker.on('close', () => {
    logger.info(`Circuit breaker closed: ${finalOptions.name}`);
  });

  breaker.on('reject', () => {
    logger.warn(`Circuit breaker rejected request: ${finalOptions.name}`);
  });

  breaker.on('timeout', () => {
    logger.warn(`Circuit breaker timeout: ${finalOptions.name}`);
  });

  breaker.on('fallback', (result: any) => {
    logger.info(`Circuit breaker fallback executed: ${finalOptions.name}`, { result });
  });

  breaker.on('failure', (error: any) => {
    logger.error(`Circuit breaker failure: ${finalOptions.name}`, { error: error?.message || String(error) });
  });

  return breaker as any;
};

/**
 * Retry with exponential backoff
 */
export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  exponential?: boolean;
  jitter?: boolean;
  onRetry?: (attempt: number, error: Error) => void;
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 30000,
    exponential = true,
    jitter = true,
    onRetry
  } = options;

  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Don't retry on last attempt
      if (attempt === maxRetries) {
        break;
      }

      // Calculate delay
      let delay = exponential 
        ? baseDelay * Math.pow(2, attempt)
        : baseDelay;

      // Apply max delay cap
      delay = Math.min(delay, maxDelay);

      // Add jitter to prevent thundering herd
      if (jitter) {
        delay = delay * (0.5 + Math.random() * 0.5);
      }

      logger.warn('Retry attempt', {
        attempt: attempt + 1,
        maxRetries,
        delay,
        error: error.message
      });

      // Call onRetry callback if provided
      if (onRetry) {
        try {
          onRetry(attempt + 1, error);
        } catch (callbackError) {
          logger.error('onRetry callback failed', { callbackError });
        }
      }

      // Wait before retry
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}

/**
 * Wrap OpenAI calls with circuit breaker and rate limiting
 */
export const safeOpenAICall = createCircuitBreaker(
  async (fn: () => Promise<any>) => {
    return openAILimiter.schedule(() => fn());
  },
  {
    timeout: 30000, // 30 seconds
    errorThresholdPercentage: 50,
    resetTimeout: 60000, // 1 minute
    name: 'openai-api'
  }
);

/**
 * Wrap Twilio calls with circuit breaker and rate limiting
 */
export const safeTwilioCall = createCircuitBreaker(
  async (fn: () => Promise<any>) => {
    return twilioLimiter.schedule(() => fn());
  },
  {
    timeout: 15000, // 15 seconds
    errorThresholdPercentage: 50,
    resetTimeout: 30000,
    name: 'twilio-api'
  }
);

/**
 * Wrap generic external API calls
 */
export const safeExternalAPICall = createCircuitBreaker(
  async (fn: () => Promise<any>, _serviceName: string = 'external-api') => {
    return externalAPILimiter.schedule(() => fn());
  },
  {
    timeout: 10000,
    errorThresholdPercentage: 50,
    resetTimeout: 30000,
    name: 'external-api'
  }
);

/**
 * Timeout wrapper
 */
export const withTimeout = <T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string = 'Operation timed out'
): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    )
  ]);
};

/**
 * Retry specific HTTP status codes
 */
export const isRetryableError = (error: any): boolean => {
  // Network errors
  if (error.code === 'ECONNREFUSED' || 
      error.code === 'ENOTFOUND' || 
      error.code === 'ETIMEDOUT' ||
      error.code === 'ECONNRESET') {
    return true;
  }

  // HTTP status codes that are retryable
  const retryableStatuses = [408, 429, 500, 502, 503, 504];
  if (error.response?.status && retryableStatuses.includes(error.response.status)) {
    return true;
  }

  return false;
};

/**
 * Smart retry - only retry on retryable errors
 */
export async function smartRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  return retryWithBackoff(fn, {
    ...options,
    onRetry: (attempt, error) => {
      if (!isRetryableError(error)) {
        throw error; // Don't retry non-retryable errors
      }
      options.onRetry?.(attempt, error);
    }
  });
}

/**
 * Batch operations with rate limiting
 */
export async function batchProcess<T, R>(
  items: T[],
  processFn: (item: T) => Promise<R>,
  options: {
    batchSize?: number;
    delayBetweenBatches?: number;
    maxConcurrent?: number;
  } = {}
): Promise<R[]> {
  const {
    batchSize = 10,
    delayBetweenBatches = 100,
    maxConcurrent = 5
  } = options;

  const results: R[] = [];
  const limiter = new Bottleneck({ maxConcurrent });

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    
    const batchResults = await Promise.all(
      batch.map((item) => limiter.schedule(() => processFn(item)))
    );
    
    results.push(...batchResults);

    // Delay between batches (except for last batch)
    if (i + batchSize < items.length) {
      await new Promise((resolve) => setTimeout(resolve, delayBetweenBatches));
    }
  }

  return results;
}

/**
 * Get circuit breaker stats
 */
export const getCircuitBreakerStats = (breaker: any) => {
  return {
    name: breaker.name,
    state: breaker.opened ? 'open' : breaker.halfOpen ? 'half-open' : 'closed',
    stats: breaker.stats,
    options: breaker.options
  };
};

export default {
  openAILimiter,
  twilioLimiter,
  externalAPILimiter,
  createCircuitBreaker,
  retryWithBackoff,
  smartRetry,
  safeOpenAICall,
  safeTwilioCall,
  safeExternalAPICall,
  withTimeout,
  isRetryableError,
  batchProcess,
  getCircuitBreakerStats
};
