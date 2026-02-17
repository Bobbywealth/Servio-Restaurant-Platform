import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../services/DatabaseService';
import { requirePlatformAdmin } from '../middleware/adminAuth';
import { logger } from '../utils/logger';
import { randomUUID } from 'crypto';
import { CampaignModerationAction, isPlatformAdminOnly, resolveCampaignTransition } from './adminCampaignModeration';
import { buildSystemHealthPayload } from './systemHealth';
import { resolveBookingTable } from './bookings';

const router = express.Router();

// Apply platform admin auth to all admin routes
router.use(requirePlatformAdmin);

type PaginationPayload = {
  page: number;
  limit: number;
  total: number;
  pages: number;
};

type PlatformSettings = {
  maintenanceMode: boolean;
  maintenanceMessage: string;
  allowNewDemoBookings: boolean;
  defaultOrderPageSize: number;
  alertEmail: string;
};

const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  maintenanceMode: false,
  maintenanceMessage: 'Servio platform maintenance is in progress. Please check back shortly.',
  allowNewDemoBookings: true,
  defaultOrderPageSize: 50,
  alertEmail: 'ops@servio.solutions'
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

type AdminOrderSummary = {
  id: string;
  restaurant_id: string;
  restaurant_name: string | null;
  status: string;
  channel: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  total_amount: number;
  source: string | null;
  created_at: string;
  is_sla_breached?: boolean;
  sla_minutes_elapsed?: number;
};

type AdminOrderDetail = AdminOrderSummary & {
  subtotal: number | null;
  tax: number | null;
  fees: number | null;
  order_type: string | null;
  pickup_time: string | null;
  prep_time_minutes: number | null;
  call_id: string | null;
  items: any[];
  intervention_history?: AdminOrderIntervention[];
};

type AdminOrderIntervention = {
  id: string;
  action: string;
  user_id: string | null;
  user_name: string | null;
  details: Record<string, any> | string | null;
  created_at: string;
};

type AdminTask = {
  id: string;
  restaurant_id: string;
  restaurant_name: string | null;
  title: string;
  description: string | null;
  status: 'pending' | 'in_progress' | 'completed' | string;
  priority: 'low' | 'medium' | 'high' | string;
  type: string | null;
  assigned_to: string | null;
  assigned_to_name: string | null;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
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

const sanitizePlatformSettings = (input: any): PlatformSettings => {
  const parsedPageSize = Number(input?.defaultOrderPageSize);

  return {
    maintenanceMode: Boolean(input?.maintenanceMode),
    maintenanceMessage:
      typeof input?.maintenanceMessage === 'string' && input.maintenanceMessage.trim()
        ? input.maintenanceMessage.trim().slice(0, 300)
        : DEFAULT_PLATFORM_SETTINGS.maintenanceMessage,
    allowNewDemoBookings:
      input?.allowNewDemoBookings === undefined
        ? DEFAULT_PLATFORM_SETTINGS.allowNewDemoBookings
        : Boolean(input.allowNewDemoBookings),
    defaultOrderPageSize:
      Number.isFinite(parsedPageSize) && parsedPageSize >= 10 && parsedPageSize <= 200
        ? Math.floor(parsedPageSize)
        : DEFAULT_PLATFORM_SETTINGS.defaultOrderPageSize,
    alertEmail:
      typeof input?.alertEmail === 'string' && input.alertEmail.trim()
        ? input.alertEmail.trim().slice(0, 160)
        : DEFAULT_PLATFORM_SETTINGS.alertEmail
  };
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

const hasColumn = async (db: any, tableName: string, columnName: string): Promise<boolean> => {
  const result = await db.get(
    `
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = ?
        AND column_name = ?
      LIMIT 1
    `,
    [tableName, columnName]
  );

  return Boolean(result);
};

const ORDER_CANCELLABLE_STATUSES = new Set(['pending', 'accepted', 'preparing', 'ready']);
const ORDER_REOPENABLE_STATUSES = new Set(['cancelled']);
const ADMIN_INTERVENTION_ACTION_PREFIX = 'admin_order_';

const parseBooleanQuery = (value: unknown): boolean | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1') return true;
  if (normalized === 'false' || normalized === '0') return false;
  return null;
};

const resolveIdempotencyKey = (req: express.Request): string | null => {
  const headerValue = req.headers['x-idempotency-key'];
  if (Array.isArray(headerValue)) {
    return typeof headerValue[0] === 'string' ? headerValue[0].trim() : null;
  }
  return typeof headerValue === 'string' ? headerValue.trim() : null;
};

const readOrder = async (db: any, id: string) => db.get(
  `
    SELECT id, restaurant_id, status, customer_phone, customer_name
    FROM orders
    WHERE id = ?
    LIMIT 1
  `,
  [id]
);

const insertOrderAuditLog = async (
  db: any,
  params: {
    restaurantId: string;
    userId: string | null;
    orderId: string;
    action: string;
    details: Record<string, any>;
  }
) => {
  await db.run(
    `
      INSERT INTO audit_logs (id, restaurant_id, user_id, action, entity_type, entity_id, details)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [
      randomUUID(),
      params.restaurantId,
      params.userId,
      params.action,
      'order_admin_intervention',
      params.orderId,
      JSON.stringify(params.details)
    ]
  );
};

const findIdempotentIntervention = async (db: any, orderId: string, action: string, idempotencyKey: string) => {
  const existing = await db.get(
    `
      SELECT id, details, created_at
      FROM audit_logs
      WHERE entity_type = 'order_admin_intervention'
        AND entity_id = ?
        AND action = ?
        AND details LIKE ?
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [orderId, action, `%"idempotencyKey":"${idempotencyKey.replace(/"/g, '\\"')}"%`]
  );

  return existing || null;
};

const moderateCampaign = async (
  req: express.Request,
  res: express.Response,
  action: CampaignModerationAction
): Promise<express.Response | void> => {
  try {
    if (!isPlatformAdminOnly(req.user)) {
      return res.status(403).json({ error: 'Platform admin access required' });
    }

    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const db = await DatabaseService.getInstance().getDatabase();
    const campaign = await db.get(
      `
      SELECT id, restaurant_id, name, status, scheduled_at
      FROM marketing_campaigns
      WHERE id = ?
      LIMIT 1
    `,
      [id]
    );

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const nextStatus = resolveCampaignTransition({
      action,
      currentStatus: campaign.status,
      scheduledAt: campaign.scheduled_at
    });

    if (!nextStatus) {
      return res.status(409).json({
        error: `Cannot ${action} campaign in status '${campaign.status}'`
      });
    }

    await db.run(
      'UPDATE marketing_campaigns SET status = ?, updated_at = NOW() WHERE id = ?',
      [nextStatus, id]
    );

    const auditAction = action === 'approve' ? 'campaign_approved' : 'campaign_disapproved';
    await db.run(
      `
      INSERT INTO audit_logs (id, restaurant_id, user_id, action, entity_type, entity_id, details)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
      [
        randomUUID(),
        campaign.restaurant_id,
        req.user?.id ?? null,
        auditAction,
        'marketing_campaign',
        id,
        JSON.stringify({
          action,
          previousStatus: campaign.status,
          nextStatus,
          reason: action === 'disapprove' && typeof req.body?.reason === 'string' ? req.body.reason.trim() : null
        })
      ]
    );

    return res.json({
      success: true,
      campaign: {
        id,
        status: nextStatus
      }
    });
  } catch (error) {
    logger.error(`Failed to ${action} campaign:`, error);
    return res.status(500).json({
      error: `Failed to ${action} campaign`,
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
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

    const existingTable = await resolveBookingTable();

    if (!existingTable) {
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
      FROM ${existingTable}
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
 * POST /api/admin/campaigns/:id/approve
 * Transition pending owner approval campaigns into approved/scheduled.
 */
router.post('/campaigns/:id/approve', async (req, res) => {
  await moderateCampaign(req, res, 'approve');
});

/**
 * POST /api/admin/campaigns/:id/disapprove
 * Transition pending/approved campaigns into rejected with optional reason.
 */
router.post('/campaigns/:id/disapprove', async (req, res) => {
  await moderateCampaign(req, res, 'disapprove');
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

    const payload = await buildSystemHealthPayload({
      db,
      requestProtocol: req.protocol,
      requestHost: req.get('host')
    });

    return res.json(payload);
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

    const platformSettingsRow = await db.get<{ settings?: any }>(
      'SELECT settings FROM platform_settings WHERE id = ? LIMIT 1',
      ['default']
    );
    const platformRawSettings = typeof platformSettingsRow?.settings === 'string'
      ? (() => {
        try {
          return JSON.parse(platformSettingsRow.settings);
        } catch {
          return {};
        }
      })()
      : (platformSettingsRow?.settings || {});

    const platformSettings = sanitizePlatformSettings(platformRawSettings);
    const requestedLimit = req.query.limit === undefined
      ? platformSettings.defaultOrderPageSize
      : req.query.limit;
    const limit = resolveLimit(requestedLimit, platformSettings.defaultOrderPageSize, 200);
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

    const platformSettingsRow = await db.get<{ settings?: any }>(
      'SELECT settings FROM platform_settings WHERE id = ? LIMIT 1',
      ['default']
    );
    const platformRawSettings = typeof platformSettingsRow?.settings === 'string'
      ? (() => {
        try {
          return JSON.parse(platformSettingsRow.settings);
        } catch {
          return {};
        }
      })()
      : (platformSettingsRow?.settings || {});

    const platformSettings = sanitizePlatformSettings(platformRawSettings);
    const requestedLimit = req.query.limit === undefined
      ? platformSettings.defaultOrderPageSize
      : req.query.limit;
    const limit = resolveLimit(requestedLimit, platformSettings.defaultOrderPageSize, 200);
    const offset = (page - 1) * limit;
    const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';
    const restaurantId = typeof req.query.restaurantId === 'string' ? req.query.restaurantId.trim() : '';
    const channel = typeof req.query.channel === 'string' ? req.query.channel.trim() : '';
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const timeWindowHours = resolveLimit(req.query.timeWindowHours, 24 * 7, 24 * 30);
    const slaBreach = parseBooleanQuery(req.query.slaBreached);
    const slaMinutes = resolveLimit(req.query.slaMinutes, 15, 180);

    const whereParts: string[] = [`o.created_at >= NOW() - INTERVAL '${timeWindowHours} hours'`];
    const params: any[] = [];

    if (status && status !== 'all') {
      whereParts.push('o.status = ?');
      params.push(status);
    }

    if (channel && channel !== 'all') {
      whereParts.push('o.channel = ?');
      params.push(channel);
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

    if (slaBreach !== null) {
      whereParts.push(slaBreach ? `(o.status = ? AND o.created_at <= NOW() - INTERVAL '${slaMinutes} minutes')` : `(o.status != ? OR o.created_at > NOW() - INTERVAL '${slaMinutes} minutes')`);
      params.push('pending');
    }

    const whereClause = `WHERE ${whereParts.join(' AND ')}`;

    const orders = await db.all(
      `
      SELECT
        o.id,
        o.restaurant_id,
        r.name AS restaurant_name,
        o.status,
        o.channel,
        o.customer_name,
        o.customer_phone,
        o.total_amount,
        o.source,
        o.created_at,
        CASE
          WHEN o.status = 'pending' AND o.created_at <= NOW() - INTERVAL '${slaMinutes} minutes' THEN true
          ELSE false
        END AS is_sla_breached,
        FLOOR(EXTRACT(EPOCH FROM (NOW() - o.created_at)) / 60)::INTEGER AS sla_minutes_elapsed
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
        o.channel,
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

    const interventionLogs = await db.all(
      `
      SELECT
        al.id,
        al.action,
        al.user_id,
        u.name AS user_name,
        al.details,
        al.created_at
      FROM audit_logs al
      LEFT JOIN users u ON u.id = al.user_id
      WHERE al.entity_type = 'order_admin_intervention'
        AND al.entity_id = ?
      ORDER BY al.created_at DESC
      LIMIT 200
      `,
      [id]
    );

    const parsedInterventionLogs = interventionLogs.map((entry: any) => {
      let details: Record<string, any> | string | null = entry.details;
      if (typeof entry.details === 'string') {
        try {
          details = JSON.parse(entry.details);
        } catch {
          details = entry.details;
        }
      }

      return {
        ...entry,
        details
      } as AdminOrderIntervention;
    });

    return res.json({
      order: {
        ...order,
        items: parsedItems,
        intervention_history: parsedInterventionLogs
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
 * POST /api/admin/orders/:id/cancel
 * Cancel an order with strict transition checks and idempotency support.
 */
router.post('/orders/:id/cancel', async (req, res) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 500) : '';
    if (!reason) {
      return res.status(400).json({ error: 'Cancellation reason is required' });
    }

    const idempotencyKey = resolveIdempotencyKey(req);
    if (!idempotencyKey) {
      return res.status(400).json({ error: 'x-idempotency-key header is required' });
    }

    const db = await DatabaseService.getInstance().getDatabase();
    const existing = await findIdempotentIntervention(db, id, `${ADMIN_INTERVENTION_ACTION_PREFIX}cancelled`, idempotencyKey);
    if (existing) {
      return res.json({ success: true, idempotentReplay: true, orderId: id, status: 'cancelled' });
    }

    const order = await readOrder(db, id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (!ORDER_CANCELLABLE_STATUSES.has(order.status)) {
      return res.status(409).json({ error: `Cannot cancel order in status '${order.status}'` });
    }

    await db.run('UPDATE orders SET status = ?, updated_at = NOW() WHERE id = ?', ['cancelled', id]);
    await insertOrderAuditLog(db, {
      restaurantId: order.restaurant_id,
      userId: req.user?.id ?? null,
      orderId: id,
      action: `${ADMIN_INTERVENTION_ACTION_PREFIX}cancelled`,
      details: {
        idempotencyKey,
        reason,
        previousStatus: order.status,
        nextStatus: 'cancelled'
      }
    });

    return res.json({ success: true, orderId: id, previousStatus: order.status, status: 'cancelled' });
  } catch (error) {
    logger.error('Failed to cancel admin order:', error);
    return res.status(500).json({
      error: 'Failed to cancel order',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/admin/orders/:id/reopen
 */
router.post('/orders/:id/reopen', async (req, res) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 500) : '';
    if (!reason) {
      return res.status(400).json({ error: 'Reopen reason is required' });
    }

    const idempotencyKey = resolveIdempotencyKey(req);
    if (!idempotencyKey) {
      return res.status(400).json({ error: 'x-idempotency-key header is required' });
    }

    const db = await DatabaseService.getInstance().getDatabase();
    const existing = await findIdempotentIntervention(db, id, `${ADMIN_INTERVENTION_ACTION_PREFIX}reopened`, idempotencyKey);
    if (existing) {
      return res.json({ success: true, idempotentReplay: true, orderId: id, status: 'pending' });
    }

    const order = await readOrder(db, id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (!ORDER_REOPENABLE_STATUSES.has(order.status)) {
      return res.status(409).json({ error: `Cannot reopen order in status '${order.status}'` });
    }

    await db.run('UPDATE orders SET status = ?, updated_at = NOW() WHERE id = ?', ['pending', id]);
    await insertOrderAuditLog(db, {
      restaurantId: order.restaurant_id,
      userId: req.user?.id ?? null,
      orderId: id,
      action: `${ADMIN_INTERVENTION_ACTION_PREFIX}reopened`,
      details: {
        idempotencyKey,
        reason,
        previousStatus: order.status,
        nextStatus: 'pending'
      }
    });

    return res.json({ success: true, orderId: id, previousStatus: order.status, status: 'pending' });
  } catch (error) {
    logger.error('Failed to reopen admin order:', error);
    return res.status(500).json({
      error: 'Failed to reopen order',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/admin/orders/:id/resend-confirmation
 */
router.post('/orders/:id/resend-confirmation', async (req, res) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const channel = typeof req.body?.channel === 'string' ? req.body.channel.trim().toLowerCase() : '';
    if (!['sms', 'email'].includes(channel)) {
      return res.status(400).json({ error: "channel must be one of 'sms' or 'email'" });
    }

    const idempotencyKey = resolveIdempotencyKey(req);
    if (!idempotencyKey) {
      return res.status(400).json({ error: 'x-idempotency-key header is required' });
    }

    const db = await DatabaseService.getInstance().getDatabase();
    const action = `${ADMIN_INTERVENTION_ACTION_PREFIX}resent_${channel}_confirmation`;
    const existing = await findIdempotentIntervention(db, id, action, idempotencyKey);
    if (existing) {
      return res.json({ success: true, idempotentReplay: true, orderId: id, channel });
    }

    const order = await readOrder(db, id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.status === 'cancelled') {
      return res.status(409).json({ error: 'Cannot resend confirmation for a cancelled order' });
    }

    await insertOrderAuditLog(db, {
      restaurantId: order.restaurant_id,
      userId: req.user?.id ?? null,
      orderId: id,
      action,
      details: {
        idempotencyKey,
        channel,
        providerStatus: 'queued'
      }
    });

    return res.json({ success: true, orderId: id, channel, deliveryStatus: 'queued' });
  } catch (error) {
    logger.error('Failed to resend order confirmation:', error);
    return res.status(500).json({
      error: 'Failed to resend confirmation',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.post('/orders/:id/notes', async (req, res) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const note = typeof req.body?.note === 'string' ? req.body.note.trim().slice(0, 2000) : '';
    if (!note) {
      return res.status(400).json({ error: 'note is required' });
    }

    const db = await DatabaseService.getInstance().getDatabase();
    const order = await readOrder(db, id);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    await insertOrderAuditLog(db, {
      restaurantId: order.restaurant_id,
      userId: req.user?.id ?? null,
      orderId: id,
      action: `${ADMIN_INTERVENTION_ACTION_PREFIX}note_added`,
      details: { note }
    });

    return res.json({ success: true });
  } catch (error) {
    logger.error('Failed to add order intervention note:', error);
    return res.status(500).json({
      error: 'Failed to add order note',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.post('/orders/:id/escalate', async (req, res) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const target = typeof req.body?.target === 'string' ? req.body.target.trim().toLowerCase() : '';
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 500) : '';
    if (!['owner', 'support_queue'].includes(target)) {
      return res.status(400).json({ error: "target must be 'owner' or 'support_queue'" });
    }
    if (!reason) {
      return res.status(400).json({ error: 'Escalation reason is required' });
    }

    const db = await DatabaseService.getInstance().getDatabase();
    const order = await readOrder(db, id);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    await insertOrderAuditLog(db, {
      restaurantId: order.restaurant_id,
      userId: req.user?.id ?? null,
      orderId: id,
      action: `${ADMIN_INTERVENTION_ACTION_PREFIX}escalated`,
      details: { target, reason }
    });

    return res.json({ success: true, orderId: id, target });
  } catch (error) {
    logger.error('Failed to escalate order issue:', error);
    return res.status(500).json({
      error: 'Failed to escalate order',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.post('/orders/bulk/cancel-stale', async (req, res) => {
  try {
    const staleMinutes = resolveLimit(req.body?.staleMinutes, 45, 24 * 60);
    const idempotencyKey = resolveIdempotencyKey(req);
    if (!idempotencyKey) {
      return res.status(400).json({ error: 'x-idempotency-key header is required' });
    }

    const db = await DatabaseService.getInstance().getDatabase();
    const existing = await db.get(
      `
      SELECT id FROM audit_logs
      WHERE entity_type = 'order_admin_intervention'
        AND action = ?
        AND details LIKE ?
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [`${ADMIN_INTERVENTION_ACTION_PREFIX}bulk_cancel_stale`, `%"idempotencyKey":"${idempotencyKey.replace(/"/g, '\\\"')}"%`]
    );
    if (existing) {
      return res.json({ success: true, idempotentReplay: true, cancelledOrderIds: [] });
    }

    const staleOrders = await db.all(
      `
      SELECT id, restaurant_id, status
      FROM orders
      WHERE status = 'pending'
        AND created_at <= NOW() - INTERVAL '${staleMinutes} minutes'
      `
    );

    const cancellableOrders = staleOrders.filter((order: any) => ORDER_CANCELLABLE_STATUSES.has(order.status));
    const cancelledOrderIds = cancellableOrders.map((order: any) => order.id);

    if (cancelledOrderIds.length > 0) {
      await db.run(
        `
        UPDATE orders
        SET status = 'cancelled', updated_at = NOW()
        WHERE id IN (${cancelledOrderIds.map(() => '?').join(',')})
        `,
        cancelledOrderIds
      );
    }

    await db.run(
      `
      INSERT INTO audit_logs (id, restaurant_id, user_id, action, entity_type, entity_id, details)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        randomUUID(),
        null,
        req.user?.id ?? null,
        `${ADMIN_INTERVENTION_ACTION_PREFIX}bulk_cancel_stale`,
        'order_admin_intervention',
        null,
        JSON.stringify({
          idempotencyKey,
          staleMinutes,
          cancelledOrderIds,
          totalCancelled: cancelledOrderIds.length
        })
      ]
    );

    return res.json({ success: true, staleMinutes, cancelledOrderIds, totalCancelled: cancelledOrderIds.length });
  } catch (error) {
    logger.error('Failed to run stale pending bulk cancellation:', error);
    return res.status(500).json({
      error: 'Failed to run bulk order cleanup',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/admin/tasks
 * Get tasks across all restaurants with filtering and pagination.
 */
router.get('/tasks', async (req, res) => {
  try {
    const db = await DatabaseService.getInstance().getDatabase();
    const page = resolvePage(req.query.page, 1);
    const limit = resolveLimit(req.query.limit, 50, 200);
    const offset = (page - 1) * limit;
    const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';
    const priority = typeof req.query.priority === 'string' ? req.query.priority.trim() : '';
    const restaurantId = typeof req.query.restaurantId === 'string' ? req.query.restaurantId.trim() : '';
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';

    const whereParts: string[] = [];
    const params: any[] = [];

    if (status && status !== 'all') {
      whereParts.push('t.status = ?');
      params.push(status);
    }

    if (priority && priority !== 'all') {
      whereParts.push('t.priority = ?');
      params.push(priority);
    }

    if (restaurantId) {
      whereParts.push('t.restaurant_id = ?');
      params.push(restaurantId);
    }

    if (search) {
      whereParts.push(`(
        COALESCE(t.title, '') ILIKE ?
        OR COALESCE(t.description, '') ILIKE ?
        OR COALESCE(r.name, '') ILIKE ?
        OR COALESCE(u.name, '') ILIKE ?
      )`);
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    const whereClause = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

    const tasks = await db.all(
      `
      SELECT
        t.id,
        t.restaurant_id,
        r.name AS restaurant_name,
        t.title,
        t.description,
        t.status,
        COALESCE(t.priority, 'medium') AS priority,
        t.type,
        t.assigned_to,
        u.name AS assigned_to_name,
        t.due_date,
        t.completed_at,
        t.created_at,
        t.updated_at
      FROM tasks t
      LEFT JOIN restaurants r ON r.id = t.restaurant_id
      LEFT JOIN users u ON u.id = t.assigned_to
      ${whereClause}
      ORDER BY
        CASE
          WHEN t.status = 'pending' THEN 0
          WHEN t.status = 'in_progress' THEN 1
          WHEN t.status = 'completed' THEN 2
          ELSE 3
        END,
        t.created_at DESC
      LIMIT ? OFFSET ?
    `,
      [...params, limit, offset]
    );

    const totalResult = await db.get(
      `
      SELECT COUNT(*) as total
      FROM tasks t
      LEFT JOIN restaurants r ON r.id = t.restaurant_id
      LEFT JOIN users u ON u.id = t.assigned_to
      ${whereClause}
    `,
      params
    );

    return res.json({
      tasks: tasks as AdminTask[],
      pagination: {
        page,
        limit,
        total: totalResult?.total || 0,
        pages: Math.ceil((totalResult?.total || 0) / limit)
      } as PaginationPayload
    });
  } catch (error) {
    logger.error('Failed to get admin tasks:', error);
    return res.status(500).json({
      error: 'Failed to load tasks',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/admin/tasks
 * Create a task for any restaurant.
 */
router.post('/tasks', async (req, res) => {
  try {
    const db = await DatabaseService.getInstance().getDatabase();
    const restaurantId = typeof req.body?.restaurant_id === 'string' ? req.body.restaurant_id.trim() : '';
    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    const description = typeof req.body?.description === 'string' ? req.body.description.trim() : null;
    const status = typeof req.body?.status === 'string' ? req.body.status.trim() : 'pending';
    const priority = typeof req.body?.priority === 'string' ? req.body.priority.trim() : 'medium';
    const type = typeof req.body?.type === 'string' ? req.body.type.trim() : 'one_time';
    const assignedTo = typeof req.body?.assigned_to === 'string' ? req.body.assigned_to.trim() : null;
    const dueDate = typeof req.body?.due_date === 'string' ? req.body.due_date : null;

    if (!restaurantId) {
      return res.status(400).json({ error: 'restaurant_id is required' });
    }

    if (!title) {
      return res.status(400).json({ error: 'title is required' });
    }

    const allowedStatuses = new Set(['pending', 'in_progress', 'completed']);
    if (!allowedStatuses.has(status)) {
      return res.status(400).json({ error: 'Invalid task status' });
    }

    const allowedPriorities = new Set(['low', 'medium', 'high']);
    if (!allowedPriorities.has(priority)) {
      return res.status(400).json({ error: 'Invalid task priority' });
    }

    const restaurant = await db.get('SELECT id FROM restaurants WHERE id = ?', [restaurantId]);
    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    if (assignedTo) {
      const assignee = await db.get(
        'SELECT id FROM users WHERE id = ? AND restaurant_id = ? AND is_active = true',
        [assignedTo, restaurantId]
      );
      if (!assignee) {
        return res.status(400).json({ error: 'Assigned user must be active and belong to the selected restaurant' });
      }
    }

    const taskId = randomUUID();
    const completedAt = status === 'completed' ? new Date().toISOString() : null;

    await db.run(
      `
      INSERT INTO tasks (id, restaurant_id, title, description, status, priority, type, assigned_to, due_date, completed_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `,
      [taskId, restaurantId, title, description, status, priority, type, assignedTo, dueDate, completedAt]
    );

    const task = await db.get(
      `
      SELECT
        t.id,
        t.restaurant_id,
        r.name AS restaurant_name,
        t.title,
        t.description,
        t.status,
        COALESCE(t.priority, 'medium') AS priority,
        t.type,
        t.assigned_to,
        u.name AS assigned_to_name,
        t.due_date,
        t.completed_at,
        t.created_at,
        t.updated_at
      FROM tasks t
      LEFT JOIN restaurants r ON r.id = t.restaurant_id
      LEFT JOIN users u ON u.id = t.assigned_to
      WHERE t.id = ?
      LIMIT 1
    `,
      [taskId]
    );

    return res.status(201).json({ task: task as AdminTask });
  } catch (error) {
    logger.error('Failed to create admin task:', error);
    return res.status(500).json({
      error: 'Failed to create task',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * PATCH /api/admin/tasks/:id
 * Update an existing task.
 */
router.patch('/tasks/:id', async (req, res) => {
  try {
    const db = await DatabaseService.getInstance().getDatabase();
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const existingTask = await db.get('SELECT id, restaurant_id, status FROM tasks WHERE id = ? LIMIT 1', [id]);

    if (!existingTask) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const updates: string[] = [];
    const params: any[] = [];
    const status = typeof req.body?.status === 'string' ? req.body.status.trim() : undefined;
    const priority = typeof req.body?.priority === 'string' ? req.body.priority.trim() : undefined;
    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : undefined;
    const description = typeof req.body?.description === 'string' ? req.body.description.trim() : undefined;
    const assignedTo = typeof req.body?.assigned_to === 'string' ? req.body.assigned_to.trim() : req.body?.assigned_to === null ? null : undefined;
    const dueDate = typeof req.body?.due_date === 'string' ? req.body.due_date : req.body?.due_date === null ? null : undefined;

    if (title !== undefined) {
      if (!title) return res.status(400).json({ error: 'title cannot be empty' });
      updates.push('title = ?');
      params.push(title);
    }

    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description || null);
    }

    if (status !== undefined) {
      const allowedStatuses = new Set(['pending', 'in_progress', 'completed']);
      if (!allowedStatuses.has(status)) {
        return res.status(400).json({ error: 'Invalid task status' });
      }
      updates.push('status = ?');
      params.push(status);
      if (status === 'completed') {
        updates.push('completed_at = ?');
        params.push(new Date().toISOString());
      } else if (existingTask.status === 'completed') {
        updates.push('completed_at = NULL');
      }
    }

    if (priority !== undefined) {
      const allowedPriorities = new Set(['low', 'medium', 'high']);
      if (!allowedPriorities.has(priority)) {
        return res.status(400).json({ error: 'Invalid task priority' });
      }
      updates.push('priority = ?');
      params.push(priority);
    }

    if (assignedTo !== undefined) {
      if (assignedTo) {
        const assignee = await db.get(
          'SELECT id FROM users WHERE id = ? AND restaurant_id = ? AND is_active = true',
          [assignedTo, existingTask.restaurant_id]
        );
        if (!assignee) {
          return res.status(400).json({ error: 'Assigned user must be active and belong to the same restaurant' });
        }
      }
      updates.push('assigned_to = ?');
      params.push(assignedTo || null);
    }

    if (dueDate !== undefined) {
      updates.push('due_date = ?');
      params.push(dueDate);
    }

    if (!updates.length) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    await db.run(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`, [...params, id]);

    const task = await db.get(
      `
      SELECT
        t.id,
        t.restaurant_id,
        r.name AS restaurant_name,
        t.title,
        t.description,
        t.status,
        COALESCE(t.priority, 'medium') AS priority,
        t.type,
        t.assigned_to,
        u.name AS assigned_to_name,
        t.due_date,
        t.completed_at,
        t.created_at,
        t.updated_at
      FROM tasks t
      LEFT JOIN restaurants r ON r.id = t.restaurant_id
      LEFT JOIN users u ON u.id = t.assigned_to
      WHERE t.id = ?
      LIMIT 1
    `,
      [id]
    );

    return res.json({ task: task as AdminTask });
  } catch (error) {
    logger.error('Failed to update admin task:', error);
    return res.status(500).json({
      error: 'Failed to update task',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * DELETE /api/admin/tasks/:id
 * Delete a task across any restaurant.
 */
router.delete('/tasks/:id', async (req, res) => {
  try {
    const db = await DatabaseService.getInstance().getDatabase();
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const existingTask = await db.get('SELECT id FROM tasks WHERE id = ? LIMIT 1', [id]);

    if (!existingTask) {
      return res.status(404).json({ error: 'Task not found' });
    }

    await db.run('DELETE FROM tasks WHERE id = ?', [id]);
    return res.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete admin task:', error);
    return res.status(500).json({
      error: 'Failed to delete task',
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
 * POST /api/admin/restaurants
 * Create a new restaurant with owner account (platform admin only)
 */
router.post('/restaurants', async (req, res) => {
  try {
    const db = await DatabaseService.getInstance().getDatabase();
    const {
      name,
      slug,
      email,
      phone,
      address,
      company_id,
      settings,
      // Owner account fields
      owner_name,
      owner_email,
      owner_password
    } = req.body;

    // Validate required fields
    if (!name) {
      return res.status(400).json({
        error: 'Restaurant name is required'
      });
    }

    // Auto-generate slug from name if not provided
    const generatedSlug = slug || name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    // Validate slug format
    const slugRegex = /^[a-z0-9-]+$/;
    if (!slugRegex.test(generatedSlug)) {
      return res.status(400).json({
        error: 'Slug must contain only lowercase letters, numbers, and hyphens'
      });
    }

    // Check slug uniqueness
    const existingSlug = await db.get(
      'SELECT id FROM restaurants WHERE slug = ?',
      [generatedSlug.toLowerCase()]
    );
    if (existingSlug) {
      return res.status(400).json({
        error: 'Restaurant slug already exists'
      });
    }

    // Validate owner account fields if provided
    if (owner_email || owner_password || owner_name) {
      if (!owner_email || !owner_password || !owner_name) {
        return res.status(400).json({
          error: 'Owner name, email, and password are all required to create an owner account'
        });
      }

      // Check if owner email already exists
      const existingOwner = await db.get(
        'SELECT id FROM users WHERE email = ?',
        [owner_email.toLowerCase()]
      );
      if (existingOwner) {
        return res.status(400).json({
          error: 'A user with this email already exists'
        });
      }
    }

    // Create the restaurant
    const restaurantId = uuidv4();
    const restaurantSettings = typeof settings === 'object' ? JSON.stringify(settings) : '{}';

    await db.run(
      `INSERT INTO restaurants (id, name, slug, email, phone, address, company_id, settings, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [restaurantId, name, generatedSlug.toLowerCase(), email || null, phone || null, address || null, company_id || null, restaurantSettings]
    );

    // Create owner account if credentials provided
    let ownerUser = null;
    if (owner_email && owner_password && owner_name) {
      const bcrypt = require('bcryptjs');
      const ownerId = uuidv4();
      const passwordHash = await bcrypt.hash(owner_password, 10);

      await db.run(
        `INSERT INTO users (id, restaurant_id, name, email, password_hash, role, permissions, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [ownerId, restaurantId, owner_name, owner_email.toLowerCase(), passwordHash, 'owner', JSON.stringify(['*'])]
      );

      ownerUser = {
        id: ownerId,
        name: owner_name,
        email: owner_email,
        role: 'owner'
      };

      logger.info(`Owner account "${owner_email}" created for restaurant "${name}"`);
    }

    // Log audit
    await DatabaseService.getInstance().logAudit(
      restaurantId,
      req.user?.id || 'system',
      'create_restaurant',
      'restaurant',
      restaurantId,
      { name, slug: generatedSlug, email, company_id, owner_email }
    );

    logger.info(`Platform admin ${req.user?.id} created new restaurant "${name}" (${restaurantId})`);

    // Fetch the created restaurant
    const restaurant = await db.get(
      'SELECT * FROM restaurants WHERE id = ?',
      [restaurantId]
    );

    res.status(201).json({
      success: true,
      restaurant,
      owner: ownerUser
    });

  } catch (error) {
    logger.error('Failed to create restaurant:', error);
    res.status(500).json({
      error: 'Failed to create restaurant',
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

router.get('/billing/subscriptions', async (_req, res) => {
  try {
    const db = await DatabaseService.getInstance().getDatabase();
    const subscriptions = await db.all(`
      SELECT abs.*, r.name as restaurant_name
      FROM admin_billing_subscriptions abs
      JOIN restaurants r ON r.id = abs.restaurant_id
      ORDER BY r.name ASC
    `);
    res.json({ subscriptions });
  } catch (error) {
    logger.error('Failed to load billing subscriptions:', error);
    res.status(500).json({ error: 'Failed to load billing subscriptions' });
  }
});

router.patch('/billing/subscriptions/:id', async (req, res) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { package_name, status, billing_cycle, amount, next_billing_date, contact_email, notes } = req.body || {};
    const db = await DatabaseService.getInstance().getDatabase();

    await db.run(
      `UPDATE admin_billing_subscriptions
       SET package_name = COALESCE(?, package_name),
           status = COALESCE(?, status),
           billing_cycle = COALESCE(?, billing_cycle),
           amount = COALESCE(?, amount),
           next_billing_date = COALESCE(?, next_billing_date),
           contact_email = COALESCE(?, contact_email),
           notes = COALESCE(?, notes),
           updated_at = NOW()
       WHERE id = ?`,
      [package_name, status, billing_cycle, amount, next_billing_date, contact_email, notes, id]
    );

    const subscription = await db.get('SELECT * FROM admin_billing_subscriptions WHERE id = ?', [id]);
    res.json({ subscription });
  } catch (error) {
    logger.error('Failed to update billing subscription:', error);
    res.status(500).json({ error: 'Failed to update billing subscription' });
  }
});

router.get('/marketing/customers', async (_req, res) => {
  try {
    const db = await DatabaseService.getInstance().getDatabase();
    const customers = await db.all(`
      SELECT c.id, c.name, c.email, c.phone, c.total_spent, c.total_orders, c.last_order_date, r.name as restaurant_name
      FROM customers c
      JOIN restaurants r ON r.id = c.restaurant_id
      WHERE (c.email IS NOT NULL AND TRIM(c.email) <> '') OR (c.phone IS NOT NULL AND TRIM(c.phone) <> '')
      ORDER BY COALESCE(c.total_spent, 0) DESC, c.last_order_date DESC
      LIMIT 500
    `);
    res.json({ customers });
  } catch (error) {
    logger.error('Failed to load marketing customers:', error);
    res.status(500).json({ error: 'Failed to load marketing customers' });
  }
});

router.get('/marketing/campaigns', async (_req, res) => {
  try {
    const db = await DatabaseService.getInstance().getDatabase();
    const campaigns = await db.all('SELECT * FROM admin_marketing_campaigns ORDER BY created_at DESC LIMIT 100');
    res.json({ campaigns });
  } catch (error) {
    logger.error('Failed to load admin marketing campaigns:', error);
    res.status(500).json({ error: 'Failed to load admin marketing campaigns' });
  }
});

router.post('/marketing/campaigns', async (req, res) => {
  try {
    const { name, channel, message, subject, status, scheduled_at, audience_filter, total_customers } = req.body || {};
    if (!name || !channel || !message) {
      return res.status(400).json({ error: 'name, channel and message are required' });
    }
    const db = await DatabaseService.getInstance().getDatabase();
    const id = uuidv4();
    await db.run(
      `INSERT INTO admin_marketing_campaigns
      (id, name, channel, status, message, subject, audience_filter, total_customers, scheduled_at, sent_at, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        name,
        channel,
        status || 'draft',
        message,
        subject || null,
        audience_filter || 'all_customers',
        Number(total_customers || 0),
        scheduled_at || null,
        status === 'sent' ? new Date().toISOString() : null,
        req.user?.id || null
      ]
    );
    const campaign = await db.get('SELECT * FROM admin_marketing_campaigns WHERE id = ?', [id]);
    res.status(201).json({ campaign });
  } catch (error) {
    logger.error('Failed to create admin marketing campaign:', error);
    res.status(500).json({ error: 'Failed to create admin marketing campaign' });
  }
});

router.get('/pricing-structures', async (_req, res) => {
  try {
    const db = await DatabaseService.getInstance().getDatabase();
    const plans = await db.all('SELECT * FROM pricing_structures ORDER BY display_order ASC, created_at ASC');
    res.json({ plans: parseTableRows(plans) });
  } catch (error) {
    logger.error('Failed to load pricing structures:', error);
    res.status(500).json({ error: 'Failed to load pricing structures' });
  }
});

router.post('/pricing-structures', async (req, res) => {
  try {
    const { name, slug, description, price_monthly, price_yearly, is_featured, is_active, features, display_order } = req.body || {};
    if (!name || !slug || price_monthly === undefined) {
      return res.status(400).json({ error: 'name, slug and price_monthly are required' });
    }
    const db = await DatabaseService.getInstance().getDatabase();
    const id = uuidv4();
    await db.run(
      `INSERT INTO pricing_structures
      (id, name, slug, description, price_monthly, price_yearly, is_featured, is_active, features, display_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        name,
        slug,
        description || null,
        Number(price_monthly),
        price_yearly === undefined ? null : Number(price_yearly),
        Boolean(is_featured),
        is_active === undefined ? true : Boolean(is_active),
        JSON.stringify(Array.isArray(features) ? features : []),
        Number(display_order || 0)
      ]
    );
    const plan = await db.get('SELECT * FROM pricing_structures WHERE id = ?', [id]);
    res.status(201).json({ plan: parseTableRows([plan])[0] });
  } catch (error) {
    logger.error('Failed to create pricing structure:', error);
    res.status(500).json({ error: 'Failed to create pricing structure' });
  }
});

router.patch('/pricing-structures/:id', async (req, res) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { name, description, price_monthly, price_yearly, is_featured, is_active, features, display_order } = req.body || {};
    const db = await DatabaseService.getInstance().getDatabase();
    await db.run(
      `UPDATE pricing_structures
       SET name = COALESCE(?, name),
           description = COALESCE(?, description),
           price_monthly = COALESCE(?, price_monthly),
           price_yearly = COALESCE(?, price_yearly),
           is_featured = COALESCE(?, is_featured),
           is_active = COALESCE(?, is_active),
           features = COALESCE(?, features),
           display_order = COALESCE(?, display_order),
           updated_at = NOW()
       WHERE id = ?`,
      [
        name,
        description,
        price_monthly === undefined ? null : Number(price_monthly),
        price_yearly === undefined ? null : Number(price_yearly),
        is_featured === undefined ? null : Boolean(is_featured),
        is_active === undefined ? null : Boolean(is_active),
        features === undefined ? null : JSON.stringify(Array.isArray(features) ? features : []),
        display_order === undefined ? null : Number(display_order),
        id
      ]
    );
    const plan = await db.get('SELECT * FROM pricing_structures WHERE id = ?', [id]);
    res.json({ plan: parseTableRows([plan])[0] });
  } catch (error) {
    logger.error('Failed to update pricing structure:', error);
    res.status(500).json({ error: 'Failed to update pricing structure' });
  }
});

export default router;
