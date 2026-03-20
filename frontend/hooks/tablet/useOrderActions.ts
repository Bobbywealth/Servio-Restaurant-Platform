/**
 * useOrderActions Hook
 * 
 * Custom hook for managing order actions (accept, decline, status changes).
 */

import { useState, useCallback } from 'react';
import type { Order, OrderStatus } from '@/components/tablet/orders/types';
import { ORDER_STATUS, postOrderStatus } from '@/hooks/tablet/orderStatus';
import { api } from '@/lib/api';

interface UseOrderActionsProps {
  onOrdersChange?: (orders: Order[]) => void;
  onOrderUpdate?: (order: Order) => void;
  enqueueAction?: (action: { id: string; orderId: string; type: string; payload: unknown; queuedAt: number }) => void;
  onSyncFailure?: (params: { orderId: string; status: string; message: string; permanentFailure: boolean }) => void;
  socket?: { emit: (event: string, data: unknown) => void } | null;
}

interface UseOrderActionsReturn {
  busyId: string | null;
  setStatus: (orderId: string, nextStatus: OrderStatus) => Promise<void>;
  acceptOrder: (order: Order, minutes: number) => Promise<void>;
  declineOrder: (order: Order) => Promise<void>;
  setPrepTime: (orderId: string, minutes: number) => Promise<void>;
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await api.post(path, body);
  return res.data as T;
}

export function useOrderActions({
  onOrdersChange,
  onOrderUpdate,
  enqueueAction,
  onSyncFailure,
  socket,
}: UseOrderActionsProps = {}): UseOrderActionsReturn {
  const [busyId, setBusyId] = useState<string | null>(null);

  const setStatus = useCallback(async (orderId: string, nextStatus: OrderStatus) => {
    let previousStatus: string | null | undefined;
    
    // Optimistic update notification
    if (onOrderUpdate) {
      onOrderUpdate({ id: orderId, status: nextStatus } as Order);
    }
    
    setBusyId(orderId);
    
    try {
      if (!navigator.onLine) {
        enqueueAction?.({
          id: `${orderId}-${Date.now()}`,
          orderId,
          type: 'status',
          payload: { status: nextStatus },
          queuedAt: Date.now()
        });
      } else {
        await postOrderStatus(api, orderId, nextStatus);
        if (socket) {
          socket.emit('order:status_changed', { orderId, status: nextStatus, timestamp: new Date() });
        }
      }
    } catch (error: unknown) {
      const err = error as { response?: { status?: number; data?: { error?: { message?: string } } }; message?: string };
      const statusCode = err?.response?.status;
      const message = err?.response?.data?.error?.message || err?.message || 'Sync failed';
      const permanentFailure = statusCode === 400 || statusCode === 404 || statusCode === 409 || statusCode === 422;
      
      onSyncFailure?.({
        orderId,
        status: nextStatus,
        message: String(message),
        permanentFailure
      });
    } finally {
      setBusyId(null);
    }
  }, [enqueueAction, onSyncFailure, onOrderUpdate, socket]);

  const setPrepTime = useCallback(async (orderId: string, minutes: number) => {
    setBusyId(orderId);
    try {
      let pickupTime: string | undefined;
      if (!navigator.onLine) {
        enqueueAction?.({
          id: `${orderId}-${Date.now()}`,
          orderId,
          type: 'prep-time',
          payload: { prepMinutes: minutes },
          queuedAt: Date.now()
        });
      } else {
        const resp = await apiPost<{ success: boolean; data?: { pickupTime?: string } }>(
          `/api/orders/${encodeURIComponent(orderId)}/prep-time`,
          { prepMinutes: minutes }
        );
        pickupTime = resp?.data?.pickupTime;
        
        // Notify order update
        if (onOrderUpdate) {
          onOrderUpdate({ 
            id: orderId, 
            status: ORDER_STATUS.PREPARING, 
            pickup_time: pickupTime, 
            prep_minutes: minutes 
          } as Order);
        }
        
        if (socket) {
          socket.emit('order:status_changed', { orderId, status: ORDER_STATUS.PREPARING, timestamp: new Date() });
        }
      }
    } catch (e) {
      enqueueAction?.({
        id: `${orderId}-${Date.now()}`,
        orderId,
        type: 'prep-time',
        payload: { prepMinutes: minutes },
        queuedAt: Date.now()
      });
    } finally {
      setBusyId(null);
    }
  }, [enqueueAction, onOrderUpdate, socket]);

  const acceptOrder = useCallback(async (order: Order, minutes: number) => {
    setBusyId(order.id);
    try {
      await setPrepTime(order.id, minutes);
      if (socket) {
        socket.emit('order:status_changed', { orderId: order.id, status: ORDER_STATUS.PREPARING, timestamp: new Date() });
      }
    } finally {
      setBusyId(null);
    }
  }, [setPrepTime, socket]);

  const declineOrder = useCallback(async (order: Order) => {
    setBusyId(order.id);
    try {
      if (!navigator.onLine) {
        enqueueAction?.({
          id: `${order.id}-${Date.now()}`,
          orderId: order.id,
          type: 'status',
          payload: { status: ORDER_STATUS.CANCELLED },
          queuedAt: Date.now()
        });
      } else {
        await postOrderStatus(api, order.id, ORDER_STATUS.CANCELLED);
      }
      
      // Notify order update
      if (onOrderUpdate) {
        onOrderUpdate({ id: order.id, status: ORDER_STATUS.CANCELLED } as Order);
      }
      
      if (socket) {
        socket.emit('order:status_changed', { orderId: order.id, status: ORDER_STATUS.CANCELLED, timestamp: new Date() });
      }
    } catch (e) {
      enqueueAction?.({
        id: `${order.id}-${Date.now()}`,
        orderId: order.id,
        type: 'status',
        payload: { status: ORDER_STATUS.CANCELLED },
        queuedAt: Date.now()
      });
    } finally {
      setBusyId(null);
    }
  }, [enqueueAction, onOrderUpdate, socket]);

  return {
    busyId,
    setStatus,
    acceptOrder,
    declineOrder,
    setPrepTime,
  };
}
