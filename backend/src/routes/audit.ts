import { Router, Request, Response } from 'express';
import { DatabaseService } from '../services/DatabaseService';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();
const num = (v: any) => (typeof v === 'number' ? v : Number(v ?? 0));

/**
 * GET /api/audit/logs
 * Get audit logs with filtering and pagination
 */
router.get('/logs', asyncHandler(async (req: Request, res: Response) => {
  const {
    userId,
    action,
    entityType,
    source = 'all',
    limit = 100,
    offset = 0,
    startDate,
    endDate
  } = req.query;

  const db = DatabaseService.getInstance().getDatabase();
  const restaurantId = req.user?.restaurantId;

  let query = 'SELECT * FROM audit_logs';
  const params: any[] = [];
  const conditions: string[] = ['restaurant_id = ?'];
  params.push(restaurantId);

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
  const formattedLogs = logs.map((log: any) => ({
    ...log,
    details: JSON.parse(log.details || '{}')
  }));

  // Get total count
  let countQuery = 'SELECT COUNT(*) as total FROM audit_logs';
  const countParams: any[] = [];

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
router.get('/actions', asyncHandler(async (req: Request, res: Response) => {
  const db = DatabaseService.getInstance().getDatabase();

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
router.get('/users', asyncHandler(async (req: Request, res: Response) => {
  const db = DatabaseService.getInstance().getDatabase();

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
router.get('/stats', asyncHandler(async (req: Request, res: Response) => {
  const { period = 'today' } = req.query;
  const db = DatabaseService.getInstance().getDatabase();

  let dateCondition = '';
  switch (period) {
    case 'today':
      dateCondition = "date(created_at) = date('now')";
      break;
    case 'week':
      dateCondition = "created_at >= datetime('now', '-7 days')";
      break;
    case 'month':
      dateCondition = "created_at >= datetime('now', '-30 days')";
      break;
    default:
      dateCondition = "date(created_at) = date('now')";
  }

  const [
    totalActions,
    actionsByType,
    actionsByUser,
    actionsBySource,
    recentActivity
  ] = await Promise.all([
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

  const formattedRecentActivity = recentActivity.map((log: any) => ({
    ...log,
    details: JSON.parse(log.details || '{}')
  }));

  const stats = {
    period,
    totalActions: num(totalActions.count),
    actionsByType: actionsByType.reduce((acc: any, row: any) => {
      acc[row.action] = num(row.count);
      return acc;
    }, {}),
    actionsByUser: actionsByUser,
    actionsBySource: actionsBySource.reduce((acc: any, row: any) => {
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
router.get('/entity/:entityType/:entityId', asyncHandler(async (req: Request, res: Response) => {
  const { entityType, entityId } = req.params;
  const { limit = 50 } = req.query;

  const db = DatabaseService.getInstance().getDatabase();

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

  const formattedLogs = logs.map((log: any) => ({
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
router.post('/export', asyncHandler(async (req: Request, res: Response) => {
  const {
    format = 'json', // json, csv
    startDate,
    endDate,
    filters = {}
  } = req.body;

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
router.get('/download/:exportId', asyncHandler(async (req: Request, res: Response) => {
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

export default router;