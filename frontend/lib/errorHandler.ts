import { AxiosError } from 'axios'

export interface ApiError {
  message: string
  details?: string
  statusCode?: number
  context?: string
}

/**
 * Extracts a user-friendly error message from various error types
 */
export function extractErrorMessage(error: unknown, context?: string): ApiError {
  // Handle Axios errors
  if (error && typeof error === 'object' && 'isAxiosError' in error) {
    const axiosError = error as AxiosError<any>

    const backendMessage = axiosError.response?.data?.error?.message
    const backendType = axiosError.response?.data?.error?.type
    const statusCode = axiosError.response?.status

    // Build user-friendly message
    let message = backendMessage || 'An error occurred'

    // Add context if provided
    if (context) {
      message = `${context}: ${message}`
    }

    // Provide helpful guidance based on status code
    if (statusCode === 401) {
      message = 'Authentication failed. Please log in again.'
    } else if (statusCode === 403) {
      message = backendMessage || 'You do not have permission to perform this action.'
    } else if (statusCode === 404) {
      message = backendMessage || 'The requested resource was not found.'
    } else if (statusCode === 422) {
      message = backendMessage || 'Invalid data provided. Please check your input.'
    } else if (statusCode === 429) {
      message = 'Too many requests. Please wait a moment and try again.'
    } else if (statusCode && statusCode >= 500) {
      message = backendMessage || 'Server error occurred. Please try again later.'
    }

    return {
      message,
      details: backendType ? `${backendType}: ${backendMessage}` : undefined,
      statusCode,
      context
    }
  }

  // Handle standard Error objects
  if (error instanceof Error) {
    return {
      message: context ? `${context}: ${error.message}` : error.message,
      details: error.stack,
      context
    }
  }

  // Handle string errors
  if (typeof error === 'string') {
    return {
      message: context ? `${context}: ${error}` : error,
      context
    }
  }

  // Fallback for unknown error types
  return {
    message: context ? `${context}: An unexpected error occurred` : 'An unexpected error occurred',
    details: JSON.stringify(error, null, 2),
    context
  }
}

/**
 * Common error messages with context
 */
export const ErrorContexts = {
  ORDER_CREATE: 'Failed to create order',
  ORDER_UPDATE: 'Failed to update order',
  ORDER_DELETE: 'Failed to delete order',
  ORDER_FETCH: 'Failed to load orders',

  MENU_CREATE: 'Failed to create menu item',
  MENU_UPDATE: 'Failed to update menu item',
  MENU_DELETE: 'Failed to delete menu item',
  MENU_FETCH: 'Failed to load menu',

  CATEGORY_CREATE: 'Failed to create category',
  CATEGORY_UPDATE: 'Failed to update category',
  CATEGORY_DELETE: 'Failed to delete category',

  INVENTORY_UPDATE: 'Failed to update inventory',
  INVENTORY_FETCH: 'Failed to load inventory',

  TASK_CREATE: 'Failed to create task',
  TASK_UPDATE: 'Failed to update task',
  TASK_DELETE: 'Failed to delete task',
  TASK_FETCH: 'Failed to load tasks',

  SMS_SEND: 'Failed to send SMS',
  SMS_CONFIG: 'SMS configuration error',

  SETTINGS_UPDATE: 'Failed to update settings',
  SETTINGS_FETCH: 'Failed to load settings',

  INTEGRATION_CONNECT: 'Failed to connect integration',
  INTEGRATION_TEST: 'Integration test failed',

  UPLOAD_FILE: 'Failed to upload file',
  PROCESS_RECEIPT: 'Failed to process receipt',

  VOICE_INIT: 'Failed to initialize voice',
  VOICE_SPEAK: 'Failed to speak',
  VOICE_LISTEN: 'Failed to listen'
}

/**
 * Retry utility for failed operations
 */
export async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: unknown

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error

      // Don't retry on client errors (4xx) except for specific cases
      if (error && typeof error === 'object' && 'isAxiosError' in error) {
        const axiosError = error as AxiosError
        const status = axiosError.response?.status
        if (status && status >= 400 && status < 500 && status !== 408 && status !== 429) {
          throw error
        }
      }

      // Wait before retrying (exponential backoff)
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs * Math.pow(2, attempt)))
      }
    }
  }

  throw lastError
}
