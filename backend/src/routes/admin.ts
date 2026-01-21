import express from 'express';
import { DatabaseService } from '../services/DatabaseService';
import { requirePlatformAdmin } from '../middleware/adminAuth';
import { logger } from '../utils/logger';

const router = express.Router();

// Apply platform admin auth to all admin routes
router.use(requirePlatformAdmin);

/**
 * GET /api/admin/stats/summary
 * Get platform-wide KPI summary for admin dashboard
 */
router.get('/stats/summary', async (req, res) => {
  try {
    const db = await DatabaseService.getInstance().getDatabase();
    
    // Get active restaurants count
    const activeRestaurants = await db.get(`
      SELECT COUNT(*) as count FROM restaurants WHERE is_active = true
    `);

    // Get orders today
    const ordersToday = await db.get(`
      SELECT COUNT(*) as count FROM orders WHERE date(created_at) = date('now')
    `);

    // Get voice calls today (from audit_logs or call_logs if exists)
    const voiceCallsToday = await db.get(`
      SELECT COUNT(*) as count 
      FROM audit_logs 
      WHERE (action LIKE '%voice%' OR action LIKE '%vapi%' OR action LIKE '%call%')
        AND date(created_at) = date('now')
    `);

    // Get pending campaign approvals
    const pendingCampaigns = await db.get(`
      SELECT COUNT(*) as count 
      FROM marketing_campaigns 
      WHERE status = 'draft' OR status = 'scheduled'
    `);

    // Get open shifts (time entries without clock out)
    const openShifts = await db.get(`
      SELECT COUNT(*) as count 
      FROM time_entries 
      WHERE clock_out_time IS NULL
    `);

    // Get failed jobs
    const failedJobs = await db.get(`
      SELECT COUNT(*) as count 
      FROM sync_jobs 
      WHERE status = 'failed'
    `);

    res.json({
      activeRestaurants: activeRestaurants?.count || 0,
      ordersToday: ordersToday?.count || 0,
      voiceCallsToday: voiceCallsToday?.count || 0,
      pendingCampaignApprovals: pendingCampaigns?.count || 0,
      openShifts: openShifts?.count || 0,
      failedJobs: failedJobs?.count || 0
    });

  } catch (error) {
    logger.error('Failed to get admin stats summary:', error);
    res.status(500).json({ 
      error: 'Failed to load platform statistics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/admin/demo-bookings?start=YYYY-MM-DD&end=YYYY-MM-DD
 * Admin: returns bookings (full details) for a date range
 */
router.get('/demo-bookings', async (req, res) => {
  try {
    const start = String(req.query.start || '');
    const end = String(req.query.end || '');

    if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
      return res.status(400).json({
        error: 'Invalid date range',
        message: 'Provide start and end in YYYY-MM-DD format'
      });
    }

    const db = await DatabaseService.getInstance().getDatabase();
    const bookings = await db.all(
      `
      SELECT
        id,
        name,
        email,
        phone,
        restaurant_name,
        booking_date,
        booking_time,
        timezone,
        notes,
        status,
        created_at
      FROM demo_bookings
      WHERE booking_date >= ? AND booking_date <= ?
      ORDER BY booking_date ASC, booking_time ASC
      `,
      [start, end]
    );

    res.json({ bookings });
  } catch (error) {
    logger.error('Failed to get demo bookings:', error);
    res.status(500).json({
      error: 'Failed to load demo bookings',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/admin/platform-stats (legacy endpoint, kept for backward compatibility)
 */
router.get('/platform-stats', async (req, res) => {
  try {
    const db = await DatabaseService.getInstance().getDatabase();
    
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

  } catch (error) {
    logger.error('Failed to get platform stats:', error);
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
    const db = await DatabaseService.getInstance().getDatabase();
    const { page = 1, limit = 50, search = '', status = 'all' } = req.query;
    
    const offset = (Number(page) - 1) * Number(limit);
    
    let whereClause = '1=1';
    const params: any[] = [];
    
    if (search) {
      whereClause += ` AND (r.name LIKE ? OR r.email LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }
    
    if (status === 'active') {
      whereClause += ` AND r.is_active = true`;
    } else if (status === 'inactive') {
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

  } catch (error) {
    logger.error('Failed to get restaurants list:', error);
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
    const { id } = req.params;
    const db = await DatabaseService.getInstance().getDatabase();

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

  } catch (error) {
    logger.error('Failed to get restaurant details:', error);
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
    const { id } = req.params;
    const { page = 1, limit = 50, status = 'all', days = 30 } = req.query;
    
    const offset = (Number(page) - 1) * Number(limit);
    const db = await DatabaseService.getInstance().getDatabase();

    let statusClause = '';
    const params: any[] = [id];
    
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

  } catch (error) {
    logger.error('Failed to get restaurant orders:', error);
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
    const { id } = req.params;
    const { page = 1, limit = 50, days = 30 } = req.query;
    
    const offset = (Number(page) - 1) * Number(limit);
    const db = await DatabaseService.getInstance().getDatabase();

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

  } catch (error) {
    logger.error('Failed to get voice activity:', error);
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
    const { id } = req.params;
    const { page = 1, limit = 50, days = 30 } = req.query;
    
    const offset = (Number(page) - 1) * Number(limit);
    const db = await DatabaseService.getInstance().getDatabase();

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

  } catch (error) {
    logger.error('Failed to get inventory transactions:', error);
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
    const { id } = req.params;
    const { page = 1, limit = 50, days = 30 } = req.query;
    
    const offset = (Number(page) - 1) * Number(limit);
    const db = await DatabaseService.getInstance().getDatabase();

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

  } catch (error) {
    logger.error('Failed to get time entries:', error);
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
    const { id } = req.params;
    const { page = 1, limit = 50, days = 30, action = 'all' } = req.query;
    
    const offset = (Number(page) - 1) * Number(limit);
    const db = await DatabaseService.getInstance().getDatabase();

    let actionClause = '';
    const params: any[] = [id];
    
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

  } catch (error) {
    logger.error('Failed to get audit logs:', error);
    res.status(500).json({ 
      error: 'Failed to load audit logs',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/admin/activity
 * Unified activity feed from audit_logs, sync_jobs, and notifications
 */
router.get('/activity', async (req, res) => {
  try {
    const { limit = 25 } = req.query;
    const db = await DatabaseService.getInstance().getDatabase();

    // Get unified activity from audit_logs
    const activity = await db.all(`
      SELECT 
        al.id,
        al.restaurant_id,
        al.action,
        al.entity_type,
        al.entity_id,
        al.metadata,
        al.created_at,
        r.name as restaurant_name,
        u.name as user_name,
        u.role as user_role,
        'audit' as source
      FROM audit_logs al
      LEFT JOIN restaurants r ON al.restaurant_id = r.id
      LEFT JOIN users u ON al.user_id = u.id
      ORDER BY al.created_at DESC
      LIMIT ?
    `, [Number(limit)]);

    res.json(activity);

  } catch (error) {
    logger.error('Failed to get activity feed:', error);
    res.status(500).json({ 
      error: 'Failed to load activity feed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/admin/campaigns
 * Get global campaign list with filters
 */
router.get('/campaigns', async (req, res) => {
  try {
    const { status, limit = 50, page = 1 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const db = await DatabaseService.getInstance().getDatabase();

    let whereClause = '1=1';
    const params: any[] = [];

    if (status) {
      if (status === 'pending_owner_approval') {
        whereClause += ` AND (status = 'draft' OR status = 'scheduled')`;
      } else {
        whereClause += ` AND status = ?`;
        params.push(status);
      }
    }

    const campaigns = await db.all(`
      SELECT 
        mc.*,
        r.name as restaurant_name,
        r.id as restaurant_id
      FROM marketing_campaigns mc
      LEFT JOIN restaurants r ON mc.restaurant_id = r.id
      WHERE ${whereClause}
      ORDER BY mc.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, Number(limit), offset]);

    const totalResult = await db.get(`
      SELECT COUNT(*) as total 
      FROM marketing_campaigns 
      WHERE ${whereClause}
    `, params);

    res.json({
      campaigns,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: totalResult?.total || 0,
        pages: Math.ceil((totalResult?.total || 0) / Number(limit))
      }
    });

  } catch (error) {
    logger.error('Failed to get campaigns:', error);
    res.status(500).json({ 
      error: 'Failed to load campaigns',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/admin/campaigns/:id
 * Get campaign details
 */
router.get('/campaigns/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = await DatabaseService.getInstance().getDatabase();

    const campaign = await db.get(`
      SELECT 
        mc.*,
        r.name as restaurant_name,
        r.id as restaurant_id
      FROM marketing_campaigns mc
      LEFT JOIN restaurants r ON mc.restaurant_id = r.id
      WHERE mc.id = ?
    `, [id]);

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    // Get send statistics
    const sendStats = await db.get(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'sent' THEN 1 END) as successful,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed
      FROM marketing_sends
      WHERE campaign_id = ?
    `, [id]);

    res.json({
      campaign,
      sendStats
    });

  } catch (error) {
    logger.error('Failed to get campaign details:', error);
    res.status(500).json({ 
      error: 'Failed to load campaign details',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/admin/orders
 * Global orders feed across all restaurants
 */
router.get('/orders', async (req, res) => {
  try {
    const { status, source, restaurant_id, limit = 50, page = 1 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const db = await DatabaseService.getInstance().getDatabase();

    let whereClause = '1=1';
    const params: any[] = [];

    if (status && status !== 'all') {
      whereClause += ` AND o.status = ?`;
      params.push(status);
    }

    if (source) {
      whereClause += ` AND o.source = ?`;
      params.push(source);
    }

    if (restaurant_id) {
      whereClause += ` AND o.restaurant_id = ?`;
      params.push(restaurant_id);
    }

    const orders = await db.all(`
      SELECT 
        o.*,
        r.name as restaurant_name,
        json_group_array(
          json_object(
            'name', oi.name,
            'quantity', oi.quantity,
            'price', oi.price
          )
        ) as items
      FROM orders o
      LEFT JOIN restaurants r ON o.restaurant_id = r.id
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE ${whereClause}
      GROUP BY o.id
      ORDER BY o.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, Number(limit), offset]);

    const totalResult = await db.get(`
      SELECT COUNT(*) as total 
      FROM orders o
      WHERE ${whereClause}
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

  } catch (error) {
    logger.error('Failed to get orders:', error);
    res.status(500).json({ 
      error: 'Failed to load orders',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/admin/system/health
 * System health summary
 */
router.get('/system/health', async (req, res) => {
  try {
    const db = await DatabaseService.getInstance().getDatabase();

    // DB connected check
    let dbConnected = true;
    try {
      await db.get('SELECT 1 as ok');
    } catch {
      dbConnected = false;
    }

    // Worker heartbeat (stale if > 90s old)
    const systemHealth = await db.get<any>(
      `SELECT worker_last_seen_at FROM system_health WHERE id = 'global'`
    ).catch(() => undefined);

    const workerLastSeenAt = systemHealth?.worker_last_seen_at || null;
    const workerHealthy = (() => {
      if (!workerLastSeenAt) return false;
      const last = new Date(workerLastSeenAt).getTime();
      if (Number.isNaN(last)) return false;
      return Date.now() - last <= 90_000;
    })();

    // Job backlog (pending jobs)
    const jobBacklog = await db.get<any>(
      `SELECT COUNT(*) as count FROM sync_jobs WHERE status = 'pending'`
    ).catch(() => ({ count: 0 }));

    // Error rate proxy last 1h (audit events with error/fail markers / all audit events)
    const auditTotal1h = await db.get<any>(
      `SELECT COUNT(*) as count FROM audit_logs WHERE created_at >= datetime('now', '-1 hour')`
    ).catch(() => ({ count: 0 }));
    const auditErrors1h = await db.get<any>(
      `SELECT COUNT(*) as count FROM audit_logs 
       WHERE created_at >= datetime('now', '-1 hour')
         AND (action LIKE '%error%' OR action LIKE '%fail%')`
    ).catch(() => ({ count: 0 }));

    const errorRateLast1h =
      (Number(auditTotal1h?.count || 0) > 0)
        ? Number(auditErrors1h?.count || 0) / Number(auditTotal1h.count)
        : 0;

    // Last Vapi call log received
    const lastVapiCallLog = await db.get<any>(
      `SELECT created_at FROM call_logs ORDER BY created_at DESC LIMIT 1`
    ).catch(() => undefined);

    // Last order created
    const lastOrder = await db.get<any>(
      `SELECT created_at FROM orders ORDER BY created_at DESC LIMIT 1`
    ).catch(() => undefined);

    // Last notification created
    const lastNotification = await db.get<any>(
      `SELECT created_at FROM notifications ORDER BY created_at DESC LIMIT 1`
    ).catch(() => undefined);

    // Get failed jobs count
    const failedJobs = await db.get(`
      SELECT COUNT(*) as count FROM sync_jobs WHERE status = 'failed'
    `);

    // Get recent errors from audit logs
    const recentErrors = await db.all(`
      SELECT 
        action,
        entity_type,
        restaurant_id,
        created_at
      FROM audit_logs
      WHERE action LIKE '%error%' OR action LIKE '%fail%'
      ORDER BY created_at DESC
      LIMIT 10
    `);

    // Get storage errors (if any)
    const storageErrors = await db.all(`
      SELECT * FROM audit_logs 
      WHERE action LIKE '%storage%' AND (action LIKE '%error%' OR action LIKE '%fail%')
      ORDER BY created_at DESC
      LIMIT 5
    `).catch(() => []);

    const overallStatus =
      !dbConnected
        ? 'down'
        : (!workerHealthy || Number(failedJobs?.count || 0) > 0)
            ? 'degraded'
            : 'operational';

    res.json({
      status: overallStatus,
      apiUp: true,
      dbConnected,
      worker: {
        healthy: workerHealthy,
        lastSeenAt: workerLastSeenAt
      },
      jobBacklogCount: Number(jobBacklog?.count || 0),
      errorRateLast1h,
      lastVapiCallLogReceivedAt: lastVapiCallLog?.created_at || null,
      lastOrderCreatedAt: lastOrder?.created_at || null,
      lastNotificationCreatedAt: lastNotification?.created_at || null,
      failedJobs: failedJobs?.count || 0,
      recentErrors: recentErrors || [],
      storageErrors: storageErrors || [],
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to get system health:', error);
    res.status(500).json({ 
      error: 'Failed to load system health',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/admin/jobs
 * Get sync jobs with status filter
 */
router.get('/jobs', async (req, res) => {
  try {
    const { status = 'failed', limit = 50, page = 1 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const db = await DatabaseService.getInstance().getDatabase();

    const jobs = await db.all(`
      SELECT 
        sj.*,
        r.name as restaurant_name
      FROM sync_jobs sj
      LEFT JOIN restaurants r ON sj.restaurant_id = r.id
      WHERE sj.status = ?
      ORDER BY sj.created_at DESC
      LIMIT ? OFFSET ?
    `, [status, Number(limit), offset]);

    const totalResult = await db.get(`
      SELECT COUNT(*) as total 
      FROM sync_jobs 
      WHERE status = ?
    `, [status]);

    res.json({
      jobs,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: totalResult?.total || 0,
        pages: Math.ceil((totalResult?.total || 0) / Number(limit))
      }
    });

  } catch (error) {
    logger.error('Failed to get jobs:', error);
    res.status(500).json({ 
      error: 'Failed to load jobs',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/admin/restaurants/:id/campaigns
 * Get campaigns for a specific restaurant
 */
router.get('/restaurants/:id/campaigns', async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const db = await DatabaseService.getInstance().getDatabase();

    const campaigns = await db.all(`
      SELECT * FROM marketing_campaigns
      WHERE restaurant_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `, [id, Number(limit), offset]);

    const totalResult = await db.get(`
      SELECT COUNT(*) as total 
      FROM marketing_campaigns 
      WHERE restaurant_id = ?
    `, [id]);

    res.json({
      campaigns,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: totalResult?.total || 0,
        pages: Math.ceil((totalResult?.total || 0) / Number(limit))
      }
    });

  } catch (error) {
    logger.error('Failed to get restaurant campaigns:', error);
    res.status(500).json({ 
      error: 'Failed to load campaigns',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/admin/restaurants/:id/audit
 * Get audit logs for a restaurant (alias for audit-logs)
 */
router.get('/restaurants/:id/audit', async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 50, days = 30, action = 'all' } = req.query;
    
    const offset = (Number(page) - 1) * Number(limit);
    const db = await DatabaseService.getInstance().getDatabase();

    let actionClause = '';
    const params: any[] = [id];
    
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

  } catch (error) {
    logger.error('Failed to get audit logs:', error);
    res.status(500).json({ 
      error: 'Failed to load audit logs',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;