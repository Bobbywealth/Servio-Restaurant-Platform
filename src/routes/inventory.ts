import { Router, Request, Response } from 'express';
import { DatabaseService } from '../services/DatabaseService';
import { asyncHandler } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import { receiptImageService } from '../services/ReceiptImageService';

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.'));
    }
  }
});

const router = Router();

/**
 * POST /api/inventory
 * Create a new inventory item
 */
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const { name, sku, unit, onHandQty, lowStockThreshold, category, unitCost } = req.body;
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
      id, restaurant_id, name, sku, unit, on_hand_qty, low_stock_threshold, category, unit_cost, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `, [
    itemId,
    restaurantId,
    name.trim(),
    sku?.trim() || null,
    unit.trim(),
    onHandQty ?? 0,
    lowStockThreshold ?? 10,
    category?.trim() || null,
    unitCost ? Number(unitCost) : 0
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
  const { name, sku, unit, onHandQty, lowStockThreshold, category, unitCost } = req.body;
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
  if (unitCost !== undefined) {
    updateFields.push('unit_cost = ?');
    updateValues.push(Number(unitCost));
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

/**
 * POST /api/inventory/analyze-receipt
 * Upload and analyze a receipt image to extract inventory items
 */
router.post('/analyze-receipt', upload.single('receipt'), asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: { message: 'Receipt image is required' }
    });
  }

  const db = DatabaseService.getInstance().getDatabase();
  const restaurantId = req.user?.restaurantId;

  if (!restaurantId) {
    return res.status(400).json({
      success: false,
      error: { message: 'Restaurant ID is required' }
    });
  }

  // Check if AI service is configured
  if (!receiptImageService.isConfigured()) {
    return res.status(503).json({
      success: false,
      error: { message: 'AI analysis service is not configured. Please set OPENAI_API_KEY.' }
    });
  }

  try {
    // Save the uploaded image
    const { path: filePath, url } = await receiptImageService.saveUploadedImage(
      req.file.buffer,
      req.file.originalname,
      restaurantId
    );

    // Analyze the receipt image
    const analysis = await receiptImageService.analyzeReceiptImage(filePath);

    // Try to save the analysis to the database (may fail if migration not applied)
    let analysisId = null;
    try {
      await db.run(`
        INSERT INTO receipt_analyses (
          id, restaurant_id, supplier_name, total_amount, currency,
          items, raw_text, image_url, confidence_score, analyzed_by,
          analyzed_at, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
      `, [
        analysis.id,
        restaurantId,
        analysis.supplierName || null,
        analysis.totalAmount || null,
        analysis.currency || 'USD',
        JSON.stringify(analysis.items),
        analysis.rawText || null,
        url,
        analysis.confidence,
        receiptImageService.getProvider(),
        req.user?.id || null
      ]);
      analysisId = analysis.id;
    } catch (dbError: any) {
      // Log but don't fail - the feature can work without persistence
      logger.warn('Could not save receipt analysis to database:', dbError.message);
    }

    // Get existing inventory for matching
    const existingInventory = await db.all(
      'SELECT * FROM inventory_items WHERE restaurant_id = ?',
      [restaurantId]
    );

    // Convert to inventory items
    const inventoryItems = receiptImageService.convertToInventoryItems(analysis, existingInventory);

    logger.info('Receipt analyzed successfully', {
      analysisId,
      supplierName: analysis.supplierName,
      itemCount: analysis.items.length,
      totalAmount: analysis.totalAmount
    });

    res.json({
      success: true,
      data: {
        analysis: { ...analysis, id: analysisId || analysis.id },
        inventoryItems,
        imageUrl: url,
        message: `Successfully analyzed receipt from ${analysis.supplierName || 'unknown supplier'} with ${analysis.items.length} items`
      }
    });
  } catch (error: any) {
    logger.error('Receipt analysis failed:', error);
    res.status(500).json({
      success: false,
      error: { message: `Analysis failed: ${error.message}` }
    });
  }
}));

/**
 * POST /api/inventory/create-from-receipt
 * Create inventory items directly from a receipt analysis result
 */
router.post('/create-from-receipt', asyncHandler(async (req: Request, res: Response) => {
  const { items, source, sourceAnalysisId } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      success: false,
      error: { message: 'Items array is required' }
    });
  }

  const db = DatabaseService.getInstance().getDatabase();
  const restaurantId = req.user?.restaurantId;

  if (!restaurantId) {
    return res.status(400).json({
      success: false,
      error: { message: 'Restaurant ID is required' }
    });
  }

  const createdItems: any[] = [];
  const skippedItems: any[] = [];
  const errors: string[] = [];

  for (const item of items) {
    try {
      const { name, quantity, unit, unitCost, category } = item;

      if (!name?.trim()) {
        skippedItems.push({ ...item, reason: 'Missing name' });
        continue;
      }

      // Check if item already exists
      const existingItem = await db.get(
        'SELECT * FROM inventory_items WHERE name LIKE ? AND restaurant_id = ?',
        [`%${name.trim()}%`, restaurantId]
      );

      let itemId: string;

      if (existingItem) {
        // Update existing item quantity
        const newQuantity = existingItem.on_hand_qty + (quantity || 1);
        await db.run(
          'UPDATE inventory_items SET on_hand_qty = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [newQuantity, existingItem.id]
        );

        await DatabaseService.getInstance().logAudit(
          restaurantId,
          req.user?.id || 'system',
          'receive_inventory',
          'inventory',
          existingItem.id,
          { name, previousQuantity: existingItem.on_hand_qty, received: quantity || 1, newQuantity, source }
        );

        createdItems.push({
          ...existingItem,
          action: 'updated',
          previousQuantity: existingItem.on_hand_qty,
          addedQuantity: quantity || 1,
          newQuantity
        });

        itemId = existingItem.id;
      } else {
        // Create new item
        itemId = uuidv4();

        await db.run(`
          INSERT INTO inventory_items (
            id, restaurant_id, name, unit, on_hand_qty, low_stock_threshold, category, unit_cost, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `, [
          itemId,
          restaurantId,
          name.trim(),
          (unit || 'each').trim(),
          quantity || 1,
          10, // default low stock threshold
          category?.trim() || null,
          unitCost ? Number(unitCost) : 0
        ]);

        const newItem = await db.get('SELECT * FROM inventory_items WHERE id = ?', [itemId]);

        await DatabaseService.getInstance().logAudit(
          restaurantId,
          req.user?.id || 'system',
          'create_inventory_item',
          'inventory',
          itemId,
          { name, quantity, unit, category, source }
        );

        createdItems.push({
          ...newItem,
          action: 'created',
          addedQuantity: quantity || 1
        });
      }

      // Track the link between inventory item and receipt analysis
      if (sourceAnalysisId) {
        try {
          await db.run(`
            INSERT INTO inventory_from_receipts (
              id, inventory_item_id, receipt_analysis_id, source_quantity, source_unit_cost, created_at
            ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          `, [
            uuidv4(),
            itemId,
            sourceAnalysisId,
            quantity || 1,
            unitCost || null
          ]);
        } catch (trackError: any) {
          // Log but don't fail the operation
          logger.warn('Could not track inventory from receipt:', trackError.message);
        }
      }
    } catch (itemError: any) {
      errors.push(`Failed to process "${item.name}": ${itemError.message}`);
    }
  }

  logger.info('Created inventory items from receipt', {
    created: createdItems.length,
    skipped: skippedItems.length,
    errors: errors.length
  });

  res.json({
    success: true,
    data: {
      created: createdItems,
      skipped: skippedItems,
      errors,
      summary: {
        total: items.length,
        created: createdItems.filter(i => i.action === 'created').length,
        updated: createdItems.filter(i => i.action === 'updated').length,
        skipped: skippedItems.length
      }
    }
  });
}));

/**
 * GET /api/inventory/analysis/:id
 * Get a specific receipt analysis result
 */
router.get('/analysis/:id', asyncHandler(async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const db = DatabaseService.getInstance().getDatabase();

  const analysis = await db.get('SELECT * FROM receipt_analyses WHERE id = ?', [id]);

  if (!analysis) {
    return res.status(404).json({
      success: false,
      error: { message: 'Receipt analysis not found' }
    });
  }

  // Parse the items JSON
  if (analysis.items && typeof analysis.items === 'string') {
    analysis.items = JSON.parse(analysis.items);
  }

  res.json({
    success: true,
    data: analysis
  });
}));

export default router;
