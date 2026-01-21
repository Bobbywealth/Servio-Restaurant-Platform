// ULTRA-FAST RESPONSE OPTIMIZATION MIDDLEWARE
import { Request, Response, NextFunction } from 'express';
import { performance } from 'perf_hooks';

interface OptimizationOptions {
  enableETag?: boolean;
  enableLastModified?: boolean;
  enableCaching?: boolean;
  maxAge?: number;
  staleWhileRevalidate?: number;
  enableCompression?: boolean;
}

// Response timing tracker
class ResponseTimer {
  private startTime: number;
  private dbTime: number = 0;
  private cacheTime: number = 0;
  
  constructor() {
    this.startTime = performance.now();
  }
  
  addDbTime(time: number) {
    this.dbTime += time;
  }
  
  addCacheTime(time: number) {
    this.cacheTime += time;
  }
  
  getTotalTime(): number {
    return performance.now() - this.startTime;
  }
  
  getBreakdown() {
    return {
      total: this.getTotalTime(),
      db: this.dbTime,
      cache: this.cacheTime,
      processing: this.getTotalTime() - this.dbTime - this.cacheTime
    };
  }
}

// ETag generation for consistent caching
function generateETag(content: any): string {
  const crypto = require('crypto');
  const hash = crypto.createHash('md5');
  
  if (typeof content === 'string') {
    hash.update(content);
  } else if (Buffer.isBuffer(content)) {
    hash.update(content);
  } else {
    hash.update(JSON.stringify(content));
  }
  
  return `"${hash.digest('hex')}"`;
}

// Check if response should be cached
function shouldCache(req: Request, res: Response): boolean {
  // Don't cache if there are query parameters (usually dynamic)
  if (Object.keys(req.query).length > 0) {
    return false;
  }
  
  // Don't cache POST, PUT, DELETE requests
  if (!['GET', 'HEAD'].includes(req.method)) {
    return false;
  }
  
  // Don't cache if authorization header is present
  if (req.headers.authorization) {
    return false;
  }
  
  // Don't cache error responses
  const status = res.statusCode;
  if (status < 200 || status >= 400) {
    return false;
  }
  
  return true;
}

// Set optimal cache headers based on content type and route
function setCacheHeaders(req: Request, res: Response, maxAge: number, staleWhileRevalidate: number) {
  const route = req.route?.path || req.path;
  
  // Different cache strategies based on route patterns
  if (route.includes('/api/menu') || route.includes('/api/restaurant')) {
    // Menu and restaurant data - cache longer
    res.setHeader('Cache-Control', `public, max-age=${maxAge * 4}, stale-while-revalidate=${staleWhileRevalidate * 2}`);
  } else if (route.includes('/api/orders') || route.includes('/api/inventory')) {
    // Orders and inventory - shorter cache
    res.setHeader('Cache-Control', `public, max-age=${maxAge / 2}, stale-while-revalidate=${staleWhileRevalidate}`);
  } else if (route.includes('/api/stats') || route.includes('/api/summary')) {
    // Stats and summaries - medium cache
    res.setHeader('Cache-Control', `public, max-age=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}`);
  } else {
    // Default caching
    res.setHeader('Cache-Control', `public, max-age=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}`);
  }
}

// Main response optimization middleware
export function createResponseOptimization(options: OptimizationOptions = {}) {
  const {
    enableETag = true,
    enableLastModified = true,
    enableCaching = true,
    maxAge = 300, // 5 minutes
    staleWhileRevalidate = 600, // 10 minutes
  } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    const timer = new ResponseTimer();
    
    // Attach timer to request for use in other middleware
    (req as any).timer = timer;
    
    // Override res.json to add optimizations
    const originalJson = res.json;
    res.json = function(obj: any) {
      // Add performance timing headers
      const timing = timer.getBreakdown();
      res.setHeader('X-Response-Time', `${timing.total.toFixed(2)}ms`);
      res.setHeader('X-DB-Time', `${timing.db.toFixed(2)}ms`);
      res.setHeader('X-Cache-Time', `${timing.cache.toFixed(2)}ms`);
      
      // Generate ETag for caching
      if (enableETag) {
        const etag = generateETag(obj);
        res.setHeader('ETag', etag);
        
        // Check if client already has this version
        if (req.headers['if-none-match'] === etag) {
          return res.status(304).end();
        }
      }
      
      // Set Last-Modified header
      if (enableLastModified) {
        res.setHeader('Last-Modified', new Date().toUTCString());
      }
      
      // Set caching headers
      if (enableCaching && shouldCache(req, res)) {
        setCacheHeaders(req, res, maxAge, staleWhileRevalidate);
      }
      
      // Add security headers
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      
      // Call original json method
      return originalJson.call(this, obj);
    };
    
    // Override res.send for other response types
    const originalSend = res.send;
    res.send = function(body: any) {
      const timing = timer.getBreakdown();
      res.setHeader('X-Response-Time', `${timing.total.toFixed(2)}ms`);
      
      if (enableCaching && shouldCache(req, res)) {
        setCacheHeaders(req, res, maxAge, staleWhileRevalidate);
      }
      
      return originalSend.call(this, body);
    };
    
    next();
  };
}

// Database query optimization middleware
export function databaseOptimization(req: Request, res: Response, next: NextFunction) {
  const timer = (req as any).timer as ResponseTimer;
  
  // Patch database service if available
  const dbService = (req as any).dbService;
  if (dbService && timer) {
    const originalExecute = dbService.execute;
    
    dbService.execute = async function(query: string, params?: any[]) {
      const dbStart = performance.now();
      
      try {
        const result = await originalExecute.call(this, query, params);
        timer.addDbTime(performance.now() - dbStart);
        return result;
      } catch (error) {
        timer.addDbTime(performance.now() - dbStart);
        throw error;
      }
    };
  }
  
  next();
}

// Cache optimization middleware
export function cacheOptimization(req: Request, res: Response, next: NextFunction) {
  const timer = (req as any).timer as ResponseTimer;
  
  // Patch cache service if available
  const cacheService = (req as any).cacheService;
  if (cacheService && timer) {
    const originalGet = cacheService.get;
    const originalSet = cacheService.set;
    
    cacheService.get = async function(key: string) {
      const cacheStart = performance.now();
      
      try {
        const result = await originalGet.call(this, key);
        timer.addCacheTime(performance.now() - cacheStart);
        return result;
      } catch (error) {
        timer.addCacheTime(performance.now() - cacheStart);
        throw error;
      }
    };
    
    cacheService.set = async function(key: string, value: any, ttl?: number) {
      const cacheStart = performance.now();
      
      try {
        const result = await originalSet.call(this, key, value, ttl);
        timer.addCacheTime(performance.now() - cacheStart);
        return result;
      } catch (error) {
        timer.addCacheTime(performance.now() - cacheStart);
        throw error;
      }
    };
  }
  
  next();
}

// Response size optimization
export function responseSizeOptimization(req: Request, res: Response, next: NextFunction) {
  const originalJson = res.json;
  
  res.json = function(obj: any) {
    // Remove null/undefined fields to reduce payload size
    function removeEmptyFields(obj: any): any {
      if (Array.isArray(obj)) {
        return obj.map(removeEmptyFields);
      } else if (obj !== null && typeof obj === 'object') {
        const cleaned: any = {};
        for (const [key, value] of Object.entries(obj)) {
          if (value !== null && value !== undefined) {
            cleaned[key] = removeEmptyFields(value);
          }
        }
        return cleaned;
      }
      return obj;
    }
    
    const optimizedObj = removeEmptyFields(obj);
    
    // Add content length for optimization tracking
    const size = JSON.stringify(optimizedObj).length;
    res.setHeader('X-Content-Length', size.toString());
    
    return originalJson.call(this, optimizedObj);
  };
  
  next();
}

// Pre-configured middleware combinations
export const ultraOptimization = [
  createResponseOptimization({
    enableETag: true,
    enableLastModified: true,
    enableCaching: true,
    maxAge: 600, // 10 minutes
    staleWhileRevalidate: 1200, // 20 minutes
  }),
  databaseOptimization,
  cacheOptimization,
  responseSizeOptimization,
];

export const standardOptimization = [
  createResponseOptimization({
    maxAge: 300, // 5 minutes
    staleWhileRevalidate: 600, // 10 minutes
  }),
  databaseOptimization,
  cacheOptimization,
];

export const apiOptimization = [
  createResponseOptimization({
    enableETag: true,
    maxAge: 60, // 1 minute for API responses
    staleWhileRevalidate: 300, // 5 minutes
  }),
  responseSizeOptimization,
];

export default {
  createResponseOptimization,
  databaseOptimization,
  cacheOptimization,
  responseSizeOptimization,
  ultraOptimization,
  standardOptimization,
  apiOptimization,
};