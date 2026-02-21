/**
 * Menu Bulk Operations Routes
 * Handles bulk operations for menu items
 */

import { Router, Request, Response } from 'express';
import { DatabaseService } from '../services/DatabaseService';
import { asyncHandler, UnauthorizedError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import {
  validateBulkDelete,
  validateBulkAvailability,
  validateBulkCategory,
  validateBulkFeatured
} from '../middleware/menuValidation';

const router = Router();

/**
 * POST /api/menu/items/bulk/delete
 * Delete multiple menu items
 */
router.post('/delete', validateBulkDelete, asyncHandler(async (req: Request, res: Response) => {
  const { itemIds } = req.body;
  const userId = req.user?.id;
  
  if (!userId) {
    throw new UnauthorizedError('Authentication required');
  }

  const db = DatabaseService.getInstance().getDatabase();
  
  // Verify user has access to these items
  const items = await db.all(`
    SELECT mi.id, mi.restaurant_id
    FROM menu_items mi
    JOIN restaurants r ON mi.restaurant_id = r.id
    WHERE mi.id IN (${itemIds.map(() => '?').join(',')})
      AND r.owner_id = ?
  `, [...itemIds, userId]);

  if (items.length !== itemIds.length) {
    return res.status(403).json({
      success: false,
      error: { message: 'Some items not found or access denied' }
    });
  }

  // TODO: Delete item images from storage
  // const itemsWithImages = await db.all(`
  //   SELECT images FROM menu_items WHERE id IN (${itemIds.map(() => '?').join(',')})
  // `, itemIds);
  // TODO: Delete images from storage service

  // Delete items
  const result = await db.run(`
    DELETE FROM menu_items WHERE id IN (${itemIds.map(() => '?').join(',')})
  `, itemIds);

  logger.info(`Bulk deleted ${result.changes} menu items`, { userId, itemIds });

  res.json({
    success: true,
    data: {
      deletedCount: result.changes,
      deletedIds: itemIds
    }
  });
}));

/**
 * POST /api/menu/items/bulk/availability
 * Toggle availability for multiple menu items
 */
router.post('/availability', validateBulkAvailability, asyncHandler(async (req: Request, res: Response) => {
  const { itemIds, isAvailable } = req.body;
  const userId = req.user?.id;
  
  if (!userId) {
    throw new UnauthorizedError('Authentication required');
  }

  const db = DatabaseService.getInstance().getDatabase();
  
  // Verify user has access to these items
  const items = await db.all(`
    SELECT mi.id
    FROM menu_items mi
    JOIN restaurants r ON mi.restaurant_id = r.id
    WHERE mi.id IN (${itemIds.map(() => '?').join(',')})
      AND r.owner_id = ?
  `, [...itemIds, userId]);

  if (items.length !== itemIds.length) {
    return res.status(403).json({
      success: false,
      error: { message: 'Some items not found or access denied' }
    });
  }

  // Update availability
  const result = await db.run(`
    UPDATE menu_items
    SET is_available = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id IN (${itemIds.map(() => '?').join(',')})
  `, [isAvailable ? 1 : 0, ...itemIds]);

  logger.info(`Bulk updated availability for ${result.changes} items`, { 
    userId, 
    itemIds, 
    isAvailable 
  });

  res.json({
    success: true,
    data: {
      updatedCount: result.changes,
      updatedIds: itemIds,
      isAvailable
    }
  });
}));

/**
 * POST /api/menu/items/bulk/category
 * Change category for multiple menu items
 */
router.post('/category', validateBulkCategory, asyncHandler(async (req: Request, res: Response) => {
  const { itemIds, categoryId } = req.body;
  const userId = req.user?.id;
  
  if (!userId) {
    throw new UnauthorizedError('Authentication required');
  }

  const db = DatabaseService.getInstance().getDatabase();
  
  // Verify category exists and user has access
  const category = await db.get(`
    SELECT mc.id, mc.restaurant_id
    FROM menu_categories mc
    JOIN restaurants r ON mc.restaurant_id = r.id
    WHERE mc.id = ? AND r.owner_id = ?
  `, [categoryId, userId]);

  if (!category) {
    return res.status(404).json({
      success: false,
      error: { message: 'Category not found or access denied' }
    });
  }

  // Verify user has access to these items
  const items = await db.all(`
    SELECT mi.id, mi.restaurant_id
    FROM menu_items mi
    JOIN restaurants r ON mi.restaurant_id = r.id
    WHERE mi.id IN (${itemIds.map(() => '?').join(',')})
      AND r.owner_id = ?
  `, [...itemIds, userId]);

  if (items.length !== itemIds.length) {
    return res.status(403).json({
      success: false,
      error: { message: 'Some items not found or access denied' }
    });
  }

  // Update category
  const result = await db.run(`
    UPDATE menu_items
    SET category_id = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id IN (${itemIds.map(() => '?').join(',')})
  `, [categoryId, ...itemIds]);

  logger.info(`Bulk moved ${result.changes} items to category ${categoryId}`, { 
    userId, 
    itemIds, 
    categoryId 
  });

  res.json({
    success: true,
    data: {
      updatedCount: result.changes,
      updatedIds: itemIds,
      categoryId
    }
  });
}));

/**
 * POST /api/menu/items/bulk/featured
 * Set featured status for multiple menu items
 */
router.post('/featured', validateBulkFeatured, asyncHandler(async (req: Request, res: Response) => {
  const { itemIds, isFeatured } = req.body;
  const userId = req.user?.id;
  
  if (!userId) {
    throw new UnauthorizedError('Authentication required');
  }

  const db = DatabaseService.getInstance().getDatabase();
  
  // Verify user has access to these items
  const items = await db.all(`
    SELECT mi.id
    FROM menu_items mi
    JOIN restaurants r ON mi.restaurant_id = r.id
    WHERE mi.id IN (${itemIds.map(() => '?').join(',')})
      AND r.owner_id = ?
  `, [...itemIds, userId]);

  if (items.length !== itemIds.length) {
    return res.status(403).json({
      success: false,
      error: { message: 'Some items not found or access denied' }
    });
  }

  // Update featured status
  const result = await db.run(`
    UPDATE menu_items
    SET is_featured = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id IN (${itemIds.map(() => '?').join(',')})
  `, [isFeatured ? 1 : 0, ...itemIds]);

  logger.info(`Bulk updated featured status for ${result.changes} items`, { 
    userId, 
    itemIds, 
    isFeatured 
  });

  res.json({
    success: true,
    data: {
      updatedCount: result.changes,
      updatedIds: itemIds,
      isFeatured
    }
  });
}));

/**
 * POST /api/menu/items/bulk/duplicate
 * Duplicate multiple menu items
 */
router.post('/duplicate', asyncHandler(async (req: Request, res: Response) => {
  const { itemIds } = req.body;
  const userId = req.user?.id;
  
  if (!userId) {
    throw new UnauthorizedError('Authentication required');
  }

  if (!Array.isArray(itemIds) || itemIds.length === 0) {
    return res.status(400).json({
      success: false,
      error: { message: 'itemIds must be a non-empty array' }
    });
  }

  const db = DatabaseService.getInstance().getDatabase();
  
  // Get items to duplicate
  const items = await db.all(`
    SELECT mi.*
    FROM menu_items mi
    JOIN restaurants r ON mi.restaurant_id = r.id
    WHERE mi.id IN (${itemIds.map(() => '?').join(',')})
      AND r.owner_id = ?
  `, [...itemIds, userId]);

  if (items.length === 0) {
    return res.status(404).json({
      success: false,
      error: { message: 'No items found or access denied' }
    });
  }

  const duplicatedIds: string[] = [];

  // Duplicate each item
  for (const item of items) {
    const newItemId = require('uuid').v4();
    
    await db.run(`
      INSERT INTO menu_items (
        id, restaurant_id, category_id, name, description, price, cost,
        images, is_available, is_featured, preparation_time, allergens,
        dietary_info, sort_order, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [
      newItemId,
      item.restaurant_id,
      item.category_id,
      `${item.name} (Copy)`,
      item.description,
      item.price,
      item.cost,
      item.images,
      item.is_available,
      0, // Not featured by default
      item.preparation_time,
      item.allergens,
      item.dietary_info,
      item.sort_order + 1
    ]);

    // Duplicate sizes if any
    const sizes = await db.all(`
      SELECT * FROM item_sizes WHERE item_id = ?
    `, [item.id]);

    for (const size of sizes) {
      await db.run(`
        INSERT INTO item_sizes (id, item_id, size_name, price, is_preselected, display_order)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        require('uuid').v4(),
        newItemId,
        size.size_name,
        size.price,
        size.is_preselected,
        size.display_order
      ]);
    }

    duplicatedIds.push(newItemId);
  }

  logger.info(`Bulk duplicated ${duplicatedIds.length} menu items`, { 
    userId, 
    originalIds: itemIds, 
    duplicatedIds 
  });

  res.json({
    success: true,
    data: {
      duplicatedCount: duplicatedIds.length,
      originalIds: itemIds,
      duplicatedIds
    }
  });
}));

/**
 * POST /api/menu/items/bulk/export
 * Export multiple menu items to CSV
 */
router.post('/export', asyncHandler(async (req: Request, res: Response) => {
  const { itemIds } = req.body;
  const userId = req.user?.id;
  
  if (!userId) {
    throw new UnauthorizedError('Authentication required');
  }

  if (!Array.isArray(itemIds) || itemIds.length === 0) {
    return res.status(400).json({
      success: false,
      error: { message: 'itemIds must be a non-empty array' }
    });
  }

  const db = DatabaseService.getInstance().getDatabase();
  
  // Get items to export
  const items = await db.all(`
    SELECT 
      mi.name,
      mi.description,
      mi.price,
      mi.cost,
      mi.is_available,
      mi.is_featured,
      mi.preparation_time,
      mi.allergens,
      mi.dietary_info,
      mc.name as category_name
    FROM menu_items mi
    JOIN restaurants r ON mi.restaurant_id = r.id
    LEFT JOIN menu_categories mc ON mi.category_id = mc.id
    WHERE mi.id IN (${itemIds.map(() => '?').join(',')})
      AND r.owner_id = ?
    ORDER BY mc.sort_order, mi.sort_order
  `, [...itemIds, userId]);

  if (items.length === 0) {
    return res.status(404).json({
      success: false,
      error: { message: 'No items found or access denied' }
    });
  }

  // Build CSV
  const headers = [
    'Category',
    'Name',
    'Description',
    'Price',
    'Cost',
    'Available',
    'Featured',
    'Prep Time (min)',
    'Allergens',
    'Dietary Info'
  ];

  const csvRows = [headers.join(',')];

  for (const item of items) {
    const row = [
      escapeCsvField(item.category_name || ''),
      escapeCsvField(item.name || ''),
      escapeCsvField(item.description || ''),
      item.price?.toFixed(2) || '0.00',
      item.cost?.toFixed(2) || '',
      item.is_available ? 'Yes' : 'No',
      item.is_featured ? 'Yes' : 'No',
      item.preparation_time?.toString() || '',
      escapeCsvField(item.allergens ? JSON.parse(item.allergens).join('; ') : ''),
      escapeCsvField(item.dietary_info ? JSON.parse(item.dietary_info).join('; ') : '')
    ];
    csvRows.push(row.join(','));
  }

  const csv = csvRows.join('\n');

  logger.info(`Exported ${items.length} menu items to CSV`, { userId, itemIds });

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="menu-items-${Date.now()}.csv"`);
  res.send(csv);
}));

/**
 * POST /api/menu/items/bulk/reorder
 * Reorder items within a category
 */
router.post('/reorder', asyncHandler(async (req: Request, res: Response) => {
  const { itemIds, categoryId } = req.body;
  const userId = req.user?.id;
  
  if (!userId) {
    throw new UnauthorizedError('Authentication required');
  }

  if (!Array.isArray(itemIds) || itemIds.length === 0) {
    return res.status(400).json({
      success: false,
      error: { message: 'itemIds must be a non-empty array' }
    });
  }

  const db = DatabaseService.getInstance().getDatabase();
  
  // Verify user has access
  const category = await db.get(`
    SELECT mc.id
    FROM menu_categories mc
    JOIN restaurants r ON mc.restaurant_id = r.id
    WHERE mc.id = ? AND r.owner_id = ?
  `, [categoryId, userId]);

  if (!category) {
    return res.status(404).json({
      success: false,
      error: { message: 'Category not found or access denied' }
    });
  }

  // Update sort order for each item
  for (let i = 0; i < itemIds.length; i++) {
    await db.run(`
      UPDATE menu_items
      SET sort_order = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND category_id = ?
    `, [i, itemIds[i], categoryId]);
  }

  logger.info(`Reordered ${itemIds.length} items in category ${categoryId}`, { userId, itemIds });

  res.json({
    success: true,
    data: {
      reorderedCount: itemIds.length,
      categoryId
    }
  });
}));

/**
 * Helper function to escape CSV fields
 */
function escapeCsvField(field: string): string {
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

export default router;
