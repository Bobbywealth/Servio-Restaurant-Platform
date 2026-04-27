import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { safeLocalStorage } from '../../lib/utils';
import type { Order, OrdersResponse } from './ordersTypes';

const ORDER_CACHE_KEY = 'servio_cached_orders';

export function useTabletOrdersData() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const lastRefreshAt = useRef<number>(0);
  const pollTimeoutRef = useRef<number | null>(null);
  const isRefreshInFlightRef = useRef(false);
  const failureCountRef = useRef(0);

  useEffect(() => {
    const raw = safeLocalStorage.getItem(ORDER_CACHE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed?.orders)) {
        setOrders(parsed.orders);
        setCachedAt(parsed.cachedAt || null);
        setLoading(false);
      }
    } catch {}
  }, []);

  const refresh = useCallback(async () => {
    if (isRefreshInFlightRef.current) return;
    isRefreshInFlightRef.current = true;
    try {
      const res = await api.get('/api/orders?limit=50&offset=0');
      const json = res.data as OrdersResponse;
      const list = Array.isArray(json?.data?.orders) ? json.data.orders : [];
      setOrders(list || []);
      const nextCachedAt = new Date().toISOString();
      safeLocalStorage.setItem(ORDER_CACHE_KEY, JSON.stringify({ orders: list, cachedAt: nextCachedAt }));
      setCachedAt(nextCachedAt);
      lastRefreshAt.current = Date.now();
      failureCountRef.current = 0;
    } catch (error) {
      failureCountRef.current += 1;
      throw error;
    } finally {
      isRefreshInFlightRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const getBackoffDelayMs = () => {
      const nextDelay = 10000 * Math.pow(2, Math.min(failureCountRef.current, 2));
      return Math.min(nextDelay, 40000);
    };

    const clearPollTimeout = () => {
      if (pollTimeoutRef.current !== null) {
        window.clearTimeout(pollTimeoutRef.current);
        pollTimeoutRef.current = null;
      }
    };

    const schedulePoll = () => {
      clearPollTimeout();
      if (document.visibilityState === 'hidden') return;

      const delay = getBackoffDelayMs();
      pollTimeoutRef.current = window.setTimeout(async () => {
        if (Date.now() - lastRefreshAt.current < 5000) {
          schedulePoll();
          return;
        }
        try {
          await refresh();
        } catch {
          // backoff is handled via failureCountRef
        } finally {
          schedulePoll();
        }
      }, delay);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        clearPollTimeout();
        return;
      }
      void refresh().catch(() => undefined).finally(schedulePoll);
    };

    void refresh().catch(() => undefined).finally(schedulePoll);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearPollTimeout();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [refresh]);

  return { orders, setOrders, loading, cachedAt, refresh };
}
