import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { VoiceOrderingService } from '../services/VoiceOrderingService';
import { requireAuth } from '../middleware/auth';
import { requireVapiAuth } from '../middleware/vapiAuth';
import { DatabaseService } from '../services/DatabaseService';
import { getService } from '../bootstrap/services';
import type { OrderService } from '../services/OrderService';

const router = Router();
const service = VoiceOrderingService.getInstance();

// 1) Store Status
router.get('/store/status', requireVapiAuth, asyncHandler(async (req: Request, res: Response) => {
  const status = service.getStoreStatus();
  res.json(status);
}));

// 2) Menu APIs
router.get('/menu', requireVapiAuth, asyncHandler(async (req: Request, res: Response) => {
  res.json(service.getFullMenu());
}));

router.get('/menu/search', requireVapiAuth, asyncHandler(async (req: Request, res: Response) => {
  const { q, restaurantId } = req.query;
  const targetRestaurantId = String(
    restaurantId ||
      process.env.VAPI_RESTAURANT_ID ||
      process.env.DEFAULT_RESTAURANT_ID ||
      DatabaseService.DEFAULT_RESTAURANT_ID
  );
  res.json(await service.searchMenu(String(q || ''), targetRestaurantId));
}));

router.get('/menu/items/:id', requireVapiAuth, asyncHandler(async (req: Request, res: Response) => {
  const { restaurantId } = req.query;
  const targetRestaurantId = String(
    restaurantId ||
      process.env.VAPI_RESTAURANT_ID ||
      process.env.DEFAULT_RESTAURANT_ID ||
      DatabaseService.DEFAULT_RESTAURANT_ID
  );
  const item = await service.getMenuItem(req.params.id, targetRestaurantId);
  if (!item) return res.status(404).json({ error: 'Item not found' });
  res.json(item);
}));

// 3) Quote
router.post('/order/quote', requireVapiAuth, asyncHandler(async (req: Request, res: Response) => {
  const restaurantId =
    req.body.restaurantId ||
    req.query.restaurantId ||
    process.env.VAPI_RESTAURANT_ID ||
    process.env.DEFAULT_RESTAURANT_ID ||
    DatabaseService.DEFAULT_RESTAURANT_ID;
  res.json(await service.validateQuote(req.body, String(restaurantId)));
}));

// 4) Create Order (PENDING Only)
router.post('/orders', requireVapiAuth, asyncHandler(async (req: Request, res: Response) => {
  const restaurantId =
    req.body.restaurantId ||
    req.query.restaurantId ||
    process.env.VAPI_RESTAURANT_ID ||
    process.env.DEFAULT_RESTAURANT_ID ||
    DatabaseService.DEFAULT_RESTAURANT_ID;
  const result = await service.createOrder(req.body, String(restaurantId));
  if (result.orderId) {
    res.status(201).json(result);
  } else {
    res.status(400).json(result);
  }
}));

// 5) Accept Order
router.post('/orders/:id/accept', requireAuth, asyncHandler(async (req: Request, res: Response) => {
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

  const statusResult = await orderService.updateOrderStatus({
    restaurantId: req.user?.restaurantId!,
    userId: req.user?.id || 'system',
    orderId: id,
    status: 'preparing'
  });

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

  const order = await orderService.getOrderById(id);
  const io = req.app.get('socketio');
  if (io && order?.restaurantId) {
    io.to(`restaurant-${order.restaurantId}`).emit('order:updated', order);
  }

  res.json({
    success: true,
    data: {
      ...statusResult,
      order
    }
  });
}));

// 6) Cancel / Complete
router.post('/orders/:id/cancel', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  // Implementation for internal workflow
  res.json({ success: true, status: 'cancelled' });
}));

router.post('/orders/:id/complete', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  // Implementation for internal workflow
  res.json({ success: true, status: 'completed' });
}));

// 7) Call Logs
router.post('/calls/log', requireVapiAuth, asyncHandler(async (req: Request, res: Response) => {
  res.json(await service.logCall(req.body));
}));

export default router;
