import { Router, Request, Response } from 'express';
import { DatabaseService } from '../services/DatabaseService';
import { asyncHandler } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

/**
 * POST /api/inventory
 * Create a new inventory item
 */
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const { name, sku, unit, onHandQty, lowStockThreshold, category } = req.body;
  const db = DatabaseService.getInstance().getDatabase();
  const restaurantId = req.user?.restaurantId;

  if (!name?.trim()) {
    return res.status(400).json({
      success: false,
      error: { message: 'Item name is required' }
    });
  }

  if (!unit?.trim()) {
    return res.status(400).json({
      success: false,
      error: { message: 'Unit is required' }
    });
  }

  if (!restaurantId) {
    return res.status(400).json({
      success: false,
      error: { message: 'Restaurant ID is required' }
    });
  }

  const itemId = uuidv4();

  await db.run(`
    INSERT INTO inventory_items (
      id, restaurant_id, name, sku, unit, on_hand_qty, low_stock_threshold, category, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `, [
    itemId,
    restaurantId,
    name.trim(),
    sku?.trim() || null,
    unit.trim(),
    onHandQty ?? 0,
    lowStockThreshold ?? 10,
    category?.trim() || null
  ]);

  const newItem = await db.get('SELECT * FROM inventory_items WHERE id = ?', [itemId]);

  await DatabaseService.getInstance().logAudit(
    restaurantId,
    req.user?.id || 'system',
    'create_inventory_item',
    'inventory',
    itemId,
    { name, sku, unit, onHandQty, lowStockThreshold, category }
  );

  logger.info(`Inventory item created: ${name}`);

  res.status(201).json({
    success: true,
    data: newItem
  });
}));

/**
 * PUT /api/inventory/:id
 * Update an inventory item
 */
router.put('/:id', asyncHandler(async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { name, sku, unit, onHandQty, lowStockThreshold, category } = req.body;
  const db = DatabaseService.getInstance().getDatabase();
  const restaurantId = req.user?.restaurantId;

  const existingItem = await db.get(
    'SELECT * FROM inventory_items WHERE id = ? AND restaurant_id = ?',
    [id, restaurantId]
  );

  if (!existingItem) {
    return res.status(404).json({
      success: false,
      error: { message: 'Inventory item not found' }
    });
  }

  const updateFields: string[] = [];
  const updateValues: any[] = [];

  if (name !== undefined) {
    updateFields.push('name = ?');
    updateValues.push(name.trim());
  }
  if (sku !== undefined) {
    updateFields.push('sku = ?');
    updateValues.push(sku?.trim() || null);
  }
  if (unit !== undefined) {
    updateFields.push('unit = ?');
    updateValues.push(unit.trim());
  }
  if (onHandQty !== undefined) {
    updateFields.push('on_hand_qty = ?');
    updateValues.push(Number(onHandQty));
  }
  if (lowStockThreshold !== undefined) {
    updateFields.push('low_stock_threshold = ?');
    updateValues.push(Number(lowStockThreshold));
  }
  if (category !== undefined) {
    updateFields.push('category = ?');
    updateValues.push(category?.trim() || null);
  }

  if (updateFields.length > 0) {
    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateValues.push(id);

    await db.run(`
      UPDATE inventory_items
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `, updateValues);
  }

  const updatedItem = await db.get('SELECT * FROM inventory_items WHERE id = ?', [id]);

  await DatabaseService.getInstance().logAudit(
    restaurantId!,
    req.user?.id || 'system',
    'update_inventory_item',
    'inventory',
    id,
    { name, sku, unit, onHandQty, lowStockThreshold, category }
  );

  logger.info(`Inventory item updated: ${updatedItem.name}`);

  res.json({
    success: true,
    data: updatedItem
  });
}));

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
  const { itemId, quantity, delta, reason } = req.body;
  
  // Support both 'quantity' and 'delta' for backwards compatibility
  const adjustmentAmount = delta !== undefined ? delta : quantity;

  if (!itemId || adjustmentAmount === undefined) {
    return res.status(400).json({
      success: false,
      error: { message: 'itemId and quantity/delta are required' }
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

  const newQuantity = item.on_hand_qty + adjustmentAmount;

  if (newQuantity < 0) {
    return res.status(400).json({
      success: false,
      error: {
        message: `Cannot reduce ${item.name} below 0. Current: ${item.on_hand_qty}, Requested: ${adjustmentAmount}`
      }
    });
  }

  await db.run(
    'UPDATE inventory_items SET on_hand_qty = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [newQuantity, itemId]
  );

  const adjustReason = reason || (adjustmentAmount > 0 ? 'Manual addition' : 'Manual reduction');

  await DatabaseService.getInstance().logAudit(
    restaurantId!,
    req.user?.id || 'system',
    'adjust_inventory',
    'inventory',
    itemId,
    { itemName: item.name, previousQuantity: item.on_hand_qty, adjustment: adjustmentAmount, newQuantity, reason: adjustReason }
  );

  logger.info(`Inventory adjusted: ${item.name} ${adjustmentAmount > 0 ? '+' : ''}${adjustmentAmount} (reason: ${adjustReason})`);

  res.json({
    success: true,
    data: {
      itemId,
      itemName: item.name,
      previousQuantity: item.on_hand_qty,
      adjustment: adjustmentAmount,
      newQuantity,
      reason: adjustReason,
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
