import Head from 'next/head';
import { useEffect, useMemo, useRef, useState, useCallback, KeyboardEvent } from 'react';
import { useRouter } from 'next/router';
import clsx from 'clsx';
import {
  Printer,
  Search,
  Filter,
  X,
  AlertTriangle,
} from 'lucide-react';
import { useSocket } from '../../lib/socket';
import { PrintReceipt } from '../../components/PrintReceipt';
import { TabletSidebar } from '../../components/tablet/TabletSidebar';
import { OrdersHeader } from '../../components/tablet/orders/OrdersHeader';
import { OrderFiltersBar } from '../../components/tablet/orders/OrderFiltersBar';
import { OrderDetailsModal } from '../../components/tablet/orders/OrderDetailsModal';
import { useOrderAlerts } from '../../hooks/tablet/useOrderAlerts';
import type { ReceiptPaperWidth, ReceiptOrder, ReceiptRestaurant } from '../../utils/receiptGenerator';
import { generateReceiptHtml, generateStandaloneReceiptHtml, getReceiptItemModifiers } from '../../utils/receiptGenerator';
import { api } from '../../lib/api'
import { safeLocalStorage } from '../../lib/utils';
import { generatePlainTextReceipt, printViaRawBT } from '../../utils/escpos';
import { useUser } from '../../contexts/UserContext';

type OrderItem = {
  id?: string;
  name?: string;
  quantity?: number;
  qty?: number;
  unit_price?: number;
  price?: number;
  modifiers?: Record<string, unknown> | string[];
  notes?: string | null;
};

type Order = {
  id: string;
  external_id?: string | null;
  channel?: string | null;
  status?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  order_type?: string | null;
  pickup_time?: string | null;
  special_instructions?: string | null;
  total_amount?: number | null;
  subtotal?: number | null;
  created_at?: string | null;
  items?: OrderItem[];
  restaurant?: {
    name?: string;
    address?: string;
    phone?: string;
    logo_url?: string;
  };
  [key: string]: unknown;
};

type OrdersApiResponse = {
  success: boolean;
  data?: {
    orders?: Order[];
    pagination?: {
      total: number;
      limit: number;
      offset: number;
      hasMore: boolean;
    };
  };
  error?: { message?: string };
};

type StatusUpdateResponse = {
  success: boolean;
  data?: { order?: Order };
  error?: { message?: string };
};

type RestaurantProfileResponse = {
  success: boolean;
  data?: {
    name?: string;
    address?: string;
    phone?: string;
    logo_url?: string;
    settings?: Record<string, unknown>;
  };
  error?: { message?: string };
};

const STATUS_FILTERS = [
  { value: 'active', label: 'Active' },
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'preparing', label: 'Preparing' },
  { value: 'ready', label: 'Ready' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const ACTIVE_STATUSES = ['pending', 'confirmed', 'preparing', 'ready'];

function isActiveOrder(order: Order): boolean {
  return ACTIVE_STATUSES.includes((order.status || '').toLowerCase());
}

function formatMoney(value: number | null | undefined): string {
  const amount = typeof value === 'number' ? value : 0;
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

function formatRelativeTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.round(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.round(diffMs / 3600000);
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString();
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

function getStatusColor(status: string | null | undefined): string {
  const s = (status || '').toLowerCase();
  switch (s) {
    case 'pending': return 'bg-yellow-500/20 text-yellow-200 border border-yellow-500/40';
    case 'confirmed': return 'bg-blue-500/20 text-blue-200 border border-blue-500/40';
    case 'preparing': return 'bg-orange-500/20 text-orange-200 border border-orange-500/40';
    case 'ready': return 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/40';
    case 'completed': return 'bg-gray-500/20 text-gray-300 border border-gray-500/40';
    case 'cancelled': return 'bg-red-500/20 text-red-200 border border-red-500/40';
    default: return 'bg-[var(--tablet-border)] text-[var(--tablet-muted)]';
  }
}

function getOrderTypeLabel(type: string | null | undefined): string {
  const t = (type || '').toLowerCase();
  switch (t) {
    case 'pickup': case 'pick-up': return 'Pickup';
    case 'delivery': return 'Delivery';
    case 'dine-in': case 'dinein': return 'Dine In';
    case 'takeout': case 'take-out': return 'Takeout';
    default: return type || 'Unknown';
  }
}

const NEXT_STATUS: Record<string, string> = {
  pending: 'confirmed',
  confirmed: 'preparing',
  preparing: 'ready',
  ready: 'completed',
};

const NEXT_STATUS_LABEL: Record<string, string> = {
  pending: 'Confirm',
  confirmed: 'Start Prep',
  preparing: 'Mark Ready',
  ready: 'Complete',
};

export default function TabletOrdersPage() {
  const router = useRouter();
  const { user, isLoading: userLoading } = useUser();
  const [orders, setOrders] = useState<Order[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);
  const [printingOrderId, setPrintingOrderId] = useState<string | null>(null);
  const [printOrder, setPrintOrder] = useState<Order | null>(null);
  const [restaurantProfile, setRestaurantProfile] = useState<RestaurantProfileResponse['data'] | null>(null);
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [pagination, setPagination] = useState<{ total: number; limit: number; offset: number; hasMore: boolean } | null>(null);
  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [printMode, setPrintMode] = useState<'bluetooth' | 'system' | 'bridge' | 'rawbt'>('system');
  const [paperWidth, setPaperWidth] = useState<ReceiptPaperWidth>('80mm');
  const [rawBtPrinting, setRawBtPrinting] = useState(false);

  const { alerts, dismissAlert, clearAlerts } = useOrderAlerts(orders);

  // Auth guard
  useEffect(() => {
    if (!userLoading && !user) {
      router.replace(`/tablet/login?next=${encodeURIComponent(router.asPath)}`);
    }
  }, [user, userLoading, router]);

  // Load print settings from localStorage
  useEffect(() => {
    const storedMode = safeLocalStorage.getItem('servio_print_mode');
    if (storedMode === 'bluetooth' || storedMode === 'system' || storedMode === 'bridge' || storedMode === 'rawbt') {
      setPrintMode(storedMode);
    }
    const storedWidth = safeLocalStorage.getItem('servio_thermal_paper_width');
    if (storedWidth === '58mm' || storedWidth === '80mm') {
      setPaperWidth(storedWidth);
    }
  }, []);

  // Socket for real-time order updates
  const socket = useSocket();
  useEffect(() => {
    if (!socket) return;
    const handleNewOrder = (order: Order) => {
      setOrders((prev) => {
        const exists = prev.some((o) => o.id === order.id);
        if (exists) return prev;
        return [order, ...prev];
      });
    };
    const handleOrderUpdate = (order: Order) => {
      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, ...order } : o)));
      setSelectedOrder((prev) => (prev?.id === order.id ? { ...prev, ...order } : prev));
    };
    socket.on('order:new', handleNewOrder);
    socket.on('order:updated', handleOrderUpdate);
    socket.on('order:status_changed', handleOrderUpdate);
    return () => {
      socket.off('order:new', handleNewOrder);
      socket.off('order:updated', handleOrderUpdate);
      socket.off('order:status_changed', handleOrderUpdate);
    };
  }, [socket]);

  const loadOrders = useCallback(async (offset = 0, replace = true) => {
    if (!user) return;
    try {
      setLoading(true);
      setError(null);
      const params: Record<string, string | number> = { limit: 50, offset };
      if (statusFilter !== 'active') {
        params.status = statusFilter;
      } else {
        params.status = ACTIVE_STATUSES.join(',');
      }
      const response = await api.get<OrdersApiResponse>('/api/orders', { params });
      const payload = response.data;
      if (!payload.success) {
        throw new Error(payload.error?.message || 'Failed to load orders');
      }
      const nextOrders = payload.data?.orders || [];
      setOrders((prev) => (replace ? nextOrders : [...prev, ...nextOrders]));
      setPagination(payload.data?.pagination || null);
      setLastRefreshed(new Date());
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load orders.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [user, statusFilter]);

  const loadRestaurantProfile = useCallback(async () => {
    try {
      const response = await api.get<RestaurantProfileResponse>('/api/restaurant/profile');
      if (response.data?.success) {
        setRestaurantProfile(response.data.data || null);
      }
    } catch {
      // Non-critical — receipt will just omit restaurant info
    }
  }, []);

  useEffect(() => {
    if (user) {
      loadOrders();
      loadRestaurantProfile();
    }
  }, [user, loadOrders, loadRestaurantProfile]);

  // Auto-refresh
  useEffect(() => {
    if (autoRefreshRef.current) clearInterval(autoRefreshRef.current);
    if (autoRefresh && user) {
      autoRefreshRef.current = setInterval(() => {
        loadOrders(0, true);
      }, 30000);
    }
    return () => {
      if (autoRefreshRef.current) clearInterval(autoRefreshRef.current);
    };
  }, [autoRefresh, user, loadOrders]);

  const updateOrderStatus = async (order: Order, newStatus: string) => {
    setUpdatingOrderId(order.id);
    try {
      const response = await api.patch<StatusUpdateResponse>(`/api/orders/${order.id}/status`, { status: newStatus });
      if (!response.data?.success) {
        throw new Error(response.data?.error?.message || 'Failed to update status');
      }
      const updatedOrder = response.data.data?.order || { ...order, status: newStatus };
      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, ...updatedOrder } : o)));
      setSelectedOrder((prev) => (prev?.id === order.id ? { ...prev, ...updatedOrder } : prev));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update order status';
      setError(message);
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const cancelOrder = async (order: Order) => {
    setCancellingOrderId(order.id);
    try {
      const response = await api.patch<StatusUpdateResponse>(`/api/orders/${order.id}/status`, { status: 'cancelled' });
      if (!response.data?.success) {
        throw new Error(response.data?.error?.message || 'Failed to cancel order');
      }
      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: 'cancelled' } : o)));
      setSelectedOrder((prev) => (prev?.id === order.id ? { ...prev, status: 'cancelled' } : prev));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to cancel order';
      setError(message);
    } finally {
      setCancellingOrderId(null);
    }
  };

  const handlePrintOrder = async (order: Order) => {
    setPrintingOrderId(order.id);
    try {
      if (printMode === 'rawbt') {
        // Use RawBT for silent printing
        setRawBtPrinting(true);
        const restaurant: ReceiptRestaurant = {
          name: restaurantProfile?.name || 'Restaurant',
          address: restaurantProfile?.address,
          phone: restaurantProfile?.phone,
          logo_url: restaurantProfile?.logo_url,
        };
        const receiptOrder: ReceiptOrder = {
          id: order.id,
          external_id: order.external_id,
          customer_name: order.customer_name,
          customer_phone: order.customer_phone,
          order_type: order.order_type,
          channel: order.channel,
          status: order.status,
          special_instructions: order.special_instructions,
          total_amount: order.total_amount,
          subtotal: order.subtotal,
          created_at: order.created_at,
          items: (order.items || []).map(item => ({
            name: item.name || '',
            quantity: item.quantity || item.qty || 1,
            unit_price: item.unit_price || item.price || 0,
            modifiers: getReceiptItemModifiers(item),
            notes: item.notes,
          })),
        };
        const plainText = generatePlainTextReceipt(receiptOrder, restaurant, paperWidth);
        await printViaRawBT(plainText);
        safeLocalStorage.setItem('servio_last_print_result', JSON.stringify({ status: 'success' }));
      } else if (printMode === 'system') {
        // Use browser print dialog with formatted receipt
        setPrintOrder(order);
        // The PrintReceipt component handles the actual printing
      } else {
        // Fallback to system print
        setPrintOrder(order);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Print failed';
      safeLocalStorage.setItem('servio_last_print_result', JSON.stringify({ status: 'error', message }));
      setError(`Print failed: ${message}`);
    } finally {
      setPrintingOrderId(null);
      setRawBtPrinting(false);
    }
  };

  const handlePrintComplete = () => {
    setPrintOrder(null);
    safeLocalStorage.setItem('servio_last_print_result', JSON.stringify({ status: 'success' }));
  };

  // Filter orders by search query
  const filteredOrders = useMemo(() => {
    if (!searchQuery.trim()) return orders;
    const query = searchQuery.toLowerCase();
    return orders.filter((order) => {
      const searchableText = [
        order.customer_name || '',
        order.customer_phone || '',
        order.external_id || order.id || '',
        order.channel || '',
        order.order_type || '',
        order.status || '',
        (order.items || []).map((i) => i.name || '').join(' '),
      ].join(' ').toLowerCase();
      return searchableText.includes(query);
    });
  }, [orders, searchQuery]);

  const activeCount = useMemo(() => orders.filter(isActiveOrder).length, [orders]);
  const pendingCount = useMemo(() => orders.filter((o) => (o.status || '').toLowerCase() === 'pending').length, [orders]);

  const handleSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setSearchQuery('');
      searchRef.current?.blur();
    }
  };

  if (userLoading) {
    return (
      <div className="tablet-theme min-h-screen bg-[var(--tablet-bg)] flex items-center justify-center">
        <div className="animate-spin h-10 w-10 border-2 border-[var(--tablet-accent)] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="tablet-theme min-h-screen bg-[var(--tablet-bg)] text-[var(--tablet-text)] font-sans">
      <Head>
        <title>Orders • Servio</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </Head>

      {/* Print receipt (hidden, triggers browser print) */}
      {printOrder && (
        <PrintReceipt
          order={printOrder as ReceiptOrder}
          restaurant={restaurantProfile as ReceiptRestaurant}
          paperWidth={paperWidth}
          onPrintComplete={handlePrintComplete}
        />
      )}

      <div className="no-print flex min-h-screen flex-col lg:flex-row">
        <TabletSidebar />

        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Header */}
          <OrdersHeader
            activeCount={activeCount}
            pendingCount={pendingCount}
            loading={loading}
            autoRefresh={autoRefresh}
            lastRefreshed={lastRefreshed}
            alerts={alerts}
            onRefresh={() => loadOrders(0, true)}
            onToggleAutoRefresh={() => setAutoRefresh((v) => !v)}
            onDismissAlert={dismissAlert}
            onClearAlerts={clearAlerts}
          />

          {/* Alerts */}
          {alerts.length > 0 && (
            <div className="px-4 pt-3 space-y-2">
              {alerts.slice(0, 3).map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-center gap-3 rounded-xl border border-yellow-500/40 bg-yellow-500/10 px-4 py-3 text-sm"
                >
                  <AlertTriangle className="h-4 w-4 text-yellow-300 flex-shrink-0" />
                  <span className="flex-1 text-yellow-100">{alert.message}</span>
                  <button
                    onClick={() => dismissAlert(alert.id)}
                    className="p-1 rounded hover:bg-yellow-500/20 text-yellow-300"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Search + Filter Bar */}
          <div className="px-4 pt-4 pb-2 flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--tablet-muted)]" />
              <input
                ref={searchRef}
                type="text"
                placeholder="Search orders..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-[var(--tablet-border)] bg-[var(--tablet-surface)] text-[var(--tablet-text)] placeholder-[var(--tablet-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--tablet-accent)] text-sm"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-[var(--tablet-border)]"
                >
                  <X className="h-3.5 w-3.5 text-[var(--tablet-muted)]" />
                </button>
              )}
            </div>
            <button
              onClick={() => setShowFilters((v) => !v)}
              className={clsx(
                'flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition',
                showFilters
                  ? 'border-[var(--tablet-accent)] bg-[var(--tablet-accent)]/15 text-[var(--tablet-accent)]'
                  : 'border-[var(--tablet-border)] text-[var(--tablet-text)] hover:bg-[var(--tablet-surface)]'
              )}
            >
              <Filter className="h-4 w-4" />
              <span className="hidden sm:inline">Filter</span>
            </button>
          </div>

          {/* Filters */}
          {showFilters && (
            <OrderFiltersBar
              statusFilter={statusFilter}
              statusFilters={STATUS_FILTERS}
              onStatusChange={(s) => {
                setStatusFilter(s);
                setShowFilters(false);
              }}
            />
          )}

          {/* Error */}
          {error && (
            <div className="mx-4 mb-3 flex items-center gap-3 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <span className="flex-1">{error}</span>
              <button onClick={() => setError(null)} className="p-0.5 rounded hover:bg-rose-500/20">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Orders Grid */}
          <div className="flex-1 overflow-y-auto px-4 pb-6">
            {loading && filteredOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64">
                <div className="animate-spin h-8 w-8 border-2 border-[var(--tablet-accent)] border-t-transparent rounded-full mb-4" />
                <p className="text-[var(--tablet-muted)] text-sm">Loading orders…</p>
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64">
                <div className="text-5xl mb-4 opacity-30">📋</div>
                <h3 className="text-lg font-semibold mb-1">No orders</h3>
                <p className="text-[var(--tablet-muted)] text-sm">
                  {searchQuery ? 'Try a different search.' : 'No orders match the current filter.'}
                </p>
              </div>
            ) : (
              <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 pt-1">
                {filteredOrders.map((order) => {
                  const nextStatus = NEXT_STATUS[(order.status || '').toLowerCase()];
                  const nextLabel = NEXT_STATUS_LABEL[(order.status || '').toLowerCase()];
                  const isUpdating = updatingOrderId === order.id;
                  const isCancelling = cancellingOrderId === order.id;
                  const isPrinting = printingOrderId === order.id;
                  const isActive = isActiveOrder(order);

                  return (
                    <div
                      key={order.id}
                      className={clsx(
                        'bg-[var(--tablet-surface)] border rounded-2xl overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.3)] flex flex-col transition-all',
                        isActive
                          ? 'border-[var(--tablet-accent)]/40'
                          : 'border-[var(--tablet-border)]'
                      )}
                    >
                      {/* Card Header */}
                      <button
                        onClick={() => setSelectedOrder(order)}
                        className="w-full p-4 text-left hover:bg-[var(--tablet-surface-alt)] transition flex-1"
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xl flex-shrink-0">{getChannelIcon(order.channel)}</span>
                            <div className="min-w-0">
                              <div className="font-semibold truncate text-sm">
                                {order.customer_name || 'Guest'}
                              </div>
                              <div className="text-xs text-[var(--tablet-muted)] truncate">
                                {order.channel || 'Unknown'} • {getOrderTypeLabel(order.order_type)}
                              </div>
                            </div>
                          </div>
                          <span className={clsx('text-xs font-semibold px-2 py-1 rounded-full flex-shrink-0', getStatusColor(order.status))}>
                            {order.status || 'Unknown'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-xs text-[var(--tablet-muted)] mb-2">
                          <span>{order.items?.length || 0} items</span>
                          <span>{formatRelativeTime(order.created_at)}</span>
                        </div>

                        <div className="text-lg font-bold">{formatMoney(order.total_amount)}</div>

                        {order.special_instructions && (
                          <div className="mt-2 text-xs bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-2 py-1.5 text-yellow-200 line-clamp-2">
                            {order.special_instructions}
                          </div>
                        )}
                      </button>

                      {/* Action Buttons */}
                      <div className="border-t border-[var(--tablet-border)] p-3 flex gap-2">
                        {nextStatus && (
                          <button
                            onClick={() => updateOrderStatus(order, nextStatus)}
                            disabled={isUpdating || isCancelling}
                            className="flex-1 py-2.5 rounded-xl bg-[var(--tablet-accent)] text-[var(--tablet-accent-contrast)] text-sm font-bold hover:opacity-90 disabled:opacity-50 transition"
                          >
                            {isUpdating ? '…' : nextLabel}
                          </button>
                        )}
                        <button
                          onClick={() => handlePrintOrder(order)}
                          disabled={isPrinting || rawBtPrinting}
                          className="p-2.5 rounded-xl border border-[var(--tablet-border)] text-[var(--tablet-muted)] hover:bg-[var(--tablet-surface-alt)] disabled:opacity-50 transition"
                          title="Print receipt"
                        >
                          <Printer className={clsx('h-4 w-4', isPrinting && 'animate-pulse')} />
                        </button>
                        {isActive && (
                          <button
                            onClick={() => cancelOrder(order)}
                            disabled={isCancelling || isUpdating}
                            className="p-2.5 rounded-xl border border-rose-500/40 text-rose-300 hover:bg-rose-500/10 disabled:opacity-50 transition"
                            title="Cancel order"
                          >
                            <X className={clsx('h-4 w-4', isCancelling && 'animate-pulse')} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Load More */}
            {pagination?.hasMore && (
              <div className="flex justify-center mt-6">
                <button
                  onClick={() => loadOrders((pagination.offset || 0) + (pagination.limit || 50), false)}
                  disabled={loading}
                  className="px-6 py-3 rounded-xl border border-[var(--tablet-border)] text-[var(--tablet-text)] font-semibold hover:bg-[var(--tablet-surface)] disabled:opacity-50 transition"
                >
                  {loading ? 'Loading…' : 'Load More'}
                </button>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <OrderDetailsModal
          order={selectedOrder as ReceiptOrder & Order}
          restaurant={restaurantProfile as ReceiptRestaurant}
          paperWidth={paperWidth}
          printMode={printMode}
          updatingOrderId={updatingOrderId}
          cancellingOrderId={cancellingOrderId}
          printingOrderId={printingOrderId}
          onClose={() => setSelectedOrder(null)}
          onUpdateStatus={updateOrderStatus}
          onCancel={cancelOrder}
          onPrint={handlePrintOrder}
        />
      )}

      <style jsx global>{`
        .tablet-theme {
          --tablet-bg: #0f0f11;
          --tablet-surface: #18181b;
          --tablet-surface-alt: #1e1e23;
          --tablet-border: #2a2a30;
          --tablet-text: #f4f4f5;
          --tablet-muted: #71717a;
          --tablet-muted-strong: #a1a1aa;
          --tablet-accent: #14b8a6;
          --tablet-accent-contrast: #f0fdf4;
          --tablet-success: #22c55e;
          --tablet-danger: #ef4444;
          --tablet-warning: #f59e0b;
          --tablet-info: #93c5fd;
        }

        .tablet-theme.light {
          --tablet-bg: #f8f9fa;
          --tablet-surface: #ffffff;
          --tablet-surface-alt: #f3f4f6;
          --tablet-border: #e5e7eb;
          --tablet-text: #111827;
          --tablet-muted: #6b7280;
          --tablet-muted-strong: #374151;
          --tablet-accent: #0d9488;
          --tablet-accent-contrast: #ffffff;
          --tablet-success: #16a34a;
          --tablet-danger: #dc2626;
          --tablet-warning: #d97706;
          --tablet-info: #2563eb;
        }

        @media print {
          .no-print { display: none !important; }
        }

        /* Tablet-specific font scaling */
        @media (min-width: 600px) and (max-width: 767px) {
          .tablet-theme {
            font-size: 15px;
          }
        }

        /* 10-inch tablets */
        @media (min-width: 1024px) and (max-width: 1279px) {
          .tablet-theme .text-3xl {
            font-size: 2rem;
          }
          .tablet-theme .text-2xl {
            font-size: 1.5rem;
          }
        }
        /* 8-inch+ tablets */
        @media (min-width: 768px) and (max-width: 1023px) {
          .tablet-theme .text-3xl {
            font-size: 1.9rem;
          }
          .tablet-theme .text-2xl {
            font-size: 1.45rem;
          }
        }
        /* Ensure touch targets are large enough */
        .tablet-theme button {
          min-height: 44px;
          touch-action: manipulation;
        }
        /* Smooth scrolling for order lists */
        .tablet-theme .overflow-y-auto {
          -webkit-overflow-scrolling: touch;
          scroll-behavior: smooth;
        }
        /* Prevent text selection on interactive elements */
        .tablet-theme button,
        .tablet-theme [role="button"] {
          -webkit-user-select: none;
          user-select: none;
        }
      `}</style>
    </div>
  );
}
