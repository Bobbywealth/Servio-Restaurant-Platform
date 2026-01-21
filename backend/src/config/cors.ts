import { CorsOptions } from 'cors';
import { logger } from '../utils/logger';

/**
 * Production-ready CORS configuration
 */

// Parse environment variables for allowed origins
const parseOrigins = (envValue?: string): string[] => {
  if (!envValue) return [];
  return envValue
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
};

// Development localhost origins
const LOCALHOST_ORIGINS = new Set([
  'http://localhost:3000',
  'http://localhost:3005',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3005',
  'http://127.0.0.1:3001',
]);

// Production origins from environment
const envCorsOrigins = [
  ...parseOrigins(process.env.CORS_ORIGINS),
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
].filter(Boolean);

// Static allowed origins
const STATIC_ORIGINS = [
  ...new Set([
    ...envCorsOrigins,
    ...Array.from(LOCALHOST_ORIGINS),
    'https://serviorestaurantplatform.netlify.app',
    'https://servio-app.onrender.com',
  ]),
];

// Log allowed origins on startup
logger.info('CORS Configuration', {
  environment: process.env.NODE_ENV,
  allowedOrigins: STATIC_ORIGINS,
  dynamicLocalhostEnabled: process.env.NODE_ENV !== 'production'
});

/**
 * CORS origin validator
 */
const corsOriginValidator: CorsOptions['origin'] = (origin, callback) => {
  // Allow requests with no origin (e.g., mobile apps, curl, Postman)
  if (!origin) {
    return callback(null, true);
  }

  // Always allow configured static origins
  if (STATIC_ORIGINS.includes(origin)) {
    return callback(null, true);
  }

  // In development, allow any localhost port
  if (
    process.env.NODE_ENV !== 'production' &&
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)
  ) {
    return callback(null, true);
  }

  // In production, block unknown origins
  if (process.env.NODE_ENV === 'production') {
    logger.warn('CORS blocked origin', {
      origin,
      allowedOrigins: STATIC_ORIGINS
    });
    return callback(new Error(`CORS blocked origin: ${origin}`));
  }

  // In development, allow but log warning
  logger.warn('CORS allowing unregistered origin (development only)', { origin });
  return callback(null, true);
};

/**
 * Main CORS configuration
 */
export const corsOptions: CorsOptions = {
  origin: corsOriginValidator,
  credentials: true, // Allow cookies and authorization headers
  optionsSuccessStatus: 200,
  preflightContinue: false,
  maxAge: 86400, // 24 hours preflight cache
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'X-CSRF-Token',
    'X-Request-ID',
    'X-API-Key'
  ],
  exposedHeaders: [
    'X-Request-ID',
    'X-Response-Time',
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset'
  ]
};

/**
 * Socket.IO CORS configuration
 */
export const socketCorsOptions = {
  origin: corsOriginValidator,
  methods: ['GET', 'POST'],
  credentials: true,
  allowedHeaders: ['Authorization', 'X-Request-ID']
};

/**
 * Webhook CORS configuration (more permissive for external services)
 */
export const webhookCorsOptions: CorsOptions = {
  origin: (origin, callback) => {
    // Allow all origins for webhooks
    // Authentication is handled via webhook signatures/tokens
    callback(null, true);
  },
  credentials: false,
  methods: ['POST', 'OPTIONS']
};

/**
 * Add origin to whitelist dynamically (use with caution)
 */
export const addAllowedOrigin = (origin: string): void => {
  if (!STATIC_ORIGINS.includes(origin)) {
    STATIC_ORIGINS.push(origin);
    logger.info('Added new allowed origin', { origin });
  }
};

/**
 * Check if origin is allowed
 */
export const isOriginAllowed = (origin: string): boolean => {
  return STATIC_ORIGINS.includes(origin) ||
    (process.env.NODE_ENV !== 'production' && 
     /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin));
};

export default corsOptions;
