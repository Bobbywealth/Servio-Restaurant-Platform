import { AlertTriangle, Printer, X } from 'lucide-react';
import type { Order } from '../../../hooks/tablet/ordersTypes';

type Props = {
  order: Order | null;
  onClose: () => void;
  onPrint: (orderId: string) => void;
  formatMoney: (v: number | null | undefined) => string;
};

export function OrderDetailsModal({ order, onClose, onPrint, formatMoney }: Props) {
  if (!order) return null;

  return (
    <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-[var(--tablet-surface)] rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--tablet-border)] flex items-center justify-between">
          <h3 className="text-xl font-semibold">Order Details</h3>
          <button onClick={onClose}><X className="h-5 w-5" /></button>
        </div>
        <div className="p-6 space-y-4 overflow-y-auto max-h-[calc(90vh-150px)]">
          {(order.items || []).map((item, idx) => (
            <div key={idx} className="flex justify-between">
              <span>{item.quantity || 1}x {item.name}</span>
              <span>{formatMoney((item.unit_price || item.price || 0) * (item.quantity || 1))}</span>
            </div>
          ))}
          {order.special_instructions ? (
            <div className="bg-[var(--tablet-warning)]/10 border border-[var(--tablet-warning)]/30 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-[var(--tablet-warning)] flex-shrink-0 mt-0.5" />
                <div>{order.special_instructions}</div>
              </div>
            </div>
          ) : null}
        </div>
        <div className="px-6 py-4 border-t border-[var(--tablet-border)] flex gap-3">
          <button onClick={() => onPrint(order.id)} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-[var(--tablet-border-strong)] font-semibold uppercase">
            <Printer className="h-5 w-5" />Print
          </button>
          <button onClick={onClose} className="flex-1 py-3 rounded-xl bg-[var(--tablet-accent)] text-[var(--tablet-accent-contrast)] font-semibold uppercase">Close</button>
        </div>
      </div>
    </div>
  );
}
