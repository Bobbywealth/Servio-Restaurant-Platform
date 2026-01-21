import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { requireAuth, requirePermission } from '../middleware/auth';
import { getService } from '../bootstrap/services';
import type { InventoryService } from '../services/InventoryService';

const router = Router();

/**
 * GET /api/inventory/search
 * Search inventory items
 */
router.get('/search', requireAuth, requirePermission('inventory:read'), asyncHandler(async (req: Request, res: Response) => {
  const { q, category, lowStock } = req.query;
  const restaurantId = req.user?.restaurantId;
  const inventoryService = getService<InventoryService>('inventoryService');
  const items = await inventoryService.searchInventory(restaurantId!, {
    q: q ? String(q) : undefined,
    category: category ? String(category) : undefined,
    lowStock: lowStock ? String(lowStock) : undefined
  });

  res.json({
    success: true,
    data: items
  });
}));

/**
 * POST /api/inventory/receive
 * Record inventory received
 */
router.post('/receive', requireAuth, requirePermission('inventory:write'), asyncHandler(async (req: Request, res: Response) => {
  const { items, userId } = req.body;
  const restaurantId = req.user?.restaurantId;
  const inventoryService = getService<InventoryService>('inventoryService');
  const data = await inventoryService.receiveInventory({
    restaurantId: restaurantId!,
    userId: req.user?.id || userId || 'system',
    items
  });

  res.json({
    success: true,
    data
  });
}));

/**
 * POST /api/inventory/adjust
 * Adjust inventory quantities
 */
router.post('/adjust', requireAuth, requirePermission('inventory:write'), asyncHandler(async (req: Request, res: Response) => {
  const { itemId, quantity, reason, userId } = req.body;
  const restaurantId = req.user?.restaurantId;
  const inventoryService = getService<InventoryService>('inventoryService');
  const data = await inventoryService.adjustInventory({
    restaurantId: restaurantId!,
    userId: req.user?.id || userId || 'system',
    itemId,
    quantity,
    reason
  });

  res.json({
    success: true,
    data
  });
}));

/**
 * GET /api/inventory/low-stock
 * Get items that are low in stock
 */
router.get('/low-stock', requireAuth, requirePermission('inventory:read'), asyncHandler(async (req: Request, res: Response) => {
  const restaurantId = req.user?.restaurantId;
  const inventoryService = getService<InventoryService>('inventoryService');
  const lowStockItems = await inventoryService.listLowStock(restaurantId!);

  res.json({
    success: true,
    data: lowStockItems
  });
}));

/**
 * GET /api/inventory/categories
 * Get all inventory categories
 */
router.get('/categories', requireAuth, requirePermission('inventory:read'), asyncHandler(async (req: Request, res: Response) => {
  const restaurantId = req.user?.restaurantId;
  const inventoryService = getService<InventoryService>('inventoryService');
  const categories = await inventoryService.listCategories(restaurantId!);

  res.json({
    success: true,
    data: categories
  });
}));

export default router;
