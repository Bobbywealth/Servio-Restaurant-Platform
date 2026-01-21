import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import { Express } from 'express';
import { logger } from '../utils/logger';

/**
 * Sentry APM (Application Performance Monitoring) Configuration
 */

const SENTRY_DSN = process.env.SENTRY_DSN;
const SENTRY_ENVIRONMENT = process.env.NODE_ENV || 'development';
const SENTRY_RELEASE = process.env.SENTRY_RELEASE || `servio-backend@${process.env.npm_package_version || '1.0.0'}`;

// Only initialize Sentry if DSN is provided
const SENTRY_ENABLED = Boolean(SENTRY_DSN);

/**
 * Initialize Sentry APM
 */
export const initializeSentry = (_app: Express): void => {
  if (!SENTRY_ENABLED) {
    logger.warn('Sentry DSN not configured - APM disabled');
    return;
  }

  try {
    Sentry.init({
      dsn: SENTRY_DSN,
      environment: SENTRY_ENVIRONMENT,
      release: SENTRY_RELEASE,
      
      // Integrations
      integrations: [
        // Enable HTTP calls tracing
        Sentry.httpIntegration(),

        // Enable Express.js middleware tracing
        Sentry.expressIntegration(),

        // Enable profiling (Sentry v10+)
        nodeProfilingIntegration(),
      ],

      // Performance Monitoring
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0, // 10% in prod, 100% in dev
      
      // Profiling
      profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

      // Error filtering
      beforeSend(event: any, hint: any) {
        // Filter out certain errors
        const error = hint.originalException as Error;
        
        // Don't send validation errors
        if (error?.message?.includes('Validation')) {
          return null;
        }
        
        // Don't send 404 errors
        if (event.message?.includes('404') || event.message?.includes('Not Found')) {
          return null;
        }

        // Add custom context
        if (event.request) {
          // Remove sensitive data
          if (event.request.headers) {
            delete event.request.headers.authorization;
            delete event.request.headers.cookie;
          }
        }

        return event;
      },

      // Breadcrumbs filtering
      beforeBreadcrumb(breadcrumb: any, _hint: any) {
        // Don't log query strings with sensitive data
        if (breadcrumb.category === 'http' && breadcrumb.data?.url) {
          breadcrumb.data.url = breadcrumb.data.url.split('?')[0];
        }
        return breadcrumb;
      },

      // Max breadcrumbs
      maxBreadcrumbs: 50,

      // Attach stack traces
      attachStacktrace: true,

      // Sample rate for error events
      sampleRate: 1.0,

      // Ignore certain errors
      ignoreErrors: [
        'ECONNREFUSED',
        'ECONNRESET',
        'EPIPE',
        'ETIMEDOUT',
        'NetworkError',
        'Not Found',
        'Validation',
        'RateLimitExceeded'
      ]
    });

    logger.info('Sentry APM initialized', {
      environment: SENTRY_ENVIRONMENT,
      release: SENTRY_RELEASE,
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0
    });
  } catch (error) {
    logger.error('Failed to initialize Sentry', error);
  }
};

/**
 * Request handler - must be the first middleware
 */
export const sentryRequestHandler = () => {
  if (!SENTRY_ENABLED) {
    return (_req: any, _res: any, next: any) => next();
  }
  // Sentry v10+ no longer exposes Sentry.Handlers; request context is handled via integrations.
  return (_req: any, _res: any, next: any) => next();
};

/**
 * Tracing handler - for performance monitoring
 */
export const sentryTracingHandler = () => {
  if (!SENTRY_ENABLED) {
    return (_req: any, _res: any, next: any) => next();
  }
  // Sentry v10+ traces are handled via integrations. Keep as no-op middleware.
  return (_req: any, _res: any, next: any) => next();
};

/**
 * Error handler - must be after all controllers and before other error handlers
 */
export const sentryErrorHandler = () => {
  if (!SENTRY_ENABLED) {
    return (_err: any, _req: any, _res: any, next: any) => next();
  }
  // Sentry v10+ Express error handler
  return Sentry.expressErrorHandler();
};

/**
 * Capture custom exception
 */
export const captureException = (error: Error, context?: Record<string, any>): void => {
  if (!SENTRY_ENABLED) {
    logger.error('Exception captured (Sentry disabled)', { error, context });
    return;
  }

  Sentry.withScope((scope: any) => {
    if (context) {
      Object.keys(context).forEach((key) => {
        scope.setContext(key, context[key]);
      });
    }
    Sentry.captureException(error);
  });
};

/**
 * Capture custom message
 */
export const captureMessage = (message: string, level: Sentry.SeverityLevel = 'info', context?: Record<string, any>): void => {
  if (!SENTRY_ENABLED) {
    logger.info('Message captured (Sentry disabled)', { message, level, context });
    return;
  }

  Sentry.withScope((scope: any) => {
    scope.setLevel(level);
    if (context) {
      Object.keys(context).forEach((key) => {
        scope.setContext(key, context[key]);
      });
    }
    Sentry.captureMessage(message);
  });
};

/**
 * Start a transaction (for custom performance monitoring)
 */
export const startTransaction = (name: string, op: string, data?: Record<string, any>) => {
  if (!SENTRY_ENABLED) {
    return null;
  }

  // Sentry v10+ uses spans instead of transactions
  return Sentry.startInactiveSpan({
    name,
    op,
    attributes: data ?? {}
  });
};

/**
 * Set user context
 */
export const setUser = (user: { id: string; email?: string; role?: string } | null): void => {
  if (!SENTRY_ENABLED) return;
  Sentry.setUser(user);
};

/**
 * Add breadcrumb
 */
export const addBreadcrumb = (message: string, category: string, data?: Record<string, any>): void => {
  if (!SENTRY_ENABLED) return;
  
  Sentry.addBreadcrumb({
    message,
    category,
    level: 'info',
    data
  });
};

/**
 * Flush Sentry events (useful before shutdown)
 */
export const flushSentry = async (timeout: number = 2000): Promise<boolean> => {
  if (!SENTRY_ENABLED) return true;
  
  try {
    return await Sentry.close(timeout);
  } catch (error) {
    logger.error('Failed to flush Sentry events', error);
    return false;
  }
};

export default {
  initializeSentry,
  sentryRequestHandler,
  sentryTracingHandler,
  sentryErrorHandler,
  captureException,
  captureMessage,
  startTransaction,
  setUser,
  addBreadcrumb,
  flushSentry,
  SENTRY_ENABLED
};
