import NodeCache from 'node-cache';
import Redis from 'ioredis';
import { logger } from '../utils/logger';
import { getMetricsService } from './MetricsService';

/**
 * Redis Cache Service with TTL management and invalidation strategies
 */

export class CacheService {
  private l1Cache: NodeCache;
  private redis: Redis;
  private readonly prefix: string = 'servio:cache:';
  private readonly defaultTTL: number = 300; // 5 minutes

  constructor() {
    // L1: In-memory cache (fastest). Keep TTL short to avoid stale data.
    this.l1Cache = new NodeCache({
      stdTTL: 60,
      checkperiod: 120,
      useClones: false
    });

    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || undefined,
      db: parseInt(process.env.REDIS_DB || '1'), // Use DB 1 for cache (DB 0 for rate limiting)
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      enableOfflineQueue: true,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      lazyConnect: true
    });

    this.redis.on('error', (err) => {
      logger.error('Redis cache client error:', err);
    });

    this.redis.on('connect', () => {
      logger.info('Redis cache client connected');
    });

    this.redis.on('ready', () => {
      logger.info('Redis cache client ready');
    });
  }

  /**
   * Generate cache key with prefix
   */
  private getKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      // L1
      const l1 = this.l1Cache.get<T>(key);
      if (l1 !== undefined) {
        getMetricsService().increment('cache.hits', 1, { layer: 'l1' });
        return l1;
      }

      // L2
      const value = await this.redis.get(this.getKey(key));
      if (!value) {
        getMetricsService().increment('cache.misses', 1, { layer: 'l2' });
        return null;
      }

      getMetricsService().increment('cache.hits', 1, { layer: 'l2' });
      const parsed = JSON.parse(value) as T;

      // populate L1
      this.l1Cache.set(key, parsed);
      return parsed;
    } catch (error: any) {
      logger.error('Cache get error', { key, error: error.message });
      return null;
    }
  }

  /**
   * Set value in cache with TTL
   */
  async set<T>(key: string, value: T, ttl: number = this.defaultTTL): Promise<boolean> {
    try {
      const start = Date.now();
      const serialized = JSON.stringify(value);
      // write L1 (cap at 60s unless caller explicitly wants less)
      this.l1Cache.set(key, value, Math.min(ttl, 60));

      // ensure L2 is connected lazily
      if (this.redis.status === 'wait') {
        await this.redis.connect();
      }

      await this.redis.setex(this.getKey(key), ttl, serialized);
      getMetricsService().timing('cache.set_time', Date.now() - start, { layer: 'l2' });
      return true;
    } catch (error: any) {
      logger.error('Cache set error', { key, ttl, error: error.message });
      return false;
    }
  }

  /**
   * Get or set pattern - fetch from cache or execute function and cache result
   */
  async getOrSet<T>(
    key: string,
    ttl: number,
    fetchFn: () => Promise<T>
  ): Promise<T> {
    // Try to get from cache
    const cached = await this.get<T>(key);
    if (cached !== null) {
      logger.debug('Cache hit', { key });
      return cached;
    }

    // Cache miss - fetch fresh data
    logger.debug('Cache miss', { key });
    const fresh = await fetchFn();

    // Store in cache (don't await - fire and forget)
    this.set(key, fresh, ttl).catch((err) => {
      logger.error('Failed to cache value', { key, error: err.message });
    });

    return fresh;
  }

  /**
   * Delete single key
   */
  async delete(key: string): Promise<boolean> {
    try {
      this.l1Cache.del(key);
      const result = await this.redis.del(this.getKey(key));
      return result > 0;
    } catch (error: any) {
      logger.error('Cache delete error', { key, error: error.message });
      return false;
    }
  }

  /**
   * Delete keys matching pattern
   */
  async invalidate(pattern: string): Promise<number> {
    try {
      // Allow multiple patterns separated by "|"
      const patterns = pattern.split('|').map((p) => p.trim()).filter(Boolean);
      let totalDeleted = 0;

      for (const p of patterns) {
        totalDeleted += await this.invalidateSinglePattern(p);
      }

      return totalDeleted;
    } catch (error: any) {
      logger.error('Cache invalidation error', { pattern, error: error.message });
      return 0;
    }
  }

  private async invalidateSinglePattern(pattern: string): Promise<number> {
    // best-effort L1 invalidation by prefix if possible
    if (pattern.endsWith('*')) {
      const prefix = pattern.slice(0, -1);
      const keys = this.l1Cache.keys();
      for (const k of keys) {
        if (k.startsWith(prefix)) this.l1Cache.del(k);
      }
    } else {
      this.l1Cache.del(pattern);
    }

    // Use SCAN instead of KEYS to avoid blocking Redis
    const match = this.getKey(pattern);
    let cursor = '0';
    const toDelete: string[] = [];

    do {
      const [nextCursor, keys] = await this.redis.scan(cursor, 'MATCH', match, 'COUNT', 500);
      cursor = nextCursor;
      if (keys.length) toDelete.push(...keys);
    } while (cursor !== '0');

    if (!toDelete.length) return 0;

    const deleted = await this.redis.del(...toDelete);
    logger.info('Cache invalidated', { pattern, count: deleted });
    return deleted;
  }

  /**
   * Invalidate by prefix (e.g., all menu items for a restaurant)
   */
  async invalidateByPrefix(prefix: string): Promise<number> {
    return this.invalidate(`${prefix}*`);
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      if (this.l1Cache.get(key) !== undefined) return true;
      const result = await this.redis.exists(this.getKey(key));
      return result === 1;
    } catch (error: any) {
      logger.error('Cache exists error', { key, error: error.message });
      return false;
    }
  }

  /**
   * Get TTL for key
   */
  async ttl(key: string): Promise<number> {
    try {
      return await this.redis.ttl(this.getKey(key));
    } catch (error: any) {
      logger.error('Cache TTL error', { key, error: error.message });
      return -1;
    }
  }

  /**
   * Increment counter
   */
  async increment(key: string, amount: number = 1): Promise<number> {
    try {
      return await this.redis.incrby(this.getKey(key), amount);
    } catch (error: any) {
      logger.error('Cache increment error', { key, error: error.message });
      return 0;
    }
  }

  /**
   * Decrement counter
   */
  async decrement(key: string, amount: number = 1): Promise<number> {
    try {
      return await this.redis.decrby(this.getKey(key), amount);
    } catch (error: any) {
      logger.error('Cache decrement error', { key, error: error.message });
      return 0;
    }
  }

  /**
   * Store multiple values at once (pipeline)
   */
  async setMany(items: Array<{ key: string; value: any; ttl?: number }>): Promise<boolean> {
    try {
      const pipeline = this.redis.pipeline();
      
      for (const item of items) {
        const ttl = item.ttl || this.defaultTTL;
        const serialized = JSON.stringify(item.value);
        this.l1Cache.set(item.key, item.value, Math.min(ttl, 60));
        pipeline.setex(this.getKey(item.key), ttl, serialized);
      }

      await pipeline.exec();
      return true;
    } catch (error: any) {
      logger.error('Cache setMany error', { count: items.length, error: error.message });
      return false;
    }
  }

  /**
   * Get multiple values at once (pipeline)
   */
  async getMany<T>(keys: string[]): Promise<Map<string, T>> {
    try {
      const map = new Map<string, T>();
      const missed: string[] = [];

      // L1 first
      for (const key of keys) {
        const v = this.l1Cache.get<T>(key);
        if (v !== undefined) {
          map.set(key, v);
        } else {
          missed.push(key);
        }
      }

      if (missed.length === 0) return map;

      // L2 batch
      const prefixed = missed.map((k) => this.getKey(k));
      const values = await this.redis.mget(...prefixed);

      missed.forEach((k, idx) => {
        const raw = values[idx];
        if (!raw) return;
        try {
          const parsed = JSON.parse(raw) as T;
          map.set(k, parsed);
          this.l1Cache.set(k, parsed);
        } catch {
          logger.error('Failed to parse cached value', { key: k });
        }
      });

      return map;
    } catch (error: any) {
      logger.error('Cache getMany error', { count: keys.length, error: error.message });
      return new Map();
    }
  }

  /**
   * mget alias for the performance guide (returns Map)
   */
  async mget<T>(keys: string[]): Promise<Map<string, T>> {
    return this.getMany(keys);
  }

  /**
   * mset helper (pipeline)
   */
  async mset<T>(entries: Map<string, T>, ttl: number = this.defaultTTL): Promise<void> {
    const pipeline = this.redis.pipeline();
    for (const [key, value] of entries) {
      this.l1Cache.set(key, value, Math.min(ttl, 60));
      pipeline.setex(this.getKey(key), ttl, JSON.stringify(value));
    }
    await pipeline.exec();
  }

  /**
   * Flush all cache
   */
  async flush(): Promise<boolean> {
    try {
      await this.redis.flushdb();
      logger.warn('Cache flushed - all keys deleted');
      return true;
    } catch (error: any) {
      logger.error('Cache flush error', { error: error.message });
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    keys: number;
    memory: string;
    hitRate: number;
    uptime: number;
  } | null> {
    try {
      const info = await this.redis.info('stats');
      const keyspace = await this.redis.info('keyspace');
      const memory = await this.redis.info('memory');

      // Parse stats
      const keysMatch = keyspace.match(/keys=(\d+)/);
      const keys = keysMatch ? parseInt(keysMatch[1]) : 0;

      const memMatch = memory.match(/used_memory_human:(\S+)/);
      const memoryUsed = memMatch ? memMatch[1] : 'unknown';

      const hitsMatch = info.match(/keyspace_hits:(\d+)/);
      const missesMatch = info.match(/keyspace_misses:(\d+)/);
      const hits = hitsMatch ? parseInt(hitsMatch[1]) : 0;
      const misses = missesMatch ? parseInt(missesMatch[1]) : 0;
      const hitRate = (hits + misses) > 0 ? (hits / (hits + misses)) * 100 : 0;

      const uptimeMatch = info.match(/uptime_in_seconds:(\d+)/);
      const uptime = uptimeMatch ? parseInt(uptimeMatch[1]) : 0;

      return {
        keys,
        memory: memoryUsed,
        hitRate: Math.round(hitRate * 100) / 100,
        uptime
      };
    } catch (error: any) {
      logger.error('Failed to get cache stats', { error: error.message });
      return null;
    }
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    this.l1Cache.flushAll();
    await this.redis.quit();
    logger.info('Redis cache client closed');
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ healthy: boolean; latency: number }> {
    const start = Date.now();
    try {
      await this.redis.ping();
      return {
        healthy: true,
        latency: Date.now() - start
      };
    } catch (error) {
      return {
        healthy: false,
        latency: Date.now() - start
      };
    }
  }
}

// Cache TTL constants (in seconds)
export const CacheTTL = {
  MENU_ITEMS: 5 * 60,        // 5 minutes
  RESTAURANT_SETTINGS: 15 * 60, // 15 minutes
  USER_PERMISSIONS: 10 * 60,    // 10 minutes
  INVENTORY: 1 * 60,            // 1 minute
  ORDERS: 30,                   // 30 seconds
  ANALYTICS: 60 * 60,           // 1 hour
  PUBLIC_DATA: 24 * 60 * 60     // 24 hours
};

// Cache key generators
export const CacheKeys = {
  menuItems: (restaurantId: string) => `menu:${restaurantId}:items`,
  menuItem: (itemId: string) => `menu:item:${itemId}`,
  restaurantSettings: (restaurantId: string) => `restaurant:${restaurantId}:settings`,
  userPermissions: (userId: string) => `user:${userId}:permissions`,
  inventory: (restaurantId: string) => `inventory:${restaurantId}`,
  inventoryItem: (itemId: string) => `inventory:item:${itemId}`,
  orders: (restaurantId: string, status: string) => `orders:${restaurantId}:${status}`,
  order: (orderId: string) => `order:${orderId}`
};

// Singleton instance
let cacheServiceInstance: CacheService | null = null;

export const getCacheService = (): CacheService => {
  if (!cacheServiceInstance) {
    cacheServiceInstance = new CacheService();
  }
  return cacheServiceInstance;
};

export default CacheService;
