import { validateItemSelections } from '../services/modifierValidation';
import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { DatabaseService } from '../services/DatabaseService';
import { asyncHandler, ForbiddenError, NotFoundError, UnauthorizedError, ValidationError } from '../middleware/errorHandler';
import { requireAuth } from '../middleware/auth';

const router = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getRestaurantId(req: Request): string {
  const rid = (req as any).user?.restaurantId;
  if (!rid) throw new UnauthorizedError('Missing restaurant context');
  return rid;
}

function getUserId(req: Request): string {
  const uid = (req as any).user?.id;
  if (!uid) throw new UnauthorizedError('Missing user context');
  return uid;
}

interface OrderRow {
  id: string;
  restaurant_id: string;
  table_id: string | null;
  table_name?: string | null;
  status: string;
  payment_status: string;
  total_amount: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface OrderItemRow {
  id: string;
  order_id: string;
  menu_item_id: string;
  menu_item_name?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  special_instructions: string | null;
  modifier_selections?: string | null;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /orders - list orders for the restaurant
router.get('/', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const restaurantId = getRestaurantId(req);
  const db = DatabaseService.getInstance().getDatabase();

  const { status, payment_status, table_id, limit = '50', offset = '0', date } = req.query as Record<string, string>;

  let query = `
    SELECT o.*, t.name as table_name
    FROM orders o
    LEFT JOIN tables t ON o.table_id = t.id
    WHERE o.restaurant_id = ?
  `;
  const params: any[] = [restaurantId];

  if (status) {
    query += ' AND o.status = ?';
    params.push(status);
  }

  if (payment_status) {
    query += ' AND o.payment_status = ?';
    params.push(payment_status);
  }

  if (table_id) {
    query += ' AND o.table_id = ?';
    params.push(table_id);
  }

  if (date) {
    query += ' AND DATE(o.created_at) = ?';
    params.push(date);
  }

  // Count query
  const countQuery = query.replace(
    'SELECT o.*, t.name as table_name',
    'SELECT COUNT(*) as count'
  );
  const total = await db.get<{ count: number }>(countQuery, params);

  query += ' ORDER BY o.created_at DESC LIMIT ? OFFSET ?';
  params.push(Number(limit), Number(offset));

  const orders = await db.all<OrderRow>(query, params);

  // Get items for each order
  const ordersWithItems = await Promise.all(
    orders.map(async (order) => {
      const items = await db.all<OrderItemRow>(
        `SELECT oi.*, mi.name as menu_item_name
         FROM order_items oi
         LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
         WHERE oi.order_id = ?`,
        [order.id]
      );
      return {
        ...order,
        items: items.map(item => ({
          ...item,
          modifier_selections: item.modifier_selections
            ? (() => { try { return JSON.parse(item.modifier_selections!); } catch { return []; } })()
            : []
        }))
      };
    })
  );

  res.json({
    success: true,
    data: {
      orders: ordersWithItems,
      pagination: {
        total: total?.count ?? 0,
        limit: Number(limit),
        offset: Number(offset),
        hasMore: total ? total.count > Number(offset) + orders.length : false
      }
    }
  });
}));

// GET /orders/analytics - revenue and order analytics
router.get('/analytics', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const restaurantId = getRestaurantId(req);
  const db = DatabaseService.getInstance().getDatabase();

  const { period = 'today', date } = req.query as Record<string, string>;

  let dateFilter: string;
  let compareFilter: string;
  const params: any[] = [restaurantId];
  const compareParams: any[] = [restaurantId];

  const targetDate = date || new Date().toISOString().split('T')[0];

  if (period === 'today') {
    dateFilter = `DATE(o.created_at) = ?`;
    compareFilter = `DATE(o.created_at) = DATE(? - INTERVAL '1 day')`;
    params.push(targetDate);
    compareParams.push(targetDate);
  } else if (period === 'week') {
    dateFilter = `o.created_at >= NOW() - INTERVAL '7 days'`;
    compareFilter = `o.created_at >= NOW() - INTERVAL '14 days' AND o.created_at < NOW() - INTERVAL '7 days'`;
  } else if (period === 'month') {
    dateFilter = `o.created_at >= NOW() - INTERVAL '30 days'`;
    compareFilter = `o.created_at >= NOW() - INTERVAL '60 days' AND o.created_at < NOW() - INTERVAL '30 days'`;
  } else {
    dateFilter = `DATE(o.created_at) = ?`;
    compareFilter = `DATE(o.created_at) = DATE(? - INTERVAL '1 day')`;
    params.push(targetDate);
    compareParams.push(targetDate);
  }

  // Current period stats
  const statsQuery = `
    SELECT
      COUNT(*) as total_orders,
      COALESCE(SUM(CASE WHEN o.payment_status = 'paid' THEN o.total_amount ELSE 0 END), 0) as total_revenue,
      COALESCE(AVG(CASE WHEN o.payment_status = 'paid' THEN o.total_amount END), 0) as avg_order_value,
      COUNT(CASE WHEN o.status = 'pending' THEN 1 END) as pending_orders,
      COUNT(CASE WHEN o.status = 'preparing' THEN 1 END) as preparing_orders,
      COUNT(CASE WHEN o.status = 'ready' THEN 1 END) as ready_orders,
      COUNT(CASE WHEN o.status = 'completed' THEN 1 END) as completed_orders
    FROM orders o
    WHERE o.restaurant_id = ? AND ${dateFilter}
  `;

  const stats = await db.get<any>(statsQuery, params);

  // Compare period stats
  const compareQuery = `
    SELECT
      COUNT(*) as total_orders,
      COALESCE(SUM(CASE WHEN o.payment_status = 'paid' THEN o.total_amount ELSE 0 END), 0) as total_revenue
    FROM orders o
    WHERE o.restaurant_id = ? AND ${compareFilter}
  `;

  const compareStats = await db.get<any>(compareQuery, compareParams);

  // Hourly breakdown (PostgreSQL)
  const hourlyQuery = `
    SELECT
      EXTRACT(HOUR FROM created_at)::text as hour,
      COUNT(*) as orders,
      COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN total_amount ELSE 0 END), 0) as revenue
    FROM orders
    WHERE restaurant_id = ? AND ${dateFilter}
    GROUP BY EXTRACT(HOUR FROM created_at)
    ORDER BY EXTRACT(HOUR FROM created_at)
  `;

  const hourly = await db.all<any>(hourlyQuery, params);

  // Top items
  const topItemsQuery = `
    SELECT
      mi.name,
      SUM(oi.quantity) as total_quantity,
      SUM(oi.total_price) as total_revenue
    FROM order_items oi
    JOIN menu_items mi ON oi.menu_item_id = mi.id
    JOIN orders o ON oi.order_id = o.id
    WHERE o.restaurant_id = ? AND ${dateFilter}
    GROUP BY mi.id, mi.name
    ORDER BY total_quantity DESC
    LIMIT 10
  `;

  const topItems = await db.all<any>(topItemsQuery, params);

  const revenueChange = compareStats && compareStats.total_revenue > 0
    ? ((stats.total_revenue - compareStats.total_revenue) / compareStats.total_revenue) * 100
    : 0;

  const ordersChange = compareStats && compareStats.total_orders > 0
    ? ((stats.total_orders - compareStats.total_orders) / compareStats.total_orders) * 100
    : 0;

  res.json({
    success: true,
    data: {
      period,
      stats: {
        totalOrders: stats?.total_orders ?? 0,
        totalRevenue: stats?.total_revenue ?? 0,
        avgOrderValue: stats?.avg_order_value ?? 0,
        pendingOrders: stats?.pending_orders ?? 0,
        preparingOrders: stats?.preparing_orders ?? 0,
        readyOrders: stats?.ready_orders ?? 0,
        completedOrders: stats?.completed_orders ?? 0
      },
      changes: {
        revenue: revenueChange,
        orders: ordersChange
      },
      hourly,
      topItems
    }
  });
}));

// GET /orders/:id - get a single order
router.get('/:id', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const restaurantId = getRestaurantId(req);
  const { id } = req.params;
  const db = DatabaseService.getInstance().getDatabase();

  const order = await db.get<OrderRow>(
    `SELECT o.*, t.name as table_name
     FROM orders o
     LEFT JOIN tables t ON o.table_id = t.id
     WHERE o.id = ? AND o.restaurant_id = ?`,
    [id, restaurantId]
  );

  if (!order) throw new NotFoundError('Order not found');

  const items = await db.all<OrderItemRow>(
    `SELECT oi.*, mi.name as menu_item_name
     FROM order_items oi
     LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
     WHERE oi.order_id = ?`,
    [order.id]
  );

  res.json({
    success: true,
    data: {
      ...order,
      items: items.map(item => ({
        ...item,
        modifier_selections: item.modifier_selections
          ? (() => { try { return JSON.parse(item.modifier_selections!); } catch { return []; } })()
          : []
      }))
    }
  });
}));

// POST /orders - create a new order
router.post('/', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const restaurantId = getRestaurantId(req);
  const { table_id, items, notes } = req.body ?? {};

  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new ValidationError('Order must contain at least one item');
  }

  const db = DatabaseService.getInstance().getDatabase();

  // Validate table belongs to this restaurant
  if (table_id) {
    const table = await db.get<any>(
      'SELECT id FROM tables WHERE id = ? AND restaurant_id = ?',
      [table_id, restaurantId]
    );
    if (!table) throw new NotFoundError('Table not found');
  }

  // Validate and price items
  const pricedItems = await Promise.all(
    items.map(async (item: any) => {
      const menuItem = await db.get<any>(
        'SELECT * FROM menu_items WHERE id = ? AND restaurant_id = ? AND is_available = TRUE',
        [item.menu_item_id, restaurantId]
      );
      if (!menuItem) throw new NotFoundError(`Menu item ${item.menu_item_id} not found or unavailable`);

      // Validate modifier selections
      let modifierSelections: any[] = [];
      let modifierTotal = 0;

      if (item.modifier_selections && Array.isArray(item.modifier_selections) && item.modifier_selections.length > 0) {
        const validation = await validateItemSelections(db, item.menu_item_id, item.modifier_selections);
        if (!validation.valid) {
          throw new ValidationError(`Invalid modifier selections for ${menuItem.name}: ${validation.errors.join(', ')}`);
        }
        modifierSelections = item.modifier_selections;
        modifierTotal = validation.total ?? 0;
      }

      const unitPrice = menuItem.price + modifierTotal;
      const quantity = Number(item.quantity) || 1;

      return {
        menu_item_id: item.menu_item_id,
        menu_item_name: menuItem.name,
        quantity,
        unit_price: unitPrice,
        total_price: unitPrice * quantity,
        special_instructions: item.special_instructions || null,
        modifier_selections: modifierSelections
      };
    })
  );

  const totalAmount = pricedItems.reduce((sum, item) => sum + item.total_price, 0);

  // Create order
  const { v4: uuidv4 } = await import('uuid');
  const orderId = uuidv4();

  await db.run(
    'INSERT INTO orders (id, restaurant_id, table_id, status, payment_status, total_amount, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [orderId, restaurantId, table_id || null, 'pending', 'unpaid', totalAmount, notes || null]
  );

  // Create order items
  await Promise.all(
    pricedItems.map(async (item) => {
      const itemId = uuidv4();
      await db.run(
        'INSERT INTO order_items (id, order_id, menu_item_id, quantity, unit_price, total_price, special_instructions, modifier_selections) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [
          itemId,
          orderId,
          item.menu_item_id,
          item.quantity,
          item.unit_price,
          item.total_price,
          item.special_instructions,
          item.modifier_selections.length > 0 ? JSON.stringify(item.modifier_selections) : null
        ]
      );
    })
  );

  const order = await db.get<OrderRow>('SELECT * FROM orders WHERE id = ?', [orderId]);
  const orderItems = await db.all<OrderItemRow>(
    `SELECT oi.*, mi.name as menu_item_name
     FROM order_items oi
     LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
     WHERE oi.order_id = ?`,
    [orderId]
  );

  res.status(201).json({
    success: true,
    data: {
      ...order,
      items: orderItems.map(item => ({
        ...item,
        modifier_selections: item.modifier_selections
          ? (() => { try { return JSON.parse(item.modifier_selections!); } catch { return []; } })()
          : []
      }))
    }
  });
}));

// PATCH /orders/:id/status - update order status
router.patch('/:id/status', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const restaurantId = getRestaurantId(req);
  const { id } = req.params;
  const { status } = req.body ?? {};

  const validStatuses = ['pending', 'preparing', 'ready', 'completed', 'cancelled'];
  if (!status || !validStatuses.includes(status)) {
    throw new ValidationError(`Status must be one of: ${validStatuses.join(', ')}`);
  }

  const db = DatabaseService.getInstance().getDatabase();

  const order = await db.get<OrderRow>(
    'SELECT * FROM orders WHERE id = ? AND restaurant_id = ?',
    [id, restaurantId]
  );
  if (!order) throw new NotFoundError('Order not found');

  await db.run(
    'UPDATE orders SET status = ?, updated_at = NOW() WHERE id = ? AND restaurant_id = ?',
    [status, id, restaurantId]
  );

  res.json({ success: true, data: { id, status } });
}));

// PATCH /orders/:id/payment - update payment status
router.patch('/:id/payment', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const restaurantId = getRestaurantId(req);
  const { id } = req.params;
  const { payment_status, payment_method } = req.body ?? {};

  const validPaymentStatuses = ['unpaid', 'paid', 'refunded'];
  if (!payment_status || !validPaymentStatuses.includes(payment_status)) {
    throw new ValidationError(`Payment status must be one of: ${validPaymentStatuses.join(', ')}`);
  }

  const db = DatabaseService.getInstance().getDatabase();

  const order = await db.get<OrderRow>(
    'SELECT * FROM orders WHERE id = ? AND restaurant_id = ?',
    [id, restaurantId]
  );
  if (!order) throw new NotFoundError('Order not found');

  await db.run(
    'UPDATE orders SET payment_status = ?, payment_method = ?, updated_at = NOW() WHERE id = ? AND restaurant_id = ?',
    [payment_status, payment_method || null, id, restaurantId]
  );

  res.json({ success: true, data: { id, payment_status } });
}));

// DELETE /orders/:id - cancel/delete an order
router.delete('/:id', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const restaurantId = getRestaurantId(req);
  const { id } = req.params;
  const db = DatabaseService.getInstance().getDatabase();

  const order = await db.get<OrderRow>(
    'SELECT * FROM orders WHERE id = ? AND restaurant_id = ?',
    [id, restaurantId]
  );
  if (!order) throw new NotFoundError('Order not found');

  if (order.payment_status === 'paid') {
    throw new ForbiddenError('Cannot delete a paid order');
  }

  await db.run('DELETE FROM order_items WHERE order_id = ?', [id]);
  await db.run('DELETE FROM orders WHERE id = ? AND restaurant_id = ?', [id, restaurantId]);

  res.json({ success: true, data: { deleted: true } });
}));

// GET /orders/table/:tableId - get active orders for a table
router.get('/table/:tableId', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const restaurantId = getRestaurantId(req);
  const { tableId } = req.params;
  const db = DatabaseService.getInstance().getDatabase();

  // Verify table belongs to restaurant
  const table = await db.get<any>(
    'SELECT * FROM tables WHERE id = ? AND restaurant_id = ?',
    [tableId, restaurantId]
  );
  if (!table) throw new NotFoundError('Table not found');

  const orders = await db.all<OrderRow>(
    `SELECT o.*, t.name as table_name
     FROM orders o
     LEFT JOIN tables t ON o.table_id = t.id
     WHERE o.table_id = ? AND o.restaurant_id = ? AND o.status NOT IN ('completed', 'cancelled')
     ORDER BY o.created_at DESC`,
    [tableId, restaurantId]
  );

  const ordersWithItems = await Promise.all(
    orders.map(async (order) => {
      const items = await db.all<OrderItemRow>(
        `SELECT oi.*, mi.name as menu_item_name
         FROM order_items oi
         LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
         WHERE oi.order_id = ?`,
        [order.id]
      );
      return {
        ...order,
        items: items.map(item => ({
          ...item,
          modifier_selections: item.modifier_selections
            ? (() => { try { return JSON.parse(item.modifier_selections!); } catch { return []; } })()
            : []
        }))
      };
    })
  );

  res.json({
    success: true,
    data: {
      table,
      orders: ordersWithItems,
      pagination: {
        total: ordersWithItems.length,
        limit: 50,
        offset: 0,
        More: total.count > Number(offset) + orders.length
      }
    }
  });
}));

export default router;
