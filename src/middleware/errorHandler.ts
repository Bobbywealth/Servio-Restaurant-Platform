import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

const FRONTEND_ORIGIN = 'https://servio.solutions';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
  code?: string;
}

export class ValidationError extends Error {
  statusCode = 400;
  isOperational = true;

  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends Error {
  statusCode = 404;
  isOperational = true;

  constructor(message: string = 'Resource not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends Error {
  statusCode = 401;
  isOperational = true;

  constructor(message: string = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class BadRequestError extends Error {
  statusCode = 400;
  isOperational = true;

  constructor(message: string = 'Bad Request') {
    super(message);
    this.name = 'BadRequestError';
  }
}

export class ForbiddenError extends Error {
  statusCode = 403;
  isOperational = true;

  constructor(message: string = 'Forbidden') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export class TooManyRequestsError extends Error {
  statusCode = 429;
  isOperational = true;
  retryAfter?: Date;

  constructor(message: string = 'Too many requests', retryAfter?: Date) {
    super(message);
    this.name = 'TooManyRequestsError';
    this.retryAfter = retryAfter;
  }
}

export class ConflictError extends Error {
  statusCode = 409;
  isOperational = true;

  constructor(message: string = 'Conflict') {
    super(message);
    this.name = 'ConflictError';
  }
}

export const errorHandler = (
  error: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  // Default error values
  let statusCode = error.statusCode || 500;
  let message = error.message || 'Internal Server Error';
  let isOperational = error.isOperational || false;

  // Handle specific error types
  if (error.name === 'ValidationError') {
    statusCode = 400;
    message = error.message;
  } else if (error.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid ID format';
  } else if (error.name === 'JsonWebTokenError' || (error.message && error.message.includes('secret or public key must be provided'))) {
    statusCode = 401;
    message = 'Invalid token';
  } else if (error.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  } else if (error.code === 'SQLITE_CONSTRAINT' || (error.message && error.message.includes('duplicate key'))) {
    statusCode = 400;
    message = 'Database constraint violation';
  } else if (error.message && error.message.includes('CORS policy')) {
    // Handle CORS errors - return 403 Forbidden instead of 500
    statusCode = 403;
    message = 'Cross-origin request blocked by CORS policy';
  }

  // Log error details
  const errorInfo = {
    message: error.message,
    stack: error.stack,
    statusCode,
    isOperational,
    path: req.path,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    body: req.body,
    query: req.query,
    params: req.params
  };

  if (statusCode >= 500) {
    logger.error('Server Error:', errorInfo);
  } else {
    logger.warn('Client Error:', errorInfo);
  }

  // Prepare error response
  const errorResponse: any = {
    success: false,
    error: {
      message,
      type: error.name,
      statusCode
    }
  };

  // Include stack trace in development
  if (process.env.NODE_ENV === 'development') {
    errorResponse.error.stack = error.stack;
    errorResponse.error.details = errorInfo;
  }

  // Add request ID if available
  if (req.headers['x-request-id']) {
    errorResponse.requestId = req.headers['x-request-id'];
  }

  // Add Retry-After header for rate limit errors
  if (error.name === 'TooManyRequestsError' && (error as any).retryAfter) {
    res.setHeader('Retry-After', Math.ceil(((error as any).retryAfter.getTime() - Date.now()) / 1000));
    errorResponse.error.retryAfter = (error as any).retryAfter.toISOString();
  }

  // Ensure CORS headers are present even on errors (so browsers don't mask real errors as CORS failures).
  try {
    const origin = req.headers.origin;
    const hasCorsHeader = Boolean(res.getHeader('Access-Control-Allow-Origin'));
    if (!hasCorsHeader && typeof origin === 'string' && origin.trim()) {
      const allowed = new Set<string>([
        process.env.FRONTEND_URL || 'http://localhost:3000',
        'https://serviorestaurantplatform.netlify.app',
        FRONTEND_ORIGIN
      ]);
      if (allowed.has(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Vary', 'Origin');
      }
    }
  } catch {
    // never let CORS header logic crash the handler
  }

  // Ensure JSON response
  res.setHeader('Content-Type', 'application/json');
  return res.status(statusCode).json(errorResponse);
};

// Async error wrapper
export const asyncHandler = (fn: Function) => (req: Request, res: Response, _next: NextFunction) => {
  Promise.resolve(fn(req, res, _next)).catch(_next);
};

// 404 handler
export const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
  const error = new NotFoundError(`Route ${req.method} ${req.originalUrl} not found`);
  next(error);
};
