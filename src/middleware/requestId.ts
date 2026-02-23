import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

declare global {
  namespace Express {
    interface Request {
      id: string;
      startTime?: number;
    }
  }
}

/**
 * Request ID middleware - adds a unique identifier to each request
 * for distributed tracing and debugging
 */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  // Use existing request ID from header or generate new one
  const requestId = req.headers['x-request-id'] as string || uuidv4();
  
  req.id = requestId;
  req.startTime = Date.now();
  
  // Add request ID to response headers
  res.setHeader('X-Request-ID', requestId);
  
  // Log request start
  logger.info(`[REQUEST] ${req.method} ${req.path}`, {
    requestId,
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip,
    userAgent: req.headers['user-agent']
  });
  
  // Log response when finished
  const originalSend = res.send;
  res.send = function(body?: any): Response {
    const duration = req.startTime ? Date.now() - req.startTime : 0;
    
    logger.info(`[RESPONSE] ${req.method} ${req.path}`, {
      requestId,
      statusCode: res.statusCode,
      duration: `${duration}ms`
    });
    
    // Add timing header
    res.setHeader('X-Response-Time', `${duration}ms`);
    
    return originalSend.call(this, body);
  };
  
  next();
}

/**
 * Add timing middleware to track request duration
 */
export function timing(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.debug(`Timing: ${req.method} ${req.path} - ${duration}ms`);
  });
  
  next();
}
