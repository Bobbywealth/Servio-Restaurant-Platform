import { validateItemSelections } from '../services/modifierValidation';
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
    let items: any[] = [];
    try {
      items = JSON.parse(order.items || '[]');
    } catch {
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
  const { status } = req.body;

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
  const order = await db.get<any>('SELECT * FROM orders WHERE id = ?', [id]);
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

  await DatabaseService.getInstance().logAudit(
    req.user?.restaurantId!,
    req.user?.id || 'system',
    'set_prep_time',
    'order',
    id,
    { prepMinutes: minutes, pickupTime }
  );

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

  const completedTodayCondition = "status = 'completed' AND created_at::date = CURRENT_DATE";

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
    db.all(`SELECT strftime('%H', created_at) as hour, COUNT(*) as count FROM orders WHERE restaurant_id = ? AND created_at >= ? GROUP BY hour ORDER BY hour`, [restaurantId, todayStr])
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
  const { slug } = req.params;
  const {
    items,
    customerName,
    customerPhone,
    customerEmail,
    orderType,
    specialInstructions,
    paymentMethod,
    marketingConsent
  } = req.body;
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
    orderType,
    paymentMethod,
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
        items, customer_name, customer_phone, order_type, special_instructions, marketing_consent, created_at, updated_at
      ) VALUES (?, ?, 'website', 'received', ?, 'unpaid', ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [
      orderId,
      restaurantId,
      totalAmount,
      JSON.stringify(parsedItems),
      customerName || null,
      customerPhone || null,
      orderType || 'pickup',
      specialInstructions || null,
      marketingConsent === true || marketingConsent === 'true' ? 1 : 0
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
        INSERT INTO order_items (id, order_id, menu_item_id, name, quantity, unit_price, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [uuidv4(), orderId, item.id, item.name, item.quantity, item.price, notes]);
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
    restaurantId: bodyRestaurantId
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
  const normalizedItems = [];
  const isTestOrder = String(channel || '').toLowerCase() === 'test';
  if (Array.isArray(items)) {
    let idx = 0;
    for (const line of items) {
      const lineItemId = line?.itemId || line?.id;
      const selections = Array.isArray(line?.selections) ? line.selections : [];

      // For dashboard "Create Test Order", allow orders without menu item IDs or modifier selections.
      // This keeps the demo button working even when menu items have required modifier groups.
      if (isTestOrder) {
        normalizedItems.push({
          ...line,
          itemId: lineItemId || `test_item_${idx}`,
          modifiersSnapshot: [],
          modifiersPriceDelta: 0
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
      normalizedItems.push({
        ...line,
        itemId: lineItemId,
        modifiersSnapshot: validation.snapshot || [],
        modifiersPriceDelta: validation.priceDeltaTotal || 0
      });
      idx += 1;
    }
  }

  await db.run(`
    INSERT INTO orders (
      id, restaurant_id, external_id, channel, items, customer_name,
      customer_phone, total_amount, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `, [
    orderId,
    restaurantId,
    externalId,
    channel,
    JSON.stringify(normalizedItems),
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