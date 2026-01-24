import Head from 'next/head';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import clsx from 'clsx';
import { CheckCircle2, RefreshCcw, ChevronDown, Printer, Clock } from 'lucide-react';
import { useSocket } from '../../lib/socket';
import { PrintReceipt } from '../../components/PrintReceipt';
import { TabletSidebar } from '../../components/tablet/TabletSidebar';
import type { ReceiptPaperWidth, ReceiptOrder, ReceiptRestaurant } from '../../utils/receiptGenerator';
import { generateReceiptHtml } from '../../utils/receiptGenerator';
import { api } from '../../lib/api';
import { generateEscPosReceipt, printViaRawBT, type ReceiptData } from '../../utils/escpos';
import { useUser } from '../../contexts/UserContext';

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

type PendingAction =
  | { id: string; orderId: string; type: 'status'; payload: { status: string }; queuedAt: number }
  | { id: string; orderId: string; type: 'prep-time'; payload: { prepMinutes: number }; queuedAt: number };

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

function statusBadgeClassesForStatus(status: string) {
  switch (status) {
    case 'received':
      return 'bg-[var(--tablet-accent)] text-[var(--tablet-accent-contrast)]';
    case 'preparing':
      return 'bg-[var(--tablet-border-strong)] text-[var(--tablet-text)] ring-1 ring-[var(--tablet-info)]';
    case 'ready':
      return 'bg-[var(--tablet-success)] text-white';
    case 'scheduled':
      return 'bg-[var(--tablet-border)] text-[var(--tablet-muted-strong)]';
    default:
      return 'bg-[var(--tablet-border-strong)] text-[var(--tablet-text)]';
  }
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

const ACTION_QUEUE_KEY = 'servio_tablet_action_queue';
const ORDER_CACHE_KEY = 'servio_cached_orders';

function loadActionQueue(): PendingAction[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(ACTION_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as PendingAction[];
  } catch {
    return [];
  }
}

function saveActionQueue(next: PendingAction[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(ACTION_QUEUE_KEY, JSON.stringify(next));
}

function removeAuthTokens() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem('servio_access_token');
  window.localStorage.removeItem('servio_refresh_token');
  window.localStorage.removeItem('servio_user');
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
  const [pendingActions, setPendingActions] = useState<Set<string>>(() => new Set());
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [socketConnected, setSocketConnected] = useState<boolean>(false);
  const [showUpdateBanner, setShowUpdateBanner] = useState(false);
  const [showOrderDetailsModal, setShowOrderDetailsModal] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      const next = router.asPath || '/tablet/orders';
      router.replace(`/tablet/login?next=${encodeURIComponent(next)}`);
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setIsOnline(navigator.onLine);
    const handleOnline = () => {
      setIsOnline(true);
    };
    const handleOffline = () => {
      setIsOnline(false);
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!socket) return;
    const cleanup = socket.onConnectionChange((status) => {
      setSocketConnected(status);
    });
    return () => cleanup();
  }, [socket]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    const handleMessage = (event: MessageEvent) => {
      const data = event.data;
      if (data?.type === 'SW_ACTIVATED') {
        setShowUpdateBanner(true);
      }
    };
    navigator.serviceWorker.addEventListener('message', handleMessage);
    return () => {
      navigator.serviceWorker.removeEventListener('message', handleMessage);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const cachedQueue = loadActionQueue();
    if (cachedQueue.length > 0) {
      setPendingActions(new Set(cachedQueue.map((item) => item.orderId)));
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = window.localStorage.getItem(ORDER_CACHE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed?.orders)) {
        setOrders(parsed.orders);
        setCachedAt(parsed.cachedAt || null);
        setLoading(false);
      }
    } catch {
      // ignore cache parse issues
    }
  }, []);

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
    if (typeof window === 'undefined') return;
    const idleMs = 15 * 60 * 1000;
    let idleTimer: number | null = null;
    const handleIdleLogout = () => {
      removeAuthTokens();
      const next = router.asPath || '/tablet/orders';
      router.replace(`/tablet/login?next=${encodeURIComponent(next)}`);
    };
    const resetIdleTimer = () => {
      if (idleTimer) window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(handleIdleLogout, idleMs);
    };
    resetIdleTimer();
    const events = ['mousemove', 'mousedown', 'touchstart', 'keydown'];
    events.forEach((eventName) => window.addEventListener(eventName, resetIdleTimer));
    return () => {
      if (idleTimer) window.clearTimeout(idleTimer);
      events.forEach((eventName) => window.removeEventListener(eventName, resetIdleTimer));
    };
  }, [router]);

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

  const enqueueAction = (action: PendingAction) => {
    const current = loadActionQueue();
    const next = [...current, action];
    saveActionQueue(next);
    setPendingActions((prev) => {
      const updated = new Set(prev);
      updated.add(action.orderId);
      return updated;
    });
  };

  const clearPendingForOrder = (orderId: string) => {
    setPendingActions((prev) => {
      const next = new Set(prev);
      next.delete(orderId);
      return next;
    });
  };

  const processActionQueue = async () => {
    if (typeof window === 'undefined') return;
    if (!navigator.onLine) return;
    const queue = loadActionQueue();
    if (queue.length === 0) return;
    const remaining: PendingAction[] = [];
    for (const action of queue) {
      try {
        if (action.type === 'status') {
          await apiPost(`/api/orders/${encodeURIComponent(action.orderId)}/status`, action.payload);
        } else if (action.type === 'prep-time') {
          await apiPost(`/api/orders/${encodeURIComponent(action.orderId)}/prep-time`, action.payload);
        }
        clearPendingForOrder(action.orderId);
      } catch {
        remaining.push(action);
      }
    }
    saveActionQueue(remaining);
  };

  async function refresh() {
    try {
      if (typeof window !== 'undefined' && !window.localStorage.getItem('servio_access_token')) {
        setLoading(false);
        return;
      }
      const json = await apiGet<OrdersResponse>('/api/orders?limit=50&offset=0');
      const list = Array.isArray(json?.data?.orders) ? json.data!.orders! : [];
      setOrders(list);
      if (typeof window !== 'undefined') {
        const payload = JSON.stringify({ orders: list, cachedAt: new Date().toISOString() });
        window.localStorage.setItem(ORDER_CACHE_KEY, payload);
        setCachedAt(new Date().toISOString());
      }
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
      if (!navigator.onLine) {
        enqueueAction({
          id: `${orderId}-${Date.now()}`,
          orderId,
          type: 'status',
          payload: { status: nextStatus },
          queuedAt: Date.now()
        });
      } else {
        await apiPost(`/api/orders/${encodeURIComponent(orderId)}/status`, { status: nextStatus });
        if (socket) {
          socket.emit('order:status_changed', { orderId, status: nextStatus, timestamp: new Date() });
        }
      }
    } catch (e) {
      enqueueAction({
        id: `${orderId}-${Date.now()}`,
        orderId,
        type: 'status',
        payload: { status: nextStatus },
        queuedAt: Date.now()
      });
    } finally {
      setBusyId(null);
    }
  }

  async function acceptOrder(order: Order) {
    setBusyId(order.id);
    try {
      // Set status to preparing
      if (!navigator.onLine) {
        enqueueAction({
          id: `${order.id}-${Date.now()}`,
          orderId: order.id,
          type: 'status',
          payload: { status: 'preparing' },
          queuedAt: Date.now()
        });
      } else {
        await apiPost(`/api/orders/${encodeURIComponent(order.id)}/status`, { status: 'preparing' });
      }
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
      enqueueAction({
        id: `${order.id}-${Date.now()}`,
        orderId: order.id,
        type: 'status',
        payload: { status: 'preparing' },
        queuedAt: Date.now()
      });
    } finally {
      setBusyId(null);
    }
  }

  async function declineOrder(order: Order) {
    setBusyId(order.id);
    setSelectedOrder(null);
    try {
      if (!navigator.onLine) {
        enqueueAction({
          id: `${order.id}-${Date.now()}`,
          orderId: order.id,
          type: 'status',
          payload: { status: 'cancelled' },
          queuedAt: Date.now()
        });
      } else {
        await apiPost(`/api/orders/${encodeURIComponent(order.id)}/status`, { status: 'cancelled' });
      }
      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: 'cancelled' } : o)));
      if (socket) {
        socket.emit('order:status_changed', { orderId: order.id, status: 'cancelled', timestamp: new Date() });
      }
    } catch (e) {
      enqueueAction({
        id: `${order.id}-${Date.now()}`,
        orderId: order.id,
        type: 'status',
        payload: { status: 'cancelled' },
        queuedAt: Date.now()
      });
    } finally {
      setBusyId(null);
    }
  }

  async function setPrepTime(orderId: string, minutes: number) {
    setBusyId(orderId);
    try {
      let pickupTime: string | undefined;
      if (!navigator.onLine) {
        enqueueAction({
          id: `${orderId}-${Date.now()}`,
          orderId,
          type: 'prep-time',
          payload: { prepMinutes: minutes },
          queuedAt: Date.now()
        });
      } else {
        const resp = await apiPost<{ success: boolean; data?: { pickupTime?: string } }>(
          `/api/orders/${encodeURIComponent(orderId)}/prep-time`,
          { prepMinutes: minutes }
        );
        pickupTime = resp?.data?.pickupTime;
      }
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: 'preparing', pickup_time: pickupTime } : o))
      );
      if (socket) {
        socket.emit('order:status_changed', { orderId, status: 'preparing', timestamp: new Date() });
      }
    } catch (e) {
      enqueueAction({
        id: `${orderId}-${Date.now()}`,
        orderId,
        type: 'prep-time',
        payload: { prepMinutes: minutes },
        queuedAt: Date.now()
      });
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
    processActionQueue();
    const t = window.setInterval(() => {
      processActionQueue();
    }, 15000);
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

  const sortedOrders = useMemo(() => {
    const withTimestamp = (order: Order) => {
      if (!order.created_at) return 0;
      const ts = new Date(order.created_at).getTime();
      return Number.isNaN(ts) ? 0 : ts;
    };
    return [...activeOrders].sort((a, b) => withTimestamp(b) - withTimestamp(a));
  }, [activeOrders]);

  useEffect(() => {
    if (sortedOrders.length === 0) {
      if (selectedOrder) setSelectedOrder(null);
      return;
    }
    // Only auto-select if no order is currently selected
    if (!selectedOrder) {
      const latest = sortedOrders[0];
      setSelectedOrder(latest);
    }
  }, [sortedOrders, selectedOrder]);

  const receivedOrders = useMemo(() => {
    return activeOrders.filter((o) => normalizeStatus(o.status) === 'received');
  }, [activeOrders]);

  const filtered = sortedOrders;

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

  const connectionLabel = isOnline ? (socketConnected ? 'Online' : 'Reconnecting') : 'Offline';
  const connectionClasses = isOnline
    ? socketConnected
      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
      : 'bg-amber-500/20 text-amber-400 border-amber-500/40'
    : 'bg-red-500/20 text-red-400 border-red-500/40';

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <p className="text-sm text-gray-300">Redirecting to login…</p>
      </div>
    );
  }

  return (
    <div className="tablet-theme min-h-screen bg-[var(--tablet-bg)] text-[var(--tablet-text)] font-sans">
      <Head>
        <title>Orders • Servio</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
        <link rel="manifest" href="/manifest-tablet.webmanifest" />
      </Head>

      {/* Print-only receipt (duplicate copies) */}
      <div id="print-root" className="print-only">
        {receiptHtml ? <PrintReceipt receiptHtml={receiptHtml} copies={2} paperWidth={paperWidth} /> : null}
      </div>

      <div className="no-print flex min-h-screen flex-col lg:flex-row">
        <TabletSidebar statusDotClassName={isOnline && socketConnected ? 'bg-emerald-400' : 'bg-amber-400'} />

        <main className="flex-1 bg-[var(--tablet-bg)] text-[var(--tablet-text)] px-4 py-4 sm:px-6 sm:py-6">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-[var(--tablet-muted)]">Order Management</div>
                <div className="text-3xl font-semibold">All Orders</div>
              </div>
              <div className="flex flex-wrap items-center gap-3 md:justify-end">
                <div className={`px-3 py-1 text-xs font-semibold uppercase border rounded-full ${connectionClasses}`}>
                  {connectionLabel}
                </div>
                {cachedAt && (
                  <div className="text-xs text-[var(--tablet-muted)] font-medium">
                    Cached: {new Date(cachedAt).toLocaleTimeString()}
                  </div>
                )}
                <div className="text-right">
                  <div className="text-2xl font-semibold tabular-nums">
                    {now ? new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                  </div>
                </div>
                <button
                  onClick={refresh}
                  className="bg-[var(--tablet-surface-alt)] hover:brightness-110 p-3 rounded-full transition shadow-[0_2px_8px_rgba(0,0,0,0.3)]"
                  aria-label="Refresh"
                >
                  <RefreshCcw className={clsx('h-5 w-5', loading && 'animate-spin')} />
                </button>
              </div>
            </div>

            {showUpdateBanner && (
              <div className="bg-[var(--tablet-surface-alt)] text-[var(--tablet-text)] px-4 py-3 flex items-center justify-between rounded-xl border border-[var(--tablet-border-strong)] shadow-[0_2px_8px_rgba(0,0,0,0.3)]">
                <div className="font-semibold">Update available — refresh to get the latest tablet improvements.</div>
                <button
                  type="button"
                  className="bg-[var(--tablet-accent)] text-[var(--tablet-accent-contrast)] px-3 py-1 rounded-lg font-semibold"
                  onClick={() => window.location.reload()}
                >
                  Refresh
                </button>
              </div>
            )}

            {filtered.length === 0 && !loading ? (
              <div className="flex flex-col items-center justify-center py-20 sm:py-32 text-[var(--tablet-muted)]">
                <CheckCircle2 className="h-24 w-24 mb-6 opacity-20" />
                <h2 className="text-3xl font-semibold">All Clear</h2>
                <p className="text-base mt-3 font-medium uppercase tracking-widest">No active orders</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 tablet-orders-grid">
                {/* Left Panel: Order Queue */}
                <section className="bg-[var(--tablet-surface)] rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.3)] border border-[var(--tablet-border)] flex flex-col min-h-[50vh] lg:min-h-[70vh]">
                  <div className="px-4 py-4 border-b border-[var(--tablet-border)] flex items-center justify-between">
                    <button className="flex items-center gap-2 text-sm font-semibold uppercase text-[var(--tablet-accent)]">
                      All Orders
                      <ChevronDown className="h-4 w-4" />
                    </button>
                    <div className="text-xs font-semibold text-[var(--tablet-muted)]">{filtered.length} Active</div>
                  </div>
                  <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                    {filtered.map((o, index) => {
                      const status = normalizeStatus(o.status);
                      const isNew = status === 'received';
                      const isPreparing = status === 'preparing';
                      const isReady = status === 'ready';
                      const isScheduled = status === 'scheduled';
                      const timeStr = formatTimeAgo(o.created_at, now);
                      const itemCount = (o.items || []).reduce((sum, it) => sum + (it.quantity || 1), 0);
                      const hasPendingAction = pendingActions.has(o.id);
                      const isLatest = index === 0;
                      const isSelected = selectedOrder?.id === o.id;

                      const statusLabel = isNew ? 'NEW' : isPreparing ? 'IN PROGRESS' : isReady ? 'READY' : 'SCHEDULED';
                      const statusBadgeClasses = isNew
                        ? 'bg-[var(--tablet-accent)] text-[var(--tablet-accent-contrast)]'
                        : isPreparing
                          ? 'bg-[var(--tablet-border-strong)] text-[var(--tablet-text)] ring-1 ring-[var(--tablet-info)]'
                          : isReady
                            ? 'bg-[var(--tablet-success)] text-white'
                            : 'bg-[var(--tablet-border)] text-[var(--tablet-muted-strong)]';

                      return (
                        <button
                          key={o.id}
                          type="button"
                          onClick={() => setSelectedOrder(o)}
                          className={clsx(
                            'w-full text-left rounded-lg border border-[var(--tablet-border)] p-4 shadow-[0_2px_8px_rgba(0,0,0,0.3)] transition transform hover:brightness-110 hover:scale-[1.01]',
                            isSelected && 'bg-[var(--tablet-info)] border-[var(--tablet-info)] shadow-[0_4px_12px_rgba(93,112,153,0.45)]',
                            !isSelected && 'bg-[var(--tablet-card)]'
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <span className={clsx('text-[11px] font-semibold tracking-widest px-2 py-1 rounded-full', statusBadgeClasses)}>
                              {statusLabel}
                            </span>
                            {isLatest && (
                              <span className="text-[11px] font-semibold uppercase text-[var(--tablet-accent)]">Newest</span>
                            )}
                          </div>
                          <div className="mt-2 flex items-center justify-between">
                            <div className={clsx('text-lg font-semibold truncate', 'text-[var(--tablet-text)]')}>
                              {o.customer_name || 'Guest'}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-[var(--tablet-muted)]">
                              <Clock className="h-4 w-4" />
                              <span className="tabular-nums">{timeStr}</span>
                            </div>
                          </div>
                          <div className="mt-2 flex items-center justify-between text-sm text-[var(--tablet-muted)]">
                            <span>{itemCount} item{itemCount !== 1 ? 's' : ''}</span>
                            <span className="text-[var(--tablet-text)] font-semibold">{formatMoney(o.total_amount)}</span>
                          </div>
                          {hasPendingAction && (
                            <div className="mt-2 text-[11px] font-semibold uppercase text-[var(--tablet-accent)]">
                              Pending Sync
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </section>

                {/* Middle Panel: Order Details */}
                <section className="flex flex-col gap-6">
                  {/* Order Details */}
                  <button
                    type="button"
                    onClick={() => selectedOrder && setShowOrderDetailsModal(true)}
                    disabled={!selectedOrder}
                    className="bg-[var(--tablet-surface)] rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.3)] border border-[var(--tablet-border)] text-left transition hover:brightness-110 active:scale-[0.99] disabled:hover:brightness-100 disabled:active:scale-100"
                  >
                    <div className="px-6 py-5 border-b border-[var(--tablet-border)] flex items-center justify-between">
                      <div className="text-2xl font-semibold">
                        {selectedOrder ? (
                          <>ORDER #{selectedOrder.external_id ? selectedOrder.external_id.slice(-4).toUpperCase() : selectedOrder.id.slice(-4).toUpperCase()} - {(selectedOrder.customer_name || 'Guest').toUpperCase()}</>
                        ) : (
                          'ORDER DETAILS'
                        )}
                      </div>
                      {selectedOrder && (
                        <div className="text-xs text-[var(--tablet-accent)] uppercase font-semibold ml-2">
                          Tap for details
                        </div>
                      )}
                    </div>
                    {selectedOrder ? (
                      <div className="px-6 py-5 space-y-6">
                        <div className="flex items-center justify-between border-b border-[var(--tablet-border)] pb-4">
                          <span className="text-sm text-[var(--tablet-muted)] uppercase">Total Cost</span>
                          <span className="text-3xl font-semibold">{formatMoney(selectedOrder.total_amount)}</span>
                        </div>

                        <div>
                          <div className="text-lg font-semibold mb-3">Items ({selectedOrder.items?.length || 0})</div>
                          <div className="space-y-3 max-h-[260px] sm:max-h-[320px] overflow-y-auto pr-2">
                            {(selectedOrder.items || []).map((it, idx) => (
                              <div key={idx} className="flex items-center gap-4 pb-3 border-b border-[var(--tablet-border)] last:border-0">
                                <div className="h-14 w-14 rounded-md bg-[var(--tablet-border-strong)] flex items-center justify-center text-sm text-[var(--tablet-muted)]">
                                  {it.quantity || 1}
                                </div>
                                <div className="flex-1">
                                  <div className="text-base font-semibold">{it.name}</div>
                                  <div className="text-sm text-[var(--tablet-muted)]">Prepared fresh</div>
                                </div>
                                <div className="text-base font-semibold">
                                  {formatMoney((it.unit_price || it.price || 0) * (it.quantity || 1))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="px-6 py-16 text-center text-[var(--tablet-muted)]">
                        Waiting for orders...
                      </div>
                    )}
                  </button>

                </section>

                {/* Right Panel: Customer + Actions */}
                <section className="flex flex-col gap-6">
                  <div className="bg-[var(--tablet-surface)] rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.3)] border border-[var(--tablet-border)]">
                    <div className="px-6 py-5 border-b border-[var(--tablet-border)]">
                      <div className="text-xl font-semibold">Customer</div>
                    </div>
                    {selectedOrder ? (
                      <div className="px-6 py-5 space-y-5">
                        <div className="flex items-center gap-4">
                          <div className="h-14 w-14 rounded-full bg-[var(--tablet-border-strong)] flex items-center justify-center text-xl font-semibold">
                            {(selectedOrder.customer_name || 'G')[0]}
                          </div>
                          <div className="flex-1">
                            <div className="text-lg font-semibold">{selectedOrder.customer_name || 'Guest'}</div>
                            <div className="text-sm text-[var(--tablet-muted)]">{selectedOrder.customer_phone || 'No contact provided'}</div>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-3 text-sm">
                          <span className="text-[11px] uppercase tracking-widest text-[var(--tablet-muted)]">
                            {selectedOrder.order_type || 'Pickup'}
                          </span>
                          <span className="text-[var(--tablet-text)]">
                            {selectedOrder.pickup_time
                              ? new Date(selectedOrder.pickup_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                              : 'Ready ASAP'}
                          </span>
                          <span className="text-[var(--tablet-muted)]">
                            {selectedOrder.pickup_time
                              ? new Date(selectedOrder.pickup_time).toLocaleDateString()
                              : new Date().toLocaleDateString()}
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <span className={clsx('px-3 py-1 rounded-full text-[11px] font-semibold uppercase text-center', statusBadgeClassesForStatus(normalizeStatus(selectedOrder.status)))}>
                            {normalizeStatus(selectedOrder.status)}
                          </span>
                          <span className="px-3 py-1 rounded-full text-[11px] font-semibold uppercase text-center bg-[var(--tablet-border)] text-[var(--tablet-muted-strong)]">
                            {selectedOrder.channel || 'POS'}
                          </span>
                        </div>

                        {selectedOrder.special_instructions && (
                          <div className="bg-[var(--tablet-border)] rounded-lg p-4">
                            <div className="text-[11px] uppercase tracking-widest text-[var(--tablet-accent)] mb-2">
                              Special Instructions
                            </div>
                            <div className="text-sm text-[var(--tablet-text)] opacity-90">{selectedOrder.special_instructions}</div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="px-6 py-12 text-center text-[var(--tablet-muted)]">
                        Select an order to view customer details.
                      </div>
                    )}
                  </div>

                  {selectedOrder && (
                    <div className="flex flex-col gap-3">
                      {normalizeStatus(selectedOrder.status) === 'received' && (
                        <>
                          <button
                            disabled={busyId === selectedOrder.id}
                            onClick={() => acceptOrder(selectedOrder)}
                            className="h-14 rounded-full bg-[var(--tablet-accent)] text-[var(--tablet-accent-contrast)] font-semibold uppercase shadow-[0_2px_8px_rgba(0,0,0,0.3)] transition hover:brightness-110 active:scale-95 disabled:opacity-50"
                          >
                            Confirm Order
                          </button>
                          <button
                            disabled={busyId === selectedOrder.id}
                            onClick={() => declineOrder(selectedOrder)}
                            className="h-14 rounded-full border-2 border-[var(--tablet-border-strong)] text-[var(--tablet-text)] font-semibold uppercase transition hover:brightness-110 active:scale-95 disabled:opacity-50"
                          >
                            Decline
                          </button>
                        </>
                      )}
                      {normalizeStatus(selectedOrder.status) === 'preparing' && (
                        <>
                          <button
                            disabled={busyId === selectedOrder.id}
                            onClick={() => setStatus(selectedOrder.id, 'ready')}
                            className="h-14 rounded-full bg-[var(--tablet-success)] text-white font-semibold uppercase shadow-[0_2px_8px_rgba(0,0,0,0.3)] transition hover:brightness-110 active:scale-95 disabled:opacity-50"
                          >
                            Ready for Pickup
                          </button>
                          <button
                            onClick={() => printOrder(selectedOrder.id)}
                            disabled={printingOrderId === selectedOrder.id}
                            className="h-14 rounded-full border-2 border-[var(--tablet-border-strong)] text-[var(--tablet-text)] font-semibold uppercase transition hover:brightness-110 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                            <Printer className="h-5 w-5" />
                            Print
                          </button>
                        </>
                      )}
                      {normalizeStatus(selectedOrder.status) === 'ready' && (
                        <>
                          <button
                            disabled={busyId === selectedOrder.id}
                            onClick={() => {
                              if (window.confirm('Mark this order as completed?')) {
                                setStatus(selectedOrder.id, 'completed');
                                setSelectedOrder(null);
                              }
                            }}
                            className="h-14 rounded-full bg-[var(--tablet-success)] text-white font-semibold uppercase shadow-[0_2px_8px_rgba(0,0,0,0.3)] transition hover:brightness-110 active:scale-95 disabled:opacity-50"
                          >
                            Complete Order
                          </button>
                          <button
                            className="h-14 rounded-full border-2 border-[var(--tablet-border-strong)] text-[var(--tablet-text)] font-semibold uppercase transition hover:brightness-110 active:scale-95"
                            type="button"
                          >
                            Assign Driver
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </section>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Print Prompt Modal (when auto-print is OFF) */}
      {showPrintPrompt && (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-[var(--tablet-surface)] rounded-3xl shadow-[0_12px_30px_rgba(0,0,0,0.5)] p-6 sm:p-8 w-full max-w-md border border-[var(--tablet-border)]">
            <div className="text-center mb-6">
              <Printer className="h-14 w-14 mx-auto text-[var(--tablet-muted)] mb-4" />
              <h3 className="text-2xl font-semibold mb-2">Print Receipt?</h3>
              <p className="text-sm text-[var(--tablet-muted)]">Order has been accepted. Would you like to print it?</p>
            </div>
            <div className="flex gap-4">
              <button
                className="flex-1 px-6 py-4 rounded-2xl border-2 border-[var(--tablet-border-strong)] text-sm font-semibold uppercase transition hover:brightness-110"
                onClick={() => setShowPrintPrompt(null)}
              >
                No
              </button>
              <button
                className="flex-1 px-6 py-4 rounded-2xl bg-[var(--tablet-accent)] text-[var(--tablet-accent-contrast)] text-sm font-semibold uppercase transition hover:brightness-110"
                onClick={() => {
                  const orderId = showPrintPrompt;
                  setShowPrintPrompt(null);
                  printOrder(orderId, { markAsPrinted: true });
                }}
              >
                Yes, Print
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Order Details Modal */}
      {showOrderDetailsModal && selectedOrder && (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="bg-[var(--tablet-surface)] rounded-3xl shadow-[0_12px_30px_rgba(0,0,0,0.5)] w-full max-w-2xl max-h-[90vh] overflow-hidden border border-[var(--tablet-border)] flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-[var(--tablet-border)] flex items-center justify-between">
              <div className="text-2xl font-semibold">
                ORDER #{selectedOrder.external_id ? selectedOrder.external_id.slice(-4).toUpperCase() : selectedOrder.id.slice(-4).toUpperCase()}
              </div>
              <button
                onClick={() => setShowOrderDetailsModal(false)}
                className="h-10 w-10 rounded-full bg-[var(--tablet-border-strong)] hover:brightness-110 flex items-center justify-center transition"
                aria-label="Close"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body - Scrollable */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
              {/* Customer Info */}
              <div className="bg-[var(--tablet-card)] rounded-xl p-5 border border-[var(--tablet-border)]">
                <div className="text-sm uppercase tracking-widest text-[var(--tablet-muted)] mb-3">Customer</div>
                <div className="flex items-center gap-4 mb-4">
                  <div className="h-16 w-16 rounded-full bg-[var(--tablet-border-strong)] flex items-center justify-center text-2xl font-semibold">
                    {(selectedOrder.customer_name || 'G')[0]}
                  </div>
                  <div className="flex-1">
                    <div className="text-xl font-semibold">{selectedOrder.customer_name || 'Guest'}</div>
                    <div className="text-sm text-[var(--tablet-muted)]">{selectedOrder.customer_phone || 'No contact provided'}</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3 text-sm">
                  <span className="text-[11px] uppercase tracking-widest text-[var(--tablet-muted)]">
                    {selectedOrder.order_type || 'Pickup'}
                  </span>
                  <span className="text-[var(--tablet-text)]">
                    {selectedOrder.pickup_time
                      ? new Date(selectedOrder.pickup_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : 'Ready ASAP'}
                  </span>
                  <span className="text-[var(--tablet-muted)]">
                    {selectedOrder.pickup_time
                      ? new Date(selectedOrder.pickup_time).toLocaleDateString()
                      : new Date().toLocaleDateString()}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 mt-4">
                  <span className={clsx('px-3 py-1 rounded-full text-[11px] font-semibold uppercase text-center', statusBadgeClassesForStatus(normalizeStatus(selectedOrder.status)))}>
                    {normalizeStatus(selectedOrder.status)}
                  </span>
                  <span className="px-3 py-1 rounded-full text-[11px] font-semibold uppercase text-center bg-[var(--tablet-border)] text-[var(--tablet-muted-strong)]">
                    {selectedOrder.channel || 'POS'}
                  </span>
                </div>
              </div>

              {/* Total Cost */}
              <div className="bg-[var(--tablet-card)] rounded-xl p-5 border border-[var(--tablet-border)]">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[var(--tablet-muted)] uppercase tracking-widest">Total Cost</span>
                  <span className="text-4xl font-bold">{formatMoney(selectedOrder.total_amount)}</span>
                </div>
              </div>

              {/* Items */}
              <div className="bg-[var(--tablet-card)] rounded-xl p-5 border border-[var(--tablet-border)]">
                <div className="text-lg font-semibold mb-4">Items ({selectedOrder.items?.length || 0})</div>
                <div className="space-y-4">
                  {(selectedOrder.items || []).map((it, idx) => (
                    <div key={idx} className="flex items-center gap-4 pb-4 border-b border-[var(--tablet-border)] last:border-0">
                      <div className="h-16 w-16 rounded-lg bg-[var(--tablet-border-strong)] flex items-center justify-center text-lg font-semibold text-[var(--tablet-muted)]">
                        {it.quantity || 1}
                      </div>
                      <div className="flex-1">
                        <div className="text-lg font-semibold">{it.name}</div>
                        <div className="text-sm text-[var(--tablet-muted)]">Prepared fresh</div>
                      </div>
                      <div className="text-lg font-semibold">
                        {formatMoney((it.unit_price || it.price || 0) * (it.quantity || 1))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Special Instructions */}
              {selectedOrder.special_instructions && (
                <div className="bg-[var(--tablet-card)] rounded-xl p-5 border border-[var(--tablet-border)]">
                  <div className="text-xs uppercase tracking-widest text-[var(--tablet-accent)] mb-3">
                    Special Instructions
                  </div>
                  <div className="text-base text-[var(--tablet-text)] leading-relaxed">{selectedOrder.special_instructions}</div>
                </div>
              )}
            </div>

            {/* Modal Footer - Action Buttons */}
            <div className="px-6 py-5 border-t border-[var(--tablet-border)] flex gap-3">
              <button
                onClick={() => setShowOrderDetailsModal(false)}
                className="flex-1 px-6 py-4 rounded-2xl border-2 border-[var(--tablet-border-strong)] text-sm font-semibold uppercase transition hover:brightness-110"
              >
                Close
              </button>
              {normalizeStatus(selectedOrder.status) === 'preparing' && (
                <button
                  onClick={() => {
                    setShowOrderDetailsModal(false);
                    printOrder(selectedOrder.id);
                  }}
                  disabled={printingOrderId === selectedOrder.id}
                  className="flex-1 px-6 py-4 rounded-2xl bg-[var(--tablet-accent)] text-[var(--tablet-accent-contrast)] text-sm font-semibold uppercase transition hover:brightness-110 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Printer className="h-5 w-5" />
                  Print
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        body {
          overscroll-behavior-y: contain;
          -webkit-tap-highlight-color: transparent;
        }
      `}</style>
    </div>
  );
}
