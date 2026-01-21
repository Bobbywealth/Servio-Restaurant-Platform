import winston from 'winston';
import path from 'path';
import fs from 'fs';

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Production vs Development configuration
const isProduction = process.env.NODE_ENV === 'production';
const logLevel = process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug');

// Custom format for structured logging
const structuredFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp'] })
);

// Console format with colors for development
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} [${level}]: ${stack || message}${metaStr}`;
  })
);

// Configure transports based on environment
const transports: winston.transport[] = [];

if (isProduction) {
  // Production: File-based logging with rotation
  transports.push(
    // Error log - only errors and above
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      format: structuredFormat,
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      tailable: true
    }),
    
    // Combined log - all levels
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      format: structuredFormat,
      maxsize: 50 * 1024 * 1024, // 50MB
      maxFiles: 10,
      tailable: true
    }),

    // Console for production (structured JSON)
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      )
    })
  );
} else {
  // Development: Console with colors and file backup
  transports.push(
    new winston.transports.Console({
      format: consoleFormat
    }),
    
    // Development file log for debugging
    new winston.transports.File({
      filename: path.join(logsDir, 'development.log'),
      format: structuredFormat,
      maxsize: 10 * 1024 * 1024,
      maxFiles: 2
    })
  );
}

const logger = winston.createLogger({
  level: logLevel,
  transports,
  
  // Exit on error in development
  exitOnError: !isProduction,
  
  // Silent in test environment
  silent: process.env.NODE_ENV === 'test',
  
  // Default metadata
  defaultMeta: {
    service: 'servio-backend',
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    hostname: require('os').hostname(),
    pid: process.pid
  }
});

// Enhanced logging utilities for production
class EnhancedLogger {
  private winston: winston.Logger;

  constructor(winstonInstance: winston.Logger) {
    this.winston = winstonInstance;
  }

  // Standard logging methods
  error(message: string, meta?: any): void {
    this.winston.error(message, meta);
  }

  warn(message: string, meta?: any): void {
    this.winston.warn(message, meta);
  }

  info(message: string, meta?: any): void {
    this.winston.info(message, meta);
  }

  debug(message: string, meta?: any): void {
    this.winston.debug(message, meta);
  }

  // Performance logging
  timing(label: string, startTime: number, meta?: any): void {
    const duration = Date.now() - startTime;
    this.winston.info(`Performance: ${label}`, {
      ...meta,
      duration_ms: duration,
      performance: true
    });
  }

  // HTTP Request logging
  request(req: any, res: any, responseTime?: number, meta?: any): void {
    this.winston.info('HTTP Request', {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      response_time_ms: responseTime,
      user_agent: req.get('User-Agent'),
      ip: req.ip || req.connection.remoteAddress,
      ...meta
    });
  }

  // Database query logging
  database(query: string, duration: number, error?: Error, meta?: any): void {
    if (error) {
      this.winston.error('Database Error', {
        query: query.substring(0, 200), // Limit query length
        duration_ms: duration,
        error: error.message,
        stack: error.stack,
        ...meta
      });
    } else {
      this.winston.debug('Database Query', {
        query: query.substring(0, 200),
        duration_ms: duration,
        ...meta
      });
    }
  }

  // API call logging (external services)
  apiCall(service: string, method: string, url: string, status: number, duration: number, meta?: any): void {
    const level = status >= 400 ? 'error' : status >= 300 ? 'warn' : 'info';
    this.winston.log(level, `API Call: ${service}`, {
      service,
      method,
      url: url.replace(/\/[^\/]*$/, '/*'), // Mask IDs in URLs
      status,
      duration_ms: duration,
      ...meta
    });
  }

  // Security events
  security(event: string, details: any, severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'): void {
    this.winston.warn(`Security Event: ${event}`, {
      security_event: event,
      severity,
      timestamp: new Date().toISOString(),
      ...details
    });
  }

  // Business logic events
  business(event: string, details: any): void {
    this.winston.info(`Business Event: ${event}`, {
      business_event: event,
      timestamp: new Date().toISOString(),
      ...details
    });
  }

  // Error with context
  errorWithContext(error: Error, context: string, meta?: any): void {
    this.winston.error(`Error in ${context}`, {
      error_message: error.message,
      error_stack: error.stack,
      error_name: error.name,
      context,
      timestamp: new Date().toISOString(),
      ...meta
    });
  }
}

// Create enhanced logger instance
const enhancedLogger = new EnhancedLogger(logger);

// Unhandled error logging
process.on('uncaughtException', (error) => {
  enhancedLogger.errorWithContext(error, 'uncaughtException', {
    fatal: true
  });
  if (isProduction) {
    process.exit(1);
  }
});

process.on('unhandledRejection', (reason, promise) => {
  enhancedLogger.error('Unhandled Rejection', {
    reason: reason instanceof Error ? reason.message : reason,
    stack: reason instanceof Error ? reason.stack : undefined,
    promise_info: promise.toString(),
    fatal: false
  });
});

// Export both the winston instance and enhanced logger
export { logger, enhancedLogger };
export type { EnhancedLogger };