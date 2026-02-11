/**
 * Client-Side Instrumentation Layer
 * Provides requestId generation, error tracking, and structured logging
 */

import axios, { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios'

/**
 * Request Context - holds requestId and other request-specific data
 */
export interface RequestContext {
  requestId: string
  startTime: number
  url: string
  method: string
  userId?: string
}

/**
 * Get or generate a unique request ID
 */
let currentRequestId: string | null = null

export function getRequestId(): string {
  if (currentRequestId) {
    return currentRequestId
  }

  // Try to get from localStorage
  const stored = localStorage.getItem('requestId')
  if (stored) {
    currentRequestId = stored
    return currentRequestId
  }

  // Generate new requestId
  currentRequestId = generateUUID()
  localStorage.setItem('requestId', currentRequestId)

  return currentRequestId
}

/**
 * Generate a UUID v4
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

/**
 * Create a new request context
 */
export function createRequestContext(config: AxiosRequestConfig): RequestContext {
  return {
    requestId: getRequestId(),
    startTime: Date.now(),
    url: config.url || '',
    method: config.method?.toUpperCase() || 'GET',
    userId: getStoredUserId()
  }
}

/**
 * Get stored user ID from localStorage
 */
function getStoredUserId(): string | undefined {
  try {
    const user = localStorage.getItem('user')
    if (user) {
      const userData = JSON.parse(user)
      return userData.id
    }
  } catch (error) {
    console.warn('Failed to get stored user ID:', error)
  }
  return undefined
}

/**
 * Log an error with full context
 */
export function logError(
  context: RequestContext,
  error: any,
  additionalInfo?: Record<string, any>
) {
  const errorData = {
    level: 'error',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development',
    requestId: context.requestId,
    url: context.url,
    method: context.method,
    userId: context.userId,
    error: {
      message: error.message || 'Unknown error',
      stack: error.stack,
      name: error.name,
      code: error.code
    },
    durationMs: Date.now() - context.startTime,
    ...additionalInfo
  }

  // Log to console with structured format
  console.error(JSON.stringify(errorData))

  // Send to error tracking service (Sentry, etc.)
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
) {
  const infoData = {
    level: 'info',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development',
    requestId: context.requestId,
    url: context.url,
    method: context.method,
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
) {
  const warningData = {
    level: 'warn',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development',
    requestId: context.requestId,
    url: context.url,
    method: context.method,
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
) {
  // Only log debug in development
  if (process.env.NODE_ENV === 'development') {
    const debugData = {
      level: 'debug',
      timestamp: new Date().toISOString(),
      env: process.env.NODE_ENV || 'development',
      requestId: context.requestId,
      url: context.url,
      method: context.method,
      userId: context.userId,
      message,
      durationMs: Date.now() - context.startTime,
      ...additionalInfo
    }

    console.debug(JSON.stringify(debugData))
  }

  return null
}

/**
 * Axios interceptor for request logging
 */
export function setupAxiosInterceptors(axiosInstance: typeof axios) {
  // Request interceptor
  axiosInstance.interceptors.request.use(
    (config) => {
      const context = createRequestContext(config)

      // Attach requestId to request headers
      config.headers['X-Request-ID'] = context.requestId

      // Log request
      logDebug(context, 'API Request', {
        url: config.url,
        method: config.method,
        params: config.params,
        dataKeys: Object.keys(config.data || {})
      })

      return config
    },
    (error) => {
      return Promise.reject(error)
    }
  )

  // Response interceptor
  axiosInstance.interceptors.response.use(
    (response: AxiosResponse) => {
      const config = response.config as AxiosRequestConfig
      const context = createRequestContext(config)

      // Log response
      logInfo(context, 'API Response', {
        url: config.url,
        method: config.method,
        statusCode: response.status,
        durationMs: Date.now() - context.startTime
      })

      return response
    },
    (error: AxiosError) => {
      const config = error.config as AxiosRequestConfig
      const context = config ? createRequestContext(config) : {
        requestId: getRequestId(),
        startTime: Date.now(),
        url: error.config?.url || '',
        method: error.config?.method?.toUpperCase() || 'GET',
        userId: getStoredUserId()
      }

      // Log error
      logError(context, error, {
        url: config?.url,
        method: config?.method,
        statusCode: error.response?.status,
        statusText: error.response?.statusText,
        response: error.response?.data
      })

      return Promise.reject(error)
    }
  )
}

/**
 * Send error to error tracking service (placeholder)
 * In production, this would integrate with Sentry, Rollbar, etc.
 */
function sendToErrorTracking(errorData: any) {
  // TODO: Integrate with Sentry, Rollbar, or similar service
  // Example:
  // Sentry.captureException(new Error(errorData.error.message), {
  //   extra: {
  //     requestId: errorData.requestId,
  //     userId: errorData.userId,
  //     url: errorData.url,
  //     durationMs: errorData.durationMs
  //   }
  // })

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
  const entry = {
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
) {
  const entry = {
    level: statusCode >= 400 ? 'warn' : 'info',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development',
    requestId: context.requestId,
    url: context.url,
    method: context.method,
    userId: context.userId,
    statusCode,
    durationMs: Date.now() - context.startTime,
    data: error ? undefined : data,
    error: error || undefined
  }
  return JSON.stringify(entry)
}

/**
 * Clear the current requestId (useful for testing)
 */
export function clearRequestId() {
  currentRequestId = null
  localStorage.removeItem('requestId')
}
