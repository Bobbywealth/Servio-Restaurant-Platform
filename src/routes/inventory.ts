import { Router, Request, Response } from 'express';
import { DatabaseService } from '../services/DatabaseService';
import { asyncHandler } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /api/inventory/search
 * Search inventory items
 */
router.get('/search', asyncHandler(async (req: Request, res: Response) => {
  const { q, category, lowStock } = req.query;
  const db = DatabaseService.getInstance().getDatabase();
  const restaurantId = req.user?.restaurantId;

  let query = 'SELECT * FROM inventory_items';
  const params: any[] = [restaurantId];
  const conditions: string[] = ['restaurant_id = ?'];

  if (q) {
    conditions.push('(name LIKE ? OR sku LIKE ?)');
    params.push(`%${q}%`, `%${q}%`);
  }

  if (category) {
    conditions.push('category = ?');
    params.push(category);
  }

  if (lowStock === 'true') {
    conditions.push('on_hand_qty <= low_stock_threshold');
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY name';

  const items = await db.all(query, params);

  res.json({
    success: true,
    data: items
  });
}));

/**
 * POST /api/inventory/receive
 * Record inventory received
 */
router.post('/receive', asyncHandler(async (req: Request, res: Response) => {
  const { items } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      success: false,
      error: { message: 'Items array is required' }
    });
  }

  const db = DatabaseService.getInstance().getDatabase();
  const restaurantId = req.user?.restaurantId;
  const results = [];

  for (const item of items) {
    const { name, quantity } = item;

    if (!name || !quantity) {
      continue;
    }

    // Find the inventory item
    const inventoryItem = await db.get(
      'SELECT * FROM inventory_items WHERE name LIKE ? AND restaurant_id = ?',
      [`%${name}%`, restaurantId]
    );

    if (inventoryItem) {
      const newQuantity = inventoryItem.on_hand_qty + quantity;

      await db.run(
        'UPDATE inventory_items SET on_hand_qty = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [newQuantity, inventoryItem.id]
      );

      await DatabaseService.getInstance().logAudit(
        restaurantId!,
        req.user?.id || 'system',
        'receive_inventory',
        'inventory',
        inventoryItem.id,
        { name, previousQuantity: inventoryItem.on_hand_qty, received: quantity, newQuantity }
      );

      results.push({
        item: name,
        received: quantity,
        newTotal: newQuantity,
        unit: inventoryItem.unit
      });
    }
  }

  logger.info(`Inventory received: ${results.length} items updated`);

  res.json({
    success: true,
    data: { results }
  });
}));

/**
 * POST /api/inventory/adjust
 * Adjust inventory quantities
 */
router.post('/adjust', asyncHandler(async (req: Request, res: Response) => {
  const { itemId, quantity, reason } = req.body;

  if (!itemId || quantity === undefined || !reason) {
    return res.status(400).json({
      success: false,
      error: { message: 'itemId, quantity, and reason are required' }
    });
  }

  const db = DatabaseService.getInstance().getDatabase();
  const restaurantId = req.user?.restaurantId;

  const item = await db.get('SELECT * FROM inventory_items WHERE id = ? AND restaurant_id = ?', [itemId, restaurantId]);
  if (!item) {
    return res.status(404).json({
      success: false,
      error: { message: 'Inventory item not found' }
    });
  }

  const newQuantity = item.on_hand_qty + quantity;

  if (newQuantity < 0) {
    return res.status(400).json({
      success: false,
      error: {
        message: `Cannot reduce ${item.name} below 0. Current: ${item.on_hand_qty}, Requested: ${quantity}`
      }
    });
  }

  await db.run(
    'UPDATE inventory_items SET on_hand_qty = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [newQuantity, itemId]
  );

  await DatabaseService.getInstance().logAudit(
    restaurantId!,
    req.user?.id || 'system',
    'adjust_inventory',
    'inventory',
    itemId,
    { itemName: item.name, previousQuantity: item.on_hand_qty, adjustment: quantity, newQuantity, reason }
  );

  logger.info(`Inventory adjusted: ${item.name} ${quantity > 0 ? '+' : ''}${quantity} (reason: ${reason})`);

  res.json({
    success: true,
    data: {
      itemId,
      itemName: item.name,
      previousQuantity: item.on_hand_qty,
      adjustment: quantity,
      newQuantity,
      reason,
      unit: item.unit
    }
  });
}));

/**
 * GET /api/inventory/low-stock
 * Get items that are low in stock
 */
router.get('/low-stock', asyncHandler(async (req: Request, res: Response) => {
  const db = DatabaseService.getInstance().getDatabase();
  const restaurantId = req.user?.restaurantId;

  const lowStockItems = await db.all(`
    SELECT *,
           CASE
             WHEN on_hand_qty = 0 THEN 'out_of_stock'
             WHEN on_hand_qty <= low_stock_threshold THEN 'low_stock'
             ELSE 'normal'
           END as stock_status
    FROM inventory_items
    WHERE restaurant_id = ? AND on_hand_qty <= low_stock_threshold
    ORDER BY on_hand_qty ASC
  `, [restaurantId]);

  res.json({
    success: true,
    data: lowStockItems
  });
}));

/**
 * GET /api/inventory/categories
 * Get all inventory categories
 */
router.get('/categories', asyncHandler(async (req: Request, res: Response) => {
  const db = DatabaseService.getInstance().getDatabase();
  const restaurantId = req.user?.restaurantId;

  const categories = await db.all(`
    SELECT category, COUNT(*) as item_count
    FROM inventory_items
    WHERE restaurant_id = ?
    GROUP BY category
    ORDER BY category
  `, [restaurantId]);

  res.json({
    success: true,
    data: categories
  });
}));

export default router;
