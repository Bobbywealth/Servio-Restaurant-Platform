import { Request, Response, NextFunction } from 'express';
import { enhancedLogger } from '../utils/logger';

interface PerformanceRequest extends Request {
  startTime?: number;
  requestId?: string;
}

// Request timing middleware
export const performanceMiddleware = (req: PerformanceRequest, res: Response, next: NextFunction) => {
  // Generate unique request ID
  req.requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  req.startTime = Date.now();

  // Add request ID to response headers for debugging
  res.setHeader('X-Request-ID', req.requestId);

  // Hook into response finish to log performance
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any, cb?: any): Response {
    const responseTime = Date.now() - (req.startTime || Date.now());
    
    // Log request performance
    enhancedLogger.request(req, res, responseTime, {
      requestId: req.requestId,
      contentLength: res.get('content-length'),
      userAgent: req.get('User-Agent'),
      referer: req.get('Referer'),
      ip: req.ip || req.connection.remoteAddress
    });

    // Log slow requests
    if (responseTime > 1000) {
      enhancedLogger.warn('Slow Request Detected', {
        requestId: req.requestId,
        method: req.method,
        url: req.url,
        responseTime,
        statusCode: res.statusCode
      });
    }

    // Track memory usage for long requests
    if (responseTime > 5000) {
      const memUsage = process.memoryUsage();
      enhancedLogger.warn('Very Slow Request with Memory Stats', {
        requestId: req.requestId,
        method: req.method,
        url: req.url,
        responseTime,
        statusCode: res.statusCode,
        memoryUsage: {
          rss: `${Math.round(memUsage.rss / 1024 / 1024 * 100) / 100} MB`,
          heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024 * 100) / 100} MB`,
          heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024 * 100) / 100} MB`,
          external: `${Math.round(memUsage.external / 1024 / 1024 * 100) / 100} MB`
        }
      });
    }

    // Call original end method
    return originalEnd.call(this, chunk, encoding, cb);
  };

  next();
};

// Database query performance wrapper
export const withQueryPerformance = async <T>(
  queryName: string,
  queryFn: () => Promise<T>,
  query?: string
): Promise<T> => {
  const startTime = Date.now();
  
  try {
    const result = await queryFn();
    const duration = Date.now() - startTime;
    
    enhancedLogger.database(query || queryName, duration);
    
    // Warn about slow queries
    if (duration > 500) {
      enhancedLogger.warn('Slow Database Query', {
        queryName,
        duration,
        query: query?.substring(0, 200)
      });
    }
    
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    enhancedLogger.database(query || queryName, duration, error as Error);
    throw error;
  }
};

// API call performance wrapper
export const withApiCallPerformance = async <T>(
  service: string,
  method: string,
  url: string,
  apiFn: () => Promise<any>
): Promise<T> => {
  const startTime = Date.now();
  
  try {
    const response = await apiFn();
    const duration = Date.now() - startTime;
    
    enhancedLogger.apiCall(service, method, url, response.status || 200, duration);
    
    return response;
  } catch (error: any) {
    const duration = Date.now() - startTime;
    const status = error.response?.status || 500;
    
    enhancedLogger.apiCall(service, method, url, status, duration, {
      error: error.message
    });
    
    throw error;
  }
};

// System health monitoring
export const systemHealthCheck = () => {
  const memUsage = process.memoryUsage();
  const uptime = process.uptime();
  
  return {
    memory: {
      rss: memUsage.rss,
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      usage_percent: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100)
    },
    uptime: {
      seconds: uptime,
      human: `${Math.floor(uptime / 86400)}d ${Math.floor((uptime % 86400) / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`
    },
    process: {
      pid: process.pid,
      version: process.version,
      platform: process.platform,
      arch: process.arch
    },
    timestamp: new Date().toISOString()
  };
};

// Performance metrics collection
class PerformanceCollector {
  private metrics: Map<string, number[]> = new Map();
  
  recordMetric(name: string, value: number) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    
    const values = this.metrics.get(name)!;
    values.push(value);
    
    // Keep only last 100 values
    if (values.length > 100) {
      values.shift();
    }
  }
  
  getMetrics(name: string) {
    const values = this.metrics.get(name) || [];
    if (values.length === 0) return null;
    
    const sorted = [...values].sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);
    
    return {
      count: values.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      mean: sum / values.length,
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)]
    };
  }
  
  getAllMetrics() {
    const result: Record<string, any> = {};
    for (const [name] of this.metrics) {
      result[name] = this.getMetrics(name);
    }
    return result;
  }
}

export const performanceCollector = new PerformanceCollector();