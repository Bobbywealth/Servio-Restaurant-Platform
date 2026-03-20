/**
 * Shared Utility Functions for Tablet Orders
 * 
 * This module provides unified utility functions for all tablet order components.
 * Import functions from here instead of defining them locally in each component.
 */

import type { 
  Order, 
  OrderItem, 
  OrderStatus, 
  UrgencyLevel, 
  TimeAgoResult,
  PrepTimeResult 
} from './types';

// ============================================================================
// Status Utilities
// ============================================================================

/**
 * Normalizes order status strings to our canonical format
 */
export function normalizeStatus(s: string | null | undefined): OrderStatus {
  const v = (s || '').trim();
  if (!v) return 'received';
  const lower = v.toLowerCase();
  if (lower === 'new') return 'received';
  if (lower === 'preparing' || lower === 'in-progress') return 'preparing';
  if (lower === 'ready' || lower === 'completed') return 'ready';
  if (lower === 'picked-up' || lower === 'picked up') return 'ready';
  if (lower === 'cancelled') return 'cancelled';
  if (lower === 'completed') return 'completed';
  return lower as OrderStatus;
}

/**
 * Gets a human-readable label for order status
 */
export function getStatusLabel(status: string): string {
  switch (status) {
    case 'received':
      return 'Needs action';
    case 'preparing':
      return 'In progress';
    case 'ready':
      return 'Ready';
    case 'completed':
      return 'Completed';
    case 'cancelled':
      return 'Cancelled';
    default:
      return status;
  }
}

// ============================================================================
// Money Formatting
// ============================================================================

/**
 * Formats a number as USD currency
 */
export function formatMoney(v: number | null | undefined): string {
  const n = typeof v === 'number' ? v : 0;
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(n);
  } catch {
    return `$${n.toFixed(2)}`;
  }
}

// ============================================================================
// Time Formatting
// ============================================================================

/**
 * Formats a timestamp as relative time (e.g., "5m", "1h 30m")
 */
export function formatTimeAgo(iso: string | null | undefined, now: number | null): TimeAgoResult {
  if (now === null || !iso) return { text: '—', elapsedMinutes: null };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { text: '—', elapsedMinutes: null };
  const diffMs = now - d.getTime();
  const mins = Math.max(0, Math.floor(diffMs / 60000));

  if (mins < 1) {
    return { text: 'Just now', elapsedMinutes: mins };
  }

  if (mins < 60) {
    return { text: `${mins}m`, elapsedMinutes: mins };
  }

  const hours = Math.floor(mins / 60);
  const remainingMinutes = mins % 60;
  return { text: `${hours}h ${remainingMinutes}m`, elapsedMinutes: mins };
}

/**
 * Formats a timestamp as time only (e.g., "2:30 PM")
 */
export function formatPickupTime(pickupTime: string | null | undefined): string {
  if (!pickupTime) return '';
  const date = new Date(pickupTime);
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

/**
 * Formats prep time remaining with overdue detection
 */
export function formatPrepTimeRemaining(
  prepMinutes: number | null | undefined,
  createdAt: string | null | undefined,
  now: number | null
): PrepTimeResult {
  if (!prepMinutes || !createdAt || now === null) return null;

  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return null;

  const totalMs = prepMinutes * 60 * 1000;
  const elapsedMs = now - created;
  const remainingMs = totalMs - elapsedMs;
  const percentRemaining = Math.max(0, Math.min(100, (remainingMs / totalMs) * 100));

  if (remainingMs <= 0) {
    const overdueMinutes = Math.ceil(Math.abs(remainingMs) / 60000);
    return {
      text: overdueMinutes > 0 ? `Overdue by ${overdueMinutes} min` : 'Overdue',
      isOverdue: true,
      percentRemaining: 0,
      overdueMinutes
    };
  }

  const minsRemaining = Math.ceil(remainingMs / 60000);
  return {
    text: `${minsRemaining}m`,
    isOverdue: false,
    percentRemaining,
    overdueMinutes: null
  };
}

/**
 * Formats order age for display
 */
export function getOrderAge(createdAt: string | null | undefined, now: number | null): string {
  if (!createdAt || !now) return '';
  const created = new Date(createdAt).getTime();
  const diffMs = now - created;
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ${diffMins % 60}m`;
  return `${Math.floor(diffHours / 24)}d ${diffHours % 24}h`;
}

// ============================================================================
// Urgency Utilities
// ============================================================================

/**
 * Determines urgency level based on elapsed minutes
 */
export function getOrderUrgencyLevel(elapsedMinutes: number | null): UrgencyLevel {
  if (elapsedMinutes === null || elapsedMinutes < 10) return 'normal';
  if (elapsedMinutes <= 20) return 'warning';
  return 'critical';
}

// ============================================================================
// Channel Utilities
// ============================================================================

/**
 * Gets an emoji icon for order channel/source
 */
export function getChannelIcon(channel: string | null | undefined): string {
  const c = (channel || '').toLowerCase();
  if (c.includes('doordash')) return '🚗';
  if (c.includes('ubereats') || c.includes('uber')) return '🛵';
  if (c.includes('grubhub')) return '🍔';
  if (c.includes('toast')) return '🍞';
  if (c.includes('pos') || c === 'in-store') return '🏪';
  if (c.includes('online') || c.includes('web')) return '💻';
  if (c.includes('phone') || c.includes('call')) return '📞';
  if (c.includes('vapi') || c.includes('voice')) return '🎙️';
  return '📋';
}

/**
 * Gets human-readable order type label
 */
export function getOrderTypeLabel(orderType: string | null | undefined, channel?: string | null): string {
  if (orderType === 'delivery') return 'Delivery';
  if (orderType === 'pickup') return 'Pickup';
  if (orderType === 'dine-in') return 'Dine-in';
  return channel || 'Online';
}

// ============================================================================
// Item Utilities
// ============================================================================

/**
 * Normalizes order items from various API formats
 */
export function normalizeOrderItems(items: unknown): OrderItem[] {
  if (!Array.isArray(items)) return [];

  return items.map((item: unknown): OrderItem => {
    const itemObj = item as Record<string, unknown>;
    const parsedQuantity = Number(itemObj?.quantity ?? itemObj?.qty ?? 1);
    const quantity = Number.isFinite(parsedQuantity) && parsedQuantity > 0 ? parsedQuantity : 1;

    let modifiers: string[] | Record<string, unknown> | undefined = itemObj?.modifiers as string[] | Record<string, unknown> | undefined;
    if ((!modifiers || typeof modifiers !== 'object') && typeof itemObj?.notes === 'string') {
      try {
        const parsedNotes = JSON.parse(itemObj.notes as string);
        if (parsedNotes?.modifiers) {
          modifiers = parsedNotes.modifiers as string[] | Record<string, unknown>;
        }
      } catch {
        // Notes can be plain text; ignore parse errors.
      }
    }

    return {
      name: (itemObj?.name || itemObj?.item_name_snapshot || itemObj?.item_id) as string || 'Item',
      quantity,
      modifiers
    };
  });
}

/**
 * Gets total item count from an order
 */
export function getTotalItemCount(items: OrderItem[] | undefined): number {
  if (!items) return 0;
  return items.reduce((sum, item) => sum + (item.quantity || item.qty || 1), 0);
}

// ============================================================================
// Search Utilities
// ============================================================================

/**
 * Checks if an order matches a search query
 */
export function matchesSearchQuery(order: Order, query: string): boolean {
  if (!query.trim()) return true;
  const searchTerms = query.toLowerCase().split(' ').filter(Boolean);

  const searchableText = [
    order.customer_name || '',
    order.customer_phone || '',
    order.external_id || order.id || '',
    order.channel || '',
    order.order_type || '',
    (order.items || []).map(i => i.name || '').join(' ')
  ].join(' ').toLowerCase();

  return searchTerms.every(term => searchableText.includes(term));
}

// ============================================================================
// ID Utilities
// ============================================================================

/**
 * Creates a short ID for display (first 4 + last 4 characters)
 */
export function shortId(id: string): string {
  if (!id) return '';
  return id.length <= 8 ? id : `${id.slice(0, 4)}…${id.slice(-4)}`;
}

// ============================================================================
// Order Filtering
// ============================================================================

/**
 * Checks if an order should be archived based on status and age
 */
export function isArchivedOrder(order: Order, now: number | null, staleThresholdMinutes: number = 120): boolean {
  // Always archive orders that are completed or cancelled
  if (order.status === 'completed' || order.status === 'cancelled') {
    return true;
  }
  
  // Also archive stale orders based on time threshold
  if (!Number.isFinite(staleThresholdMinutes) || staleThresholdMinutes <= 0) return false;
  const { elapsedMinutes } = formatTimeAgo(order.created_at, now);
  return typeof elapsedMinutes === 'number' && elapsedMinutes >= staleThresholdMinutes;
}

/**
 * Filters orders by active status (not completed/cancelled)
 */
export function filterActiveOrders(orders: Order[]): Order[] {
  const activeStatuses = new Set(['received', 'preparing', 'ready']);
  const seen = new Set<string>();
  return orders.filter((o) => {
    if (seen.has(o.id)) return false;
    seen.add(o.id);
    return activeStatuses.has(normalizeStatus(o.status));
  });
}

// ============================================================================
// Prep Time Warning Levels
// ============================================================================

export type PrepTimeWarningLevel = 'normal' | 'warning' | 'critical';

/**
 * Gets warning level based on prep time remaining percentage
 */
export function getPrepTimeWarningLevel(percentRemaining: number): PrepTimeWarningLevel {
  if (percentRemaining <= 25) return 'critical';
  if (percentRemaining <= 50) return 'warning';
  return 'normal';
}
