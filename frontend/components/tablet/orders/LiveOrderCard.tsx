import clsx from 'clsx';
import { AlertTriangle, Check, Clock, X, Package, MapPin, ShoppingBag } from 'lucide-react';

// Types
type OrderItem = {
  id?: string;
  name?: string;
  quantity?: number;
  qty?: number;
  modifiers?: Record<string, unknown> | string[];
  notes?: string | null;
};

type Order = {
  id: string;
  external_id?: string | null;
  channel?: string | null;
  status?: string | null;
  customer_name?: string | null;
  order_type?: string | null;
  total_amount?: number | null;
  created_at?: string | null;
  items?: OrderItem[];
  prep_time?: string | null;
  prep_minutes?: number | null;
  special_instructions?: string | null;
};

type OrderStatus = 'received' | 'preparing' | 'ready' | 'completed' | 'cancelled';

type UrgencyLevel = 'normal' | 'warning' | 'critical';

// Utility functions
function formatMoney(v: number | null | undefined): string {
  const n = typeof v === 'number' ? v : 0;
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(n);
  } catch {
    return `$${n.toFixed(2)}`;
  }
}

function formatTimeAgo(iso: string | null | undefined, now: number | null): { text: string; elapsedMinutes: number | null } {
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

function getOrderUrgencyLevel(elapsedMinutes: number | null): UrgencyLevel {
  if (elapsedMinutes === null || elapsedMinutes < 10) return 'normal';
  if (elapsedMinutes <= 20) return 'warning';
  return 'critical';
}

function normalizeStatus(s: string | null | undefined): OrderStatus {
  const v = (s || '').trim();
  if (!v) return 'received';
  const lower = v.toLowerCase();
  if (lower === 'new') return 'received';
  if (lower === 'preparing' || lower === 'in-progress') return 'preparing';
  if (lower === 'ready' || lower === 'completed') return 'ready';
  if (lower === 'picked-up' || lower === 'picked up') return 'ready';
  return lower as OrderStatus;
}

function getChannelIcon(channel: string | null | undefined): string {
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

// Status badge component
function StatusBadge({ status }: { status: OrderStatus }) {
  const config = {
    received: { label: 'New', className: 'bg-[var(--tablet-danger)] text-white' },
    preparing: { label: 'Preparing', className: 'bg-[var(--tablet-warning)] text-[var(--tablet-text)]' },
    ready: { label: 'Ready', className: 'bg-[var(--tablet-success)] text-white' },
    completed: { label: 'Completed', className: 'bg-[var(--tablet-success)]/50 text-white' },
    cancelled: { label: 'Cancelled', className: 'bg-[var(--tablet-muted)] text-white' },
  };

  const { label, className } = config[status] || config.received;

  return (
    <span className={clsx(
      'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold',
      className
    )}>
      {status === 'preparing' && <Clock className="h-3 w-3 mr-1" />}
      {status === 'ready' && <Check className="h-3 w-3 mr-1" />}
      {label}
    </span>
  );
}

// Time pill component for urgency
function TimePill({ 
  elapsedMinutes, 
  text 
}: { 
  elapsedMinutes: number | null; 
  text: string 
}) {
  const urgencyLevel = getOrderUrgencyLevel(elapsedMinutes);
  
  const config = {
    normal: { 
      className: 'bg-[var(--tablet-surface-alt)] text-[var(--tablet-muted)]',
      icon: null
    },
    warning: { 
      className: 'bg-[color-mix(in_srgb,var(--tablet-warning)_18%,transparent)] text-[var(--tablet-warning)]',
      icon: <Clock className="h-3 w-3" />
    },
    critical: { 
      className: 'bg-[color-mix(in_srgb,var(--tablet-danger)_18%,transparent)] text-[var(--tablet-danger)]',
      icon: <AlertTriangle className="h-3 w-3" />
    },
  };

  const { className, icon } = config[urgencyLevel];

  return (
    <span className={clsx(
      'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold tabular-nums',
      className
    )}>
      {icon}
      {text}
      {urgencyLevel === 'critical' && ' late'}
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
      {/* Card Header: Status badge + Time pill */}
      <div className="flex items-center justify-between px-3 pt-2.5 pb-1.5">
        <StatusBadge status={status} />
        <TimePill 
          elapsedMinutes={timeAgo.elapsedMinutes} 
          text={timeAgo.text}
        />
      </div>

      {/* Card Body */}
      <div className="px-3 pb-1.5">
        {/* Main info: Customer name + Amount */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="text-lg font-bold text-[var(--tablet-text)] truncate min-w-0 flex-1">
            {order.customer_name || 'Guest'}
          </div>
          <div className="text-xl font-bold text-[var(--tablet-text)] tabular-nums shrink-0">
            {formatMoney(order.total_amount)}
          </div>
        </div>

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
              if (Array.isArray(item.modifiers) && item.modifiers.length > 0) {
                modifiersText = ' • ' + item.modifiers.slice(0, 2).join(', ');
              } else if (typeof item.modifiers === 'object') {
                const modEntries = Object.entries(item.modifiers).slice(0, 2);
                modifiersText = ' • ' + modEntries.map(([k, v]) => Array.isArray(v) ? v.slice(0, 2).join(', ') : v).join(', ');
              }
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

// Export types for external use
export type { Order, OrderStatus, OrderItem };
