import { validateItemSelections } from '../services/modifierValidation';
import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { createHash } from 'crypto';
import { DatabaseService } from '../services/DatabaseService';
import { asyncHandler, BadRequestError } from '../middleware/errorHandler';
import { getEffectiveRestaurantId, requireApiKeyScopeByHttpMethod } from '../middleware/apiKeyAuth';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { eventBus } from '../events/bus';
import { invalidateRestaurantOrderCache } from '../utils/serverCache';
import { calculateOrderPricing } from '../utils/orderPricing';
import {
  canTransitionOrderStatus,
  getAllowedNextOrderStatuses,
  isOrderStatus,
  ORDER_ACTIVE_STATUSES,
  ORDER_STATUS_VALUES
} from '../lib/orderStatusMachine';

const router = Router();
const ACTIVE_ORDER_STATUS_SQL_LIST = ORDER_ACTIVE_STATUSES.map((status) => `'${status}'`).join(', ');
const num = (v: any) => (typeof v === 'number' ? v : Number(v ?? 0));
const getRequestId = (req: Request) => {
  const headerId =
    (req.headers['x-request-id'] as string) ||
    (req.headers['x-correlation-id'] as string) ||
    (req.headers['x-amzn-trace-id'] as string);
  return headerId || uuidv4();
};

const getStripeSecretKey = (): string | null => {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim();
  return stripeSecretKey || null;
};

const buildPublicBaseUrl = (req: Request): string => {
  const envBaseUrl = process.env.FRONTEND_URL?.trim();
  if (envBaseUrl) {
    return envBaseUrl.replace(/\/$/, '');
  }

  const host = req.get('host');
  const protocol = req.protocol;
  return `${protocol}://${host}`;
};


const parseJson = <T>(value: unknown, fallback: T): T => {
  if (value == null) return fallback;
  if (typeof value !== 'string') {
    return (value as T) ?? fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const isValidIsoDate = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

const isValidIanaTimezone = (value: string): boolean => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
};

const getDatePartsInTimezone = (date: Date, timezone: string): { year: number; month: number; day: number; hour: number; minute: number; second: number } => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  const parts = formatter.formatToParts(date);
  const getPart = (type: string) => Number(parts.find((p) => p.type === type)?.value || 0);

  return {
    year: getPart('year'),
    month: getPart('month'),
    day: getPart('day'),
    hour: getPart('hour'),
    minute: getPart('minute'),
    second: getPart('second')
  };
};

const getOffsetMinutes = (date: Date, timezone: string): number => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    timeZoneName: 'shortOffset',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  const tzName = formatter.formatToParts(date).find((part) => part.type === 'timeZoneName')?.value || 'GMT+0';
  const match = tzName.match(/^GMT([+-])(\d{1,2})(?::?(\d{2}))?$/);
  if (!match) return 0;

  const sign = match[1] === '-' ? -1 : 1;
  const hours = Number(match[2]);
  const minutes = Number(match[3] || 0);
  return sign * (hours * 60 + minutes);
};

const formatIsoDateInTimezone = (date: Date, timezone: string): string => {
  const parts = getDatePartsInTimezone(date, timezone);
  return `${parts.year.toString().padStart(4, '0')}-${parts.month.toString().padStart(2, '0')}-${parts.day.toString().padStart(2, '0')}`;
};

const addDaysToIsoDate = (dateLabel: string, days: number): string => {
  const [year, month, day] = dateLabel.split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return `${next.getUTCFullYear().toString().padStart(4, '0')}-${(next.getUTCMonth() + 1).toString().padStart(2, '0')}-${next.getUTCDate().toString().padStart(2, '0')}`;
};

const getUtcForTimezoneMidnight = (dateLabel: string, timezone: string): Date => {
  const [year, month, day] = dateLabel.split('-').map(Number);
  let utcTimestamp = Date.UTC(year, month - 1, day, 0, 0, 0, 0);

  for (let i = 0; i < 4; i++) {
    const offsetMinutes = getOffsetMinutes(new Date(utcTimestamp), timezone);
    const nextTimestamp = Date.UTC(year, month - 1, day, 0, 0, 0, 0) - offsetMinutes * 60 * 1000;
    if (nextTimestamp === utcTimestamp) {
      break;
    }
    utcTimestamp = nextTimestamp;
  }

  return new Date(utcTimestamp);
};

const hasOrderItems = (items: unknown): boolean => Array.isArray(items) && items.length > 0;

const resolvePublicOrderIdempotencyKey = (req: Request): string | null => {
  const headerValue = req.headers['idempotency-key'] || req.headers['x-idempotency-key'];
  if (Array.isArray(headerValue)) {
    const first = headerValue.find((value) => typeof value === 'string' && value.trim().length > 0);
    return first ? first.trim() : null;
  }
  if (typeof headerValue === 'string' && headerValue.trim().length > 0) {
    return headerValue.trim();
  }

  const bodyToken = req.body?.idempotencyKey || req.body?.requestToken;
  if (typeof bodyToken === 'string' && bodyToken.trim().length > 0) {
    return bodyToken.trim();
  }

  return null;
};

const stableStringify = (value: unknown): string => {
  if (value === null || value === undefined) return 'null';
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;

  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(obj[key])}`).join(',')}}`;
};

const buildPublicOrderRequestHash = (payload: unknown): string => (
  createHash('sha256').update(stableStringify(payload)).digest('hex')
);


const requireOrdersScopeByMethod = requireApiKeyScopeByHttpMethod('orders');
router.use((req, res, next) => {
  if (req.path.startsWith('/public')) {
    return next();
  }
  return requireOrdersScopeByMethod(req, res, next);
});

const hydrateOrderItemsFromRows = async (db: any, orderId: string): Promise<any[]> => {
  const rows = await db.all(
    `SELECT name, item_name_snapshot, item_id, quantity, qty, unit_price, price, modifiers_json, notes
     FROM order_items WHERE order_id = ? ORDER BY created_at ASC`,
    [orderId]
  );

  return rows.map((row: any) => {
    const modifiers = parseJson<Record<string, unknown> | string[]>(row.modifiers_json, {});
    return {
      name: row.name || row.item_name_snapshot || row.item_id || 'Item',
      quantity: num(row.quantity || row.qty || 1),
      qty: num(row.qty || row.quantity || 1),
      unit_price: num(row.unit_price || row.price || 0),
      price: num(row.price || row.unit_price || 0),
      modifiers,
      notes: row.notes || null
    };
  });
};


/**
 * GET /api/orders
 * Get orders with optional filtering
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const { status, channel, limit = 50, offset = 0 } = req.query;
  const db = DatabaseService.getInstance().getDatabase();
  const restaurantId = getEffectiveRestaurantId(req) || (typeof req.query.restaurantId === 'string' ? req.query.restaurantId : null);
  const requestId = getRequestId(req);

  const authHeader = req.headers.authorization;
  let decodedToken: any = null;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice('Bearer '.length).trim();
    try {
      decodedToken = jwt.decode(token);
    } catch {
      decodedToken = { error: 'decode_failed' };
    }
  }

  logger.info(
    `[orders.list] entry ${JSON.stringify({
      requestId,
      user: req.user ?? null,
      decodedToken,
      restaurantId: restaurantId ?? null,
      query: req.query
    })}`
  );

  if (!restaurantId) {
    logger.warn(
      `[orders.list] missing_restaurant_id ${JSON.stringify({
        requestId,
        user: req.user ?? null,
        decodedToken
      })}`
    );
    throw new BadRequestError('Missing restaurantId for orders lookup');
  }

  let query = 'SELECT * FROM orders';
  const params: any[] = [restaurantId];
  const conditions: string[] = ['restaurant_id = ?'];

  if (status) {
    conditions.push('status = ?');
    params.push(status);
  }

  if (channel) {
    conditions.push('channel = ?');
    params.push(channel);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(Number(limit), Number(offset));

  const orders = await db.all(query, params);

  // Parse JSON fields
  const formattedOrders = orders.map((order: any) => {
    const items = parseJson<any[]>(order.items, []);
    if (order.items && !Array.isArray(items)) {
      logger.warn(
        `[orders.list] invalid_items_json ${JSON.stringify({
          requestId,
          orderId: order?.id ?? null
        })}`
      );
    }

    return {
      ...order,
      items: Array.isArray(items) ? items : []
    };
  });

  // Get total count for pagination
  let countQuery = 'SELECT COUNT(*) as total FROM orders';
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
      orders: formattedOrders,
      pagination: {
        total: countResult.total,
        limit: Number(limit),
        offset: Number(offset),
        hasMore: countResult.total > Number(offset) + formattedOrders.length
      }
    }
  });
}));

/**
 * GET /api/orders/history
 * Get historical orders with filters and pagination
 */
router.get('/history', asyncHandler(async (req: Request, res: Response) => {
  const { 
    dateFrom, 
    dateTo, 
    status, 
    channel, 
    limit = 20, 
    offset = 0 
  } = req.query;
  const db = DatabaseService.getInstance().getDatabase();
  const restaurantId = req.user?.restaurantId;

  const where: string[] = ['restaurant_id = ?'];
  const params: any[] = [restaurantId];

  if (dateFrom) {
    where.push('created_at >= ?');
    params.push(dateFrom);
  }
  if (dateTo) {
    where.push('created_at <= ?');
    params.push(dateTo);
  }
  if (status && status !== 'all') {
    where.push('status = ?');
    params.push(status);
  }
  if (channel && channel !== 'all') {
    where.push('channel = ?');
    params.push(channel);
  }

  const orders = await db.all(`
    SELECT * FROM orders
    WHERE ${where.join(' AND ')}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `, [...params, Number(limit), Number(offset)]);

  const total = await db.get(`
    SELECT COUNT(*) as count FROM orders
    WHERE ${where.join(' AND ')}
  `, params);

  const formattedOrders = orders.map((order: any) => ({
    ...order,
    items: parseJson(order.items, [])
  }));

  res.json({
    success: true,
    data: {
      orders: formattedOrders,
      pagination: {
        total: total.count,
        limit: Number(limit),
        offset: Number(offset),
        hasMore: total.count > Number(offset) + orders.length
      }
    }
  });
}));

/**
 * GET /api/orders/history/stats
 * Get aggregated statistics for historical orders
 */
router.get('/history/stats', asyncHandler(async (req: Request, res: Response) => {
  const { dateFrom, dateTo } = req.query;
  const db = DatabaseService.getInstance().getDatabase();
  const restaurantId = req.user?.restaurantId;

  const stats = await db.get(`
    SELECT 
      COUNT(*) as total_orders,
      SUM(total_amount) as total_revenue,
      AVG(total_amount) as avg_order_value,
      COUNT(DISTINCT customer_id) as unique_customers
    FROM orders
    WHERE restaurant_id = ?
      AND created_at >= ?
      AND created_at <= ?
  `, [restaurantId, dateFrom, dateTo]);

  res.json({
    success: true,
    data: {
      totalOrders: stats.total_orders || 0,
      totalRevenue: stats.total_revenue || 0,
      avgOrderValue: stats.avg_order_value || 0,
      uniqueCustomers: stats.unique_customers || 0
    }
  });
}));

/**
 * GET /api/orders/:id
 * Get a specific order by ID
 */
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const db = DatabaseService.getInstance().getDatabase();

  const restaurantId = req.user?.restaurantId;
  const order = restaurantId 
    ? await db.get('SELECT * FROM orders WHERE id = ? AND restaurant_id = ?', [id, restaurantId])
    : await db.get('SELECT * FROM orders WHERE id = ?', [id]);

  if (!order) {
    return res.status(404).json({
      success: false,
      error: { message: 'Order not found' }
    });
  }

  let items = parseJson<any[]>(order.items, []);
  if (!hasOrderItems(items)) {
    items = await hydrateOrderItemsFromRows(db, id);
  }

  const formattedOrder = {
    ...order,
    items
  };

  res.json({
    success: true,
    data: formattedOrder
  });
}));

/**
 * POST /api/orders/:id/status
 * Update order status
 */
router.post('/:id/status', asyncHandler(async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { status } = req.body;

  if (!isOrderStatus(status)) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'Invalid status. Must be one of: ' + ORDER_STATUS_VALUES.join(', ')
      }
    });
  }

  const db = DatabaseService.getInstance().getDatabase();

  // Check if order exists
  const restaurantId = req.user?.restaurantId;
  const order = restaurantId
    ? await db.get('SELECT * FROM orders WHERE id = ? AND restaurant_id = ?', [id, restaurantId])
    : await db.get('SELECT * FROM orders WHERE id = ?', [id]);
  if (!order) {
    return res.status(404).json({
      success: false,
      error: { message: 'Order not found' }
    });
  }

  if (!isOrderStatus(order.status)) {
    return res.status(409).json({
      success: false,
      error: {
        message: `Cannot transition from unsupported current status '${order.status}'`
      }
    });
  }

  if (order.status === status) {
    return res.json({
      success: true,
      data: {
        orderId: id,
        previousStatus: order.status,
        newStatus: status,
        updatedAt: order.updated_at ?? new Date().toISOString(),
        noop: true
      }
    });
  }

  if (!canTransitionOrderStatus(order.status, status)) {
    const allowedTransitions = getAllowedNextOrderStatuses(order.status);
    return res.status(409).json({
      success: false,
      error: {
        message: `Cannot move order to ${status} from ${order.status}`,
        details: {
          currentStatus: order.status,
          requestedStatus: status,
          allowedNextStatuses: allowedTransitions
        }
      }
    });
  }

  // Update the order
  await db.run(
    'UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [status, id]
  );

  // Use order's restaurant_id for audit log (supports API key auth where req.user is null)
  const auditRestaurantId = restaurantId || order.restaurant_id;
  const actorId = req.user?.id ?? null;
  
  // Log the action
  await DatabaseService.getInstance().logAudit(
    auditRestaurantId,
    actorId,
    'update_order_status',
    'order',
    id,
    { previousStatus: order.status, newStatus: status }
  );

  await eventBus.emit('order.status_changed', {
    restaurantId: auditRestaurantId,
    type: 'order.status_changed',
    actor: { actorType: actorId ? 'user' : 'api', actorId: actorId ?? 'api' },
    payload: { orderId: id, previousStatus: order.status, newStatus: status },
    occurredAt: new Date().toISOString()
  });

  logger.info(`Order ${id} status updated from ${order.status} to ${status}`);

  invalidateRestaurantOrderCache(auditRestaurantId, id);

  // Broadcast status change via Socket.IO
  try {
    const io = req.app.get('socketio');
    if (io) {
      io.to(`restaurant-${auditRestaurantId}`).emit('order:status_changed', {
        orderId: id,
        previousStatus: order.status,
        status,
        timestamp: new Date()
      });
    }
  } catch (socketError) {
    logger.warn('Failed to broadcast order status change via socket', { orderId: id, error: socketError });
  }

  res.json({
    success: true,
    data: {
      orderId: id,
      previousStatus: order.status,
      newStatus: status,
      updatedAt: new Date().toISOString()
    }
  });
}));

/**
 * POST /api/orders/:id/prep-time
 * Set prep time before starting preparation
 */
router.post('/:id/prep-time', asyncHandler(async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { prepMinutes } = req.body ?? {};

  const minutes = Number(prepMinutes);
  if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 180) {
    return res.status(400).json({
      success: false,
      error: { message: 'prepMinutes must be between 1 and 180' }
    });
  }

  const db = DatabaseService.getInstance().getDatabase();
  const restaurantId = req.user?.restaurantId;
  const order = restaurantId
    ? await db.get<any>('SELECT * FROM orders WHERE id = ? AND restaurant_id = ?', [id, restaurantId])
    : await db.get<any>('SELECT * FROM orders WHERE id = ?', [id]);
  if (!order) {
    return res.status(404).json({
      success: false,
      error: { message: 'Order not found' }
    });
  }

  const pickupTime = new Date(Date.now() + minutes * 60 * 1000).toISOString();

  await db.run(
    'UPDATE orders SET status = ?, pickup_time = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    ['preparing', pickupTime, id]
  );

  // Use order's restaurant_id for audit log (supports API key auth where req.user is null)
  const auditRestaurantId = restaurantId || order.restaurant_id;
  await DatabaseService.getInstance().logAudit(
    auditRestaurantId,
    req.user?.id ?? null,
    'set_prep_time',
    'order',
    id,
    { prepMinutes: minutes, pickupTime }
  );

  invalidateRestaurantOrderCache(auditRestaurantId, id);

  res.json({
    success: true,
    data: {
      orderId: id,
      status: 'preparing',
      prepMinutes: minutes,
      pickupTime
    }
  });
}));

/**
 * GET /api/orders/stats/summary
 * Get order statistics summary
 */
router.get('/stats/summary', asyncHandler(async (req: Request, res: Response) => {
  const db = DatabaseService.getInstance().getDatabase();
  const restaurantId = req.user?.restaurantId;
  const rawDate = typeof req.query.date === 'string' ? req.query.date.trim() : '';
  const rawTimezone = typeof req.query.tz === 'string' ? req.query.tz.trim() : '';

  if (rawDate && !isValidIsoDate(rawDate)) {
    return res.status(400).json({
      success: false,
      error: { message: 'Invalid date format. Use YYYY-MM-DD.' }
    });
  }

  if (rawTimezone && !isValidIanaTimezone(rawTimezone)) {
    return res.status(400).json({
      success: false,
      error: { message: 'Invalid timezone. Use a valid IANA timezone.' }
    });
  }

  const restaurant = await db.get<{ timezone?: string | null; settings?: string | Record<string, any> | null }>(
    'SELECT timezone, settings FROM restaurants WHERE id = ? LIMIT 1',
    [restaurantId]
  );

  const settings = parseJson<Record<string, any>>(restaurant?.settings, {});
  const restaurantTimezone = (
    typeof settings.timezone === 'string' && isValidIanaTimezone(settings.timezone)
      ? settings.timezone
      : typeof restaurant?.timezone === 'string' && isValidIanaTimezone(restaurant.timezone)
        ? restaurant.timezone
        : 'UTC'
  );

  const timezone = rawTimezone || restaurantTimezone;
  const label = rawDate || formatIsoDateInTimezone(new Date(), timezone);
  const periodStart = getUtcForTimezoneMidnight(label, timezone);
  const periodEnd = getUtcForTimezoneMidnight(addDaysToIsoDate(label, 1), timezone);
  const periodStartStr = periodStart.toISOString();
  const periodEndStr = periodEnd.toISOString();

  // Revenue = all orders that are not cancelled/refunded
  const revenueCondition = "restaurant_id = ? AND created_at >= ? AND created_at < ? AND status NOT IN ('cancelled', 'refunded')";
  // Today orders should include all statuses to match dashboard order volume
  const todayOrdersCondition = 'restaurant_id = ? AND created_at >= ? AND created_at < ?';
  const completedCondition = "restaurant_id = ? AND created_at >= ? AND created_at < ? AND status = 'completed'";
  
  const [
    totalOrdersResult,
    activeOrders,
    completedToday,
    completedTodaySales,
    avgOrderValue,
    todayOrders,
    ordersByStatus,
    ordersByChannel
  ] = await Promise.all([
    // Total orders (all time)
    db.get('SELECT COUNT(*) as count FROM orders WHERE restaurant_id = ?', [restaurantId]),
    // Active orders (in progress)
    db.get(`SELECT COUNT(*) as count FROM orders WHERE restaurant_id = ? AND status IN (${ACTIVE_ORDER_STATUS_SQL_LIST})`, [restaurantId]),
    // Completed today
    db.get(`SELECT COUNT(*) as count FROM orders WHERE ${completedCondition}`, [restaurantId, periodStartStr, periodEndStr]),
    // Revenue from all non-cancelled orders today
    db.get(`SELECT COALESCE(SUM(total_amount), 0) as sum FROM orders WHERE ${revenueCondition}`, [restaurantId, periodStartStr, periodEndStr]),
    // Average order value for completed orders today
    db.get(`SELECT AVG(total_amount) as avg FROM orders WHERE ${completedCondition}`, [restaurantId, periodStartStr, periodEndStr]),
    // Total orders today (all statuses)
    db.get(`SELECT COUNT(*) as count FROM orders WHERE ${todayOrdersCondition}`, [restaurantId, periodStartStr, periodEndStr]),
    // Orders grouped by status
    db.all('SELECT status, COUNT(*) as count FROM orders WHERE restaurant_id = ? GROUP BY status', [restaurantId]),
    // Orders grouped by channel
    db.all('SELECT channel, COUNT(*) as count FROM orders WHERE restaurant_id = ? GROUP BY channel', [restaurantId])
  ]);

  const stats = {
    totalOrders: num(totalOrdersResult.count),
    activeOrders: num(activeOrders.count),
    completedToday: num(completedToday.count),
    completedTodaySales: parseFloat((completedTodaySales.sum || 0).toFixed(2)),
    todayOrders: num(todayOrders.count),
    avgOrderValue: parseFloat((avgOrderValue.avg || 0).toFixed(2)),
    ordersByStatus: ordersByStatus.reduce((acc: any, row: any) => {
      acc[row.status] = num(row.count);
      return acc;
    }, {}),
    ordersByChannel: ordersByChannel.reduce((acc: any, row: any) => {
      acc[row.channel] = num(row.count);
      return acc;
    }, {})
  };

  res.json({
    success: true,
    data: {
      ...stats,
      periodStart: periodStartStr,
      periodEnd: periodEndStr,
      timezone,
      label
    }
  });
}));

/**
 * GET /api/orders/analytics
 * Get comprehensive order analytics
 */
router.get('/analytics', asyncHandler(async (req: Request, res: Response) => {
  const db = DatabaseService.getInstance().getDatabase();
  const restaurantId = req.user?.restaurantId;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const monthAgo = new Date(today);
  monthAgo.setDate(monthAgo.getDate() - 30);
  
  const todayStr = today.toISOString();
  const yesterdayStr = yesterday.toISOString();
  const weekStr = weekAgo.toISOString();
  const monthStr = monthAgo.toISOString();
  
  // Revenue and orders for different periods
  const [
    todayRevenue,
    yesterdayRevenue,
    weekRevenue,
    monthRevenue,
    todayOrders,
    yesterdayOrders,
    weekOrders,
    monthOrders,
    avgOrderValue,
    ordersByStatus,
    ordersByChannel,
    recentOrders,
    hourlyDistribution
  ] = await Promise.all([
    // Today revenue
    db.get(`SELECT COALESCE(SUM(total_amount), 0) as sum FROM orders WHERE restaurant_id = ? AND created_at >= ?`, [restaurantId, todayStr]),
    // Yesterday revenue
    db.get(`SELECT COALESCE(SUM(total_amount), 0) as sum FROM orders WHERE restaurant_id = ? AND created_at >= ? AND created_at < ?`, [restaurantId, yesterdayStr, todayStr]),
    // Week revenue
    db.get(`SELECT COALESCE(SUM(total_amount), 0) as sum FROM orders WHERE restaurant_id = ? AND created_at >= ?`, [restaurantId, weekStr]),
    // Month revenue
    db.get(`SELECT COALESCE(SUM(total_amount), 0) as sum FROM orders WHERE restaurant_id = ? AND created_at >= ?`, [restaurantId, monthStr]),
    // Today orders
    db.get(`SELECT COUNT(*) as count FROM orders WHERE restaurant_id = ? AND created_at >= ?`, [restaurantId, todayStr]),
    // Yesterday orders
    db.get(`SELECT COUNT(*) as count FROM orders WHERE restaurant_id = ? AND created_at >= ? AND created_at < ?`, [restaurantId, yesterdayStr, todayStr]),
    // Week orders
    db.get(`SELECT COUNT(*) as count FROM orders WHERE restaurant_id = ? AND created_at >= ?`, [restaurantId, weekStr]),
    // Month orders
    db.get(`SELECT COUNT(*) as count FROM orders WHERE restaurant_id = ? AND created_at >= ?`, [restaurantId, monthStr]),
    // Average order value
    db.get(`SELECT AVG(total_amount) as avg FROM orders WHERE restaurant_id = ? AND status = 'completed'`, [restaurantId]),
    // Orders by status
    db.all('SELECT status, COUNT(*) as count FROM orders WHERE restaurant_id = ? GROUP BY status', [restaurantId]),
    // Orders by channel
    db.all('SELECT channel, COUNT(*) as count FROM orders WHERE restaurant_id = ? GROUP BY channel', [restaurantId]),
    // Recent orders (last 50)
    db.all('SELECT * FROM orders WHERE restaurant_id = ? ORDER BY created_at DESC LIMIT 50', [restaurantId]),
    // Hourly distribution (today)
    db.all(`SELECT EXTRACT(HOUR FROM created_at)::text as hour, COUNT(*) as count FROM orders WHERE restaurant_id = ? AND created_at >= ? GROUP BY hour ORDER BY hour`, [restaurantId, todayStr])
  ]);
  
  // Calculate top items from recent orders
  const itemCounts: Record<string, { count: number; revenue: number }> = {};
  for (const order of recentOrders as any[]) {
    if (Array.isArray(order.items)) {
      for (const item of order.items) {
        if (item.name) {
          if (!itemCounts[item.name]) {
            itemCounts[item.name] = { count: 0, revenue: 0 };
          }
          itemCounts[item.name].count += item.quantity || 1;
          itemCounts[item.name].revenue += (item.price || 0) * (item.quantity || 1);
        }
      }
    }
  }
  
  const topItems = Object.entries(itemCounts)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  
  // Format hourly distribution
  const hourlyData = Array.from({ length: 24 }, (_, i) => {
    const hour = i.toString().padStart(2, '0');
    const found = (hourlyDistribution as any[]).find((h: any) => h.hour === hour);
    return { hour: i, count: found ? found.count : 0 };
  });
  
  // Format recent orders
  const formattedRecentOrders = (recentOrders as any[]).map((order: any) => ({
    ...order,
    items: JSON.parse(order.items || '[]')
  }));
  
  const analytics = {
    todayRevenue: parseFloat((todayRevenue.sum || 0).toFixed(2)),
    yesterdayRevenue: parseFloat((yesterdayRevenue.sum || 0).toFixed(2)),
    weekRevenue: parseFloat((weekRevenue.sum || 0).toFixed(2)),
    monthRevenue: parseFloat((monthRevenue.sum || 0).toFixed(2)),
    todayOrders: num(todayOrders.count),
    yesterdayOrders: num(yesterdayOrders.count),
    weekOrders: num(weekOrders.count),
    monthOrders: num(monthOrders.count),
    avgOrderValue: parseFloat((avgOrderValue.avg || 0).toFixed(2)),
    avgPrepTime: 12, // Would need additional tracking
    ordersByStatus: (ordersByStatus as any[]).reduce((acc: any, row: any) => {
      acc[row.status] = num(row.count);
      return acc;
    }, {}),
    ordersByChannel: (ordersByChannel as any[]).reduce((acc: any, row: any) => {
      acc[row.channel] = num(row.count);
      return acc;
    }, {}),
    hourlyDistribution: hourlyData,
    recentOrders: formattedRecentOrders,
    topItems
  };
  
  res.json({
    success: true,
    data: analytics
  });
}));

/**
 * POST /api/orders/public/:slug
 * Create a new order via public site
 */
router.post('/public/:slug', asyncHandler(async (req: Request, res: Response) => {
  const slug = Array.isArray(req.params.slug) ? req.params.slug[0] : req.params.slug;
  const {
    items,
    customerName,
    customerPhone,
    customerEmail,
    orderType,
    specialInstructions,
    paymentMethod,
    marketingConsent,
    taxRate,
    restaurantState,
    subtotal,
    tax,
    total,
    scheduledPickupTime
  } = req.body;
  const db = DatabaseService.getInstance().getDatabase();
  const requestId = getRequestId(req);
  const idempotencyKey = resolvePublicOrderIdempotencyKey(req);

  let parsedItems = items;
  if (typeof items === 'string') {
    try {
      parsedItems = JSON.parse(items);
    } catch {
      return res.status(400).json({ success: false, error: { message: 'Items must be valid JSON' } });
    }
  }

  const safeBody = {
    customerName,
    customerPhone,
    customerEmail,
    orderType,
    paymentMethod,
    itemsCount: Array.isArray(parsedItems) ? parsedItems.length : 0,
    restaurantState,
    idempotencyKey: idempotencyKey || null
  };

  const restaurant = await db.get('SELECT id, slug FROM restaurants WHERE slug = ?', [slug]);
  const restaurantId = restaurant?.id ?? null;

  logger.info(
    `[orders.public] entry ${JSON.stringify({
      requestId,
      slug,
      restaurant: restaurant ?? null,
      restaurantId,
      body: safeBody,
      totals: { subtotal, tax, total }
    })}`
  );

  if (!restaurant) {
    return res.status(404).json({ success: false, error: { message: 'Restaurant not found' } });
  }

  if (!restaurantId) {
    return res.status(400).json({ success: false, error: { message: 'Missing restaurantId for order' } });
  }

  if (!parsedItems || !Array.isArray(parsedItems) || parsedItems.length === 0) {
    return res.status(400).json({ success: false, error: { message: 'Items are required' } });
  }

  const normalizedCustomerEmail =
    typeof customerEmail === 'string' && customerEmail.trim().length > 0
      ? customerEmail.trim().toLowerCase()
      : null;
  const normalizedCustomerName =
    typeof customerName === 'string' && customerName.trim().length > 0
      ? customerName.trim()
      : null;
  const normalizedCustomerPhone =
    typeof customerPhone === 'string' && customerPhone.trim().length > 0
      ? customerPhone.trim()
      : null;

  if (!normalizedCustomerName) {
    return res.status(400).json({ success: false, error: { message: 'customerName is required' } });
  }

  if (!normalizedCustomerPhone) {
    return res.status(400).json({ success: false, error: { message: 'customerPhone is required' } });
  }

  const phoneDigits = normalizedCustomerPhone.replace(/\D/g, '');
  if (phoneDigits.length < 10) {
    return res.status(400).json({ success: false, error: { message: 'customerPhone must be a valid phone number' } });
  }

  if (normalizedCustomerEmail) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedCustomerEmail)) {
      return res.status(400).json({
        success: false,
        error: { message: 'customerEmail must be a valid email address when provided' }
      });
    }
  }

  // Validate scheduled pickup time if provided
  let normalizedScheduledPickupTime: string | null = null;
  if (scheduledPickupTime) {
    const scheduledDate = new Date(scheduledPickupTime);
    const now = new Date();
    const minTime = new Date(now.getTime() + 15 * 60 * 1000); // 15 min from now
    const maxTime = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days ahead

    if (isNaN(scheduledDate.getTime())) {
      return res.status(400).json({ success: false, error: { message: 'Invalid scheduled pickup time' } });
    }
    if (scheduledDate < minTime) {
      return res.status(400).json({ success: false, error: { message: 'Scheduled pickup must be at least 15 minutes from now' } });
    }
    if (scheduledDate > maxTime) {
      return res.status(400).json({ success: false, error: { message: 'Cannot schedule more than 7 days in advance' } });
    }
    normalizedScheduledPickupTime = scheduledDate.toISOString();
  }

  const normalizedPaymentMethod = paymentMethod === 'online' ? 'online' : 'pickup';
  const stripeSecretKey = getStripeSecretKey();

  if (normalizedPaymentMethod === 'online' && !stripeSecretKey) {
    return res.status(503).json({
      success: false,
      error: { message: 'Online payments are temporarily unavailable' }
    });
  }

  const orderId = uuidv4();
  let idempotencyRequestHash: string | null = null;
  
  // Validate items and calculate authoritative server-side totals
  const normalizedItems: Array<{ quantity: number; price: number }> = [];
  for (const item of parsedItems) {
    const price = Number(item?.price ?? 0);
    const quantity = Number(item?.quantity ?? 0);
    if (!Number.isFinite(price) || !Number.isFinite(quantity) || quantity <= 0) {
      return res.status(400).json({ success: false, error: { message: 'Invalid items' } });
    }
    normalizedItems.push({ quantity, price });
  }

  const { subtotal: finalSubtotal, tax: finalTax, total: finalTotal } = calculateOrderPricing(normalizedItems, taxRate);

  const responseData = {
    orderId,
    status: 'received',
    paymentMethod: normalizedPaymentMethod,
    checkoutUrl: null as string | null,
    subtotal: finalSubtotal,
    tax: finalTax,
    total: finalTotal,
    restaurantState: restaurantState || null
  };

  if (idempotencyKey) {
    const idempotencyHashPayload = {
      items: parsedItems,
      customerName: normalizedCustomerName,
      customerPhone: normalizedCustomerPhone,
      customerEmail: normalizedCustomerEmail,
      orderType: orderType || 'pickup',
      specialInstructions: specialInstructions || null,
      paymentMethod: normalizedPaymentMethod,
      marketingConsent: marketingConsent === true || marketingConsent === 'true',
      taxRate: Number(taxRate || 0),
      restaurantState: restaurantState || null,
      scheduledPickupTime: normalizedScheduledPickupTime
    };
    idempotencyRequestHash = buildPublicOrderRequestHash(idempotencyHashPayload);

    const existingIdempotency = await db.get<{
      request_hash: string;
      order_id: string | null;
      response_payload: string | null;
    }>(
      `SELECT request_hash, order_id, response_payload
       FROM public_order_idempotency_keys
       WHERE restaurant_id = ? AND idempotency_key = ?`,
      [restaurantId, idempotencyKey]
    );

    if (existingIdempotency) {
      if (existingIdempotency.request_hash !== idempotencyRequestHash) {
        return res.status(409).json({
          success: false,
          error: { message: 'Idempotency key reuse with different request payload is not allowed' }
        });
      }

      if (!existingIdempotency.order_id) {
        return res.status(409).json({
          success: false,
          error: { message: 'An order with this idempotency key is currently being processed' }
        });
      }

      if (existingIdempotency.response_payload) {
        const replayPayload = parseJson<Record<string, unknown> | null>(existingIdempotency.response_payload, null);
        if (replayPayload && typeof replayPayload === 'object') {
          return res.status(200).json({ success: true, data: replayPayload });
        }
      }

      const existingOrder = await db.get<any>(
        `SELECT id, status, payment_status, subtotal, tax, total_amount
         FROM orders WHERE id = ? AND restaurant_id = ?`,
        [existingIdempotency.order_id, restaurantId]
      );

      if (!existingOrder) {
        return res.status(409).json({
          success: false,
          error: { message: 'Idempotency key is associated with a missing order record' }
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          orderId: existingOrder.id,
          status: existingOrder.status || 'received',
          paymentMethod: existingOrder.payment_status === 'unpaid' ? 'pickup' : normalizedPaymentMethod,
          checkoutUrl: null,
          subtotal: num(existingOrder.subtotal),
          tax: num(existingOrder.tax),
          total: num(existingOrder.total_amount),
          restaurantState: restaurantState || null
        }
      });
    }

    try {
      await db.run(
        `INSERT INTO public_order_idempotency_keys (
          id, restaurant_id, idempotency_key, request_hash, order_id, response_payload, created_at, updated_at
        ) VALUES (?, ?, ?, ?, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [uuidv4(), restaurantId, idempotencyKey, idempotencyRequestHash]
      );
    } catch (insertError) {
      const isConflict =
        insertError instanceof Error &&
        (insertError.message.includes('duplicate key') || insertError.message.includes('UNIQUE constraint failed'));

      if (!isConflict) {
        throw insertError;
      }

      const concurrentRecord = await db.get<{ request_hash: string; order_id: string | null; response_payload: string | null }>(
        `SELECT request_hash, order_id, response_payload
         FROM public_order_idempotency_keys
         WHERE restaurant_id = ? AND idempotency_key = ?`,
        [restaurantId, idempotencyKey]
      );

      if (!concurrentRecord || concurrentRecord.request_hash !== idempotencyRequestHash) {
        return res.status(409).json({
          success: false,
          error: { message: 'Idempotency key reuse with different request payload is not allowed' }
        });
      }

      if (concurrentRecord.order_id && concurrentRecord.response_payload) {
        const replayPayload = parseJson<Record<string, unknown> | null>(concurrentRecord.response_payload, null);
        if (replayPayload && typeof replayPayload === 'object') {
          return res.status(200).json({ success: true, data: replayPayload });
        }
      }

      return res.status(409).json({
        success: false,
        error: { message: 'An order with this idempotency key is currently being processed' }
      });
    }
  }

  try {
    // Prepare items with modifiers included directly for orders.items JSON
    const itemsWithModifiers = parsedItems.map((item: any) => {
      const modifiers: any[] = [];
      if (item.selectedModifiers && item.selectedModifiers.length > 0) {
        item.selectedModifiers.forEach((mod: any) => {
          modifiers.push({
            name: mod.optionName,
            groupName: mod.groupName,
            priceDelta: mod.priceDelta,
            quantity: mod.quantity
          });
        });
      }
      return {
        ...item,
        modifiers: modifiers.length > 0 ? modifiers : undefined
      };
    });

    await db.run(`
      INSERT INTO orders (
        id, restaurant_id, channel, status, total_amount, payment_status,
        items, customer_name, customer_phone, customer_email, order_type, special_instructions, marketing_consent, 
        subtotal, tax, fees, pickup_time, created_at, updated_at
      ) VALUES (?, ?, 'website', 'received', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [
      orderId,
      restaurantId,
      finalTotal,
      normalizedPaymentMethod === 'online' ? 'pending' : 'unpaid',
      JSON.stringify(itemsWithModifiers),
      normalizedCustomerName,
      normalizedCustomerPhone,
      normalizedCustomerEmail,
      orderType || 'pickup',
      specialInstructions || null,
      marketingConsent === true || marketingConsent === 'true' ? 1 : 0,
      finalSubtotal,
      finalTax,
      0, // fees
      normalizedScheduledPickupTime // pickup_time
    ]);

    // Create order items
    for (const item of parsedItems) {
      // Build notes with size and modifiers info
      const notesData: any = {};
      if (item.selectedSize) {
        notesData.size = {
          id: item.selectedSize.id,
          name: item.selectedSize.name,
          price: item.selectedSize.price
        };
      }
      if (item.selectedModifiers && item.selectedModifiers.length > 0) {
        notesData.modifiers = item.selectedModifiers.map((mod: any) => ({
          groupName: mod.groupName,
          optionName: mod.optionName,
          priceDelta: mod.priceDelta,
          quantity: mod.quantity
        }));
      }
      const notes = Object.keys(notesData).length > 0 ? JSON.stringify(notesData) : null;

      await db.run(`
        INSERT INTO order_items (id, order_id, menu_item_id, name, quantity, unit_price, price, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [uuidv4(), orderId, item.id, item.name, item.quantity, item.price, item.price, notes]);
    }

  } catch (error) {
    if (idempotencyKey) {
      await db.run(
        'DELETE FROM public_order_idempotency_keys WHERE restaurant_id = ? AND idempotency_key = ? AND order_id IS NULL',
        [restaurantId, idempotencyKey]
      );
    }
    logger.error(
      `[orders.public] db_error ${JSON.stringify({
        requestId,
        slug,
        restaurantId,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      })}`
    );
    return res.status(500).json({ success: false, error: { message: 'Failed to create order' } });
  }

  let checkoutUrl: string | null = null;
  if (normalizedPaymentMethod === 'online' && stripeSecretKey) {
    try {
      const baseUrl = buildPublicBaseUrl(req);
      const currency = (process.env.STRIPE_CURRENCY || 'usd').toLowerCase();
      const params = new URLSearchParams();

      params.append('mode', 'payment');
      params.append(
        'success_url',
        `${baseUrl}/r/${encodeURIComponent(slug)}?orderId=${encodeURIComponent(orderId)}&checkout=success&session_id={CHECKOUT_SESSION_ID}`
      );
      params.append(
        'cancel_url',
        `${baseUrl}/r/${encodeURIComponent(slug)}?checkout=cancelled`
      );

      if (normalizedCustomerEmail) {
        params.append('customer_email', normalizedCustomerEmail);
      }

      params.append('metadata[orderId]', orderId);
      params.append('metadata[restaurantId]', String(restaurantId));
      params.append('metadata[restaurantSlug]', slug);

      parsedItems.forEach((item: any, index: number) => {
        params.append(`line_items[${index}][quantity]`, String(Number(item.quantity)));
        params.append(`line_items[${index}][price_data][currency]`, currency);
        params.append(`line_items[${index}][price_data][unit_amount]`, String(Math.round(Number(item.price) * 100)));
        params.append(`line_items[${index}][price_data][product_data][name]`, String(item.name || 'Menu item'));
      });

      const sessionResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${stripeSecretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
      });

      if (!sessionResponse.ok) {
        const responseText = await sessionResponse.text();
        throw new Error(`Stripe session failed (${sessionResponse.status}): ${responseText}`);
      }

      const sessionPayload = await sessionResponse.json() as { url?: string };
      checkoutUrl = sessionPayload.url || null;

      if (!checkoutUrl) {
        throw new Error('Stripe session did not include a checkout URL');
      }
    } catch (error) {
      logger.error(
        `[orders.public] stripe_error ${JSON.stringify({
          requestId,
          slug,
          restaurantId,
          orderId,
          message: error instanceof Error ? error.message : String(error)
        })}`
      );

      await db.run('UPDATE orders SET payment_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', ['failed', orderId]);
      if (idempotencyKey) {
        await db.run(
          'DELETE FROM public_order_idempotency_keys WHERE restaurant_id = ? AND idempotency_key = ? AND order_id IS NULL',
          [restaurantId, idempotencyKey]
        );
      }

      return res.status(502).json({
        success: false,
        error: { message: 'Unable to start secure payment session' }
      });
    }
  }

  try {
    // Notify dashboard via Socket.IO
    const io = req.app.get('socketio');
    if (io) {
      io.to(`restaurant-${restaurantId}`).emit('new-order', { orderId, totalAmount: finalTotal });
    }

    await eventBus.emit('order.created_web', {
      restaurantId,
      type: 'order.created_web',
      actor: { actorType: 'system' },
      payload: {
        orderId,
        customerName,
        totalAmount: finalTotal,
        channel: 'website'
      },
      occurredAt: new Date().toISOString()
    });

    await DatabaseService.getInstance().logAudit(restaurantId, null, 'create_public_order', 'order', orderId, { totalAmount: finalTotal });
  } catch (error) {
    logger.warn(
      `[orders.public] post_create_warning ${JSON.stringify({
        requestId,
        slug,
        restaurantId,
        message: error instanceof Error ? error.message : String(error)
      })}`
    );
  }

  invalidateRestaurantOrderCache(restaurantId, orderId);

  responseData.checkoutUrl = checkoutUrl;
  if (idempotencyKey && idempotencyRequestHash) {
    await db.run(
      `UPDATE public_order_idempotency_keys
       SET order_id = ?, response_payload = ?, updated_at = CURRENT_TIMESTAMP
       WHERE restaurant_id = ? AND idempotency_key = ? AND request_hash = ?`,
      [orderId, JSON.stringify(responseData), restaurantId, idempotencyKey, idempotencyRequestHash]
    );
  }

  return res.status(201).json({ success: true, data: responseData });
}));

/**
 * GET /api/orders/public/order/:id
 * Public order status for customers
 */
router.get('/public/order/:id', asyncHandler(async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const db = DatabaseService.getInstance().getDatabase();
  const order = await db.get<any>(
    'SELECT id, status, pickup_time, created_at, total_amount FROM orders WHERE id = ?',
    [id]
  );

  if (!order) {
    return res.status(404).json({ success: false, error: { message: 'Order not found' } });
  }

  res.json({
    success: true,
    data: order
  });
}));
router.get('/waiting-times', asyncHandler(async (req: Request, res: Response) => {
  const db = DatabaseService.getInstance().getDatabase();

  const orders = await db.all(`
    SELECT
      id,
      external_id,
      channel,
      status,
      customer_name,
      created_at,
      ROUND(EXTRACT(EPOCH FROM (NOW() - created_at)) / 60) as waiting_minutes
    FROM orders
    WHERE status IN (${ACTIVE_ORDER_STATUS_SQL_LIST})
    ORDER BY waiting_minutes DESC
  `);

  res.json({
    success: true,
    data: orders
  });
}));

/**
 * POST /api/orders
 * Create a new order (typically from delivery platforms or test orders)
 */
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const {
    externalId,
    channel,
    items,
    customerName,
    customerPhone,
    totalAmount,
    restaurantId: bodyRestaurantId,
    orderType,
    pickupTime,
    notes
  } = req.body;

  if (!externalId || !channel || !items || !totalAmount) {
    return res.status(400).json({
      success: false,
      error: { message: 'externalId, channel, items, and totalAmount are required' }
    });
  }

  const db = DatabaseService.getInstance().getDatabase();
  const restaurantId = bodyRestaurantId || req.user?.restaurantId;
  
  // Validate restaurantId is present
  if (!restaurantId) {
    return res.status(400).json({
      success: false,
      error: { message: 'Restaurant ID is required to create an order' }
    });
  }
  
  const orderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Validate modifiers (new schema) per item if selections provided
  const normalizedItems: any[] = [];
  const isTestOrder = String(channel || '').toLowerCase() === 'test';
  
  // Helper to fetch item details for display formatting
  const getMenuItem = async (itemId: string) => {
    return db.get('SELECT name, base_price FROM menu_items WHERE id = ? AND restaurant_id = ?', [itemId, restaurantId]);
  };
  
  // Helper to get modifier group names for display
  const getModifierGroupName = async (groupId: string) => {
    const row = await db.get('SELECT name FROM modifier_groups WHERE id = ? AND restaurant_id = ?', [groupId, restaurantId]);
    return row?.name || groupId;
  };
  
  // Helper to get modifier option name
  const getModifierOptionName = async (optionId: string) => {
    const row = await db.get('SELECT name FROM modifier_options WHERE id = ?', [optionId]);
    return row?.name || optionId;
  };
  
  // Helper to get size details
  const getSizeDetails = async (sizeId: string) => {
    return db.get('SELECT size_name, price FROM item_sizes WHERE id = ?', [sizeId]);
  };

  if (Array.isArray(items)) {
    let idx = 0;
    for (const line of items) {
      const lineItemId = line?.itemId || line?.id;
      const selections = Array.isArray(line?.selections) ? line.selections : [];
      const providedModifiers = line?.modifiers || line?.modifierSelections || {};
      const sizeId = line?.sizeId || line?.selectedSize?.id || line?.size?.id;

      // For dashboard "Create Test Order", allow orders without menu item IDs or modifier selections.
      if (isTestOrder) {
        // Format modifiers for display if provided
        let displayModifiers: Record<string, string> = {};
        if (providedModifiers && typeof providedModifiers === 'object') {
          displayModifiers = providedModifiers;
        }
        
        normalizedItems.push({
          item_id: lineItemId || `test_item_${idx}`,
          itemId: lineItemId || `test_item_${idx}`,
          name: line?.name || 'Test Item',
          quantity: line?.quantity || line?.qty || 1,
          qty: line?.quantity || line?.qty || 1,
          unit_price: line?.price || line?.unitPrice || 0,
          price: line?.price || line?.unitPrice || 0,
          size: line?.size?.sizeName || line?.sizeName || line?.selectedSize?.sizeName || null,
          sizeId: sizeId || null,
          modifiers: displayModifiers,
          modifiersSnapshot: [],
          modifiersPriceDelta: 0,
          notes: line?.specialInstructions || line?.notes || null
        });
        idx += 1;
        continue;
      }

      if (!lineItemId) {
        return res.status(400).json({
          success: false,
          error: { message: 'Each item must include itemId' }
        });
      }

      const validation = await validateItemSelections(lineItemId, selections);
      if (!validation.valid) {
        const err = validation.errors?.[0];
        return res.status(400).json({
          success: false,
          error: {
            code: err?.code || 'MODIFIER_INVALID',
            message: err?.message || 'Invalid modifier selection',
            groupId: err?.groupId,
            groupName: err?.groupName,
            reason: err?.reason
          }
        });
      }
      
      // Build display-friendly modifiers object { groupName: optionName }
      const displayModifiers: Record<string, string> = {};
      let sizeName: string | null = null;
      let effectivePrice = line?.price || line?.unitPrice || 0;
      
      // Handle size information
      if (sizeId) {
        const sizeDetails = await getSizeDetails(sizeId);
        if (sizeDetails) {
          sizeName = sizeDetails.size_name;
          effectivePrice = sizeDetails.price; // Size price overrides base price
        }
      }
      
      // Process modifier selections for display
      if (validation.snapshot && validation.snapshot.length > 0) {
        for (const groupSelection of validation.snapshot) {
          const groupName = await getModifierGroupName(groupSelection.groupId);
          const optionNames: string[] = [];
          for (const opt of groupSelection.options || []) {
            const optName = await getModifierOptionName(opt.optionId);
            optionNames.push(optName);
          }
          displayModifiers[groupName] = optionNames.join(', ');
        }
      }
      
      // Also process any provided modifiers object
      if (providedModifiers && typeof providedModifiers === 'object' && !Array.isArray(providedModifiers)) {
        for (const [key, value] of Object.entries(providedModifiers)) {
          if (!displayModifiers[key]) {
            displayModifiers[key] = String(value);
          }
        }
      }
      
      // Get menu item name if not provided
      let itemName = line?.name;
      if (!itemName) {
        const menuItem = await getMenuItem(lineItemId);
        itemName = menuItem?.name || lineItemId;
      }
      
      normalizedItems.push({
        item_id: lineItemId,
        itemId: lineItemId,
        name: itemName,
        quantity: line?.quantity || line?.qty || 1,
        qty: line?.quantity || line?.qty || 1,
        unit_price: effectivePrice,
        price: effectivePrice,
        size: sizeName,
        sizeId: sizeId || null,
        modifiers: displayModifiers,
        modifiersSnapshot: validation.snapshot || [],
        modifiersPriceDelta: validation.priceDeltaTotal || 0,
        notes: line?.specialInstructions || line?.notes || null
      });
      idx += 1;
    }
  }

  await db.run(`
    INSERT INTO orders (
      id, restaurant_id, external_id, channel, items, customer_name,
      customer_phone, total_amount, status, order_type, pickup_time, notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `, [
    orderId,
    restaurantId,
    externalId,
    channel,
    JSON.stringify(normalizedItems),
    customerName || null,
    customerPhone || null,
    totalAmount,
    'received',
    orderType || 'pickup',
    pickupTime || null,
    notes || null
  ]);
  
  // Create order_items records for admin page compatibility
  for (const item of normalizedItems) {
    await db.run(`
      INSERT INTO order_items (
        id, order_id, item_id, name, item_name_snapshot, qty, quantity, unit_price, price, 
        modifiers_json, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `, [
      `oi_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      orderId,
      item.item_id || item.itemId,
      item.name,
              item.name,
      item.qty || item.quantity || 1,
      item.quantity || item.qty || 1,
      item.unit_price || item.price || 0,
                      item.price || item.unit_price || 0,
      JSON.stringify(item.modifiers || {}),
      item.notes || null
    ]);
  }

  // Log the action (support both JWT and API key auth)
  await DatabaseService.getInstance().logAudit(
    restaurantId,
    req.user?.id ?? null,
    'create_order',
    'order',
    orderId,
    { externalId, channel, totalAmount, itemCount: items.length }
  );

  await eventBus.emit('order.created_web', {
    restaurantId,
    type: 'order.created_web',
    actor: { actorType: req.user?.id ? 'user' : 'api', actorId: req.user?.id ?? 'api' },
    payload: {
      orderId,
      customerName,
      totalAmount,
      channel
    },
    occurredAt: new Date().toISOString()
  });

  logger.info(`New order created: ${orderId} from ${channel}`);

  res.status(201).json({
    success: true,
    data: {
      orderId,
      externalId,
      channel,
      status: 'received',
      createdAt: new Date().toISOString()
    }
  });
}));

export default router;
