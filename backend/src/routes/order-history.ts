import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { requireAuth, requirePermission } from '../middleware/auth';
import { DatabaseService } from '../services/DatabaseService';

const router = Router();

/**
 * GET /api/orders/history
 * Get historical orders with filtering and pagination
 */
router.get('/', requireAuth, requirePermission('orders:read'), asyncHandler(async (req: Request, res: Response) => {
  const { 
    status, 
    channel, 
    dateFrom, 
    dateTo, 
    search,
    limit = 20, 
    offset = 0 
  } = req.query;
  
  const restaurantId = req.user?.restaurantId;
  const db = DatabaseService.getInstance().getDatabase();

  // Build query conditions
  const conditions: string[] = ['o.restaurant_id = ?'];
  const params: any[] = [restaurantId];

  if (status && status !== 'all') {
    conditions.push('o.status = ?');
    params.push(status);
  }

  if (channel && channel !== 'all') {
    conditions.push('o.channel = ?');
    params.push(channel);
  }

  if (dateFrom) {
    conditions.push('DATE(o.created_at) >= ?');
    params.push(dateFrom);
  }

  if (dateTo) {
    conditions.push('DATE(o.created_at) <= ?');
    params.push(dateTo);
  }

  if (search && String(search).trim()) {
    const searchTerm = `%${String(search).trim()}%`;
    conditions.push('(o.external_id LIKE ? OR o.customer_name LIKE ? OR o.customer_phone LIKE ?)');
    params.push(searchTerm, searchTerm, searchTerm);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get orders with items
  const ordersQuery = `
    SELECT 
      o.*,
      COUNT(oi.id) as item_count
    FROM orders o
    LEFT JOIN order_items oi ON o.id = oi.order_id
    ${whereClause}
    GROUP BY o.id
    ORDER BY o.created_at DESC
    LIMIT ? OFFSET ?
  `;

  const countQuery = `
    SELECT COUNT(DISTINCT o.id) as total
    FROM orders o
    ${whereClause}
  `;

  const [orders, countResult] = await Promise.all([
    db.all(ordersQuery, [...params, Number(limit), Number(offset)]),
    db.get(countQuery, params)
  ]);

  const total = Number(countResult?.total || 0);

  // Get order items for each order
  const orderIds = orders.map((o: any) => o.id);
  const orderItems = new Map();

  if (orderIds.length > 0) {
    const placeholders = orderIds.map(() => '?').join(', ');
    const items = await db.all(
      `SELECT * FROM order_items WHERE order_id IN (${placeholders}) ORDER BY created_at ASC`,
      orderIds
    );

    for (const item of items) {
      if (!orderItems.has(item.order_id)) {
        orderItems.set(item.order_id, []);
      }
      orderItems.get(item.order_id).push({
        id: item.id,
        name: item.name,
        quantity: item.quantity || item.qty || 0,
        unitPrice: item.unit_price || item.unit_price_snapshot || 0,
        notes: item.notes,
        modifiers: item.modifiers_json ? JSON.parse(item.modifiers_json) : {}
      });
    }
  }

  // Format orders with items
  const formattedOrders = orders.map((order: any) => ({
    id: order.id,
    external_id: order.external_id,
    channel: order.channel,
    status: order.status,
    customer_name: order.customer_name,
    customer_phone: order.customer_phone,
    total_amount: order.total_amount,
    payment_status: order.payment_status,
    created_at: order.created_at,
    updated_at: order.updated_at,
    prep_time_minutes: order.prep_time_minutes,
    accepted_at: order.accepted_at,
    source: order.source,
    orderItems: orderItems.get(order.id) || []
  }));

  res.json({
    success: true,
    data: {
      orders: formattedOrders,
      pagination: {
        total,
        limit: Number(limit),
        offset: Number(offset),
        hasMore: total > Number(offset) + orders.length
      }
    }
  });
}));

/**
 * GET /api/orders/history/stats
 * Get historical order statistics
 */
router.get('/stats', requireAuth, requirePermission('orders:read'), asyncHandler(async (req: Request, res: Response) => {
  const { dateFrom, dateTo, channel } = req.query;
  const restaurantId = req.user?.restaurantId;
  const db = DatabaseService.getInstance().getDatabase();

  const conditions: string[] = ['restaurant_id = ?'];
  const params: any[] = [restaurantId];

  if (dateFrom) {
    conditions.push('DATE(created_at) >= ?');
    params.push(dateFrom);
  }

  if (dateTo) {
    conditions.push('DATE(created_at) <= ?');
    params.push(dateTo);
  }

  if (channel && channel !== 'all') {
    conditions.push('channel = ?');
    params.push(channel);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const [
    totalStats,
    statusBreakdown,
    channelBreakdown,
    hourlyData
  ] = await Promise.all([
    // Overall statistics
    db.get(`
      SELECT 
        COUNT(*) as totalOrders,
        COALESCE(SUM(total_amount), 0) as totalRevenue,
        COALESCE(AVG(total_amount), 0) as avgOrderValue,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completedOrders,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelledOrders
      FROM orders ${whereClause}
    `, params),

    // Status breakdown
    db.all(`
      SELECT status, COUNT(*) as count
      FROM orders ${whereClause}
      GROUP BY status
      ORDER BY count DESC
    `, params),

    // Channel breakdown  
    db.all(`
      SELECT channel, COUNT(*) as count
      FROM orders ${whereClause}
      GROUP BY channel
      ORDER BY count DESC
    `, params),

    // Hourly breakdown
    db.all(`
      SELECT 
        strftime('%H', created_at) as hour,
        COUNT(*) as count
      FROM orders ${whereClause}
      GROUP BY strftime('%H', created_at)
      ORDER BY count DESC
      LIMIT 1
    `, params)
  ]);

  const topChannel = channelBreakdown[0]?.channel || 'website';
  const busiestHour = hourlyData[0] ? `${hourlyData[0].hour}:00` : '12:00';

  res.json({
    success: true,
    data: {
      totalOrders: Number(totalStats?.totalOrders || 0),
      totalRevenue: Number(totalStats?.totalRevenue || 0),
      avgOrderValue: Number(totalStats?.avgOrderValue || 0),
      completedOrders: Number(totalStats?.completedOrders || 0),
      cancelledOrders: Number(totalStats?.cancelledOrders || 0),
      topChannel,
      busiest_hour: busiestHour,
      statusBreakdown: statusBreakdown || [],
      channelBreakdown: channelBreakdown || []
    }
  });
}));

/**
 * GET /api/orders/export  
 * Export orders to CSV
 */
router.get('/export', requireAuth, requirePermission('orders:read'), asyncHandler(async (req: Request, res: Response) => {
  const { status, channel, dateFrom, dateTo, search } = req.query;
  const restaurantId = req.user?.restaurantId;
  const db = DatabaseService.getInstance().getDatabase();

  // Build query (same as history endpoint but no pagination)
  const conditions: string[] = ['o.restaurant_id = ?'];
  const params: any[] = [restaurantId];

  if (status && status !== 'all') {
    conditions.push('o.status = ?');
    params.push(status);
  }

  if (channel && channel !== 'all') {
    conditions.push('o.channel = ?');
    params.push(channel);
  }

  if (dateFrom) {
    conditions.push('DATE(o.created_at) >= ?');
    params.push(dateFrom);
  }

  if (dateTo) {
    conditions.push('DATE(o.created_at) <= ?');
    params.push(dateTo);
  }

  if (search && String(search).trim()) {
    const searchTerm = `%${String(search).trim()}%`;
    conditions.push('(o.external_id LIKE ? OR o.customer_name LIKE ? OR o.customer_phone LIKE ?)');
    params.push(searchTerm, searchTerm, searchTerm);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const orders = await db.all(`
    SELECT 
      o.id,
      o.external_id,
      o.channel,
      o.status,
      o.customer_name,
      o.customer_phone,
      o.total_amount,
      o.payment_status,
      o.created_at,
      o.updated_at,
      o.prep_time_minutes,
      o.accepted_at,
      COUNT(oi.id) as item_count
    FROM orders o
    LEFT JOIN order_items oi ON o.id = oi.order_id
    ${whereClause}
    GROUP BY o.id
    ORDER BY o.created_at DESC
  `, params);

  // Generate CSV
  const headers = [
    'Order ID',
    'External ID', 
    'Channel',
    'Status',
    'Customer Name',
    'Customer Phone',
    'Total Amount',
    'Payment Status',
    'Items Count',
    'Prep Time (min)',
    'Created At',
    'Accepted At'
  ].join(',');

  const rows = orders.map((order: any) => [
    order.id,
    order.external_id || '',
    order.channel || '',
    order.status || '',
    order.customer_name || '',
    order.customer_phone || '',
    order.total_amount || 0,
    order.payment_status || '',
    order.item_count || 0,
    order.prep_time_minutes || '',
    order.created_at || '',
    order.accepted_at || ''
  ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(','));

  const csv = [headers, ...rows].join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="order-history-${new Date().toISOString().split('T')[0]}.csv"`);
  res.send(csv);
}));

export default router;