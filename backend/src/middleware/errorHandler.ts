import { Request, Response, NextFunction } from 'express';
import { enhancedLogger } from '../utils/logger';

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

  // Enhanced error logging with context
  if (statusCode >= 500) {
    enhancedLogger.errorWithContext(error, `${req.method} ${req.path}`, {
      statusCode,
      isOperational,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: (req as any).user?.id,
      restaurantId: (req as any).user?.restaurantId,
      body: req.body,
      query: req.query,
      params: req.params,
      headers: req.headers
    });

    // Track error in monitoring service
    const MonitoringService = require('../services/MonitoringService');
    MonitoringService.getInstance?.()?.recordError(error.name, {
      statusCode,
      path: req.path,
      method: req.method
    });
  } else {
    enhancedLogger.warn(`Client Error: ${error.name}`, {
      message: error.message,
      statusCode,
      path: req.path,
      method: req.method,
      ip: req.ip,
      userId: (req as any).user?.id,
      query: req.query,
      params: req.params
    });
  }

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
  } else if (error.code === '23505' || (error.message && /duplicate key/i.test(error.message))) {
    statusCode = 400;
    message = 'Database unique constraint violation';
  } else if (error.code === '23503') {
    statusCode = 400;
    message = 'Database foreign key constraint violation';
  } else if (error.code === '23514') {
    statusCode = 400;
    message = 'Database check constraint violation';
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