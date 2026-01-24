import Head from 'next/head';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import clsx from 'clsx';
import { CheckCircle2, RefreshCcw, ArrowRight, ChevronDown, User, Printer, Settings2 } from 'lucide-react';
import { useSocket } from '../../lib/socket';
import { PrintReceipt } from '../../components/PrintReceipt';
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
    const latest = sortedOrders[0];
    if (!selectedOrder || selectedOrder.id !== latest.id) {
      setSelectedOrder(latest);
    }
  }, [sortedOrders, selectedOrder?.id]);

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
      ? 'bg-emerald-500/20 text-emerald-700 border-emerald-500/30'
      : 'bg-amber-500/20 text-amber-700 border-amber-500/30'
    : 'bg-red-500/20 text-red-700 border-red-500/30';

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <p className="text-sm text-gray-300">Redirecting to login…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-black font-sans">
      <Head>
        <title>Orders • Servio</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
        <link rel="manifest" href="/manifest-tablet.webmanifest" />
      </Head>

      {/* Print-only receipt (duplicate copies) */}
      <div id="print-root" className="print-only">
        {receiptHtml ? <PrintReceipt receiptHtml={receiptHtml} copies={2} paperWidth={paperWidth} /> : null}
      </div>

      {/* Header */}
      <div className="no-print sticky top-0 z-20 bg-black text-white px-4 py-3 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <div className="bg-white rounded-lg p-1">
            <img
              src="/images/servio_icon_tight.png"
              alt="Servio"
              className="h-8 w-8"
            />
          </div>
          <div className="bg-white text-black font-black px-2 py-0.5 rounded text-lg italic">SERVIO</div>
          <div className={`ml-2 px-2 py-1 text-xs font-black uppercase border rounded-full ${connectionClasses}`}>
            {connectionLabel}
          </div>
          {cachedAt && (
            <div className="text-xs text-white/70 font-semibold">Cached: {new Date(cachedAt).toLocaleTimeString()}</div>
          )}
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-2xl font-mono font-bold">
              {now ? new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
            </div>
          </div>
          <button
            type="button"
            onClick={() => router.push('/tablet/settings')}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-base font-black uppercase bg-white/10 hover:bg-white/20 transition-colors"
            title="Settings"
          >
            <Settings2 className="h-6 w-6" />
          </button>
          <button 
            onClick={refresh}
            className="bg-white/10 hover:bg-white/20 p-3 rounded-full transition-colors"
          >
            <RefreshCcw className={clsx("h-7 w-7", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {showUpdateBanner && (
        <div className="no-print bg-blue-600 text-white px-4 py-3 flex items-center justify-between">
          <div className="font-semibold">Update available — refresh to get the latest tablet improvements.</div>
          <button
            type="button"
            className="bg-white text-blue-700 px-3 py-1 rounded-lg font-black"
            onClick={() => window.location.reload()}
          >
            Refresh
          </button>
        </div>
      )}

      <div className="no-print p-4">
        {filtered.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center py-32 text-slate-400">
            <CheckCircle2 className="h-32 w-32 mb-6 opacity-20" />
            <h2 className="text-5xl font-black">ALL CLEAR</h2>
            <p className="text-2xl mt-3 font-bold uppercase tracking-widest">No active orders</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr_320px]">
            {/* Left Panel: Order List */}
            <div className="rounded-3xl border-4 border-black bg-white shadow-2xl flex flex-col min-h-[70vh]">
              <div className="px-4 py-3 border-b-2 border-slate-200 flex items-center justify-between">
                <div className="text-2xl font-black uppercase">Orders</div>
                <div className="text-lg font-bold text-slate-500">{filtered.length} Active</div>
              </div>
              <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
                {filtered.map((o, index) => {
                  const status = normalizeStatus(o.status);
                  const isNew = status === 'received';
                  const isPreparing = status === 'preparing';
                  const isReady = status === 'ready';
                  const timeStr = formatTimeAgo(o.created_at, now);
                  const itemCount = (o.items || []).reduce((sum, it) => sum + (it.quantity || 1), 0);
                  const hasPendingAction = pendingActions.has(o.id);
                  const isLatest = index === 0;

                  return (
                    <div
                      key={o.id}
                      className={clsx(
                        "rounded-2xl border-2 p-3 shadow-lg",
                        isLatest ? "border-blue-600 ring-4 ring-blue-100" : "border-slate-200",
                        isReady && "opacity-60 grayscale"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-lg font-black uppercase text-slate-500">Order</div>
                        {isLatest && (
                          <div className="text-xs font-black uppercase bg-blue-600 text-white px-2 py-1 rounded-full">
                            Latest
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <div className="text-3xl font-black font-mono">
                          #{o.external_id ? o.external_id.slice(-4).toUpperCase() : o.id.slice(-4).toUpperCase()}
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-black uppercase text-slate-500">
                            {isNew ? 'NEW' : isPreparing ? 'PREP' : 'READY'}
                          </div>
                          <div className={clsx(
                            "text-xl font-black tabular-nums",
                            timeStr.includes('m') && parseInt(timeStr) > 15 ? "text-red-600" : "text-black"
                          )}>
                            {timeStr}
                          </div>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <div className="text-lg font-black uppercase truncate">{o.customer_name || 'Guest'}</div>
                        <div className="text-sm font-black uppercase bg-slate-200 text-black px-2 py-1 rounded">
                          {o.channel || 'POS'}
                        </div>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <div className="text-base font-bold text-slate-600">
                          {itemCount} item{itemCount !== 1 ? 's' : ''}
                        </div>
                        <div className="text-lg font-black">{formatMoney(o.total_amount)}</div>
                      </div>
                      {hasPendingAction && (
                        <div className="mt-2 text-xs font-black uppercase text-amber-700">
                          Pending Sync
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Center Panel: Order Items */}
            <div className="rounded-3xl border-4 border-black bg-white shadow-2xl flex flex-col min-h-[70vh]">
              <div className="px-4 py-3 border-b-2 border-slate-200 flex items-center justify-between">
                <div className="text-2xl font-black uppercase">Latest Order</div>
                {selectedOrder ? (
                  <div className="text-lg font-black font-mono">
                    #{selectedOrder.external_id ? selectedOrder.external_id.slice(-4).toUpperCase() : selectedOrder.id.slice(-4).toUpperCase()}
                  </div>
                ) : null}
              </div>
              {selectedOrder ? (
                <div className="flex-1 overflow-y-auto px-4 py-3 min-h-0">
                  <div className="text-base font-black text-slate-500 uppercase mb-2">Items</div>
                  <div className="space-y-3">
                    {(selectedOrder.items || []).map((it, idx) => (
                      <div key={idx} className="flex items-center gap-3 py-2 border-b border-slate-200 last:border-0">
                        <div className="flex-shrink-0 bg-black text-white w-10 h-10 rounded-lg flex items-center justify-center text-xl font-black">
                          {it.quantity || 1}
                        </div>
                        <div className="flex-grow min-w-0">
                          <div className="text-xl font-black leading-tight text-black break-words uppercase truncate">
                            {it.name}
                          </div>
                        </div>
                        <div className="text-xl font-black text-black flex-shrink-0">
                          {formatMoney((it.unit_price || it.price || 0) * (it.quantity || 1))}
                        </div>
                      </div>
                    ))}
                  </div>
                  {selectedOrder.special_instructions && (
                    <div className="mt-3 p-3 bg-yellow-50 border-2 border-yellow-200 rounded-xl">
                      <div className="text-base font-black text-yellow-700 uppercase mb-1">Special Instructions</div>
                      <div className="text-lg font-bold text-yellow-900">{selectedOrder.special_instructions}</div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-2xl font-bold text-slate-400">
                  Waiting for orders...
                </div>
              )}
            </div>

            {/* Right Panel: Customer & Actions */}
            <div className="rounded-3xl border-4 border-black bg-white shadow-2xl flex flex-col min-h-[70vh]">
              <div className="px-4 py-3 border-b-2 border-slate-200 flex items-center justify-between">
                <div className="text-2xl font-black uppercase">Details</div>
                {selectedOrder ? (
                  <div className="text-sm font-black uppercase text-slate-500">
                    {normalizeStatus(selectedOrder.status)}
                  </div>
                ) : null}
              </div>
              {selectedOrder ? (
                <>
                  <div className="px-4 py-3 border-b-2 border-slate-200">
                    <div className="text-2xl font-black uppercase text-black">{selectedOrder.customer_name || 'Guest'}</div>
                    {selectedOrder.customer_phone && (
                      <div className="text-lg font-bold text-slate-600">{selectedOrder.customer_phone}</div>
                    )}
                    <div className="mt-2 flex items-center gap-2">
                      <div className="bg-black text-white px-3 py-1 rounded-lg text-base font-black uppercase">
                        {selectedOrder.channel || 'POS'}
                      </div>
                      {selectedOrder.order_type && (
                        <div className="text-base font-bold text-slate-600">{selectedOrder.order_type}</div>
                      )}
                    </div>
                  </div>
                  <div className="px-4 py-3 border-b-2 border-slate-200">
                    <div className="flex items-center justify-between">
                      <span className="text-xl font-black text-black uppercase">Total</span>
                      <span className="text-3xl font-black text-black">{formatMoney(selectedOrder.total_amount)}</span>
                    </div>
                    {selectedOrder.pickup_time && (
                      <div className="text-lg font-bold text-slate-600 mt-1">
                        Pickup: {new Date(selectedOrder.pickup_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                  </div>
                  <div className="px-4 py-4 flex-1 flex flex-col justify-end">
                    {normalizeStatus(selectedOrder.status) === 'received' && (
                      <div className="flex gap-3">
                        <button
                          disabled={busyId === selectedOrder.id}
                          onClick={() => declineOrder(selectedOrder)}
                          className="flex-1 bg-red-600 hover:bg-red-700 active:scale-95 text-white py-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-xl disabled:opacity-50"
                        >
                          <span className="text-2xl font-black uppercase">Decline</span>
                        </button>
                        <button
                          disabled={busyId === selectedOrder.id}
                          onClick={() => acceptOrder(selectedOrder)}
                          className="flex-[2] bg-green-600 hover:bg-green-700 active:scale-95 text-white py-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-xl disabled:opacity-50"
                        >
                          <span className="text-2xl font-black uppercase">Accept</span>
                          <CheckCircle2 className="h-7 w-7 stroke-[3px]" />
                        </button>
                      </div>
                    )}
                    {normalizeStatus(selectedOrder.status) === 'preparing' && (
                      <div className="flex gap-3">
                        <button
                          onClick={() => printOrder(selectedOrder.id)}
                          disabled={printingOrderId === selectedOrder.id}
                          className="flex-1 bg-slate-200 hover:bg-slate-300 active:scale-95 text-black py-4 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                        >
                          <Printer className="h-6 w-6" />
                          <span className="text-xl font-black uppercase">Print</span>
                        </button>
                        <button
                          disabled={busyId === selectedOrder.id}
                          onClick={() => {
                            setStatus(selectedOrder.id, 'ready');
                          }}
                          className="flex-[2] bg-black hover:bg-slate-800 active:scale-95 text-white py-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-xl disabled:opacity-50"
                        >
                          <span className="text-2xl font-black uppercase">Ready</span>
                          <CheckCircle2 className="h-7 w-7 stroke-[3px]" />
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
                        className="w-full bg-slate-500 hover:bg-slate-600 active:scale-95 text-white py-4 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                      >
                        <span className="text-2xl font-black uppercase">Complete</span>
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-2xl font-bold text-slate-400">
                  Waiting for orders...
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Print Prompt Modal (when auto-print is OFF) */}
      {showPrintPrompt && (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md">
            <div className="text-center mb-6">
              <Printer className="h-16 w-16 mx-auto text-slate-400 mb-4" />
              <h3 className="text-3xl font-black mb-2">Print Receipt?</h3>
              <p className="text-xl text-slate-600">Order has been accepted. Would you like to print it?</p>
            </div>
            <div className="flex gap-4">
              <button
                className="flex-1 px-6 py-5 rounded-2xl bg-slate-200 hover:bg-slate-300 text-2xl font-black transition-colors"
                onClick={() => setShowPrintPrompt(null)}
              >
                NO
              </button>
              <button
                className="flex-1 px-6 py-5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-2xl font-black transition-colors"
                onClick={() => {
                  const orderId = showPrintPrompt;
                  setShowPrintPrompt(null);
                  printOrder(orderId, { markAsPrinted: true });
                }}
              >
                YES, PRINT
              </button>
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
