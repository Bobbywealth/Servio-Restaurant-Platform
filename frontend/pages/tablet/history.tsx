import Head from 'next/head';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, X, Filter, RefreshCcw, ChevronDown, Calendar, DollarSign, User, Clock, ShoppingBag } from 'lucide-react';
import clsx from 'clsx';
import { TabletSidebar } from '../../components/tablet/TabletSidebar';
import { api } from '../../lib/api';

type HistoryOrder = {
  id: string;
  external_id?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  status?: string | null;
  total_amount?: number | null;
  subtotal?: number | null;
  tax?: number | null;
  channel?: string | null;
  order_type?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  items?: Array<{
    name?: string | null;
    quantity?: number | null;
    unit_price?: number | null;
  }>;
  special_instructions?: string | null;
};

type HistoryResponse = {
  success: boolean;
  data?: {
    orders?: HistoryOrder[];
    pagination?: {
      total?: number;
      limit?: number;
      offset?: number;
      hasMore?: boolean;
    };
  };
  error?: { message?: string };
};

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'refunded', label: 'Refunded' }
];

const RANGE_OPTIONS = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: 'all', label: 'All time' }
];

function shortId(id: string | null | undefined) {
  if (!id) return '—';
  return id.length <= 8 ? id : `${id.slice(0, 4)}…${id.slice(-4)}`;
}

function formatMoney(value: number | null | undefined) {
  const amount = typeof value === 'number' ? value : 0;
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return `${date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} • ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

function formatRelativeTime(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.round(diffMs / 60000);
  const diffHours = Math.round(diffMs / 3600000);
  const diffDays = Math.round(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
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
    case 'completed':
      return 'bg-[var(--tablet-success)] text-white';
    case 'cancelled':
      return 'bg-[var(--tablet-danger)] text-white';
    case 'refunded':
      return 'bg-[var(--tablet-warning)] text-white';
    default:
      return 'bg-[var(--tablet-border)] text-[var(--tablet-muted-strong)]';
  }
}

function getOrderTypeLabel(type: string | null | undefined): string {
  const t = (type || '').toLowerCase();
  switch (t) {
    case 'pickup':
    case 'pick-up':
      return 'Pickup';
    case 'delivery':
      return 'Delivery';
    case 'dine-in':
    case 'dinein':
      return 'Dine In';
    case 'takeout':
    case 'take-out':
      return 'Takeout';
    default:
      return type || 'Unknown';
  }
}

export default function TabletHistoryPage() {
  const [orders, setOrders] = useState<HistoryOrder[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [rangeFilter, setRangeFilter] = useState('30');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<{ total?: number; limit?: number; offset?: number; hasMore?: boolean }>({});
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  const dateRange = useMemo(() => {
    if (rangeFilter === 'all') return {};
    const days = Number(rangeFilter);
    if (!Number.isFinite(days)) return {};
    const now = new Date();
    const dateFrom = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    return {
      dateFrom: dateFrom.toISOString(),
      dateTo: now.toISOString()
    };
  }, [rangeFilter]);

  const loadOrders = useCallback(async (offset = 0, replace = true) => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get<HistoryResponse>('/api/orders/history', {
        params: {
          status: statusFilter === 'all' ? undefined : statusFilter,
          limit: 30,
          offset,
          ...dateRange
        }
      });

      const payload = response.data;
      if (!payload.success) {
        throw new Error(payload.error?.message || 'Failed to load history');
      }

      const nextOrders = payload.data?.orders || [];
      setOrders((prev) => (replace ? nextOrders : [...prev, ...nextOrders]));
      setPagination(payload.data?.pagination || {});
    } catch (err: any) {
      setError(err?.message || 'Failed to load order history.');
    } finally {
      setLoading(false);
    }
  }, [dateRange, statusFilter]);

  useEffect(() => {
    loadOrders(0, true);
  }, [loadOrders]);

  // Filter orders locally based on search query
  const filteredOrders = useMemo(() => {
    if (!searchQuery.trim()) return orders;
    const query = searchQuery.toLowerCase();
    return orders.filter(order => {
      const searchableText = [
        order.customer_name || '',
        order.customer_phone || '',
        order.external_id || order.id || '',
        order.channel || '',
        order.order_type || '',
        order.status || '',
        (order.items || []).map(i => i.name || '').join(' ')
      ].join(' ').toLowerCase();
      return searchableText.includes(query);
    });
  }, [orders, searchQuery]);

  const clearSearch = () => setSearchQuery('');

  return (
    <div className="tablet-theme min-h-screen bg-[var(--tablet-bg)] text-[var(--tablet-text)] font-sans">
      <Head>
        <title>Order History • Servio</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
      </Head>
      <div className="no-print flex min-h-screen flex-col lg:flex-row">
        <TabletSidebar />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="max-w-5xl">
            <div className="mb-6">
              <h1 className="text-2xl sm:text-3xl font-semibold">Order History</h1>
              <p className="text-[var(--tablet-muted)] mt-2">
                View and search through past orders, refunds, and cancelled orders.
              </p>
            </div>

            {/* Search and Filters */}
            <div className="bg-[var(--tablet-surface)] border border-[var(--tablet-border)] rounded-2xl p-4 sm:p-6 shadow-[0_2px_8px_rgba(0,0,0,0.3)] mb-6">
              {/* Search Bar */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-[var(--tablet-muted)]" />
                <input
                  type="text"
                  placeholder="Search by customer, order ID, channel, or items..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-10 py-3 rounded-xl border border-[var(--tablet-border)] bg-[var(--tablet-bg)] text-[var(--tablet-text)] placeholder-[var(--tablet-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--tablet-accent)] transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={clearSearch}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-[var(--tablet-border)] transition"
                  >
                    <X className="h-4 w-4 text-[var(--tablet-muted)]" />
                  </button>
                )}
              </div>

              {/* Filter Controls */}
              <div className="flex flex-wrap gap-3 sm:items-end sm:justify-between">
                <div className="flex flex-wrap gap-3">
                  <div className="min-w-[150px]">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--tablet-muted)] mb-2">
                      Status
                    </label>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-lg border border-[var(--tablet-border)] bg-[var(--tablet-bg)] text-[var(--tablet-text)] focus:outline-none focus:ring-2 focus:ring-[var(--tablet-accent)] cursor-pointer"
                    >
                      {STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="min-w-[150px]">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--tablet-muted)] mb-2">
                      Date Range
                    </label>
                    <select
                      value={rangeFilter}
                      onChange={(e) => setRangeFilter(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-lg border border-[var(--tablet-border)] bg-[var(--tablet-bg)] text-[var(--tablet-text)] focus:outline-none focus:ring-2 focus:ring-[var(--tablet-accent)] cursor-pointer"
                    >
                      {RANGE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <button
                  onClick={() => loadOrders(0, true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--tablet-accent)] text-[var(--tablet-accent-contrast)] font-semibold hover:opacity-90 transition disabled:opacity-50"
                  disabled={loading}
                >
                  <RefreshCcw className={clsx('h-4 w-4', loading && 'animate-spin')} />
                  {loading ? 'Loading…' : 'Refresh'}
                </button>
              </div>

              {/* Search Results Count */}
              {searchQuery && (
                <div className="mt-3 text-sm text-[var(--tablet-muted)]">
                  Found {filteredOrders.length} order{filteredOrders.length !== 1 ? 's' : ''} matching "{searchQuery}"
                </div>
              )}
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-6 rounded-xl border border-[var(--tablet-danger)]/40 bg-[var(--tablet-danger)]/10 px-4 py-3 text-sm text-[var(--tablet-text)]">
                {error}
              </div>
            )}

            {/* Orders List */}
            <div className="space-y-3">
              {loading && filteredOrders.length === 0 ? (
                <div className="bg-[var(--tablet-surface)] border border-[var(--tablet-border)] rounded-2xl p-12 text-center">
                  <div className="animate-spin h-8 w-8 border-2 border-[var(--tablet-accent)] border-t-transparent rounded-full mx-auto mb-4" />
                  <p className="text-[var(--tablet-muted)]">Loading order history…</p>
                </div>
              ) : filteredOrders.length === 0 ? (
                <div className="bg-[var(--tablet-surface)] border border-[var(--tablet-border)] rounded-2xl p-12 text-center">
                  <ShoppingBag className="h-16 w-16 mx-auto text-[var(--tablet-muted)]/30 mb-4" />
                  <h3 className="text-xl font-semibold mb-2">No orders found</h3>
                  <p className="text-[var(--tablet-muted)]">
                    {searchQuery
                      ? 'Try adjusting your search or filters.'
                      : 'No historical orders in this date range.'}
                  </p>
                </div>
              ) : (
                <>
                  {/* Summary Stats */}
                  <div className="flex gap-3 mb-4 overflow-x-auto pb-2">
                    <div className="flex-shrink-0 bg-[var(--tablet-surface)] border border-[var(--tablet-border)] rounded-xl px-4 py-3">
                      <div className="text-2xl font-bold">{filteredOrders.length}</div>
                      <div className="text-xs text-[var(--tablet-muted)] uppercase tracking-wide">Total Orders</div>
                    </div>
                    <div className="flex-shrink-0 bg-[var(--tablet-surface)] border border-[var(--tablet-border)] rounded-xl px-4 py-3">
                      <div className="text-2xl font-bold text-[var(--tablet-success)]">
                        {filteredOrders.filter(o => o.status === 'completed').length}
                      </div>
                      <div className="text-xs text-[var(--tablet-muted)] uppercase tracking-wide">Completed</div>
                    </div>
                    <div className="flex-shrink-0 bg-[var(--tablet-surface)] border border-[var(--tablet-border)] rounded-xl px-4 py-3">
                      <div className="text-2xl font-bold text-[var(--tablet-danger)]">
                        {filteredOrders.filter(o => o.status === 'cancelled').length}
                      </div>
                      <div className="text-xs text-[var(--tablet-muted)] uppercase tracking-wide">Cancelled</div>
                    </div>
                    <div className="flex-shrink-0 bg-[var(--tablet-surface)] border border-[var(--tablet-border)] rounded-xl px-4 py-3">
                      <div className="text-2xl font-bold text-[var(--tablet-warning)]">
                        {formatMoney(filteredOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0))}
                      </div>
                      <div className="text-xs text-[var(--tablet-muted)] uppercase tracking-wide">Total Revenue</div>
                    </div>
                  </div>

                  {filteredOrders.map((order) => (
                    <div
                      key={order.id}
                      className="bg-[var(--tablet-surface)] border border-[var(--tablet-border)] rounded-2xl overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.3)]"
                    >
                      {/* Order Header */}
                      <button
                        onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                        className="w-full p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4 text-left hover:bg-[var(--tablet-surface-alt)] transition"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-lg">{getChannelIcon(order.channel)}</span>
                            <span className="text-sm font-semibold truncate">
                              {order.customer_name || 'Guest'}
                            </span>
                            <span className="text-xs text-[var(--tablet-muted)]">
                              #{shortId(order.external_id || order.id)}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--tablet-muted)]">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatRelativeTime(order.created_at)}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-[var(--tablet-border)]">
                              {getOrderTypeLabel(order.order_type)}
                            </span>
                            <span>{order.items?.length || 0} items</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="text-xl font-semibold">{formatMoney(order.total_amount)}</div>
                            <div className="flex items-center gap-1 justify-end">
                              <span className={clsx('px-2 py-0.5 rounded-full text-xs font-semibold', getStatusColor(order.status))}>
                                {order.status || 'Unknown'}
                              </span>
                            </div>
                          </div>
                          <ChevronDown className={clsx(
                            'h-5 w-5 text-[var(--tablet-muted)] transition-transform flex-shrink-0',
                            expandedOrder === order.id && 'rotate-180'
                          )} />
                        </div>
                      </button>

                      {/* Expanded Order Details */}
                      {expandedOrder === order.id && (
                        <div className="border-t border-[var(--tablet-border)] bg-[var(--tablet-surface-alt)] p-4 sm:p-5 animate-fade-in">
                          <div className="grid gap-4 sm:grid-cols-2">
                            {/* Order Info */}
                            <div>
                              <h4 className="text-sm font-semibold uppercase tracking-wide text-[var(--tablet-muted)] mb-3">
                                Order Details
                              </h4>
                              <dl className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                  <dt className="text-[var(--tablet-muted)]">Order ID</dt>
                                  <dd className="font-mono">{order.external_id || order.id}</dd>
                                </div>
                                <div className="flex justify-between">
                                  <dt className="text-[var(--tablet-muted)]">Channel</dt>
                                  <dd>{order.channel || 'Unknown'}</dd>
                                </div>
                                <div className="flex justify-between">
                                  <dt className="text-[var(--tablet-muted)]">Type</dt>
                                  <dd>{getOrderTypeLabel(order.order_type)}</dd>
                                </div>
                                <div className="flex justify-between">
                                  <dt className="text-[var(--tablet-muted)]">Created</dt>
                                  <dd>{formatDateTime(order.created_at)}</dd>
                                </div>
                                {order.customer_phone && (
                                  <div className="flex justify-between">
                                    <dt className="text-[var(--tablet-muted)]">Phone</dt>
                                    <dd>{order.customer_phone}</dd>
                                  </div>
                                )}
                              </dl>
                            </div>

                            {/* Items */}
                            <div>
                              <h4 className="text-sm font-semibold uppercase tracking-wide text-[var(--tablet-muted)] mb-3">
                                Items ({order.items?.length || 0})
                              </h4>
                              <div className="space-y-2">
                                {(order.items || []).map((item, idx) => (
                                  <div key={idx} className="flex justify-between text-sm">
                                    <span className="flex items-center gap-2">
                                      <span className="w-6 h-6 rounded bg-[var(--tablet-border)] flex items-center justify-center text-xs">
                                        {item.quantity || 1}
                                      </span>
                                      {item.name || 'Unknown Item'}
                                    </span>
                                    <span className="font-medium">
                                      {formatMoney((item.unit_price || 0) * (item.quantity || 1))}
                                    </span>
                                  </div>
                                ))}
                              </div>
                              {order.special_instructions && (
                                <div className="mt-3 p-3 rounded-lg bg-[var(--tablet-border)] text-sm">
                                  <span className="font-semibold text-[var(--tablet-accent)]">Note:</span>{' '}
                                  {order.special_instructions}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Totals */}
                          <div className="mt-4 pt-4 border-t border-[var(--tablet-border)]">
                            <div className="flex justify-end space-x-6 text-sm">
                              <div className="flex justify-between w-48">
                                <span className="text-[var(--tablet-muted)]">Subtotal</span>
                                <span>{formatMoney(order.subtotal)}</span>
                              </div>
                              <div className="flex justify-between w-48">
                                <span className="text-[var(--tablet-muted)]">Tax</span>
                                <span>{formatMoney(order.tax)}</span>
                              </div>
                              <div className="flex justify-between w-48 font-semibold text-lg">
                                <span>Total</span>
                                <span>{formatMoney(order.total_amount)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Load More */}
                  {pagination.hasMore && (
                    <div className="flex justify-center pt-4">
                      <button
                        onClick={() => loadOrders((pagination.offset || 0) + (pagination.limit || 30), false)}
                        className="px-8 py-3 rounded-xl border border-[var(--tablet-border)] text-[var(--tablet-text)] font-semibold hover:bg-[var(--tablet-surface)] transition disabled:opacity-50"
                        disabled={loading}
                      >
                        {loading ? 'Loading…' : 'Load More Orders'}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </main>
      </div>

      <style jsx global>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}
