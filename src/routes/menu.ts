import { Router, Request, Response } from 'express';
import { DatabaseService } from '../services/DatabaseService';
import { asyncHandler, UnauthorizedError } from '../middleware/errorHandler';
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
// PUBLIC ORDERING ENDPOINTS
// ============================================================================

/**
 * GET /api/menu/public/:slug
 * Get menu for a restaurant by its slug (public)
 */
router.get('/public/:slug', asyncHandler(async (req: Request, res: Response) => {
  const { slug } = req.params;
  const db = DatabaseService.getInstance().getDatabase();

  const restaurant = await db.get('SELECT id, name, settings, logo_url, cover_image_url, address, phone, description FROM restaurants WHERE slug = ? AND is_active = TRUE', [slug]);
  if (!restaurant) {
    return res.status(404).json({ success: false, error: { message: 'Restaurant not found' } });
  }

  const items = await db.all(`
    SELECT mi.*, mc.name as category_name
    FROM menu_items mi
    LEFT JOIN menu_categories mc ON mi.category_id = mc.id
    WHERE mi.restaurant_id = ? AND mi.is_available = TRUE AND mc.is_active = TRUE
    ORDER BY mc.sort_order ASC, mi.name ASC
  `, [restaurant.id]);

  res.json({
    success: true,
    data: {
      restaurant: { 
        name: restaurant.name, 
        settings: JSON.parse(restaurant.settings || '{}'),
        logo_url: restaurant.logo_url,
        cover_image_url: restaurant.cover_image_url,
        address: JSON.parse(restaurant.address || '{}'),
        phone: restaurant.phone,
        description: restaurant.description
      },
      items
    }
  });
}));

/**
 * GET /api/menu/categories/all
 * Get all menu categories for a restaurant
 */
router.get('/categories/all', asyncHandler(async (req: Request, res: Response) => {
  const db = DatabaseService.getInstance().getDatabase();
  const restaurantId = req.user?.restaurantId;
  
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
    WHERE restaurant_id = ? AND is_active = TRUE
    ORDER BY sort_order ASC, name ASC
  `, [restaurantId]);

  res.json({
    success: true,
    data: categories
  });
}));

router.post('/categories', asyncHandler(async (req: Request, res: Response) => {
  const { name, description, sortOrder = 0 } = req.body;
  const db = DatabaseService.getInstance().getDatabase();
  const restaurantId = req.user?.restaurantId;

  if (!restaurantId) throw new UnauthorizedError('Restaurant ID missing');
  if (!name?.trim()) {
    return res.status(400).json({ success: false, error: { message: 'Category name is required' } });
  }

  const categoryId = uuidv4();
  await db.run(`
    INSERT INTO menu_categories (id, restaurant_id, name, description, sort_order, is_active)
    VALUES (?, ?, ?, ?, ?, TRUE)
  `, [categoryId, restaurantId, name.trim(), description?.trim() || null, sortOrder]);

  await DatabaseService.getInstance().logAudit(
    restaurantId!,
    req.user?.id || 'system',
    'create_category',
    'menu_category',
    categoryId,
    { name }
  );

  res.status(201).json({ success: true, data: { id: categoryId, name, description, sortOrder } });
}));

router.put('/categories/:id', asyncHandler(async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { name, description, sortOrder, isActive } = req.body;
  const db = DatabaseService.getInstance().getDatabase();
  const restaurantId = req.user?.restaurantId;
  if (!restaurantId) throw new UnauthorizedError();

  const updateFields: string[] = [];
  const updateValues: any[] = [];

  if (name !== undefined) { updateFields.push('name = ?'); updateValues.push(name.trim()); }
  if (description !== undefined) { updateFields.push('description = ?'); updateValues.push(description.trim()); }
  if (sortOrder !== undefined) { updateFields.push('sort_order = ?'); updateValues.push(sortOrder); }
  if (isActive !== undefined) { updateFields.push('is_active = ?'); updateValues.push(isActive ? 1 : 0); }

  if (updateFields.length > 0) {
    updateValues.push(id, restaurantId);
    await db.run(`UPDATE menu_categories SET ${updateFields.join(', ')} WHERE id = ? AND restaurant_id = ?`, updateValues);
  }

  await DatabaseService.getInstance().logAudit(
    restaurantId!,
    req.user?.id || 'system',
    'update_category',
    'menu_category',
    id,
    { name }
  );
  res.json({ success: true });
}));

router.delete('/categories/:id', asyncHandler(async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const db = DatabaseService.getInstance().getDatabase();
  const restaurantId = req.user?.restaurantId;
  if (!restaurantId) throw new UnauthorizedError();

  // Get category details before deleting for audit log
  const category = await db.get('SELECT name FROM menu_categories WHERE id = ? AND restaurant_id = ?', [id, restaurantId]);
  
  await db.run('DELETE FROM menu_categories WHERE id = ? AND restaurant_id = ?', [id, restaurantId]);
  await DatabaseService.getInstance().logAudit(
    restaurantId,
    req.user?.id || 'system',
    'delete_category',
    'menu_category',
    id,
    { categoryName: category?.name || 'Unknown' }
  );
  res.json({ success: true });
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
    sortOrder = 0,
    isAvailable = true
  } = req.body;

  const db = DatabaseService.getInstance().getDatabase();

  if (!name?.trim() || !price || !categoryId) {
    return res.status(400).json({
      success: false,
      error: { message: 'Name, price, and category are required' }
    });
  }

  const restaurantId = req.user?.restaurantId;
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
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    sortOrder,
    isAvailable ? 1 : 0
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
    restaurantId!,
    req.user?.id || 'system',
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
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
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
    req.user?.restaurantId!,
    req.user?.id || 'system',
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
  const restaurantId = req.user?.restaurantId;

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
  const restaurantId = req.user?.restaurantId;

  let query = `
    SELECT mi.*, mc.name as category_name
    FROM menu_items mi
    LEFT JOIN menu_categories mc ON mi.category_id = mc.id
  `;
  const params: any[] = [];
  const conditions: string[] = [];

  if (restaurantId) {
    conditions.push('mi.restaurant_id = ?');
    params.push(restaurantId);
  }

  if (q) {
    conditions.push('mi.name LIKE ?');
    params.push(`%${q}%`);
  }

  if (category) {
    conditions.push('(mc.name LIKE ? OR mc.id = ?)');
    params.push(`%${category}%`, category);
  }

  if (available !== undefined) {
    conditions.push('mi.is_available = ?');
    params.push(available === 'true' ? 1 : 0);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY mi.name';

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
    req.user?.restaurantId!,
    req.user?.id || 'system',
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
    req.user?.restaurantId!,
    req.user?.id || 'system',
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
  const restaurantId = req.user?.restaurantId;

  const categories = await db.all(`
    SELECT
      mc.id,
      mc.name,
      mc.description,
      mc.sort_order,
      mc.is_active,
      COUNT(mi.id) as total_items,
      COUNT(CASE WHEN mi.is_available = 1 THEN 1 END) as available_items,
      COUNT(CASE WHEN mi.is_available = 0 THEN 1 END) as unavailable_items
    FROM menu_categories mc
    LEFT JOIN menu_items mi ON mc.id = mi.category_id
    WHERE mc.restaurant_id = ?
    GROUP BY mc.id
    ORDER BY mc.sort_order ASC, mc.name ASC
  `, [restaurantId]);

  res.json({
    success: true,
    data: categories
  });
}));

// ============================================================================
// MODIFIERS MANAGEMENT
// ============================================================================

/**
 * GET /api/menu/modifier-groups
 * Get all modifier groups for a restaurant
 */
router.get('/modifier-groups', asyncHandler(async (req: Request, res: Response) => {
  const db = DatabaseService.getInstance().getDatabase();
  const restaurantId = req.user?.restaurantId;

  const groups = await db.all(`
    SELECT 
      mg.*,
      COUNT(mo.id) as option_count
    FROM modifier_groups mg
    LEFT JOIN modifier_options mo ON mg.id = mo.modifier_group_id AND mo.is_available = 1
    WHERE mg.restaurant_id = ? AND mg.is_active = TRUE
    GROUP BY mg.id
    ORDER BY mg.sort_order ASC, mg.name ASC
  `, [restaurantId]);

  res.json({
    success: true,
    data: groups
  });
}));

/**
 * POST /api/menu/modifier-groups
 * Create a new modifier group
 */
router.post('/modifier-groups', asyncHandler(async (req: Request, res: Response) => {
  const { name, description, minSelections = 0, maxSelections = 1, isRequired = false } = req.body;
  const db = DatabaseService.getInstance().getDatabase();

  if (!name?.trim()) {
    return res.status(400).json({
      success: false,
      error: { message: 'Modifier group name is required' }
    });
  }

  const restaurantId = req.user?.restaurantId;
  const groupId = uuidv4();

  await db.run(`
    INSERT INTO modifier_groups (id, restaurant_id, name, description, min_selections, max_selections, is_required)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [groupId, restaurantId, name.trim(), description?.trim() || null, minSelections, maxSelections, isRequired]);

  const newGroup = await db.get(`
    SELECT * FROM modifier_groups WHERE id = ?
  `, [groupId]);

  await DatabaseService.getInstance().logAudit(
    restaurantId!,
    req.user?.id || 'system',
    'create_modifier_group',
    'modifier_group',
    groupId,
    { name, description, minSelections, maxSelections, isRequired }
  );

  logger.info(`Modifier group created: ${name}`);

  res.status(201).json({
    success: true,
    data: newGroup
  });
}));

/**
 * GET /api/menu/modifier-groups/:id/options
 * Get options for a modifier group
 */
router.get('/modifier-groups/:id/options', asyncHandler(async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const db = DatabaseService.getInstance().getDatabase();

  const options = await db.all(`
    SELECT * FROM modifier_options 
    WHERE modifier_group_id = ? AND is_available = 1
    ORDER BY sort_order ASC, name ASC
  `, [id]);

  res.json({
    success: true,
    data: options
  });
}));

/**
 * POST /api/menu/modifier-groups/:id/options
 * Add option to a modifier group
 */
router.post('/modifier-groups/:id/options', asyncHandler(async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { name, description, priceModifier = 0 } = req.body;
  const db = DatabaseService.getInstance().getDatabase();

  if (!name?.trim()) {
    return res.status(400).json({
      success: false,
      error: { message: 'Option name is required' }
    });
  }

  const optionId = uuidv4();

  await db.run(`
    INSERT INTO modifier_options (id, modifier_group_id, name, description, price_modifier)
    VALUES (?, ?, ?, ?, ?)
  `, [optionId, id, name.trim(), description?.trim() || null, parseFloat(priceModifier)]);

  const newOption = await db.get(`
    SELECT * FROM modifier_options WHERE id = ?
  `, [optionId]);

  await DatabaseService.getInstance().logAudit(
    req.user?.restaurantId!,
    req.user?.id || 'system',
    'create_modifier_option',
    'modifier_option',
    optionId,
    { modifierGroupId: id, name, description, priceModifier }
  );

  res.status(201).json({
    success: true,
    data: newOption
  });
}));

/**
 * GET /api/menu/items/:id/modifiers
 * Get modifiers assigned to a menu item
 */
router.get('/items/:id/modifiers', asyncHandler(async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const db = DatabaseService.getInstance().getDatabase();

  const modifiers = await db.all(`
    SELECT 
      mg.*,
      mim.sort_order as assignment_order,
      (
        SELECT json_group_array(
          json_object(
            'id', mo.id,
            'name', mo.name,
            'description', mo.description,
            'price_modifier', mo.price_modifier,
            'sort_order', mo.sort_order
          )
        )
        FROM modifier_options mo 
        WHERE mo.modifier_group_id = mg.id AND mo.is_available = 1
        ORDER BY mo.sort_order ASC, mo.name ASC
      ) as options
    FROM modifier_groups mg
    INNER JOIN menu_item_modifiers mim ON mg.id = mim.modifier_group_id
    WHERE mim.menu_item_id = ? AND mg.is_active = TRUE
    ORDER BY mim.sort_order ASC, mg.sort_order ASC
  `, [id]);

  // Parse JSON options for each modifier group
  const formattedModifiers = modifiers.map((mod: any) => ({
    ...mod,
    options: JSON.parse(mod.options || '[]')
  }));

  res.json({
    success: true,
    data: formattedModifiers
  });
}));

/**
 * POST /api/menu/items/:id/modifiers
 * Assign modifier groups to a menu item
 */
router.post('/items/:id/modifiers', asyncHandler(async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { modifierGroupIds } = req.body;
  const db = DatabaseService.getInstance().getDatabase();

  if (!Array.isArray(modifierGroupIds)) {
    return res.status(400).json({
      success: false,
      error: { message: 'modifierGroupIds must be an array' }
    });
  }

  // Start transaction
  await db.run('BEGIN TRANSACTION');

  try {
    // Remove existing assignments
    await db.run('DELETE FROM menu_item_modifiers WHERE menu_item_id = ?', [id]);

    // Add new assignments
    for (let i = 0; i < modifierGroupIds.length; i++) {
      await db.run(`
        INSERT INTO menu_item_modifiers (id, menu_item_id, modifier_group_id, sort_order)
        VALUES (?, ?, ?, ?)
      `, [uuidv4(), id, modifierGroupIds[i], i]);
    }

    await db.run('COMMIT');

    await DatabaseService.getInstance().logAudit(
      req.user?.restaurantId!,
      req.user?.id || 'system',
      'update_item_modifiers',
      'menu_item',
      id,
      { modifierGroupIds }
    );

    res.json({
      success: true,
      message: 'Menu item modifiers updated successfully'
    });

  } catch (error) {
    await db.run('ROLLBACK');
    throw error;
  }
}));

// ============================================================================
// MENU BULK IMPORT
// ============================================================================

/**
 * POST /api/menu/import
 * Import menu from Excel/CSV file
 */
router.post('/import', upload.single('file'), asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: { message: 'File is required' }
    });
  }

  const db = DatabaseService.getInstance().getDatabase();
  const restaurantId = req.user?.restaurantId;
  const importId = uuidv4();
  const fileType = req.file.mimetype.includes('excel') || req.file.originalname.endsWith('.xlsx') ? 'excel' : 'csv';

  // Create import record
  await db.run(`
    INSERT INTO menu_imports (id, restaurant_id, filename, file_type, status, uploaded_by)
    VALUES (?, ?, ?, ?, 'processing', ?)
  `, [importId, restaurantId, req.file.originalname, fileType, 'system']);

  try {
    let data: any[] = [];
    
    if (fileType === 'excel') {
      // Handle Excel files using xlsx library
      const XLSX = require('xlsx');
      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      data = XLSX.utils.sheet_to_json(worksheet);
    } else {
      // Handle CSV files
      const csv = require('csv-parser');
      const { Readable } = require('stream');
      
      await new Promise((resolve, reject) => {
        const stream = Readable.from(req.file!.buffer);
        stream
          .pipe(csv())
          .on('data', (row: any) => data.push(row))
          .on('end', resolve)
          .on('error', reject);
      });
    }

    // Process the data
    let successCount = 0;
    let errorCount = 0;
    const errors: any[] = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      try {
        // Validate required fields
        if (!row.name || !row.price || !row.category) {
          throw new Error('Missing required fields: name, price, category');
        }

        // Find or create category
        let category = await db.get(
          'SELECT id FROM menu_categories WHERE name = ? AND restaurant_id = ?',
          [row.category, restaurantId]
        );

        if (!category) {
          const categoryId = uuidv4();
          await db.run(`
            INSERT INTO menu_categories (id, restaurant_id, name, is_active)
            VALUES (?, ?, ?, 1)
          `, [categoryId, restaurantId, row.category]);
          category = { id: categoryId };
        }

        // Create menu item
        const itemId = uuidv4();
        await db.run(`
          INSERT INTO menu_items (
            id, restaurant_id, category_id, name, description, price, cost,
            preparation_time, is_available, sort_order
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
        `, [
          itemId,
          restaurantId,
          category.id,
          row.name.trim(),
          row.description?.trim() || null,
          parseFloat(row.price),
          row.cost ? parseFloat(row.cost) : null,
          row.preparation_time ? parseInt(row.preparation_time) : 0,
          i
        ]);

        successCount++;
      } catch (error: any) {
        errorCount++;
        errors.push({
          row: i + 1,
          data: row,
          error: error.message
        });
      }
    }

    // Update import record
    await db.run(`
      UPDATE menu_imports 
      SET status = 'completed', total_rows = ?, processed_rows = ?, 
          success_count = ?, error_count = ?, errors = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [data.length, data.length, successCount, errorCount, JSON.stringify(errors), importId]);

    await DatabaseService.getInstance().logAudit(
      restaurantId!,
      req.user?.id || 'system',
      'import_menu',
      'menu_import',
      importId,
      { filename: req.file.originalname, totalRows: data.length, successCount, errorCount }
    );

    logger.info(`Menu import completed: ${successCount} success, ${errorCount} errors`);

    res.json({
      success: true,
      data: {
        importId,
        totalRows: data.length,
        successCount,
        errorCount,
        errors: errors.slice(0, 10) // Return first 10 errors
      }
    });

  } catch (error: any) {
    // Update import record with error
    await db.run(`
      UPDATE menu_imports 
      SET status = 'failed', errors = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [JSON.stringify([{ error: error.message }]), importId]);

    logger.error('Menu import failed:', error);
    
    res.status(500).json({
      success: false,
      error: { message: 'Import failed: ' + error.message }
    });
  }
}));

/**
 * GET /api/menu/imports
 * Get menu import history
 */
router.get('/imports', asyncHandler(async (req: Request, res: Response) => {
  const db = DatabaseService.getInstance().getDatabase();
  const restaurantId = req.user?.restaurantId;

  const imports = await db.all(`
    SELECT 
      id, filename, file_type, status, total_rows, processed_rows,
      success_count, error_count, created_at, updated_at
    FROM menu_imports
    WHERE restaurant_id = ?
    ORDER BY created_at DESC
    LIMIT 50
  `, [restaurantId]);

  res.json({
    success: true,
    data: imports
  });
}));

export default router;