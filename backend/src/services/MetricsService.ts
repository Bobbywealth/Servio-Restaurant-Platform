import { StatsD } from 'hot-shots';
import { logger } from '../utils/logger';

/**
 * Metrics Service for custom application metrics
 * Uses StatsD protocol (compatible with DataDog, Graphite, etc.)
 */

export class MetricsService {
  private client: StatsD | null = null;
  private enabled: boolean = false;
  private readonly prefix: string = 'servio.';

  constructor() {
    // Only initialize if StatsD is configured
    if (process.env.STATSD_HOST) {
      try {
        this.client = new StatsD({
          host: process.env.STATSD_HOST,
          port: parseInt(process.env.STATSD_PORT || '8125'),
          prefix: this.prefix,
          globalTags: {
            environment: process.env.NODE_ENV || 'development',
            service: 'servio-backend',
            version: process.env.npm_package_version || '1.0.0'
          },
          errorHandler: (error) => {
            logger.error('StatsD error', { error: error.message });
          }
        });

        this.enabled = true;
        logger.info('Metrics service initialized', {
          host: process.env.STATSD_HOST,
          port: process.env.STATSD_PORT || '8125'
        });
      } catch (error: any) {
        logger.error('Failed to initialize metrics service', { error: error.message });
        this.enabled = false;
      }
    } else {
      logger.info('Metrics service disabled (STATSD_HOST not configured)');
    }
  }

  /**
   * Increment a counter
   */
  increment(metric: string, value: number = 1, tags?: Record<string, string>): void {
    if (!this.enabled || !this.client) return;
    
    try {
      this.client.increment(metric, value, tags ? this.formatTags(tags) : undefined);
    } catch (error: any) {
      logger.error('Failed to increment metric', { metric, error: error.message });
    }
  }

  /**
   * Decrement a counter
   */
  decrement(metric: string, value: number = 1, tags?: Record<string, string>): void {
    if (!this.enabled || !this.client) return;
    
    try {
      this.client.decrement(metric, value, tags ? this.formatTags(tags) : undefined);
    } catch (error: any) {
      logger.error('Failed to decrement metric', { metric, error: error.message });
    }
  }

  /**
   * Record a gauge value (current state)
   */
  gauge(metric: string, value: number, tags?: Record<string, string>): void {
    if (!this.enabled || !this.client) return;
    
    try {
      this.client.gauge(metric, value, tags ? this.formatTags(tags) : undefined);
    } catch (error: any) {
      logger.error('Failed to record gauge', { metric, error: error.message });
    }
  }

  /**
   * Record a histogram value (distribution)
   */
  histogram(metric: string, value: number, tags?: Record<string, string>): void {
    if (!this.enabled || !this.client) return;
    
    try {
      this.client.histogram(metric, value, tags ? this.formatTags(tags) : undefined);
    } catch (error: any) {
      logger.error('Failed to record histogram', { metric, error: error.message });
    }
  }

  /**
   * Record a timing value (duration in ms)
   */
  timing(metric: string, duration: number, tags?: Record<string, string>): void {
    if (!this.enabled || !this.client) return;
    
    try {
      this.client.timing(metric, duration, tags ? this.formatTags(tags) : undefined);
    } catch (error: any) {
      logger.error('Failed to record timing', { metric, error: error.message });
    }
  }

  /**
   * Record a set value (unique occurrences)
   */
  set(metric: string, value: string | number, tags?: Record<string, string>): void {
    if (!this.enabled || !this.client) return;
    
    try {
      this.client.set(metric, value, tags ? this.formatTags(tags) : undefined);
    } catch (error: any) {
      logger.error('Failed to record set', { metric, error: error.message });
    }
  }

  /**
   * Time a function execution
   */
  async timeAsync<T>(
    metric: string,
    fn: () => Promise<T>,
    tags?: Record<string, string>
  ): Promise<T> {
    const start = Date.now();
    
    try {
      const result = await fn();
      const duration = Date.now() - start;
      this.timing(metric, duration, tags);
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.timing(metric, duration, { ...tags, error: 'true' });
      throw error;
    }
  }

  /**
   * Format tags for StatsD
   */
  private formatTags(tags: Record<string, string>): string[] {
    return Object.entries(tags).map(([key, value]) => `${key}:${value}`);
  }

  /**
   * Close metrics client
   */
  close(): void {
    if (this.client) {
      this.client.close();
      logger.info('Metrics service closed');
    }
  }

  /**
   * Application-specific metrics
   */

  // Order metrics
  orderCreated(restaurantId: string, channel: string, type: string): void {
    this.increment('orders.created', 1, { restaurantId, channel, type });
  }

  orderCompleted(restaurantId: string, duration: number): void {
    this.increment('orders.completed', 1, { restaurantId });
    this.timing('orders.completion_time', duration, { restaurantId });
  }

  orderFailed(restaurantId: string, reason: string): void {
    this.increment('orders.failed', 1, { restaurantId, reason });
  }

  // Voice/Assistant metrics
  voiceCallReceived(restaurantId: string): void {
    this.increment('voice.calls.received', 1, { restaurantId });
  }

  voiceCallCompleted(restaurantId: string, duration: number, success: boolean): void {
    this.increment('voice.calls.completed', 1, { restaurantId, success: success.toString() });
    this.timing('voice.call_duration', duration, { restaurantId });
  }

  assistantQuery(restaurantId: string, type: 'text' | 'voice'): void {
    this.increment('assistant.queries', 1, { restaurantId, type });
  }

  assistantResponse(restaurantId: string, duration: number, success: boolean): void {
    this.increment('assistant.responses', 1, { restaurantId, success: success.toString() });
    this.timing('assistant.response_time', duration, { restaurantId });
  }

  // Inventory metrics
  inventoryUpdated(restaurantId: string): void {
    this.increment('inventory.updates', 1, { restaurantId });
  }

  inventoryLowStock(restaurantId: string, count: number): void {
    this.gauge('inventory.low_stock_items', count, { restaurantId });
  }

  // Task metrics
  taskCreated(restaurantId: string, priority: string): void {
    this.increment('tasks.created', 1, { restaurantId, priority });
  }

  taskCompleted(restaurantId: string, duration: number): void {
    this.increment('tasks.completed', 1, { restaurantId });
    this.timing('tasks.completion_time', duration, { restaurantId });
  }

  // Database metrics
  queryExecuted(queryName: string, duration: number, success: boolean): void {
    this.increment('database.queries', 1, { queryName, success: success.toString() });
    this.timing('database.query_time', duration, { queryName });
  }

  // Cache metrics
  cacheHit(key: string): void {
    this.increment('cache.hits', 1, { key });
  }

  cacheMiss(key: string): void {
    this.increment('cache.misses', 1, { key });
  }

  cacheSetDuration(duration: number): void {
    this.timing('cache.set_time', duration);
  }

  // API metrics
  apiRequest(endpoint: string, method: string, statusCode: number, duration: number): void {
    this.increment('api.requests', 1, { endpoint, method, statusCode: statusCode.toString() });
    this.timing('api.response_time', duration, { endpoint, method });
  }

  apiError(endpoint: string, method: string, errorType: string): void {
    this.increment('api.errors', 1, { endpoint, method, errorType });
  }

  // External service metrics
  externalApiCall(service: string, endpoint: string, duration: number, success: boolean): void {
    this.increment('external.api_calls', 1, { service, endpoint, success: success.toString() });
    this.timing('external.api_time', duration, { service, endpoint });
  }

  // OpenAI metrics
  openaiRequest(model: string, tokens: number, duration: number): void {
    this.increment('openai.requests', 1, { model });
    this.gauge('openai.tokens_used', tokens, { model });
    this.timing('openai.response_time', duration, { model });
  }

  openaiError(model: string, errorType: string): void {
    this.increment('openai.errors', 1, { model, errorType });
  }

  // System metrics
  memoryUsage(rss: number, heapUsed: number, heapTotal: number): void {
    this.gauge('system.memory.rss', rss);
    this.gauge('system.memory.heap_used', heapUsed);
    this.gauge('system.memory.heap_total', heapTotal);
  }

  activeConnections(count: number): void {
    this.gauge('system.connections.active', count);
  }

  // Business metrics
  activeUsers(restaurantId: string, count: number): void {
    this.gauge('business.active_users', count, { restaurantId });
  }

  revenue(restaurantId: string, amount: number): void {
    this.histogram('business.revenue', amount, { restaurantId });
  }

  ordersPerHour(restaurantId: string, count: number): void {
    this.gauge('business.orders_per_hour', count, { restaurantId });
  }
}

// Singleton instance
let metricsServiceInstance: MetricsService | null = null;

export const getMetricsService = (): MetricsService => {
  if (!metricsServiceInstance) {
    metricsServiceInstance = new MetricsService();
  }
  return metricsServiceInstance;
};

export default MetricsService;
