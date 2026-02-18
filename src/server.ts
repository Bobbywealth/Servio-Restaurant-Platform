// Load environment variables first
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

// Services
import { DatabaseService } from './services/DatabaseService';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { requireAuth } from './middleware/auth';
import { initializeNotifications } from './notifications/initNotifications';
import { validateEnvironment, failFastIfInvalid, getCorsOrigins } from './utils/validateEnv';
import { UPLOADS_DIR, checkUploadsHealth } from './utils/uploads';
import { SocketService } from './services/SocketService';

const FRONTEND_ORIGIN = 'https://servio.solutions';

// ============================================================================
// ENVIRONMENT VALIDATION (fail fast in production)
// ============================================================================
if (process.env.NODE_ENV === 'production') {
  failFastIfInvalid();
} else {
  validateEnvironment(); // Just log warnings in development
}

const app = express();
const server = createServer(app);

// Health check endpoint - MUST be before any middleware that might fail
// This handles Render health checks and prevents 502s during startup
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get CORS origins from environment (FRONTEND_URL + ALLOWED_ORIGINS)
// In production, FRONTEND_URL should be set to your actual frontend URL
// In development, it defaults to localhost:3000
const corsOrigins = getCorsOrigins(FRONTEND_ORIGIN);
logger.info('========================================');
logger.info('       CORS CONFIGURATION');
logger.info('========================================');
logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
logger.info(`Allowed CORS Origins:`);
corsOrigins.forEach(origin => logger.info(`  ✓ ${origin}`));
logger.info('========================================');

// Warn if production is using default localhost
if (process.env.NODE_ENV === 'production' && corsOrigins.some(origin => origin.includes('localhost'))) {
  logger.warn('⚠️  WARNING: Production environment is allowing localhost origins!');
  logger.warn('⚠️  Set FRONTEND_URL environment variable to your production frontend URL');
}

const corsOriginSet = new Set(corsOrigins);
const io = new SocketIOServer(server, {
  cors: {
    origin: (origin, callback) => {
      // Missing origin is normal for websocket upgrades and health checks - allow it
      if (!origin) {
        return callback(null, true);
      }
      if (corsOriginSet.has(origin)) {
        return callback(null, true);
      }
      logger.warn('[socket.io] origin not allowed', { origin, allowed: corsOrigins });
      return callback(new Error('Socket.IO CORS blocked'));
    },
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['polling', 'websocket'],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000,
  // Handle bad upgrade requests gracefully (health checks hitting /socket.io)
  allowUpgrades: true,
  httpCompression: true
});

io.engine.on('connection_error', (err) => {
  logger.error('[socket.io] connection_error', {
    code: err.code,
    message: err.message,
    context: err.context
  });
});

const PORT = process.env.PORT || 3002;

// Initialize database first, then load routes
async function initializeServer() {
  try {
    await DatabaseService.initialize();
    logger.info('Database initialized successfully');

    initializeNotifications(io);

    // Now load routes after database is ready
    const { default: authRoutes } = await import('./routes/auth');
    const { default: assistantRoutes } = await import('./routes/assistant');
    const { default: ordersRoutes } = await import('./routes/orders');
    const { default: inventoryRoutes } = await import('./routes/inventory');
    const { default: menuRoutes } = await import('./routes/menu');
    const { default: tasksRoutes } = await import('./routes/tasks');
    const { default: syncRoutes } = await import('./routes/sync');
    const { default: modifiersRoutes } = await import('./routes/modifiers');
    const { default: receiptsRoutes } = await import('./routes/receipts');
    const { default: auditRoutes } = await import('./routes/audit');
    const { default: timeclockRoutes } = await import('./routes/timeclock');
    const { default: marketingRoutes } = await import('./routes/marketing');
    const { default: restaurantRoutes } = await import('./routes/restaurant');
    const { default: restaurantsRoutes } = await import('./routes/restaurants');
    const { default: integrationsRoutes } = await import('./routes/integrations');
    const { default: vapiRoutes } = await import('./routes/vapi');
    const { default: voiceRoutes } = await import('./routes/voice');
    const { default: voiceHubRoutes } = await import('./routes/voice-hub');
    const { default: notificationsRoutes } = await import('./routes/notifications');
    const { default: pushRoutes } = await import('./routes/push');
    const { default: deliveryPlatformsRoutes } = await import('./routes/delivery-platforms');
    const { default: deliveryPlatformsSessionsRoutes } = await import('./routes/delivery-platforms-sessions');
    const { default: staffClockRoutes } = await import('./routes/staff-clock');
    const { default: staffSchedulingRoutes } = await import('./routes/staff-scheduling');
    const { default: staffAnalyticsRoutes } = await import('./routes/staff-analytics');
    const { default: staffBulkRoutes } = await import('./routes/staff-bulk');
    const { default: adminRoutes } = await import('./routes/admin');
    const { default: voiceConversationsRoutes } = await import('./routes/voice-conversations');
    const { default: conversationsRoutes } = await import('./routes/conversations');
    const { default: companyRoutes } = await import('./routes/company');
    const { default: bookingsRoutes } = await import('./routes/bookings');
    const { default: publicRoutes } = await import('./routes/public');

    // API Routes
    app.use('/api/auth', authRoutes);
    app.use('/api/bookings', bookingsRoutes);
    app.use('/api/public', publicRoutes);

    // Vapi and Voice routes MUST be before the catch-all /api route (no auth)
    app.use('/api/vapi', vapiRoutes);
    app.use('/api/voice', voiceRoutes);
    app.use('/api/voice-hub', voiceHubRoutes);
    app.use('/api/voice-conversations', requireAuth, voiceConversationsRoutes);
    app.use('/api/conversations', requireAuth, conversationsRoutes);
    
    // Protected routes
    app.use('/api/assistant', requireAuth, assistantRoutes);
    // Orders routes: /public/* is public, others require auth
    app.use('/api/orders', (req, res, next) => {
      if (req.path.startsWith('/public')) return next();
      return requireAuth(req, res, next);
    }, ordersRoutes);

    app.use('/api/inventory', requireAuth, inventoryRoutes);
    
    // Menu routes: /public/* is public, others require auth
    app.use('/api/menu', (req, res, next) => {
      if (req.path.startsWith('/public')) return next();
      return requireAuth(req, res, next);
    }, menuRoutes);

    app.use('/api/tasks', requireAuth, tasksRoutes);
    app.use('/api/sync', requireAuth, syncRoutes);
    app.use('/api/receipts', requireAuth, receiptsRoutes);
    app.use('/api/audit', requireAuth, auditRoutes);

    // Timeclock routes: PIN-authenticated endpoints are public, others require auth
    // POST /clock-in, /clock-out, /start-break, /end-break, /pin-login use PIN auth internally
    // GET endpoints for stats/display can be public since they don't modify data
    app.use('/api/timeclock', (req, res, next) => {
      // PIN-based endpoints don't need JWT auth
      const pinAuthEndpoints = ['/clock-in', '/clock-out', '/start-break', '/end-break', '/pin-login', '/my-stats'];
      const isPinEndpoint = pinAuthEndpoints.some(endpoint => req.path.startsWith(endpoint));
      if (isPinEndpoint) return next();
      // Display-only endpoints (current-staff, staff-hours, user-daily-hours, stats) are public
      const displayEndpoints = ['/current-staff', '/staff-hours', '/user-daily-hours', '/stats'];
      const isDisplayEndpoint = displayEndpoints.some(endpoint => req.path.startsWith(endpoint));
      if (isDisplayEndpoint) return next();
      // All other endpoints require auth (like editing entries)
      return requireAuth(req, res, next);
    }, timeclockRoutes);

    app.use('/api/marketing', requireAuth, marketingRoutes);
    app.use('/api/restaurant', requireAuth, restaurantRoutes);
    app.use('/api/company', requireAuth, companyRoutes);
    app.use('/api/admin', requireAuth, adminRoutes);
    app.use('/api/restaurants', (req, res, next) => {
      if (req.path.endsWith('/vapi/test')) {
        const vapiApiKey = process.env.VAPI_API_KEY?.trim();
        const vapiWebhookSecret = process.env.VAPI_WEBHOOK_SECRET?.trim();
        const headerSecret =
          typeof req.headers['x-vapi-secret'] === 'string' ||
          typeof req.headers['x-vapi-webhook-secret'] === 'string' ||
          typeof req.headers['x-vapi-signature'] === 'string';
        if (headerSecret) return next();
        if (typeof req.headers.authorization === 'string' && req.headers.authorization.startsWith('Bearer ')) {
          const token = req.headers.authorization.replace(/^Bearer\s+/i, '').trim();
          if ((vapiApiKey && token === vapiApiKey) || (vapiWebhookSecret && token === vapiWebhookSecret)) {
            return next();
          }
        }
      }
      return requireAuth(req, res, next);
    }, restaurantsRoutes);
    app.use('/api/integrations', requireAuth, integrationsRoutes);
    app.use('/api/notifications', requireAuth, notificationsRoutes);
    // Push routes: /vapid-key is public (needed for push subscription setup), others require auth
    app.use('/api/push', (req, res, next) => {
      // VAPID public key is public - it's meant to be shared with clients
      if (req.path === '/vapid-key') return next();
      return requireAuth(req, res, next);
    }, pushRoutes);
    app.use('/api/delivery-platforms', requireAuth, deliveryPlatformsRoutes);
    app.use('/api/delivery-platforms-sessions', requireAuth, deliveryPlatformsSessionsRoutes);

    // Company and platform admin routes
    app.use('/api/company', requireAuth, companyRoutes);
    app.use('/api/admin', requireAuth, adminRoutes);

    // Staff management routes
    app.use('/api/staff/scheduling', requireAuth, staffSchedulingRoutes);
    app.use('/api/staff/analytics', requireAuth, staffAnalyticsRoutes);
    app.use('/api/staff/bulk', requireAuth, staffBulkRoutes);
    app.use('/api/admin', requireAuth, adminRoutes);

    // Staff clock-in PWA routes (public - PIN authenticated)
    app.use('/api/staff/clock', staffClockRoutes);

    // Modifiers routes - MUST be last since it uses /api catch-all
    app.use('/api', requireAuth, modifiersRoutes);


    // 404 handler (must be last)
    app.use((req, res, next) => {
      // If something already started the response, don't overwrite it with a 404.
      // This protects us from any middleware that mistakenly calls `next()` after sending.
      if (res.headersSent) return next();
      res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.method} ${req.originalUrl} not found`
      });
    });

    // Error handler MUST be after all routes and 404 handler
    app.use(errorHandler);

    logger.info('Routes loaded successfully');
  } catch (error) {
    logger.error('Failed to initialize server:', error);
    process.exit(1);
  }
}

// AGGRESSIVE PERFORMANCE MIDDLEWARE
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// Dynamic CORS handler with better logging
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman, etc.)
    if (!origin) {
      return callback(null, true);
    }

    // Check if origin is in allowed list
    if (corsOrigins.includes(origin)) {
      return callback(null, true);
    }

    // In development, allow any localhost origin
    if (process.env.NODE_ENV !== 'production' && origin.includes('localhost')) {
      logger.info(`[CORS] Allowing localhost origin in development: ${origin}`);
      return callback(null, true);
    }

    // Block and log rejected origins
    logger.warn(`[CORS] Blocked request from unauthorized origin: ${origin}`);
    logger.warn(`[CORS] Allowed origins: ${corsOrigins.join(', ')}`);
    return callback(new Error('CORS policy: Origin not allowed'));
  },
  credentials: true,
  optionsSuccessStatus: 200,
  preflightContinue: false,
  maxAge: 86400 // 24 hour preflight cache
}));

// Ensure OPTIONS preflight is handled for all routes (including /api/auth/login).
// This guarantees CORS headers are present even when no explicit route exists for OPTIONS.
app.options(/.*/, cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (corsOrigins.includes(origin)) return callback(null, true);
    if (process.env.NODE_ENV !== 'production' && origin.includes('localhost')) {
      return callback(null, true);
    }
    return callback(new Error('CORS policy: Origin not allowed'));
  },
  credentials: true,
  optionsSuccessStatus: 200,
  preflightContinue: false
}));

// LIGHTNING FAST COMPRESSION
app.use(compression({
  level: 9, // Maximum compression
  threshold: 512, // Compress even small responses
  memLevel: 8, // Use more memory for better compression
  chunkSize: 32 * 1024, // 32KB chunks
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    // Compress JSON, text, and JavaScript responses
    return compression.filter(req, res);
  }
}));

// OPTIMIZED LOGGING (less verbose in production)
const morganFormat = process.env.NODE_ENV === 'production' ? 'combined' : 'dev';
app.use(morgan(morganFormat, {
  stream: { write: message => logger.info(message.trim()) },
  skip: (req, res) => res.statusCode < 400 && process.env.NODE_ENV === 'production'
}));

// OPTIMIZED BODY PARSING
app.use(express.json({
  limit: '10mb',
  strict: true,
  type: ['application/json', 'application/*+json', 'application/csp-report']
}));
app.use(express.urlencoded({
  extended: true,
  limit: '10mb',
  parameterLimit: 1000
}));

// Handle trailing slashes in URLs
app.use((req, res, next) => {
  if (req.path.length > 1 && req.path.endsWith('/') && !req.path.includes('/_next/')) {
    const query = req.url.slice(req.path.length);
    const safepath = req.path.slice(0, -1);
    req.url = safepath + query;
  }
  next();
});

// ============================================================================
// STATIC FILE SERVING FOR UPLOADS
// ============================================================================
// Serve uploaded files (TTS audio, menu images, restaurant logos, QR codes)
// UPLOADS_DIR is configurable via environment for Render persistent disk
app.use('/uploads', express.static(UPLOADS_DIR, {
  maxAge: '1d', // Cache for 1 day
  etag: true,
  lastModified: true,
  // Set proper headers for audio files
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.mp3')) {
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Accept-Ranges', 'bytes');
    } else if (filePath.endsWith('.png')) {
      res.setHeader('Content-Type', 'image/png');
    } else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
      res.setHeader('Content-Type', 'image/jpeg');
    } else if (filePath.endsWith('.webp')) {
      res.setHeader('Content-Type', 'image/webp');
    }
    // Allow cross-origin access to uploads
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
}));
logger.info(`Static file serving enabled: /uploads -> ${UPLOADS_DIR}`);

// IN-MEMORY CACHE FOR API RESPONSES
const cache = new Map<string, { data: any; timestamp: number; headers: Record<string, string> }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 1000;

// Cache middleware for GET requests (excludes auth, timeclock, and real-time data)
app.use((req, res, next) => {
  // Only cache GET requests
  if (req.method !== 'GET') return next();

  // Skip caching for auth, timeclock, and other real-time endpoints
  const skipCachePatterns = ['/auth', '/timeclock', '/socket.io', '/health', '/notifications', '/push'];
  if (skipCachePatterns.some(pattern => req.url.includes(pattern))) {
    return next();
  }

  // Generate cache key including authorization to separate user-specific data
  const authHeader = req.headers.authorization || 'anonymous';
  const cacheKey = `${authHeader.slice(-20)}:${req.url}`;
  const cached = cache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    res.set(cached.headers);
    res.set('X-Cache', 'HIT');
    return res.json(cached.data);
  }

  // Cache the response
  const originalJson = res.json.bind(res);
  res.json = function(data: any) {
    if (res.statusCode === 200 && cache.size < MAX_CACHE_SIZE) {
      cache.set(cacheKey, {
        data,
        timestamp: Date.now(),
        headers: {
          'Cache-Control': 'public, max-age=300',
          'ETag': Buffer.from(JSON.stringify(data)).toString('base64').slice(0, 20)
        }
      });
    }
    res.set('X-Cache', 'MISS');
    return originalJson(data);
  };
  next();
});

// PERFORMANCE HEADERS FOR ALL RESPONSES
app.use((req, res, next) => {
  res.set('X-Powered-By', 'Servio');
  res.set('X-Response-Time-Start', Date.now().toString());
  next();
});

// Clean up cache periodically
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const cleanupInterval = setInterval(() => {
  try {
    const now = Date.now();
    for (const [key, value] of cache.entries()) {
      if (now - value.timestamp > CACHE_TTL) {
        cache.delete(key);
      }
    }

    // Safety valve: ensure cache can't grow unbounded even if cleanup misses entries.
    if (cache.size > MAX_CACHE_SIZE) {
      const entries = Array.from(cache.entries());
      entries.sort((a, b) => (a[1]?.timestamp || 0) - (b[1]?.timestamp || 0)); // oldest first
      const toRemove = cache.size - MAX_CACHE_SIZE;
      for (let i = 0; i < toRemove; i++) {
        cache.delete(entries[i][0]);
      }
    }
  } catch (error) {
    logger.error('Error during cache cleanup:', error);
  }
}, 5 * 60 * 1000); // Clean every 5 minutes

// Socket.IO connection handling
io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);

  socket.on('join:restaurant', (data: { restaurantId: string }) => {
    const { restaurantId } = data;
    socket.join(`restaurant-${restaurantId}`);
    logger.info(`Socket ${socket.id} joined restaurant-${restaurantId}`);
  });

  socket.on('join:user', (data: { userId: string, restaurantId?: string }) => {
    const { userId, restaurantId } = data;
    socket.join(`user-${userId}`);
    if (restaurantId) {
      socket.join(`restaurant-${restaurantId}`);
    }
    logger.info(`Socket ${socket.id} joined user-${userId} and restaurant-${restaurantId}`);
  });

  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

SocketService.setIO(io);

// Make io available to routes
app.set('socketio', io);

// Routes will be loaded after database initialization

// Health check with environment and DB status
app.get('/health', async (req, res) => {
  const envStatus = validateEnvironment();
  
  // Check database connectivity
  let dbStatus: 'connected' | 'disconnected' | 'unknown' = 'unknown';
  let dbError: string | undefined;
  try {
    const db = DatabaseService.getInstance().getDatabase();
    await db.get('SELECT 1 as ok');
    dbStatus = 'connected';
  } catch (error) {
    dbStatus = 'disconnected';
    dbError = error instanceof Error ? error.message : 'Unknown error';
  }

  // Check uploads directory
  const uploadsHealth = await checkUploadsHealth();

  const isHealthy = dbStatus === 'connected' && envStatus.valid;

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    version: '1.1.0',
    environment: process.env.NODE_ENV || 'development',
    services: {
      database: dbStatus,
      assistant: envStatus.services.assistant,
      auth: envStatus.services.auth,
      uploads: uploadsHealth.ok ? 'ok' : 'error',
    },
    checks: {
      env: envStatus.valid ? 'pass' : 'fail',
      db: dbStatus === 'connected' ? 'pass' : 'fail',
      uploads: uploadsHealth.ok ? 'pass' : 'fail',
    },
    config: {
      uploadsDir: UPLOADS_DIR,
      corsOrigins: corsOrigins.length,
    },
    // Only include errors in non-production or if explicitly requested
    ...(process.env.NODE_ENV !== 'production' || req.query.verbose === 'true' ? {
      errors: {
        env: envStatus.errors,
        db: dbError,
        uploads: uploadsHealth.error,
      }
    } : {})
  });
});

// Root route
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to Servio Restaurant Platform API',
    version: '1.0.0',
    documentation: '/api',
    health: '/health'
  });
});

// API documentation endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'Servio Restaurant Platform API',
    version: '1.0.0',
    description: 'Backend API for Servio Staff Assistant',
    endpoints: {
      assistant: '/api/assistant',
      orders: '/api/orders',
      inventory: '/api/inventory',
      menu: '/api/menu',
      tasks: '/api/tasks',
      sync: '/api/sync',
      receipts: '/api/receipts',
      audit: '/api/audit',
      timeclock: '/api/timeclock',
      marketing: '/api/marketing',
      restaurant: '/api/restaurant',
      integrations: '/api/integrations',
      'staff-scheduling': '/api/staff/scheduling',
      'staff-analytics': '/api/staff/analytics',
      'staff-bulk': '/api/staff/bulk'
    }
  });
});

// 404 handler moved to initializeServer() to ensure it comes after route registration

// Cleanup expired auth sessions periodically (every hour)
const SESSION_CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour
let sessionCleanupTimer: ReturnType<typeof setInterval> | null = null;

async function cleanupExpiredSessions() {
  try {
    const db = DatabaseService.getInstance().getDatabase();
    const result = await db.run('DELETE FROM auth_sessions WHERE expires_at < NOW()');
    if (result.changes > 0) {
      logger.info(`[session-cleanup] Deleted ${result.changes} expired sessions`);
    }
  } catch (error) {
    logger.error('[session-cleanup] Failed to clean up expired sessions:', error);
  }
}

// Initialize server and start listening
initializeServer().then(() => {
  server.listen(PORT, () => {
    logger.info(`🚀 Servio Backend Server running on port ${PORT}`);
    logger.info(`📱 Assistant API: http://localhost:${PORT}/api/assistant`);
    logger.info(`🔧 Health Check: http://localhost:${PORT}/health`);
    logger.info(`📋 API Docs: http://localhost:${PORT}/api`);

    // Start session cleanup job
    cleanupExpiredSessions(); // Run once on startup
    sessionCleanupTimer = setInterval(cleanupExpiredSessions, SESSION_CLEANUP_INTERVAL);
    logger.info('🧹 Session cleanup job started (runs every hour)');
  });
}).catch((error) => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  if (sessionCleanupTimer) clearInterval(sessionCleanupTimer);
  server.close(() => {
    logger.info('HTTP server closed');
    DatabaseService.close();
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing HTTP server');
  if (sessionCleanupTimer) clearInterval(sessionCleanupTimer);
  server.close(() => {
    logger.info('HTTP server closed');
    DatabaseService.close();
    process.exit(0);
  });
});

export default app;
