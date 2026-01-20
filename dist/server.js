"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Load environment variables first
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const compression_1 = __importDefault(require("compression"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
// Services
const DatabaseService_1 = require("./services/DatabaseService");
const logger_1 = require("./utils/logger");
const errorHandler_1 = require("./middleware/errorHandler");
const auth_1 = require("./middleware/auth");
const app = (0, express_1.default)();
const server = (0, http_1.createServer)(app);
const io = new socket_io_1.Server(server, {
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
        await DatabaseService_1.DatabaseService.initialize();
        logger_1.logger.info('Database initialized successfully');
        // Now load routes after database is ready
        const { default: authRoutes } = await Promise.resolve().then(() => __importStar(require('./routes/auth')));
        const { default: assistantRoutes } = await Promise.resolve().then(() => __importStar(require('./routes/assistant')));
        const { default: ordersRoutes } = await Promise.resolve().then(() => __importStar(require('./routes/orders')));
        const { default: inventoryRoutes } = await Promise.resolve().then(() => __importStar(require('./routes/inventory')));
        const { default: menuRoutes } = await Promise.resolve().then(() => __importStar(require('./routes/menu')));
        const { default: tasksRoutes } = await Promise.resolve().then(() => __importStar(require('./routes/tasks')));
        const { default: syncRoutes } = await Promise.resolve().then(() => __importStar(require('./routes/sync')));
        const { default: receiptsRoutes } = await Promise.resolve().then(() => __importStar(require('./routes/receipts')));
        const { default: auditRoutes } = await Promise.resolve().then(() => __importStar(require('./routes/audit')));
        const { default: timeclockRoutes } = await Promise.resolve().then(() => __importStar(require('./routes/timeclock')));
        const { default: marketingRoutes } = await Promise.resolve().then(() => __importStar(require('./routes/marketing')));
        const { default: restaurantRoutes } = await Promise.resolve().then(() => __importStar(require('./routes/restaurant')));
        const { default: integrationsRoutes } = await Promise.resolve().then(() => __importStar(require('./routes/integrations')));
        const { default: vapiRoutes } = await Promise.resolve().then(() => __importStar(require('./routes/vapi')));
        const { default: adminRoutes } = await Promise.resolve().then(() => __importStar(require('./routes/admin')));
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
        app.use('/api/assistant', auth_1.requireAuth, assistantRoutes);
        app.use('/api/orders', auth_1.requireAuth, ordersRoutes);
        app.use('/api/inventory', auth_1.requireAuth, inventoryRoutes);
        app.use('/api/menu', auth_1.requireAuth, menuRoutes);
        app.use('/api/tasks', auth_1.requireAuth, tasksRoutes);
        app.use('/api/sync', auth_1.requireAuth, syncRoutes);
        app.use('/api/receipts', auth_1.requireAuth, receiptsRoutes);
        app.use('/api/audit', auth_1.requireAuth, auditRoutes);
        app.use('/api/timeclock', auth_1.requireAuth, timeclockRoutes);
        app.use('/api/marketing', auth_1.requireAuth, marketingRoutes);
        app.use('/api/restaurant', auth_1.requireAuth, restaurantRoutes);
        app.use('/api/integrations', auth_1.requireAuth, integrationsRoutes);
        // 404 handler (must be last)
        app.use((req, res) => {
            res.status(404).json({
                error: 'Not Found',
                message: `Route ${req.method} ${req.originalUrl} not found`
            });
        });
        logger_1.logger.info('Routes loaded successfully');
    }
    catch (error) {
        logger_1.logger.error('Failed to initialize server:', error);
        process.exit(1);
    }
}
// AGGRESSIVE PERFORMANCE MIDDLEWARE
app.use((0, helmet_1.default)({
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
app.use((0, cors_1.default)({
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
app.use((0, compression_1.default)({
    level: 9, // Maximum compression
    threshold: 512, // Compress even small responses
    memLevel: 8, // Use more memory for better compression
    chunkSize: 32 * 1024, // 32KB chunks
    filter: (req, res) => {
        if (req.headers['x-no-compression'])
            return false;
        // Compress JSON, text, and JavaScript responses
        return compression_1.default.filter(req, res);
    }
}));
// OPTIMIZED LOGGING (less verbose in production)
const morganFormat = process.env.NODE_ENV === 'production' ? 'combined' : 'dev';
app.use((0, morgan_1.default)(morganFormat, {
    stream: { write: message => logger_1.logger.info(message.trim()) },
    skip: (req, res) => res.statusCode < 400 && process.env.NODE_ENV === 'production'
}));
// OPTIMIZED BODY PARSING
app.use(express_1.default.json({
    limit: '10mb',
    strict: true,
    type: ['application/json', 'application/csp-report']
}));
app.use(express_1.default.urlencoded({
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
// Cache middleware disabled temporarily for debugging
// app.use((req, res, next) => {
//   if (req.method === 'GET' && !req.url.includes('/auth') && !req.url.includes('/timeclock')) {
//     const cacheKey = req.url;
//     const cached = cache.get(cacheKey);
//
//     if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
//       res.set(cached.headers);
//       res.set('X-Cache', 'HIT');
//       return res.json(cached.data);
//     }
//
//     // Cache the response
//     const originalSend = res.json;
//     res.json = function(data) {
//       if (res.statusCode === 200 && cache.size < MAX_CACHE_SIZE) {
//         cache.set(cacheKey, {
//           data,
//           timestamp: Date.now(),
//           headers: {
//             'Cache-Control': 'public, max-age=300',
//             'ETag': Buffer.from(JSON.stringify(data)).toString('base64').slice(0, 20)
//           }
//         });
//       }
//       res.set('X-Cache', 'MISS');
//       return originalSend.call(this, data);
//     };
//   }
//   next();
// });
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
    logger_1.logger.info(`Client connected: ${socket.id}`);
    socket.on('join:restaurant', (data) => {
        const { restaurantId } = data;
        socket.join(`restaurant-${restaurantId}`);
        logger_1.logger.info(`Socket ${socket.id} joined restaurant-${restaurantId}`);
    });
    socket.on('join:user', (data) => {
        const { userId, restaurantId } = data;
        socket.join(`user-${userId}`);
        if (restaurantId) {
            socket.join(`restaurant-${restaurantId}`);
        }
        logger_1.logger.info(`Socket ${socket.id} joined user-${userId} and restaurant-${restaurantId}`);
    });
    socket.on('disconnect', () => {
        logger_1.logger.info(`Client disconnected: ${socket.id}`);
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
app.use(errorHandler_1.errorHandler);
// 404 handler moved to initializeServer() to ensure it comes after route registration
// Initialize server and start listening
initializeServer().then(() => {
    server.listen(PORT, () => {
        logger_1.logger.info(`🚀 Servio Backend Server running on port ${PORT}`);
        logger_1.logger.info(`📱 Assistant API: http://localhost:${PORT}/api/assistant`);
        logger_1.logger.info(`🔧 Health Check: http://localhost:${PORT}/health`);
        logger_1.logger.info(`📋 API Docs: http://localhost:${PORT}/api`);
    });
}).catch((error) => {
    logger_1.logger.error('Failed to start server:', error);
    process.exit(1);
});
// Graceful shutdown
process.on('SIGTERM', () => {
    logger_1.logger.info('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        logger_1.logger.info('HTTP server closed');
        DatabaseService_1.DatabaseService.close();
        process.exit(0);
    });
});
process.on('SIGINT', () => {
    logger_1.logger.info('SIGINT signal received: closing HTTP server');
    server.close(() => {
        logger_1.logger.info('HTTP server closed');
        DatabaseService_1.DatabaseService.close();
        process.exit(0);
    });
});
exports.default = app;
//# sourceMappingURL=server.js.map