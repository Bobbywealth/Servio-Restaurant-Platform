import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../services/DatabaseService';
import { requirePlatformAdmin } from '../middleware/adminAuth';
import { logger } from '../utils/logger';

const router = express.Router();

// Apply platform admin auth to all admin routes
router.use(requirePlatformAdmin);

type PaginationPayload = {
  page: number;
  limit: number;
  total: number;
  pages: number;
};

/**
 * API contract: GET /api/admin/demo-bookings
 * Response: { bookings: AdminDemoBooking[] }
 */
type AdminDemoBooking = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  restaurant_name: string | null;
  booking_date: string;
  booking_time: string;
  timezone: string;
  notes: string | null;
  status: string;
  created_at: string;
};

/**
 * API contract: GET /api/admin/campaigns and GET /api/admin/restaurants/:id/campaigns
 * Response: { campaigns: AdminCampaign[], pagination: PaginationPayload }
 */
type AdminCampaign = {
  id: string;
  restaurant_id: string;
  restaurant_name: string | null;
  name: string;
  type: 'sms' | 'email' | string;
  status: string;
  message: string;
  scheduled_at: string | null;
  sent_at: string | null;
  total_recipients: number;
  successful_sends: number;
  failed_sends: number;
  created_at: string;
};

/**
 * API contract: GET /api/admin/audit-logs
 * Response: { logs: AdminAuditLog[], pagination: PaginationPayload }
 */
type AdminAuditLog = {
  id: string;
  restaurant_id: string | null;
  restaurant_name: string | null;
  user_id: string | null;
  user_name: string | null;
  user_role: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: string | null;
  created_at: string;
};

type CampaignFeedEventType = 'created' | 'approved' | 'disapproved' | 'sent';

type AdminCampaignEvent = {
  id: string;
  event_type: CampaignFeedEventType;
  action: string;
  label: string;
  campaign_id: string;
  campaign_name: string | null;
  restaurant_id: string | null;
  restaurant_name: string | null;
  timestamp: string;
  metadata: Record<string, any>;
  view_url: string;
};

const resolveLimit = (value: unknown, fallback = 50, max = 200): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(Math.floor(parsed), max);
};

const resolvePage = (value: unknown, fallback = 1): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.floor(parsed);
};

const resolveDays = (value: unknown, fallback = 30, max = 365): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(Math.floor(parsed), max);
};

const parseTableRows = (rows: any[]): any[] => {
  return rows.map((row) => {
    const parsed = { ...row };
    for (const key of ['metadata', 'details', 'target_criteria']) {
      if (typeof parsed[key] === 'string') {
        try {
          parsed[key] = JSON.parse(parsed[key]);
        } catch {
          // Keep raw string as-is for non-JSON payloads
        }
      }
    }
    return parsed;
  });
};

const normalizeCampaignEventType = (action: string): CampaignFeedEventType | null => {
  const normalizedAction = action.toLowerCase();

  if (normalizedAction === 'create_campaign' || normalizedAction === 'campaign_created') {
    return 'created';
  }

  if (normalizedAction === 'campaign_approved') {
    return 'approved';
  }

  if (normalizedAction === 'campaign_disapproved') {
    return 'disapproved';
  }

  if (normalizedAction === 'campaign_sent') {
    return 'sent';
  }

  return null;
};

const campaignEventLabel: Record<CampaignFeedEventType, string> = {
  created: 'Campaign created',
  approved: 'Campaign approved',
  disapproved: 'Campaign disapproved',
  sent: 'Campaign sent'
};

/**
 * GET /api/admin/demo-bookings
 * Get all demo bookings for a date range.
 */
router.get('/demo-bookings', async (req, res) => {
  try {
    const db = await DatabaseService.getInstance().getDatabase();
    const start = typeof req.query.start === 'string' ? req.query.start : undefined;
    const end = typeof req.query.end === 'string' ? req.query.end : undefined;

    // Supports either `demo_bookings` or `demo_requests` depending on environment schema.
    const tableCandidates = ['demo_bookings', 'demo_requests'];
    const existingTable = await db.get(
      `SELECT name FROM sqlite_master WHERE type='table' AND name IN (${tableCandidates.map(() => '?').join(',')}) LIMIT 1`,
      tableCandidates
    );

    if (!existingTable?.name) {
      return res.json({ bookings: [] as AdminDemoBooking[] });
    }

    const whereParts: string[] = [];
    const params: any[] = [];
    if (start) {
      whereParts.push(`CAST(booking_date AS DATE) >= CAST(? AS DATE)`);
      params.push(start);
    }
    if (end) {
      whereParts.push(`CAST(booking_date AS DATE) <= CAST(? AS DATE)`);
      params.push(end);
    }

    const whereClause = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';
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
        COALESCE(timezone, 'UTC') as timezone,
        notes,
        COALESCE(status, 'pending') as status,
        created_at
      FROM ${existingTable.name}
      ${whereClause}
      ORDER BY booking_date ASC, booking_time ASC
    `,
      params
    );

    return res.json({ bookings: bookings as AdminDemoBooking[] });
  } catch (error) {
    logger.error('Failed to get demo bookings:', error);
    return res.status(500).json({
      error: 'Failed to load demo bookings',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/admin/campaigns
 * Get campaigns across all restaurants with optional status filter.
 */
router.get('/campaigns', async (req, res) => {
  try {
    const db = await DatabaseService.getInstance().getDatabase();
    const page = resolvePage(req.query.page, 1);
    const limit = resolveLimit(req.query.limit, 100, 200);
    const offset = (page - 1) * limit;
    const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';

    const whereParts: string[] = [];
    const params: any[] = [];
    if (status) {
      whereParts.push('mc.status = ?');
      params.push(status);
    }
    const whereClause = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

    const campaigns = await db.all(
      `
      SELECT
        mc.id,
        mc.restaurant_id,
        r.name as restaurant_name,
        mc.name,
        mc.type,
        mc.status,
        mc.message,
        mc.scheduled_at,
        mc.sent_at,
        mc.total_recipients,
        mc.successful_sends,
        mc.failed_sends,
        mc.created_at
      FROM marketing_campaigns mc
      LEFT JOIN restaurants r ON r.id = mc.restaurant_id
      ${whereClause}
      ORDER BY mc.created_at DESC
      LIMIT ? OFFSET ?
    `,
      [...params, limit, offset]
    );

    const totalResult = await db.get(
      `SELECT COUNT(*) as total FROM marketing_campaigns mc ${whereClause}`,
      params
    );

    return res.json({
      campaigns: parseTableRows(campaigns) as AdminCampaign[],
      pagination: {
        page,
        limit,
        total: totalResult?.total || 0,
        pages: Math.ceil((totalResult?.total || 0) / limit)
      } as PaginationPayload
    });
  } catch (error) {
    logger.error('Failed to get admin campaigns:', error);
    return res.status(500).json({
      error: 'Failed to load campaigns',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/admin/audit-logs
 * Get platform-wide audit logs for admin surfaces.
 */
router.get('/audit-logs', async (req, res) => {
  try {
    const db = await DatabaseService.getInstance().getDatabase();
    const page = resolvePage(req.query.page, 1);
    const limit = resolveLimit(req.query.limit, 200, 500);
    const offset = (page - 1) * limit;
    const restaurantId = typeof req.query.restaurantId === 'string' ? req.query.restaurantId.trim() : '';
    const action = typeof req.query.action === 'string' ? req.query.action.trim() : '';

    const whereParts: string[] = [];
    const params: any[] = [];

    if (restaurantId) {
      whereParts.push('al.restaurant_id = ?');
      params.push(restaurantId);
    }

    if (action && action !== 'all') {
      whereParts.push('LOWER(al.action) LIKE LOWER(?)');
      params.push(`%${action}%`);
    }

    const whereClause = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

    const logs = await db.all(
      `
      SELECT
        al.id,
        al.restaurant_id,
        r.name as restaurant_name,
        al.user_id,
        u.name as user_name,
        u.role as user_role,
        al.action,
        al.entity_type,
        al.entity_id,
        al.details as metadata,
        al.created_at
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      LEFT JOIN restaurants r ON al.restaurant_id = r.id
      ${whereClause}
      ORDER BY al.created_at DESC
      LIMIT ? OFFSET ?
    `,
      [...params, limit, offset]
    );

    const totalResult = await db.get(
      `SELECT COUNT(*) as total FROM audit_logs al ${whereClause}`,
      params
    );

    return res.json({
      logs: parseTableRows(logs) as AdminAuditLog[],
      pagination: {
        page,
        limit,
        total: totalResult?.total || 0,
        pages: Math.ceil((totalResult?.total || 0) / limit)
      } as PaginationPayload
    });
  } catch (error) {
    logger.error('Failed to get admin audit logs:', error);
    return res.status(500).json({
      error: 'Failed to load audit logs',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/admin/campaign-events
 * Campaign event feed built from audit logs.
 */
router.get('/campaign-events', async (req, res) => {
  try {
    const db = await DatabaseService.getInstance().getDatabase();
    const limit = resolveLimit(req.query.limit, 25, 100);
    const restaurantId = typeof req.query.restaurantId === 'string' ? req.query.restaurantId.trim() : '';
    const campaignId = typeof req.query.campaignId === 'string' ? req.query.campaignId.trim() : '';
    const eventType = typeof req.query.eventType === 'string' ? req.query.eventType.trim().toLowerCase() : '';

    const whereParts: string[] = [
      `(
        al.action IN ('create_campaign', 'campaign_created', 'campaign_approved', 'campaign_disapproved', 'campaign_sent')
        OR (
          al.entity_type = 'marketing_campaign'
          AND LOWER(al.action) LIKE '%campaign%'
        )
      )`
    ];
    const params: any[] = [];

    if (restaurantId) {
      whereParts.push('al.restaurant_id = ?');
      params.push(restaurantId);
    }

    if (campaignId) {
      whereParts.push(`(
        al.entity_id = ?
        OR mc.id = ?
      )`);
      params.push(campaignId, campaignId);
    }

    const logs = await db.all(
      `
      SELECT
        al.id,
        al.action,
        al.restaurant_id,
        r.name as restaurant_name,
        COALESCE(mc.id, al.entity_id) as campaign_id,
        mc.name as campaign_name,
        al.details as metadata,
        al.created_at
      FROM audit_logs al
      LEFT JOIN restaurants r ON r.id = al.restaurant_id
      LEFT JOIN marketing_campaigns mc ON mc.id = al.entity_id
      WHERE ${whereParts.join(' AND ')}
      ORDER BY al.created_at DESC
      LIMIT ?
    `,
      [...params, limit]
    );

    const parsedLogs = parseTableRows(logs);
    let events = parsedLogs
      .map((log: any) => {
        const normalizedType = normalizeCampaignEventType(log.action || '');
        if (!normalizedType || !log.campaign_id) {
          return null;
        }

        return {
          id: log.id,
          event_type: normalizedType,
          action: log.action,
          label: campaignEventLabel[normalizedType],
          campaign_id: log.campaign_id,
          campaign_name: log.campaign_name || log.metadata?.name || null,
          restaurant_id: log.restaurant_id,
          restaurant_name: log.restaurant_name || null,
          timestamp: log.created_at,
          metadata: log.metadata && typeof log.metadata === 'object' ? log.metadata : {},
          view_url: log.restaurant_id
            ? `/admin/restaurants/${log.restaurant_id}?tab=campaigns&campaignId=${log.campaign_id}`
            : `/admin/campaigns?campaignId=${log.campaign_id}`
        } as AdminCampaignEvent;
      })
      .filter(Boolean) as AdminCampaignEvent[];

    if (eventType && eventType !== 'all') {
      events = events.filter((event) => event.event_type === eventType);
    }

    return res.json({ events });
  } catch (error) {
    logger.error('Failed to get campaign events feed:', error);
    return res.status(500).json({
      error: 'Failed to load campaign events',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/admin/system/health
 * System health payload tailored to frontend/pages/admin/system-health.tsx
 */
router.get('/system/health', async (req, res) => {
  try {
    const db = await DatabaseService.getInstance().getDatabase();

    const [failedJobsResult, recentErrors, storageErrors] = await Promise.all([
      db.get(`SELECT COUNT(*) as count FROM sync_jobs WHERE status = 'failed'`),
      db.all(`
        SELECT action, entity_type, entity_id, restaurant_id, created_at
        FROM audit_logs
        WHERE created_at >= NOW() - INTERVAL '24 hours'
          AND (
            LOWER(action) LIKE '%error%'
            OR LOWER(action) LIKE '%fail%'
            OR LOWER(action) LIKE '%exception%'
          )
        ORDER BY created_at DESC
        LIMIT 50
      `),
      db.all(`
        SELECT action, entity_type, entity_id, restaurant_id, created_at
        FROM audit_logs
        WHERE created_at >= NOW() - INTERVAL '24 hours'
          AND (
            LOWER(entity_type) LIKE '%storage%'
            OR LOWER(action) LIKE '%storage%'
            OR LOWER(action) LIKE '%upload%'
          )
        ORDER BY created_at DESC
        LIMIT 20
      `)
    ]);

    const failedJobs = Number(failedJobsResult?.count || 0);
    const status = failedJobs > 0 || recentErrors.length > 0 ? 'degraded' : 'operational';

    return res.json({
      status,
      failedJobs,
      recentErrors,
      storageErrors,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get system health:', error);
    return res.status(500).json({
      error: 'Failed to load system health',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/admin/jobs
 * Sync job list for admin monitoring surfaces.
 */
router.get('/jobs', async (req, res) => {
  try {
    const db = await DatabaseService.getInstance().getDatabase();
    const page = resolvePage(req.query.page, 1);
    const limit = resolveLimit(req.query.limit, 50, 200);
    const offset = (page - 1) * limit;
    const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';
    const days = resolveDays(req.query.days, 30, 180);

    const whereParts: string[] = [`sj.created_at >= NOW() - INTERVAL '${days} days'`];
    const params: any[] = [];
    if (status) {
      whereParts.push('sj.status = ?');
      params.push(status);
    }

    const whereClause = `WHERE ${whereParts.join(' AND ')}`;

    const jobs = await db.all(
      `
      SELECT
        sj.id,
        sj.restaurant_id,
        r.name as restaurant_name,
        sj.job_type,
        sj.status,
        sj.error_message,
        sj.created_at
      FROM sync_jobs sj
      LEFT JOIN restaurants r ON r.id = sj.restaurant_id
      ${whereClause}
      ORDER BY sj.created_at DESC
      LIMIT ? OFFSET ?
    `,
      [...params, limit, offset]
    );

    const totalResult = await db.get(
      `SELECT COUNT(*) as total FROM sync_jobs sj ${whereClause}`,
      params
    );

    return res.json({
      jobs,
      pagination: {
        page,
        limit,
        total: totalResult?.total || 0,
        pages: Math.ceil((totalResult?.total || 0) / limit)
      } as PaginationPayload
    });
  } catch (error) {
    logger.error('Failed to get admin jobs:', error);
    return res.status(500).json({
      error: 'Failed to load jobs',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/admin/orders
 * Get orders across all restaurants with pagination and filtering.
 */
router.get('/orders', async (req, res) => {
  try {
    const db = await DatabaseService.getInstance().getDatabase();
    const page = resolvePage(req.query.page, 1);
    const limit = resolveLimit(req.query.limit, 50, 200);
    const offset = (page - 1) * limit;
    const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';
    const restaurantId = typeof req.query.restaurantId === 'string' ? req.query.restaurantId.trim() : '';
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';

    const whereParts: string[] = [];
    const params: any[] = [];

    if (status && status !== 'all') {
      whereParts.push('o.status = ?');
      params.push(status);
    }

    if (restaurantId) {
      whereParts.push('o.restaurant_id = ?');
      params.push(restaurantId);
    }

    if (search) {
      whereParts.push(`(
        o.id::text ILIKE ?
        OR COALESCE(o.customer_name, '') ILIKE ?
        OR COALESCE(o.customer_phone, '') ILIKE ?
        OR COALESCE(r.name, '') ILIKE ?
      )`);
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    const whereClause = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

    const orders = await db.all(
      `
      SELECT
        o.id,
        o.restaurant_id,
        r.name AS restaurant_name,
        o.status,
        o.customer_name,
        o.customer_phone,
        o.total_amount,
        o.source,
        o.created_at
      FROM orders o
      LEFT JOIN restaurants r ON r.id = o.restaurant_id
      ${whereClause}
      ORDER BY o.created_at DESC
      LIMIT ? OFFSET ?
    `,
      [...params, limit, offset]
    );

    const totalResult = await db.get(
      `
      SELECT COUNT(*) as total
      FROM orders o
      LEFT JOIN restaurants r ON r.id = o.restaurant_id
      ${whereClause}
    `,
      params
    );

    return res.json({
      orders: orders as AdminOrderSummary[],
      pagination: {
        page,
        limit,
        total: totalResult?.total || 0,
        pages: Math.ceil((totalResult?.total || 0) / limit)
      } as PaginationPayload
    });
  } catch (error) {
    logger.error('Failed to get admin orders:', error);
    return res.status(500).json({
      error: 'Failed to load orders',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/admin/orders/:id
 * Get one order across all restaurants with restaurant metadata.
 */
router.get('/orders/:id', async (req, res) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const db = await DatabaseService.getInstance().getDatabase();

    const order = await db.get(
      `
      SELECT
        o.id,
        o.restaurant_id,
        r.name AS restaurant_name,
        o.status,
        o.customer_name,
        o.customer_phone,
        o.total_amount,
        o.source,
        o.created_at,
        o.subtotal,
        o.tax,
        o.fees,
        o.order_type,
        o.pickup_time,
        o.prep_time_minutes,
        o.call_id,
        o.items
      FROM orders o
      LEFT JOIN restaurants r ON r.id = o.restaurant_id
      WHERE o.id = ?
      LIMIT 1
    `,
      [id]
    );

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const parsedItems = typeof order.items === 'string' ? (() => {
      try {
        return JSON.parse(order.items);
      } catch {
        return [];
      }
    })() : (Array.isArray(order.items) ? order.items : []);

    return res.json({
      order: {
        ...order,
        items: parsedItems
      } as AdminOrderDetail
    });
  } catch (error) {
    logger.error('Failed to get admin order detail:', error);
    return res.status(500).json({
      error: 'Failed to load order',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/admin/platform-stats
 * Get high-level platform KPIs for admin dashboard
 */
router.get('/platform-stats', async (req, res) => {
  try {
    const db = await DatabaseService.getInstance().getDatabase();
    
    // Get platform-wide statistics
    const stats = await db.all(`
      SELECT 
        (SELECT COUNT(*) FROM restaurants WHERE is_active = true) as total_restaurants,
        (SELECT COUNT(*) FROM restaurants WHERE is_active = true AND updated_at > NOW() - INTERVAL '7 days') as active_restaurants_7d,
        (SELECT COUNT(*) FROM orders) as total_orders,
        (SELECT COUNT(*) FROM orders WHERE created_at > NOW() - INTERVAL '30 days') as orders_30d,
        (SELECT COUNT(*) FROM time_entries WHERE created_at > NOW() - INTERVAL '30 days') as timeclock_entries_30d,
        (SELECT COUNT(*) FROM inventory_transactions WHERE created_at > NOW() - INTERVAL '30 days') as inventory_transactions_30d,
        (SELECT COUNT(*) FROM audit_logs WHERE created_at > NOW() - INTERVAL '24 hours') as audit_events_24h
    `);

    // Get recent activity
    const recentActivity = await db.all(`
      SELECT 
        r.name as restaurant_name,
        r.id as restaurant_id,
        COUNT(o.id) as orders_today
      FROM restaurants r
      LEFT JOIN orders o ON r.id = o.restaurant_id AND o.created_at::date = CURRENT_DATE
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
 * GET /api/admin/recent-activity
 * Get recent platform activity across restaurants
 */
router.get('/recent-activity', async (req, res) => {
  try {
    const db = await DatabaseService.getInstance().getDatabase();
    const { limit = 20 } = req.query;

    const activities = await db.all(`
      SELECT *
      FROM (
        SELECT
          o.id,
          'order' AS type,
          'Order ' || o.id || ' (' || o.status || ')' AS message,
          o.created_at AS timestamp,
          r.name AS restaurant
        FROM orders o
        JOIN restaurants r ON r.id = o.restaurant_id

        UNION ALL

        SELECT
          te.id,
          'staff' AS type,
          'Staff clock-in recorded' AS message,
          te.created_at AS timestamp,
          r.name AS restaurant
        FROM time_entries te
        JOIN restaurants r ON r.id = te.restaurant_id

        UNION ALL

        SELECT
          it.id,
          'alert' AS type,
          'Inventory transaction: ' || COALESCE(it.reason, it.type, 'update') AS message,
          it.created_at AS timestamp,
          r.name AS restaurant
        FROM inventory_transactions it
        JOIN restaurants r ON r.id = it.restaurant_id

        UNION ALL

        SELECT
          al.id,
          'alert' AS type,
          'Audit event: ' || al.action AS message,
          al.created_at AS timestamp,
          r.name AS restaurant
        FROM audit_logs al
        JOIN restaurants r ON r.id = al.restaurant_id
      ) combined
      ORDER BY timestamp DESC
      LIMIT ?
    `, [Number(limit)]);

    res.json({ activities });
  } catch (error) {
    logger.error('Failed to get admin recent activity:', error);
    res.status(500).json({
      error: 'Failed to load recent activity',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/admin/analytics
 * Get cross-restaurant analytics for admin dashboard
 */
router.get('/analytics', async (req, res) => {
  try {
    const db = await DatabaseService.getInstance().getDatabase();
    const { days = 30 } = req.query;
    const windowDays = resolveDays(days, 30, 365);

    const revenueByRestaurant = await db.all(`
      SELECT
        r.name,
        COALESCE(SUM(o.total_amount), 0) AS revenue
      FROM restaurants r
      LEFT JOIN orders o
       ON r.id = o.restaurant_id
       AND o.created_at >= NOW() - INTERVAL '${windowDays} days'
      WHERE r.is_active = true
      GROUP BY r.id, r.name
      ORDER BY revenue DESC
      LIMIT 10
    `);

    const ordersByChannel = await db.all(`
      SELECT
        channel,
        COUNT(*) AS count
      FROM orders
      WHERE created_at >= NOW() - INTERVAL '${windowDays} days'
      GROUP BY channel
      ORDER BY count DESC
      LIMIT 10
    `);

    const hourlyDistribution = await db.all(`
      SELECT
        CAST(EXTRACT(HOUR FROM created_at) AS INTEGER) AS hour,
        COUNT(*) AS orders
      FROM orders
      WHERE created_at >= NOW() - INTERVAL '${windowDays} days'
      GROUP BY hour
      ORDER BY hour ASC
    `);

    res.json({
      revenueByRestaurant,
      ordersByChannel,
      hourlyDistribution
    });
  } catch (error) {
    logger.error('Failed to get admin analytics:', error);
    res.status(500).json({
      error: 'Failed to load analytics',
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
        COUNT(DISTINCT CASE WHEN o.created_at::date = CURRENT_DATE THEN o.id END) as orders_today,
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
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const db = await DatabaseService.getInstance().getDatabase();

    // Get restaurant overview
    const restaurant = await db.get(`
      SELECT 
        r.*,
        COUNT(DISTINCT u.id) as user_count,
        COUNT(DISTINCT o.id) as total_orders,
        COUNT(DISTINCT CASE WHEN o.created_at::date = CURRENT_DATE THEN o.id END) as orders_today,
        COUNT(DISTINCT CASE WHEN o.created_at >= NOW() - INTERVAL '7 days' THEN o.id END) as orders_7d,
        COUNT(DISTINCT CASE WHEN o.created_at >= NOW() - INTERVAL '30 days' THEN o.id END) as orders_30d,
        SUM(CASE WHEN o.created_at >= NOW() - INTERVAL '30 days' THEN o.total_amount END) as revenue_30d,
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
 * PATCH /api/admin/restaurants/:id/status
 * Soft-deactivate a restaurant while preserving historical records.
 */
router.patch('/restaurants/:id/status', async (req, res) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const db = await DatabaseService.getInstance().getDatabase();
    const actorId = req.user?.id ?? null;
    const actorRole = req.user?.role ?? null;
    const requestedStatus = typeof req.body?.status === 'string' ? req.body.status.trim().toLowerCase() : '';
    const nextStatus = requestedStatus === 'active' ? 'active' : 'inactive';
    const nextIsActive = nextStatus === 'active';

    const restaurant = await db.get('SELECT id, name, is_active FROM restaurants WHERE id = ?', [id]);
    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    if (!nextIsActive && restaurant.is_active) {
      const activeRestaurantsCount = await db.get(
        'SELECT COUNT(*) as total FROM restaurants WHERE is_active = true AND id <> ?',
        [id]
      );
      if (Number(activeRestaurantsCount?.total || 0) < 1) {
        return res.status(409).json({
          error: 'Cannot deactivate the last active restaurant',
          details: 'At least one active restaurant must remain on the platform'
        });
      }
    }

    await db.run(
      'UPDATE restaurants SET is_active = ?, updated_at = NOW() WHERE id = ?',
      [nextIsActive, id]
    );

    const userUpdateResult = await db.run(
      'UPDATE users SET is_active = ?, updated_at = NOW() WHERE restaurant_id = ?',
      [nextIsActive, id]
    );

    let campaignUpdateCount = 0;
    if (await hasColumn(db, 'marketing_campaigns', 'is_active')) {
      const campaignResult = await db.run(
        'UPDATE marketing_campaigns SET is_active = ?, updated_at = NOW() WHERE restaurant_id = ?',
        [nextIsActive, id]
      );
      campaignUpdateCount = Number(campaignResult?.changes || 0);
    }

    const auditId = uuidv4();
    const timestamp = new Date().toISOString();
    const action = nextIsActive ? 'restaurant.activated' : 'restaurant.deactivated';
    await db.run(
      'INSERT INTO audit_logs (id, restaurant_id, user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        auditId,
        id,
        actorId,
        action,
        'restaurant',
        id,
        JSON.stringify({
          actorId,
          actorRole,
          restaurantId: id,
          restaurantName: restaurant.name,
          timestamp,
          usersUpdated: Number(userUpdateResult?.changes || 0),
          campaignsUpdated: campaignUpdateCount,
          ordersRetained: true
        })
      ]
    );

    return res.json({
      message: nextIsActive ? 'Restaurant activated successfully' : 'Restaurant deactivated successfully',
      restaurant: {
        id,
        is_active: nextIsActive
      },
      relatedUpdates: {
        usersUpdated: Number(userUpdateResult?.changes || 0),
        campaignsUpdated: campaignUpdateCount,
        ordersRetained: true
      }
    });
  } catch (error) {
    logger.error('Failed to update restaurant status:', error);
    return res.status(500).json({
      error: 'Failed to update restaurant status',
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
    const windowDays = resolveDays(days, 30, 365);
    
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
        COALESCE(
          json_agg(
            json_build_object(
              'name', oi.name,
              'quantity', oi.quantity,
              'price', oi.price
            )
          ) FILTER (WHERE oi.id IS NOT NULL),
          '[]'::json
        ) as items
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE o.restaurant_id = ? 
        AND o.created_at >= NOW() - INTERVAL '${windowDays} days'
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
        AND created_at >= NOW() - INTERVAL '${windowDays} days'
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
 * GET /api/admin/restaurants/:id/campaigns
 * Get marketing campaigns for a specific restaurant.
 * Response: { campaigns: AdminCampaign[], pagination: PaginationPayload }
 */
router.get('/restaurants/:id/campaigns', async (req, res) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const page = resolvePage(req.query.page, 1);
    const limit = resolveLimit(req.query.limit, 50, 200);
    const offset = (page - 1) * limit;
    const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';
    const db = await DatabaseService.getInstance().getDatabase();

    const whereParts: string[] = ['mc.restaurant_id = ?'];
    const params: any[] = [id];
    if (status && status !== 'all') {
      whereParts.push('mc.status = ?');
      params.push(status);
    }

    const whereClause = `WHERE ${whereParts.join(' AND ')}`;

    const campaigns = await db.all(
      `
      SELECT
        mc.id,
        mc.restaurant_id,
        r.name as restaurant_name,
        mc.name,
        mc.type,
        mc.status,
        mc.message,
        mc.scheduled_at,
        mc.sent_at,
        mc.total_recipients,
        mc.successful_sends,
        mc.failed_sends,
        mc.created_at
      FROM marketing_campaigns mc
      LEFT JOIN restaurants r ON r.id = mc.restaurant_id
      ${whereClause}
      ORDER BY mc.created_at DESC
      LIMIT ? OFFSET ?
    `,
      [...params, limit, offset]
    );

    const totalResult = await db.get(
      `SELECT COUNT(*) as total FROM marketing_campaigns mc ${whereClause}`,
      params
    );

    return res.json({
      campaigns: parseTableRows(campaigns) as AdminCampaign[],
      pagination: {
        page,
        limit,
        total: totalResult?.total || 0,
        pages: Math.ceil((totalResult?.total || 0) / limit)
      } as PaginationPayload
    });
  } catch (error) {
    logger.error('Failed to get restaurant campaigns:', error);
    return res.status(500).json({
      error: 'Failed to load campaigns',
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
    const windowDays = resolveDays(days, 30, 365);
    
    const offset = (Number(page) - 1) * Number(limit);
    const db = await DatabaseService.getInstance().getDatabase();

    // Get voice-related audit logs
    const voiceActivity = await db.all(`
      SELECT 
        *
      FROM audit_logs
      WHERE restaurant_id = ?
        AND (action LIKE '%voice%' OR action LIKE '%vapi%' OR action LIKE '%assistant%')
        AND created_at >= NOW() - INTERVAL '${windowDays} days'
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `, [id, Number(limit), offset]);

    const totalResult = await db.get(`
      SELECT COUNT(*) as total 
      FROM audit_logs
      WHERE restaurant_id = ?
        AND (action LIKE '%voice%' OR action LIKE '%vapi%' OR action LIKE '%assistant%')
        AND created_at >= NOW() - INTERVAL '${windowDays} days'
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
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { page = 1, limit = 50, days = 30 } = req.query;
    const windowDays = resolveDays(days, 30, 365);
    
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
        AND it.created_at >= NOW() - INTERVAL '${windowDays} days'
      ORDER BY it.created_at DESC
      LIMIT ? OFFSET ?
    `, [id, Number(limit), offset]);

    const totalResult = await db.get(`
      SELECT COUNT(*) as total 
      FROM inventory_transactions
      WHERE restaurant_id = ?
        AND created_at >= NOW() - INTERVAL '${windowDays} days'
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
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { page = 1, limit = 50, days = 30 } = req.query;
    const windowDays = resolveDays(days, 30, 365);
    
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
        AND te.created_at >= NOW() - INTERVAL '${windowDays} days'
      ORDER BY te.created_at DESC
      LIMIT ? OFFSET ?
    `, [id, Number(limit), offset]);

    const totalResult = await db.get(`
      SELECT COUNT(*) as total 
      FROM time_entries
      WHERE restaurant_id = ?
        AND created_at >= NOW() - INTERVAL '${windowDays} days'
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
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { page = 1, limit = 50, days = 30, action = 'all' } = req.query;
    const windowDays = resolveDays(days, 30, 365);
    
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
        AND al.created_at >= NOW() - INTERVAL '${windowDays} days'
        ${actionClause}
      ORDER BY al.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, Number(limit), offset]);

    const totalResult = await db.get(`
      SELECT COUNT(*) as total 
      FROM audit_logs
      WHERE restaurant_id = ?
        AND created_at >= NOW() - INTERVAL '${windowDays} days'
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
