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
    try {
      const res = await api.get('/api/orders?limit=50&offset=0');
      const json = res.data as OrdersResponse;
      const list = Array.isArray(json?.data?.orders) ? json.data.orders : [];
      setOrders(list || []);
      const nextCachedAt = new Date().toISOString();
      safeLocalStorage.setItem(ORDER_CACHE_KEY, JSON.stringify({ orders: list, cachedAt: nextCachedAt }));
      setCachedAt(nextCachedAt);
      lastRefreshAt.current = Date.now();
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(() => {
      if (Date.now() - lastRefreshAt.current < 5000) return;
      refresh();
    }, 10000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  return { orders, setOrders, loading, cachedAt, refresh };
}
