/**
 * Shared Type Definitions for Tablet Orders
 * 
 * This module provides unified type definitions for all tablet order components.
 * Import types from here instead of defining them locally in each component.
 */

// ============================================================================
// Core Types
// ============================================================================

export type OrderStatus = 'received' | 'preparing' | 'ready' | 'completed' | 'cancelled';

export type UrgencyLevel = 'normal' | 'warning' | 'critical';

export type OrderItem = {
  id?: string;
  name?: string;
  item_name_snapshot?: string;
  item_id?: string;
  quantity?: number;
  qty?: number;
  unit_price?: number;
  price?: number;
  modifiers?: Record<string, unknown> | string[];
  notes?: string | null;
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
  accepted_at?: string | null;
  tax?: number | null;
};

export type OrdersResponse = {
  success: boolean;
  data?: {
    orders?: Order[];
    pagination?: { total?: number; limit?: number; offset?: number; hasMore?: boolean };
  };
  error?: { message?: string };
};

// ============================================================================
// Filter & Sort Types
// ============================================================================

export type OrderFilter = {
  status: 'all' | OrderStatus;
  channel: string;
  orderType: string;
  sortBy: 'newest' | 'oldest' | 'prep-time';
  searchQuery: string;
};

// ============================================================================
// Action Queue Types
// ============================================================================

export type PendingAction =
  | {
      id: string;
      orderId: string;
      type: 'status';
      payload: { status: OrderStatus };
      queuedAt: number;
      idempotencyKey: string;
      retryCount: number;
      lastError: string | null;
      lastAttemptAt?: number;
      permanentFailure?: boolean;
    }
  | {
      id: string;
      orderId: string;
      type: 'prep-time';
      payload: { prepMinutes: number };
      queuedAt: number;
      idempotencyKey: string;
      retryCount: number;
      lastError: string | null;
      lastAttemptAt?: number;
      permanentFailure?: boolean;
    };

export type EnqueueAction = PendingAction extends infer Action
  ? Action extends PendingAction
    ? Omit<Action, 'idempotencyKey' | 'retryCount' | 'lastError'>
    : never
  : never;

// ============================================================================
// Time Formatting Types
// ============================================================================

export type TimeAgoResult = {
  text: string;
  elapsedMinutes: number | null;
};

export type PrepTimeResult = {
  text: string;
  isOverdue: boolean;
  percentRemaining: number;
  overdueMinutes: number | null;
} | null;

// ============================================================================
// Component Props Types
// ============================================================================

export interface KDSOrderCardProps {
  order: Order;
  now: number | null;
  busyId: string | null;
  onAccept: () => void;
  onDecline: () => void;
  onMarkReady: () => void;
  onMarkPickedUp: () => void;
  onPrint: () => void;
  formatMoney: (v: number | null | undefined) => string;
  onExpire?: (orderId: string) => void;
  onViewDetails?: () => void;
}

export interface LiveOrderCardProps {
  order: Order;
  now: number | null;
  isActionBusy?: boolean;
  onAccept?: (order: Order) => void;
  onReject?: (order: Order) => void;
  onMarkReady?: (order: Order) => void;
  onComplete?: (order: Order) => void;
  onPickedUp?: (order: Order) => void;
  onViewDetails?: (order: Order) => void;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface SingleOrderResponse {
  success: boolean;
  data?: Order;
  error?: { message?: string };
}
