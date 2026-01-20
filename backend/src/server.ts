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

const app = express();
const server = createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: [
      process.env.FRONTEND_URL || "http://localhost:3000",
      "https://serviorestaurantplatform.netlify.app",
      "https://servio-app.onrender.com"
    ],
    methods: ["GET", "POST"],
    credentials: true
  },
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

    // Now load routes after database is ready
    const { default: authRoutes } = await import('./routes/auth');
    const { default: assistantRoutes } = await import('./routes/assistant');
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
    const { default: integrationsRoutes } = await import('./routes/integrations');
    const { default: vapiRoutes } = await import('./routes/vapi');
    const { default: adminRoutes } = await import('./routes/admin');

    // API Routes
    app.use('/api/auth', authRoutes);
    
    // Vapi webhook routes (no auth required for external webhooks)
    app.use('/api/vapi', vapiRoutes);
    
    // Admin routes (platform-admin role required)
    app.use('/api/admin', adminRoutes);
    
    // Debug: Add a test auth route to verify mounting
    app.get('/api/auth/test', (req, res) => {
      res.json({ message: 'Auth routes are mounted correctly' });
    });
    
    // Debug: Test direct route without auth prefix
    app.get('/debug-route', (req, res) => {
      res.json({ message: 'Direct route works' });
    });

    // Protected routes
    app.use('/api/assistant', requireAuth, assistantRoutes);
    app.use('/api/orders', requireAuth, ordersRoutes);
    app.use('/api/inventory', requireAuth, inventoryRoutes);
    app.use('/api/menu', requireAuth, menuRoutes);
    app.use('/api/tasks', requireAuth, tasksRoutes);
    app.use('/api/sync', requireAuth, syncRoutes);
    app.use('/api/receipts', requireAuth, receiptsRoutes);
    app.use('/api/audit', requireAuth, auditRoutes);
    app.use('/api/timeclock', requireAuth, timeclockRoutes);
    app.use('/api/marketing', requireAuth, marketingRoutes);
    app.use('/api/restaurant', requireAuth, restaurantRoutes);
    app.use('/api/integrations', requireAuth, integrationsRoutes);

    // 404 handler (must be last)
    app.use((req, res) => {
      res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.method} ${req.originalUrl} not found`
      });
    });

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

app.use(cors({
  origin: [
    process.env.FRONTEND_URL || "http://localhost:3000",
    "https://serviorestaurantplatform.netlify.app",
    "https://servio-app.onrender.com"
  ],
  credentials: true,
  optionsSuccessStatus: 200,
  preflightContinue: false,
  maxAge: 86400 // 24 hour preflight cache
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

// Cache middleware for GET requests
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.url.includes('/auth') && !req.url.includes('/timeclock')) {
    const cacheKey = req.url;
    const cached = cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      res.set(cached.headers);
      res.set('X-Cache', 'HIT');
      return res.json(cached.data);
    }

    // Cache the response
    const originalSend = res.json;
    res.json = function(data) {
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

// Routes will be loaded after database initialization

// Health check
app.get('/health', (req, res) => {
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

// Error handling
app.use(errorHandler);

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