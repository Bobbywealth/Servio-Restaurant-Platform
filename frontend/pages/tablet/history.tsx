import Head from 'next/head';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { TabletSidebar } from '../../components/tablet/TabletSidebar';
import { api } from '../../lib/api';

type HistoryOrder = {
  id: string;
  external_id?: string | null;
  customer_name?: string | null;
  status?: string | null;
  total_amount?: number | null;
  channel?: string | null;
  order_type?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
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
  { value: 'all', label: 'All statuses' },
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

function shortId(id: string) {
  if (!id) return '';
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
  return `${date.toLocaleDateString()} • ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

export default function TabletHistoryPage() {
  const [orders, setOrders] = useState<HistoryOrder[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [rangeFilter, setRangeFilter] = useState('30');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<{ total?: number; limit?: number; offset?: number; hasMore?: boolean }>({});

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
          status: statusFilter,
          limit: 20,
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

  return (
    <div className="tablet-theme min-h-screen bg-[var(--tablet-bg)] text-[var(--tablet-text)] font-sans">
      <Head>
        <title>Recent Orders • Servio</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
      </Head>
      <div className="no-print flex min-h-screen flex-col lg:flex-row">
        <TabletSidebar />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="max-w-4xl">
            <h1 className="text-2xl sm:text-3xl font-semibold">Recent &amp; History</h1>
            <p className="text-[var(--tablet-muted)] mt-2">
              Review completed orders, refunds, and timeline events from the tablet.
            </p>

            <div className="mt-6 bg-[var(--tablet-surface)] border border-[var(--tablet-border)] rounded-2xl p-4 sm:p-6 shadow-[0_2px_8px_rgba(0,0,0,0.3)]">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="text-sm font-semibold text-[var(--tablet-muted)]">
                    Status
                    <select
                      className="mt-2 w-full rounded-xl border border-[var(--tablet-border)] bg-[var(--tablet-surface)] px-3 py-2 text-[var(--tablet-text)]"
                      value={statusFilter}
                      onChange={(event) => setStatusFilter(event.target.value)}
                    >
                      {STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm font-semibold text-[var(--tablet-muted)]">
                    Date range
                    <select
                      className="mt-2 w-full rounded-xl border border-[var(--tablet-border)] bg-[var(--tablet-surface)] px-3 py-2 text-[var(--tablet-text)]"
                      value={rangeFilter}
                      onChange={(event) => setRangeFilter(event.target.value)}
                    >
                      {RANGE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <button
                  onClick={() => loadOrders(0, true)}
                  className="rounded-xl bg-[var(--tablet-accent)] px-4 py-2 text-sm font-semibold text-[var(--tablet-accent-contrast)] hover:opacity-90"
                  disabled={loading}
                >
                  {loading ? 'Refreshing…' : 'Refresh'}
                </button>
              </div>

              {error && (
                <div className="mt-4 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                  {error}
                </div>
              )}

              <div className="mt-4 space-y-3">
                {loading && orders.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-[var(--tablet-border)] p-6 text-center text-sm text-[var(--tablet-muted)]">
                    Loading order history…
                  </div>
                ) : orders.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-[var(--tablet-border)] p-6 text-center text-sm text-[var(--tablet-muted)]">
                    No historical orders found for this range.
                  </div>
                ) : (
                  orders.map((order) => (
                    <div
                      key={order.id}
                      className="flex flex-col gap-3 rounded-2xl border border-[var(--tablet-border)] bg-[var(--tablet-bg)]/60 p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <div className="text-sm font-semibold">
                          {order.customer_name || 'Guest'}
                          <span className="text-[var(--tablet-muted)]"> • {shortId(order.external_id || order.id)}</span>
                        </div>
                        <div className="mt-1 text-xs text-[var(--tablet-muted)]">
                          {formatDateTime(order.updated_at || order.created_at)}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        {order.status && (
                          <span className="rounded-full border border-[var(--tablet-border)] px-3 py-1 text-[var(--tablet-muted-strong)]">
                            {order.status}
                          </span>
                        )}
                        {order.channel && (
                          <span className="rounded-full border border-[var(--tablet-border)] px-3 py-1 text-[var(--tablet-muted-strong)]">
                            {order.channel}
                          </span>
                        )}
                        <span className="rounded-full bg-[var(--tablet-surface)] px-3 py-1 text-[var(--tablet-text)]">
                          {formatMoney(order.total_amount)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {pagination.hasMore && (
                <div className="mt-4 flex justify-center">
                  <button
                    onClick={() => loadOrders((pagination.offset || 0) + (pagination.limit || 20), false)}
                    className="rounded-xl border border-[var(--tablet-border)] px-4 py-2 text-sm text-[var(--tablet-text)] hover:bg-[var(--tablet-surface)]"
                    disabled={loading}
                  >
                    {loading ? 'Loading…' : 'Load more'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
