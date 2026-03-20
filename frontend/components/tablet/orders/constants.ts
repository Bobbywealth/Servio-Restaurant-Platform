/**
 * Shared Constants for Tablet Orders
 * 
 * This module provides unified constants for all tablet order components.
 * Import constants from here instead of defining them locally in each component.
 */

import type { OrderStatus, UrgencyLevel } from './types';
import type { PrepTimeWarningLevel } from './utils';

// ============================================================================
// Status Styles
// ============================================================================

export interface StatusStyleConfig {
  rail: string;
  badge: string;
  timer: string;
  accent?: string;
}

export const STATUS_STYLES: Record<OrderStatus, StatusStyleConfig> = {
  received: {
    rail: 'bg-amber-500',
    badge: 'border-amber-300 bg-amber-50 text-amber-700',
    timer: 'text-amber-600',
    accent: 'bg-amber-500',
  },
  preparing: {
    rail: 'bg-blue-500',
    badge: 'border-blue-300 bg-blue-50 text-blue-700',
    timer: 'text-blue-600',
    accent: 'bg-blue-500',
  },
  ready: {
    rail: 'bg-emerald-500',
    badge: 'border-emerald-300 bg-emerald-50 text-emerald-700',
    timer: 'text-emerald-600',
    accent: 'bg-emerald-500',
  },
  completed: {
    rail: 'bg-slate-400',
    badge: 'border-slate-300 bg-slate-100 text-slate-600',
    timer: 'text-slate-500',
    accent: 'bg-slate-400',
  },
  cancelled: {
    rail: 'bg-slate-400',
    badge: 'border-slate-300 bg-slate-100 text-slate-500',
    timer: 'text-slate-400',
    accent: 'bg-slate-400',
  },
};

// ============================================================================
// Urgency Thresholds
// ============================================================================

export const URGENCY_THRESHOLDS = {
  /** Minutes before order is considered warning level */
  warningMinutes: 10,
  /** Minutes before order is considered critical level */
  criticalMinutes: 20,
} as const;

// ============================================================================
// Prep Time Thresholds
// ============================================================================

export const PREP_TIME_THRESHOLDS = {
  /** Percentage remaining when prep time becomes warning */
  warningPercent: 50,
  /** Percentage remaining when prep time becomes critical */
  criticalPercent: 25,
  /** Default prep time in minutes when not specified */
  defaultMinutes: 15,
  /** Maximum prep time allowed in minutes */
  maxMinutes: 180,
} as const;

// ============================================================================
// Countdown Timer
// ============================================================================

export const COUNTDOWN_TIMER = {
  /** Default duration in seconds (3 minutes) */
  defaultDurationSeconds: 180,
  /** Seconds remaining when warning state begins */
  warningThresholdSeconds: 60,
  /** Seconds remaining when critical state begins */
  criticalThresholdSeconds: 30,
} as const;

// ============================================================================
// Order Queue
// ============================================================================

export const ORDER_QUEUE = {
  /** Maximum retry attempts for failed actions */
  maxRetryAttempts: 3,
  /** Interval for processing action queue (ms) */
  processIntervalMs: 15000,
  /** Interval for refreshing orders (ms) */
  refreshIntervalMs: 10000,
  /** Minimum interval between refreshes (ms) */
  minRefreshIntervalMs: 5000,
  /** Number of orders to fetch per page */
  pageSize: 50,
} as const;

// ============================================================================
// Stale Order Threshold
// ============================================================================

export const STALE_ORDER_THRESHOLD_MINUTES = Number(
  process.env.NEXT_PUBLIC_TABLET_STALE_ORDER_MINUTES ?? 120
);

// ============================================================================
// Idle Timeout
// ============================================================================

export const IDLE_TIMEOUT = {
  /** 8 hours in milliseconds (restaurant shift duration) */
  ms: 8 * 60 * 60 * 1000,
} as const;

// ============================================================================
// Local Storage Keys
// ============================================================================

export const STORAGE_KEYS = {
  actionQueue: 'servio_tablet_action_queue',
  orderCache: 'servio_cached_orders',
  autoPrintEnabled: 'servio_auto_print_enabled',
  paperWidth: 'servio_thermal_paper_width',
  printMode: 'servio_print_mode',
  fontSize: 'servio_font_size',
  lastPrintResult: 'servio_last_print_result',
  receiptHeaderText: 'servio_receipt_header_text',
  receiptFooterText: 'servio_receipt_footer_text',
} as const;

// ============================================================================
// Print Settings
// ============================================================================

export const PAPER_WIDTHS = ['58mm', '80mm'] as const;
export type PaperWidth = typeof PAPER_WIDTHS[number];

export const FONT_SIZES = ['small', 'medium', 'large', 'xlarge'] as const;
export type FontSize = typeof FONT_SIZES[number];

export const PRINT_MODES = ['bluetooth', 'system', 'bridge', 'rawbt'] as const;
export type PrintMode = typeof PRINT_MODES[number];

// ============================================================================
// Status Badge Configurations
// ============================================================================

export interface StatusBadgeConfig {
  label: string;
  className: string;
  icon?: 'clock' | 'check' | null;
}

export const STATUS_BADGE_CONFIG: Record<OrderStatus, StatusBadgeConfig> = {
  received: { label: 'New', className: 'bg-[var(--tablet-danger)] text-white' },
  preparing: { label: 'Preparing', className: 'bg-[var(--tablet-warning)] text-[var(--tablet-text)]', icon: 'clock' },
  ready: { label: 'Ready', className: 'bg-[var(--tablet-success)] text-white', icon: 'check' },
  completed: { label: 'Completed', className: 'bg-[var(--tablet-success)]/50 text-white' },
  cancelled: { label: 'Cancelled', className: 'bg-[var(--tablet-muted)] text-white' },
};

// ============================================================================
// Urgency Configurations
// ============================================================================

export interface UrgencyConfig {
  badgeClass: string;
  textClass: string;
}

export const URGENCY_CONFIG: Record<UrgencyLevel, UrgencyConfig> = {
  normal: {
    badgeClass: 'bg-[var(--tablet-surface-alt)] text-[var(--tablet-muted)]',
    textClass: 'text-[var(--tablet-muted)]',
  },
  warning: {
    badgeClass: 'bg-[color-mix(in_srgb,var(--tablet-warning)_18%,transparent)] text-[var(--tablet-warning)]',
    textClass: 'text-[var(--tablet-warning)]',
  },
  critical: {
    badgeClass: 'bg-[color-mix(in_srgb,var(--tablet-danger)_18%,transparent)] text-[var(--tablet-danger)]',
    textClass: 'text-[var(--tablet-danger)]',
  },
};

// ============================================================================
// Prep Time Color Classes
// ============================================================================

export const PREP_TIME_COLOR_CLASSES: Record<PrepTimeWarningLevel, string> = {
  critical: 'bg-[var(--tablet-danger)] text-[var(--tablet-text)]',
  warning: 'bg-[var(--tablet-warning)] text-[var(--tablet-text)]',
  normal: 'bg-[var(--tablet-success)] text-[var(--tablet-text)]',
};

// ============================================================================
// Order Type Labels
// ============================================================================

export const ORDER_TYPE_LABELS: Record<string, string> = {
  delivery: 'Delivery',
  pickup: 'Pickup',
  'dine-in': 'Dine-in',
  dinein: 'Dine-in',
};

// ============================================================================
// Quick Select Prep Times
// ============================================================================

export const QUICK_PREP_TIMES = [5, 10, 15, 20, 30, 45] as const;
