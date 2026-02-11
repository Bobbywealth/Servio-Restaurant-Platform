/**
 * Custom Error Classes
 * Standardized error types for the application
 */

/**
 * Base application error
 */
export class AppError extends Error {
  public statusCode: number
  public code: string
  public isOperational: boolean
  public requestId?: string

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    isOperational: boolean = true
  ) {
    super(message)
    this.name = this.constructor.name
    this.statusCode = statusCode
    this.code = code
    this.isOperational = isOperational

    Error.captureStackTrace(this, this.constructor)
  }
}

/**
 * Validation Error
 */
export class ValidationError extends AppError {
  public errors: Record<string, string[]>

  constructor(
    message: string = 'Validation failed',
    errors?: Record<string, string[]>,
    requestId?: string
  ) {
    super(message, 400, 'VALIDATION_ERROR', true)
    this.errors = errors || {}
    this.requestId = requestId
  }
}

/**
 * Authentication Error
 */
export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required', requestId?: string) {
    super(message, 401, 'AUTH_REQUIRED', true)
    this.requestId = requestId
  }
}

/**
 * Authorization Error
 */
export class AuthorizationError extends AppError {
  constructor(message: string = 'Access denied', requestId?: string) {
    super(message, 403, 'AUTHORIZATION_ERROR', true)
    this.requestId = requestId
  }
}

/**
 * Not Found Error
 */
export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource', requestId?: string) {
    super(`${resource} not found`, 404, 'NOT_FOUND', true)
    this.requestId = requestId
  }
}

/**
 * Conflict Error
 */
export class ConflictError extends AppError {
  constructor(message: string = 'Resource already exists', requestId?: string) {
    super(message, 409, 'CONFLICT', true)
    this.requestId = requestId
  }
}

/**
 * Rate Limit Error
 */
export class RateLimitError extends AppError {
  constructor(message: string = 'Too many requests', requestId?: string) {
    super(message, 429, 'RATE_LIMIT_EXCEEDED', true)
    this.requestId = requestId
  }
}

/**
 * Internal Server Error
 */
export class InternalServerError extends AppError {
  constructor(message: string = 'Internal server error', requestId?: string) {
    super(message, 500, 'INTERNAL_ERROR', false)
    this.requestId = requestId
  }
}

/**
 * Integration Error
 */
export class IntegrationError extends AppError {
  constructor(
    service: string,
    message: string = 'Integration failed',
    requestId?: string
  ) {
    super(message, 502, `INTEGRATION_ERROR_${service.toUpperCase()}`, true)
    this.requestId = requestId
  }
}

/**
 * Database Error
 */
export class DatabaseError extends AppError {
  constructor(
    message: string = 'Database operation failed',
    requestId?: string
  ) {
    super(message, 500, 'DATABASE_ERROR', true)
    this.requestId = requestId
  }
}

/**
 * API Error
 */
export class APIError extends AppError {
  constructor(
    service: string,
    message: string,
    statusCode: number = 500,
    requestId?: string
  ) {
    super(message, statusCode, `API_ERROR_${service.toUpperCase()}`, true)
    this.requestId = requestId
  }
}

/**
 * Create standardized error response
 */
export function createErrorResponse(
  error: AppError | Error,
  requestId?: string
): {
  success: false
  error: {
    message: string
    code: string
    statusCode: number
    requestId?: string
  }
} {
  const appError = error instanceof AppError ? error : new InternalServerError(error.message)

  return {
    success: false,
    error: {
      message: appError.message,
      code: appError.code,
      statusCode: appError.statusCode,
      requestId: requestId || appError.requestId
    }
  }
}

/**
 * Format error for logging
 */
export function formatErrorForLogging(
  error: AppError | Error,
  requestId?: string
): Record<string, any> {
  const appError = error instanceof AppError ? error : new InternalServerError(error.message)

  return {
    error: {
      name: appError.name,
      message: appError.message,
      code: appError.code,
      statusCode: appError.statusCode,
      stack: appError.stack
    },
    requestId: requestId || appError.requestId,
    timestamp: new Date().toISOString()
  }
}
