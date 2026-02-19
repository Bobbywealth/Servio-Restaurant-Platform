import { useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { api } from '../../lib/api';
import { safeLocalStorage } from '../../lib/utils';
import type { Order, PendingAction } from './ordersTypes';

const ACTION_QUEUE_KEY = 'servio_tablet_action_queue';

function loadActionQueue(): PendingAction[] {
  try {
    const raw = safeLocalStorage.getItem(ACTION_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PendingAction[]) : [];
  } catch {
    return [];
  }
}

function saveActionQueue(next: PendingAction[]) {
  safeLocalStorage.setItem(ACTION_QUEUE_KEY, JSON.stringify(next));
}

export function useOrderStatusActions(setOrders: Dispatch<SetStateAction<Order[]>>) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingActions, setPendingActions] = useState<Set<string>>(new Set());

  const enqueueAction = (action: PendingAction) => {
    const next = [...loadActionQueue(), action];
    saveActionQueue(next);
    setPendingActions((prev) => new Set(prev).add(action.orderId));
  };

  const setStatus = async (orderId: string, status: string) => {
    setBusyId(orderId);
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status } : o)));
    try {
      if (!navigator.onLine) throw new Error('offline');
      await api.post(`/api/orders/${encodeURIComponent(orderId)}/status`, { status });
      setPendingActions((prev) => {
        const next = new Set(prev);
        next.delete(orderId);
        return next;
      });
    } catch {
      enqueueAction({
        id: `${orderId}-${Date.now()}`,
        orderId,
        type: 'status',
        payload: { status },
        queuedAt: Date.now()
      });
    } finally {
      setBusyId(null);
    }
  };

  const acceptOrder = async (order: Order) => setStatus(order.id, 'preparing');
  const declineOrder = async (order: Order) => setStatus(order.id, 'declined');

  const setPrepTime = async (orderId: string, prepMinutes: number) => {
    setBusyId(orderId);
    try {
      if (!navigator.onLine) throw new Error('offline');
      await api.post(`/api/orders/${encodeURIComponent(orderId)}/prep-time`, { prepMinutes });
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, prep_minutes: prepMinutes } : o)));
    } catch {
      enqueueAction({
        id: `${orderId}-${Date.now()}`,
        orderId,
        type: 'prep-time',
        payload: { prepMinutes },
        queuedAt: Date.now()
      });
    } finally {
      setBusyId(null);
    }
  };

  return { busyId, pendingActions, setStatus, acceptOrder, declineOrder, setPrepTime };
}
