import Head from 'next/head';
import { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { CheckCircle2, Clock, RefreshCcw, Soup, Truck, Utensils, ArrowRight } from 'lucide-react';

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

function formatTimeAgo(iso: string | null | undefined, now: number | null) {
  if (now === null || !iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const diffMs = now - d.getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'NEW';
  return `${mins}m`;
}

function normalizeStatus(s: string | null | undefined) {
  const v = (s || '').trim();
  if (!v) return 'received';
  const lower = v.toLowerCase();
  if (lower === 'new') return 'received';
  return lower;
}

export default function TabletLightPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState<number | null>(null);
  const lastRefreshAt = useRef<number>(0);

  async function refresh() {
    try {
      const json = await apiGet<OrdersResponse>('/orders?limit=50&offset=0');
      const list = Array.isArray(json?.data?.orders) ? json.data!.orders! : [];
      setOrders(list);
      lastRefreshAt.current = Date.now();
    } catch (e: unknown) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function setStatus(orderId: string, nextStatus: string) {
    setBusyId(orderId);
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: nextStatus } : o)));
    try {
      await apiPost(`/orders/${encodeURIComponent(orderId)}/status`, { status: nextStatus });
    } catch (e) {
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  useEffect(() => {
    refresh();
    const t = window.setInterval(() => {
      if (Date.now() - lastRefreshAt.current < 5000) return;
      refresh();
    }, 10000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    setNow(Date.now());
    const t = window.setInterval(() => setNow(Date.now()), 10000);
    return () => window.clearInterval(t);
  }, []);

  const activeOrders = useMemo(() => {
    const activeStatuses = new Set(['received', 'preparing', 'ready']);
    return orders.filter((o) => activeStatuses.has(normalizeStatus(o.status)));
  }, [orders]);

  return (
    <div className="min-h-screen bg-white text-black font-sans">
      <Head>
        <title>POS LIGHT • Servio</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
      </Head>

      {/* Header */}
      <div className="sticky top-0 z-20 bg-black text-white px-6 py-4 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-4">
          <div className="bg-white text-black font-black px-3 py-1 rounded text-xl italic">SERVIO</div>
          <div className="h-8 w-px bg-white/20 hidden sm:block" />
          <div className="text-2xl font-bold tracking-tight">KITCHEN DISPLAY</div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right hidden sm:block">
            <div className="text-xs font-bold text-white/50 uppercase tracking-widest">Local Time</div>
            <div className="text-xl font-mono font-bold">
              {now ? new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
            </div>
          </div>
          <button 
            onClick={refresh}
            className="bg-white/10 hover:bg-white/20 p-3 rounded-full transition-colors"
          >
            <RefreshCcw className={clsx("h-6 w-6", loading && "animate-spin")} />
          </button>
          <button 
            onClick={() => window.location.href = '/tablet/orders'}
            className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg text-sm font-bold transition-colors"
          >
            DARK VIEW
          </button>
        </div>
      </div>

      <div className="p-4 sm:p-6">
        {activeOrders.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center py-32 text-slate-400">
            <CheckCircle2 className="h-24 w-24 mb-6 opacity-20" />
            <h2 className="text-3xl font-bold">ALL CLEAR</h2>
            <p className="text-xl mt-2 font-medium uppercase tracking-widest">No active orders</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {activeOrders.map((o) => {
              const status = normalizeStatus(o.status);
              const isNew = status === 'received';
              const isPreparing = status === 'preparing';
              const isReady = status === 'ready';
              const timeStr = formatTimeAgo(o.created_at, now);

              return (
                <div 
                  key={o.id} 
                  className={clsx(
                    "flex flex-col rounded-[2rem] border-[4px] bg-white overflow-hidden shadow-2xl transition-all",
                    isNew ? "border-blue-600 ring-8 ring-blue-50" : "border-black",
                    isReady && "opacity-50 grayscale"
                  )}
                >
                  {/* Card Header */}
                  <div className={clsx(
                    "px-6 py-4 flex items-center justify-between border-b-[4px]",
                    isNew ? "bg-blue-600 text-white border-blue-600" : "bg-black text-white border-black"
                  )}>
                    <div className="flex flex-col">
                      <span className="text-xs font-black uppercase tracking-widest opacity-70">Order</span>
                      <span className="text-4xl font-black font-mono leading-none tracking-tighter">
                        #{o.external_id ? o.external_id.slice(-4).toUpperCase() : o.id.slice(-4).toUpperCase()}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-black uppercase tracking-widest opacity-70">Elapsed</span>
                      <div className={clsx(
                        "text-3xl font-black tabular-nums leading-none",
                        timeStr.includes('m') && parseInt(timeStr) > 20 ? "text-red-400" : "text-white"
                      )}>
                        {timeStr}
                      </div>
                    </div>
                  </div>

                  {/* Customer Info */}
                  <div className="px-6 py-4 bg-slate-50 border-b-[2px] border-slate-200">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-black text-black truncate uppercase">
                        {o.customer_name || 'GUEST'}
                      </span>
                      <div className="flex-shrink-0 ml-auto bg-black text-white px-2 py-1 rounded-md text-[10px] font-black uppercase">
                        {o.channel || 'POS'}
                      </div>
                    </div>
                  </div>

                  {/* Items List */}
                  <div className="flex-grow p-6 space-y-4">
                    {(o.items || []).map((it, idx) => (
                      <div key={idx} className="flex items-start gap-4">
                        <div className="flex-shrink-0 bg-black text-white w-10 h-10 rounded-xl flex items-center justify-center text-xl font-black">
                          {it.quantity || 1}
                        </div>
                        <div className="flex-grow">
                          <div className="text-2xl font-bold leading-tight text-black break-words uppercase">
                            {it.name}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Action Button */}
                  <div className="p-4 bg-slate-100 mt-auto">
                    {isNew && (
                      <button
                        disabled={busyId === o.id}
                        onClick={() => setStatus(o.id, 'preparing')}
                        className="w-full bg-blue-600 hover:bg-blue-700 active:scale-95 text-white py-8 rounded-[1.5rem] flex items-center justify-center gap-4 transition-all shadow-xl"
                      >
                        <span className="text-4xl font-black uppercase tracking-tighter">START PREP</span>
                        <ArrowRight className="h-10 w-10 stroke-[4px]" />
                      </button>
                    )}
                    {isPreparing && (
                      <button
                        disabled={busyId === o.id}
                        onClick={() => setStatus(o.id, 'ready')}
                        className="w-full bg-black hover:bg-slate-900 active:scale-95 text-white py-8 rounded-[1.5rem] flex items-center justify-center gap-4 transition-all shadow-xl"
                      >
                        <span className="text-4xl font-black uppercase tracking-tighter">MARK READY</span>
                        <CheckCircle2 className="h-10 w-10 stroke-[4px]" />
                      </button>
                    )}
                    {isReady && (
                      <button
                        disabled={busyId === o.id}
                        onClick={() => setStatus(o.id, 'completed')}
                        className="w-full bg-slate-400 hover:bg-slate-500 active:scale-95 text-white py-6 rounded-[1.5rem] flex items-center justify-center gap-4 transition-all"
                      >
                        <span className="text-3xl font-black uppercase tracking-tighter">BUMP ORDER</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style jsx global>{`
        body {
          overscroll-behavior-y: contain;
          -webkit-tap-highlight-color: transparent;
        }
      `}</style>
    </div>
  );
}
