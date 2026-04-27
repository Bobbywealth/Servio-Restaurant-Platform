/**
 * useSyncQueue Hook
 *
 * Custom hook for managing the offline action queue.
 * Handles persistence, retry logic, and queue processing.
 */

import { useState, useEffect, useCallback } from 'react';
import { safeLocalStorage } from '@/lib/utils';
import type { PendingAction, EnqueueAction } from '@/components/tablet/orders/types';
import { ORDER_QUEUE, STORAGE_KEYS } from '@/components/tablet/orders/constants';
import { api } from '@/lib/api';
import { putDurableAction } from '@/lib/offline/offlineActionQueue';

const ACTION_QUEUE_KEY = STORAGE_KEYS.actionQueue;

type BackgroundSyncServiceWorkerRegistration = ServiceWorkerRegistration & {
  sync: {
    register: (tag: string) => Promise<void>;
  };
};

function supportsBackgroundSync(
  registration: ServiceWorkerRegistration
): registration is BackgroundSyncServiceWorkerRegistration {
  const syncCandidate = (registration as { sync?: unknown }).sync;
  return typeof syncCandidate === 'object'
    && syncCandidate !== null
    && typeof (syncCandidate as { register?: unknown }).register === 'function';
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await api.post(path, body);
  return res.data as T;
}

interface UseSyncQueueReturn {
  actionQueue: PendingAction[];
  pendingActions: Set<string>;
  syncAttemptStatus: 'idle' | 'syncing' | 'success' | 'error';
  lastSuccessfulSyncAt: number | null;
  enqueueAction: (action: EnqueueAction) => void;
  processActionQueue: (force?: boolean) => Promise<void>;
  retryQueueNow: () => Promise<void>;
  clearFailedActions: () => void;
  retryOrderSync: (orderId: string) => Promise<void>;
  upsertStatusSyncFailure: (params: {
    orderId: string;
    status: string;
    message: string;
    permanentFailure: boolean;
  }) => void;
}

export function loadActionQueue(): PendingAction[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = safeLocalStorage.getItem(ACTION_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => normalizeQueuedAction(entry))
      .filter((entry): entry is PendingAction => Boolean(entry));
  } catch {
    return [];
  }
}

export function saveActionQueue(next: PendingAction[]) {
  if (typeof window === 'undefined') return;
  safeLocalStorage.setItem(ACTION_QUEUE_KEY, JSON.stringify(next));
}

function normalizeQueuedAction(action: unknown): PendingAction | null {
  if (!action || typeof action !== 'object') return null;
  const act = action as Record<string, unknown>;
  if (!act.id || !act.orderId || !act.type || !act.payload) return null;
  if (act.type !== 'status' && act.type !== 'prep-time') return null;

  const idempotencyKey = (act.idempotencyKey as string)
    || (act.type === 'status'
      ? `status:${act.orderId}:${String((act.payload as Record<string, unknown>)?.status || '').toLowerCase()}`
      : `prep-time:${act.orderId}:${act.queuedAt || Date.now()}`);

  return {
    ...act,
    queuedAt: Number(act.queuedAt) || Date.now(),
    idempotencyKey,
    retryCount: Number(act.retryCount) || 0,
    lastError: typeof act.lastError === 'string' ? act.lastError : null,
    lastAttemptAt: typeof act.lastAttemptAt === 'number' ? act.lastAttemptAt : undefined,
    permanentFailure: Boolean(act.permanentFailure)
  } as PendingAction;
}

async function postMessageToServiceWorker<TResponse>(message: Record<string, unknown>): Promise<TResponse | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;
  const registration = await navigator.serviceWorker.ready;
  const sw = registration.active || navigator.serviceWorker.controller;
  if (!sw) return null;

  return new Promise<TResponse | null>((resolve) => {
    const channel = new MessageChannel();
    const timeout = window.setTimeout(() => resolve(null), 2000);
    channel.port1.onmessage = (event) => {
      clearTimeout(timeout);
      resolve((event.data || null) as TResponse | null);
    };
    sw.postMessage(message, [channel.port2]);
  });
}

export function useSyncQueue(): UseSyncQueueReturn {
  const [actionQueue, setActionQueue] = useState<PendingAction[]>(() => loadActionQueue());
  const [pendingActions, setPendingActions] = useState<Set<string>>(() => new Set());
  const [syncAttemptStatus, setSyncAttemptStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [lastSuccessfulSyncAt, setLastSuccessfulSyncAt] = useState<number | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const cachedQueue = loadActionQueue();
    if (cachedQueue.length > 0) {
      setPendingActions(new Set(cachedQueue.map((item) => item.orderId)));
    }
  }, []);

  const persistActionQueue = useCallback((next: PendingAction[]) => {
    saveActionQueue(next);
    setActionQueue(next);
    setPendingActions(() => {
      const updated = new Set<string>();
      next.forEach((queuedAction) => updated.add(queuedAction.orderId));
      return updated;
    });
  }, []);

  const enqueueAction = useCallback((action: EnqueueAction) => {
    const current = loadActionQueue();
    const idempotencyKey = action.type === 'status'
      ? `status:${action.orderId}:${action.payload.status.toLowerCase()}`
      : `prep-time:${action.orderId}:${action.queuedAt}`;
    const nextAction: PendingAction = { ...action, idempotencyKey, retryCount: 0, lastError: null } as PendingAction;
    const dedupedQueue = action.type === 'status'
      ? current.filter((queuedAction) => !(queuedAction.type === 'status' && queuedAction.idempotencyKey === idempotencyKey))
      : current;
    const next = [...dedupedQueue, nextAction];
    persistActionQueue(next);

    void (async () => {
      try {
        await putDurableAction(nextAction);
        await postMessageToServiceWorker({ type: 'ENQUEUE_OFFLINE_ACTION', payload: nextAction });
      } catch {
        // fall through to local queue fallback
      }

      if ('serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.ready;
          if ('sync' in registration && registration.sync) {
            await (registration.sync as { register: (tag: string) => Promise<void> }).register('servio-sync');
          }
        } catch {
          // Background Sync unavailable or registration failed
        }
      }
    })();
  }, [persistActionQueue]);

  const upsertStatusSyncFailure = useCallback((params: {
    orderId: string;
    status: string;
    message: string;
    permanentFailure: boolean;
  }) => {
    const { orderId, status, message, permanentFailure } = params;
    const current = loadActionQueue();
    const idempotencyKey = `status:${orderId}:${status.toLowerCase()}`;
    const existing = current.find((action) => action.type === 'status' && action.idempotencyKey === idempotencyKey);
    const nextRetryCount = (existing?.retryCount || 0) + 1;
    const failedAction: PendingAction = {
      id: existing?.id || `${orderId}-${Date.now()}`,
      orderId,
      type: 'status',
      payload: { status: status as 'received' | 'preparing' | 'ready' | 'completed' | 'cancelled' },
      queuedAt: existing?.queuedAt || Date.now(),
      idempotencyKey,
      retryCount: nextRetryCount,
      lastError: message,
      lastAttemptAt: Date.now(),
      permanentFailure
    };
    const next = [
      ...current.filter((queuedAction) => !(queuedAction.type === 'status' && queuedAction.idempotencyKey === idempotencyKey)),
      failedAction
    ];
    persistActionQueue(next);
  }, [persistActionQueue]);

  const processActionQueue = useCallback(async (force = false) => {
    if (typeof window === 'undefined') return;
    if (!navigator.onLine) return;
    const queue = loadActionQueue();
    if (queue.length === 0) return;
    setSyncAttemptStatus('syncing');
    const remaining: PendingAction[] = [];

    for (const action of queue) {
      if (!force && (action.permanentFailure || action.retryCount >= ORDER_QUEUE.maxRetryAttempts)) {
        remaining.push(action);
        continue;
      }

      try {
        if (action.type === 'status') {
          await apiPost(`/api/orders/${encodeURIComponent(action.orderId)}/status`, {
            ...action.payload,
            idempotencyKey: action.idempotencyKey
          });
        } else if (action.type === 'prep-time') {
          await apiPost(`/api/orders/${encodeURIComponent(action.orderId)}/prep-time`, {
            ...action.payload,
            idempotencyKey: action.idempotencyKey
          });
        }
      } catch (error: unknown) {
        const err = error as { response?: { status?: number; data?: { error?: { message?: string } } }; message?: string };
        const statusCode = err?.response?.status;
        const message = err?.response?.data?.error?.message || err?.message || 'Sync failed';
        const permanentFailure = statusCode === 400 || statusCode === 404 || statusCode === 409 || statusCode === 422;
        const nextRetryCount = (action.retryCount || 0) + 1;
        remaining.push({
          ...action,
          retryCount: nextRetryCount,
          lastError: String(message),
          lastAttemptAt: Date.now(),
          permanentFailure
        });
      }
    }

    persistActionQueue(remaining);
    if (remaining.length === queue.length) {
      setSyncAttemptStatus('error');
    } else {
      setSyncAttemptStatus('success');
      setLastSuccessfulSyncAt(Date.now());
    }
  }, [persistActionQueue]);

  const retryQueueNow = useCallback(async () => {
    if (!window.confirm('Retry all failed and queued sync actions now?')) return;
    const resetQueue = loadActionQueue().map((action) => ({ ...action, permanentFailure: false }));
    persistActionQueue(resetQueue);
    await postMessageToServiceWorker({ type: 'TRIGGER_OFFLINE_SYNC' });
    await processActionQueue(true);
  }, [persistActionQueue, processActionQueue]);

  const clearFailedActions = useCallback(() => {
    if (!window.confirm('Clear failed actions that exceeded retry limits? This cannot be undone.')) return;
    const next = loadActionQueue().filter((action) => !action.permanentFailure && action.retryCount < ORDER_QUEUE.maxRetryAttempts);
    persistActionQueue(next);
  }, [persistActionQueue]);

  const retryOrderSync = useCallback(async (orderId: string) => {
    const queue = loadActionQueue();
    if (!queue.some((action) => action.orderId === orderId)) return;

    const resetQueue = queue.map((action) => (
      action.orderId === orderId
        ? { ...action, retryCount: 0, permanentFailure: false, lastError: null }
        : action
    ));

    persistActionQueue(resetQueue);
    await postMessageToServiceWorker({ type: 'TRIGGER_OFFLINE_SYNC' });
    await processActionQueue(true);
  }, [persistActionQueue, processActionQueue]);

  useEffect(() => {
    const handleOnline = () => {
      processActionQueue();
      void postMessageToServiceWorker({ type: 'TRIGGER_OFFLINE_SYNC' });
    };

    const handleServiceWorkerMessage = (event: MessageEvent) => {
      const { type, payload } = event.data || {};
      if (type === 'OFFLINE_QUEUE_UPDATED' && Array.isArray(payload?.queue)) {
        const normalized = payload.queue
          .map((entry: unknown) => normalizeQueuedAction(entry))
          .filter((entry: PendingAction | null): entry is PendingAction => Boolean(entry));
        persistActionQueue(normalized);
        if (payload.lastSuccessfulSyncAt) {
          setLastSuccessfulSyncAt(Number(payload.lastSuccessfulSyncAt));
        }
      }

      if (type === 'OFFLINE_QUEUE_PERMANENT_FAILURE' && payload) {
        upsertStatusSyncFailure({
          orderId: payload.orderId,
          status: payload.status,
          message: payload.message || 'Permanent sync failure',
          permanentFailure: true,
        });
      }
    };

    window.addEventListener('online', handleOnline);
    navigator.serviceWorker?.addEventListener('message', handleServiceWorkerMessage);

    processActionQueue();
    const t = window.setInterval(() => {
      processActionQueue();
    }, ORDER_QUEUE.processIntervalMs);

    return () => {
      window.removeEventListener('online', handleOnline);
      navigator.serviceWorker?.removeEventListener('message', handleServiceWorkerMessage);
      window.clearInterval(t);
    };
  }, [processActionQueue, persistActionQueue, upsertStatusSyncFailure]);

  return {
    actionQueue,
    pendingActions,
    syncAttemptStatus,
    lastSuccessfulSyncAt,
    enqueueAction,
    processActionQueue,
    retryQueueNow,
    clearFailedActions,
    retryOrderSync,
    upsertStatusSyncFailure,
  };
}
