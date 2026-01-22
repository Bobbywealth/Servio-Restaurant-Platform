import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { DatabaseService } from '../services/DatabaseService';
import { asyncHandler, BadRequestError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { eventBus } from '../events/bus';

const router = Router();
const num = (v: any) => (typeof v === 'number' ? v : Number(v ?? 0));
const getRequestId = (req: Request) => {
  const headerId =
    (req.headers['x-request-id'] as string) ||
    (req.headers['x-correlation-id'] as string) ||
    (req.headers['x-amzn-trace-id'] as string);
  return headerId || uuidv4();
};

/**
 * GET /api/orders
 * Get orders with optional filtering
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const { status, channel, limit = 50, offset = 0 } = req.query;
  const db = DatabaseService.getInstance().getDatabase();
  const restaurantId = req.user?.restaurantId;
  const requestId = getRequestId(req);

  const authHeader = req.headers.authorization;
  let decodedToken: any = null;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice('Bearer '.length).trim();
    try {
      decodedToken = jwt.decode(token);
    } catch (err) {
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
    let items: any[] = [];
    try {
      items = JSON.parse(order.items || '[]');
    } catch (err) {
      logger.warn(
        `[orders.list] invalid_items_json ${JSON.stringify({
          requestId,
          orderId: order?.id ?? null
        })}`
      );
    }
    return {
      ...order,
      items
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
 * GET /api/orders/:id
 * Get a specific order by ID
 */
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const db = DatabaseService.getInstance().getDatabase();

  const order = await db.get('SELECT * FROM orders WHERE id = ?', [id]);

  if (!order) {
    return res.status(404).json({
      success: false,
      error: { message: 'Order not found' }
    });
  }

  const formattedOrder = {
    ...order,
    items: JSON.parse(order.items || '[]')
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
  const { status, userId } = req.body;

  const validStatuses = ['received', 'preparing', 'ready', 'completed', 'cancelled'];

  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'Invalid status. Must be one of: ' + validStatuses.join(', ')
      }
    });
  }

  const db = DatabaseService.getInstance().getDatabase();

  // Check if order exists
  const order = await db.get('SELECT * FROM orders WHERE id = ?', [id]);
  if (!order) {
    return res.status(404).json({
      success: false,
      error: { message: 'Order not found' }
    });
  }

  // Update the order
  await db.run(
    'UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [status, id]
  );

  // Log the action
  await DatabaseService.getInstance().logAudit(
    req.user?.restaurantId!,
    req.user?.id || 'system',
    'update_order_status',
    'order',
    id,
    { previousStatus: order.status, newStatus: status }
  );

  await eventBus.emit('order.status_changed', {
    restaurantId: req.user?.restaurantId!,
    type: 'order.status_changed',
    actor: { actorType: 'user', actorId: req.user?.id },
    payload: { orderId: id, previousStatus: order.status, newStatus: status },
    occurredAt: new Date().toISOString()
  });

  logger.info(`Order ${id} status updated from ${order.status} to ${status}`);

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
 * GET /api/orders/stats/summary
 * Get order statistics summary
 */
router.get('/stats/summary', asyncHandler(async (req: Request, res: Response) => {
  const db = DatabaseService.getInstance().getDatabase();
  const dialect = DatabaseService.getInstance().getDialect();

  const restaurantId = req.user?.restaurantId;

  const completedTodayCondition =
    dialect === 'postgres'
      ? "status = 'completed' AND created_at::date = CURRENT_DATE"
      : 'status = \'completed\' AND DATE(created_at) = DATE(\'now\')';

  const [
    totalOrders,
    activeOrders,
    completedToday,
    completedTodaySales,
    avgOrderValue,
    ordersByStatus,
    ordersByChannel
  ] = await Promise.all([
    db.get('SELECT COUNT(*) as count FROM orders WHERE restaurant_id = ?', [restaurantId]),
    db.get('SELECT COUNT(*) as count FROM orders WHERE status IN (\'received\', \'preparing\', \'ready\') AND restaurant_id = ?', [restaurantId]),
    db.get(`SELECT COUNT(*) as count FROM orders WHERE ${completedTodayCondition} AND restaurant_id = ?`, [restaurantId]),
    db.get(`SELECT COALESCE(SUM(total_amount), 0) as sum FROM orders WHERE ${completedTodayCondition} AND restaurant_id = ?`, [restaurantId]),
    db.get(`SELECT AVG(total_amount) as avg FROM orders WHERE ${completedTodayCondition} AND restaurant_id = ?`, [restaurantId]),
    db.all('SELECT status, COUNT(*) as count FROM orders WHERE restaurant_id = ? GROUP BY status', [restaurantId]),
    db.all('SELECT channel, COUNT(*) as count FROM orders WHERE restaurant_id = ? GROUP BY channel', [restaurantId])
  ]);

  const stats = {
    totalOrders: num(totalOrders.count),
    activeOrders: num(activeOrders.count),
    completedToday: num(completedToday.count),
    completedTodaySales: parseFloat((completedTodaySales.sum || 0).toFixed(2)),
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
    data: stats
  });
}));

/**
 * POST /api/orders/public/:slug
 * Create a new order via public site
 */
router.post('/public/:slug', asyncHandler(async (req: Request, res: Response) => {
  const { slug } = req.params;
  const { items, customerName, customerPhone, customerEmail } = req.body;
  const db = DatabaseService.getInstance().getDatabase();
  const requestId = getRequestId(req);

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
    itemsCount: Array.isArray(parsedItems) ? parsedItems.length : 0
  };

  const restaurant = await db.get('SELECT id, slug FROM restaurants WHERE slug = ?', [slug]);
  const restaurantId = restaurant?.id ?? null;

  logger.info(
    `[orders.public] entry ${JSON.stringify({
      requestId,
      slug,
      restaurant: restaurant ?? null,
      restaurantId,
      body: safeBody
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

  const orderId = uuidv4();
  // Calculate total and validate items (simplified for v1 fast build)
  let totalAmount = 0;
  for (const item of parsedItems) {
    const price = Number(item?.price ?? 0);
    const quantity = Number(item?.quantity ?? 0);
    if (!Number.isFinite(price) || !Number.isFinite(quantity) || quantity <= 0) {
      return res.status(400).json({ success: false, error: { message: 'Invalid items' } });
    }
    totalAmount += price * quantity;
  }

  try {
    await db.run(`
      INSERT INTO orders (
        id, restaurant_id, channel, status, total_amount, payment_status,
        items, customer_name, customer_phone, created_at, updated_at
      ) VALUES (?, ?, 'website', 'received', ?, 'unpaid', ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [
      orderId,
      restaurantId,
      totalAmount,
      JSON.stringify(parsedItems),
      customerName || null,
      customerPhone || null
    ]);

    // Create order items
    for (const item of parsedItems) {
      await db.run(`
        INSERT INTO order_items (id, order_id, menu_item_id, name, quantity, unit_price)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [uuidv4(), orderId, item.id, item.name, item.quantity, item.price]);
    }

  } catch (error) {
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

  try {
    // Notify dashboard via Socket.IO
    const io = req.app.get('socketio');
    if (io) {
      io.to(`restaurant-${restaurantId}`).emit('new-order', { orderId, totalAmount });
    }

    await eventBus.emit('order.created_web', {
      restaurantId,
      type: 'order.created_web',
      actor: { actorType: 'system' },
      payload: {
        orderId,
        customerName,
        totalAmount,
        channel: 'website'
      },
      occurredAt: new Date().toISOString()
    });

    await DatabaseService.getInstance().logAudit(restaurantId, null, 'create_public_order', 'order', orderId, { totalAmount });
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

  return res.status(201).json({
    success: true,
    data: { orderId, status: 'received' }
  });
}));
router.get('/waiting-times', asyncHandler(async (req: Request, res: Response) => {
  const db = DatabaseService.getInstance().getDatabase();
  const dialect = DatabaseService.getInstance().getDialect();

  const orders =
    dialect === 'postgres'
      ? await db.all(`
          SELECT
            id,
            external_id,
            channel,
            status,
            customer_name,
            created_at,
            ROUND(EXTRACT(EPOCH FROM (NOW() - created_at)) / 60) as waiting_minutes
          FROM orders
          WHERE status IN ('received', 'preparing', 'ready')
          ORDER BY waiting_minutes DESC
        `)
      : await db.all(`
          SELECT
            id,
            external_id,
            channel,
            status,
            customer_name,
            created_at,
            ROUND((julianday('now') - julianday(created_at)) * 24 * 60) as waiting_minutes
          FROM orders
          WHERE status IN ('received', 'preparing', 'ready')
          ORDER BY waiting_minutes DESC
        `);

  res.json({
    success: true,
    data: orders
  });
}));

/**
 * POST /api/orders
 * Create a new order (typically from delivery platforms)
 */
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const {
    externalId,
    channel,
    items,
    customerName,
    customerPhone,
    totalAmount,
    userId
  } = req.body;

  if (!externalId || !channel || !items || !totalAmount) {
    return res.status(400).json({
      success: false,
      error: { message: 'externalId, channel, items, and totalAmount are required' }
    });
  }

  const db = DatabaseService.getInstance().getDatabase();
  const orderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  await db.run(`
    INSERT INTO orders (
      id, external_id, channel, items, customer_name,
      customer_phone, total_amount, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    orderId,
    externalId,
    channel,
    JSON.stringify(items),
    customerName || null,
    customerPhone || null,
    totalAmount,
    'received'
  ]);

  // Log the action
  await DatabaseService.getInstance().logAudit(
    req.user?.restaurantId!,
    req.user?.id || 'system',
    'create_order',
    'order',
    orderId,
    { externalId, channel, totalAmount, itemCount: items.length }
  );

  await eventBus.emit('order.created_web', {
    restaurantId: req.user?.restaurantId!,
    type: 'order.created_web',
    actor: { actorType: 'user', actorId: req.user?.id },
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
    items: JSON.parse(order.items || '[]')
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

export default router;