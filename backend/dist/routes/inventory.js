"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const DatabaseService_1 = require("../services/DatabaseService");
const errorHandler_1 = require("../middleware/errorHandler");
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
/**
 * GET /api/inventory/search
 * Search inventory items
 */
router.get('/search', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { q, category, lowStock } = req.query;
    const db = DatabaseService_1.DatabaseService.getInstance().getDatabase();
    let query = 'SELECT * FROM inventory';
    const params = [];
    const conditions = [];
    if (q) {
        conditions.push('(name LIKE ? OR sku LIKE ?)');
        params.push(`%${q}%`, `%${q}%`);
    }
    if (category) {
        conditions.push('category = ?');
        params.push(category);
    }
    if (lowStock === 'true') {
        conditions.push('current_quantity <= low_stock_threshold');
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
router.post('/receive', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { items, userId } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
            success: false,
            error: { message: 'Items array is required' }
        });
    }
    const db = DatabaseService_1.DatabaseService.getInstance().getDatabase();
    const results = [];
    for (const item of items) {
        const { name, quantity } = item;
        if (!name || !quantity) {
            continue;
        }
        // Find the inventory item
        const inventoryItem = await db.get('SELECT * FROM inventory WHERE name LIKE ?', [`%${name}%`]);
        if (inventoryItem) {
            const newQuantity = inventoryItem.current_quantity + quantity;
            await db.run('UPDATE inventory SET current_quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newQuantity, inventoryItem.id]);
            await DatabaseService_1.DatabaseService.getInstance().logAudit(userId || 'system', 'receive_inventory', 'inventory', inventoryItem.id, { name, previousQuantity: inventoryItem.current_quantity, received: quantity, newQuantity });
            results.push({
                item: name,
                received: quantity,
                newTotal: newQuantity,
                unit: inventoryItem.unit
            });
        }
    }
    logger_1.logger.info(`Inventory received: ${results.length} items updated`);
    res.json({
        success: true,
        data: { results }
    });
}));
/**
 * POST /api/inventory/adjust
 * Adjust inventory quantities
 */
router.post('/adjust', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { itemId, quantity, reason, userId } = req.body;
    if (!itemId || quantity === undefined || !reason) {
        return res.status(400).json({
            success: false,
            error: { message: 'itemId, quantity, and reason are required' }
        });
    }
    const db = DatabaseService_1.DatabaseService.getInstance().getDatabase();
    const item = await db.get('SELECT * FROM inventory WHERE id = ?', [itemId]);
    if (!item) {
        return res.status(404).json({
            success: false,
            error: { message: 'Inventory item not found' }
        });
    }
    const newQuantity = item.current_quantity + quantity;
    if (newQuantity < 0) {
        return res.status(400).json({
            success: false,
            error: {
                message: `Cannot reduce ${item.name} below 0. Current: ${item.current_quantity}, Requested: ${quantity}`
            }
        });
    }
    await db.run('UPDATE inventory SET current_quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newQuantity, itemId]);
    await DatabaseService_1.DatabaseService.getInstance().logAudit(userId || 'system', 'adjust_inventory', 'inventory', itemId, { itemName: item.name, previousQuantity: item.current_quantity, adjustment: quantity, newQuantity, reason });
    logger_1.logger.info(`Inventory adjusted: ${item.name} ${quantity > 0 ? '+' : ''}${quantity} (reason: ${reason})`);
    res.json({
        success: true,
        data: {
            itemId,
            itemName: item.name,
            previousQuantity: item.current_quantity,
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
router.get('/low-stock', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const db = DatabaseService_1.DatabaseService.getInstance().getDatabase();
    const lowStockItems = await db.all(`
    SELECT *, 
           CASE 
             WHEN current_quantity = 0 THEN 'out_of_stock'
             WHEN current_quantity <= low_stock_threshold THEN 'low_stock'
             ELSE 'normal'
           END as stock_status
    FROM inventory 
    WHERE current_quantity <= low_stock_threshold
    ORDER BY current_quantity ASC
  `);
    res.json({
        success: true,
        data: lowStockItems
    });
}));
/**
 * GET /api/inventory/categories
 * Get all inventory categories
 */
router.get('/categories', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const db = DatabaseService_1.DatabaseService.getInstance().getDatabase();
    const categories = await db.all(`
    SELECT category, COUNT(*) as item_count
    FROM inventory 
    GROUP BY category
    ORDER BY category
  `);
    res.json({
        success: true,
        data: categories
    });
}));
exports.default = router;
//# sourceMappingURL=inventory.js.map