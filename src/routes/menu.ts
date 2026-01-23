import { Router, Request, Response } from 'express';
import { DatabaseService } from '../services/DatabaseService';
import { asyncHandler, UnauthorizedError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { ensureUploadsDir } from '../utils/uploads';
import multer from 'multer';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import OpenAI from 'openai';
import mammoth from 'mammoth';

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

// Configure multer for menu imports (CSV/XLSX/PDF/DOCX)
const importUpload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    const allowedExts = ['.csv', '.xls', '.xlsx', '.pdf', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(file.mimetype) || allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type. Use CSV, XLS/XLSX, PDF, or DOCX.'));
    }
  }
});

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
const pdfParse = require('pdf-parse');

type ParsedMenuRow = {
  name: string;
  description?: string | null;
  price: number;
  category?: string | null;
  cost?: number | null;
  preparation_time?: number | null;
};

function parsePrice(value: string): number | null {
  const cleaned = value.replace(/[^0-9.]/g, '');
  const price = Number.parseFloat(cleaned);
  return Number.isFinite(price) ? price : null;
}

function extractMenuRowsFromText(text: string): ParsedMenuRow[] {
  const rows: ParsedMenuRow[] = [];
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  let currentCategory: string | null = null;
  for (const line of lines) {
    const priceMatch = line.match(/\$?\d+(?:\.\d{1,2})?/);
    if (!priceMatch) {
      if (line.length <= 40) {
        currentCategory = line;
      }
      continue;
    }

    const price = parsePrice(priceMatch[0]);
    if (price === null) continue;
    const namePart = line.slice(0, priceMatch.index).replace(/[-–|]+$/g, '').trim();
    const descriptionPart = line.slice((priceMatch.index || 0) + priceMatch[0].length).trim();

    rows.push({
      name: namePart || line,
      description: descriptionPart || null,
      price,
      category: currentCategory || null
    });
  }

  return rows;
}

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
    WHERE mi.restaurant_id = ?
      AND mi.is_available = TRUE
      AND mc.is_active = TRUE
      AND COALESCE(mc.is_hidden, FALSE) = FALSE
    ORDER BY mc.sort_order ASC, mi.name ASC
  `, [restaurant.id]);

  // Load modifier groups/options and attach to items
  const itemIds = items.map((i: any) => i.id);
  const categoryIds = Array.from(new Set(items.map((i: any) => i.category_id).filter(Boolean)));
  let optionsByGroup: Record<string, any[]> = {};
  let groupsById: Record<string, any> = {};
  let itemGroupsMap: Record<string, any[]> = {};
  let categoryGroupsMap: Record<string, any[]> = {};
  let sizesByItem: Record<string, any[]> = {};

  if (itemIds.length) {
    const itemIdPlaceholders = itemIds.map(() => '?').join(',');
    const modifierGroups = await db.all(`
      SELECT *
      FROM modifier_groups
      WHERE restaurant_id = ?
        AND is_active = TRUE
        AND deleted_at IS NULL
      ORDER BY display_order ASC, name ASC
    `, [restaurant.id]);

    if (modifierGroups.length) {
      groupsById = modifierGroups.reduce((acc: Record<string, any>, g: any) => {
        acc[g.id] = g;
        return acc;
      }, {});

      const modifierOptions = await db.all(`
        SELECT *
        FROM modifier_options
        WHERE restaurant_id = ?
          AND is_active = TRUE
          AND deleted_at IS NULL
        ORDER BY display_order ASC, name ASC
      `, [restaurant.id]);

      optionsByGroup = modifierOptions.reduce((acc: Record<string, any[]>, opt: any) => {
        if (!acc[opt.group_id]) acc[opt.group_id] = [];
        acc[opt.group_id].push(opt);
        return acc;
      }, {});

      const itemModifierRows = await db.all(`
        SELECT *
        FROM item_modifier_groups
        WHERE item_id IN (${itemIdPlaceholders})
          AND deleted_at IS NULL
        ORDER BY display_order ASC
      `, itemIds);

      itemGroupsMap = itemModifierRows.reduce((acc: Record<string, any[]>, row: any) => {
        const baseGroup = groupsById[row.group_id];
        if (!baseGroup) return acc;
        const effectiveMin = row.override_min !== null && row.override_min !== undefined ? row.override_min : baseGroup.min_selections;
        const effectiveMax = row.override_max !== null && row.override_max !== undefined ? row.override_max : baseGroup.max_selections;
        const effectiveRequired = row.override_required !== null && row.override_required !== undefined ? row.override_required : baseGroup.is_required;

        const enriched = {
          id: baseGroup.id,
          name: baseGroup.name,
          description: baseGroup.description,
          selectionType: baseGroup.selection_type,
          minSelections: effectiveMin,
          maxSelections: effectiveMax,
          isRequired: effectiveRequired,
          displayOrder: row.display_order ?? baseGroup.display_order ?? 0,
          assignmentLevel: 'item',
          options: (optionsByGroup[baseGroup.id] || []).map((opt: any) => ({
            id: opt.id,
            name: opt.name,
            description: opt.description ?? null,
            priceDelta: Number(opt.price_delta || 0),
            isActive: Boolean(opt.is_active),
            isSoldOut: Boolean(opt.is_sold_out),
            isPreselected: Boolean(opt.is_preselected),
            displayOrder: opt.display_order ?? 0
          }))
        };

        if (!acc[row.item_id]) acc[row.item_id] = [];
        acc[row.item_id].push(enriched);
        return acc;
      }, {});
    }

    // Load category-level modifier group assignments (inherited)
    if (categoryIds.length && Object.keys(groupsById).length) {
      const catPlaceholders = categoryIds.map(() => '?').join(',');
      const categoryModifierRows = await db.all(
        `
          SELECT *
          FROM category_modifier_groups
          WHERE category_id IN (${catPlaceholders})
          ORDER BY display_order ASC
        `,
        categoryIds
      );

      categoryGroupsMap = categoryModifierRows.reduce((acc: Record<string, any[]>, row: any) => {
        const baseGroup = groupsById[row.group_id];
        if (!baseGroup) return acc;

        const enriched = {
          id: baseGroup.id,
          name: baseGroup.name,
          description: baseGroup.description,
          selectionType: baseGroup.selection_type,
          minSelections: baseGroup.min_selections,
          maxSelections: baseGroup.max_selections,
          isRequired: baseGroup.is_required,
          displayOrder: row.display_order ?? baseGroup.display_order ?? 0,
          assignmentLevel: 'category',
          options: (optionsByGroup[baseGroup.id] || []).map((opt: any) => ({
            id: opt.id,
            name: opt.name,
            description: opt.description ?? null,
            priceDelta: Number(opt.price_delta || 0),
            isActive: Boolean(opt.is_active),
            isSoldOut: Boolean(opt.is_sold_out),
            isPreselected: Boolean(opt.is_preselected),
            displayOrder: opt.display_order ?? 0
          }))
        };

        if (!acc[row.category_id]) acc[row.category_id] = [];
        acc[row.category_id].push(enriched);
        return acc;
      }, {});
    }

    // Load item sizes
    const sizeRows = await db.all(
      `
        SELECT *
        FROM item_sizes
        WHERE item_id IN (${itemIdPlaceholders})
        ORDER BY display_order ASC, size_name ASC
      `,
      itemIds
    );
    sizesByItem = sizeRows.reduce((acc: Record<string, any[]>, row: any) => {
      if (!acc[row.item_id]) acc[row.item_id] = [];
      acc[row.item_id].push({
        id: row.id,
        sizeName: row.size_name,
        price: Number(row.price || 0),
        isPreselected: Boolean(row.is_preselected),
        displayOrder: Number(row.display_order || 0)
      });
      return acc;
    }, {});
  }

  const itemsWithModifiers = items.map((item: any) => {
    const itemGroups = itemGroupsMap[item.id] || [];
    const itemGroupIds = new Set(itemGroups.map((g: any) => g.id));
    const inheritedGroups = (categoryGroupsMap[item.category_id] || []).filter((g: any) => !itemGroupIds.has(g.id));

    const sizes = sizesByItem[item.id] || [];
    const fromPrice =
      sizes.length > 0
        ? Math.min(...sizes.map((s: any) => Number(s.price || 0)))
        : Number(item.price || 0);

    return {
      ...item,
      fromPrice,
      sizes,
      modifierGroups: [...inheritedGroups, ...itemGroups]
    };
  });

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
      items: itemsWithModifiers
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
      COALESCE(is_hidden, FALSE) as is_hidden,
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

/**
 * PUT /api/menu/categories/:id/visibility
 * Toggle category visibility for customer menu
 */
router.put('/categories/:id/visibility', asyncHandler(async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { isHidden } = req.body || {};
  const restaurantId = req.user?.restaurantId;
  if (!restaurantId) throw new UnauthorizedError();
  const db = DatabaseService.getInstance().getDatabase();

  const category = await db.get('SELECT id, name FROM menu_categories WHERE id = ? AND restaurant_id = ?', [id, restaurantId]);
  if (!category) {
    return res.status(404).json({ success: false, error: { message: 'Category not found' } });
  }

  await db.run(
    'UPDATE menu_categories SET is_hidden = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND restaurant_id = ?',
    [isHidden ? 1 : 0, id, restaurantId]
  );

  await DatabaseService.getInstance().logAudit(
    restaurantId,
    req.user?.id || 'system',
    'update_category_visibility',
    'menu_category',
    id,
    { isHidden: Boolean(isHidden) }
  );

  res.json({ success: true });
}));

/**
 * GET /api/menu/categories/:id/modifier-groups
 * List modifier groups assigned at the category level (inherited by items)
 */
router.get('/categories/:id/modifier-groups', asyncHandler(async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const restaurantId = req.user?.restaurantId;
  if (!restaurantId) throw new UnauthorizedError();
  const db = DatabaseService.getInstance().getDatabase();

  const category = await db.get('SELECT id FROM menu_categories WHERE id = ? AND restaurant_id = ?', [id, restaurantId]);
  if (!category) {
    return res.status(404).json({ success: false, error: { message: 'Category not found' } });
  }

  const rows = await db.all(
    `
      SELECT
        cmg.id as assignment_id,
        cmg.category_id,
        cmg.group_id,
        cmg.display_order as assignment_order,
        mg.name,
        mg.description,
        mg.selection_type,
        mg.min_selections,
        mg.max_selections,
        mg.is_required,
        mg.is_active
      FROM category_modifier_groups cmg
      JOIN modifier_groups mg ON mg.id = cmg.group_id
      WHERE cmg.category_id = ?
        AND mg.restaurant_id = ?
        AND mg.deleted_at IS NULL
      ORDER BY cmg.display_order ASC, mg.name ASC
    `,
    [id, restaurantId]
  );

  res.json({
    success: true,
    data: rows.map((r: any) => ({
      assignmentId: r.assignment_id,
      categoryId: r.category_id,
      groupId: r.group_id,
      assignmentOrder: Number(r.assignment_order || 0),
      name: r.name,
      description: r.description ?? null,
      selectionType: r.selection_type,
      minSelections: Number(r.min_selections || 0),
      maxSelections: r.max_selections === null || r.max_selections === undefined ? null : Number(r.max_selections),
      isRequired: Boolean(r.is_required),
      isActive: Boolean(r.is_active)
    }))
  });
}));

/**
 * POST /api/menu/categories/:id/modifier-groups
 * Replace category-level modifier group assignments (ordered)
 * Body: { groupIds: string[] }
 */
router.post('/categories/:id/modifier-groups', asyncHandler(async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const restaurantId = req.user?.restaurantId;
  if (!restaurantId) throw new UnauthorizedError();
  const db = DatabaseService.getInstance().getDatabase();

  const category = await db.get('SELECT id FROM menu_categories WHERE id = ? AND restaurant_id = ?', [id, restaurantId]);
  if (!category) {
    return res.status(404).json({ success: false, error: { message: 'Category not found' } });
  }

  const groupIdsRaw = (req.body?.groupIds ?? req.body?.modifierGroupIds) as unknown;
  const groupIds = Array.isArray(groupIdsRaw) ? groupIdsRaw.map(String) : [];

  // Replace-all semantics for consistent ordering
  await db.run('DELETE FROM category_modifier_groups WHERE category_id = ?', [id]);

  for (let i = 0; i < groupIds.length; i++) {
    await db.run(
      `
        INSERT INTO category_modifier_groups (id, category_id, group_id, display_order)
        VALUES (?, ?, ?, ?)
      `,
      [uuidv4(), id, groupIds[i], i]
    );
  }

  await DatabaseService.getInstance().logAudit(
    restaurantId,
    req.user?.id || 'system',
    'set_category_modifier_groups',
    'menu_category',
    id,
    { groupIds }
  );

  res.json({ success: true });
}));

/**
 * DELETE /api/menu/categories/:id/modifier-groups/:groupId
 * Remove a single category-level modifier group assignment
 */
router.delete('/categories/:id/modifier-groups/:groupId', asyncHandler(async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const groupId = Array.isArray(req.params.groupId) ? req.params.groupId[0] : req.params.groupId;
  const restaurantId = req.user?.restaurantId;
  if (!restaurantId) throw new UnauthorizedError();
  const db = DatabaseService.getInstance().getDatabase();

  const category = await db.get('SELECT id FROM menu_categories WHERE id = ? AND restaurant_id = ?', [id, restaurantId]);
  if (!category) {
    return res.status(404).json({ success: false, error: { message: 'Category not found' } });
  }

  await db.run('DELETE FROM category_modifier_groups WHERE category_id = ? AND group_id = ?', [id, groupId]);

  await DatabaseService.getInstance().logAudit(
    restaurantId,
    req.user?.id || 'system',
    'remove_category_modifier_group',
    'menu_category',
    id,
    { groupId }
  );

  res.json({ success: true });
}));

/**
 * PUT /api/menu/categories/reorder
 * Reorder categories by setting sort_order (drag-and-drop)
 * Body: { categoryIds: string[] }
 */
router.put('/categories/reorder', asyncHandler(async (req: Request, res: Response) => {
  const restaurantId = req.user?.restaurantId;
  if (!restaurantId) throw new UnauthorizedError();
  const db = DatabaseService.getInstance().getDatabase();

  const categoryIdsRaw = (req.body?.categoryIds ?? req.body?.orderedIds) as unknown;
  const categoryIds = Array.isArray(categoryIdsRaw) ? categoryIdsRaw.map(String) : [];
  if (!categoryIds.length) {
    return res.status(400).json({ success: false, error: { message: 'categoryIds is required' } });
  }

  for (let i = 0; i < categoryIds.length; i++) {
    await db.run(
      'UPDATE menu_categories SET sort_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND restaurant_id = ?',
      [i, categoryIds[i], restaurantId]
    );
  }

  await DatabaseService.getInstance().logAudit(
    restaurantId,
    req.user?.id || 'system',
    'reorder_menu_categories',
    'menu_category',
    'multiple',
    { categoryIds }
  );

  res.json({ success: true });
}));

/**
 * PUT /api/menu/categories/:id/items/reorder
 * Reorder items within a category by setting sort_order
 * Body: { itemIds: string[] }
 */
router.put('/categories/:id/items/reorder', asyncHandler(async (req: Request, res: Response) => {
  const categoryId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const restaurantId = req.user?.restaurantId;
  if (!restaurantId) throw new UnauthorizedError();
  const db = DatabaseService.getInstance().getDatabase();

  const category = await db.get('SELECT id FROM menu_categories WHERE id = ? AND restaurant_id = ?', [categoryId, restaurantId]);
  if (!category) {
    return res.status(404).json({ success: false, error: { message: 'Category not found' } });
  }

  const itemIdsRaw = (req.body?.itemIds ?? req.body?.orderedItemIds) as unknown;
  const itemIds = Array.isArray(itemIdsRaw) ? itemIdsRaw.map(String) : [];
  if (!itemIds.length) {
    return res.status(400).json({ success: false, error: { message: 'itemIds is required' } });
  }

  for (let i = 0; i < itemIds.length; i++) {
    await db.run(
      `
        UPDATE menu_items
        SET sort_order = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND restaurant_id = ? AND category_id = ?
      `,
      [i, itemIds[i], restaurantId, categoryId]
    );
  }

  await DatabaseService.getInstance().logAudit(
    restaurantId,
    req.user?.id || 'system',
    'reorder_menu_items',
    'menu_item',
    'multiple',
    { categoryId, itemIds }
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
  const uploadsPath = await ensureUploadsDir('menu');

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
    const uploadsPath = await ensureUploadsDir('menu');
    
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
 * POST /api/menu/items/describe
 * Generate a menu item description with AI
 */
router.post('/items/describe', asyncHandler(async (req: Request, res: Response) => {
  const { name, modifiers, category } = req.body || {};

  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ success: false, error: { message: 'Item name is required' } });
  }

  if (!openai) {
    return res.status(503).json({ success: false, error: { message: 'AI service is not configured' } });
  }

  const modifierList = Array.isArray(modifiers) ? modifiers : [];
  const modifierText = modifierList.length > 0
    ? `Modifiers: ${modifierList.map((m: any) => m?.name || m).filter(Boolean).join(', ')}.`
    : 'No modifiers listed.';

  const categoryText = category ? `Category: ${category}.` : '';

  const prompt = [
    `Write a concise, appetizing menu description for "${name}".`,
    categoryText,
    modifierText,
    'Keep it 1-2 sentences, under 160 characters.',
    'Do not mention pricing.'
  ].filter(Boolean).join(' ');

  const completion = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
      { role: 'system', content: 'You are a restaurant menu copywriter.' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.7,
    max_tokens: 120
  });

  const description = completion.choices[0]?.message?.content?.trim() || '';

  res.json({
    success: true,
    data: { description }
  });
}));

// ============================================================================
// ITEM SIZES (SIZE VARIATIONS)
// ============================================================================

/**
 * GET /api/menu/items/:id/sizes
 * Get size variations for a menu item
 */
router.get('/items/:id/sizes', asyncHandler(async (req: Request, res: Response) => {
  const itemId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const restaurantId = req.user?.restaurantId;
  const db = DatabaseService.getInstance().getDatabase();

  const item = await db.get('SELECT id FROM menu_items WHERE id = ? AND restaurant_id = ?', [itemId, restaurantId]);
  if (!item) {
    return res.status(404).json({ success: false, error: { message: 'Menu item not found' } });
  }

  const sizes = await db.all(
    `
      SELECT *
      FROM item_sizes
      WHERE item_id = ?
      ORDER BY display_order ASC, size_name ASC
    `,
    [itemId]
  );

  res.json({
    success: true,
    data: sizes.map((s: any) => ({
      id: s.id,
      item_id: s.item_id,
      size_name: s.size_name,
      price: Number(s.price || 0),
      is_preselected: Boolean(s.is_preselected),
      display_order: Number(s.display_order || 0)
    }))
  });
}));

/**
 * POST /api/menu/items/:id/sizes
 * Create a size variation for a menu item
 */
router.post('/items/:id/sizes', asyncHandler(async (req: Request, res: Response) => {
  const itemId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const restaurantId = req.user?.restaurantId;
  const { sizeName, price, isPreselected = false, displayOrder = 0 } = req.body || {};
  const db = DatabaseService.getInstance().getDatabase();

  const item = await db.get('SELECT id FROM menu_items WHERE id = ? AND restaurant_id = ?', [itemId, restaurantId]);
  if (!item) {
    return res.status(404).json({ success: false, error: { message: 'Menu item not found' } });
  }

  if (!sizeName || typeof sizeName !== 'string' || !sizeName.trim()) {
    return res.status(400).json({ success: false, error: { message: 'sizeName is required' } });
  }
  const parsedPrice = Number(price);
  if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
    return res.status(400).json({ success: false, error: { message: 'price must be a non-negative number' } });
  }

  const sizeId = uuidv4();

  // If this size is preselected, clear other preselected sizes first.
  if (isPreselected) {
    await db.run('UPDATE item_sizes SET is_preselected = FALSE WHERE item_id = ?', [itemId]);
  }

  await db.run(
    `
      INSERT INTO item_sizes (id, item_id, size_name, price, is_preselected, display_order)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    [sizeId, itemId, sizeName.trim(), parsedPrice, isPreselected ? 1 : 0, Number(displayOrder) || 0]
  );

  const created = await db.get('SELECT * FROM item_sizes WHERE id = ?', [sizeId]);
  res.status(201).json({
    success: true,
    data: {
      id: created.id,
      item_id: created.item_id,
      size_name: created.size_name,
      price: Number(created.price || 0),
      is_preselected: Boolean(created.is_preselected),
      display_order: Number(created.display_order || 0)
    }
  });
}));

/**
 * PUT /api/menu/items/:id/sizes/:sizeId
 * Update a size variation
 */
router.put('/items/:id/sizes/:sizeId', asyncHandler(async (req: Request, res: Response) => {
  const itemId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const sizeId = Array.isArray(req.params.sizeId) ? req.params.sizeId[0] : req.params.sizeId;
  const restaurantId = req.user?.restaurantId;
  const { sizeName, price, isPreselected, displayOrder } = req.body || {};
  const db = DatabaseService.getInstance().getDatabase();

  const item = await db.get('SELECT id FROM menu_items WHERE id = ? AND restaurant_id = ?', [itemId, restaurantId]);
  if (!item) {
    return res.status(404).json({ success: false, error: { message: 'Menu item not found' } });
  }

  const existing = await db.get('SELECT * FROM item_sizes WHERE id = ? AND item_id = ?', [sizeId, itemId]);
  if (!existing) {
    return res.status(404).json({ success: false, error: { message: 'Size not found' } });
  }

  const updateFields: string[] = [];
  const updateValues: any[] = [];

  if (sizeName !== undefined) {
    if (typeof sizeName !== 'string' || !sizeName.trim()) {
      return res.status(400).json({ success: false, error: { message: 'sizeName must be a non-empty string' } });
    }
    updateFields.push('size_name = ?');
    updateValues.push(sizeName.trim());
  }
  if (price !== undefined) {
    const parsedPrice = Number(price);
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      return res.status(400).json({ success: false, error: { message: 'price must be a non-negative number' } });
    }
    updateFields.push('price = ?');
    updateValues.push(parsedPrice);
  }
  if (displayOrder !== undefined) {
    updateFields.push('display_order = ?');
    updateValues.push(Number(displayOrder) || 0);
  }

  if (isPreselected !== undefined) {
    const boolPre = Boolean(isPreselected);
    if (boolPre) {
      await db.run('UPDATE item_sizes SET is_preselected = FALSE WHERE item_id = ?', [itemId]);
    }
    updateFields.push('is_preselected = ?');
    updateValues.push(boolPre ? 1 : 0);
  }

  if (!updateFields.length) {
    return res.json({
      success: true,
      data: {
        id: existing.id,
        item_id: existing.item_id,
        size_name: existing.size_name,
        price: Number(existing.price || 0),
        is_preselected: Boolean(existing.is_preselected),
        display_order: Number(existing.display_order || 0)
      }
    });
  }

  updateFields.push('updated_at = CURRENT_TIMESTAMP');

  await db.run(
    `
      UPDATE item_sizes
      SET ${updateFields.join(', ')}
      WHERE id = ? AND item_id = ?
    `,
    [...updateValues, sizeId, itemId]
  );

  const updated = await db.get('SELECT * FROM item_sizes WHERE id = ?', [sizeId]);
  res.json({
    success: true,
    data: {
      id: updated.id,
      item_id: updated.item_id,
      size_name: updated.size_name,
      price: Number(updated.price || 0),
      is_preselected: Boolean(updated.is_preselected),
      display_order: Number(updated.display_order || 0)
    }
  });
}));

/**
 * DELETE /api/menu/items/:id/sizes/:sizeId
 * Delete a size variation
 */
router.delete('/items/:id/sizes/:sizeId', asyncHandler(async (req: Request, res: Response) => {
  const itemId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const sizeId = Array.isArray(req.params.sizeId) ? req.params.sizeId[0] : req.params.sizeId;
  const restaurantId = req.user?.restaurantId;
  const db = DatabaseService.getInstance().getDatabase();

  const item = await db.get('SELECT id FROM menu_items WHERE id = ? AND restaurant_id = ?', [itemId, restaurantId]);
  if (!item) {
    return res.status(404).json({ success: false, error: { message: 'Menu item not found' } });
  }

  const existing = await db.get('SELECT * FROM item_sizes WHERE id = ? AND item_id = ?', [sizeId, itemId]);
  if (!existing) {
    return res.status(404).json({ success: false, error: { message: 'Size not found' } });
  }

  await db.run('DELETE FROM item_sizes WHERE id = ? AND item_id = ?', [sizeId, itemId]);

  res.json({ success: true });
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

  // Attach modifier groups/options from new schema
  const itemIds = formattedItems.map((i: any) => i.id);
  let itemGroupsMap: Record<string, any[]> = {};
  let categoryGroupsMap: Record<string, any[]> = {};
  let sizesByItem: Record<string, any[]> = {};
  const categoryIds = Array.from(new Set(formattedItems.map((i: any) => i.category_id).filter(Boolean)));
  if (itemIds.length) {
    // Load active groups/options for the restaurant
    const groups = await db.all(
      `
      SELECT *
      FROM modifier_groups
      WHERE restaurant_id = ?
        AND deleted_at IS NULL
      `,
      [restaurantId]
    );
    const groupById = groups.reduce((acc: Record<string, any>, g: any) => {
      acc[g.id] = g;
      return acc;
    }, {});

    const options = await db.all(
      `
      SELECT *
      FROM modifier_options
      WHERE restaurant_id = ?
        AND deleted_at IS NULL
      ORDER BY display_order ASC, name ASC
      `,
      [restaurantId]
    );
    const optionsByGroup = options.reduce((acc: Record<string, any[]>, opt: any) => {
      if (!acc[opt.group_id]) acc[opt.group_id] = [];
      acc[opt.group_id].push(opt);
      return acc;
    }, {});

    const placeholders = itemIds.map(() => '?').join(',');
    const itemJoins = await db.all(
      `
      SELECT *
      FROM item_modifier_groups
      WHERE item_id IN (${placeholders})
        AND deleted_at IS NULL
      ORDER BY display_order ASC
      `,
      itemIds
    );

    itemGroupsMap = itemJoins.reduce((acc: Record<string, any[]>, row: any) => {
      const baseGroup = groupById[row.group_id];
      if (!baseGroup) return acc;
      const effectiveMin =
        row.override_min !== null && row.override_min !== undefined
          ? row.override_min
          : baseGroup.min_selections;
      const effectiveMax =
        row.override_max !== null && row.override_max !== undefined
          ? row.override_max
          : baseGroup.max_selections;
      const effectiveRequired =
        row.override_required !== null && row.override_required !== undefined
          ? row.override_required
          : baseGroup.is_required;

      const enriched = {
        id: baseGroup.id,
        name: baseGroup.name,
        description: baseGroup.description,
        selectionType: baseGroup.selection_type,
        minSelections: effectiveMin,
        maxSelections: effectiveMax,
        isRequired: effectiveRequired,
        displayOrder: row.display_order ?? baseGroup.display_order ?? 0,
        overrides: {
          overrideMin: row.override_min,
          overrideMax: row.override_max,
          overrideRequired: row.override_required,
          displayOrder: row.display_order ?? 0
        },
        assignmentLevel: 'item',
        options: (optionsByGroup[baseGroup.id] || []).map((opt: any) => ({
          id: opt.id,
          name: opt.name,
          description: opt.description ?? null,
          priceDelta: Number(opt.price_delta || 0),
          isActive: Boolean(opt.is_active),
          isSoldOut: Boolean(opt.is_sold_out),
          isPreselected: Boolean(opt.is_preselected),
          displayOrder: opt.display_order ?? 0
        }))
      };

      if (!acc[row.item_id]) acc[row.item_id] = [];
      acc[row.item_id].push(enriched);
      return acc;
    }, {});

    // Category-level modifier groups (inherited)
    if (categoryIds.length) {
      const catPlaceholders = categoryIds.map(() => '?').join(',');
      const categoryModifierRows = await db.all(
        `
          SELECT *
          FROM category_modifier_groups
          WHERE category_id IN (${catPlaceholders})
          ORDER BY display_order ASC
        `,
        categoryIds
      );

      categoryGroupsMap = categoryModifierRows.reduce((acc: Record<string, any[]>, row: any) => {
        const baseGroup = groupById[row.group_id];
        if (!baseGroup) return acc;
        const enriched = {
          id: baseGroup.id,
          name: baseGroup.name,
          description: baseGroup.description,
          selectionType: baseGroup.selection_type,
          minSelections: baseGroup.min_selections,
          maxSelections: baseGroup.max_selections,
          isRequired: baseGroup.is_required,
          displayOrder: row.display_order ?? baseGroup.display_order ?? 0,
          assignmentLevel: 'category',
          options: (optionsByGroup[baseGroup.id] || []).map((opt: any) => ({
            id: opt.id,
            name: opt.name,
            description: opt.description ?? null,
            priceDelta: Number(opt.price_delta || 0),
            isActive: Boolean(opt.is_active),
            isSoldOut: Boolean(opt.is_sold_out),
            isPreselected: Boolean(opt.is_preselected),
            displayOrder: opt.display_order ?? 0
          }))
        };
        if (!acc[row.category_id]) acc[row.category_id] = [];
        acc[row.category_id].push(enriched);
        return acc;
      }, {});
    }

    // Item sizes
    const placeholders2 = itemIds.map(() => '?').join(',');
    const sizeRows = await db.all(
      `
        SELECT *
        FROM item_sizes
        WHERE item_id IN (${placeholders2})
        ORDER BY display_order ASC, size_name ASC
      `,
      itemIds
    );
    sizesByItem = sizeRows.reduce((acc: Record<string, any[]>, row: any) => {
      if (!acc[row.item_id]) acc[row.item_id] = [];
      acc[row.item_id].push({
        id: row.id,
        sizeName: row.size_name,
        price: Number(row.price || 0),
        isPreselected: Boolean(row.is_preselected),
        displayOrder: Number(row.display_order || 0)
      });
      return acc;
    }, {});
  }

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
    acc[categoryName].items.push({
      ...item,
      fromPrice: (() => {
        const sizes = sizesByItem[item.id] || [];
        if (sizes.length) return Math.min(...sizes.map((s: any) => Number(s.price || 0)));
        return Number(item.price || 0);
      })(),
      sizes: sizesByItem[item.id] || [],
      modifierGroups: (() => {
        const itemGroups = itemGroupsMap[item.id] || [];
        const itemGroupIds = new Set(itemGroups.map((g: any) => g.id));
        const inheritedGroups = (categoryGroupsMap[item.category_id] || []).filter((g: any) => !itemGroupIds.has(g.id));
        return [...inheritedGroups, ...itemGroups];
      })()
    });
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
  const { itemId, channels = ['all'] } = req.body;

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
    'UPDATE menu_items SET is_available = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
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
      INSERT INTO sync_jobs (id, restaurant_id, job_type, status, payload, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      jobId,
      req.user?.restaurantId || null,
      'set_unavailable',
      'completed', // In real app, this would be 'pending' initially
      JSON.stringify({ channels: [channel], itemId, itemName: item.name, action: 'set_unavailable' }),
      JSON.stringify({ source: 'menu_toggle' })
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
  const { itemId, channels = ['all'] } = req.body;

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
    'UPDATE menu_items SET is_available = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
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
      INSERT INTO sync_jobs (id, restaurant_id, job_type, status, payload, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      jobId,
      req.user?.restaurantId || null,
      'set_available',
      'completed',
      JSON.stringify({ channels: [channel], itemId, itemName: item.name, action: 'set_available' }),
      JSON.stringify({ source: 'menu_toggle' })
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
      COALESCE(mc.is_hidden, FALSE) as is_hidden,
      mc.sort_order,
      mc.is_active,
      COUNT(mi.id) as total_items,
      COUNT(CASE WHEN mi.is_available = TRUE THEN 1 END) as available_items,
      COUNT(CASE WHEN mi.is_available = FALSE THEN 1 END) as unavailable_items
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
  // TODO: Legacy endpoint - prefer /api/restaurants/:restaurantId/modifier-groups (modifiers.ts)
  const db = DatabaseService.getInstance().getDatabase();
  const restaurantId = req.user?.restaurantId;

  const groups = await db.all(`
    SELECT 
      mg.id,
      mg.restaurant_id,
      mg.name,
      mg.min_selection as min_selections,
      mg.max_selection as max_selections,
      mg.is_required,
      mg.created_at,
      COALESCE(mg.description, '') as description,
      COUNT(mo.id) as option_count
    FROM modifier_groups mg
    LEFT JOIN modifier_options mo ON mg.id = mo.modifier_group_id AND mo.is_available = true
    WHERE mg.restaurant_id = ?
    GROUP BY mg.id, mg.restaurant_id, mg.name, mg.min_selection, mg.max_selection, mg.is_required, mg.created_at, mg.description
    ORDER BY mg.name ASC
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
    INSERT INTO modifier_groups (id, restaurant_id, name, description, min_selection, max_selection, is_required)
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
    SELECT id, name, COALESCE(description, '') as description, price_modifier, is_available
    FROM modifier_options 
    WHERE modifier_group_id = ? AND is_available = true
    ORDER BY name ASC
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

  // Fetch modifier groups assigned to this item
  const groups = await db.all(`
    SELECT 
      mg.id,
      mg.name,
      mg.min_selection as min_selections,
      mg.max_selection as max_selections,
      mg.is_required,
      COALESCE(mg.description, '') as description,
      mim.sort_order as assignment_order
    FROM modifier_groups mg
    INNER JOIN menu_item_modifiers mim ON mg.id = mim.modifier_group_id
    WHERE mim.menu_item_id = ?
    ORDER BY mim.sort_order ASC, mg.name ASC
  `, [id]);

  // Fetch options for each group
  const formattedModifiers = await Promise.all(groups.map(async (group: any) => {
    const options = await db.all(`
      SELECT id, name, COALESCE(description, '') as description, price_modifier
      FROM modifier_options
      WHERE modifier_group_id = ? AND is_available = true
      ORDER BY name ASC
    `, [group.id]);
    return { ...group, options };
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
 * Import menu from Excel/CSV/PDF/DOCX file
 */
router.post('/import', importUpload.single('file'), asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: { message: 'File is required' }
    });
  }

  const db = DatabaseService.getInstance().getDatabase();
  const restaurantId = req.user?.restaurantId;
  const importId = uuidv4();
  const ext = path.extname(req.file.originalname).toLowerCase();
  const mime = req.file.mimetype;
  const fileType = (() => {
    if (mime.includes('excel') || ext === '.xlsx' || ext === '.xls') return 'excel';
    if (mime.includes('csv') || ext === '.csv') return 'csv';
    if (mime === 'application/pdf' || ext === '.pdf') return 'pdf';
    if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || ext === '.docx') return 'docx';
    return 'unknown';
  })();

  if (fileType === 'unknown') {
    return res.status(400).json({ success: false, error: { message: 'Unsupported file type' } });
  }

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
    } else if (fileType === 'csv') {
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
    } else if (fileType === 'pdf') {
      const parsed = await pdfParse(req.file.buffer);
      data = extractMenuRowsFromText(parsed.text);
    } else if (fileType === 'docx') {
      const parsed = await mammoth.extractRawText({ buffer: req.file.buffer });
      data = extractMenuRowsFromText(parsed.value || '');
    }

    // Process the data
    let successCount = 0;
    let errorCount = 0;
    const errors: any[] = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      try {
        // Validate required fields
        if (!row.name || row.price === undefined || row.price === null) {
          throw new Error('Missing required fields: name, price');
        }

        const categoryName = row.category || 'Uncategorized';
        const priceValue = typeof row.price === 'number'
          ? row.price
          : parsePrice(String(row.price));
        if (!Number.isFinite(priceValue)) {
          throw new Error('Invalid price value');
        }

        // Find or create category
        let category = await db.get(
          'SELECT id FROM menu_categories WHERE name = ? AND restaurant_id = ?',
          [categoryName, restaurantId]
        );

        if (!category) {
          const categoryId = uuidv4();
          await db.run(`
            INSERT INTO menu_categories (id, restaurant_id, name, is_active)
            VALUES (?, ?, ?, 1)
          `, [categoryId, restaurantId, categoryName]);
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
          String(row.name).trim(),
          row.description ? String(row.description).trim() : null,
          priceValue,
          row.cost ? parseFloat(String(row.cost)) : null,
          row.preparation_time ? parseInt(String(row.preparation_time)) : 0,
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