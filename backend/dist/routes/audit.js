"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const DatabaseService_1 = require("../services/DatabaseService");
const errorHandler_1 = require("../middleware/errorHandler");
const router = (0, express_1.Router)();
const num = (v) => (typeof v === 'number' ? v : Number(v ?? 0));
/**
 * GET /api/audit/logs
 * Get audit logs with filtering and pagination
 */
router.get('/logs', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { userId, action, entityType, source = 'all', limit = 100, offset = 0, startDate, endDate } = req.query;
    const db = DatabaseService_1.DatabaseService.getInstance().getDatabase();
    let query = 'SELECT * FROM audit_logs';
    const params = [];
    const conditions = [];
    if (userId) {
        conditions.push('user_id = ?');
        params.push(userId);
    }
    if (action) {
        conditions.push('action = ?');
        params.push(action);
    }
    if (entityType) {
        conditions.push('entity_type = ?');
        params.push(entityType);
    }
    if (source && source !== 'all') {
        conditions.push('source = ?');
        params.push(source);
    }
    if (startDate) {
        conditions.push('created_at >= ?');
        params.push(startDate);
    }
    if (endDate) {
        conditions.push('created_at <= ?');
        params.push(endDate);
    }
    if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));
    const logs = await db.all(query, params);
    // Parse JSON details
    const formattedLogs = logs.map((log) => ({
        ...log,
        details: JSON.parse(log.details || '{}')
    }));
    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM audit_logs';
    const countParams = [];
    if (conditions.length > 0) {
        countQuery += ' WHERE ' + conditions.join(' AND ');
        // Remove the limit/offset params for count query
        countParams.push(...params.slice(0, -2));
    }
    const countResult = await db.get(countQuery, countParams);
    res.json({
        success: true,
        data: {
            logs: formattedLogs,
            pagination: {
                total: countResult.total,
                limit: Number(limit),
                offset: Number(offset),
                hasMore: countResult.total > Number(offset) + formattedLogs.length
            }
        }
    });
}));
/**
 * GET /api/audit/actions
 * Get list of available audit actions
 */
router.get('/actions', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const db = DatabaseService_1.DatabaseService.getInstance().getDatabase();
    const actions = await db.all(`
    SELECT DISTINCT action, COUNT(*) as count
    FROM audit_logs
    GROUP BY action
    ORDER BY action
  `);
    res.json({
        success: true,
        data: actions
    });
}));
/**
 * GET /api/audit/users
 * Get users who have performed audited actions
 */
router.get('/users', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const db = DatabaseService_1.DatabaseService.getInstance().getDatabase();
    const users = await db.all(`
    SELECT 
      al.user_id,
      u.name as user_name,
      u.role as user_role,
      COUNT(*) as action_count,
      MAX(al.created_at) as last_action
    FROM audit_logs al
    LEFT JOIN users u ON al.user_id = u.id
    GROUP BY al.user_id, u.name, u.role
    ORDER BY action_count DESC
  `);
    res.json({
        success: true,
        data: users
    });
}));
/**
 * GET /api/audit/stats
 * Get audit statistics
 */
router.get('/stats', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { period = 'today' } = req.query;
    const db = DatabaseService_1.DatabaseService.getInstance().getDatabase();
    const dialect = DatabaseService_1.DatabaseService.getInstance().getDialect();
    let dateCondition = '';
    switch (period) {
        case 'today':
            dateCondition = dialect === 'postgres' ? 'created_at::date = CURRENT_DATE' : "DATE(created_at) = DATE('now')";
            break;
        case 'week':
            dateCondition =
                dialect === 'postgres'
                    ? "created_at >= (NOW() - INTERVAL '7 days')"
                    : "created_at >= datetime('now', '-7 days')";
            break;
        case 'month':
            dateCondition =
                dialect === 'postgres'
                    ? "created_at >= (NOW() - INTERVAL '30 days')"
                    : "created_at >= datetime('now', '-30 days')";
            break;
        default:
            dateCondition = dialect === 'postgres' ? 'created_at::date = CURRENT_DATE' : "DATE(created_at) = DATE('now')";
    }
    const [totalActions, actionsByType, actionsByUser, actionsBySource, recentActivity] = await Promise.all([
        db.get(`SELECT COUNT(*) as count FROM audit_logs WHERE ${dateCondition}`),
        db.all(`
      SELECT action, COUNT(*) as count 
      FROM audit_logs 
      WHERE ${dateCondition}
      GROUP BY action 
      ORDER BY count DESC 
      LIMIT 10
    `),
        db.all(`
      SELECT 
        al.user_id, 
        u.name as user_name,
        COUNT(*) as count 
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE ${dateCondition}
      GROUP BY al.user_id, u.name
      ORDER BY count DESC 
      LIMIT 10
    `),
        db.all(`
      SELECT source, COUNT(*) as count 
      FROM audit_logs 
      WHERE ${dateCondition}
      GROUP BY source 
      ORDER BY count DESC
    `),
        db.all(`
      SELECT 
        al.*,
        u.name as user_name
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE ${dateCondition}
      ORDER BY created_at DESC 
      LIMIT 20
    `)
    ]);
    const formattedRecentActivity = recentActivity.map((log) => ({
        ...log,
        details: JSON.parse(log.details || '{}')
    }));
    const stats = {
        period,
        totalActions: num(totalActions.count),
        actionsByType: actionsByType.reduce((acc, row) => {
            acc[row.action] = num(row.count);
            return acc;
        }, {}),
        actionsByUser: actionsByUser,
        actionsBySource: actionsBySource.reduce((acc, row) => {
            acc[row.source] = num(row.count);
            return acc;
        }, {}),
        recentActivity: formattedRecentActivity
    };
    res.json({
        success: true,
        data: stats
    });
}));
/**
 * GET /api/audit/entity/:entityType/:entityId
 * Get audit trail for a specific entity
 */
router.get('/entity/:entityType/:entityId', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { entityType, entityId } = req.params;
    const { limit = 50 } = req.query;
    const db = DatabaseService_1.DatabaseService.getInstance().getDatabase();
    const logs = await db.all(`
    SELECT 
      al.*,
      u.name as user_name
    FROM audit_logs al
    LEFT JOIN users u ON al.user_id = u.id
    WHERE entity_type = ? AND entity_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `, [entityType, entityId, Number(limit)]);
    const formattedLogs = logs.map((log) => ({
        ...log,
        details: JSON.parse(log.details || '{}')
    }));
    res.json({
        success: true,
        data: {
            entityType,
            entityId,
            auditTrail: formattedLogs
        }
    });
}));
/**
 * POST /api/audit/export
 * Export audit logs (generate downloadable report)
 */
router.post('/export', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { format = 'json', // json, csv
    startDate, endDate, filters = {} } = req.body;
    // In a real application, this would:
    // 1. Query the database with filters
    // 2. Generate the export file
    // 3. Store it temporarily or stream it back
    // 4. Return a download link or file stream
    const exportId = `export_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    // Mock export response
    res.json({
        success: true,
        data: {
            exportId,
            format,
            filters: { startDate, endDate, ...filters },
            status: 'generating',
            estimatedCompletion: '30 seconds',
            downloadUrl: `/api/audit/download/${exportId}`,
            message: 'Export is being generated. You will receive a download link shortly.'
        }
    });
}));
/**
 * GET /api/audit/download/:exportId
 * Download generated audit export
 */
router.get('/download/:exportId', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { exportId } = req.params;
    // In a real app, you would check if the export file exists and serve it
    // For demo purposes, return a mock response
    res.json({
        success: true,
        data: {
            exportId,
            status: 'ready',
            fileUrl: `${process.env.BACKEND_URL || 'http://localhost:3001'}/exports/${exportId}.json`,
            fileSize: '2.3 MB',
            recordCount: 1247,
            generatedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
        }
    });
}));
exports.default = router;
//# sourceMappingURL=audit.js.map