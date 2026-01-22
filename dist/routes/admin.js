"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const DatabaseService_1 = require("../services/DatabaseService");
const adminAuth_1 = require("../middleware/adminAuth");
const logger_1 = require("../utils/logger");
const router = express_1.default.Router();
// Apply platform admin auth to all admin routes
router.use(adminAuth_1.requirePlatformAdmin);
/**
 * GET /api/admin/platform-stats
 * Get high-level platform KPIs for admin dashboard
 */
router.get('/platform-stats', async (req, res) => {
    try {
        const db = await DatabaseService_1.DatabaseService.getInstance().getDatabase();
        // Get platform-wide statistics
        const stats = await db.all(`
      SELECT 
        (SELECT COUNT(*) FROM restaurants WHERE is_active = true) as total_restaurants,
        (SELECT COUNT(*) FROM restaurants WHERE is_active = true AND updated_at > datetime('now', '-7 days')) as active_restaurants_7d,
        (SELECT COUNT(*) FROM orders) as total_orders,
        (SELECT COUNT(*) FROM orders WHERE created_at > datetime('now', '-30 days')) as orders_30d,
        (SELECT COUNT(*) FROM time_entries WHERE created_at > datetime('now', '-30 days')) as timeclock_entries_30d,
        (SELECT COUNT(*) FROM inventory_transactions WHERE created_at > datetime('now', '-30 days')) as inventory_transactions_30d,
        (SELECT COUNT(*) FROM audit_logs WHERE created_at > datetime('now', '-24 hours')) as audit_events_24h
    `);
        // Get recent activity
        const recentActivity = await db.all(`
      SELECT 
        r.name as restaurant_name,
        r.id as restaurant_id,
        COUNT(o.id) as orders_today
      FROM restaurants r
      LEFT JOIN orders o ON r.id = o.restaurant_id AND date(o.created_at) = date('now')
      WHERE r.is_active = true
      GROUP BY r.id, r.name
      ORDER BY orders_today DESC
      LIMIT 10
    `);
        res.json({
            stats: stats[0],
            recentActivity
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to get platform stats:', error);
        res.status(500).json({
            error: 'Failed to load platform statistics',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * GET /api/admin/restaurants
 * Get list of all restaurants for admin management
 */
router.get('/restaurants', async (req, res) => {
    try {
        const db = await DatabaseService_1.DatabaseService.getInstance().getDatabase();
        const { page = 1, limit = 50, search = '', status = 'all' } = req.query;
        const offset = (Number(page) - 1) * Number(limit);
        let whereClause = '1=1';
        const params = [];
        if (search) {
            whereClause += ` AND (r.name LIKE ? OR r.email LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`);
        }
        if (status === 'active') {
            whereClause += ` AND r.is_active = true`;
        }
        else if (status === 'inactive') {
            whereClause += ` AND r.is_active = false`;
        }
        const restaurants = await db.all(`
      SELECT 
        r.*,
        COUNT(DISTINCT u.id) as user_count,
        COUNT(DISTINCT o.id) as total_orders,
        COUNT(DISTINCT CASE WHEN date(o.created_at) = date('now') THEN o.id END) as orders_today,
        MAX(o.created_at) as last_order_at,
        COUNT(DISTINCT CASE WHEN u.role = 'owner' THEN u.id END) as owner_count
      FROM restaurants r
      LEFT JOIN users u ON r.id = u.restaurant_id AND u.is_active = true
      LEFT JOIN orders o ON r.id = o.restaurant_id
      WHERE ${whereClause}
      GROUP BY r.id
      ORDER BY r.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, Number(limit), offset]);
        // Get total count for pagination
        const totalResult = await db.get(`
      SELECT COUNT(*) as total 
      FROM restaurants r 
      WHERE ${whereClause}
    `, params);
        res.json({
            restaurants,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total: totalResult?.total || 0,
                pages: Math.ceil((totalResult?.total || 0) / Number(limit))
            }
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to get restaurants list:', error);
        res.status(500).json({
            error: 'Failed to load restaurants',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * GET /api/admin/restaurants/:id
 * Get detailed information about a specific restaurant
 */
router.get('/restaurants/:id', async (req, res) => {
    try {
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const db = await DatabaseService_1.DatabaseService.getInstance().getDatabase();
        // Get restaurant overview
        const restaurant = await db.get(`
      SELECT 
        r.*,
        COUNT(DISTINCT u.id) as user_count,
        COUNT(DISTINCT o.id) as total_orders,
        COUNT(DISTINCT CASE WHEN date(o.created_at) = date('now') THEN o.id END) as orders_today,
        COUNT(DISTINCT CASE WHEN date(o.created_at) >= date('now', '-7 days') THEN o.id END) as orders_7d,
        COUNT(DISTINCT CASE WHEN date(o.created_at) >= date('now', '-30 days') THEN o.id END) as orders_30d,
        SUM(CASE WHEN date(o.created_at) >= date('now', '-30 days') THEN o.total_amount END) as revenue_30d,
        MAX(o.created_at) as last_order_at
      FROM restaurants r
      LEFT JOIN users u ON r.id = u.restaurant_id AND u.is_active = true
      LEFT JOIN orders o ON r.id = o.restaurant_id
      WHERE r.id = ?
      GROUP BY r.id
    `, [id]);
        if (!restaurant) {
            return res.status(404).json({ error: 'Restaurant not found' });
        }
        // Get users breakdown
        const userBreakdown = await db.all(`
      SELECT 
        role,
        COUNT(*) as count,
        COUNT(CASE WHEN is_active THEN 1 END) as active_count
      FROM users 
      WHERE restaurant_id = ?
      GROUP BY role
    `, [id]);
        res.json({
            restaurant,
            userBreakdown
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to get restaurant details:', error);
        res.status(500).json({
            error: 'Failed to load restaurant details',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * GET /api/admin/restaurants/:id/orders
 * Get orders for a specific restaurant (admin view)
 */
router.get('/restaurants/:id/orders', async (req, res) => {
    try {
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const { page = 1, limit = 50, status = 'all', days = 30 } = req.query;
        const offset = (Number(page) - 1) * Number(limit);
        const db = await DatabaseService_1.DatabaseService.getInstance().getDatabase();
        let statusClause = '';
        const params = [id];
        if (status !== 'all') {
            statusClause = ` AND o.status = ?`;
            params.push(status);
        }
        const orders = await db.all(`
      SELECT 
        o.*,
        json_group_array(
          json_object(
            'name', oi.name,
            'quantity', oi.quantity,
            'price', oi.price
          )
        ) as items
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE o.restaurant_id = ? 
        AND o.created_at >= date('now', '-${Number(days)} days')
        ${statusClause}
      GROUP BY o.id
      ORDER BY o.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, Number(limit), offset]);
        // Get total count
        const totalResult = await db.get(`
      SELECT COUNT(*) as total 
      FROM orders 
      WHERE restaurant_id = ? 
        AND created_at >= date('now', '-${Number(days)} days')
        ${statusClause}
    `, params);
        res.json({
            orders,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total: totalResult?.total || 0,
                pages: Math.ceil((totalResult?.total || 0) / Number(limit))
            }
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to get restaurant orders:', error);
        res.status(500).json({
            error: 'Failed to load orders',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * GET /api/admin/restaurants/:id/voice-activity
 * Get voice/Vapi activity logs for restaurant
 */
router.get('/restaurants/:id/voice-activity', async (req, res) => {
    try {
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const { page = 1, limit = 50, days = 30 } = req.query;
        const offset = (Number(page) - 1) * Number(limit);
        const db = await DatabaseService_1.DatabaseService.getInstance().getDatabase();
        // Get voice-related audit logs
        const voiceActivity = await db.all(`
      SELECT 
        *
      FROM audit_logs
      WHERE restaurant_id = ?
        AND (action LIKE '%voice%' OR action LIKE '%vapi%' OR action LIKE '%assistant%')
        AND created_at >= date('now', '-${Number(days)} days')
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `, [id, Number(limit), offset]);
        const totalResult = await db.get(`
      SELECT COUNT(*) as total 
      FROM audit_logs
      WHERE restaurant_id = ?
        AND (action LIKE '%voice%' OR action LIKE '%vapi%' OR action LIKE '%assistant%')
        AND created_at >= date('now', '-${Number(days)} days')
    `, [id]);
        res.json({
            voiceActivity,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total: totalResult?.total || 0,
                pages: Math.ceil((totalResult?.total || 0) / Number(limit))
            }
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to get voice activity:', error);
        res.status(500).json({
            error: 'Failed to load voice activity',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * GET /api/admin/restaurants/:id/inventory-transactions
 * Get inventory transaction history for restaurant
 */
router.get('/restaurants/:id/inventory-transactions', async (req, res) => {
    try {
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const { page = 1, limit = 50, days = 30 } = req.query;
        const offset = (Number(page) - 1) * Number(limit);
        const db = await DatabaseService_1.DatabaseService.getInstance().getDatabase();
        const transactions = await db.all(`
      SELECT 
        it.*,
        ii.name as item_name,
        u.name as user_name
      FROM inventory_transactions it
      LEFT JOIN inventory_items ii ON it.item_id = ii.id
      LEFT JOIN users u ON it.user_id = u.id
      WHERE it.restaurant_id = ?
        AND it.created_at >= date('now', '-${Number(days)} days')
      ORDER BY it.created_at DESC
      LIMIT ? OFFSET ?
    `, [id, Number(limit), offset]);
        const totalResult = await db.get(`
      SELECT COUNT(*) as total 
      FROM inventory_transactions
      WHERE restaurant_id = ?
        AND created_at >= date('now', '-${Number(days)} days')
    `, [id]);
        res.json({
            transactions,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total: totalResult?.total || 0,
                pages: Math.ceil((totalResult?.total || 0) / Number(limit))
            }
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to get inventory transactions:', error);
        res.status(500).json({
            error: 'Failed to load inventory transactions',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * GET /api/admin/restaurants/:id/timeclock
 * Get time clock entries for restaurant
 */
router.get('/restaurants/:id/timeclock', async (req, res) => {
    try {
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const { page = 1, limit = 50, days = 30 } = req.query;
        const offset = (Number(page) - 1) * Number(limit);
        const db = await DatabaseService_1.DatabaseService.getInstance().getDatabase();
        const timeEntries = await db.all(`
      SELECT 
        te.*,
        u.name as user_name,
        u.role as user_role
      FROM time_entries te
      LEFT JOIN users u ON te.user_id = u.id
      WHERE te.restaurant_id = ?
        AND te.created_at >= date('now', '-${Number(days)} days')
      ORDER BY te.created_at DESC
      LIMIT ? OFFSET ?
    `, [id, Number(limit), offset]);
        const totalResult = await db.get(`
      SELECT COUNT(*) as total 
      FROM time_entries
      WHERE restaurant_id = ?
        AND created_at >= date('now', '-${Number(days)} days')
    `, [id]);
        res.json({
            timeEntries,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total: totalResult?.total || 0,
                pages: Math.ceil((totalResult?.total || 0) / Number(limit))
            }
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to get time entries:', error);
        res.status(500).json({
            error: 'Failed to load time entries',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * GET /api/admin/restaurants/:id/audit-logs
 * Get audit logs for restaurant
 */
router.get('/restaurants/:id/audit-logs', async (req, res) => {
    try {
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const { page = 1, limit = 50, days = 30, action = 'all' } = req.query;
        const offset = (Number(page) - 1) * Number(limit);
        const db = await DatabaseService_1.DatabaseService.getInstance().getDatabase();
        let actionClause = '';
        const params = [id];
        if (action !== 'all') {
            actionClause = ` AND action LIKE ?`;
            params.push(`%${action}%`);
        }
        const auditLogs = await db.all(`
      SELECT 
        al.*,
        u.name as user_name,
        u.role as user_role
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.restaurant_id = ?
        AND al.created_at >= date('now', '-${Number(days)} days')
        ${actionClause}
      ORDER BY al.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, Number(limit), offset]);
        const totalResult = await db.get(`
      SELECT COUNT(*) as total 
      FROM audit_logs
      WHERE restaurant_id = ?
        AND created_at >= date('now', '-${Number(days)} days')
        ${actionClause}
    `, params);
        res.json({
            auditLogs,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total: totalResult?.total || 0,
                pages: Math.ceil((totalResult?.total || 0) / Number(limit))
            }
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to get audit logs:', error);
        res.status(500).json({
            error: 'Failed to load audit logs',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
exports.default = router;
//# sourceMappingURL=admin.js.map