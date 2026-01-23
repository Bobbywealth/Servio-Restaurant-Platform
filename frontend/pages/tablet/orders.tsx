import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import clsx from 'clsx';
import { CheckCircle2, Printer, RefreshCcw, Settings2 } from 'lucide-react';
import { useSocket } from '../../lib/socket';
import { PrintReceipt } from '../../components/PrintReceipt';
import type { ReceiptPaperWidth, ReceiptOrder, ReceiptRestaurant } from '../../utils/receiptGenerator';
import { generateReceiptHtml } from '../../utils/receiptGenerator';
import { api } from '../../lib/api';
import { generateEscPosReceipt, printViaRawBT, type ReceiptData } from '../../utils/escpos';
import { useUser } from '../../contexts/UserContext';
import { TabletShell } from '../../components/Layout/TabletShell';

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

async function apiGet<T>(path: string): Promise<T> {
  const res = await api.get(path);
  return res.data as T;
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await api.post(path, body);
  return res.data as T;
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

// Audio handling with browser autoplay unlock
let audioUnlocked = false;
let notificationAudio: HTMLAudioElement | null = null;

function initAudio() {
  if (typeof window === 'undefined') return;
  
  // Try to load custom notification sound
  try {
    notificationAudio = new Audio('/sounds/order-alert.mp3');
    notificationAudio.preload = 'auto';
    notificationAudio.volume = 1.0;
  } catch {
    // Fallback to synthesized beep
  }
}

function unlockAudio() {
  if (audioUnlocked) return;
  audioUnlocked = true;
  
  // Play silent audio to unlock
  try {
    const AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (AudioContext) {
      const ctx = new AudioContext();
      const buffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
      ctx.resume?.();
    }
    
    // Also try to load the audio element
    if (notificationAudio) {
      notificationAudio.load();
    }
  } catch {
    // ignore
  }
}

function beep() {
  // Louder, more noticeable synthesized beep
  try {
    const AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'square';
    o.frequency.value = 1000; // Higher pitch
    g.gain.value = 0.5; // Louder
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    window.setTimeout(() => {
      o.stop();
      ctx.close?.().catch(() => {});
    }, 200); // Longer duration
  } catch {
    // ignore
  }
}

function playAlarmTone() {
  // Try custom sound first, fallback to synthesized beep
  if (notificationAudio) {
    notificationAudio.currentTime = 0;
    notificationAudio.play().catch(() => {
      // Fallback to beep if audio file fails
      beepSequence();
    });
  } else {
    beepSequence();
  }
}

function beepSequence() {
  // Play a more noticeable beep pattern
  beep();
  window.setTimeout(() => beep(), 300);
  window.setTimeout(() => beep(), 600);
}


export default function TabletOrdersPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useUser();
  const socket = useSocket();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [now, setNow] = useState<number | null>(null);
  const [autoPrintEnabled, setAutoPrintEnabled] = useState<boolean>(false);
  const [paperWidth, setPaperWidth] = useState<ReceiptPaperWidth>('80mm');
  const [printMode, setPrintMode] = useState<'bluetooth' | 'system' | 'bridge' | 'rawbt'>('system');
  const [lastPrintResult, setLastPrintResult] = useState<{ status: 'success' | 'error'; message?: string } | null>(null);
  const [autoPrintPendingId, setAutoPrintPendingId] = useState<string | null>(null);
  const lastAutoPromptedId = useRef<string | null>(null);
  const alarmIntervalRef = useRef<number | null>(null);
  const [prepModalOrder, setPrepModalOrder] = useState<Order | null>(null);
  const [prepMinutes, setPrepMinutes] = useState<number>(15);
  const [printingOrderId, setPrintingOrderId] = useState<string | null>(null);
  const [printedOrders, setPrintedOrders] = useState<Set<string>>(() => new Set());
  const printedOrdersRef = useRef<Set<string>>(new Set());
  const hasInitializedPrintedRef = useRef(false);
  const [restaurantProfile, setRestaurantProfile] = useState<ReceiptRestaurant | null>(null);
  const [receiptHtml, setReceiptHtml] = useState<string | null>(null);
  const lastRefreshAt = useRef<number>(0);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showPrintPrompt, setShowPrintPrompt] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      const next = router.asPath || '/tablet/orders';
      router.replace(`/tablet/login?next=${encodeURIComponent(next)}`);
    }
  }, [authLoading, user, router]);

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <p className="text-sm text-gray-300">Redirecting to login…</p>
      </div>
    );
  }

  // Initialize audio on mount
  useEffect(() => {
    initAudio();
    
    // Unlock audio on any user interaction
    const handleInteraction = () => {
      unlockAudio();
      // Remove listeners after first interaction
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('touchstart', handleInteraction);
    };
    
    document.addEventListener('click', handleInteraction);
    document.addEventListener('touchstart', handleInteraction);
    
    return () => {
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('touchstart', handleInteraction);
    };
  }, []);

  useEffect(() => {
    const storedAuto = typeof window !== 'undefined' ? window.localStorage.getItem('servio_auto_print_enabled') : null;
    const auto = storedAuto === 'true';
    setAutoPrintEnabled(auto);

    const storedPaper = typeof window !== 'undefined' ? window.localStorage.getItem('servio_thermal_paper_width') : null;
    const paper: ReceiptPaperWidth = storedPaper === '58mm' ? '58mm' : '80mm';
    setPaperWidth(paper);

    const storedMode = typeof window !== 'undefined' ? window.localStorage.getItem('servio_print_mode') : null;
    if (storedMode === 'bluetooth' || storedMode === 'bridge' || storedMode === 'system' || storedMode === 'rawbt') {
      setPrintMode(storedMode);
    }

    const storedResult = typeof window !== 'undefined' ? window.localStorage.getItem('servio_last_print_result') : null;
    if (storedResult) {
      try {
        setLastPrintResult(JSON.parse(storedResult));
      } catch {
        // ignore
      }
    }
  }, []);

  useEffect(() => {
    const loadPrinterSettings = async () => {
      try {
        const resp = await apiGet<{ success: boolean; data?: any }>('/api/restaurant/profile');
        const settings = resp?.data?.settings || {};
        if (settings.printer_auto_print_enabled !== undefined) {
          const enabled = Boolean(settings.printer_auto_print_enabled);
          setAutoPrintEnabled(enabled);
          window.localStorage.setItem('servio_auto_print_enabled', enabled ? 'true' : 'false');
        }
        if (settings.printer_paper_width === '58mm' || settings.printer_paper_width === '80mm') {
          const width = settings.printer_paper_width as ReceiptPaperWidth;
          setPaperWidth(width);
          window.localStorage.setItem('servio_thermal_paper_width', width);
        }
        if (['system', 'rawbt', 'bluetooth', 'bridge'].includes(settings.printer_mode)) {
          const mode = settings.printer_mode as 'bluetooth' | 'system' | 'bridge' | 'rawbt';
          setPrintMode(mode);
          window.localStorage.setItem('servio_print_mode', mode);
        }
      } catch (e) {
        // ignore printer settings load failures
      }
    };

    loadPrinterSettings();
  }, []);

  async function refresh() {
    try {
      if (typeof window !== 'undefined' && !window.localStorage.getItem('servio_access_token')) {
        setLoading(false);
        return;
      }
      const json = await apiGet<OrdersResponse>('/api/orders?limit=50&offset=0');
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
      if (typeof window !== 'undefined' && !window.localStorage.getItem('servio_access_token')) {
        return;
      }
      const json = await apiGet<{ success: boolean; data?: any }>('/api/restaurant/profile');
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
    // Prevent duplicate prints
    if (printingOrderId) {
      console.log('Print already in progress, ignoring');
      return;
    }
    
    setPrintingOrderId(orderId);
    try {
      // Fetch order details
      const full = await apiGet<{ success: boolean; data?: any }>(`/api/orders/${encodeURIComponent(orderId)}`);
      const order = (full?.data || full) as ReceiptOrder;

      // Ensure we have restaurant info
      let restaurant = restaurantProfile;
      if (!restaurant) {
        await fetchRestaurantProfile();
        restaurant = restaurantProfile;
      }

      if (printMode === 'rawbt') {
        // RawBT auto-print mode - no dialogs!
        const items = (order.items || []).map((it: any) => ({
          name: it.name || 'Item',
          quantity: it.quantity || 1,
          price: it.unit_price || it.price || 0,
          modifiers: it.modifiers || []
        }));

        const orderAny = order as any;
        const receiptData: ReceiptData = {
          restaurantName: restaurant?.name || undefined,
          restaurantPhone: restaurant?.phone || undefined,
          restaurantAddress: restaurant?.address || undefined,
          orderId: order.id,
          orderNumber: orderAny.external_id?.slice(-4).toUpperCase() || order.id.slice(-4).toUpperCase(),
          customerName: order.customer_name || undefined,
          customerPhone: orderAny.customer_phone || undefined,
          orderType: orderAny.order_type || undefined,
          items,
          subtotal: orderAny.subtotal || undefined,
          tax: orderAny.tax || undefined,
          total: order.total_amount || 0,
          pickupTime: orderAny.pickup_time || undefined,
          createdAt: order.created_at || undefined,
          specialInstructions: orderAny.special_instructions || undefined
        };

        const escPosData = generateEscPosReceipt(receiptData, paperWidth);
        const success = printViaRawBT(escPosData);

        if (success) {
          if (opts?.markAsPrinted !== false) {
            setPrintedOrders((prev) => {
              const next = new Set(prev);
              next.add(orderId);
              printedOrdersRef.current = next;
              return next;
            });
          }
          setLastPrintResult({ status: 'success' });
          window.localStorage.setItem('servio_last_print_result', JSON.stringify({ status: 'success' }));
        } else {
          setLastPrintResult({ status: 'error', message: 'RawBT not available. Is the app installed?' });
          window.localStorage.setItem('servio_last_print_result', JSON.stringify({ status: 'error', message: 'RawBT not available' }));
        }
        return;
      }

      if (printMode === 'system') {
        // System print mode - uses Android print dialog
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
        setLastPrintResult({ status: 'success' });
        window.localStorage.setItem('servio_last_print_result', JSON.stringify({ status: 'success' }));
        return;
      }

      // Bluetooth or Bridge mode - not fully implemented
      const message = printMode === 'bluetooth'
        ? 'WebBluetooth mode requires BLE printer. Try RawBT or System Print instead.'
        : 'Print Bridge mode is not configured';
      setLastPrintResult({ status: 'error', message });
      window.localStorage.setItem('servio_last_print_result', JSON.stringify({ status: 'error', message }));

    } catch (e) {
      console.error('Print failed', e);
      const message = e instanceof Error ? e.message : 'Print failed';
      setLastPrintResult({ status: 'error', message });
      window.localStorage.setItem('servio_last_print_result', JSON.stringify({ status: 'error', message }));
    } finally {
      setPrintingOrderId(null);
      // clear receipt after print dialog is opened; also clear onafterprint for some browsers
      window.setTimeout(() => setReceiptHtml(null), 250);
    }
  }

  async function printTestReceipt() {
    if (printingOrderId) return;
    setPrintingOrderId('test');

    try {
      let restaurant = restaurantProfile;
      if (!restaurant) {
        await fetchRestaurantProfile();
        restaurant = restaurantProfile;
      }

      const now = new Date();
      const testOrder: ReceiptOrder = {
        id: `test_${now.getTime()}`,
        external_id: 'TEST',
        channel: 'POS',
        status: 'received',
        customer_name: 'Test Customer',
        customer_phone: '(555) 123-4567',
        order_type: 'pickup',
        created_at: now.toISOString(),
        items: [
          { name: 'Test Burger', quantity: 1, price: 9.99, modifiers: ['No onions', 'Extra cheese'] },
          { name: 'Fries', quantity: 1, price: 3.49 },
          { name: 'Soda', quantity: 2, price: 1.75 }
        ],
        special_instructions: 'Test print from dashboard'
      };

      if (printMode === 'rawbt') {
        const receiptData: ReceiptData = {
          restaurantName: restaurant?.name || undefined,
          restaurantPhone: restaurant?.phone || undefined,
          restaurantAddress: restaurant?.address || undefined,
          orderId: testOrder.id,
          orderNumber: testOrder.external_id || testOrder.id.slice(-4).toUpperCase(),
          customerName: testOrder.customer_name || undefined,
          customerPhone: testOrder.customer_phone || undefined,
          orderType: testOrder.order_type || undefined,
          items: (testOrder.items || []).map((it: any) => ({
            name: it.name,
            quantity: it.quantity || 1,
            price: it.unit_price || it.price || 0,
            modifiers: it.modifiers || []
          })),
          total: (testOrder.items || []).reduce((sum: number, it: any) => {
            const qty = it.quantity || 1;
            const price = it.unit_price || it.price || 0;
            return sum + qty * price;
          }, 0),
          createdAt: testOrder.created_at || undefined,
          specialInstructions: testOrder.special_instructions || undefined
        };

        const escPosData = generateEscPosReceipt(receiptData, paperWidth);
        const success = printViaRawBT(escPosData);
        if (success) {
          setLastPrintResult({ status: 'success' });
          window.localStorage.setItem('servio_last_print_result', JSON.stringify({ status: 'success' }));
        } else {
          setLastPrintResult({ status: 'error', message: 'RawBT not available. Is the app installed?' });
          window.localStorage.setItem('servio_last_print_result', JSON.stringify({ status: 'error', message: 'RawBT not available' }));
        }
        return;
      }

      if (printMode === 'system') {
        const html = generateReceiptHtml({
          restaurant: restaurant || null,
          order: testOrder,
          paperWidth
        });

        setReceiptHtml(html);
        await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        window.print();
        setLastPrintResult({ status: 'success' });
        window.localStorage.setItem('servio_last_print_result', JSON.stringify({ status: 'success' }));
        return;
      }

      const message = printMode === 'bluetooth'
        ? 'WebBluetooth mode requires BLE printer. Try RawBT or System Print instead.'
        : 'Print Bridge mode is not configured';
      setLastPrintResult({ status: 'error', message });
      window.localStorage.setItem('servio_last_print_result', JSON.stringify({ status: 'error', message }));
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Test print failed';
      setLastPrintResult({ status: 'error', message });
      window.localStorage.setItem('servio_last_print_result', JSON.stringify({ status: 'error', message }));
    } finally {
      setPrintingOrderId(null);
      window.setTimeout(() => setReceiptHtml(null), 250);
    }
  }

  async function setStatus(orderId: string, nextStatus: string) {
    setBusyId(orderId);
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: nextStatus } : o)));
    setSelectedOrder((prev) => (prev?.id === orderId ? { ...prev, status: nextStatus } : prev));
    try {
      await apiPost(`/api/orders/${encodeURIComponent(orderId)}/status`, { status: nextStatus });
      if (socket) {
        socket.emit('order:status_changed', { orderId, status: nextStatus, timestamp: new Date() });
      }
    } catch (e) {
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function acceptOrder(order: Order) {
    setBusyId(order.id);
    try {
      // Set status to preparing
      await apiPost(`/api/orders/${encodeURIComponent(order.id)}/status`, { status: 'preparing' });
      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: 'preparing' } : o)));
      setSelectedOrder((prev) => (prev?.id === order.id ? { ...prev, status: 'preparing' } : prev));
      if (socket) {
        socket.emit('order:status_changed', { orderId: order.id, status: 'preparing', timestamp: new Date() });
      }
      
      // Handle printing based on auto-print setting
      if (autoPrintEnabled) {
        // Auto-print is ON - print automatically
        await printOrder(order.id, { markAsPrinted: true });
      } else {
        // Auto-print is OFF - ask if they want to print
        setShowPrintPrompt(order.id);
      }
    } catch (e) {
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function declineOrder(order: Order) {
    setBusyId(order.id);
    setSelectedOrder(null);
    try {
      await apiPost(`/api/orders/${encodeURIComponent(order.id)}/status`, { status: 'cancelled' });
      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: 'cancelled' } : o)));
      if (socket) {
        socket.emit('order:status_changed', { orderId: order.id, status: 'cancelled', timestamp: new Date() });
      }
    } catch (e) {
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function setPrepTime(orderId: string, minutes: number) {
    setBusyId(orderId);
    try {
      const resp = await apiPost<{ success: boolean; data?: { pickupTime?: string } }>(
        `/api/orders/${encodeURIComponent(orderId)}/prep-time`,
        { prepMinutes: minutes }
      );
      const pickupTime = resp?.data?.pickupTime;
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: 'preparing', pickup_time: pickupTime } : o))
      );
      if (socket) {
        socket.emit('order:status_changed', { orderId, status: 'preparing', timestamp: new Date() });
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

    const handlePrinterTest = () => {
      printTestReceipt();
    };

    socket.on('notifications.new', handleNewNotification);
    socket.on('printer.test', handlePrinterTest);
    return () => {
      socket.off('notifications.new', handleNewNotification);
      socket.off('printer.test', handlePrinterTest);
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

  const receivedOrders = useMemo(() => {
    return activeOrders.filter((o) => normalizeStatus(o.status) === 'received');
  }, [activeOrders]);

  const filtered = activeOrders;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (receivedOrders.length > 0) {
      if (alarmIntervalRef.current === null) {
        playAlarmTone();
        alarmIntervalRef.current = window.setInterval(() => {
          playAlarmTone();
        }, 2500);
      }
    } else if (alarmIntervalRef.current !== null) {
      window.clearInterval(alarmIntervalRef.current);
      alarmIntervalRef.current = null;
    }
  }, [receivedOrders.length]);

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

    const newest = toAutoPrint[0];
    if (autoPrintPendingId || lastAutoPromptedId.current === newest.id) return;
    lastAutoPromptedId.current = newest.id;
    setAutoPrintPendingId(newest.id);
  }, [autoPrintEnabled, filtered, loading, autoPrintPendingId]);

  return (
    <TabletShell
      title="Orders"
      rightActions={
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={refresh}
            className="btn-icon"
            title="Refresh"
            aria-label="Refresh orders"
          >
            <RefreshCcw className={clsx('h-5 w-5', loading && 'animate-spin')} />
          </button>
          <button
            type="button"
            onClick={() => router.push('/tablet/settings')}
            className="btn-icon"
            title="Settings"
            aria-label="Open settings"
          >
            <Settings2 className="h-5 w-5" />
          </button>
        </div>
      }
    >
      {/* Print-only receipt (duplicate copies) */}
      <div id="print-root" className="print-only">
        {receiptHtml ? <PrintReceipt receiptHtml={receiptHtml} copies={2} paperWidth={paperWidth} /> : null}
      </div>

      {/* Featured / priority card */}
      <div className="no-print mb-4">
        <div className="rounded-3xl bg-white shadow-sm border border-slate-200 p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-2xl font-semibold text-slate-900">Order Feed</div>
              <div className="mt-1 text-sm text-slate-600">
                {filtered.length} active • {receivedOrders.length} new •{' '}
                {now ? new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={clsx(
                  'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset',
                  receivedOrders.length > 0
                    ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                    : 'bg-slate-100 text-slate-700 ring-slate-200'
                )}
              >
                {receivedOrders.length > 0 ? 'Live' : 'Quiet'}
              </span>
              <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold bg-primary-50 text-primary-700 ring-1 ring-inset ring-primary-200">
                Thumb-first
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick actions row */}
      <div className="no-print mb-5">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-semibold text-slate-700">Quick Actions</div>
        </div>
        <div className="flex gap-3 overflow-x-auto mobile-scrolling pb-1">
          <button
            type="button"
            onClick={refresh}
            className="tablet-pressable flex-shrink-0 rounded-2xl bg-white border border-slate-200 shadow-sm px-4 py-3 text-left min-w-[220px] active:scale-[0.99] transition-transform"
          >
            <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Action</div>
            <div className="mt-1 font-semibold text-slate-900">Refresh orders</div>
            <div className="mt-1 text-sm text-slate-600">Pull newest tickets into the feed.</div>
          </button>
          <button
            type="button"
            onClick={() => router.push('/tablet/settings')}
            className="tablet-pressable flex-shrink-0 rounded-2xl bg-white border border-slate-200 shadow-sm px-4 py-3 text-left min-w-[220px] active:scale-[0.99] transition-transform"
          >
            <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Action</div>
            <div className="mt-1 font-semibold text-slate-900">Printer settings</div>
            <div className="mt-1 text-sm text-slate-600">Auto-print, mode, paper width.</div>
          </button>
          <button
            type="button"
            onClick={() => router.push('/tablet/print/test')}
            className="tablet-pressable flex-shrink-0 rounded-2xl bg-white border border-slate-200 shadow-sm px-4 py-3 text-left min-w-[220px] active:scale-[0.99] transition-transform"
          >
            <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Action</div>
            <div className="mt-1 font-semibold text-slate-900">Test print</div>
            <div className="mt-1 text-sm text-slate-600">Print a sample receipt.</div>
          </button>
        </div>
      </div>

      {/* Main feed */}
      <div className="no-print">
        {loading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="rounded-3xl bg-white border border-slate-200 shadow-sm p-5">
                <div className="h-5 w-24 rounded-full bg-slate-100" />
                <div className="mt-3 h-8 w-40 rounded-xl bg-slate-100" />
                <div className="mt-4 h-4 w-52 rounded-full bg-slate-100" />
                <div className="mt-2 h-4 w-36 rounded-full bg-slate-100" />
                <div className="mt-6 h-11 w-full rounded-2xl bg-slate-100" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-3xl bg-white border border-slate-200 shadow-sm p-10 flex items-center justify-between">
            <div>
              <div className="text-2xl font-semibold text-slate-900">All clear</div>
              <div className="mt-1 text-slate-600">No active orders right now.</div>
            </div>
            <CheckCircle2 className="h-14 w-14 text-slate-300" />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((o) => {
              const status = normalizeStatus(o.status);
              const isNew = status === 'received';
              const isPreparing = status === 'preparing';
              const isReady = status === 'ready';
              const timeStr = formatTimeAgo(o.created_at, now);
              const itemCount = (o.items || []).reduce((sum, it) => sum + (it.quantity || 1), 0);
              const orderNumber = o.external_id ? o.external_id.slice(-4).toUpperCase() : o.id.slice(-4).toUpperCase();

              const statusLabel = isNew ? 'New' : isPreparing ? 'Preparing' : isReady ? 'Ready' : status;
              const statusClass = isNew
                ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                : isPreparing
                  ? 'bg-amber-50 text-amber-700 ring-amber-200'
                  : 'bg-slate-100 text-slate-700 ring-slate-200';

              return (
                <div
                  key={o.id}
                  onClick={() => setSelectedOrder(o)}
                  className={clsx(
                    'tablet-pressable rounded-3xl bg-white border shadow-sm p-5 cursor-pointer transition-all active:scale-[0.99]',
                    isNew ? 'border-emerald-200 ring-2 ring-emerald-100' : 'border-slate-200',
                    isReady && 'opacity-70'
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Order</div>
                      <div className="mt-1 text-2xl font-semibold text-slate-900">#{orderNumber}</div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={clsx('inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset', statusClass)}>
                        {statusLabel}
                      </span>
                      <div className="text-sm font-medium text-slate-500 tabular-nums">{timeStr}</div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-lg font-semibold text-slate-900 truncate">{(o.customer_name || 'Guest').toString()}</div>
                      <div className="mt-1 text-sm text-slate-600">
                        {itemCount} item{itemCount !== 1 ? 's' : ''} • {(o.channel || 'POS').toString()}
                      </div>
                    </div>
                    <div className="text-xl font-semibold text-slate-900">{formatMoney(o.total_amount)}</div>
                  </div>

                  <div className="mt-5 rounded-2xl bg-slate-50 border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700">
                    {isNew ? 'Tap to view & accept' : isPreparing ? 'Tap for details' : 'Tap to complete'}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Order Detail Modal - Fullscreen for tablet clarity */}
      {selectedOrder && (
        <div className="no-print fixed inset-0 z-50 flex items-stretch bg-slate-900/60 backdrop-blur-sm">
          {/* Fullscreen order details */}
          <div className="flex-1 w-full h-full overflow-hidden">
            <div className="bg-white w-full h-full overflow-hidden flex flex-col">
              {/* Modal header */}
              <div className="px-4 py-3 flex items-center justify-between flex-shrink-0 border-b border-slate-200">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="text-3xl font-semibold tabular-nums text-slate-900">
                    #{selectedOrder.external_id ? selectedOrder.external_id.slice(-4).toUpperCase() : selectedOrder.id.slice(-4).toUpperCase()}
                  </div>
                  <span className={clsx(
                    'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset',
                    normalizeStatus(selectedOrder.status) === 'received'
                      ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                      : normalizeStatus(selectedOrder.status) === 'preparing'
                        ? 'bg-amber-50 text-amber-700 ring-amber-200'
                        : 'bg-slate-100 text-slate-700 ring-slate-200'
                  )}>
                    {normalizeStatus(selectedOrder.status)}
                  </span>
                </div>
                <button onClick={() => setSelectedOrder(null)} className="btn-icon" aria-label="Close order details">
                  <span className="text-2xl leading-none">×</span>
                </button>
              </div>

              {/* Customer Info - compact */}
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-semibold text-slate-900">{selectedOrder.customer_name || 'Guest'}</div>
                    {selectedOrder.customer_phone && (
                      <div className="text-base text-slate-600">{selectedOrder.customer_phone}</div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold bg-white text-slate-700 ring-1 ring-inset ring-slate-200">
                      {selectedOrder.channel || 'POS'}
                    </div>
                    {selectedOrder.order_type && (
                      <div className="text-sm text-slate-600 mt-1">{selectedOrder.order_type}</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Items List - SCROLLABLE */}
              <div className="flex-1 overflow-y-auto px-4 py-3 min-h-0">
                <div className="text-xs uppercase tracking-[0.16em] text-slate-500 mb-2">Items</div>
                <div className="space-y-3">
                  {(selectedOrder.items || []).map((it, idx) => (
                    <div key={idx} className="flex items-center gap-3 py-2 border-b border-slate-200 last:border-0">
                      <div className="flex-shrink-0 bg-slate-900 text-white w-10 h-10 rounded-2xl flex items-center justify-center text-lg font-semibold">
                        {it.quantity || 1}
                      </div>
                      <div className="flex-grow min-w-0">
                        <div className="text-lg font-semibold leading-tight text-slate-900 break-words truncate">
                          {it.name}
                        </div>
                      </div>
                      <div className="text-lg font-semibold text-slate-900 flex-shrink-0 tabular-nums">
                        {formatMoney((it.unit_price || it.price || 0) * (it.quantity || 1))}
                      </div>
                    </div>
                  ))}
                </div>
                
                {selectedOrder.special_instructions && (
                  <div className="mt-3 p-4 bg-amber-50 border border-amber-200 rounded-3xl">
                    <div className="text-xs font-semibold text-amber-700 uppercase tracking-[0.16em] mb-1">
                      Special instructions
                    </div>
                    <div className="text-base text-amber-900">{selectedOrder.special_instructions}</div>
                  </div>
                )}
              </div>

              {/* Total - compact */}
              <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-700 uppercase tracking-[0.14em]">Total</span>
                  <span className="text-2xl font-semibold text-slate-900 tabular-nums">{formatMoney(selectedOrder.total_amount)}</span>
                </div>
                {selectedOrder.pickup_time && (
                  <div className="text-sm text-slate-600 mt-1">
                    Pickup: {new Date(selectedOrder.pickup_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                )}
              </div>

            {/* Action Buttons - compact */}
            <div className="px-4 py-3 bg-white border-t-2 border-slate-200 flex-shrink-0">
              {normalizeStatus(selectedOrder.status) === 'received' && (
                <div className="flex gap-3">
                  <button
                    disabled={busyId === selectedOrder.id}
                    onClick={() => declineOrder(selectedOrder)}
                    className="flex-1 btn-danger py-4 rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <span className="text-lg font-semibold">Decline</span>
                  </button>
                  <button
                    disabled={busyId === selectedOrder.id}
                    onClick={() => acceptOrder(selectedOrder)}
                    className="flex-[2] btn-success py-4 rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <span className="text-lg font-semibold">Accept</span>
                    <CheckCircle2 className="h-6 w-6" />
                  </button>
                </div>
              )}
              {normalizeStatus(selectedOrder.status) === 'preparing' && (
                <div className="flex gap-3">
                  <button
                    onClick={() => printOrder(selectedOrder.id)}
                    disabled={printingOrderId === selectedOrder.id}
                    className="flex-1 btn-secondary py-4 rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Printer className="h-6 w-6" />
                    <span className="text-lg font-semibold">Print</span>
                  </button>
                  <button
                    disabled={busyId === selectedOrder.id}
                    onClick={() => {
                      setStatus(selectedOrder.id, 'ready');
                    }}
                    className="flex-[2] btn-primary py-4 rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <span className="text-lg font-semibold">Ready</span>
                    <CheckCircle2 className="h-6 w-6" />
                  </button>
                </div>
              )}
              {normalizeStatus(selectedOrder.status) === 'ready' && (
                <button
                  disabled={busyId === selectedOrder.id}
                  onClick={() => {
                    if (window.confirm('Mark this order as completed?')) {
                      setStatus(selectedOrder.id, 'completed');
                      setSelectedOrder(null);
                    }
                  }}
                  className="w-full btn-secondary py-4 rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <span className="text-lg font-semibold">Complete</span>
                </button>
              )}
            </div>
            </div>
          </div>
        </div>
      )}

      {/* Print Prompt Modal (when auto-print is OFF) */}
      {showPrintPrompt && (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-200 p-8 w-full max-w-md">
            <div className="text-center mb-6">
              <Printer className="h-16 w-16 mx-auto text-slate-400 mb-4" />
              <h3 className="text-2xl font-semibold mb-2">Print receipt?</h3>
              <p className="text-slate-600">Order accepted. Want to print now?</p>
            </div>
            <div className="flex gap-4">
              <button
                className="flex-1 btn-secondary py-4 rounded-2xl text-lg font-semibold"
                onClick={() => setShowPrintPrompt(null)}
              >
                Not now
              </button>
              <button
                className="flex-1 btn-primary py-4 rounded-2xl text-lg font-semibold"
                onClick={() => {
                  const orderId = showPrintPrompt;
                  setShowPrintPrompt(null);
                  printOrder(orderId, { markAsPrinted: true });
                }}
              >
                Yes, print
              </button>
            </div>
          </div>
        </div>
      )}

    </TabletShell>
  );
}
