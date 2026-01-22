import Head from 'next/head';
import { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { CheckCircle2, RefreshCcw, ArrowRight, ChevronDown, User, Printer, Settings2 } from 'lucide-react';
import { useSocket } from '../../lib/socket';
import { PrintReceipt } from '../../components/PrintReceipt';
import type { ReceiptPaperWidth, ReceiptOrder, ReceiptRestaurant } from '../../utils/receiptGenerator';
import { generateReceiptHtml } from '../../utils/receiptGenerator';

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
  customer_phone?: string | null;
  order_type?: string | null;
  pickup_time?: string | null;
  special_instructions?: string | null;
  total_amount?: number | null;
  subtotal?: number | null;
  prep_time_minutes?: number | null;
  accepted_at?: string | null;
  accepted_by_user_id?: string | null;
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

async function tryRefreshAccessToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  const refreshToken = window.localStorage.getItem('servio_refresh_token');
  if (!refreshToken) return null;

  try {
    const res = await fetch(`${getApiBase()}/auth/refresh`, {
      method: 'POST',
      headers: new Headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ refreshToken })
    });
    if (!res.ok) return null;
    const json = (await res.json()) as any;
    const newAccessToken = json?.data?.accessToken as string | undefined;
    const user = json?.data?.user;
    if (newAccessToken) window.localStorage.setItem('servio_access_token', newAccessToken);
    if (user) window.localStorage.setItem('servio_user', JSON.stringify(user));
    return newAccessToken || null;
  } catch {
    return null;
  }
}

async function apiGet<T>(path: string): Promise<T> {
  const url = `${getApiBase()}${path}`;
  let res = await fetch(url, { headers: makeJsonHeaders() });
  if (res.status === 401) {
    const refreshed = await tryRefreshAccessToken();
    if (refreshed) {
      res = await fetch(url, { headers: makeJsonHeaders() });
    }
  }
  if (!res.ok) throw new Error(`GET ${path} failed (${res.status})`);
  return (await res.json()) as T;
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const url = `${getApiBase()}${path}`;
  let res = await fetch(url, {
    method: 'POST',
    headers: makeJsonHeaders(),
    body: JSON.stringify(body)
  });
  if (res.status === 401) {
    const refreshed = await tryRefreshAccessToken();
    if (refreshed) {
      res = await fetch(url, {
        method: 'POST',
        headers: makeJsonHeaders(),
        body: JSON.stringify(body)
      });
    }
  }
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

let sharedAudioCtx: AudioContext | null = null;
let lastAlertSoundAtMs = 0;

function beep() {
  // Loud stereo "panning" alert sound (no assets required).
  try {
    const now = Date.now();
    // Prevent accidental rapid-fire stacking.
    if (now - lastAlertSoundAtMs < 400) return;
    lastAlertSoundAtMs = now;

    const AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = sharedAudioCtx ?? (sharedAudioCtx = new AudioContext());
    // Some browsers start suspended until a user gesture happened.
    if (ctx.state === 'suspended') {
      // best-effort resume, don't block if it fails
      ctx.resume().catch(() => {});
    }

    const t0 = ctx.currentTime + 0.01;
    const duration = 0.9;

    const pan = ctx.createStereoPanner();
    // Sweep left -> right -> left for a "panning" effect.
    pan.pan.setValueAtTime(-1, t0);
    pan.pan.linearRampToValueAtTime(1, t0 + duration * 0.5);
    pan.pan.linearRampToValueAtTime(-1, t0 + duration);

    const g = ctx.createGain();
    // "Loud" but not painful; adjust here if needed.
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(0.32, t0 + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

    const o1 = ctx.createOscillator();
    o1.type = 'square';
    o1.frequency.setValueAtTime(880, t0);

    const o2 = ctx.createOscillator();
    o2.type = 'square';
    o2.frequency.setValueAtTime(1320, t0);

    o1.connect(g);
    o2.connect(g);
    g.connect(pan);
    pan.connect(ctx.destination);

    o1.start(t0);
    o2.start(t0);
    o1.stop(t0 + duration);
    o2.stop(t0 + duration);

    o2.onended = () => {
      try {
        o1.disconnect();
        o2.disconnect();
        g.disconnect();
        pan.disconnect();
      } catch {
        // ignore
      }
    };
  } catch {
    // ignore
  }
}

function isWebsiteOrder(o: Order) {
  const c = (o.channel || '').toLowerCase();
  return c.includes('web') || c.includes('website') || c === 'online';
}

function formatCountdown(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}


export default function TabletOrdersPage() {
  const socket = useSocket();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState<number | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [autoPrintEnabled, setAutoPrintEnabled] = useState<boolean>(true);
  const [paperWidth, setPaperWidth] = useState<ReceiptPaperWidth>('80mm');
  const [printingOrderId, setPrintingOrderId] = useState<string | null>(null);
  const [printCopies, setPrintCopies] = useState<number>(2);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [printedOrders, setPrintedOrders] = useState<Set<string>>(() => new Set());
  const printedOrdersRef = useRef<Set<string>>(new Set());
  const hasInitializedPrintedRef = useRef(false);
  const [restaurantProfile, setRestaurantProfile] = useState<ReceiptRestaurant | null>(null);
  const [receiptHtml, setReceiptHtml] = useState<string | null>(null);
  const lastRefreshAt = useRef<number>(0);
  const [alertOrderId, setAlertOrderId] = useState<string | null>(null);
  const [alertUntilMs, setAlertUntilMs] = useState<number | null>(null);
  const alertIntervalRef = useRef<number | null>(null);
  const alertTimeoutRef = useRef<number | null>(null);
  const alertQueueRef = useRef<string[]>([]);
  const [prepMinutesByOrderId, setPrepMinutesByOrderId] = useState<Record<string, number>>({});

  function stopAlert() {
    if (alertIntervalRef.current) window.clearInterval(alertIntervalRef.current);
    if (alertTimeoutRef.current) window.clearTimeout(alertTimeoutRef.current);
    alertIntervalRef.current = null;
    alertTimeoutRef.current = null;
    setAlertOrderId(null);
    setAlertUntilMs(null);
  }

  function startAlert(orderId: string) {
    const MIN_ALERT_MS = 4 * 60 * 1000;
    stopAlert();
    const until = Date.now() + MIN_ALERT_MS;
    setAlertOrderId(orderId);
    setAlertUntilMs(until);

    // Immediately beep once, then repeat.
    if (soundEnabled) beep();
    alertIntervalRef.current = window.setInterval(() => {
      if (!soundEnabled) return;
      beep();
      try {
        // Android devices may vibrate if allowed
        (navigator as any).vibrate?.(200);
      } catch {
        // ignore
      }
    }, 2500);

    alertTimeoutRef.current = window.setTimeout(() => {
      // Ensure minimum 4 minutes of alerting even if no action taken.
      stopAlert();
    }, MIN_ALERT_MS);
  }

  useEffect(() => {
    // Init print settings from env + localStorage
    const envAuto = (process.env.NEXT_PUBLIC_AUTO_PRINT_ENABLED || '').toLowerCase();
    const defaultAuto = envAuto === '' ? true : envAuto === 'true' || envAuto === '1' || envAuto === 'yes';
    const storedAuto = typeof window !== 'undefined' ? window.localStorage.getItem('servio_auto_print_enabled') : null;
    const auto = storedAuto === null ? defaultAuto : storedAuto === 'true';
    setAutoPrintEnabled(auto);

    const envPaper = (process.env.NEXT_PUBLIC_THERMAL_PAPER_WIDTH || '').toLowerCase();
    const defaultPaper: ReceiptPaperWidth = envPaper === '58mm' ? '58mm' : '80mm';
    const storedPaper = typeof window !== 'undefined' ? window.localStorage.getItem('servio_thermal_paper_width') : null;
    const paper: ReceiptPaperWidth = storedPaper === '58mm' ? '58mm' : storedPaper === '80mm' ? '80mm' : defaultPaper;
    setPaperWidth(paper);

    // Additional tablet settings
    const storedCopies = typeof window !== 'undefined' ? window.localStorage.getItem('servio_print_copies') : null;
    const copiesNum = Number(storedCopies ?? 2);
    setPrintCopies(Number.isFinite(copiesNum) && copiesNum > 0 ? Math.floor(copiesNum) : 2);

    const storedSound = typeof window !== 'undefined' ? window.localStorage.getItem('servio_kds_sound_enabled') : null;
    setSoundEnabled(storedSound === null ? true : storedSound === 'true');
  }, []);

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

  async function fetchRestaurantProfile() {
    try {
      const json = await apiGet<{ success: boolean; data?: any }>('/restaurant/profile');
      if (json?.success && json.data) {
        setRestaurantProfile({
          name: json.data.name,
          phone: json.data.phone,
          address: json.data.address,
          logo_url: json.data.logo_url
        });
      }
    } catch (e) {
      // Non-fatal for printing; receipts will still print with fallback header.
      console.warn('Failed to load restaurant profile for printing', e);
    }
  }

  async function printOrder(orderId: string, opts?: { markAsPrinted?: boolean }) {
    setPrintingOrderId(orderId);
    try {
      const full = await apiGet<{ success: boolean; data?: any }>(`/orders/${encodeURIComponent(orderId)}`);
      const order = (full?.data || full) as ReceiptOrder;

      // Ensure we have restaurant info
      let restaurant = restaurantProfile;
      if (!restaurant) {
        await fetchRestaurantProfile();
        restaurant = restaurantProfile;
      }

      const html = generateReceiptHtml({
        restaurant: restaurant || null,
        order: order as ReceiptOrder,
        paperWidth
      });

      setReceiptHtml(html);

      // Wait for receipt DOM to render before invoking print
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

      window.print();

      if (opts?.markAsPrinted !== false) {
        setPrintedOrders((prev) => {
          const next = new Set(prev);
          next.add(orderId);
          printedOrdersRef.current = next;
          return next;
        });
      }
    } catch (e) {
      console.error('Print failed', e);
    } finally {
      setPrintingOrderId(null);
      // clear receipt after print dialog is opened; also clear onafterprint for some browsers
      window.setTimeout(() => setReceiptHtml(null), 250);
    }
  }

  async function setStatus(orderId: string, nextStatus: string) {
    setBusyId(orderId);
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: nextStatus } : o)));
    // If this order was alerting (website "needs decision"), stop the sound once it's handled.
    if (alertOrderId === orderId && normalizeStatus(nextStatus) !== 'received') {
      alertQueueRef.current = alertQueueRef.current.filter((id) => id !== orderId);
      stopAlert();
    }
    try {
      await apiPost(`/orders/${encodeURIComponent(orderId)}/status`, { status: nextStatus });
      if (socket) {
        socket.emit('order:status_changed', { orderId, status: nextStatus, timestamp: new Date() });
      }
    } catch (e) {
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  useEffect(() => {
    refresh();
    fetchRestaurantProfile();
    const t = window.setInterval(() => {
      if (Date.now() - lastRefreshAt.current < 5000) return;
      refresh();
    }, 10000);
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
    const t = window.setInterval(() => setNow(Date.now()), 10000);
    return () => window.clearInterval(t);
  }, []);

  const activeOrders = useMemo(() => {
    const activeStatuses = new Set(['received', 'preparing', 'ready']);
    return orders.filter((o) => activeStatuses.has(normalizeStatus(o.status)));
  }, [orders]);

  const filtered = activeOrders;

  useEffect(() => {
    // Avoid printing everything on initial load; mark existing active orders as already-seen.
    if (!hasInitializedPrintedRef.current) {
      if (!loading) {
        const initial = new Set<string>();
        for (const o of filtered) initial.add(o.id);
        setPrintedOrders(initial);
        printedOrdersRef.current = initial;
        hasInitializedPrintedRef.current = true;
      }
      return;
    }

    if (!autoPrintEnabled) return;

    const toAutoPrint = filtered.filter(
      (o) => normalizeStatus(o.status) === 'received' && !printedOrdersRef.current.has(o.id)
    );

    if (toAutoPrint.length === 0) return;

    // Print newest first (end of list is newest because sorted DESC on server; still defensive)
    const newest = toAutoPrint[0];
    if (soundEnabled) beep();
    printOrder(newest.id, { markAsPrinted: true });
  }, [autoPrintEnabled, filtered, loading, soundEnabled]);

  // Website order alert + accept/decline workflow
  useEffect(() => {
    if (loading) return;

    const pendingWebsite = filtered
      .filter((o) => isWebsiteOrder(o))
      .filter((o) => normalizeStatus(o.status) === 'received')
      .filter((o) => !o.accepted_at);

    // Enqueue any unseen orders
    for (const o of pendingWebsite) {
      if (!alertQueueRef.current.includes(o.id) && o.id !== alertOrderId) {
        alertQueueRef.current.push(o.id);
      }
    }

    // Start next alert if none active
    if (!alertOrderId && alertQueueRef.current.length > 0) {
      startAlert(alertQueueRef.current[0]);
    }
  }, [alertOrderId, filtered, loading, soundEnabled]);

  // Stop alert sound as soon as the alerting order is accepted/handled (even if from another device).
  useEffect(() => {
    if (!alertOrderId) return;
    const o = orders.find((x) => x.id === alertOrderId);
    // If it disappeared, or it no longer needs a decision, stop the alert immediately.
    const needsDecision =
      !!o && isWebsiteOrder(o) && normalizeStatus(o.status) === 'received' && !o.accepted_at;
    if (!needsDecision) {
      alertQueueRef.current = alertQueueRef.current.filter((id) => id !== alertOrderId);
      stopAlert();
    }
  }, [alertOrderId, orders]);

  async function kitchenAccept(orderId: string) {
    const prep = prepMinutesByOrderId[orderId];
    if (!prep || prep <= 0) {
      setError('Select a prep time before accepting.');
      return;
    }
    setError(null);
    setBusyId(orderId);
    try {
      await apiPost(`/orders/${encodeURIComponent(orderId)}/kitchen/accept`, { prepTimeMinutes: prep });
      // Stop alerting this order
      alertQueueRef.current = alertQueueRef.current.filter((id) => id !== orderId);
      if (alertOrderId === orderId) stopAlert();
      await refresh();
    } catch (e: any) {
      setError(e?.message || 'Failed to accept order');
    } finally {
      setBusyId(null);
    }
  }

  async function kitchenDecline(orderId: string) {
    setError(null);
    setBusyId(orderId);
    try {
      await apiPost(`/orders/${encodeURIComponent(orderId)}/kitchen/decline`, {});
      alertQueueRef.current = alertQueueRef.current.filter((id) => id !== orderId);
      if (alertOrderId === orderId) stopAlert();
      await refresh();
    } catch (e: any) {
      setError(e?.message || 'Failed to decline order');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="min-h-screen bg-white text-black font-sans">
      <Head>
        <title>Kitchen Display • Servio</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
      </Head>

      {/* Print-only receipt (duplicate copies) */}
      <div id="print-root" className="print-only">
        {receiptHtml ? <PrintReceipt receiptHtml={receiptHtml} copies={printCopies} paperWidth={paperWidth} /> : null}
      </div>

      {/* Header */}
      <div className="no-print sticky top-0 z-20 bg-black text-white px-6 py-4 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-white rounded-lg p-1.5">
              <img
                src="/images/servio_icon_tight.png"
                alt="Servio"
                className="h-9 w-9"
              />
            </div>
            <div className="bg-white text-black font-black px-3 py-1 rounded text-xl italic">SERVIO</div>
          </div>
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
            type="button"
            onClick={() => (window.location.href = '/tablet/settings')}
            className="bg-white/10 hover:bg-white/20 p-3 rounded-full transition-colors"
            title="Tablet settings"
          >
            <Settings2 className="h-6 w-6" />
          </button>
          <button
            type="button"
            onClick={() => {
              const next = !autoPrintEnabled;
              setAutoPrintEnabled(next);
              window.localStorage.setItem('servio_auto_print_enabled', String(next));
            }}
            className={clsx(
              'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-black uppercase tracking-widest transition-colors',
              autoPrintEnabled ? 'bg-blue-600 hover:bg-blue-700' : 'bg-white/10 hover:bg-white/20'
            )}
            title="Toggle auto-print"
          >
            AUTO PRINT
          </button>
          <button 
            onClick={refresh}
            className="bg-white/10 hover:bg-white/20 p-3 rounded-full transition-colors"
          >
            <RefreshCcw className={clsx("h-6 w-6", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      <div className="no-print p-4 sm:p-6">
        {error ? (
          <div className="mb-4 rounded-2xl border-2 border-servio-orange-300 bg-servio-orange-50 px-5 py-3 text-sm font-bold text-servio-orange-900">
            {error}
          </div>
        ) : null}

        {filtered.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center py-32 text-slate-400">
            <CheckCircle2 className="h-24 w-24 mb-6 opacity-20" />
            <h2 className="text-3xl font-bold">ALL CLEAR</h2>
            <p className="text-xl mt-2 font-medium uppercase tracking-widest">No active orders</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((o) => {
              const status = normalizeStatus(o.status);
              const isNew = status === 'received';
              const isPreparing = status === 'preparing';
              const isReady = status === 'ready';
              const timeStr = formatTimeAgo(o.created_at, now);
              const isExpanded = expandedOrderId === o.id;
              const website = isWebsiteOrder(o);
              const needsDecision = website && isNew && !o.accepted_at;
              const isAlerting = alertOrderId === o.id && alertUntilMs !== null;
              const alertRemaining = isAlerting ? Math.max(0, alertUntilMs! - Date.now()) : 0;

              return (
                <div 
                  key={o.id} 
                  className={clsx(
                    "flex flex-col rounded-[2rem] border-[4px] bg-white overflow-hidden shadow-2xl transition-all",
                    needsDecision
                      ? "border-servio-orange-500 ring-8 ring-servio-orange-100"
                      : isPreparing
                        ? "border-servio-green-600"
                        : isNew
                          ? "border-blue-600 ring-8 ring-blue-50"
                          : "border-black",
                    isReady && "opacity-50 grayscale"
                  )}
                >
                  {/* Card Header */}
                  <div 
                    className={clsx(
                      "px-6 py-4 flex items-center justify-between border-b-[4px] cursor-pointer",
                      needsDecision
                        ? "bg-servio-orange-600 text-white border-servio-orange-600"
                        : isPreparing
                          ? "bg-servio-green-700 text-white border-servio-green-800"
                          : isNew
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-black text-white border-black"
                    )}
                    onClick={() => setExpandedOrderId(isExpanded ? null : o.id)}
                  >
                    <div className="flex flex-col">
                      <span className="text-xs font-black uppercase tracking-widest opacity-70">Order</span>
                      <span className="text-4xl font-black font-mono leading-none tracking-tighter">
                        #{o.external_id ? o.external_id.slice(-4).toUpperCase() : o.id.slice(-4).toUpperCase()}
                      </span>
                      <span className="mt-1 text-xs font-black uppercase tracking-widest opacity-80">
                        {(o.customer_name || 'Guest').toString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          printOrder(o.id);
                        }}
                        className={clsx(
                          'rounded-xl px-3 py-2 bg-white/10 hover:bg-white/20 transition-colors',
                          printingOrderId === o.id && 'opacity-60'
                        )}
                        title="Print receipt"
                      >
                        <Printer className={clsx('h-6 w-6', printingOrderId === o.id && 'animate-pulse')} />
                      </button>
                    <div className="text-right">
                      <span className="text-xs font-black uppercase tracking-widest opacity-70">Elapsed</span>
                      <div className={clsx(
                        "text-3xl font-black tabular-nums leading-none",
                        timeStr.includes('m') && parseInt(timeStr) > 20 ? "text-red-400" : "text-white"
                      )}>
                        {timeStr}
                      </div>
                    </div>
                    <ChevronDown className={clsx(
                      "h-6 w-6 transition-transform ml-2",
                      isExpanded && "rotate-180"
                    )} />
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
                    {needsDecision ? (
                      <div className="mt-2 flex items-center justify-between gap-3">
                        <div className="text-xs font-black uppercase tracking-widest text-servio-orange-700">
                          Website order needs acceptance
                        </div>
                        {isAlerting ? (
                          <div className="rounded-full bg-servio-orange-600 px-3 py-1 text-xs font-black text-white">
                            ALERT {formatCountdown(alertRemaining)}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
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
                          {isExpanded && it.unit_price && (
                            <div className="text-sm text-slate-600 mt-1">
                              ${(it.unit_price || it.price || 0).toFixed(2)} each
                            </div>
                          )}
                        </div>
                        {isExpanded && (
                          <div className="text-lg font-black text-black">
                            ${((it.unit_price || it.price || 0) * (it.quantity || 1)).toFixed(2)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="px-6 py-4 bg-slate-50 border-t-[2px] border-slate-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                          <User className="h-4 w-4" />
                          {o.customer_name || 'Guest'}
                        </div>
                        <div className="text-sm font-bold text-slate-700">
                          Order ID: {o.external_id || shortId(o.id)}
                        </div>
                      </div>
                      {o.customer_phone ? (
                        <div className="text-sm font-bold text-slate-700">
                          Phone: {o.customer_phone}
                        </div>
                      ) : null}
                      {o.order_type ? (
                        <div className="text-sm font-bold text-slate-700">
                          Type: {o.order_type}
                        </div>
                      ) : null}
                      <div className="flex items-center justify-between pt-3 border-t border-slate-300">
                        <div className="text-lg font-black text-black">TOTAL</div>
                        <div className="text-2xl font-black text-black">
                          ${(o.total_amount || 0).toFixed(2)}
                        </div>
                      </div>
                      <div className="text-xs text-slate-500">
                        Created: {o.created_at ? new Date(o.created_at).toLocaleString() : '--'}
                      </div>
                    </div>
                  )}

                  {/* Action Button */}
                  <div className="p-4 bg-slate-100 mt-auto">
                    {needsDecision ? (
                      <div className="space-y-3">
                        <div className="text-xs font-black uppercase tracking-widest text-slate-700">
                          Prep time
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {[5, 10, 15, 20, 30, 45].map((m) => (
                            <button
                              key={m}
                              type="button"
                              onClick={() =>
                                setPrepMinutesByOrderId((prev) => ({
                                  ...prev,
                                  [o.id]: m
                                }))
                              }
                              className={clsx(
                                'rounded-2xl px-4 py-3 text-base font-black border-2 transition-colors',
                                (prepMinutesByOrderId[o.id] ?? 0) === m
                                  ? 'bg-black text-white border-black'
                                  : 'bg-white text-black border-slate-300 hover:bg-slate-50'
                              )}
                            >
                              {m}m
                            </button>
                          ))}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            disabled={busyId === o.id}
                            onClick={() => kitchenDecline(o.id)}
                            className="h-16 rounded-2xl bg-slate-300 hover:bg-slate-400 text-slate-900 font-black uppercase tracking-widest disabled:opacity-50"
                          >
                            Decline
                          </button>
                          <button
                            type="button"
                            disabled={busyId === o.id}
                            onClick={() => kitchenAccept(o.id)}
                            className="h-16 rounded-2xl bg-servio-green-600 hover:bg-servio-green-700 text-white font-black uppercase tracking-widest disabled:opacity-50"
                          >
                            Accept
                          </button>
                        </div>
                      </div>
                    ) : null}

                    {isNew && !needsDecision && (
                      <button
                        disabled={busyId === o.id}
                        onClick={() => setStatus(o.id, 'preparing')}
                        className="w-full bg-blue-600 hover:bg-blue-700 active:scale-95 text-white py-8 rounded-[1.5rem] flex items-center justify-center gap-4 transition-all shadow-xl disabled:opacity-50"
                      >
                        <span className="text-4xl font-black uppercase tracking-tighter">START PREP</span>
                        <ArrowRight className="h-10 w-10 stroke-[4px]" />
                      </button>
                    )}
                    {isPreparing && (
                      <button
                        disabled={busyId === o.id}
                        onClick={() => setStatus(o.id, 'ready')}
                        className="w-full bg-black hover:bg-slate-900 active:scale-95 text-white py-8 rounded-[1.5rem] flex items-center justify-center gap-4 transition-all shadow-xl disabled:opacity-50"
                      >
                        <span className="text-4xl font-black uppercase tracking-tighter">MARK READY</span>
                        <CheckCircle2 className="h-10 w-10 stroke-[4px]" />
                      </button>
                    )}
                    {isReady && (
                      <button
                        disabled={busyId === o.id}
                        onClick={() => setStatus(o.id, 'completed')}
                        className="w-full bg-slate-400 hover:bg-slate-500 active:scale-95 text-white py-6 rounded-[1.5rem] flex items-center justify-center gap-4 transition-all disabled:opacity-50"
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
