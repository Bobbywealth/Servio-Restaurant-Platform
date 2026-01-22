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
  const { q } = req.query;
  res.json(service.searchMenu(String(q || '')));
}));

router.get('/menu/items/:id', requireVapiAuth, asyncHandler(async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const item = service.getMenuItem(id);
  if (!item) return res.status(404).json({ error: 'Item not found' });
  res.json(item);
}));

// 3) Quote
router.post('/order/quote', requireVapiAuth, asyncHandler(async (req: Request, res: Response) => {
  res.json(service.validateQuote(req.body));
}));

// 4) Create Order (Received status)
router.post('/orders', requireVapiAuth, asyncHandler(async (req: Request, res: Response) => {
  const result = await service.createOrder(req.body);
  if (result.orderId) {
    res.status(201).json(result);
  } else {
    res.status(400).json(result);
  }
}));

// 5) Accept Order
router.post('/orders/:id/accept', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const { prepTimeMinutes } = req.body;
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const result = await service.acceptOrder(id, prepTimeMinutes, req.user!.id);
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
