/**
 * Tablet Orders Shared Module
 * 
 * This is the main entry point for all tablet order shared utilities.
 * Import types, utilities, and constants from this module.
 * 
 * @example
 * // Import types
 * import { type Order, type OrderItem, type OrderStatus } from '@/components/tablet/orders';
 * 
 * // Import utilities
 * import { normalizeStatus, formatMoney, formatTimeAgo } from '@/components/tablet/orders';
 * 
 * // Import constants
 * import { STATUS_STYLES, ORDER_QUEUE } from '@/components/tablet/orders';
 */

// Types
export type {
  // Core types
  Order,
  OrderItem,
  OrderStatus,
  UrgencyLevel,
  
  // Response types
  OrdersResponse,
  SingleOrderResponse,
  
  // Filter & sort types
  OrderFilter,
  
  // Action queue types
  PendingAction,
  EnqueueAction,
  
  // Time formatting types
  TimeAgoResult,
  PrepTimeResult,
  
  // Component props types
  KDSOrderCardProps,
  LiveOrderCardProps,
} from './types';

// Utilities
export {
  // Status utilities
  normalizeStatus,
  getStatusLabel,
  
  // Money formatting
  formatMoney,
  
  // Time formatting
  formatTimeAgo,
  formatPickupTime,
  formatPrepTimeRemaining,
  getOrderAge,
  
  // Urgency utilities
  getOrderUrgencyLevel,
  
  // Channel utilities
  getChannelIcon,
  getOrderTypeLabel,
  
  // Item utilities
  normalizeOrderItems,
  getTotalItemCount,
  getModifierLines,
  
  // Search utilities
  matchesSearchQuery,
  
  // ID utilities
  shortId,
  
  // Order filtering
  isArchivedOrder,
  filterActiveOrders,
  
  // Prep time utilities
  getPrepTimeWarningLevel,
  type PrepTimeWarningLevel,
} from './utils';

// Constants
export {
  // Status styles
  STATUS_STYLES,
  type StatusStyleConfig,
  
  // Urgency thresholds
  URGENCY_THRESHOLDS,
  
  // Prep time thresholds
  PREP_TIME_THRESHOLDS,
  
  // Countdown timer constants
  COUNTDOWN_TIMER,
  
  // Order queue constants
  ORDER_QUEUE,
  
  // Stale order threshold
  STALE_ORDER_THRESHOLD_MINUTES,
  
  // Idle timeout
  IDLE_TIMEOUT,
  
  // Storage keys
  STORAGE_KEYS,
  
  // Print settings
  PAPER_WIDTHS,
  type PaperWidth,
  FONT_SIZES,
  type FontSize,
  PRINT_MODES,
  type PrintMode,
  
  // Status badge configurations
  STATUS_BADGE_CONFIG,
  type StatusBadgeConfig,
  
  // Urgency configurations
  URGENCY_CONFIG,
  type UrgencyConfig,
  
  // Prep time color classes
  PREP_TIME_COLOR_CLASSES,
  
  // Order type labels
  ORDER_TYPE_LABELS,
  
  // Quick select prep times
  QUICK_PREP_TIMES,
} from './constants';

// Re-export components for convenience
export { CountdownTimer, useCountdownTimer } from './CountdownTimer';
export { LiveOrderCard } from './LiveOrderCard';
export { OrdersHeader } from './OrdersHeader';
export { OrderDetailsModal } from './OrderDetailsModal';
export { OrderFiltersBar } from './OrderFiltersBar';
