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
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const compression_1 = __importDefault(require("compression"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const path_1 = __importDefault(require("path"));
// Services
const DatabaseService_1 = require("./services/DatabaseService");
const logger_1 = require("./utils/logger");
const errorHandler_1 = require("./middleware/errorHandler");
const app = (0, express_1.default)();
const server = (0, http_1.createServer)(app);
const io = new socket_io_1.Server(server, {
    cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3003",
        methods: ["GET", "POST"]
    }
});
const PORT = process.env.PORT || 3002;
// Initialize database first, then load routes
async function initializeServer() {
    try {
        await DatabaseService_1.DatabaseService.initialize();
        logger_1.logger.info('Database initialized successfully');
        // Now load routes after database is ready
        const { default: assistantRoutes } = await Promise.resolve().then(() => __importStar(require('./routes/assistant')));
        const { default: ordersRoutes } = await Promise.resolve().then(() => __importStar(require('./routes/orders')));
        const { default: inventoryRoutes } = await Promise.resolve().then(() => __importStar(require('./routes/inventory')));
        const { default: menuRoutes } = await Promise.resolve().then(() => __importStar(require('./routes/menu')));
        const { default: tasksRoutes } = await Promise.resolve().then(() => __importStar(require('./routes/tasks')));
        const { default: syncRoutes } = await Promise.resolve().then(() => __importStar(require('./routes/sync')));
        const { default: receiptsRoutes } = await Promise.resolve().then(() => __importStar(require('./routes/receipts')));
        const { default: auditRoutes } = await Promise.resolve().then(() => __importStar(require('./routes/audit')));
        const { default: timeclockRoutes } = await Promise.resolve().then(() => __importStar(require('./routes/timeclock')));
        // API Routes
        app.use('/api/assistant', assistantRoutes);
        app.use('/api/orders', ordersRoutes);
        app.use('/api/inventory', inventoryRoutes);
        app.use('/api/menu', menuRoutes);
        app.use('/api/tasks', tasksRoutes);
        app.use('/api/sync', syncRoutes);
        app.use('/api/receipts', receiptsRoutes);
        app.use('/api/audit', auditRoutes);
        app.use('/api/timeclock', timeclockRoutes);
        logger_1.logger.info('Routes loaded successfully');
    }
    catch (error) {
        logger_1.logger.error('Failed to initialize server:', error);
        process.exit(1);
    }
}
// Middleware
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
}));
app.use((0, cors_1.default)({
    origin: process.env.FRONTEND_URL || "http://localhost:3003",
    credentials: true,
    optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
}));
// Compression middleware for better performance
app.use((0, compression_1.default)({
    level: 6,
    threshold: 1024,
    filter: (req, res) => {
        if (req.headers['x-no-compression'])
            return false;
        return compression_1.default.filter(req, res);
    }
}));
app.use((0, morgan_1.default)('combined', { stream: { write: message => logger_1.logger.info(message.trim()) } }));
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
// Add caching middleware for static assets
app.use('/uploads', express_1.default.static(path_1.default.join(__dirname, '../uploads'), {
    maxAge: '1d',
    etag: true,
    lastModified: true
}));
// Socket.IO connection handling
io.on('connection', (socket) => {
    logger_1.logger.info(`Client connected: ${socket.id}`);
    socket.on('join-restaurant', (restaurantId) => {
        socket.join(`restaurant-${restaurantId}`);
        logger_1.logger.info(`Socket ${socket.id} joined restaurant-${restaurantId}`);
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
            timeclock: '/api/timeclock'
        }
    });
});
// Error handling
app.use(errorHandler_1.errorHandler);
// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.method} ${req.originalUrl} not found`
    });
});
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