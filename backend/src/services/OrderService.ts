import { v4 as uuidv4 } from 'uuid';
import type { EventBus } from '../events/bus';
import type { DatabaseService } from './DatabaseService';
import type { IOrderRepository, OrderFilters, OrderStatsSummary, WaitingTimeRow, Order } from '../repositories/interfaces/IOrderRepository';
import { InvalidOrderStatusError, OrderNotFoundError, OrderValidationError } from '../errors/ServiceErrors';
import { logger } from '../utils/logger';
import type { CacheService } from './CacheService';
import { CacheKeyBuilder } from './CacheKeyBuilder';

export class OrderService {
  constructor(
    private orderRepository: IOrderRepository,
    private bus: EventBus,
    private databaseService: DatabaseService,
    private cache: CacheService
  ) {}

  async listOrders(
    restaurantId: string,
    filters: OrderFilters,
    pagination: { limit: number; offset: number }
  ): Promise<{ orders: Order[]; pagination: { total: number; limit: number; offset: number; hasMore: boolean } }> {
    const key = CacheKeyBuilder.ordersByRestaurantPaged(restaurantId, filters, pagination.limit, pagination.offset);

    return this.cache.getOrSet(key, 30, async () => {
      const { orders, total } = await this.orderRepository.findByRestaurant(restaurantId, filters, pagination);
      return {
        orders,
        pagination: {
          total,
          limit: pagination.limit,
          offset: pagination.offset,
          hasMore: total > pagination.offset + orders.length
        }
      };
    });
  }

  async getOrderById(orderId: string): Promise<Order> {
    const key = CacheKeyBuilder.order(orderId);
    const order = await this.cache.getOrSet<Order | null>(key, 300, () => this.orderRepository.findById(orderId));
    if (!order) throw new OrderNotFoundError();
    return order;
  }

  async updateOrderStatus(params: {
    restaurantId: string;
    userId: string;
    orderId: string;
    status: string;
  }): Promise<{ orderId: string; previousStatus: string; newStatus: string; updatedAt: string }> {
    const validStatuses = ['received', 'preparing', 'ready', 'completed', 'cancelled'];
    if (!params.status || !validStatuses.includes(params.status)) {
      throw new InvalidOrderStatusError(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    const existing = await this.getOrderById(params.orderId);
    const previousStatus = String(existing.status ?? '');

    await this.orderRepository.updateStatus(params.orderId, params.status);

    // Invalidate related caches efficiently
    await this.cache.invalidate(CacheKeyBuilder.orderPatterns(params.restaurantId).join('|'));

    await this.databaseService.logAudit(
      params.restaurantId,
      params.userId || 'system',
      'update_order_status',
      'order',
      params.orderId,
      { previousStatus, newStatus: params.status }
    );

    await this.bus.emit('order.status_changed', {
      restaurantId: params.restaurantId,
      type: 'order.status_changed',
      actor: { actorType: 'user', actorId: params.userId },
      payload: { orderId: params.orderId, previousStatus, newStatus: params.status },
      occurredAt: new Date().toISOString()
    });

    logger.info(`Order ${params.orderId} status updated from ${previousStatus} to ${params.status}`);

    return {
      orderId: params.orderId,
      previousStatus,
      newStatus: params.status,
      updatedAt: new Date().toISOString()
    };
  }

  async getStatsSummary(restaurantId: string): Promise<OrderStatsSummary> {
    const key = CacheKeyBuilder.orderStatsSummary(restaurantId);
    return this.cache.getOrSet(key, 30, () => this.orderRepository.getStatsSummary(restaurantId));
  }

  async getWaitingTimes(restaurantId: string): Promise<WaitingTimeRow[]> {
    const key = CacheKeyBuilder.orderWaitingTimes(restaurantId);
    return this.cache.getOrSet(key, 30, () => this.orderRepository.getWaitingTimes(restaurantId));
  }

  async createPublicOrder(params: {
    slug: string;
    items: Array<{
      id: string;
      name: string;
      quantity: number;
      price: number;
      modifiers?: any;
      notes?: string;
    }>;
    customerName?: string;
    customerPhone?: string;
    customerEmail?: string;
    paymentOption?: 'pay_now' | 'pay_on_arrival';
  }): Promise<{ orderId: string; restaurantId: string; totalAmount: number; status: string }> {
    const { slug, items } = params;
    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new OrderValidationError('Items are required');
    }

    const db = this.databaseService.getDatabase();
    const restaurant = await db.get<any>('SELECT id FROM restaurants WHERE slug = ?', [slug]);
    if (!restaurant) throw new OrderValidationError('Restaurant not found');

    const orderId = uuidv4();
    const restaurantId = String(restaurant.id);

    let totalAmount = 0;
    for (const item of items) {
      totalAmount += Number(item.price) * Number(item.quantity);
    }

    // Minimal v1: represent pay-on-arrival using payment_status.
    // (A future migration can add payment_method separately.)
    const paymentStatus = params.paymentOption === 'pay_on_arrival' ? 'pay_on_arrival' : 'unpaid';

    // Some environments may not have an 'items' column on orders. Try it first, then fall back.
    try {
      await db.run(
        `
          INSERT INTO orders (
            id, restaurant_id, channel, status, total_amount, payment_status,
            customer_name, customer_phone, source, items, created_at, updated_at
          ) VALUES (?, ?, 'website', 'received', ?, ?, ?, ?, 'website', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `,
        [orderId, restaurantId, totalAmount, paymentStatus, params.customerName || null, params.customerPhone || null, JSON.stringify(items)]
      );
    } catch (err: any) {
      const message = String(err?.message || err || '');
      if (!/items/i.test(message)) throw err;
      await db.run(
        `
          INSERT INTO orders (
            id, restaurant_id, channel, status, total_amount, payment_status,
            customer_name, customer_phone, source, created_at, updated_at
          ) VALUES (?, ?, 'website', 'received', ?, ?, ?, ?, 'website', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `,
        [orderId, restaurantId, totalAmount, paymentStatus, params.customerName || null, params.customerPhone || null]
      );
    }

    for (const item of items) {
      const qty = Number(item.quantity ?? 0);
      const unitPrice = Number(item.price ?? 0);
      const modifiersJson = item.modifiers != null ? JSON.stringify(item.modifiers) : '{}';
      const notes = item.notes ? String(item.notes) : null;

      // Prefer extended schema if present (voice ordering migration adds these fields)
      try {
        await db.run(
          `
            INSERT INTO order_items (
              id, order_id, menu_item_id, name, quantity, unit_price, notes,
              item_id, item_name_snapshot, qty, unit_price_snapshot, modifiers_json, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          `,
          [
            uuidv4(),
            orderId,
            item.id,
            item.name,
            qty,
            unitPrice,
            notes,
            item.id,
            item.name,
            qty,
            unitPrice,
            modifiersJson
          ]
        );
      } catch (err: any) {
        const message = String(err?.message || err || '');
        // Fall back to minimal schema
        if (!/(item_id|unit_price_snapshot|modifiers_json|created_at)/i.test(message)) throw err;
        await db.run(
          `
            INSERT INTO order_items (id, order_id, menu_item_id, name, quantity, unit_price, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `,
          [uuidv4(), orderId, item.id, item.name, qty, unitPrice, notes]
        );
      }
    }

    await this.bus.emit('order.created_web', {
      restaurantId,
      type: 'order.created_web',
      actor: { actorType: 'system' },
      payload: {
        orderId,
        customerName: params.customerName,
        totalAmount,
        channel: 'website'
      },
      occurredAt: new Date().toISOString()
    });

    await this.databaseService.logAudit(restaurantId, null, 'create_public_order', 'order', orderId, { totalAmount });

    // Invalidate order lists for this restaurant
    await this.cache.invalidate(CacheKeyBuilder.orderPatterns(restaurantId).join('|'));

    return { orderId, restaurantId, totalAmount, status: 'received' };
  }

  async createIntegrationOrder(params: {
    restaurantId: string;
    userId: string;
    externalId: string;
    channel: string;
    items: any[];
    customerName?: string;
    customerPhone?: string;
    totalAmount: number;
  }): Promise<{ orderId: string; status: string; createdAt: string }> {
    const { restaurantId, externalId, channel, items, customerName, customerPhone, totalAmount, userId } = params;
    if (!externalId || !channel || !items || !totalAmount) {
      throw new OrderValidationError('externalId, channel, items, and totalAmount are required');
    }

    const db = this.databaseService.getDatabase();
    const orderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Some environments may not have an 'items' column on orders. Try it first, then fall back.
    try {
      await db.run(
        `
          INSERT INTO orders (
            id, restaurant_id, external_id, channel, items, customer_name,
            customer_phone, total_amount, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [orderId, restaurantId, externalId, channel, JSON.stringify(items), customerName || null, customerPhone || null, totalAmount, 'received']
      );
    } catch (err: any) {
      const message = String(err?.message || err || '');
      if (!/items/i.test(message)) throw err;

      await db.run(
        `
          INSERT INTO orders (
            id, restaurant_id, external_id, channel, customer_name,
            customer_phone, total_amount, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [orderId, restaurantId, externalId, channel, customerName || null, customerPhone || null, totalAmount, 'received']
      );

      // Best-effort: persist items into order_items for visibility
      if (Array.isArray(items)) {
        for (const item of items) {
          const qty = Number(item.quantity ?? item.qty ?? 1);
          const unitPrice = Number(item.price ?? item.unitPrice ?? 0);
          const modifiersJson = item.modifiers != null ? JSON.stringify(item.modifiers) : '{}';
          const notes = item.notes != null ? String(item.notes) : null;
          await db.run(
            `
              INSERT INTO order_items (id, order_id, name, quantity, unit_price, notes, modifiers_json, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `,
            [uuidv4(), orderId, String(item.name ?? item.title ?? 'Item'), qty, unitPrice, notes, modifiersJson]
          );
        }
      }
    }

    await this.databaseService.logAudit(restaurantId, userId || 'system', 'create_order', 'order', orderId, {
      externalId,
      channel,
      totalAmount,
      itemCount: Array.isArray(items) ? items.length : 0
    });

    await this.bus.emit('order.created_web', {
      restaurantId,
      type: 'order.created_web',
      actor: { actorType: 'user', actorId: userId },
      payload: { orderId, customerName, totalAmount, channel },
      occurredAt: new Date().toISOString()
    });

    logger.info(`New order created: ${orderId} from ${channel}`);

    await this.cache.invalidate(CacheKeyBuilder.orderPatterns(restaurantId).join('|'));

    return { orderId, status: 'received', createdAt: new Date().toISOString() };
  }
}

