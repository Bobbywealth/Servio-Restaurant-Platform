import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { requireAuth, requirePermission } from '../middleware/auth';
import { getService } from '../bootstrap/services';
import type { OrderService } from '../services/OrderService';

const router = Router();

/**
 * GET /api/orders
 * Get orders with optional filtering
 * Requires orders:read permission (staff cannot access)
 */
router.get('/', requireAuth, requirePermission('orders:read'), asyncHandler(async (req: Request, res: Response) => {
  const { status, channel, limit = 50, offset = 0 } = req.query;
  const restaurantId = req.user?.restaurantId;
  const orderService = getService<OrderService>('orderService');

  const result = await orderService.listOrders(
    restaurantId!,
    { status: status ? String(status) : undefined, channel: channel ? String(channel) : undefined },
    { limit: Number(limit), offset: Number(offset) }
  );

  res.json({
    success: true,
    data: {
      orders: result.orders,
      pagination: result.pagination
    }
  });
}));

/**
 * GET /api/orders/stats/summary
 * Get order statistics summary
 * Requires orders:read permission (staff cannot access)
 */
router.get('/stats/summary', requireAuth, requirePermission('orders:read'), asyncHandler(async (req: Request, res: Response) => {
  const orderService = getService<OrderService>('orderService');
  const restaurantId = req.user?.restaurantId;
  const stats = await orderService.getStatsSummary(restaurantId!);

  res.json({
    success: true,
    data: stats
  });
}));

/**
 * GET /api/orders/waiting-times
 * Get current waiting times for orders
 * Requires orders:read permission (staff cannot access)
 */
router.get('/waiting-times', requireAuth, requirePermission('orders:read'), asyncHandler(async (req: Request, res: Response) => {
  const orderService = getService<OrderService>('orderService');
  const restaurantId = req.user?.restaurantId;
  const data = await orderService.getWaitingTimes(restaurantId!);

  res.json({
    success: true,
    data
  });
}));

/**
 * POST /api/orders/public/:slug
 * Create a new order via public site
 */
router.post('/public/:slug', asyncHandler(async (req: Request, res: Response) => {
  const { slug } = req.params;
  const { items, customerName, customerPhone, customerEmail } = req.body;
  const orderService = getService<OrderService>('orderService');
  const created = await orderService.createPublicOrder({ slug, items, customerName, customerPhone, customerEmail });

  // Notify dashboard via Socket.IO
  const io = req.app.get('socketio');
  if (io) {
    io.to(`restaurant-${created.restaurantId}`).emit('new-order', {
      orderId: created.orderId,
      totalAmount: created.totalAmount
    });
  }

  res.status(201).json({
    success: true,
    data: { orderId: created.orderId, status: created.status }
  });
}));

/**
 * POST /api/orders
 * Create a new order (typically from delivery platforms)
 * Requires orders:write permission (staff cannot access)
 */
router.post('/', requireAuth, requirePermission('orders:write'), asyncHandler(async (req: Request, res: Response) => {
  const {
    externalId,
    channel,
    items,
    customerName,
    customerPhone,
    totalAmount,
    userId
  } = req.body;

  const orderService = getService<OrderService>('orderService');
  const created = await orderService.createIntegrationOrder({
    restaurantId: req.user?.restaurantId!,
    userId: req.user?.id || userId || 'system',
    externalId,
    channel,
    items,
    customerName,
    customerPhone,
    totalAmount
  });

  res.status(201).json({
    success: true,
    data: {
      orderId: created.orderId,
      externalId,
      channel,
      status: created.status,
      createdAt: created.createdAt
    }
  });
}));

/**
 * GET /api/orders/:id
 * Get a specific order by ID
 * Requires orders:read permission (staff cannot access)
 */
router.get('/:id', requireAuth, requirePermission('orders:read'), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const orderService = getService<OrderService>('orderService');
  const order = await orderService.getOrderById(id);

  res.json({
    success: true,
    data: order
  });
}));

/**
 * POST /api/orders/:id/status
 * Update order status
 * Requires orders:write permission (staff cannot access)
 */
router.post('/:id/status', requireAuth, requirePermission('orders:write'), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;
  const orderService = getService<OrderService>('orderService');

  const data = await orderService.updateOrderStatus({
    restaurantId: req.user?.restaurantId!,
    userId: req.user?.id || 'system',
    orderId: id,
    status
  });

  res.json({ success: true, data });
}));

export default router;