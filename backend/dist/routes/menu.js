"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const DatabaseService_1 = require("../services/DatabaseService");
const errorHandler_1 = require("../middleware/errorHandler");
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
/**
 * GET /api/menu/items/search
 * Search menu items
 */
router.get('/items/search', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { q, category, available } = req.query;
    const db = DatabaseService_1.DatabaseService.getInstance().getDatabase();
    let query = 'SELECT * FROM menu_items';
    const params = [];
    const conditions = [];
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
    const formattedItems = items.map((item) => ({
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
router.post('/items/set-unavailable', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { itemId, channels = ['all'], userId } = req.body;
    if (!itemId) {
        return res.status(400).json({
            success: false,
            error: { message: 'itemId is required' }
        });
    }
    const db = DatabaseService_1.DatabaseService.getInstance().getDatabase();
    const item = await db.get('SELECT * FROM menu_items WHERE id = ?', [itemId]);
    if (!item) {
        return res.status(404).json({
            success: false,
            error: { message: 'Menu item not found' }
        });
    }
    // Update availability
    await db.run('UPDATE menu_items SET is_available = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [itemId]);
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
    await DatabaseService_1.DatabaseService.getInstance().logAudit(userId || 'system', 'set_item_unavailable', 'menu_item', itemId, { itemName: item.name, channels: syncResults });
    logger_1.logger.info(`Item 86'd: ${item.name} on channels: ${syncResults.join(', ')}`);
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
router.post('/items/set-available', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { itemId, channels = ['all'], userId } = req.body;
    if (!itemId) {
        return res.status(400).json({
            success: false,
            error: { message: 'itemId is required' }
        });
    }
    const db = DatabaseService_1.DatabaseService.getInstance().getDatabase();
    const item = await db.get('SELECT * FROM menu_items WHERE id = ?', [itemId]);
    if (!item) {
        return res.status(404).json({
            success: false,
            error: { message: 'Menu item not found' }
        });
    }
    // Update availability
    await db.run('UPDATE menu_items SET is_available = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [itemId]);
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
    await DatabaseService_1.DatabaseService.getInstance().logAudit(userId || 'system', 'set_item_available', 'menu_item', itemId, { itemName: item.name, channels: syncResults });
    logger_1.logger.info(`Item restored: ${item.name} on channels: ${syncResults.join(', ')}`);
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
router.get('/unavailable', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const db = DatabaseService_1.DatabaseService.getInstance().getDatabase();
    const unavailableItems = await db.all(`
    SELECT *, updated_at as unavailable_since
    FROM menu_items 
    WHERE is_available = 0
    ORDER BY updated_at DESC
  `);
    const formattedItems = unavailableItems.map((item) => ({
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
router.get('/categories', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const db = DatabaseService_1.DatabaseService.getInstance().getDatabase();
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
exports.default = router;
//# sourceMappingURL=menu.js.map