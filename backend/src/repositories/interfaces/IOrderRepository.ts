export type OrderStatus = string;

export interface OrderItem {
  id: string;
  orderId: string;
  menuItemId?: string | null;
  name?: string | null;
  quantity: number;
  unitPrice: number;
  notes?: string | null;
  modifiers?: any;
  itemId?: string | null;
  itemNameSnapshot?: string | null;
  qty?: number | null;
  unitPriceSnapshot?: number | null;
  createdAt?: string | null;
}

export interface Order {
  id: string;
  restaurantId?: string | null;
  customerId?: string | null;
  externalId?: string | null;
  channel?: string | null;
  status?: OrderStatus | null;
  totalAmount?: number | null;
  paymentStatus?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  prepTimeMinutes?: number | null;
  acceptedAt?: string | null;
  acceptedByUserId?: string | null;
  source?: string | null;
  callId?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  items?: any; // may be JSON in some environments
  orderItems?: OrderItem[];
}

export interface OrderFilters {
  status?: string;
  channel?: string;
}

export interface OrderListResult {
  orders: Order[];
  total: number;
}

export interface OrderStatsSummary {
  totalOrders: number;
  activeOrders: number;
  completedToday: number;
  avgOrderValue: number;
  ordersByStatus: Record<string, number>;
  ordersByChannel: Record<string, number>;
}

export interface WaitingTimeRow {
  id: string;
  external_id?: string | null;
  channel?: string | null;
  status?: string | null;
  customer_name?: string | null;
  created_at?: string | null;
  waiting_minutes?: number | null;
}

export interface IOrderRepository {
  findById(id: string): Promise<Order | null>;
  findByRestaurant(
    restaurantId: string,
    filters: OrderFilters,
    pagination: { limit: number; offset: number }
  ): Promise<OrderListResult>;
  updateStatus(orderId: string, status: string): Promise<void>;
  getStatsSummary(restaurantId: string): Promise<OrderStatsSummary>;
  getWaitingTimes(restaurantId: string): Promise<WaitingTimeRow[]>;
}

