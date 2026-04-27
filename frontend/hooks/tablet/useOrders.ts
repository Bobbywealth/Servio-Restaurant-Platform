/**
 * useOrders Hook
 * 
 * Custom hook for managing order state, fetching, filtering, and sorting.
 * This extracts the order-related business logic from the main component.
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import { safeLocalStorage } from '@/lib/utils';
import type { Order, OrdersResponse, OrderFilter } from '@/components/tablet/orders/types';
import {
  normalizeStatus,
  formatTimeAgo,
  getOrderUrgencyLevel,
  matchesSearchQuery,
  isArchivedOrder,
  filterActiveOrders,
} from '@/components/tablet/orders/utils';
import { STALE_ORDER_THRESHOLD_MINUTES, ORDER_QUEUE } from '@/components/tablet/orders/constants';

const ORDER_CACHE_KEY = 'servio_cached_orders';

interface UseOrdersOptions {
  enabled?: boolean;
}

interface UseOrdersReturn {
  // State
  orders: Order[];
  loading: boolean;
  error: Error | null;
  now: number | null;
  
  // Derived state
  activeOrders: Order[];
  filteredOrders: Order[];
  receivedOrders: Order[];
  preparingOrders: Order[];
  readyOrders: Order[];
  archivedOrders: Order[];
  attentionOrdersCount: number;
  lateOrdersCount: number;
  
  // Actions
  refresh: () => Promise<void>;
  
  // Filter state
  statusFilter: OrderFilter['status'];
  setStatusFilter: (status: OrderFilter['status']) => void;
  channelFilter: string;
  setChannelFilter: (channel: string) => void;
  sortBy: OrderFilter['sortBy'];
  setSortBy: (sort: OrderFilter['sortBy']) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  needsAttentionOnly: boolean;
  setNeedsAttentionOnly: (value: boolean) => void;
  
  // Channels
  channels: string[];
}

async function apiGet<T>(path: string): Promise<T> {
  const res = await api.get(path);
  return res.data as T;
}

export function useOrders(options: UseOrdersOptions = {}): UseOrdersReturn {
  const { enabled = true } = options;
  
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [now, setNow] = useState<number | null>(null);
  const lastRefreshAt = useRef<number>(0);
  
  // Filter state
  const [statusFilter, setStatusFilter] = useState<OrderFilter['status']>('all');
  const [channelFilter, setChannelFilter] = useState('all');
  const [sortBy, setSortBy] = useState<OrderFilter['sortBy']>('newest');
  const [searchQuery, setSearchQuery] = useState('');
  const [needsAttentionOnly, setNeedsAttentionOnly] = useState(false);
  
  // Get unique channels for filter dropdown
  const channels = useMemo(() => {
    const channelSet = new Set<string>();
    orders.forEach(o => {
      if (o.channel) channelSet.add(o.channel);
    });
    return Array.from(channelSet).sort();
  }, [orders]);
  
  // Load cached orders on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = safeLocalStorage.getItem(ORDER_CACHE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed?.orders)) {
        setOrders(parsed.orders);
        setLoading(false);
      }
    } catch {
      // ignore cache parse issues
    }
  }, []);
  
  // Update current time every 10 seconds
  useEffect(() => {
    setNow(Date.now());
    const t = window.setInterval(() => setNow(Date.now()), 10000);
    return () => window.clearInterval(t);
  }, []);
  
  // Fetch orders
  const refresh = useCallback(async () => {
    try {
      if (typeof window !== 'undefined' && !safeLocalStorage.getItem('servio_access_token')) {
        setLoading(false);
        return;
      }
      const json = await apiGet<OrdersResponse>('/api/orders?limit=50&offset=0');
      const list = Array.isArray(json?.data?.orders) ? json.data!.orders! : [];
      setOrders(list);
      if (typeof window !== 'undefined') {
        const payload = JSON.stringify({ orders: list, cachedAt: new Date().toISOString() });
        safeLocalStorage.setItem(ORDER_CACHE_KEY, payload);
      }
      lastRefreshAt.current = Date.now();
      setError(null);
    } catch (e: unknown) {
      console.error(e);
      setError(e instanceof Error ? e : new Error('Failed to fetch orders'));
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);
  
  // Initial fetch and interval refresh
  useEffect(() => {
    if (!enabled) return;
    refresh();
    const t = window.setInterval(() => {
      if (Date.now() - lastRefreshAt.current < ORDER_QUEUE.minRefreshIntervalMs) return;
      refresh();
    }, ORDER_QUEUE.refreshIntervalMs);
    return () => window.clearInterval(t);
  }, [enabled, refresh]);
  
  // Active orders (not completed/cancelled)
  const activeOrders = useMemo(() => {
    return filterActiveOrders(orders);
  }, [orders]);
  
  // Filtered and sorted orders
  const filteredOrders = useMemo(() => {
    let result = [...activeOrders];
    
    // Apply status filter
    if (statusFilter !== 'all') {
      result = result.filter(o => normalizeStatus(o.status) === statusFilter);
    }
    
    // Apply channel filter
    if (channelFilter !== 'all') {
      result = result.filter(o => o.channel === channelFilter);
    }
    
    // Apply search query
    if (searchQuery.trim()) {
      result = result.filter(o => matchesSearchQuery(o, searchQuery));
    }
    
    // Apply needs attention filter
    if (needsAttentionOnly) {
      result = result.filter((order) => {
        const { elapsedMinutes } = formatTimeAgo(order.created_at, now);
        return getOrderUrgencyLevel(elapsedMinutes) !== 'normal';
      });
    }
    
    // Apply sorting
    switch (sortBy) {
      case 'oldest':
        result.sort((a, b) => {
          const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
          const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
          return ta - tb;
        });
        break;
      case 'prep-time':
        result.sort((a, b) => {
          const pa = a.prep_minutes || 15;
          const pb = b.prep_minutes || 15;
          const hasA = a.created_at ? Date.now() - new Date(a.created_at).getTime() : 0;
          const hasB = b.created_at ? Date.now() - new Date(b.created_at).getTime() : 0;
          const ra = pa * 60000 - hasA;
          const rb = pb * 60000 - hasB;
          return ra - rb;
        });
        break;
      case 'newest':
      default:
        result.sort((a, b) => {
          const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
          const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
          return tb - ta;
        });
        break;
    }
    
    return result;
  }, [activeOrders, statusFilter, channelFilter, searchQuery, sortBy, needsAttentionOnly, now]);
  
  // Queue sections
  const { receivedOrders, preparingOrders, readyOrders, archivedOrders } = useMemo(() => {
    const activeQueue: Order[] = [];
    const archived: Order[] = [];
    
    filteredOrders.forEach((order) => {
      if (isArchivedOrder(order, now, STALE_ORDER_THRESHOLD_MINUTES)) {
        archived.push(order);
        return;
      }
      activeQueue.push(order);
    });
    
    return {
      receivedOrders: activeQueue.filter((o) => normalizeStatus(o.status) === 'received'),
      preparingOrders: activeQueue.filter((o) => normalizeStatus(o.status) === 'preparing'),
      readyOrders: activeQueue.filter((o) => normalizeStatus(o.status) === 'ready'),
      archivedOrders: archived,
    };
  }, [filteredOrders, now]);
  
  // Attention count
  const attentionOrdersCount = useMemo(() => {
    return activeOrders.filter((order) => {
      const { elapsedMinutes } = formatTimeAgo(order.created_at, now);
      return getOrderUrgencyLevel(elapsedMinutes) !== 'normal';
    }).length;
  }, [activeOrders, now]);
  
  // Late count
  const lateOrdersCount = useMemo(() => {
    return activeOrders.filter((order) => {
      const { elapsedMinutes } = formatTimeAgo(order.created_at, now);
      return getOrderUrgencyLevel(elapsedMinutes) === 'critical';
    }).length;
  }, [activeOrders, now]);
  
  return {
    // State
    orders,
    loading,
    error,
    now,
    
    // Derived state
    activeOrders,
    filteredOrders,
    receivedOrders,
    preparingOrders,
    readyOrders,
    archivedOrders,
    attentionOrdersCount,
    lateOrdersCount,
    
    // Actions
    refresh,
    
    // Filter state
    statusFilter,
    setStatusFilter,
    channelFilter,
    setChannelFilter,
    sortBy,
    setSortBy,
    searchQuery,
    setSearchQuery,
    needsAttentionOnly,
    setNeedsAttentionOnly,
    
    // Channels
    channels,
  };
}
