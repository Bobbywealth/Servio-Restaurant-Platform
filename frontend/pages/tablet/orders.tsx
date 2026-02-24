import Head from 'next/head';
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import clsx from 'clsx';
import {
  Menu,
  Printer,
  Clock3,
  ShoppingBag,
  UtensilsCrossed,
  AlertTriangle,
} from 'lucide-react';
import { useSocket } from '../../lib/socket';
import { PrintReceipt } from '../../components/PrintReceipt';
import { OrderDetailsModal } from '../../components/tablet/orders/OrderDetailsModal';
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
  prep_time?: string | null;
  prep_minutes?: number | null;
};

type OrdersResponse = {
  success: boolean;
  data?: {
    orders?: Order[];
    pagination?: { total?: number; limit?: number; offset?: number; hasMore?: boolean };
  };
  error?: { message?: string };
};

type OrderFilter = {
  status: 'all' | 'received' | 'preparing' | 'ready';
};

type PendingAction =
  | {
      id: string;
      orderId: string;
      type: 'status';
      payload: { status: string };
      queuedAt: number;
      idempotencyKey: string;
      retryCount: number;
      lastError: string | null;
      lastAttemptAt?: number;
      permanentFailure?: boolean;
    }
  | {
      id: string;
      orderId: string;
      type: 'prep-time';
      payload: { prepMinutes: number };
      queuedAt: number;
      idempotencyKey: string;
      retryCount: number;
      lastError: string | null;
      lastAttemptAt?: number;
      permanentFailure?: boolean;
    };

type EnqueueAction = PendingAction extends infer Action
  ? Action extends PendingAction
    ? Omit<Action, 'idempotencyKey' | 'retryCount' | 'lastError'>
    : never
  : never;

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
  if (now === null || !iso) return { text: '—', elapsedMinutes: null };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { text: '—', elapsedMinutes: null };
  const diffMs = now - d.getTime();
  const mins = Math.max(0, Math.floor(diffMs / 60000));

  if (mins < 1) {
    return { text: 'Just now', elapsedMinutes: mins };
  }

  if (mins < 60) {
    return { text: `${mins}m`, elapsedMinutes: mins };
  }

  const hours = Math.floor(mins / 60);
  const remainingMinutes = mins % 60;
  return { text: `${hours}h ${remainingMinutes}m`, elapsedMinutes: mins };
}


function normalizeStatus(s: string | null | undefined) {
  const v = (s || '').trim();
  if (!v) return 'received';
  const lower = v.toLowerCase();
  if (lower === 'new') return 'received';
  return lower;
}

function statusLabel(status: string) {
  if (status === 'received') return 'New';
  if (status === 'preparing') return 'In progress';
  if (status === 'ready') return 'Ready';
  if (status === 'completed') return 'Completed';
  if (status === 'cancelled') return 'Cancelled';
  return status || 'Received';
}

function isArchivedOrder(order: Order, now: number | null): boolean {
  if (!Number.isFinite(STALE_ORDER_THRESHOLD_MINUTES) || STALE_ORDER_THRESHOLD_MINUTES <= 0) return false;
  const { elapsedMinutes } = formatTimeAgo(order.created_at, now);
  return typeof elapsedMinutes === 'number' && elapsedMinutes >= STALE_ORDER_THRESHOLD_MINUTES;
}

function normalizeOrderItems(items: unknown): OrderItem[] {
  if (!Array.isArray(items)) return [];

  return items.map((item: any) => {
    const parsedQuantity = Number(item?.quantity ?? item?.qty ?? 1);
    const quantity = Number.isFinite(parsedQuantity) && parsedQuantity > 0 ? parsedQuantity : 1;

    let modifiers = item?.modifiers;
    if ((!modifiers || typeof modifiers !== 'object') && typeof item?.notes === 'string') {
      try {
        const parsedNotes = JSON.parse(item.notes);
        if (parsedNotes?.modifiers) {
          modifiers = parsedNotes.modifiers;
        }
      } catch {
        // Notes can be plain text; ignore parse errors.
      }
    }

    return {
      ...item,
      name: item?.name || item?.item_name_snapshot || item?.item_id || 'Item',
      quantity,
      modifiers
    };
  });
}

// Prep time countdown function
function formatPrepTimeRemaining(
  prepMinutes: number | null | undefined,
  createdAt: string | null | undefined,
  now: number | null
): { text: string; isOverdue: boolean; percentRemaining: number; overdueMinutes: number | null } | null {
  if (!prepMinutes || !createdAt || now === null) return null;

  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return null;

  const totalMs = prepMinutes * 60 * 1000;
  const elapsedMs = now - created;
  const remainingMs = totalMs - elapsedMs;
  const percentRemaining = Math.max(0, Math.min(100, (remainingMs / totalMs) * 100));

  if (remainingMs <= 0) {
    const overdueMinutes = Math.ceil(Math.abs(remainingMs) / 60000);
    return {
      text: overdueMinutes > 0 ? `Overdue by ${overdueMinutes} min` : 'Overdue',
      isOverdue: true,
      percentRemaining: 0,
      overdueMinutes
    };
  }

  const minsRemaining = Math.ceil(remainingMs / 60000);
  return {
    text: `${minsRemaining}m`,
    isOverdue: false,
    percentRemaining,
    overdueMinutes: null
  };
}

const STALE_ORDER_THRESHOLD_MINUTES = Number(process.env.NEXT_PUBLIC_TABLET_STALE_ORDER_MINUTES ?? 120);

// Search/filter utilities
function matchesSearchQuery(order: Order, query: string): boolean {
  if (!query.trim()) return true;
  const searchTerms = query.toLowerCase().split(' ').filter(Boolean);

  const searchableText = [
    order.customer_name || '',
    order.customer_phone || '',
    order.external_id || order.id || '',
    order.channel || '',
    order.order_type || '',
    (order.items || []).map(i => i.name || '').join(' ')
  ].join(' ').toLowerCase();

  return searchTerms.every(term => searchableText.includes(term));
}


const ACTION_QUEUE_KEY = 'servio_tablet_action_queue';
const ORDER_CACHE_KEY = 'servio_cached_orders';
const ACTION_RETRY_THRESHOLD = 3;

function normalizeQueuedAction(action: any): PendingAction | null {
  if (!action || typeof action !== 'object') return null;
  if (!action.id || !action.orderId || !action.type || !action.payload) return null;
  if (action.type !== 'status' && action.type !== 'prep-time') return null;
  const idempotencyKey = action.idempotencyKey
    || (action.type === 'status'
      ? `status:${action.orderId}:${String(action.payload?.status || '').toLowerCase()}`
      : `prep-time:${action.orderId}:${action.queuedAt || Date.now()}`);

  return {
    ...action,
    queuedAt: Number(action.queuedAt) || Date.now(),
    idempotencyKey,
    retryCount: Number(action.retryCount) || 0,
    lastError: typeof action.lastError === 'string' ? action.lastError : null,
    lastAttemptAt: typeof action.lastAttemptAt === 'number' ? action.lastAttemptAt : undefined,
    permanentFailure: Boolean(action.permanentFailure)
  } as PendingAction;
}

function loadActionQueue(): PendingAction[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = safeLocalStorage.getItem(ACTION_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => normalizeQueuedAction(entry))
      .filter((entry): entry is PendingAction => Boolean(entry));
  } catch {
    return [];
  }
}

function saveActionQueue(next: PendingAction[]) {
  if (typeof window === 'undefined') return;
  safeLocalStorage.setItem(ACTION_QUEUE_KEY, JSON.stringify(next));
}

function removeAuthTokens() {
  if (typeof window === 'undefined') return;
  safeLocalStorage.removeItem('servio_access_token');
  safeLocalStorage.removeItem('servio_refresh_token');
  safeLocalStorage.removeItem('servio_user');
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
  const [fontSize, setFontSize] = useState<string>('medium');
  const [headerText, setHeaderText] = useState<string>('');
  const [footerText, setFooterText] = useState<string>('');

  const [lastPrintResult, setLastPrintResult] = useState<{ status: 'success' | 'error'; message?: string } | null>(null);
  const [autoPrintPendingId, setAutoPrintPendingId] = useState<string | null>(null);
  const lastAutoPromptedId = useRef<string | null>(null);
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
  const [pendingActions, setPendingActions] = useState<Set<string>>(() => new Set());
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [socketConnected, setSocketConnected] = useState<boolean>(false);
  const [actionQueue, setActionQueue] = useState<PendingAction[]>(() => loadActionQueue());
  const [lastSuccessfulSyncAt, setLastSuccessfulSyncAt] = useState<number | null>(null);
  const [syncAttemptStatus, setSyncAttemptStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  
  const [statusFilter, setStatusFilter] = useState<OrderFilter['status']>('all');
  const [orderDetailsOrder, setOrderDetailsOrder] = useState<Order | null>(null);

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
      processActionQueue();
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
    const cachedQueue = loadActionQueue();
    if (cachedQueue.length > 0) {
      setPendingActions(new Set(cachedQueue.map((item) => item.orderId)));
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = safeLocalStorage.getItem(ORDER_CACHE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed?.orders)) {
        setOrders(parsed.orders);
        setLoading(false);
      }
    } catch {
      // ignore cache parse issues
    }
  }, []);

  // Extended idle timeout - 8 hours for tablet use (restaurant shift duration)
  // Session is kept alive by _app.tsx proactive token refresh
  useEffect(() => {
    if (typeof window === 'undefined') return;
    // 8 hours = 28800000ms - covers a full restaurant shift
    const idleMs = 8 * 60 * 60 * 1000;
    let idleTimer: number | null = null;
    let lastActivity = Date.now();

    const handleIdleLogout = () => {
      // Only logout if truly idle (no activity for the full duration)
      if (Date.now() - lastActivity >= idleMs) {
        removeAuthTokens();
        const next = router.asPath || '/tablet/orders';
        router.replace(`/tablet/login?next=${encodeURIComponent(next)}`);
      }
    };

    const resetIdleTimer = () => {
      lastActivity = Date.now();
      if (idleTimer) window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(handleIdleLogout, idleMs);
    };

    resetIdleTimer();
    const events = ['mousemove', 'mousedown', 'touchstart', 'touchmove', 'keydown', 'scroll', 'click'];
    events.forEach((eventName) => window.addEventListener(eventName, resetIdleTimer, { passive: true }));

    return () => {
      if (idleTimer) window.clearTimeout(idleTimer);
      events.forEach((eventName) => window.removeEventListener(eventName, resetIdleTimer));
    };
  }, [router]);

  useEffect(() => {
    const storedAuto = typeof window !== 'undefined' ? safeLocalStorage.getItem('servio_auto_print_enabled') : null;
    const auto = storedAuto === 'true';
    setAutoPrintEnabled(auto);

    const storedPaper = typeof window !== 'undefined' ? safeLocalStorage.getItem('servio_thermal_paper_width') : null;
    const paper: ReceiptPaperWidth = storedPaper === '58mm' ? '58mm' : '80mm';
    setPaperWidth(paper);

    const storedMode = typeof window !== 'undefined' ? safeLocalStorage.getItem('servio_print_mode') : null;
    if (storedMode === 'bluetooth' || storedMode === 'bridge' || storedMode === 'system' || storedMode === 'rawbt') {
      setPrintMode(storedMode);
    }

    const storedFontSize = typeof window !== 'undefined' ? safeLocalStorage.getItem('servio_font_size') : null;
    if (storedFontSize === 'small' || storedFontSize === 'medium' || storedFontSize === 'large' || storedFontSize === 'xlarge') {
      setFontSize(storedFontSize);
    }

    const storedResult = typeof window !== 'undefined' ? safeLocalStorage.getItem('servio_last_print_result') : null;
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
          safeLocalStorage.setItem('servio_auto_print_enabled', enabled ? 'true' : 'false');
        }
        if (settings.printer_paper_width === '58mm' || settings.printer_paper_width === '80mm') {
          const width = settings.printer_paper_width as ReceiptPaperWidth;
          setPaperWidth(width);
          safeLocalStorage.setItem('servio_thermal_paper_width', width);
        }
        if (['system', 'rawbt', 'bluetooth', 'bridge'].includes(settings.printer_mode)) {
          const mode = settings.printer_mode as 'bluetooth' | 'system' | 'bridge' | 'rawbt';
          setPrintMode(mode);
          safeLocalStorage.setItem('servio_print_mode', mode);
        }
        if (['small', 'medium', 'large', 'xlarge'].includes(settings.printer_font_size)) {
          const size = settings.printer_font_size;
          setFontSize(size);
          safeLocalStorage.setItem('servio_font_size', size);
        }
        if (settings.printer_receipt_header_text !== undefined) {
          setHeaderText(settings.printer_receipt_header_text || '');
        }
        if (settings.printer_receipt_footer_text !== undefined) {
          setFooterText(settings.printer_receipt_footer_text || '');
        }
      } catch (e) {
        // ignore printer settings load failures
      }
    };

    loadPrinterSettings();
  }, []);

  const persistActionQueue = useCallback((next: PendingAction[]) => {
    saveActionQueue(next);
    setActionQueue(next);
    setPendingActions((prev) => {
      const updated = new Set<string>();
      next.forEach((queuedAction) => updated.add(queuedAction.orderId));
      return updated;
    });
  }, []);

  const enqueueAction = (action: EnqueueAction) => {
    const current = loadActionQueue();
    const idempotencyKey = action.type === 'status'
      ? `status:${action.orderId}:${action.payload.status.toLowerCase()}`
      : `prep-time:${action.orderId}:${action.queuedAt}`;
    const nextAction: PendingAction = { ...action, idempotencyKey, retryCount: 0, lastError: null } as PendingAction;
    const dedupedQueue = action.type === 'status'
      ? current.filter((queuedAction) => !(queuedAction.type === 'status' && queuedAction.idempotencyKey === idempotencyKey))
      : current;
    const next = [...dedupedQueue, nextAction];
    persistActionQueue(next);
  };

  const processActionQueue = async (force = false) => {
    if (typeof window === 'undefined') return;
    if (!navigator.onLine) return;
    const queue = loadActionQueue();
    if (queue.length === 0) return;
    setSyncAttemptStatus('syncing');
    const remaining: PendingAction[] = [];
    let needsReload = false;
    for (const action of queue) {
      if (!force && (action.permanentFailure || action.retryCount >= ACTION_RETRY_THRESHOLD)) {
        remaining.push(action);
        continue;
      }

      try {
        if (action.type === 'status') {
          await apiPost(`/api/orders/${encodeURIComponent(action.orderId)}/status`, {
            ...action.payload,
            idempotencyKey: action.idempotencyKey
          });
        } else if (action.type === 'prep-time') {
          await apiPost(`/api/orders/${encodeURIComponent(action.orderId)}/prep-time`, {
            ...action.payload,
            idempotencyKey: action.idempotencyKey
          });
        }
      } catch (error: any) {
        const statusCode = error?.response?.status;
        const message = error?.response?.data?.error?.message || error?.message || 'Sync failed';
        const permanentFailure = statusCode === 400 || statusCode === 404 || statusCode === 409 || statusCode === 422;
        const nextRetryCount = (action.retryCount || 0) + 1;
        remaining.push({
          ...action,
          retryCount: nextRetryCount,
          lastError: String(message),
          lastAttemptAt: Date.now(),
          permanentFailure
        });
        if (permanentFailure) needsReload = true;
      }
    }
    persistActionQueue(remaining);
    if (remaining.length === queue.length) {
      setSyncAttemptStatus('error');
    } else {
      setSyncAttemptStatus('success');
      setLastSuccessfulSyncAt(Date.now());
    }
    if (needsReload) {
      await refresh();
    }
  };


  const clearFailedActions = () => {
    if (!window.confirm('Clear failed actions that exceeded retry limits? This cannot be undone.')) return;
    const next = loadActionQueue().filter((action) => !action.permanentFailure && action.retryCount < ACTION_RETRY_THRESHOLD);
    persistActionQueue(next);
  };

  async function refresh() {
    try {
      if (typeof window !== 'undefined' && !safeLocalStorage.getItem('servio_access_token')) {
        setLoading(false);
        return;
      }
      const json = await apiGet<OrdersResponse>('/api/orders?limit=50&offset=0');
      const list = Array.isArray(json?.data?.orders) ? json.data!.orders! : [];
      setOrders(list.map((order) => ({ ...order, items: normalizeOrderItems(order.items) })));
      if (typeof window !== 'undefined') {
        const payload = JSON.stringify({ orders: list, cachedAt: new Date().toISOString() });
        safeLocalStorage.setItem(ORDER_CACHE_KEY, payload);
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
      if (typeof window !== 'undefined' && !safeLocalStorage.getItem('servio_access_token')) {
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
        // RawBT auto-print mode - plain text for thermal printer compatibility
        const items = (order.items || []).map((it: any) => ({
          name: it.name || 'Item',
          quantity: it.quantity || 1,
          price: it.unit_price || it.price || 0,
          modifiers: getReceiptItemModifiers(it)
        }));

        const orderAny = order as any;
        const plainText = generatePlainTextReceipt({
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
          specialInstructions: orderAny.special_instructions || undefined,
          headerText: headerText || undefined,
          footerText: footerText || undefined
        }, paperWidth);
        const success = printViaRawBT(plainText);

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
          safeLocalStorage.setItem('servio_last_print_result', JSON.stringify({ status: 'success' }));
        } else {
          setLastPrintResult({ status: 'error', message: 'RawBT not available. Is the app installed?' });
          safeLocalStorage.setItem('servio_last_print_result', JSON.stringify({ status: 'error', message: 'RawBT not available' }));
        }
        return;
      }

      if (printMode === 'system') {
        // Open a popup window with only the receipt content so the printer
        // gets a clean rendered page (not the full orders UI).
        const standaloneHtml = generateStandaloneReceiptHtml({
          restaurant: restaurant || null,
          order: order as ReceiptOrder,
          paperWidth,
          headerText,
          footerText,
          fontSize
        });

        const printWindow = window.open('', '_blank', 'width=400,height=600');
        if (printWindow) {
          printWindow.document.write(standaloneHtml);
          printWindow.document.close();
          printWindow.onload = () => {
            printWindow.focus();
            printWindow.print();
            printWindow.close();
          };
        } else {
          // Fallback if popup blocked: print current page
          setReceiptHtml(generateReceiptHtml({
            restaurant: restaurant || null,
            order: order as ReceiptOrder,
            paperWidth, headerText, footerText, fontSize
          }));
          await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
          window.print();
        }

        if (opts?.markAsPrinted !== false) {
          setPrintedOrders((prev) => {
            const next = new Set(prev);
            next.add(orderId);
            printedOrdersRef.current = next;
            return next;
          });
        }
        setLastPrintResult({ status: 'success' });
        safeLocalStorage.setItem('servio_last_print_result', JSON.stringify({ status: 'success' }));
        return;
      }

      // Bluetooth or Bridge mode - not fully implemented
      const message = printMode === 'bluetooth'
        ? 'WebBluetooth mode requires BLE printer. Try RawBT or System Print instead.'
        : 'Print Bridge mode is not configured';
      setLastPrintResult({ status: 'error', message });
      safeLocalStorage.setItem('servio_last_print_result', JSON.stringify({ status: 'error', message }));

    } catch (e) {
      console.error('Print failed', e);
      const message = e instanceof Error ? e.message : 'Print failed';
      setLastPrintResult({ status: 'error', message });
      safeLocalStorage.setItem('servio_last_print_result', JSON.stringify({ status: 'error', message }));
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
        // RawBT test print - plain text for thermal printer compatibility
        const plainText = generatePlainTextReceipt({
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
            modifiers: getReceiptItemModifiers(it)
          })),
          total: (testOrder.items || []).reduce((sum: number, it: any) => {
            const qty = it.quantity || 1;
            const price = it.unit_price || it.price || 0;
            return sum + qty * price;
          }, 0),
          createdAt: testOrder.created_at || undefined,
          specialInstructions: testOrder.special_instructions || undefined,
          headerText: headerText || undefined,
          footerText: footerText || undefined
        }, paperWidth);
        const success = printViaRawBT(plainText);
        if (success) {
          setLastPrintResult({ status: 'success' });
          safeLocalStorage.setItem('servio_last_print_result', JSON.stringify({ status: 'success' }));
        } else {
          setLastPrintResult({ status: 'error', message: 'RawBT not available. Is the app installed?' });
          safeLocalStorage.setItem('servio_last_print_result', JSON.stringify({ status: 'error', message: 'RawBT not available' }));
        }
        return;
      }

      if (printMode === 'system') {
        const standaloneHtml = generateStandaloneReceiptHtml({
          restaurant: restaurant || null,
          order: testOrder,
          paperWidth,
          headerText,
          footerText,
          fontSize
        });

        const printWindow = window.open('', '_blank', 'width=400,height=600');
        if (printWindow) {
          printWindow.document.write(standaloneHtml);
          printWindow.document.close();
          printWindow.onload = () => {
            printWindow.focus();
            printWindow.print();
            printWindow.close();
          };
        } else {
          setReceiptHtml(generateReceiptHtml({
            restaurant: restaurant || null, order: testOrder,
            paperWidth, headerText, footerText, fontSize
          }));
          await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
          window.print();
        }
        setLastPrintResult({ status: 'success' });
        safeLocalStorage.setItem('servio_last_print_result', JSON.stringify({ status: 'success' }));
        return;
      }

      const message = printMode === 'bluetooth'
        ? 'WebBluetooth mode requires BLE printer. Try RawBT or System Print instead.'
        : 'Print Bridge mode is not configured';
      setLastPrintResult({ status: 'error', message });
      safeLocalStorage.setItem('servio_last_print_result', JSON.stringify({ status: 'error', message }));
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Test print failed';
      setLastPrintResult({ status: 'error', message });
      safeLocalStorage.setItem('servio_last_print_result', JSON.stringify({ status: 'error', message }));
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

  function openAcceptModal(order: Order) {
    setPrepModalOrder(order);
    setPrepMinutes(order.prep_minutes && order.prep_minutes > 0 ? order.prep_minutes : 15);
  }

  async function acceptOrder(order: Order, minutes: number) {
    setBusyId(order.id);
    try {
      await setPrepTime(order.id, minutes);
      if (socket) {
        socket.emit('order:status_changed', { orderId: order.id, status: 'preparing', timestamp: new Date() });
      }
      
      if (autoPrintEnabled) {
        await printOrder(order.id, { markAsPrinted: true });
      }
    } catch (e) {
      enqueueAction({
        id: `${order.id}-${Date.now()}`,
        orderId: order.id,
        type: 'prep-time',
        payload: { prepMinutes: minutes },
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
        prev.map((o) => (o.id === orderId ? { ...o, status: 'preparing', pickup_time: pickupTime, prep_minutes: minutes } : o))
      );
      setSelectedOrder((prev) =>
        prev?.id === orderId ? { ...prev, status: 'preparing', pickup_time: pickupTime, prep_minutes: minutes } : prev
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

  const filteredOrders = useMemo(() => {
    const result = [...activeOrders];

    if (statusFilter !== 'all') {
      return result
        .filter((o) => normalizeStatus(o.status) === statusFilter)
        .sort((a, b) => {
          const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
          const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
          return tb - ta;
        });
    }

    return result.sort((a, b) => {
      const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
      const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
      return tb - ta;
    });
  }, [activeOrders, statusFilter]);

  useEffect(() => {
    if (filteredOrders.length === 0) {
      if (selectedOrder) setSelectedOrder(null);
      return;
    }
    // Only auto-select if no order is currently selected
    if (!selectedOrder) {
      const latest = filteredOrders[0];
      setSelectedOrder(latest);
    }
  }, [filteredOrders, selectedOrder]);

  const { activeQueueOrders } = useMemo(() => {
    const activeQueue: Order[] = [];
    const archived: Order[] = [];

    filteredOrders.forEach((order) => {
      if (isArchivedOrder(order, now)) {
        archived.push(order);
        return;
      }
      activeQueue.push(order);
    });

    return { activeQueueOrders: activeQueue };
  }, [filteredOrders, now]);

  const receivedOrders = useMemo(() => {
    return activeQueueOrders.filter((o) => normalizeStatus(o.status) === 'received');
  }, [activeQueueOrders]);

  const preparingOrders = useMemo(() => {
    return activeQueueOrders.filter((o) => normalizeStatus(o.status) === 'preparing');
  }, [activeQueueOrders]);

  const readyOrders = useMemo(() => {
    return activeQueueOrders.filter((o) => normalizeStatus(o.status) === 'ready');
  }, [activeQueueOrders]);

  // Single unified list - all orders in one card
  const allOrdersList = useMemo(() => {
    return [...activeQueueOrders].sort((a, b) => {
      const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
      const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
      return tb - ta;
    });
  }, [activeQueueOrders]);

  const filtered = filteredOrders;


  const renderOrderCard = useCallback((o: Order, laneIndex: number, options?: { isArchived?: boolean }) => {
    const isArchived = Boolean(options?.isArchived);
    const status = normalizeStatus(o.status);
    const isNew = status === 'received';
    const isPreparing = status === 'preparing';
    const timeAgo = formatTimeAgo(o.created_at, now);
    const itemCount = (o.items || []).reduce((sum, it) => sum + (it.quantity || 1), 0);
    const hasPendingAction = pendingActions.has(o.id);
    const isActionBusy = busyId === o.id || hasPendingAction || isArchived;
    const isSelected = selectedOrder?.id === o.id;

    const prepTimeData = isPreparing
      ? formatPrepTimeRemaining(o.prep_minutes || 15, o.created_at, now)
      : null;

    const openOrderDetails = async () => {
      setSelectedOrder(o);
      setOrderDetailsOrder({ ...o, items: normalizeOrderItems(o.items) });

      try {
        const response = await apiGet<{ success: boolean; data?: Order }>(`/api/orders/${encodeURIComponent(o.id)}`);
        if (!response?.success || !response.data) return;
        const detailedOrder = { ...response.data, items: normalizeOrderItems(response.data.items) };
        setOrderDetailsOrder(detailedOrder);
        setSelectedOrder((prev) => (prev?.id === detailedOrder.id ? detailedOrder : prev));
      } catch (error) {
        console.warn('Failed to load full order details', error);
      }
    };

    return (
      <div
        key={o.id}
        onClick={openOrderDetails}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openOrderDetails();
          }
        }}
        className={clsx(
          'w-full text-left rounded-[20px] border border-[var(--tablet-border)] shadow-sm transition touch-manipulation overflow-hidden bg-[var(--tablet-card)]',
          isArchived && 'opacity-65 saturate-75',
          isSelected && 'ring-2 ring-white/70'
        )}
      >
        <div className={clsx(
          'px-4 py-3 text-[var(--tablet-accent-contrast)]',
          isNew ? 'bg-[var(--tablet-danger)]' : isPreparing ? 'bg-[var(--tablet-accent)]' : 'bg-[var(--tablet-success)]'
        )}>
          <div className="flex items-center justify-between text-sm font-semibold opacity-95">
            <span>{statusLabel(status)}</span>
            {prepTimeData ? (
              <span className="inline-flex items-center gap-1">{prepTimeData.isOverdue && <AlertTriangle className="h-3 w-3" />}Ready in {prepTimeData.text}</span>
            ) : (
              <span>{timeAgo.text}</span>
            )}
          </div>
          <div className="text-[2rem] leading-none font-extrabold tracking-tight mt-1 truncate">
            {o.customer_name || 'Guest'}
          </div>
        </div>

        <div className="px-4 pt-3 pb-4">
          <div className="space-y-1.5 text-[1rem] text-[var(--tablet-text)]">
            <div className="flex items-center gap-2"><Clock3 className="h-4 w-4" />Pickup at {o.pickup_time || 'ASAP'}</div>
            <div className="flex items-center gap-2"><ShoppingBag className="h-4 w-4" />{itemCount} items</div>
            <div className="flex items-center gap-2"><UtensilsCrossed className="h-4 w-4" />{o.special_instructions ? 'Include utensils' : 'No utensils'}</div>
          </div>

          <div className="mt-3 mb-3 space-y-2 text-[var(--tablet-text)]">
            {(o.items || []).slice(0, 2).map((it, idx) => (
              <div key={`${o.id}-item-${idx}`} className="text-base font-semibold flex justify-between gap-2">
                <span className="truncate">{it.quantity || 1} {it.name || 'Item'}</span>
                <span>{formatMoney((it.price ?? it.unit_price ?? 0) * (it.quantity || 1))}</span>
              </div>
            ))}
          </div>

          <div className="mt-3 pt-3 border-t border-[var(--tablet-border)] flex items-center gap-2">
            {status === 'received' && (
              <button
                type="button"
                disabled={isActionBusy}
                onClick={(event) => {
                  event.stopPropagation();
                  openAcceptModal(o);
                }}
                className="w-full min-h-[44px] rounded-full px-3 py-2 text-base font-semibold text-[var(--tablet-text)] bg-[var(--tablet-surface-alt)] border border-[var(--tablet-border)] transition active:brightness-95 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Accept Order
              </button>
            )}

            {status === 'preparing' && (
              <button
                type="button"
                disabled={isActionBusy}
                onClick={(event) => {
                  event.stopPropagation();
                  setStatus(o.id, 'ready');
                }}
                className="w-full min-h-[44px] rounded-full px-3 py-2 text-base font-semibold text-[var(--tablet-text)] bg-[var(--tablet-surface-alt)] border border-[var(--tablet-border)] transition active:brightness-95 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Mark Ready
              </button>
            )}

            {status === 'ready' && (
              <button
                type="button"
                disabled={isActionBusy}
                onClick={(event) => {
                  event.stopPropagation();
                  setStatus(o.id, 'completed');
                }}
                className="w-full min-h-[44px] rounded-full px-3 py-2 text-base font-semibold text-[var(--tablet-text)] bg-[var(--tablet-surface-alt)] border border-[var(--tablet-border)] transition active:bg-[var(--tablet-border)] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Mark as Picked Up
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }, [busyId, now, pendingActions, selectedOrder]);
  const orderSyncIssues = useMemo(() => {
    const map = new Map<string, { retryCount: number; lastError: string | null; permanentFailure: boolean }>();
    actionQueue.forEach((action) => {
      const existing = map.get(action.orderId);
      if (!existing || action.retryCount > existing.retryCount) {
        map.set(action.orderId, {
          retryCount: action.retryCount,
          lastError: action.lastError,
          permanentFailure: Boolean(action.permanentFailure)
        });
      }
    });
    return map;
  }, [actionQueue]);


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


  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <p className="text-sm text-gray-300">Redirecting to login…</p>
      </div>
    );
  }

  return (
    <div className="tablet-theme tablet-orders-theme min-h-screen bg-[var(--tablet-bg)] text-[var(--tablet-text)] font-sans">
      <Head>
        <title>Orders • Servio</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
        <link rel="manifest" href="/manifest-tablet.webmanifest" />
      </Head>

      {/* Print-only receipt (duplicate copies) */}
      <div id="print-root" className="print-only">
        {receiptHtml ? <PrintReceipt receiptHtml={receiptHtml} copies={2} paperWidth={paperWidth} /> : null}
      </div>

      <div className="no-print min-h-screen bg-[var(--tablet-bg)]">
        <main className="mx-auto max-w-[1600px] px-4 py-4">
          <div className="rounded-[26px] border border-[var(--tablet-border)] bg-[var(--tablet-surface)] p-4 shadow-sm">
            <div className="flex items-center gap-3 rounded-2xl bg-[var(--tablet-bg)] px-3 py-3 mb-4 overflow-x-auto border border-[var(--tablet-border)]">
              <button type="button" className="h-11 w-11 rounded-full bg-[var(--tablet-surface)] text-[var(--tablet-text)] grid place-items-center border border-[var(--tablet-border)]">
                <Menu className="h-5 w-5" />
              </button>

              {[
                { key: 'all', label: 'All Orders', count: activeOrders.length },
              ].map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => setStatusFilter(chip.key as OrderFilter['status'])}
                  className={clsx(
                    'shrink-0 rounded-full px-4 py-2 text-sm font-semibold border',
                    statusFilter === chip.key
                      ? 'bg-[var(--tablet-accent)] text-[var(--tablet-accent-contrast)] border-[var(--tablet-accent)]'
                      : 'bg-transparent text-[var(--tablet-text)] border-[var(--tablet-border)]'
                  )}
                >
                  {chip.label} <span className="ml-1 rounded-full bg-[var(--tablet-surface-alt)] px-2 py-0.5 text-xs">{chip.count}</span>
                </button>
              ))}

              <button type="button" className="shrink-0 rounded-full px-4 py-2 text-sm font-semibold border border-[var(--tablet-border)] text-[var(--tablet-muted)]">
                Scheduled <span className="ml-1 rounded-full bg-[var(--tablet-surface-alt)] px-2 py-0.5 text-xs">0</span>
              </button>
            </div>

            {/* Single unified order list */}
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {allOrdersList.length === 0 ? (
                <div className="col-span-full rounded-xl border border-dashed border-[var(--tablet-border)] py-16 text-center text-sm uppercase tracking-wide text-[var(--tablet-muted)]">
                  No active orders
                </div>
              ) : (
                allOrdersList.map((o, index) => renderOrderCard(o, index))
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Order Details Modal */}
      <OrderDetailsModal
        order={orderDetailsOrder}
        onClose={() => setOrderDetailsOrder(null)}
        onConfirmOrder={(order) => {
          openAcceptModal(order);
          setOrderDetailsOrder(null);
        }}
        onDeclineOrder={(order) => {
          declineOrder(order);
          setOrderDetailsOrder(null);
        }}
        onSetStatus={(orderId, status) => {
          setStatus(orderId, status);
          if (status === 'completed') {
            setOrderDetailsOrder(null);
          }
        }}
        onPrintOrder={(orderId) => {
          printOrder(orderId);
        }}
        busyOrderId={busyId}
        printingOrderId={printingOrderId}
        formatMoney={formatMoney}
      />

      {prepModalOrder && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-[var(--tablet-border)] bg-[var(--tablet-surface)] p-5 shadow-lg">
            <h3 className="text-lg font-semibold text-[var(--tablet-text)]">Accept order #{shortId(prepModalOrder.id)}</h3>
            <p className="mt-2 text-sm text-[var(--tablet-muted)]">Set prep time before moving this order to In Progress.</p>

            <label className="mt-4 block text-sm font-medium text-[var(--tablet-text)]" htmlFor="prep-minutes-input">
              Preparation time (minutes)
            </label>
            <input
              id="prep-minutes-input"
              type="number"
              min={1}
              max={180}
              value={prepMinutes}
              onChange={(event) => {
                const next = Number(event.target.value);
                setPrepMinutes(Number.isFinite(next) ? next : 15);
              }}
              className="mt-2 w-full rounded-xl border border-[var(--tablet-border)] bg-[var(--tablet-card)] px-3 py-2 text-[var(--tablet-text)] focus:outline-none focus:ring-2 focus:ring-[var(--tablet-accent)]"
            />

            <div className="mt-5 flex items-center gap-2">
              <button
                type="button"
                className="flex-1 rounded-lg border border-[var(--tablet-border)] px-3 py-2 font-semibold"
                onClick={() => setPrepModalOrder(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="flex-1 rounded-lg bg-[var(--tablet-accent)] px-3 py-2 font-semibold text-[var(--tablet-accent-contrast)] disabled:opacity-50"
                onClick={() => {
                  if (!prepModalOrder) return;
                  const boundedMinutes = Math.min(180, Math.max(1, Number(prepMinutes) || 15));
                  void acceptOrder(prepModalOrder, boundedMinutes);
                  setPrepModalOrder(null);
                }}
                disabled={busyId === prepModalOrder.id}
              >
                Accept & Start
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
        .tablet-orders-theme {
          --tablet-accent: #3b82f6;
          --tablet-accent-contrast: #ffffff;
          --tablet-warning: #f97316;
        }
        .light .tablet-orders-theme {
          --tablet-accent: #2563eb;
          --tablet-accent-contrast: #ffffff;
          --tablet-warning: #ea580c;
        }
        /* Mobile-first responsive adjustments */
        @media (max-width: 639px) {
          .tablet-theme main {
            padding: 0.75rem;
          }
          .tablet-theme .text-3xl {
            font-size: 1.5rem;
          }
          .tablet-theme .text-2xl {
            font-size: 1.25rem;
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
