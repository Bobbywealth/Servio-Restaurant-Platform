"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const DatabaseService_1 = require("../services/DatabaseService");
const StorageService_1 = require("../services/StorageService");
const errorHandler_1 = require("../middleware/errorHandler");
const auth_1 = require("../middleware/auth");
const logger_1 = require("../utils/logger");
const uuid_1 = require("uuid");
const router = (0, express_1.Router)();
// v1 statuses: 'pending', 'uploaded', 'needs_review', 'processed', 'failed'
const PROCESSING_STATUS = {
    PENDING: 'pending',
    UPLOADED: 'uploaded',
    NEEDS_REVIEW: 'needs_review',
    PROCESSED: 'processed',
    FAILED: 'failed'
};
/**
 * POST /api/receipts/create-upload
 * Returns a pre-signed upload URL + receipt_id
 */
router.post('/create-upload', auth_1.requireAuth, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { fileName, contentType } = req.body;
    const user = req.user;
    const restaurantId = user.restaurantId;
    if (!fileName || !contentType) {
        throw new errorHandler_1.BadRequestError('fileName and contentType are required');
    }
    const db = DatabaseService_1.DatabaseService.getInstance().getDatabase();
    const storageService = StorageService_1.StorageService.getInstance();
    const storageKey = storageService.generateReceiptKey(restaurantId, fileName);
    const uploadUrl = await storageService.getAdapter().getUploadUrl(storageKey, contentType);
    // 3. Create initial receipt record
    const receiptId = (0, uuid_1.v4)();
    await db.run(`INSERT INTO receipts (
      id, restaurant_id, uploaded_by, storage_key, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`, [
        receiptId,
        restaurantId,
        user.id,
        storageKey,
        PROCESSING_STATUS.PENDING
    ]);
    await DatabaseService_1.DatabaseService.getInstance().logAudit(restaurantId, user.id, 'receipt_upload_initiated', 'receipt', receiptId, { fileName, storageKey });
    res.json({
        success: true,
        data: {
            receiptId,
            uploadUrl,
            storageKey
        }
    });
}));
/**
 * POST /api/receipts/:id/confirm-upload
 * Marks receipt as uploaded and stores final metadata
 */
router.post('/:id/confirm-upload', auth_1.requireAuth, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const { supplierName, totalAmount } = req.body;
    const user = req.user;
    const db = DatabaseService_1.DatabaseService.getInstance().getDatabase();
    // 1. Get receipt and verify ownership
    const receipt = await db.get('SELECT * FROM receipts WHERE id = ?', [id]);
    if (!receipt) {
        throw new errorHandler_1.BadRequestError('Receipt not found');
    }
    // Multi-tenant check
    if (receipt.restaurant_id !== user.restaurantId && !user.permissions.includes('*')) {
        throw new errorHandler_1.UnauthorizedError('User does not have access to this restaurant');
    }
    // 2. Update receipt status and metadata
    await db.run(`UPDATE receipts SET 
      status = ?, 
      supplier_name = ?, 
      total_amount = ?, 
      updated_at = CURRENT_TIMESTAMP 
     WHERE id = ?`, [
        PROCESSING_STATUS.NEEDS_REVIEW,
        supplierName || null,
        totalAmount || null,
        id
    ]);
    await DatabaseService_1.DatabaseService.getInstance().logAudit(receipt.restaurant_id, user.id, 'receipt_upload_confirmed', 'receipt', id, { supplierName, status: PROCESSING_STATUS.NEEDS_REVIEW });
    res.json({
        success: true,
        data: {
            receiptId: id,
            status: PROCESSING_STATUS.NEEDS_REVIEW,
            message: 'Receipt upload confirmed. Pending review/parsing.'
        }
    });
}));
/**
 * GET /api/receipts/list
 * List receipts for a restaurant with multi-tenant filtering
 */
router.get('/list', auth_1.requireAuth, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const user = req.user;
    const restaurantId = user.restaurantId;
    const db = DatabaseService_1.DatabaseService.getInstance().getDatabase();
    const receipts = await db.all('SELECT * FROM receipts WHERE restaurant_id = ? ORDER BY created_at DESC', [restaurantId]);
    // Generate temporary download URLs for preview
    const storageService = StorageService_1.StorageService.getInstance();
    const receiptsWithUrls = await Promise.all(receipts.map(async (r) => {
        let previewUrl = null;
        if (r.storage_key) {
            try {
                previewUrl = await storageService.getAdapter().getDownloadUrl(r.storage_key, 3600); // 1 hour link
            }
            catch (err) {
                logger_1.logger.error(`Failed to generate download URL for receipt ${r.id}`, err);
            }
        }
        return { ...r, previewUrl };
    }));
    res.json({
        success: true,
        data: {
            receipts: receiptsWithUrls
        }
    });
}));
/**
 * GET /api/receipts/:id
 * Get detailed receipt info with a fresh download URL
 */
router.get('/:id', auth_1.requireAuth, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const user = req.user;
    const db = DatabaseService_1.DatabaseService.getInstance().getDatabase();
    const receipt = await db.get('SELECT * FROM receipts WHERE id = ?', [id]);
    if (!receipt) {
        throw new errorHandler_1.BadRequestError('Receipt not found');
    }
    // Multi-tenant check
    if (receipt.restaurant_id !== user.restaurantId && !user.permissions.includes('*')) {
        throw new errorHandler_1.UnauthorizedError('User does not have access to this restaurant');
    }
    const storageService = StorageService_1.StorageService.getInstance();
    const downloadUrl = receipt.storage_key
        ? await storageService.getAdapter().getDownloadUrl(receipt.storage_key, 3600)
        : null;
    res.json({
        success: true,
        data: {
            ...receipt,
            downloadUrl
        }
    });
}));
/**
 * GET /api/receipts/:id/items
 * Get all line items for a receipt
 */
router.get('/:id/items', auth_1.requireAuth, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const user = req.user;
    const db = DatabaseService_1.DatabaseService.getInstance().getDatabase();
    // Verify access
    const receipt = await db.get('SELECT restaurant_id FROM receipts WHERE id = ?', [id]);
    if (!receipt)
        throw new errorHandler_1.BadRequestError('Receipt not found');
    if (receipt.restaurant_id !== user.restaurantId && !user.permissions.includes('*')) {
        throw new errorHandler_1.UnauthorizedError();
    }
    const items = await db.all(`SELECT ri.*, ii.name as matched_item_name, ii.unit as matched_item_unit 
     FROM receipt_line_items ri 
     LEFT JOIN inventory_items ii ON ri.inventory_item_id = ii.id 
     WHERE ri.receipt_id = ?`, [id]);
    res.json({ success: true, data: { items } });
}));
/**
 * POST /api/receipts/:id/items
 * Add a manual line item to a receipt
 */
router.post('/:id/items', auth_1.requireAuth, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const { description, quantity, unitCost, inventoryItemId } = req.body;
    const user = req.user;
    const db = DatabaseService_1.DatabaseService.getInstance().getDatabase();
    const itemId = (0, uuid_1.v4)();
    await db.run(`INSERT INTO receipt_line_items (
      id, receipt_id, description, quantity, unit_cost, total_price, inventory_item_id, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`, [
        itemId,
        id,
        description,
        quantity,
        unitCost,
        (quantity * unitCost) || 0,
        inventoryItemId || null
    ]);
    res.json({ success: true, data: { itemId } });
}));
/**
 * POST /api/receipts/:id/apply
 * Apply matched line items to inventory
 */
router.post('/:id/apply', auth_1.requireAuth, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const user = req.user;
    const db = DatabaseService_1.DatabaseService.getInstance().getDatabase();
    const dbService = DatabaseService_1.DatabaseService.getInstance();
    // 1. Get receipt and matched items
    const receipt = await db.get('SELECT * FROM receipts WHERE id = ?', [id]);
    if (!receipt)
        throw new errorHandler_1.BadRequestError('Receipt not found');
    if (receipt.restaurant_id !== user.restaurantId && !user.permissions.includes('*')) {
        throw new errorHandler_1.UnauthorizedError();
    }
    const items = await db.all('SELECT * FROM receipt_line_items WHERE receipt_id = ? AND inventory_item_id IS NOT NULL', [id]);
    if (items.length === 0) {
        throw new errorHandler_1.BadRequestError('No matched items to apply to inventory');
    }
    const results = [];
    for (const item of items) {
        // a. Create inventory transaction
        const transactionId = (0, uuid_1.v4)();
        await db.run(`INSERT INTO inventory_transactions (
        id, restaurant_id, inventory_item_id, type, quantity, reason, created_by, created_at
      ) VALUES (?, ?, ?, 'receive', ?, ?, ?, CURRENT_TIMESTAMP)`, [
            transactionId,
            receipt.restaurant_id,
            item.inventory_item_id,
            item.quantity,
            `Received from receipt ${receipt.id}`,
            user.id
        ]);
        // b. Update on_hand_qty
        await db.run('UPDATE inventory_items SET on_hand_qty = on_hand_qty + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [item.quantity, item.inventory_item_id]);
        results.push({ item: item.description, qty: item.quantity });
    }
    // 3. Mark receipt as processed
    await db.run("UPDATE receipts SET status = 'processed', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [id]);
    await dbService.logAudit(receipt.restaurant_id, user.id, 'receipt_applied_to_inventory', 'receipt', id, { appliedItemsCount: items.length, summary: results });
    res.json({
        success: true,
        data: {
            message: `Successfully applied ${items.length} items to inventory.`,
            summary: results
        }
    });
}));
exports.default = router;
//# sourceMappingURL=receipts.js.map