/**
 * Instrumentation Layer for Request Correlation
 * Provides requestId generation, propagation, and structured logging
 */

import { Request, Response, NextFunction } from 'express'
import { v4 as uuidv4 } from 'uuid'

/**
 * Extended Express Request with custom properties
 */
interface ExtendedRequest extends Request {
  requestId?: string
  context?: RequestContext
}

/**
 * Request Context - holds requestId and other request-specific data
 */
export interface RequestContext {
  requestId: string
  startTime: number
  method: string
  path: string
  userId?: string
  userAgent?: string
}

/**
 * Get or generate a unique request ID
 */
export function getRequestId(req: Request): string {
  // Check if requestId already exists in headers
  const headerId = req.headers['x-request-id']
  if (headerId && typeof headerId === 'string') {
    return headerId
  }

  // Generate new requestId
  return uuidv4()
}

/**
 * Create a new request context
 */
export function createRequestContext(req: Request): RequestContext {
  return {
    requestId: getRequestId(req),
    startTime: Date.now(),
    method: req.method,
    path: req.path,
    userId: (req as any).user?.id as string | undefined,
    userAgent: req.headers['user-agent'] as string | undefined
  }
}

/**
 * Log an error with full context
 */
export function logError(
  context: RequestContext,
  error: any,
  additionalInfo?: Record<string, any>
): Record<string, any> {
  const errorData: Record<string, any> = {
    level: 'error',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development',
    requestId: context.requestId,
    method: context.method,
    path: context.path,
    userId: context.userId,
    userAgent: context.userAgent,
    error: {
      message: error.message || 'Unknown error',
      stack: error.stack,
      name: error.name
    },
    durationMs: Date.now() - context.startTime,
    ...additionalInfo
  }

  // If error has status code, include it
  if (error.response?.status) {
    errorData.statusCode = error.response.status
  }

  // Log to console with structured format
  console.error(JSON.stringify(errorData))

  // In production, send to error tracking service (Sentry, etc.)
  if (process.env.NODE_ENV === 'production') {
    sendToErrorTracking(errorData)
  }

  return errorData
}

/**
 * Log an info message with context
 */
export function logInfo(
  context: RequestContext,
  message: string,
  additionalInfo?: Record<string, any>
): Record<string, any> {
  const infoData: Record<string, any> = {
    level: 'info',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development',
    requestId: context.requestId,
    method: context.method,
    path: context.path,
    userId: context.userId,
    message,
    durationMs: Date.now() - context.startTime,
    ...additionalInfo
  }

  console.log(JSON.stringify(infoData))
  return infoData
}

/**
 * Log a warning message with context
 */
export function logWarning(
  context: RequestContext,
  message: string,
  additionalInfo?: Record<string, any>
): Record<string, any> {
  const warningData: Record<string, any> = {
    level: 'warn',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development',
    requestId: context.requestId,
    method: context.method,
    path: context.path,
    userId: context.userId,
    message,
    durationMs: Date.now() - context.startTime,
    ...additionalInfo
  }

  console.warn(JSON.stringify(warningData))
  return warningData
}

/**
 * Log a debug message with context
 */
export function logDebug(
  context: RequestContext,
  message: string,
  additionalInfo?: Record<string, any>
): void {
  // Only log debug in development
  if (process.env.NODE_ENV === 'development') {
    const debugData: Record<string, any> = {
      level: 'debug',
      timestamp: new Date().toISOString(),
      env: process.env.NODE_ENV || 'development',
      requestId: context.requestId,
      method: context.method,
      path: context.path,
      userId: context.userId,
      message,
      durationMs: Date.now() - context.startTime,
      ...additionalInfo
    }

    console.debug(JSON.stringify(debugData))
  }
}

/**
 * Middleware to add requestId to all requests
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId = getRequestId(req)

  // Add requestId to response headers
  res.setHeader('X-Request-ID', requestId)

  // Attach requestId to request object for use in handlers
  ;(req as ExtendedRequest).requestId = requestId

  // Create request context
  const context = createRequestContext(req)

  // Attach context to request
  ;(req as ExtendedRequest).context = context

  // Log incoming request
  logDebug(context, 'Incoming request', {
    query: req.query,
    bodyKeys: Object.keys(req.body)
  })

  // Log response
  res.on('finish', () => {
    logInfo(context, 'Request completed', {
      statusCode: res.statusCode,
      durationMs: Date.now() - context.startTime
    })
  })

  next()
}

/**
 * Middleware to log errors
 */
export function errorLoggingMiddleware(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const extReq = req as ExtendedRequest
  const context = extReq.context || createRequestContext(req)

  // Log the error
  logError(context, err, {
    statusCode: err.status || err.statusCode || 500,
    body: req.body,
    query: req.query
  })

  // Send to error tracking
  if (process.env.NODE_ENV === 'production') {
    sendToErrorTracking({
      ...context,
      error: {
        message: err.message,
        stack: err.stack,
        name: err.name
      },
      statusCode: err.status || err.statusCode || 500
    })
  }

  next(err)
}

/**
 * Send error to error tracking service (placeholder)
 * In production, this would integrate with Sentry, Rollbar, etc.
 */
function sendToErrorTracking(errorData: Record<string, any>): void {
  // TODO: Integrate with Sentry, Rollbar, or similar service
  // For now, just log to console
  console.error('[ERROR TRACKING] Would send to service:', errorData.requestId)
}

/**
 * Format log entry for structured logging
 */
export function formatLogEntry(
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal',
  message: string,
  data?: Record<string, any>
): string {
  const entry: Record<string, any> = {
    level,
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development',
    message,
    ...data
  }
  return JSON.stringify(entry)
}

/**
 * Get log entry for API response
 */
export function formatApiResponse(
  context: RequestContext,
  statusCode: number,
  data?: any,
  error?: string
): string {
  const entry: Record<string, any> = {
    level: statusCode >= 400 ? 'warn' : 'info',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development',
    requestId: context.requestId,
    method: context.method,
    path: context.path,
    userId: context.userId,
    statusCode,
    durationMs: Date.now() - context.startTime,
    data: error ? undefined : data,
    error: error || undefined
  }
  return JSON.stringify(entry)
}

export default {
  getRequestId,
  createRequestContext,
  logError,
  logInfo,
  logWarning,
  logDebug,
  requestIdMiddleware,
  errorLoggingMiddleware,
  formatLogEntry,
  formatApiResponse
}
