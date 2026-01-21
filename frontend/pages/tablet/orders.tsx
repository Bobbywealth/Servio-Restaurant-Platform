import Head from 'next/head';
import { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { CheckCircle2, Clock, RefreshCcw, Soup, Truck, Utensils } from 'lucide-react';
import { useSocket } from '../../lib/socket';

type OrderItem = {
  id?: string;
  name?: string;
  quantity?: number;
  unit_price?: number;
  price?: number;
};

type Order = {
  id: string;
  external_id?: string | null;
  channel?: string | null;
  status?: string | null;
  customer_name?: string | null;
  total_amount?: number | null;
  created_at?: string | null;
  items?: OrderItem[];
};

type OrdersResponse = {
  success: boolean;
  data?: {
    orders?: Order[];
    pagination?: { total?: number; limit?: number; offset?: number; hasMore?: boolean };
  };
  error?: { message?: string };
};

function getApiBase() {
  const url = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3002';
  return url.endsWith('/api') ? url : `${url}/api`;
}

function makeJsonHeaders(): Headers {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (typeof window === 'undefined') return headers;
  // Use same token keys as UserContext
  const token = 
    window.localStorage.getItem('servio_access_token') || 
    window.localStorage.getItem('accessToken') ||
    window.localStorage.getItem('token');
  if (!token) return headers;
  headers.set('Authorization', `Bearer ${token}`);
  return headers;
}

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${getApiBase()}${path}`, { headers: makeJsonHeaders() });
  if (!res.ok) throw new Error(`GET ${path} failed (${res.status})`);
  return (await res.json()) as T;
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${getApiBase()}${path}`, {
    method: 'POST',
    headers: makeJsonHeaders(),
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`POST ${path} failed (${res.status}): ${text}`);
  }
  return (await res.json()) as T;
}

function shortId(id: string) {
  if (!id) return '';
  return id.length <= 8 ? id : `${id.slice(0, 4)}…${id.slice(-4)}`;
}

function formatMoney(v: number | null | undefined) {
  const n = typeof v === 'number' ? v : 0;
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(n);
  } catch {
    return `$${n.toFixed(2)}`;
  }
}

function formatTimeAgo(iso: string | null | undefined, now: number | null) {
  // Avoid hydration mismatches: render a stable placeholder until mounted.
  if (now === null) return '—';
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const diffMs = now - d.getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function normalizeStatus(s: string | null | undefined) {
  const v = (s || '').trim();
  if (!v) return 'received';
  const lower = v.toLowerCase();
  if (lower === 'new') return 'received';
  return lower;
}

function StatusPill(props: { status: string }) {
  const s = normalizeStatus(props.status);
  const label =
    s === 'received'
      ? 'Received'
      : s === 'preparing'
        ? 'Preparing'
        : s === 'ready'
          ? 'Ready'
          : s === 'completed'
            ? 'Completed'
            : s === 'cancelled'
              ? 'Cancelled'
              : s;

  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-3 py-1 text-xs font-extrabold tracking-wide ring-1',
        s === 'received' && 'bg-blue-50 text-blue-800 ring-blue-100',
        s === 'preparing' && 'bg-amber-50 text-amber-900 ring-amber-200',
        s === 'ready' && 'bg-emerald-50 text-emerald-900 ring-emerald-200',
        s === 'completed' && 'bg-slate-100 text-slate-700 ring-slate-200',
        s === 'cancelled' && 'bg-rose-50 text-rose-800 ring-rose-200'
      )}
    >
      {label.toUpperCase()}
    </span>
  );
}

function ChannelIcon(props: { channel?: string | null }) {
  const c = (props.channel || '').toLowerCase();
  if (c.includes('delivery')) return <Truck className="h-5 w-5" />;
  if (c.includes('uber') || c.includes('doordash')) return <Truck className="h-5 w-5" />;
  if (c.includes('website')) return <Utensils className="h-5 w-5" />;
  return <Soup className="h-5 w-5" />;
}

export default function TabletOrdersPage() {
  const socket = useSocket();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<'active' | 'received' | 'preparing' | 'ready' | 'completed'>('active');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState<number | null>(null);
  const lastRefreshAt = useRef<number>(0);

  async function refresh() {
    setError(null);
    setLoading(true);
    try {
      const json = await apiGet<OrdersResponse>('/orders?limit=100&offset=0');
      const list = Array.isArray(json?.data?.orders) ? json.data!.orders! : [];
      setOrders(list);
      lastRefreshAt.current = Date.now();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : typeof e === 'string' ? e : 'Failed to load orders.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function setStatus(orderId: string, nextStatus: 'received' | 'preparing' | 'ready' | 'completed' | 'cancelled') {
    setError(null);
    setBusyId(orderId);
    // Optimistic UI
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: nextStatus } : o)));
    try {
      await apiPost(`/orders/${encodeURIComponent(orderId)}/status`, { status: nextStatus });
      // Notify other clients via socket
      if (socket) {
        socket.emit('order:status_changed', { orderId, status: nextStatus, timestamp: new Date() });
      }
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : typeof e === 'string' ? e : 'Failed to update order status.';
      setError(message);
      // Re-sync from server
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  useEffect(() => {
    refresh();
    const t = window.setInterval(() => {
      // Avoid piling up refreshes if the tab is backgrounded / paused.
      if (Date.now() - lastRefreshAt.current < 15000) return;
      refresh();
    }, 20000); // Polling as fallback, but less frequent since we have sockets
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleNewNotification = (data: any) => {
      if (data.notification.type === 'order.created_web' || 
          data.notification.type === 'order.created_vapi' ||
          data.notification.type === 'order.status_changed') {
        refresh();
      }
    };

    socket.on('notifications.new', handleNewNotification);
    return () => {
      socket.off('notifications.new', handleNewNotification);
    };
  }, [socket]);

  useEffect(() => {
    setNow(Date.now());
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  const filtered = useMemo(() => {
    const list = orders.slice();
    const activeStatuses = new Set(['received', 'preparing', 'ready']);
    return list.filter((o) => {
      const s = normalizeStatus(o.status);
      if (filter === 'active') return activeStatuses.has(s);
      return s === filter;
    });
  }, [filter, orders]);

  const counts = useMemo(() => {
    const c = { received: 0, preparing: 0, ready: 0, completed: 0, active: 0 };
    for (const o of orders) {
      const s = normalizeStatus(o.status);
      if (s === 'received') c.received += 1;
      if (s === 'preparing') c.preparing += 1;
      if (s === 'ready') c.ready += 1;
      if (s === 'completed') c.completed += 1;
      if (s === 'received' || s === 'preparing' || s === 'ready') c.active += 1;
    }
    return c;
  }, [orders]);

  return (
    <>
      <Head>
        <title>Tablet Orders • Servio</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Head>

      <div className="min-h-screen bg-slate-50 text-slate-900">
        <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
          <div className="mx-auto max-w-6xl px-6 py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="text-xs font-extrabold tracking-[0.18em] text-slate-500 uppercase">Servio • Tablet</div>
                <div className="mt-1 flex items-center gap-3">
                  <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Orders</h1>
                  <span className="hidden sm:inline text-sm font-semibold text-slate-500">
                    <Clock className="inline h-4 w-4 -mt-0.5 mr-1" />
                    Auto-refresh
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={refresh}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-base font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                <RefreshCcw className="h-5 w-5" />
                Refresh
              </button>

              <button
                type="button"
                onClick={() => window.location.href = '/tablet/light'}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white border border-slate-200 px-4 py-3 text-base font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
              >
                Light View
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <FilterChip active={filter === 'active'} onClick={() => setFilter('active')} label={`Active (${counts.active})`} />
              <FilterChip active={filter === 'received'} onClick={() => setFilter('received')} label={`Received (${counts.received})`} />
              <FilterChip active={filter === 'preparing'} onClick={() => setFilter('preparing')} label={`Preparing (${counts.preparing})`} />
              <FilterChip active={filter === 'ready'} onClick={() => setFilter('ready')} label={`Ready (${counts.ready})`} />
              <FilterChip active={filter === 'completed'} onClick={() => setFilter('completed')} label={`Completed (${counts.completed})`} />
            </div>

            {error ? (
              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-900">
                {error}
                <div className="mt-1 text-xs font-medium text-rose-700">
                  Tip: make sure your tablet is logged in (token in localStorage) and `NEXT_PUBLIC_API_BASE_URL` points to your backend.
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="mx-auto max-w-6xl px-6 py-6">
          {loading ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-soft">
              <div className="text-sm font-semibold text-slate-700">Loading orders…</div>
              <div className="mt-2 text-sm text-slate-500">If this hangs, check API base URL + auth.</div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-soft">
              <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 ring-1 ring-slate-200">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div className="mt-4 text-xl font-semibold text-slate-900">No orders in this view</div>
              <div className="mt-2 text-sm font-medium text-slate-500">Try switching filters or tap Refresh.</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {filtered.map((o) => {
                const status = normalizeStatus(o.status);
                const isBusy = busyId === o.id;
                const canToPreparing = status === 'received';
                const canToReady = status === 'preparing' || status === 'received';
                const canToCompleted = status === 'ready' || status === 'preparing';

                return (
                  <div key={o.id} className="rounded-3xl border border-slate-200 bg-white shadow-soft">
                    <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-5">
                      <div className="min-w-0">
                        <div className="flex items-center gap-3">
                          <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 ring-1 ring-slate-200">
                            <ChannelIcon channel={o.channel} />
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <div className="text-lg font-semibold tracking-tight text-slate-900">
                                Order {shortId(o.external_id || o.id)}
                              </div>
                              <StatusPill status={status} />
                            </div>
                            <div className="mt-1 text-sm font-medium text-slate-500">
                              {o.customer_name ? <span className="text-slate-700">{o.customer_name}</span> : 'Guest'} •{' '}
                              {(o.channel || 'unknown').toUpperCase()} • {formatTimeAgo(o.created_at, now)}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-xs font-extrabold tracking-[0.18em] text-slate-500 uppercase">Total</div>
                        <div className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
                          {formatMoney(o.total_amount)}
                        </div>
                      </div>
                    </div>

                    <div className="p-5">
                      <div className="space-y-2">
                        {(Array.isArray(o.items) ? o.items : []).slice(0, 6).map((it, idx) => (
                          <div key={`${o.id}-it-${idx}`} className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-slate-900 truncate">
                                {it.name || 'Item'}
                              </div>
                            </div>
                            <div className="text-sm font-extrabold text-slate-700 tabular-nums">
                              ×{typeof it.quantity === 'number' ? it.quantity : 1}
                            </div>
                          </div>
                        ))}
                        {Array.isArray(o.items) && o.items.length > 6 ? (
                          <div className="text-xs font-semibold text-slate-500">+{o.items.length - 6} more…</div>
                        ) : null}
                      </div>

                      <div className="mt-5 grid grid-cols-3 gap-3">
                        <ActionButton
                          disabled={!canToPreparing || isBusy}
                          onClick={() => setStatus(o.id, 'preparing')}
                          tone="amber"
                          label="Preparing"
                        />
                        <ActionButton
                          disabled={!canToReady || isBusy}
                          onClick={() => setStatus(o.id, 'ready')}
                          tone="emerald"
                          label="Ready"
                        />
                        <ActionButton
                          disabled={!canToCompleted || isBusy}
                          onClick={() => setStatus(o.id, 'completed')}
                          tone="slate"
                          label="Complete"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function FilterChip(props: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={clsx(
        'inline-flex items-center rounded-2xl px-4 py-2 text-sm font-extrabold tracking-wide ring-1 transition',
        props.active
          ? 'bg-slate-900 text-white ring-slate-900'
          : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50'
      )}
    >
      {props.label}
    </button>
  );
}

function ActionButton(props: {
  disabled?: boolean;
  onClick?: () => void;
  label: string;
  tone: 'amber' | 'emerald' | 'slate';
}) {
  return (
    <button
      type="button"
      disabled={props.disabled}
      onClick={props.onClick}
      className={clsx(
        'h-14 rounded-2xl text-base font-extrabold transition focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        props.tone === 'amber' && 'bg-amber-50 text-amber-900 ring-1 ring-amber-200 hover:bg-amber-100 focus:ring-amber-400',
        props.tone === 'emerald' &&
          'bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200 hover:bg-emerald-100 focus:ring-emerald-400',
        props.tone === 'slate' && 'bg-slate-100 text-slate-800 ring-1 ring-slate-200 hover:bg-slate-200 focus:ring-slate-400'
      )}
    >
      {props.label}
    </button>
  );
}

