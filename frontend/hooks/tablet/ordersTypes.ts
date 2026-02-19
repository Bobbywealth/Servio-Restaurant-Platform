export type OrderItem = {
  id?: string;
  name?: string;
  quantity?: number;
  unit_price?: number;
  price?: number;
};

export type Order = {
  id: string;
  external_id?: string | null;
  channel?: string | null;
  status?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  order_type?: string | null;
  pickup_time?: string | null;
  special_instructions?: string | null;
  total_amount?: number | null;
  subtotal?: number | null;
  created_at?: string | null;
  items?: OrderItem[];
  prep_time?: string | null;
  prep_minutes?: number | null;
};

export type OrdersResponse = {
  success: boolean;
  data?: {
    orders?: Order[];
    pagination?: { total?: number; limit?: number; offset?: number; hasMore?: boolean };
  };
  error?: { message?: string };
};

export type PendingAction =
  | { id: string; orderId: string; type: 'status'; payload: { status: string }; queuedAt: number }
  | { id: string; orderId: string; type: 'prep-time'; payload: { prepMinutes: number }; queuedAt: number };
