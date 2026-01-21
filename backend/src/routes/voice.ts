import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { VoiceOrderingService } from '../services/VoiceOrderingService';
import { requireAuth } from '../middleware/auth';
import { requireVapiAuth } from '../middleware/vapiAuth';

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
  const targetRestaurantId = String(restaurantId || process.env.VAPI_RESTAURANT_ID || 'demo-restaurant-1');
  res.json(await service.searchMenu(String(q || ''), targetRestaurantId));
}));

router.get('/menu/items/:id', requireVapiAuth, asyncHandler(async (req: Request, res: Response) => {
  const { restaurantId } = req.query;
  const targetRestaurantId = String(restaurantId || process.env.VAPI_RESTAURANT_ID || 'demo-restaurant-1');
  const item = await service.getMenuItem(req.params.id, targetRestaurantId);
  if (!item) return res.status(404).json({ error: 'Item not found' });
  res.json(item);
}));

// 3) Quote
router.post('/order/quote', requireVapiAuth, asyncHandler(async (req: Request, res: Response) => {
  const restaurantId = req.body.restaurantId || req.query.restaurantId || process.env.VAPI_RESTAURANT_ID || 'demo-restaurant-1';
  res.json(await service.validateQuote(req.body, String(restaurantId)));
}));

// 4) Create Order (PENDING Only)
router.post('/orders', requireVapiAuth, asyncHandler(async (req: Request, res: Response) => {
  const restaurantId = req.body.restaurantId || req.query.restaurantId || process.env.VAPI_RESTAURANT_ID || 'demo-restaurant-1';
  const result = await service.createOrder(req.body, String(restaurantId));
  if (result.orderId) {
    res.status(201).json(result);
  } else {
    res.status(400).json(result);
  }
}));

// 5) Accept Order
router.post('/orders/:id/accept', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const { prepTimeMinutes } = req.body;
  const result = await service.acceptOrder(req.params.id, prepTimeMinutes, req.user!.id);
  res.json(result);
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
