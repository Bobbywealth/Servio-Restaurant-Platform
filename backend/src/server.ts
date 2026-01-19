import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import path from 'path';

// Routes
import assistantRoutes from './routes/assistant';
import ordersRoutes from './routes/orders';
import inventoryRoutes from './routes/inventory';
import menuRoutes from './routes/menu';
import tasksRoutes from './routes/tasks';
import syncRoutes from './routes/sync';
import receiptsRoutes from './routes/receipts';
import auditRoutes from './routes/audit';

// Services
import { DatabaseService } from './services/DatabaseService';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';

const app = express();
const server = createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3001",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3002;

// Initialize database
DatabaseService.initialize().then(() => {
  logger.info('Database initialized successfully');
}).catch((error) => {
  logger.error('Failed to initialize database:', error);
  process.exit(1);
});

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3001",
  credentials: true
}));
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Socket.IO connection handling
io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);
  
  socket.on('join-restaurant', (restaurantId: string) => {
    socket.join(`restaurant-${restaurantId}`);
    logger.info(`Socket ${socket.id} joined restaurant-${restaurantId}`);
  });

  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

// Make io available to routes
app.set('socketio', io);

// API Routes
app.use('/api/assistant', assistantRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/receipts', receiptsRoutes);
app.use('/api/audit', auditRoutes);

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
      audit: '/api/audit'
    }
  });
});

// Error handling
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Not Found',
    message: `Route ${req.method} ${req.originalUrl} not found`
  });
});

// Start server
server.listen(PORT, () => {
  logger.info(`🚀 Servio Backend Server running on port ${PORT}`);
  logger.info(`📱 Assistant API: http://localhost:${PORT}/api/assistant`);
  logger.info(`🔧 Health Check: http://localhost:${PORT}/health`);
  logger.info(`📋 API Docs: http://localhost:${PORT}/api`);
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