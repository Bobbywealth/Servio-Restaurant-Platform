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
import path from 'path';

// Services
import { DatabaseService } from './services/DatabaseService';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { requireAuth } from './middleware/auth';
import { initializeNotifications } from './notifications/initNotifications';
import { registerServices } from './bootstrap/services';

// Security & Monitoring
import { 
  globalRateLimiter, 
  authRateLimiter, 
  apiRateLimiter,
  heavyOperationRateLimiter 
} from './middleware/rateLimit';
import { preventSQLInjection } from './middleware/validation';
import { corsOptions } from './config/cors';
import { 
  initializeSentry, 
  sentryRequestHandler, 
  sentryTracingHandler, 
  sentryErrorHandler 
} from './config/apm';
import { performanceMiddleware } from './middleware/performance';
import { getMetricsService } from './services/MetricsService';
import { setupAlertHandlers } from './config/alerts';
import { container } from './container/ServiceContainer';
import { containerMiddleware } from './middleware/container';
import { ensureDemoUsers } from './bootstrap/ensureDemoUsers';

const app = express();
const server = createServer(app);

// Ensure req.ip works correctly behind Render / proxies
app.set('trust proxy', 1);

// Initialize Sentry APM (must be first)
initializeSentry(app);

// Sentry request handler (must be first middleware)
app.use(sentryRequestHandler());

// Sentry tracing handler
app.use(sentryTracingHandler());

// Performance monitoring middleware
app.use(performanceMiddleware);

// Request-scoped DI container (creates req.scopeId + req.container)
app.use(containerMiddleware(container));

const io = new SocketIOServer(server, {
  cors: corsOptions as any,
  transports: ['polling', 'websocket'],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000
});

const PORT = process.env.PORT || 3002;

// Initialize database first, then load routes
async function initializeServer() {
  try {
    await DatabaseService.initialize();
    logger.info('Database initialized successfully');

    // Ensure demo accounts exist for demo environments
    await ensureDemoUsers();

    // Initialize services
    initializeNotifications(io);
    registerServices();
    
    // Setup alert handlers
    setupAlertHandlers();
    
    // Initialize metrics service
    const metrics = getMetricsService();
    logger.info('Metrics service initialized');

    // Now load routes after database is ready
    const { default: healthRoutes } = await import('./routes/health');
    const { default: authRoutes } = await import('./routes/auth');
    const { default: assistantRoutes } = await import('./routes/assistant');
    const { default: assistantMonitoringRoutes } = await import('./routes/assistant-monitoring');
    const { default: ordersRoutes } = await import('./routes/orders');
    const { default: inventoryRoutes } = await import('./routes/inventory');
    const { default: menuRoutes } = await import('./routes/menu');
    const { default: tasksRoutes } = await import('./routes/tasks');
    const { default: syncRoutes } = await import('./routes/sync');
    const { default: receiptsRoutes } = await import('./routes/receipts');
    const { default: auditRoutes } = await import('./routes/audit');
    const { default: timeclockRoutes } = await import('./routes/timeclock');
    const { default: marketingRoutes } = await import('./routes/marketing');
    const { default: restaurantRoutes } = await import('./routes/restaurant');
    const { default: restaurantSettingsRoutes } = await import('./routes/restaurant-settings');
    const { default: integrationsRoutes } = await import('./routes/integrations');
    const { default: vapiRoutes } = await import('./routes/vapi');
    const { default: voiceRoutes } = await import('./routes/voice');
    const { default: adminRoutes } = await import('./routes/admin');
    const { default: bookingsRoutes } = await import('./routes/bookings');
    const { default: notificationsRoutes } = await import('./routes/notifications');

    // Health check routes (no rate limiting, no auth)
    app.use('/health', healthRoutes);
    app.use('/api/health', healthRoutes);
    
    // Setup routes (temporary, for production initialization)
    const { default: setupRoutes } = await import('./routes/setup');
    app.use('/api/setup', setupRoutes);
    
    // SQL injection prevention (global)
    app.use(preventSQLInjection);
    
    // API Routes with rate limiting
    logger.info('Mounting auth routes at /api/auth');
    app.use('/api/auth', authRateLimiter, authRoutes);
    logger.info('Auth routes mounted successfully');
    
    // Vapi webhook routes (no auth required for external webhooks)
    app.use('/api/vapi', vapiRoutes);
    app.use('/api/voice', voiceRoutes); // Mount voice ordering APIs under /api/voice

    // Public booking routes (demo booking / calendar)
    app.use('/api/bookings', bookingsRoutes);
    
    // Admin routes (platform-admin role required)
    app.use('/api/admin', requireAuth, adminRoutes);
    
    // Protected routes with appropriate rate limiting
    app.use('/api/assistant', requireAuth, heavyOperationRateLimiter, assistantRoutes);
    app.use('/api/assistant-monitoring', requireAuth, apiRateLimiter, assistantMonitoringRoutes);
    app.use('/api/orders', requireAuth, apiRateLimiter, ordersRoutes);
    app.use('/api/inventory', requireAuth, apiRateLimiter, inventoryRoutes);
    app.use('/api/menu', requireAuth, apiRateLimiter, menuRoutes);
    app.use('/api/tasks', requireAuth, apiRateLimiter, tasksRoutes);
    app.use('/api/sync', requireAuth, apiRateLimiter, syncRoutes);
    app.use('/api/receipts', requireAuth, apiRateLimiter, receiptsRoutes);
    app.use('/api/audit', requireAuth, apiRateLimiter, auditRoutes);
    app.use('/api/timeclock', requireAuth, apiRateLimiter, timeclockRoutes);
    app.use('/api/marketing', requireAuth, apiRateLimiter, marketingRoutes);
    app.use('/api/restaurant', requireAuth, apiRateLimiter, restaurantRoutes);
    app.use('/api/restaurants', requireAuth, apiRateLimiter, restaurantSettingsRoutes);
    app.use('/api/integrations', requireAuth, apiRateLimiter, integrationsRoutes);
    app.use('/api/notifications', requireAuth, apiRateLimiter, notificationsRoutes);

    // 404 handler (must be last)
    app.use((req, res, next) => {
      res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.method} ${req.originalUrl} not found`
      });
    });

    // Sentry error handler (must be before other error handlers)
    app.use(sentryErrorHandler());

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

app.use(cors(corsOptions));

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
  type: ['application/json', 'application/csp-report']
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

// IN-MEMORY CACHE FOR API RESPONSES
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 1000;

// OPTIMIZED CACHE MIDDLEWARE
app.use((req, res, next) => {
  // Only cache safe GET requests for non-auth endpoints
  if (req.method === 'GET' && 
      !req.url.includes('/auth') && 
      !req.url.includes('/timeclock') &&
      !req.url.includes('/notifications') &&
      !req.url.includes('/socket.io')) {
    
    const cacheKey = req.url;
    const cached = cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      res.set(cached.headers);
      res.set('X-Cache', 'HIT');
      return res.json(cached.data);
    }

    // Cache the response only for successful requests
    const originalSend = res.json;
    res.json = function(data) {
      if (res.statusCode === 200 && cache.size < MAX_CACHE_SIZE && data && typeof data === 'object') {
        try {
          cache.set(cacheKey, {
            data,
            timestamp: Date.now(),
            headers: {
              'Cache-Control': 'public, max-age=300',
              'ETag': Buffer.from(JSON.stringify(data)).toString('base64').slice(0, 20)
            }
          });
        } catch (error) {
          // Skip caching if serialization fails
          console.warn('Failed to cache response for', cacheKey);
        }
      }
      res.set('X-Cache', 'MISS');
      return originalSend.call(this, data);
    };
  }
  next();
});

// PERFORMANCE HEADERS FOR ALL RESPONSES
app.use((req, res, next) => {
  res.set('X-Powered-By', 'Servio');
  res.set('X-Response-Time-Start', Date.now().toString());
  next();
});

// Clean up cache periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of cache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      cache.delete(key);
    }
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

// Make io available to routes
app.set('socketio', io);

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Routes will be loaded after database initialization

// Basic health check (backup - main health routes loaded in initializeServer)
app.get('/health-basic', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
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
      integrations: '/api/integrations'
    }
  });
});

// 404 handler moved to initializeServer() to ensure it comes after route registration

// Initialize server and start listening
initializeServer().then(() => {
  server.listen(PORT, () => {
    logger.info(`🚀 Servio Backend Server running on port ${PORT}`);
    logger.info(`📱 Assistant API: http://localhost:${PORT}/api/assistant`);
    logger.info(`🔧 Health Check: http://localhost:${PORT}/health`);
    logger.info(`📋 API Docs: http://localhost:${PORT}/api`);
  });
}).catch((error) => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    DatabaseService.close();
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    DatabaseService.close();
    process.exit(0);
  });
});

export default app;