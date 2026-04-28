import clsx from 'clsx';
import { AlertTriangle, Check, Clock, Package, MapPin, Phone, Timer } from 'lucide-react';
import { CountdownTimer } from './CountdownTimer';
import type { Order, OrderItem, OrderStatus, UrgencyLevel } from './types';
import {
  formatMoney,
  formatTimeAgo,
  getOrderUrgencyLevel,
  normalizeStatus,
  getChannelIcon,
  getModifierLines,
  STATUS_BADGE_CONFIG,
  URGENCY_CONFIG,
} from './index';

// Status badge component
function StatusBadge({ status }: { status: OrderStatus }) {
  const config = STATUS_BADGE_CONFIG[status] || STATUS_BADGE_CONFIG.received;

  return (
    <span className={clsx(
      'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold',
      config.className
    )}>
      {config.icon === 'clock' && <Clock className="h-3 w-3 mr-1" />}
      {config.icon === 'check' && <Check className="h-3 w-3 mr-1" />}
      {config.label}
    </span>
  );
}

// Time pill component for elapsed time (used for non-received orders)
function TimePill({ 
  elapsedMinutes, 
  text 
}: { 
  elapsedMinutes: number | null; 
  text: string 
}) {
  const urgencyLevel = getOrderUrgencyLevel(elapsedMinutes);
  const config = URGENCY_CONFIG[urgencyLevel];

  return (
    <span className={clsx(
      'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold tabular-nums',
      config.badgeClass
    )}>
      {urgencyLevel === 'warning' && <Clock className="h-3 w-3" />}
      {urgencyLevel === 'critical' && <AlertTriangle className="h-3 w-3" />}
      {text}
      {urgencyLevel === 'critical' && ' late'}
    </span>
  );
}

// Prep time display component for accepted orders
function PrepTimeDisplay({
  prepMinutes,
  prepTime,
  orderType
}: {
  prepMinutes: number | null | undefined;
  prepTime: string | null | undefined;
  orderType: string | null | undefined;
}) {
  const displayText = prepTime || (prepMinutes ? `${prepMinutes} min` : null);
  
  if (!displayText) {
    return null;
  }

  const isDelivery = orderType?.toLowerCase().includes('delivery');

  return (
    <span className={clsx(
      'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold',
      'bg-[var(--tablet-success)]/15 text-[var(--tablet-success)]'
    )}>
      <Timer className="h-3 w-3" />
      <span>Ready {displayText}</span>
    </span>
  );
}

// Primary action button
function PrimaryActionButton({ 
  children, 
  onClick, 
  variant = 'primary',
  disabled = false,
  className = ''
}: { 
  children: React.ReactNode; 
  onClick: (e: React.MouseEvent) => void;
  variant?: 'primary' | 'success' | 'danger';
  disabled?: boolean;
  className?: string;
}) {
  const variantClasses = {
    primary: 'bg-[var(--tablet-accent)] text-[var(--tablet-accent-contrast)] hover:brightness-110',
    success: 'bg-[var(--tablet-success-action)] text-[var(--tablet-success-action-contrast)] hover:brightness-110',
    danger: 'border border-[var(--tablet-danger)] text-[var(--tablet-danger)] hover:bg-[var(--tablet-danger)]/10',
  };

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={clsx(
        'flex-1 min-h-[44px] rounded-lg px-3 py-2 text-sm font-semibold transition active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation',
        variantClasses[variant],
        className
      )}
    >
      {children}
    </button>
  );
}

// Secondary action button
function SecondaryActionButton({ 
  children, 
  onClick,
  className = ''
}: { 
  children: React.ReactNode; 
  onClick: (e: React.MouseEvent) => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'flex-1 min-h-[44px] rounded-lg px-3 py-2 text-sm font-semibold border border-[var(--tablet-border)] bg-[var(--tablet-surface)] text-[var(--tablet-text)] transition active:bg-[var(--tablet-surface-alt)] touch-manipulation',
        className
      )}
    >
      {children}
    </button>
  );
}

// Main component
type Props = {
  order: Order;
  now: number | null;
  isActionBusy?: boolean;
  onAccept?: (order: Order) => void;
  onReject?: (order: Order) => void;
  onMarkReady?: (order: Order) => void;
  onComplete?: (order: Order) => void;
  onPickedUp?: (order: Order) => void;
  onViewDetails?: (order: Order) => void;
};

export function LiveOrderCard({
  order,
  now,
  isActionBusy = false,
  onAccept,
  onReject,
  onMarkReady,
  onComplete,
  onPickedUp,
  onViewDetails,
}: Props) {
  const status = normalizeStatus(order.status);
  const timeAgo = formatTimeAgo(order.created_at, now);
  const urgencyLevel = getOrderUrgencyLevel(timeAgo.elapsedMinutes);
  const itemCount = (order.items || []).reduce((sum, it) => sum + (it.quantity || it.qty || 1), 0);

  // Get first 2 items for preview
  const itemsPreview = (order.items || []).slice(0, 2);
  const remainingItemsCount = Math.max(0, (order.items?.length || 0) - 2);

  // Handle card click
  const handleCardClick = () => {
    onViewDetails?.(order);
  };

  // Status-based border accent
  const borderAccentClass = {
    received: 'border-l-4 border-l-[var(--tablet-danger)]',
    preparing: 'border-l-4 border-l-[var(--tablet-warning)]',
    ready: 'border-l-4 border-l-[var(--tablet-success)]',
    completed: 'border-l-4 border-l-[var(--tablet-success)]/50',
    cancelled: 'border-l-4 border-l-[var(--tablet-muted)]',
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleCardClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleCardClick();
        }
      }}
      className={clsx(
        'w-full min-w-[280px] max-w-[360px] rounded-xl border border-[var(--tablet-border)] bg-[var(--tablet-card)] text-left transition',
        'hover:brightness-105 hover:shadow-md touch-manipulation',
        borderAccentClass[status],
        isActionBusy && 'opacity-75'
      )}
    >
      {/* Card Header: Status badge + Timer/Time display */}
      <div className="flex items-center justify-between px-3 pt-2.5 pb-1.5">
        <StatusBadge status={status} />
        {status === 'received' ? (
          <CountdownTimer
            orderReceivedAt={order.created_at}
            durationSeconds={180} // 3 minutes
            visible={true}
            orderType={order.order_type}
            onExpire={() => {
              // Don't auto-reject - keep the order visible so staff can still accept it if needed
              console.log(`Order ${order.id} timer expired - showing as missed`);
            }}
          />
        ) : (
          <PrepTimeDisplay
            prepMinutes={order.prep_minutes}
            prepTime={order.prep_time}
            orderType={order.order_type}
          />
        )}
      </div>

      {/* Card Body */}
      <div className="px-3 pb-1.5">
        {/* Main info: Customer name + Amount */}
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="text-lg font-bold text-[var(--tablet-text)] truncate min-w-0 flex-1">
            {order.customer_name || 'Guest'}
          </div>
          <div className="text-xl font-bold text-[var(--tablet-text)] tabular-nums shrink-0">
            {formatMoney(order.total_amount)}
          </div>
        </div>

        {/* Customer phone + Order time (shown for new orders) */}
        {status === 'received' && (order.customer_phone || order.created_at) && (
          <div className="flex items-center gap-3 text-xs text-[var(--tablet-muted)] mb-2">
            {order.customer_phone && (
              <span className="flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {order.customer_phone}
              </span>
            )}
            {order.created_at && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        )}

        {/* Metadata: Source + Fulfillment + Item count */}
        <div className="flex items-center gap-3 text-xs text-[var(--tablet-muted)] mb-2">
          <span className="flex items-center gap-1">
            {getChannelIcon(order.channel)} 
            <span className="truncate max-w-[80px]">{order.channel || 'Unknown'}</span>
          </span>
          {order.order_type && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {order.order_type}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Package className="h-3 w-3" />
            {itemCount} {itemCount === 1 ? 'item' : 'items'}
          </span>
        </div>

        {/* Items preview with modifiers */}
        <div className="text-sm text-[var(--tablet-text)]">
          {itemsPreview.map((item, idx) => {
            const qty = item.quantity || item.qty || 1;
            let modifiersText = '';
            if (item.modifiers) {
              const lines = getModifierLines(item.modifiers).slice(0, 2);
              if (lines.length > 0) modifiersText = ` • ${lines.join(', ')}`;
            }
            return (
              <div key={idx} className="truncate">
                <span className="font-semibold text-[var(--tablet-accent)]">{qty}x</span>
                {' '}{item.name || 'Item'}
                {modifiersText && (
                  <span className="text-xs text-[var(--tablet-muted)]">{modifiersText}</span>
                )}
              </div>
            );
          })}
          {remainingItemsCount > 0 && (
            <div className="text-xs text-[var(--tablet-muted)]">
              +{remainingItemsCount} more
            </div>
          )}
        </div>

        {/* Special instructions indicator */}
        {order.special_instructions && (
          <div className="mt-2 text-xs text-[var(--tablet-warning)] font-medium flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            Has special instructions
          </div>
        )}
      </div>

      {/* Card Footer: Actions */}
      <div className="px-3 pb-2.5 pt-1.5 border-t border-[var(--tablet-border)]">
        {status === 'received' && (
          <div className="flex gap-2">
            <PrimaryActionButton 
              onClick={(e) => { e.stopPropagation(); onAccept?.(order); }}
              disabled={isActionBusy}
            >
              Accept
            </PrimaryActionButton>
            <SecondaryActionButton 
              onClick={(e) => { e.stopPropagation(); onReject?.(order); }}
            >
              Reject
            </SecondaryActionButton>
          </div>
        )}

        {status === 'preparing' && (
          <div className="flex gap-2">
            <PrimaryActionButton 
              onClick={(e) => { e.stopPropagation(); onMarkReady?.(order); }}
              variant="success"
              disabled={isActionBusy}
            >
              Mark Ready
            </PrimaryActionButton>
            <SecondaryActionButton 
              onClick={(e) => { e.stopPropagation(); onViewDetails?.(order); }}
            >
              Details
            </SecondaryActionButton>
          </div>
        )}

        {status === 'ready' && (
          <div className="flex gap-2">
            <PrimaryActionButton 
              onClick={(e) => { e.stopPropagation(); onPickedUp?.(order); }}
              variant="success"
              disabled={isActionBusy}
            >
              Picked Up
            </PrimaryActionButton>
            <SecondaryActionButton 
              onClick={(e) => { e.stopPropagation(); onComplete?.(order); }}
            >
              Complete
            </SecondaryActionButton>
          </div>
        )}

        {(status === 'completed' || status === 'cancelled') && (
          <div className="text-center text-sm text-[var(--tablet-muted)] py-2">
            Order {status}
          </div>
        )}
      </div>
    </div>
  );
}

// Export types for external use (re-exported from shared module for convenience)
export type { Order, OrderStatus, OrderItem } from './types';
