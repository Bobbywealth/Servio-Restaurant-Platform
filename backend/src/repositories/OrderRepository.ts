import type { DbClient } from '../services/DatabaseService';
import type {
  IOrderRepository,
  Order,
  OrderFilters,
  OrderItem,
  OrderListResult,
  OrderStatsSummary,
  WaitingTimeRow
} from './interfaces/IOrderRepository';

function asNumber(value: any): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim().length > 0) return Number(value);
  return Number(value ?? 0);
}

function safeJsonParse<T>(value: any, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value !== 'string') return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export class OrderRepository implements IOrderRepository {
  constructor(private db: DbClient) {}

  async findById(id: string): Promise<Order | null> {
    const row = await this.db.get<any>('SELECT * FROM orders WHERE id = ?', [id]);
    if (!row) return null;

    const orderItems = await this.db.all<any>('SELECT * FROM order_items WHERE order_id = ? ORDER BY created_at ASC', [
      id
    ]);

    return this.mapOrder(row, orderItems);
  }

  async findByRestaurant(
    restaurantId: string,
    filters: OrderFilters,
    pagination: { limit: number; offset: number }
  ): Promise<OrderListResult> {
    const conditions: string[] = ['restaurant_id = ?'];
    const params: any[] = [restaurantId];

    if (filters.status) {
      conditions.push('status = ?');
      params.push(filters.status);
    }
    if (filters.channel) {
      conditions.push('channel = ?');
      params.push(filters.channel);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const rows = await this.db.all<any>(
      `SELECT * FROM orders ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, pagination.limit, pagination.offset]
    );

    const countRow = await this.db.get<any>(`SELECT COUNT(*) as total FROM orders ${whereClause}`, params);
    const total = asNumber(countRow?.total);

    const orderIds = rows.map((r: any) => r.id).filter(Boolean);
    const itemsByOrderId = await this.fetchItemsByOrderIds(orderIds);

    const orders = rows.map((r: any) => this.mapOrder(r, itemsByOrderId.get(r.id) ?? []));
    return { orders, total };
  }

  async updateStatus(orderId: string, status: string): Promise<void> {
    await this.db.run('UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, orderId]);
  }

  async getStatsSummary(restaurantId: string): Promise<OrderStatsSummary> {
    const completedTodayCondition = "status = 'completed' AND date(created_at) = date('now')";

    const [totalOrders, activeOrders, completedToday, avgOrderValue, ordersByStatus, ordersByChannel] =
      await Promise.all([
        this.db.get<any>('SELECT COUNT(*) as count FROM orders WHERE restaurant_id = ?', [restaurantId]),
        this.db.get<any>(
          "SELECT COUNT(*) as count FROM orders WHERE status IN ('received', 'preparing', 'ready') AND restaurant_id = ?",
          [restaurantId]
        ),
        this.db.get<any>(
          `SELECT COUNT(*) as count FROM orders WHERE ${completedTodayCondition} AND restaurant_id = ?`,
          [restaurantId]
        ),
        this.db.get<any>(
          `SELECT AVG(total_amount) as avg FROM orders WHERE ${completedTodayCondition} AND restaurant_id = ?`,
          [restaurantId]
        ),
        this.db.all<any>('SELECT status, COUNT(*) as count FROM orders WHERE restaurant_id = ? GROUP BY status', [
          restaurantId
        ]),
        this.db.all<any>('SELECT channel, COUNT(*) as count FROM orders WHERE restaurant_id = ? GROUP BY channel', [
          restaurantId
        ])
      ]);

    const ordersByStatusMap = (ordersByStatus || []).reduce((acc: Record<string, number>, row: any) => {
      acc[String(row.status)] = asNumber(row.count);
      return acc;
    }, {});

    const ordersByChannelMap = (ordersByChannel || []).reduce((acc: Record<string, number>, row: any) => {
      acc[String(row.channel)] = asNumber(row.count);
      return acc;
    }, {});

    return {
      totalOrders: asNumber(totalOrders?.count),
      activeOrders: asNumber(activeOrders?.count),
      completedToday: asNumber(completedToday?.count),
      avgOrderValue: parseFloat(Number(avgOrderValue?.avg ?? 0).toFixed(2)),
      ordersByStatus: ordersByStatusMap,
      ordersByChannel: ordersByChannelMap
    };
  }

  async getWaitingTimes(restaurantId: string): Promise<WaitingTimeRow[]> {
    if (this.db.dialect === 'postgres') {
      return await this.db.all<WaitingTimeRow>(
        `
          SELECT
            id,
            external_id,
            channel,
            status,
            customer_name,
            created_at,
            ROUND(EXTRACT(EPOCH FROM (NOW() - created_at)) / 60) as waiting_minutes
          FROM orders
          WHERE restaurant_id = ?
            AND status IN ('received', 'preparing', 'ready')
          ORDER BY waiting_minutes DESC
        `,
        [restaurantId]
      );
    }

    return await this.db.all<WaitingTimeRow>(
      `
        SELECT
          id,
          external_id,
          channel,
          status,
          customer_name,
          created_at,
          ROUND((julianday('now') - julianday(created_at)) * 1440) as waiting_minutes
        FROM orders
        WHERE restaurant_id = ?
          AND status IN ('received', 'preparing', 'ready')
        ORDER BY waiting_minutes DESC
      `,
      [restaurantId]
    );
  }

  private async fetchItemsByOrderIds(orderIds: string[]): Promise<Map<string, any[]>> {
    const map = new Map<string, any[]>();
    if (orderIds.length === 0) return map;

    const placeholders = orderIds.map(() => '?').join(', ');
    const rows = await this.db.all<any>(`SELECT * FROM order_items WHERE order_id IN (${placeholders})`, orderIds);

    for (const row of rows) {
      const orderId = row.order_id;
      if (!map.has(orderId)) map.set(orderId, []);
      map.get(orderId)!.push(row);
    }

    // keep stable ordering within an order
    for (const [orderId, items] of map.entries()) {
      items.sort((a, b) => String(a.created_at ?? '').localeCompare(String(b.created_at ?? '')));
      map.set(orderId, items);
    }

    return map;
  }

  private mapOrder(row: any, itemRows: any[]): Order {
    const orderItems: OrderItem[] = (itemRows || []).map((r: any) => {
      const quantity = asNumber(r.qty ?? r.quantity ?? 0);
      const unitPrice = asNumber(r.unit_price_snapshot ?? r.unit_price ?? 0);
      return {
        id: String(r.id),
        orderId: String(r.order_id),
        menuItemId: r.menu_item_id ?? null,
        name: r.name ?? null,
        quantity,
        unitPrice,
        notes: r.notes ?? null,
        modifiers: safeJsonParse(r.modifiers_json, {}),
        itemId: r.item_id ?? null,
        itemNameSnapshot: r.item_name_snapshot ?? null,
        qty: r.qty ?? null,
        unitPriceSnapshot: r.unit_price_snapshot ?? null,
        createdAt: r.created_at ?? null
      };
    });

    return {
      id: String(row.id),
      restaurantId: row.restaurant_id ?? null,
      customerId: row.customer_id ?? null,
      externalId: row.external_id ?? null,
      channel: row.channel ?? null,
      status: row.status ?? null,
      totalAmount: row.total_amount != null ? asNumber(row.total_amount) : null,
      paymentStatus: row.payment_status ?? null,
      customerName: row.customer_name ?? null,
      customerPhone: row.customer_phone ?? null,
      prepTimeMinutes: row.prep_time_minutes != null ? asNumber(row.prep_time_minutes) : null,
      acceptedAt: row.accepted_at ?? null,
      acceptedByUserId: row.accepted_by_user_id ?? null,
      source: row.source ?? null,
      callId: row.call_id ?? null,
      createdAt: row.created_at ?? null,
      updatedAt: row.updated_at ?? null,
      items: safeJsonParse(row.items, row.items ?? null),
      orderItems
    };
  }
}

