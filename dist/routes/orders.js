"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const DatabaseService_1 = require("../services/DatabaseService");
const errorHandler_1 = require("../middleware/errorHandler");
const logger_1 = require("../utils/logger");
const uuid_1 = require("uuid");
const bus_1 = require("../events/bus");
const router = (0, express_1.Router)();
const num = (v) => (typeof v === 'number' ? v : Number(v ?? 0));
/**
 * GET /api/orders
 * Get orders with optional filtering
 */
router.get('/', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { status, channel, limit = 50, offset = 0 } = req.query;
    const db = DatabaseService_1.DatabaseService.getInstance().getDatabase();
    const restaurantId = req.user?.restaurantId;
    let query = 'SELECT * FROM orders';
    const params = [restaurantId];
    const conditions = ['restaurant_id = ?'];
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
    let orders = await db.all(query, params);
    // If orders are stored in normalized table (order_items), attach them for API consumers that expect items JSON.
    orders = await attachOrderItems(db, orders);
    // Parse JSON fields
    const formattedOrders = orders.map((order) => ({
        ...order,
        items: JSON.parse(order.items || '[]')
    }));
    // Get total count for pagination
    let countQuery = 'SELECT COUNT(*) as total FROM orders';
    const countParams = [];
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
router.get('/:id', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const db = DatabaseService_1.DatabaseService.getInstance().getDatabase();
    let order = await db.get('SELECT * FROM orders WHERE id = ?', [id]);
    if (!order) {
        return res.status(404).json({
            success: false,
            error: { message: 'Order not found' }
        });
    }
    // Attach normalized items if needed
    const withItems = await attachOrderItems(db, [order]);
    order = withItems[0];
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
router.post('/:id/status', (0, errorHandler_1.asyncHandler)(async (req, res) => {
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
    const db = DatabaseService_1.DatabaseService.getInstance().getDatabase();
    // Check if order exists
    const order = await db.get('SELECT * FROM orders WHERE id = ?', [id]);
    if (!order) {
        return res.status(404).json({
            success: false,
            error: { message: 'Order not found' }
        });
    }
    // Update the order
    await db.run('UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, id]);
    // Log the action
    await DatabaseService_1.DatabaseService.getInstance().logAudit(req.user?.restaurantId, req.user?.id || 'system', 'update_order_status', 'order', id, { previousStatus: order.status, newStatus: status });
    await bus_1.eventBus.emit('order.status_changed', {
        restaurantId: req.user?.restaurantId,
        type: 'order.status_changed',
        actor: { actorType: 'user', actorId: req.user?.id },
        payload: { orderId: id, previousStatus: order.status, newStatus: status },
        occurredAt: new Date().toISOString()
    });
    logger_1.logger.info(`Order ${id} status updated from ${order.status} to ${status}`);
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
 * POST /api/orders/:id/kitchen/accept
 * Kitchen accepts an incoming website order and sets prep time.
 *
 * - Sets status to 'preparing'
 * - Stores prep_time_minutes, accepted_at, accepted_by_user_id
 */
router.post('/:id/kitchen/accept', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { prepTimeMinutes } = req.body ?? {};
    const prep = Number(prepTimeMinutes);
    if (!Number.isFinite(prep) || prep <= 0 || prep > 240) {
        throw new errorHandler_1.BadRequestError('prepTimeMinutes must be a number between 1 and 240');
    }
    const db = DatabaseService_1.DatabaseService.getInstance().getDatabase();
    const restaurantId = req.user?.restaurantId;
    const userId = req.user?.id;
    const order = await db.get('SELECT * FROM orders WHERE id = ? AND restaurant_id = ?', [id, restaurantId]);
    if (!order) {
        return res.status(404).json({ success: false, error: { message: 'Order not found' } });
    }
    const acceptedAt = new Date().toISOString();
    await db.run(`UPDATE orders SET
      status = 'preparing',
      prep_time_minutes = ?,
      accepted_at = ?,
      accepted_by_user_id = ?,
      updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND restaurant_id = ?`, [prep, acceptedAt, userId || null, id, restaurantId]);
    await DatabaseService_1.DatabaseService.getInstance().logAudit(restaurantId, userId || 'system', 'kitchen_accept_order', 'order', id, { prepTimeMinutes: prep, acceptedAt });
    await bus_1.eventBus.emit('order.kitchen_accepted', {
        restaurantId: restaurantId,
        type: 'order.kitchen_accepted',
        actor: { actorType: 'user', actorId: userId },
        payload: { orderId: id, prepTimeMinutes: prep, acceptedAt },
        occurredAt: acceptedAt
    });
    res.json({
        success: true,
        data: {
            orderId: id,
            status: 'preparing',
            prepTimeMinutes: prep,
            acceptedAt
        }
    });
}));
/**
 * POST /api/orders/:id/kitchen/decline
 * Kitchen declines/cancels an incoming website order.
 */
router.post('/:id/kitchen/decline', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const db = DatabaseService_1.DatabaseService.getInstance().getDatabase();
    const restaurantId = req.user?.restaurantId;
    const userId = req.user?.id;
    const order = await db.get('SELECT * FROM orders WHERE id = ? AND restaurant_id = ?', [id, restaurantId]);
    if (!order) {
        return res.status(404).json({ success: false, error: { message: 'Order not found' } });
    }
    await db.run(`UPDATE orders SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND restaurant_id = ?`, [id, restaurantId]);
    await DatabaseService_1.DatabaseService.getInstance().logAudit(restaurantId, userId || 'system', 'kitchen_decline_order', 'order', id, { previousStatus: order.status });
    await bus_1.eventBus.emit('order.kitchen_declined', {
        restaurantId: restaurantId,
        type: 'order.kitchen_declined',
        actor: { actorType: 'user', actorId: userId },
        payload: { orderId: id, previousStatus: order.status },
        occurredAt: new Date().toISOString()
    });
    res.json({ success: true, data: { orderId: id, status: 'cancelled' } });
}));
/**
 * GET /api/orders/stats/summary
 * Get order statistics summary
 */
router.get('/stats/summary', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const db = DatabaseService_1.DatabaseService.getInstance().getDatabase();
    const dialect = DatabaseService_1.DatabaseService.getInstance().getDialect();
    const restaurantId = req.user?.restaurantId;
    const completedTodayCondition = dialect === 'postgres'
        ? "status = 'completed' AND created_at::date = CURRENT_DATE"
        : 'status = \'completed\' AND DATE(created_at) = DATE(\'now\')';
    const [totalOrders, activeOrders, completedToday, completedTodaySales, avgOrderValue, ordersByStatus, ordersByChannel] = await Promise.all([
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
        ordersByStatus: ordersByStatus.reduce((acc, row) => {
            acc[row.status] = num(row.count);
            return acc;
        }, {}),
        ordersByChannel: ordersByChannel.reduce((acc, row) => {
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
router.post('/public/:slug', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { slug } = req.params;
    const { items, customerName, customerPhone, customerEmail } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ success: false, error: { message: 'Items are required' } });
    }
    const db = DatabaseService_1.DatabaseService.getInstance().getDatabase();
    const restaurant = await db.get('SELECT id FROM restaurants WHERE slug = ?', [slug]);
    if (!restaurant)
        throw new errorHandler_1.BadRequestError('Restaurant not found');
    const orderId = (0, uuid_1.v4)();
    const restaurantId = restaurant.id;
    // Calculate total and validate items (simplified for v1 fast build)
    let totalAmount = 0;
    for (const item of items) {
        totalAmount += (item.price * item.quantity);
    }
    const safeName = typeof customerName === 'string' && customerName.trim().length > 0 ? customerName.trim() : 'Guest';
    const safePhone = typeof customerPhone === 'string' && customerPhone.trim().length > 0 ? customerPhone.trim() : null;
    await db.run(`
      INSERT INTO orders (
        id,
        restaurant_id,
        channel,
        status,
        total_amount,
        payment_status,
        customer_name,
        customer_phone,
        created_at,
        updated_at
      ) VALUES (?, ?, 'website', 'NEW', ?, 'unpaid', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [orderId, restaurantId, totalAmount, safeName, safePhone]);
    // Create order items
    for (const item of items) {
        await db.run(`
      INSERT INTO order_items (id, order_id, menu_item_id, name, quantity, unit_price)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [(0, uuid_1.v4)(), orderId, item.id, item.name, item.quantity, item.price]);
    }
    // Notify dashboard via Socket.IO
    const io = req.app.get('socketio');
    if (io) {
        io.to(`restaurant-${restaurantId}`).emit('new-order', { orderId, totalAmount });
    }
    await bus_1.eventBus.emit('order.created_web', {
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
    await DatabaseService_1.DatabaseService.getInstance().logAudit(restaurantId, null, 'create_public_order', 'order', orderId, { totalAmount });
    res.status(201).json({
        success: true,
        data: { orderId, status: 'NEW' }
    });
}));
async function attachOrderItems(db, orders) {
    if (!orders || orders.length === 0)
        return orders;
    const ids = orders.map((o) => o.id).filter(Boolean);
    if (ids.length === 0)
        return orders;
    const placeholders = ids.map(() => '?').join(', ');
    const rows = await db.all(`
      SELECT
        order_id,
        COALESCE(name, item_name_snapshot) as item_name,
        COALESCE(quantity, qty) as item_qty,
        COALESCE(unit_price, unit_price_snapshot) as item_unit_price
      FROM order_items
      WHERE order_id IN (${placeholders})
    `, ids);
    const byOrderId = new Map();
    for (const r of rows) {
        const list = byOrderId.get(r.order_id) || [];
        list.push({
            name: r.item_name,
            quantity: r.item_qty,
            unit_price: r.item_unit_price
        });
        byOrderId.set(r.order_id, list);
    }
    return orders.map((o) => {
        const hasJsonItems = typeof o.items === 'string' && o.items.trim().length > 0;
        if (hasJsonItems)
            return o;
        return { ...o, items: JSON.stringify(byOrderId.get(o.id) || []) };
    });
}
router.get('/waiting-times', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const db = DatabaseService_1.DatabaseService.getInstance().getDatabase();
    const dialect = DatabaseService_1.DatabaseService.getInstance().getDialect();
    const orders = dialect === 'postgres'
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
router.post('/', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { externalId, channel, items, customerName, customerPhone, totalAmount, userId } = req.body;
    if (!externalId || !channel || !items || !totalAmount) {
        return res.status(400).json({
            success: false,
            error: { message: 'externalId, channel, items, and totalAmount are required' }
        });
    }
    const db = DatabaseService_1.DatabaseService.getInstance().getDatabase();
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
    await DatabaseService_1.DatabaseService.getInstance().logAudit(req.user?.restaurantId, req.user?.id || 'system', 'create_order', 'order', orderId, { externalId, channel, totalAmount, itemCount: items.length });
    await bus_1.eventBus.emit('order.created_web', {
        restaurantId: req.user?.restaurantId,
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
    logger_1.logger.info(`New order created: ${orderId} from ${channel}`);
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
router.get('/history/stats', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { dateFrom, dateTo } = req.query;
    const db = DatabaseService_1.DatabaseService.getInstance().getDatabase();
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
router.get('/history', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { dateFrom, dateTo, status, channel, limit = 20, offset = 0 } = req.query;
    const db = DatabaseService_1.DatabaseService.getInstance().getDatabase();
    const restaurantId = req.user?.restaurantId;
    const where = ['restaurant_id = ?'];
    const params = [restaurantId];
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
    const formattedOrders = orders.map((order) => ({
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
exports.default = router;
//# sourceMappingURL=orders.js.map