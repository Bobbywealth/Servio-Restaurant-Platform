import { Router, Request, Response } from 'express';
import { DatabaseService } from '../services/DatabaseService';
import { asyncHandler } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import multer from 'multer';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs/promises';

const router = Router();

// Configure multer for image uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Ensure uploads directory exists
const ensureUploadsDir = async () => {
  const uploadsPath = path.join(process.cwd(), 'uploads', 'menu');
  try {
    await fs.access(uploadsPath);
  } catch {
    await fs.mkdir(uploadsPath, { recursive: true });
  }
  return uploadsPath;
};

// ============================================================================
// MENU CATEGORIES MANAGEMENT
// ============================================================================

/**
 * GET /api/menu/categories/all
 * Get all menu categories for a restaurant
 */
router.get('/categories/all', asyncHandler(async (req: Request, res: Response) => {
  const db = DatabaseService.getInstance().getDatabase();
  
  // For now, use a default restaurant ID (in production, get from auth)
  const restaurantId = '00000000-0000-0000-0000-000000000001';
  
  const categories = await db.all(`
    SELECT 
      id,
      name,
      description,
      sort_order,
      is_active,
      created_at,
      (SELECT COUNT(*) FROM menu_items WHERE category_id = menu_categories.id) as item_count
    FROM menu_categories 
    WHERE restaurant_id = ? AND is_active = 1
    ORDER BY sort_order ASC, name ASC
  `, [restaurantId]);

  res.json({
    success: true,
    data: categories
  });
}));

/**
 * POST /api/menu/categories
 * Create a new menu category
 */
router.post('/categories', asyncHandler(async (req: Request, res: Response) => {
  const { name, description, sortOrder = 0 } = req.body;
  const db = DatabaseService.getInstance().getDatabase();
  
  if (!name?.trim()) {
    return res.status(400).json({
      success: false,
      error: { message: 'Category name is required' }
    });
  }

  const restaurantId = '00000000-0000-0000-0000-000000000001';
  const categoryId = uuidv4();

  await db.run(`
    INSERT INTO menu_categories (id, restaurant_id, name, description, sort_order, is_active)
    VALUES (?, ?, ?, ?, ?, 1)
  `, [categoryId, restaurantId, name.trim(), description?.trim() || null, sortOrder]);

  const newCategory = await db.get(`
    SELECT * FROM menu_categories WHERE id = ?
  `, [categoryId]);

  await DatabaseService.getInstance().logAudit(
    'system', // TODO: get from auth
    'create_category',
    'menu_category',
    categoryId,
    { name, description, sortOrder }
  );

  logger.info(`Menu category created: ${name}`);

  res.status(201).json({
    success: true,
    data: newCategory
  });
}));

/**
 * PUT /api/menu/categories/:id
 * Update a menu category
 */
router.put('/categories/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, description, sortOrder, isActive } = req.body;
  const db = DatabaseService.getInstance().getDatabase();

  const existingCategory = await db.get('SELECT * FROM menu_categories WHERE id = ?', [id]);
  if (!existingCategory) {
    return res.status(404).json({
      success: false,
      error: { message: 'Category not found' }
    });
  }

  const updateFields: string[] = [];
  const updateValues: any[] = [];

  if (name !== undefined) {
    updateFields.push('name = ?');
    updateValues.push(name.trim());
  }
  if (description !== undefined) {
    updateFields.push('description = ?');
    updateValues.push(description?.trim() || null);
  }
  if (sortOrder !== undefined) {
    updateFields.push('sort_order = ?');
    updateValues.push(sortOrder);
  }
  if (isActive !== undefined) {
    updateFields.push('is_active = ?');
    updateValues.push(isActive ? 1 : 0);
  }

  if (updateFields.length > 0) {
    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateValues.push(id);

    await db.run(`
      UPDATE menu_categories 
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `, updateValues);
  }

  const updatedCategory = await db.get('SELECT * FROM menu_categories WHERE id = ?', [id]);

  await DatabaseService.getInstance().logAudit(
    'system',
    'update_category',
    'menu_category',
    id,
    { name, description, sortOrder, isActive }
  );

  res.json({
    success: true,
    data: updatedCategory
  });
}));

/**
 * DELETE /api/menu/categories/:id
 * Delete a menu category (soft delete)
 */
router.delete('/categories/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const db = DatabaseService.getInstance().getDatabase();

  const category = await db.get('SELECT * FROM menu_categories WHERE id = ?', [id]);
  if (!category) {
    return res.status(404).json({
      success: false,
      error: { message: 'Category not found' }
    });
  }

  // Check if category has items
  const itemCount = await db.get(
    'SELECT COUNT(*) as count FROM menu_items WHERE category_id = ?',
    [id]
  );

  if (itemCount.count > 0) {
    return res.status(400).json({
      success: false,
      error: { message: 'Cannot delete category with existing menu items' }
    });
  }

  await db.run(
    'UPDATE menu_categories SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [id]
  );

  await DatabaseService.getInstance().logAudit(
    'system',
    'delete_category',
    'menu_category',
    id,
    { categoryName: category.name }
  );

  res.json({
    success: true,
    message: 'Category deleted successfully'
  });
}));

// ============================================================================
// ENHANCED MENU ITEMS MANAGEMENT
// ============================================================================

/**
 * POST /api/menu/items
 * Create a new menu item with image upload
 */
router.post('/items', upload.array('images', 5), asyncHandler(async (req: Request, res: Response) => {
  const {
    name,
    description,
    price,
    cost,
    categoryId,
    allergens,
    preparationTime,
    nutritionalInfo,
    sortOrder = 0
  } = req.body;

  const db = DatabaseService.getInstance().getDatabase();

  if (!name?.trim() || !price || !categoryId) {
    return res.status(400).json({
      success: false,
      error: { message: 'Name, price, and category are required' }
    });
  }

  const restaurantId = '00000000-0000-0000-0000-000000000001';
  const itemId = uuidv4();
  const uploadsPath = await ensureUploadsDir();

  // Process uploaded images
  const images: string[] = [];
  if (req.files && Array.isArray(req.files)) {
    for (const file of req.files) {
      const fileName = `${itemId}-${uuidv4()}.webp`;
      const filePath = path.join(uploadsPath, fileName);
      
      // Resize and optimize image
      await sharp(file.buffer)
        .resize(800, 600, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toFile(filePath);
      
      images.push(`/uploads/menu/${fileName}`);
    }
  }

  await db.run(`
    INSERT INTO menu_items (
      id, restaurant_id, category_id, name, description, price, cost,
      images, allergens, preparation_time, nutritional_info, sort_order, is_available
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `, [
    itemId,
    restaurantId,
    categoryId,
    name.trim(),
    description?.trim() || null,
    parseFloat(price),
    cost ? parseFloat(cost) : null,
    JSON.stringify(images),
    allergens ? JSON.stringify(allergens) : '[]',
    preparationTime || 0,
    nutritionalInfo ? JSON.stringify(nutritionalInfo) : null,
    sortOrder
  ]);

  const newItem = await db.get(`
    SELECT mi.*, mc.name as category_name
    FROM menu_items mi
    LEFT JOIN menu_categories mc ON mi.category_id = mc.id
    WHERE mi.id = ?
  `, [itemId]);

  // Parse JSON fields for response
  const formattedItem = {
    ...newItem,
    images: JSON.parse(newItem.images || '[]'),
    allergens: JSON.parse(newItem.allergens || '[]'),
    nutritional_info: newItem.nutritional_info ? JSON.parse(newItem.nutritional_info) : null,
    is_available: Boolean(newItem.is_available)
  };

  await DatabaseService.getInstance().logAudit(
    'system',
    'create_menu_item',
    'menu_item',
    itemId,
    { name, price, categoryId }
  );

  logger.info(`Menu item created: ${name} ($${price})`);

  res.status(201).json({
    success: true,
    data: formattedItem
  });
}));

/**
 * PUT /api/menu/items/:id
 * Update a menu item
 */
router.put('/items/:id', upload.array('images', 5), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const {
    name,
    description,
    price,
    cost,
    categoryId,
    allergens,
    preparationTime,
    nutritionalInfo,
    sortOrder,
    isAvailable,
    existingImages
  } = req.body;

  const db = DatabaseService.getInstance().getDatabase();

  const existingItem = await db.get('SELECT * FROM menu_items WHERE id = ?', [id]);
  if (!existingItem) {
    return res.status(404).json({
      success: false,
      error: { message: 'Menu item not found' }
    });
  }

  // Handle image updates
  let images = existingImages ? JSON.parse(existingImages) : [];
  
  if (req.files && Array.isArray(req.files)) {
    const uploadsPath = await ensureUploadsDir();
    
    for (const file of req.files) {
      const fileName = `${id}-${uuidv4()}.webp`;
      const filePath = path.join(uploadsPath, fileName);
      
      await sharp(file.buffer)
        .resize(800, 600, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toFile(filePath);
      
      images.push(`/uploads/menu/${fileName}`);
    }
  }

  const updateFields: string[] = [];
  const updateValues: any[] = [];

  if (name !== undefined) {
    updateFields.push('name = ?');
    updateValues.push(name.trim());
  }
  if (description !== undefined) {
    updateFields.push('description = ?');
    updateValues.push(description?.trim() || null);
  }
  if (price !== undefined) {
    updateFields.push('price = ?');
    updateValues.push(parseFloat(price));
  }
  if (cost !== undefined) {
    updateFields.push('cost = ?');
    updateValues.push(cost ? parseFloat(cost) : null);
  }
  if (categoryId !== undefined) {
    updateFields.push('category_id = ?');
    updateValues.push(categoryId);
  }
  if (allergens !== undefined) {
    updateFields.push('allergens = ?');
    updateValues.push(JSON.stringify(allergens));
  }
  if (preparationTime !== undefined) {
    updateFields.push('preparation_time = ?');
    updateValues.push(preparationTime);
  }
  if (nutritionalInfo !== undefined) {
    updateFields.push('nutritional_info = ?');
    updateValues.push(nutritionalInfo ? JSON.stringify(nutritionalInfo) : null);
  }
  if (sortOrder !== undefined) {
    updateFields.push('sort_order = ?');
    updateValues.push(sortOrder);
  }
  if (isAvailable !== undefined) {
    updateFields.push('is_available = ?');
    updateValues.push(isAvailable ? 1 : 0);
  }

  updateFields.push('images = ?', 'updated_at = CURRENT_TIMESTAMP');
  updateValues.push(JSON.stringify(images), id);

  await db.run(`
    UPDATE menu_items 
    SET ${updateFields.join(', ')}
    WHERE id = ?
  `, updateValues);

  const updatedItem = await db.get(`
    SELECT mi.*, mc.name as category_name
    FROM menu_items mi
    LEFT JOIN menu_categories mc ON mi.category_id = mc.id
    WHERE mi.id = ?
  `, [id]);

  const formattedItem = {
    ...updatedItem,
    images: JSON.parse(updatedItem.images || '[]'),
    allergens: JSON.parse(updatedItem.allergens || '[]'),
    nutritional_info: updatedItem.nutritional_info ? JSON.parse(updatedItem.nutritional_info) : null,
    is_available: Boolean(updatedItem.is_available)
  };

  await DatabaseService.getInstance().logAudit(
    'system',
    'update_menu_item',
    'menu_item',
    id,
    { name, price, categoryId }
  );

  res.json({
    success: true,
    data: formattedItem
  });
}));

/**
 * GET /api/menu/items/full
 * Get all menu items with full details including categories
 */
router.get('/items/full', asyncHandler(async (req: Request, res: Response) => {
  const db = DatabaseService.getInstance().getDatabase();
  const restaurantId = '00000000-0000-0000-0000-000000000001';

  const items = await db.all(`
    SELECT 
      mi.*,
      mc.name as category_name,
      mc.sort_order as category_sort_order
    FROM menu_items mi
    LEFT JOIN menu_categories mc ON mi.category_id = mc.id
    WHERE mi.restaurant_id = ?
    ORDER BY mc.sort_order ASC, mi.sort_order ASC, mi.name ASC
  `, [restaurantId]);

  const formattedItems = items.map((item: any) => ({
    ...item,
    images: JSON.parse(item.images || '[]'),
    allergens: JSON.parse(item.allergens || '[]'),
    nutritional_info: item.nutritional_info ? JSON.parse(item.nutritional_info) : null,
    is_available: Boolean(item.is_available)
  }));

  // Group by categories
  const categorizedItems = formattedItems.reduce((acc: any, item: any) => {
    const categoryName = item.category_name || 'Uncategorized';
    if (!acc[categoryName]) {
      acc[categoryName] = {
        category_id: item.category_id,
        category_name: categoryName,
        category_sort_order: item.category_sort_order || 999,
        items: []
      };
    }
    acc[categoryName].items.push(item);
    return acc;
  }, {});

  res.json({
    success: true,
    data: {
      categories: Object.values(categorizedItems).sort((a: any, b: any) => 
        a.category_sort_order - b.category_sort_order
      )
    }
  });
}));

/**
 * GET /api/menu/items/search
 * Search menu items
 */
router.get('/items/search', asyncHandler(async (req: Request, res: Response) => {
  const { q, category, available } = req.query;
  const db = DatabaseService.getInstance().getDatabase();

  let query = 'SELECT * FROM menu_items';
  const params: any[] = [];
  const conditions: string[] = [];

  if (q) {
    conditions.push('name LIKE ?');
    params.push(`%${q}%`);
  }

  if (category) {
    conditions.push('category = ?');
    params.push(category);
  }

  if (available !== undefined) {
    conditions.push('is_available = ?');
    params.push(available === 'true' ? 1 : 0);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY name';

  const items = await db.all(query, params);

  // Parse channel availability JSON
  const formattedItems = items.map((item: any) => ({
    ...item,
    channel_availability: JSON.parse(item.channel_availability || '{}'),
    is_available: Boolean(item.is_available)
  }));

  res.json({
    success: true,
    data: formattedItems
  });
}));

/**
 * POST /api/menu/items/set-unavailable
 * 86 (make unavailable) menu items
 */
router.post('/items/set-unavailable', asyncHandler(async (req: Request, res: Response) => {
  const { itemId, channels = ['all'], userId } = req.body;

  if (!itemId) {
    return res.status(400).json({
      success: false,
      error: { message: 'itemId is required' }
    });
  }

  const db = DatabaseService.getInstance().getDatabase();

  const item = await db.get('SELECT * FROM menu_items WHERE id = ?', [itemId]);
  if (!item) {
    return res.status(404).json({
      success: false,
      error: { message: 'Menu item not found' }
    });
  }

  // Update availability
  await db.run(
    'UPDATE menu_items SET is_available = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [itemId]
  );

  // Simulate channel sync (in real app, this would call delivery platform APIs)
  const syncResults = channels.includes('all')
    ? ['doordash', 'ubereats', 'grubhub']
    : channels;

  const syncJobs = [];
  for (const channel of syncResults) {
    const jobId = `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    await db.run(`
      INSERT INTO sync_jobs (id, type, status, channels, details)
      VALUES (?, ?, ?, ?, ?)
    `, [
      jobId,
      'set_unavailable',
      'completed', // In real app, this would be 'pending' initially
      JSON.stringify([channel]),
      JSON.stringify({ itemId, itemName: item.name, action: 'set_unavailable' })
    ]);

    syncJobs.push({ channel, jobId, status: 'completed' });
  }

  await DatabaseService.getInstance().logAudit(
    userId || 'system',
    'set_item_unavailable',
    'menu_item',
    itemId,
    { itemName: item.name, channels: syncResults }
  );

  logger.info(`Item 86'd: ${item.name} on channels: ${syncResults.join(', ')}`);

  res.json({
    success: true,
    data: {
      itemId,
      itemName: item.name,
      action: 'set_unavailable',
      channels: syncResults,
      syncJobs
    }
  });
}));

/**
 * POST /api/menu/items/set-available
 * Restore menu item availability
 */
router.post('/items/set-available', asyncHandler(async (req: Request, res: Response) => {
  const { itemId, channels = ['all'], userId } = req.body;

  if (!itemId) {
    return res.status(400).json({
      success: false,
      error: { message: 'itemId is required' }
    });
  }

  const db = DatabaseService.getInstance().getDatabase();

  const item = await db.get('SELECT * FROM menu_items WHERE id = ?', [itemId]);
  if (!item) {
    return res.status(404).json({
      success: false,
      error: { message: 'Menu item not found' }
    });
  }

  // Update availability
  await db.run(
    'UPDATE menu_items SET is_available = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [itemId]
  );

  // Simulate channel sync
  const syncResults = channels.includes('all')
    ? ['doordash', 'ubereats', 'grubhub']
    : channels;

  const syncJobs = [];
  for (const channel of syncResults) {
    const jobId = `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    await db.run(`
      INSERT INTO sync_jobs (id, type, status, channels, details)
      VALUES (?, ?, ?, ?, ?)
    `, [
      jobId,
      'set_available',
      'completed',
      JSON.stringify([channel]),
      JSON.stringify({ itemId, itemName: item.name, action: 'set_available' })
    ]);

    syncJobs.push({ channel, jobId, status: 'completed' });
  }

  await DatabaseService.getInstance().logAudit(
    userId || 'system',
    'set_item_available',
    'menu_item',
    itemId,
    { itemName: item.name, channels: syncResults }
  );

  logger.info(`Item restored: ${item.name} on channels: ${syncResults.join(', ')}`);

  res.json({
    success: true,
    data: {
      itemId,
      itemName: item.name,
      action: 'set_available',
      channels: syncResults,
      syncJobs
    }
  });
}));

/**
 * GET /api/menu/unavailable
 * Get currently unavailable (86'd) items
 */
router.get('/unavailable', asyncHandler(async (req: Request, res: Response) => {
  const db = DatabaseService.getInstance().getDatabase();

  const unavailableItems = await db.all(`
    SELECT *, updated_at as unavailable_since
    FROM menu_items
    WHERE is_available = 0
    ORDER BY updated_at DESC
  `);

  const formattedItems = unavailableItems.map((item: any) => ({
    ...item,
    channel_availability: JSON.parse(item.channel_availability || '{}'),
    is_available: Boolean(item.is_available)
  }));

  res.json({
    success: true,
    data: formattedItems
  });
}));

/**
 * GET /api/menu/categories
 * Get menu categories
 */
router.get('/categories', asyncHandler(async (req: Request, res: Response) => {
  const db = DatabaseService.getInstance().getDatabase();

  const categories = await db.all(`
    SELECT
      category,
      COUNT(*) as total_items,
      COUNT(CASE WHEN is_available = 1 THEN 1 END) as available_items,
      COUNT(CASE WHEN is_available = 0 THEN 1 END) as unavailable_items
    FROM menu_items
    GROUP BY category
    ORDER BY category
  `);

  res.json({
    success: true,
    data: categories
  });
}));

export default router;