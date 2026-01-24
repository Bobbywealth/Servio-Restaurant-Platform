import Head from 'next/head';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import clsx from 'clsx';
import { CheckCircle2, RefreshCcw, ChevronDown, Printer } from 'lucide-react';
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
      return 'bg-[#c4a661] text-[#1a1a1a]';
    case 'preparing':
      return 'bg-[#3a3a3a] text-white ring-1 ring-[#4a5f8c]';
    case 'ready':
      return 'bg-[#4a7c59] text-white';
    case 'scheduled':
      return 'bg-[#2a2a2a] text-[#8a8a8a]';
    default:
      return 'bg-[#3a3a3a] text-white';
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
    <div className="min-h-screen bg-[#1a1a1a] text-white font-sans">
      <Head>
        <title>Orders • Servio</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
        <link rel="manifest" href="/manifest-tablet.webmanifest" />
      </Head>

      {/* Print-only receipt (duplicate copies) */}
      <div id="print-root" className="print-only">
        {receiptHtml ? <PrintReceipt receiptHtml={receiptHtml} copies={2} paperWidth={paperWidth} /> : null}
      </div>

      <div className="no-print flex min-h-screen">
        <TabletSidebar statusDotClassName={isOnline && socketConnected ? 'bg-emerald-400' : 'bg-amber-400'} />

        <main className="flex-1 bg-[#1a1a1a] text-white px-6 py-6">
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-[#6a6a6a]">Order Management</div>
                <div className="text-3xl font-semibold">All Orders</div>
              </div>
              <div className="flex items-center gap-3">
                <div className={`px-3 py-1 text-xs font-semibold uppercase border rounded-full ${connectionClasses}`}>
                  {connectionLabel}
                </div>
                {cachedAt && (
                  <div className="text-xs text-white/60 font-medium">
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
                  className="bg-[#242424] hover:brightness-110 p-3 rounded-full transition shadow-[0_2px_8px_rgba(0,0,0,0.3)]"
                  aria-label="Refresh"
                >
                  <RefreshCcw className={clsx('h-5 w-5', loading && 'animate-spin')} />
                </button>
              </div>
            </div>

            {showUpdateBanner && (
              <div className="bg-[#242424] text-white px-4 py-3 flex items-center justify-between rounded-xl border border-[#3a3a3a] shadow-[0_2px_8px_rgba(0,0,0,0.3)]">
                <div className="font-semibold">Update available — refresh to get the latest tablet improvements.</div>
                <button
                  type="button"
                  className="bg-[#c4a661] text-[#1a1a1a] px-3 py-1 rounded-lg font-semibold"
                  onClick={() => window.location.reload()}
                >
                  Refresh
                </button>
              </div>
            )}

            {filtered.length === 0 && !loading ? (
              <div className="flex flex-col items-center justify-center py-32 text-[#6a6a6a]">
                <CheckCircle2 className="h-24 w-24 mb-6 opacity-20" />
                <h2 className="text-3xl font-semibold">All Clear</h2>
                <p className="text-base mt-3 font-medium uppercase tracking-widest">No active orders</p>
              </div>
            ) : (
              <div className="flex flex-col gap-6 lg:flex-row">
                {/* Left Panel: Order Queue */}
                <section className="lg:w-[38%] w-full bg-[#1c1c1c] rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.3)] border border-[#2a2a2a] flex flex-col min-h-[70vh]">
                  <div className="px-4 py-4 border-b border-[#2a2a2a] flex items-center justify-between">
                    <button className="flex items-center gap-2 text-sm font-semibold uppercase text-[#d4b896]">
                      All Orders
                      <ChevronDown className="h-4 w-4" />
                    </button>
                    <div className="text-xs font-semibold text-[#6a6a6a]">{filtered.length} Active</div>
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
                        ? 'bg-[#c4a661] text-[#1a1a1a]'
                        : isPreparing
                          ? 'bg-[#3a3a3a] text-white ring-1 ring-[#4a5f8c]'
                          : isReady
                            ? 'bg-[#4a7c59] text-white'
                            : 'bg-[#2a2a2a] text-[#8a8a8a]';

                      return (
                        <button
                          key={o.id}
                          type="button"
                          onClick={() => setSelectedOrder(o)}
                          className={clsx(
                            'w-full text-left rounded-lg border border-[#2a2a2a] p-4 shadow-[0_2px_8px_rgba(0,0,0,0.3)] transition transform hover:brightness-110 hover:scale-[1.01]',
                            isSelected && 'bg-[#4a5f8c] border-[#5d7099] shadow-[0_4px_12px_rgba(93,112,153,0.45)]',
                            !isSelected && 'bg-[#202020]'
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <span className={clsx('text-[11px] font-semibold tracking-widest px-2 py-1 rounded-full', statusBadgeClasses)}>
                              {statusLabel}
                            </span>
                            {isLatest && (
                              <span className="text-[11px] font-semibold uppercase text-[#d4b896]">Newest</span>
                            )}
                          </div>
                          <div className="mt-2 flex items-center justify-between">
                            <div className={clsx('text-lg font-semibold truncate', isSelected ? 'text-white' : 'text-white')}>
                              {o.customer_name || 'Guest'}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-[#6a6a6a]">
                              <Clock className="h-4 w-4" />
                              <span className="tabular-nums">{timeStr}</span>
                            </div>
                          </div>
                          <div className="mt-2 flex items-center justify-between text-sm text-[#6a6a6a]">
                            <span>{itemCount} item{itemCount !== 1 ? 's' : ''}</span>
                            <span className="text-white font-semibold">{formatMoney(o.total_amount)}</span>
                          </div>
                          {hasPendingAction && (
                            <div className="mt-2 text-[11px] font-semibold uppercase text-[#d4b896]">
                              Pending Sync
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </section>

                {/* Right Panel: Order Details */}
                <section className="lg:w-[62%] w-full flex flex-col gap-6">
                  <div className="bg-[#1c1c1c] rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.3)] border border-[#2a2a2a]">
                    <div className="px-6 py-5 border-b border-[#2a2a2a]">
                      <div className="text-2xl font-semibold">
                        {selectedOrder ? (
                          <>ORDER #{selectedOrder.external_id ? selectedOrder.external_id.slice(-4).toUpperCase() : selectedOrder.id.slice(-4).toUpperCase()} - {(selectedOrder.customer_name || 'Guest').toUpperCase()}</>
                        ) : (
                          'ORDER DETAILS'
                        )}
                      </div>
                    </div>
                    {selectedOrder ? (
                      <div className="px-6 py-5 space-y-6">
                        <div className="bg-[#242424] rounded-lg p-5 flex flex-col gap-4">
                          <div className="flex items-center gap-4">
                            <div className="h-14 w-14 rounded-full bg-[#3a3a3a] flex items-center justify-center text-xl font-semibold">
                              {(selectedOrder.customer_name || 'G')[0]}
                            </div>
                            <div className="flex-1">
                              <div className="text-lg font-semibold">{selectedOrder.customer_name || 'Guest'}</div>
                              <div className="text-sm text-[#6a6a6a]">{selectedOrder.customer_phone || 'No contact provided'}</div>
                              <div className="mt-3 flex flex-wrap gap-3 text-sm">
                                <span className="text-[11px] uppercase tracking-widest text-[#6a6a6a]">
                                  {selectedOrder.order_type || 'Pickup'}
                                </span>
                                <span className="text-white">
                                  {selectedOrder.pickup_time
                                    ? new Date(selectedOrder.pickup_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                    : 'Ready ASAP'}
                                </span>
                                <span className="text-[#6a6a6a]">
                                  {selectedOrder.pickup_time
                                    ? new Date(selectedOrder.pickup_time).toLocaleDateString()
                                    : new Date().toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                            <div className="flex flex-col gap-2">
                              <span className={clsx('px-3 py-1 rounded-full text-[11px] font-semibold uppercase text-center', statusBadgeClassesForStatus(normalizeStatus(selectedOrder.status)))}>
                                {normalizeStatus(selectedOrder.status)}
                              </span>
                              <span className="px-3 py-1 rounded-full text-[11px] font-semibold uppercase text-center bg-[#2a2a2a] text-[#8a8a8a]">
                                {selectedOrder.channel || 'POS'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between border-b border-[#2a2a2a] pb-4">
                          <span className="text-sm text-[#6a6a6a] uppercase">Total Cost</span>
                          <span className="text-3xl font-semibold">{formatMoney(selectedOrder.total_amount)}</span>
                        </div>

                        <div>
                          <div className="text-lg font-semibold mb-3">Items ({selectedOrder.items?.length || 0})</div>
                          <div className="space-y-3 max-h-[320px] overflow-y-auto pr-2">
                            {(selectedOrder.items || []).map((it, idx) => (
                              <div key={idx} className="flex items-center gap-4 pb-3 border-b border-[#2a2a2a] last:border-0">
                                <div className="h-14 w-14 rounded-md bg-[#2f2f2f] flex items-center justify-center text-sm text-[#6a6a6a]">
                                  {it.quantity || 1}
                                </div>
                                <div className="flex-1">
                                  <div className="text-base font-semibold">{it.name}</div>
                                  <div className="text-sm text-[#6a6a6a]">Prepared fresh</div>
                                </div>
                                <div className="text-base font-semibold">
                                  {formatMoney((it.unit_price || it.price || 0) * (it.quantity || 1))}
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="text-sm text-white/90">{selectedOrder.special_instructions}</div>
                        </div>

                        {selectedOrder.special_instructions && (
                          <div className="bg-[#2a2a2a] rounded-lg p-4">
                            <div className="text-[11px] uppercase tracking-widest text-[#d4b896] mb-2">
                              Special Instructions
                            </div>
                            <div className="text-sm text-white/90">{selectedOrder.special_instructions}</div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="px-6 py-16 text-center text-[#6a6a6a]">
                        Waiting for orders...
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
                            className="h-14 rounded-full bg-[#c4a661] text-[#1a1a1a] font-semibold uppercase shadow-[0_2px_8px_rgba(0,0,0,0.3)] transition hover:brightness-110 active:scale-95 disabled:opacity-50"
                          >
                            Confirm Order
                          </button>
                          <button
                            disabled={busyId === selectedOrder.id}
                            onClick={() => declineOrder(selectedOrder)}
                            className="h-14 rounded-full border-2 border-[#4a4a4a] text-white font-semibold uppercase transition hover:brightness-110 active:scale-95 disabled:opacity-50"
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
                            className="h-14 rounded-full bg-[#4a7c59] text-white font-semibold uppercase shadow-[0_2px_8px_rgba(0,0,0,0.3)] transition hover:brightness-110 active:scale-95 disabled:opacity-50"
                          >
                            Ready for Pickup
                          </button>
                          <button
                            onClick={() => printOrder(selectedOrder.id)}
                            disabled={printingOrderId === selectedOrder.id}
                            className="h-14 rounded-full border-2 border-[#4a4a4a] text-white font-semibold uppercase transition hover:brightness-110 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
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
                            className="h-14 rounded-full bg-[#4a7c59] text-white font-semibold uppercase shadow-[0_2px_8px_rgba(0,0,0,0.3)] transition hover:brightness-110 active:scale-95 disabled:opacity-50"
                          >
                            Complete Order
                          </button>
                          <button
                            className="h-14 rounded-full border-2 border-[#4a4a4a] text-white font-semibold uppercase transition hover:brightness-110 active:scale-95"
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
          <div className="bg-[#1c1c1c] rounded-3xl shadow-[0_12px_30px_rgba(0,0,0,0.5)] p-8 w-full max-w-md border border-[#2a2a2a]">
            <div className="text-center mb-6">
              <Printer className="h-14 w-14 mx-auto text-[#6a6a6a] mb-4" />
              <h3 className="text-2xl font-semibold mb-2">Print Receipt?</h3>
              <p className="text-sm text-[#6a6a6a]">Order has been accepted. Would you like to print it?</p>
            </div>
            <div className="flex gap-4">
              <button
                className="flex-1 px-6 py-4 rounded-2xl border-2 border-[#4a4a4a] text-sm font-semibold uppercase transition hover:brightness-110"
                onClick={() => setShowPrintPrompt(null)}
              >
                No
              </button>
              <button
                className="flex-1 px-6 py-4 rounded-2xl bg-[#c4a661] text-[#1a1a1a] text-sm font-semibold uppercase transition hover:brightness-110"
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


      <style jsx global>{`
        body {
          overscroll-behavior-y: contain;
          -webkit-tap-highlight-color: transparent;
        }
      `}</style>
    </div>
  );
}
