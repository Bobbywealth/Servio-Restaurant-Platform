import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { requireAuth, requirePermission } from '../middleware/auth';
import { getService } from '../bootstrap/services';
import { DatabaseService } from '../services/DatabaseService';
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
  const { items, customerName, customerPhone, customerEmail, paymentOption } = req.body;
  const orderService = getService<OrderService>('orderService');
  const created = await orderService.createPublicOrder({ slug, items, customerName, customerPhone, customerEmail, paymentOption });

  // Notify dashboard via Socket.IO
  const io = req.app.get('socketio');
  if (io) {
    const payload = {
      orderId: created.orderId,
      totalAmount: created.totalAmount,
      channel: 'website',
      status: created.status,
      createdAt: new Date().toISOString()
    };
    // Legacy event name (older clients)
    io.to(`restaurant-${created.restaurantId}`).emit('new-order', payload);
    // Canonical event name (frontend expects this)
    io.to(`restaurant-${created.restaurantId}`).emit('order:new', payload);
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

  // Notify dashboard/tablet via Socket.IO
  const io = req.app.get('socketio');
  if (io) {
    const payload = {
      orderId: created.orderId,
      totalAmount,
      channel: channel || null,
      status: created.status,
      createdAt: created.createdAt
    };
    io.to(`restaurant-${req.user?.restaurantId}`).emit('new-order', payload);
    io.to(`restaurant-${req.user?.restaurantId}`).emit('order:new', payload);
  }

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

/**
 * POST /api/orders/:id/accept
 * Accept an order and set prep time.
 * Requires orders:write permission.
 */
router.post('/:id/accept', requireAuth, requirePermission('orders:write'), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const prepTimeMinutesRaw = req.body?.prepTimeMinutes;
  const prepTimeMinutes = prepTimeMinutesRaw === undefined || prepTimeMinutesRaw === null
    ? null
    : Number(prepTimeMinutesRaw);

  if (prepTimeMinutes !== null && (!Number.isFinite(prepTimeMinutes) || prepTimeMinutes < 0 || prepTimeMinutes > 240)) {
    return res.status(400).json({
      success: false,
      error: { message: 'prepTimeMinutes must be a number between 0 and 240' }
    });
  }

  const orderService = getService<OrderService>('orderService');

  // 1) Move to preparing (accepted)
  const statusResult = await orderService.updateOrderStatus({
    restaurantId: req.user?.restaurantId!,
    userId: req.user?.id || 'system',
    orderId: id,
    status: 'preparing'
  });

  // 2) Store prep time + acceptance metadata
  const db = DatabaseService.getInstance().getDatabase();
  await db.run(
    `
      UPDATE orders
      SET
        prep_time_minutes = COALESCE(?, prep_time_minutes),
        accepted_at = COALESCE(accepted_at, CURRENT_TIMESTAMP),
        accepted_by_user_id = COALESCE(accepted_by_user_id, ?),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND restaurant_id = ?
    `,
    [prepTimeMinutes, req.user?.id || null, id, req.user?.restaurantId]
  );

  // Return updated order
  const order = await orderService.getOrderById(id);

  res.json({
    success: true,
    data: {
      ...statusResult,
      order
    }
  });
}));

export default router;