import { AlertTriangle, Printer, X } from 'lucide-react';
import clsx from 'clsx';
import type { Order } from '../../../hooks/tablet/ordersTypes';

type Props = {
  order: Order | null;
  onClose: () => void;
  onConfirmOrder: (order: Order) => void;
  onDeclineOrder: (order: Order) => void;
  onSetStatus: (orderId: string, status: string) => void;
  onPrintOrder: (orderId: string) => void;
  busyOrderId: string | null;
  printingOrderId: string | null;
  formatMoney: (v: number | null | undefined) => string;
};

function normalizeStatus(status: string | null | undefined) {
  const lower = (status || '').toLowerCase();
  if (!lower || lower === 'new') return 'received';
  return lower;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function statusBadgeClasses(status: string) {
  switch (status) {
    case 'received':
      return 'bg-[var(--tablet-surface-alt)] text-[var(--tablet-muted-strong)] border border-[var(--tablet-border)]';
    case 'preparing':
      return 'bg-[var(--tablet-warning)]/20 text-[var(--tablet-warning)] border border-[var(--tablet-warning)]/40';
    case 'ready':
      return 'bg-[var(--tablet-success)] text-[var(--tablet-text)]';
    default:
      return 'bg-[var(--tablet-surface-alt)] text-[var(--tablet-text)] border border-[var(--tablet-border)]';
  }
}

export function OrderDetailsModal({
  order,
  onClose,
  onConfirmOrder,
  onDeclineOrder,
  onSetStatus,
  onPrintOrder,
  busyOrderId,
  printingOrderId,
  formatMoney
}: Props) {
  if (!order) return null;

  const status = normalizeStatus(order.status);
  const isBusy = busyOrderId === order.id;
  const isPrinting = printingOrderId === order.id;
  const orderNumber = (order.external_id || order.id).slice(-6).toUpperCase();
  const totalItems = (order.items || []).reduce((sum, item) => sum + (item.quantity || item.qty || 1), 0);

  const renderModifiers = (modifiers: Record<string, unknown> | string[] | undefined) => {
    if (!modifiers) return null;

    if (Array.isArray(modifiers) && modifiers.length > 0) {
      return modifiers.map((modifier, idx) => (
        <div key={`mod-array-${idx}`}>• {String(modifier)}</div>
      ));
    }

    if (typeof modifiers === 'object') {
      const entries = Object.entries(modifiers);
      if (entries.length === 0) return null;
      return entries.map(([group, value]) => (
        <div key={group}>• {group}: {Array.isArray(value) ? value.join(', ') : String(value)}</div>
      ));
    }

    return null;
  };

  return (
    <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-[var(--tablet-surface)] rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden border border-[var(--tablet-border)]">
        <div className="px-6 py-4 border-b border-[var(--tablet-border)] flex items-center justify-between">
          <h3 className="text-xl font-semibold">Order #{orderNumber}</h3>
          <button onClick={onClose} aria-label="Close order details">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto max-h-[calc(90vh-170px)]">
          <section className="rounded-xl border border-[var(--tablet-border)] bg-[var(--tablet-card)] p-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="text-sm text-[var(--tablet-muted)]">Order #{orderNumber}</div>
              <span className={clsx('px-3 py-1 rounded-full text-xs font-semibold uppercase', statusBadgeClasses(status))}>
                {status}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div>
                <div className="text-[var(--tablet-muted)]">Created</div>
                <div className="font-medium">{formatDateTime(order.created_at)}</div>
              </div>
              <div>
                <div className="text-[var(--tablet-muted)]">Pickup time</div>
                <div className="font-medium">{formatDateTime(order.pickup_time)}</div>
              </div>
              <div>
                <div className="text-[var(--tablet-muted)]">Channel</div>
                <div className="font-medium">{order.channel || 'POS'}</div>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-[var(--tablet-border)] bg-[var(--tablet-card)] p-4">
            <div className="text-sm font-semibold mb-3">Customer</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div>
                <div className="text-[var(--tablet-muted)]">Name</div>
                <div className="font-medium">{order.customer_name || 'Guest'}</div>
              </div>
              <div>
                <div className="text-[var(--tablet-muted)]">Phone</div>
                <div className="font-medium">{order.customer_phone || 'No phone'}</div>
              </div>
              <div>
                <div className="text-[var(--tablet-muted)]">Order type</div>
                <div className="font-medium">{order.order_type || 'Pickup'}</div>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-[var(--tablet-border)] bg-[var(--tablet-card)] p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold">Items ({totalItems})</div>
              <div className="text-sm text-[var(--tablet-muted)]">Total {formatMoney(order.total_amount)}</div>
            </div>
            <div className="space-y-2">
              {(order.items || []).map((item, idx) => {
                const quantity = item.quantity || item.qty || 1;
                const linePrice = (item.unit_price || item.price || 0) * quantity;
                const modifiers = renderModifiers(item.modifiers);
                return (
                  <div key={`${order.id}-${idx}`} className="text-sm border-b border-[var(--tablet-border)]/40 pb-2 last:border-b-0">
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{quantity}× {item.name || 'Item'}</div>
                      <div>{formatMoney(linePrice)}</div>
                    </div>
                    {modifiers && (
                      <div className="mt-1 ml-4 text-xs text-[var(--tablet-muted)] space-y-0.5">{modifiers}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-xl border border-[var(--tablet-border)] bg-[var(--tablet-card)] p-4">
            <div className="text-sm font-semibold mb-2">Special instructions</div>
            {order.special_instructions ? (
              <div className="bg-[var(--tablet-warning)]/10 border border-[var(--tablet-warning)]/30 rounded-xl p-3">
                <div className="flex items-start gap-3 text-sm">
                  <AlertTriangle className="h-5 w-5 text-[var(--tablet-warning)] flex-shrink-0 mt-0.5" />
                  <div>{order.special_instructions}</div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-[var(--tablet-muted)]">No special instructions.</div>
            )}
          </section>
        </div>

        <div className="px-6 py-4 border-t border-[var(--tablet-border)] flex flex-wrap gap-3">
          {status === 'received' && (
            <>
              <button
                onClick={() => onConfirmOrder(order)}
                disabled={isBusy}
                className="flex-1 min-w-[140px] py-3 rounded-xl bg-[var(--tablet-success)] text-[var(--tablet-text)] font-semibold uppercase disabled:opacity-60"
              >
                Confirm
              </button>
              <button
                onClick={() => onDeclineOrder(order)}
                disabled={isBusy}
                className="flex-1 min-w-[140px] py-3 rounded-xl border border-[var(--tablet-danger)] text-[var(--tablet-danger)] font-semibold uppercase disabled:opacity-60"
              >
                Decline
              </button>
            </>
          )}

          {status === 'preparing' && (
            <>
              <button
                onClick={() => onSetStatus(order.id, 'ready')}
                disabled={isBusy}
                className="flex-1 min-w-[140px] py-3 rounded-xl bg-[var(--tablet-success)] text-[var(--tablet-text)] font-semibold uppercase disabled:opacity-60"
              >
                Ready
              </button>
              <button
                onClick={() => onPrintOrder(order.id)}
                disabled={isPrinting}
                className="flex-1 min-w-[140px] flex items-center justify-center gap-2 py-3 rounded-xl border border-[var(--tablet-border-strong)] font-semibold uppercase disabled:opacity-60"
              >
                <Printer className="h-4 w-4" />
                Print
              </button>
            </>
          )}

          {status === 'ready' && (
            <button
              onClick={() => onSetStatus(order.id, 'completed')}
              disabled={isBusy}
              className="flex-1 min-w-[140px] py-3 rounded-xl bg-[var(--tablet-success)] text-[var(--tablet-text)] font-semibold uppercase disabled:opacity-60"
            >
              Complete
            </button>
          )}

          <button onClick={onClose} className="flex-1 min-w-[120px] py-3 rounded-xl border border-[var(--tablet-border)] font-semibold uppercase">
            Close
          </button>
          <button
            onClick={() => onPrintOrder(order.id)}
            disabled={isPrinting}
            className="min-w-[120px] px-4 py-3 rounded-xl border border-[var(--tablet-border-strong)] font-semibold uppercase inline-flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <Printer className="h-4 w-4" />
            Print
          </button>
        </div>
      </div>
    </div>
  );
}
