import { Router, Request, Response } from 'express';
import { DatabaseService } from '../services/DatabaseService';
import { asyncHandler, BadRequestError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
const num = (v: any) => (typeof v === 'number' ? v : Number(v ?? 0));

/**
 * GET /api/orders
 * Get orders with optional filtering
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const { status, channel, limit = 50, offset = 0 } = req.query;
  const db = DatabaseService.getInstance().getDatabase();
  const restaurantId = req.user?.restaurantId;

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
  const formattedOrders = orders.map((order: any) => ({
    ...order,
    items: JSON.parse(order.items || '[]')
  }));

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
  const { id } = req.params;
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
  const { id } = req.params;
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
    avgOrderValue,
    ordersByStatus,
    ordersByChannel
  ] = await Promise.all([
    db.get('SELECT COUNT(*) as count FROM orders WHERE restaurant_id = ?', [restaurantId]),
    db.get('SELECT COUNT(*) as count FROM orders WHERE status IN (\'received\', \'preparing\', \'ready\') AND restaurant_id = ?', [restaurantId]),
    db.get(`SELECT COUNT(*) as count FROM orders WHERE ${completedTodayCondition} AND restaurant_id = ?`, [restaurantId]),
    db.get(`SELECT AVG(total_amount) as avg FROM orders WHERE ${completedTodayCondition} AND restaurant_id = ?`, [restaurantId]),
    db.all('SELECT status, COUNT(*) as count FROM orders WHERE restaurant_id = ? GROUP BY status', [restaurantId]),
    db.all('SELECT channel, COUNT(*) as count FROM orders WHERE restaurant_id = ? GROUP BY channel', [restaurantId])
  ]);

  const stats = {
    totalOrders: num(totalOrders.count),
    activeOrders: num(activeOrders.count),
    completedToday: num(completedToday.count),
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

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, error: { message: 'Items are required' } });
  }

  const db = DatabaseService.getInstance().getDatabase();
  const restaurant = await db.get('SELECT id FROM restaurants WHERE slug = ?', [slug]);
  if (!restaurant) throw new BadRequestError('Restaurant not found');

  const orderId = uuidv4();
  const restaurantId = restaurant.id;

  // Calculate total and validate items (simplified for v1 fast build)
  let totalAmount = 0;
  for (const item of items) {
    totalAmount += (item.price * item.quantity);
  }

  await db.run(`
    INSERT INTO orders (
      id, restaurant_id, channel, status, total_amount, payment_status, created_at, updated_at
    ) VALUES (?, ?, 'website', 'NEW', ?, 'unpaid', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `, [orderId, restaurantId, totalAmount]);

  // Create order items
  for (const item of items) {
    await db.run(`
      INSERT INTO order_items (id, order_id, menu_item_id, name, quantity, unit_price)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [uuidv4(), orderId, item.id, item.name, item.quantity, item.price]);
  }

  // Notify dashboard via Socket.IO
  const io = req.app.get('socketio');
  if (io) {
    io.to(`restaurant-${restaurantId}`).emit('new-order', { orderId, totalAmount });
  }

  await DatabaseService.getInstance().logAudit(restaurantId, null, 'create_public_order', 'order', orderId, { totalAmount });

  res.status(201).json({
    success: true,
    data: { orderId, status: 'NEW' }
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