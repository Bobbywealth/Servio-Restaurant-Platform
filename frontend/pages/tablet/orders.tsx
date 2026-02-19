import Head from 'next/head';
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import clsx from 'clsx';
import {
  CheckCircle2,
  ChevronDown,
  Printer,
  Clock,
  Search,
  Filter,
  X,
  AlertTriangle,
  Eye,
  Calendar,
  ArrowUpDown,
  Zap,
  Bell,
  BellOff,
  LayoutGrid,
  List
} from 'lucide-react';
import { useSocket } from '../../lib/socket';
import { PrintReceipt } from '../../components/PrintReceipt';
import { TabletSidebar } from '../../components/tablet/TabletSidebar';
import { OrdersHeader } from '../../components/tablet/orders/OrdersHeader';
import { OrderFiltersBar } from '../../components/tablet/orders/OrderFiltersBar';
import { OrderDetailsModal } from '../../components/tablet/orders/OrderDetailsModal';
import { OrderDetailsPanel } from '../../components/tablet/orders/OrderDetailsPanel';
import { CustomerActionsPanel } from '../../components/tablet/orders/CustomerActionsPanel';
import { useOrderAlerts } from '../../hooks/tablet/useOrderAlerts';
import type { ReceiptPaperWidth, ReceiptOrder, ReceiptRestaurant } from '../../utils/receiptGenerator';
import { generateReceiptHtml, generateStandaloneReceiptHtml } from '../../utils/receiptGenerator';
import { api } from '../../lib/api'
import { safeLocalStorage } from '../../lib/utils';
import { generatePlainTextReceipt, printViaRawBT } from '../../utils/escpos';
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
  channel: string;
  orderType: string;
  sortBy: 'newest' | 'oldest' | 'prep-time';
  searchQuery: string;
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

// Prep time countdown function
function formatPrepTimeRemaining(prepMinutes: number | null | undefined, createdAt: string | null | undefined, now: number | null): { text: string; isOverdue: boolean; percentRemaining: number } | null {
  if (!prepMinutes || !createdAt || now === null) return null;

  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return null;

  const totalMs = prepMinutes * 60 * 1000;
  const elapsedMs = now - created;
  const remainingMs = totalMs - elapsedMs;
  const percentRemaining = Math.max(0, Math.min(100, (remainingMs / totalMs) * 100));

  if (remainingMs <= 0) {
    return { text: 'Overdue', isOverdue: true, percentRemaining: 0 };
  }

  const minsRemaining = Math.ceil(remainingMs / 60000);
  return {
    text: `${minsRemaining}m`,
    isOverdue: false,
    percentRemaining
  };
}

function getPrepTimeWarningLevel(percentRemaining: number): 'normal' | 'warning' | 'critical' {
  if (percentRemaining <= 25) return 'critical';
  if (percentRemaining <= 50) return 'warning';
  return 'normal';
}

function getPrepTimeColorClass(level: 'normal' | 'warning' | 'critical'): string {
  switch (level) {
    case 'critical':
      return 'bg-[var(--tablet-danger)] text-white';
    case 'warning':
      return 'bg-[var(--tablet-warning)] text-[var(--tablet-text)]';
    default:
      return 'bg-[var(--tablet-success)] text-white';
  }
}

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

function statusBadgeClassesForStatus(status: string) {
  switch (status) {
    case 'received':
      return 'bg-[var(--tablet-surface-alt)] text-[var(--tablet-muted-strong)] border border-[var(--tablet-border)]';
    case 'preparing':
      return 'bg-[var(--tablet-surface-alt)] text-[var(--tablet-text)] border border-[var(--tablet-border)]';
    case 'ready':
      return 'bg-[var(--tablet-success)] text-white';
    case 'scheduled':
      return 'bg-[var(--tablet-surface-alt)] text-[var(--tablet-muted-strong)] border border-[var(--tablet-border)]';
    default:
      return 'bg-[var(--tablet-surface-alt)] text-[var(--tablet-text)] border border-[var(--tablet-border)]';
  }
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
  const [showPrintPrompt, setShowPrintPrompt] = useState<string | null>(null);
  const [pendingActions, setPendingActions] = useState<Set<string>>(() => new Set());
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [socketConnected, setSocketConnected] = useState<boolean>(false);
  const [showUpdateBanner, setShowUpdateBanner] = useState(false);
  const [actionQueue, setActionQueue] = useState<PendingAction[]>(() => loadActionQueue());
  const [lastSuccessfulSyncAt, setLastSuccessfulSyncAt] = useState<number | null>(null);
  const [syncAttemptStatus, setSyncAttemptStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  
  // New feature toggles
  const [isFullscreen, setIsFullscreen] = useState(false);
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<OrderFilter['status']>('all');
  const [channelFilter, setChannelFilter] = useState('all');
  const [sortBy, setSortBy] = useState<OrderFilter['sortBy']>('newest');
  const [showFilters, setShowFilters] = useState(false);
  const [orderDetailsOrder, setOrderDetailsOrder] = useState<Order | null>(null);

  // Get unique channels for filter dropdown
  const channels = useMemo(() => {
    const channelSet = new Set<string>();
    orders.forEach(o => {
      if (o.channel) channelSet.add(o.channel);
    });
    return Array.from(channelSet).sort();
  }, [orders]);

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
    const raw = safeLocalStorage.getItem(ORDER_CACHE_KEY);
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

  // Fullscreen toggle effect
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
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

  const enqueueAction = (action: Omit<PendingAction, 'idempotencyKey' | 'retryCount' | 'lastError'>) => {
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

  const retryQueueNow = async () => {
    if (!window.confirm('Retry all failed and queued sync actions now?')) return;
    const resetQueue = loadActionQueue().map((action) => ({ ...action, permanentFailure: false }));
    persistActionQueue(resetQueue);
    await processActionQueue(true);
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
      setOrders(list);
      if (typeof window !== 'undefined') {
        const payload = JSON.stringify({ orders: list, cachedAt: new Date().toISOString() });
        safeLocalStorage.setItem(ORDER_CACHE_KEY, payload);
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
          modifiers: it.modifiers || []
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
            modifiers: it.modifiers || []
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

  const filteredOrders = useMemo(() => {
    let result = [...activeOrders];

    // Apply status filter
    if (statusFilter !== 'all') {
      result = result.filter(o => normalizeStatus(o.status) === statusFilter);
    }

    // Apply channel filter
    if (channelFilter !== 'all') {
      result = result.filter(o => o.channel === channelFilter);
    }

    // Apply search query
    if (searchQuery.trim()) {
      result = result.filter(o => matchesSearchQuery(o, searchQuery));
    }

    // Apply sorting
    switch (sortBy) {
      case 'oldest':
        result.sort((a, b) => {
          const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
          const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
          return ta - tb;
        });
        break;
      case 'prep-time':
        result.sort((a, b) => {
          // Put orders with prep time at top, sorted by remaining time
          const pa = a.prep_minutes || 15;
          const pb = b.prep_minutes || 15;
          const hasA = a.created_at ? Date.now() - new Date(a.created_at).getTime() : 0;
          const hasB = b.created_at ? Date.now() - new Date(b.created_at).getTime() : 0;
          const ra = pa * 60000 - hasA;
          const rb = pb * 60000 - hasB;
          return ra - rb; // Orders closer to deadline first
        });
        break;
      case 'newest':
      default:
        result.sort((a, b) => {
          const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
          const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
          return tb - ta;
        });
        break;
    }

    return result;
  }, [activeOrders, statusFilter, channelFilter, searchQuery, sortBy]);

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

  const receivedOrders = useMemo(() => {
    return filteredOrders.filter((o) => normalizeStatus(o.status) === 'received');
  }, [filteredOrders]);

  const preparingOrders = useMemo(() => {
    return filteredOrders.filter((o) => normalizeStatus(o.status) === 'preparing');
  }, [filteredOrders]);

  const readyOrders = useMemo(() => {
    return filteredOrders.filter((o) => normalizeStatus(o.status) === 'ready');
  }, [filteredOrders]);

  const filtered = filteredOrders;
  const laneGroups: Array<{ key: 'received' | 'preparing' | 'ready'; label: string; orders: Order[] }> = [
    { key: 'received', label: 'Received', orders: receivedOrders },
    { key: 'preparing', label: 'Preparing', orders: preparingOrders },
    { key: 'ready', label: 'Ready', orders: readyOrders }
  ];

  const renderOrderCard = useCallback((o: Order, laneIndex: number) => {
    const status = normalizeStatus(o.status);
    const isNew = status === 'received';
    const isPreparing = status === 'preparing';
    const isReady = status === 'ready';
    const isScheduled = status === 'scheduled';
    const timeStr = formatTimeAgo(o.created_at, now);
    const itemCount = (o.items || []).reduce((sum, it) => sum + (it.quantity || 1), 0);
    const hasPendingAction = pendingActions.has(o.id);
    const isLatest = laneIndex === 0;
    const isSelected = selectedOrder?.id === o.id;

    const statusLabel = isNew ? 'NEW' : isPreparing ? 'IN PROGRESS' : isReady ? 'READY' : isScheduled ? 'SCHEDULED' : 'ACTIVE';
    const prepTimeData = isPreparing
      ? formatPrepTimeRemaining(o.prep_minutes || 15, o.created_at, now)
      : null;
    const prepWarningLevel = prepTimeData
      ? getPrepTimeWarningLevel(prepTimeData.percentRemaining)
      : 'normal';
    const prepTimeColorClass = getPrepTimeColorClass(prepWarningLevel);
    const isOverdue = prepTimeData?.isOverdue;
    const cardStatusBadgeClasses = isPreparing && (prepWarningLevel === 'critical' || prepWarningLevel === 'warning')
      ? prepWarningLevel === 'critical'
        ? 'bg-[var(--tablet-danger)] text-white'
        : 'bg-[var(--tablet-warning)] text-[var(--tablet-text)]'
      : statusBadgeClassesForStatus(status);

    return (
      <button
        key={o.id}
        type="button"
        onClick={() => setSelectedOrder(o)}
        className={clsx(
          'w-full text-left rounded-xl border border-[var(--tablet-border)] p-4 sm:p-5 shadow-[0_2px_8px_rgba(0,0,0,0.3)] transition transform hover:brightness-110 hover:scale-[1.01] touch-manipulation',
          isSelected && 'bg-[var(--tablet-surface)] border-[var(--tablet-border-strong)] border-l-4 border-l-[var(--tablet-info)] ring-2 ring-[var(--tablet-info)] shadow-[0_4px_12px_rgba(93,112,153,0.2)]',
          !isSelected && 'bg-[var(--tablet-card)]',
          isOverdue && 'order-overdue'
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={clsx('text-xs font-semibold tracking-widest px-2.5 py-1.5 rounded-full', cardStatusBadgeClasses)}>
              {statusLabel}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {isLatest && (
              <span className="text-xs font-semibold uppercase text-[var(--tablet-muted)] hidden sm:inline">Newest</span>
            )}
            {isPreparing && prepTimeData && (
              <span className={clsx(
                'text-xs font-semibold px-2.5 py-1.5 rounded-full',
                prepTimeColorClass,
                prepWarningLevel === 'critical' && 'prep-time-critical'
              )}>
                {prepTimeData.text}
              </span>
            )}
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <div className={clsx('text-lg font-semibold truncate', 'text-[var(--tablet-text)]')}>
            {o.customer_name || 'Guest'}
          </div>
          <div className="flex items-center gap-2 text-sm text-[var(--tablet-muted)]">
            <Clock className="h-4 w-4" />
            <span className="tabular-nums">{timeStr}</span>
          </div>
        </div>

        {isPreparing && prepTimeData && !prepTimeData.isOverdue && (
          <div className="mt-3">
            <div className="h-2 rounded-full bg-[var(--tablet-border)] overflow-hidden">
              <div
                className={clsx(
                  'h-full rounded-full prep-time-progress-bar',
                  prepWarningLevel === 'critical' ? 'bg-[var(--tablet-danger)]' :
                  prepWarningLevel === 'warning' ? 'bg-[var(--tablet-warning)]' :
                  'bg-[var(--tablet-success)]'
                )}
                style={{ width: `${prepTimeData.percentRemaining}%` }}
              />
            </div>
          </div>
        )}

        <div className="mt-3 flex items-center justify-between text-sm text-[var(--tablet-muted)]">
          <div className="flex items-center gap-2">
            <span>{itemCount} item{itemCount !== 1 ? 's' : ''}</span>
            <span className="px-2.5 py-0.5 rounded-full text-xs bg-[var(--tablet-surface-alt)] border border-[var(--tablet-border)] text-[var(--tablet-muted-strong)] normal-case">
              {getChannelIcon(o.channel)} {o.channel || 'POS'}
            </span>
            {o.order_type && (
              <span className="px-2.5 py-0.5 rounded-full text-xs bg-[var(--tablet-surface-alt)] border border-[var(--tablet-border)] text-[var(--tablet-muted-strong)] uppercase tracking-wide">
                {o.order_type}
              </span>
            )}
          </div>
          <span className="text-[var(--tablet-text)] font-semibold">{formatMoney(o.total_amount)}</span>
        </div>

        {hasPendingAction && (
          <div className="mt-2 text-xs font-semibold uppercase text-[var(--tablet-accent)]">
            Pending Sync
          </div>
        )}

        <div className="mt-4 flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setOrderDetailsOrder(o);
            }}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-semibold uppercase bg-[var(--tablet-surface-alt)] border border-[var(--tablet-border)] hover:bg-[var(--tablet-border)] transition touch-manipulation"
          >
            <Eye className="h-4 w-4" />
            View Details
          </button>
        </div>
      </button>
    );
  }, [now, pendingActions, selectedOrder?.id]);
  const { soundEnabled, toggleSound } = useOrderAlerts(receivedOrders.length);

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
    if (typeof window === 'undefined') return;
    if (receivedOrders.length > 0 && soundEnabled) {
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
  }, [receivedOrders.length, soundEnabled]);

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

      <div className="no-print flex min-h-screen flex-col md:flex-row">
        <TabletSidebar statusDotClassName={isOnline && socketConnected ? 'bg-emerald-400' : 'bg-amber-400'} />

        <main className="flex-1 bg-[var(--tablet-bg)] text-[var(--tablet-text)] px-4 py-4 sm:px-6 md:px-6 lg:px-8">
          <div className="flex flex-col gap-5 lg:gap-6">
            {/* Header with search and filters */}
            <div className="flex flex-col gap-4">
              <OrdersHeader
                connectionClasses={connectionClasses}
                connectionLabel={connectionLabel}
                cachedAt={cachedAt}
                soundEnabled={soundEnabled}
                toggleSound={toggleSound}
                isFullscreen={isFullscreen}
                onFullscreenToggle={() => {
                  if (!document.fullscreenElement) {
                    document.documentElement.requestFullscreen();
                  } else {
                    document.exitFullscreen();
                  }
                }}
                now={now}
                refresh={refresh}
                loading={loading}
              />

              {/* Quick Stats Bar */}
              <div className="flex flex-wrap gap-2">
                <div className="px-3 py-1.5 rounded-lg bg-[var(--tablet-accent)] text-[var(--tablet-accent-contrast)] text-xs font-semibold">
                  {activeOrders.length} Active
                </div>
                <div className="px-3 py-1.5 rounded-lg bg-[var(--tablet-accent)]/50 text-[var(--tablet-text)] text-xs font-semibold">
                  {receivedOrders.length} New
                </div>
                <div className="px-3 py-1.5 rounded-lg bg-[var(--tablet-info)]/30 text-[var(--tablet-text)] text-xs font-semibold">
                  {activeOrders.filter(o => normalizeStatus(o.status) === 'preparing').length} In Progress
                </div>
                <div className="px-3 py-1.5 rounded-lg bg-[var(--tablet-success)]/30 text-[var(--tablet-text)] text-xs font-semibold">
                  {activeOrders.filter(o => normalizeStatus(o.status) === 'ready').length} Ready
                </div>
              </div>

              <div className="rounded-xl border border-[var(--tablet-border)] bg-[var(--tablet-surface)] p-3 flex flex-wrap gap-3 items-center justify-between">
                <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm">
                  <span className="font-semibold">Sync Queue: {actionQueue.length}</span>
                  <span className="text-[var(--tablet-muted)]">
                    Last Success: {lastSuccessfulSyncAt ? new Date(lastSuccessfulSyncAt).toLocaleTimeString() : 'Never'}
                  </span>
                  <span className={clsx(
                    'px-2 py-1 rounded-full text-xs font-semibold uppercase',
                    syncAttemptStatus === 'syncing' && 'bg-[var(--tablet-info)]/30 text-[var(--tablet-text)]',
                    syncAttemptStatus === 'success' && 'bg-[var(--tablet-success)]/30 text-[var(--tablet-text)]',
                    syncAttemptStatus === 'error' && 'bg-[var(--tablet-danger)]/30 text-[var(--tablet-text)]',
                    syncAttemptStatus === 'idle' && 'bg-[var(--tablet-border)] text-[var(--tablet-muted-strong)]'
                  )}>
                    {syncAttemptStatus}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={retryQueueNow}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--tablet-info)]/30 border border-[var(--tablet-border)]"
                  >
                    Retry Now
                  </button>
                  <button
                    type="button"
                    onClick={clearFailedActions}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--tablet-danger)]/20 border border-[var(--tablet-border)]"
                  >
                    Clear Failed
                  </button>
                </div>
              </div>

              {/* Search and Filter Bar */}
              <OrderFiltersBar>
                {/* Search Input */}
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-[var(--tablet-muted)]" />
                  <input
                    type="text"
                    placeholder="Search orders..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-11 pr-10 py-3.5 rounded-xl border border-[var(--tablet-border)] bg-[var(--tablet-surface)] text-[var(--tablet-text)] placeholder-[var(--tablet-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--tablet-accent)] focus:border-transparent transition-all text-base"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1.5 rounded-full hover:bg-[var(--tablet-border)] transition touch-manipulation"
                    >
                      <X className="h-4 w-4 text-[var(--tablet-muted)]" />
                    </button>
                  )}
                </div>

                {/* Filter Toggle */}
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={clsx(
                    'flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl border transition-all touch-manipulation min-h-[48px]',
                    showFilters || statusFilter !== 'all' || channelFilter !== 'all'
                      ? 'bg-[var(--tablet-accent)] border-[var(--tablet-accent)] text-[var(--tablet-accent-contrast)]'
                      : 'bg-[var(--tablet-surface)] border-[var(--tablet-border)] text-[var(--tablet-text)]'
                  )}
                >
                  <Filter className="h-5 w-5" />
                  <span className="font-semibold">Filters</span>
                  {(statusFilter !== 'all' || channelFilter !== 'all') && (
                    <span className="ml-1 px-2 py-0.5 rounded-full text-xs bg-[var(--tablet-accent-contrast)] text-[var(--tablet-accent)]">
                      {[statusFilter !== 'all' && statusFilter, channelFilter !== 'all' && channelFilter].filter(Boolean).length}
                    </span>
                  )}
                </button>

                {/* Sort Dropdown */}
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as OrderFilter['sortBy'])}
                  className="px-4 py-3.5 rounded-xl border border-[var(--tablet-border)] bg-[var(--tablet-surface)] text-[var(--tablet-text)] focus:outline-none focus:ring-2 focus:ring-[var(--tablet-accent)] cursor-pointer min-h-[48px]"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="prep-time">Prep Time</option>
                </select>
              </OrderFiltersBar>

              {/* Quick Filter Chips */}
              <div className="flex flex-wrap gap-2 mt-2">
                <button
                  onClick={() => setStatusFilter('all')}
                  className={clsx(
                    'px-3 py-1.5 rounded-lg text-xs font-semibold transition touch-manipulation',
                    statusFilter === 'all'
                      ? 'bg-[var(--tablet-accent)] text-[var(--tablet-accent-contrast)]'
                      : 'bg-[var(--tablet-surface)] border border-[var(--tablet-border)] text-[var(--tablet-text)] hover:bg-[var(--tablet-surface-alt)]'
                  )}
                >
                  All
                </button>
                <button
                  onClick={() => setStatusFilter('received')}
                  className={clsx(
                    'px-3 py-1.5 rounded-lg text-xs font-semibold transition touch-manipulation',
                    statusFilter === 'received'
                      ? 'bg-[var(--tablet-accent)] text-[var(--tablet-accent-contrast)]'
                      : 'bg-[var(--tablet-surface)] border border-[var(--tablet-border)] text-[var(--tablet-text)] hover:bg-[var(--tablet-surface-alt)]'
                  )}
                >
                  New ({receivedOrders.length})
                </button>
                <button
                  onClick={() => setStatusFilter('preparing')}
                  className={clsx(
                    'px-3 py-1.5 rounded-lg text-xs font-semibold transition touch-manipulation',
                    statusFilter === 'preparing'
                      ? 'bg-[var(--tablet-accent)] text-[var(--tablet-accent-contrast)]'
                      : 'bg-[var(--tablet-surface)] border border-[var(--tablet-border)] text-[var(--tablet-text)] hover:bg-[var(--tablet-surface-alt)]'
                  )}
                >
                  In Progress
                </button>
                <button
                  onClick={() => setStatusFilter('ready')}
                  className={clsx(
                    'px-3 py-1.5 rounded-lg text-xs font-semibold transition touch-manipulation',
                    statusFilter === 'ready'
                      ? 'bg-[var(--tablet-accent)] text-[var(--tablet-accent-contrast)]'
                      : 'bg-[var(--tablet-surface)] border border-[var(--tablet-border)] text-[var(--tablet-text)] hover:bg-[var(--tablet-surface-alt)]'
                  )}
                >
                  Ready
                </button>
              </div>

              {/* Expanded Filters Panel */}
              {showFilters && (
                <div className="flex flex-wrap gap-4 p-4 rounded-xl bg-[var(--tablet-surface)] border border-[var(--tablet-border)] animate-fade-in">
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--tablet-muted)] mb-2">
                      Status
                    </label>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value as OrderFilter['status'])}
                      className="w-full px-3 py-2 rounded-lg border border-[var(--tablet-border)] bg-[var(--tablet-bg)] text-[var(--tablet-text)] focus:outline-none focus:ring-2 focus:ring-[var(--tablet-accent)]"
                    >
                      <option value="all">All Statuses</option>
                      <option value="received">New Orders</option>
                      <option value="preparing">In Progress</option>
                      <option value="ready">Ready</option>
                    </select>
                  </div>
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--tablet-muted)] mb-2">
                      Channel
                    </label>
                    <select
                      value={channelFilter}
                      onChange={(e) => setChannelFilter(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-[var(--tablet-border)] bg-[var(--tablet-bg)] text-[var(--tablet-text)] focus:outline-none focus:ring-2 focus:ring-[var(--tablet-accent)]"
                    >
                      <option value="all">All Channels</option>
                      {channels.map(channel => (
                        <option key={channel} value={channel}>{channel}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={() => {
                        setStatusFilter('all');
                        setChannelFilter('all');
                        setSearchQuery('');
                        setSortBy('newest');
                      }}
                      className="px-4 py-2 rounded-lg border border-[var(--tablet-border)] text-[var(--tablet-muted)] hover:text-[var(--tablet-text)] hover:bg-[var(--tablet-surface-alt)] transition"
                    >
                      Clear All
                    </button>
                  </div>
                </div>
              )}

              {/* Active Filters Display */}
              {(searchQuery || statusFilter !== 'all' || channelFilter !== 'all') && (
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-xs text-[var(--tablet-muted)]">Showing:</span>
                  {searchQuery && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-[var(--tablet-info)] text-white">
                      Search: "{searchQuery}"
                      <button onClick={() => setSearchQuery('')} className="ml-1">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  )}
                  {statusFilter !== 'all' && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-[var(--tablet-accent)] text-[var(--tablet-accent-contrast)]">
                      {statusFilter}
                      <button onClick={() => setStatusFilter('all')} className="ml-1">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  )}
                  {channelFilter !== 'all' && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-[var(--tablet-surface-alt)] border border-[var(--tablet-border)]">
                      {channelFilter}
                      <button onClick={() => setChannelFilter('all')} className="ml-1">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  )}
                </div>
              )}
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
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5 tablet-orders-responsive">
                {/* Left Panel: Order Queue */}
                <section className="bg-[var(--tablet-surface)] rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.3)] border border-[var(--tablet-border)] flex flex-col min-h-[50vh] md:min-h-[60vh] lg:min-h-[70vh]">
                  <div className="px-4 py-4 border-b border-[var(--tablet-border)] flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-semibold uppercase text-[var(--tablet-accent)]">
                      Order Lanes
                      <ChevronDown className="h-4 w-4" />
                    </div>
                    <div className="text-xs font-semibold text-[var(--tablet-muted)]">{filtered.length} Active</div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 h-full">
                      {laneGroups.map((lane) => (
                        <div key={lane.key} className="rounded-xl border border-[var(--tablet-border)] bg-[var(--tablet-card)]/40 flex flex-col min-h-[260px]">
                          <div className="px-3 py-3 border-b border-[var(--tablet-border)] flex items-center justify-between">
                            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--tablet-muted)]">{lane.label}</span>
                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[var(--tablet-surface-alt)] text-[var(--tablet-text)]">
                              {lane.orders.length}
                            </span>
                          </div>
                          <div className="p-3 space-y-3 overflow-y-auto max-h-[52vh]">
                            {lane.orders.length === 0 ? (
                              <div className="text-xs text-[var(--tablet-muted)] uppercase tracking-wide py-6 text-center">
                                No {lane.label.toLowerCase()} orders
                              </div>
                            ) : (
                              lane.orders.map((o, index) => renderOrderCard(o, index))
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                {/* Middle Panel: Order Details */}
                <OrderDetailsPanel>
                  {/* Order Details */}
                  <div className="bg-[var(--tablet-surface)] rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.3)] border border-[var(--tablet-border)]">
                    <div className="px-5 py-4 border-b border-[var(--tablet-border)]">
                      <div className="text-xl font-semibold">
                        {selectedOrder ? (
                          <>ORDER #{selectedOrder.external_id ? selectedOrder.external_id.slice(-4).toUpperCase() : selectedOrder.id.slice(-4).toUpperCase()} - {(selectedOrder.customer_name || 'Guest').toUpperCase()}</>
                        ) : (
                          'ORDER DETAILS'
                        )}
                      </div>
                    </div>
                    {selectedOrder ? (
                      <div className="px-5 py-5 space-y-5">
                        <div className="flex items-center justify-between border-b border-[var(--tablet-border)] pb-4">
                          <span className="text-sm text-[var(--tablet-muted)] uppercase">Total Cost</span>
                          <span className="text-2xl font-semibold">{formatMoney(selectedOrder.total_amount)}</span>
                        </div>

                        <div>
                          <div className="text-lg font-semibold mb-3">Items ({selectedOrder.items?.length || 0})</div>
                          <div className="space-y-3 max-h-[280px] sm:max-h-[320px] overflow-y-auto pr-2 scrollbar-thin">
                            {(selectedOrder.items || []).map((it, idx) => (
                              <div key={idx} className="flex items-center gap-4 pb-3 border-b border-[var(--tablet-border)] last:border-0">
                                <div className="h-12 w-12 rounded-lg bg-[var(--tablet-border-strong)] flex items-center justify-center text-sm text-[var(--tablet-muted)] font-semibold">
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
                      <div className="px-5 py-16 text-center text-[var(--tablet-muted)]">
                        Select an order to view details.
                      </div>
                    )}
                  </div>

                </OrderDetailsPanel>

                {/* Right Panel: Customer + Actions */}
                <CustomerActionsPanel>
                  <div className="bg-[var(--tablet-surface)] rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.3)] border border-[var(--tablet-border)]">
                    <div className="px-5 py-4 border-b border-[var(--tablet-border)]">
                      <div className="text-lg font-semibold">Customer</div>
                    </div>
                    {selectedOrder ? (
                      <div className="px-5 py-5 space-y-5">
                        <div className="flex items-center gap-4">
                          <div className="h-12 w-12 rounded-full bg-[var(--tablet-border-strong)] flex items-center justify-center text-lg font-semibold">
                            {(selectedOrder.customer_name || 'G')[0]}
                          </div>
                          <div className="flex-1">
                            <div className="text-lg font-semibold">{selectedOrder.customer_name || 'Guest'}</div>
                            <div className="text-sm text-[var(--tablet-muted)]">{selectedOrder.customer_phone || 'No contact provided'}</div>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-3 text-sm">
                          <span className="text-xs uppercase tracking-widest text-[var(--tablet-muted)]">
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
                          <span className={clsx('px-3 py-1 rounded-full text-xs font-semibold uppercase text-center', statusBadgeClassesForStatus(normalizeStatus(selectedOrder.status)))}>
                            {normalizeStatus(selectedOrder.status)}
                          </span>
                          <span className="px-3 py-1 rounded-full text-xs font-semibold uppercase text-center bg-[var(--tablet-border)] text-[var(--tablet-muted-strong)]">
                            {selectedOrder.channel || 'POS'}
                          </span>
                        </div>

                        {selectedOrder.special_instructions && (
                          <div className="bg-[var(--tablet-border)] rounded-lg p-4">
                            <div className="text-xs uppercase tracking-widest text-[var(--tablet-accent)] mb-2">
                              Special Instructions
                            </div>
                            <div className="text-sm text-[var(--tablet-text)] opacity-90">{selectedOrder.special_instructions}</div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="px-5 py-12 text-center text-[var(--tablet-muted)]">
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
                            className="h-14 rounded-full bg-[var(--tablet-accent)] text-[var(--tablet-accent-contrast)] font-semibold uppercase shadow-[0_2px_8px_rgba(0,0,0,0.3)] transition hover:brightness-110 active:scale-95 disabled:opacity-50 touch-manipulation"
                          >
                            Confirm Order
                          </button>
                          <button
                            disabled={busyId === selectedOrder.id}
                            onClick={() => declineOrder(selectedOrder)}
                            className="h-14 rounded-full border-2 border-[var(--tablet-border-strong)] text-[var(--tablet-text)] font-semibold uppercase transition hover:brightness-110 active:scale-95 disabled:opacity-50 touch-manipulation"
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
                            className="h-14 rounded-full bg-[var(--tablet-success)] text-white font-semibold uppercase shadow-[0_2px_8px_rgba(0,0,0,0.3)] transition hover:brightness-110 active:scale-95 disabled:opacity-50 touch-manipulation"
                          >
                            Ready for Pickup
                          </button>
                          <button
                            onClick={() => printOrder(selectedOrder.id)}
                            disabled={printingOrderId === selectedOrder.id}
                            className="h-14 rounded-full border-2 border-[var(--tablet-border-strong)] text-[var(--tablet-text)] font-semibold uppercase transition hover:brightness-110 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 touch-manipulation"
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
                            className="h-14 rounded-full bg-[var(--tablet-success)] text-white font-semibold uppercase shadow-[0_2px_8px_rgba(0,0,0,0.3)] transition hover:brightness-110 active:scale-95 disabled:opacity-50 touch-manipulation"
                          >
                            Complete Order
                          </button>
                          <button
                            className="h-14 rounded-full border-2 border-[var(--tablet-border-strong)] text-[var(--tablet-text)] font-semibold uppercase transition hover:brightness-110 active:scale-95 touch-manipulation"
                            type="button"
                          >
                            Assign Driver
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </CustomerActionsPanel>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Order Details Modal */}
      <OrderDetailsModal
        order={orderDetailsOrder}
        onClose={() => setOrderDetailsOrder(null)}
        onPrint={(orderId) => {
          printOrder(orderId);
          setOrderDetailsOrder(null);
        }}
        formatMoney={formatMoney}
      />

      {false && (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-[var(--tablet-surface)] rounded-3xl shadow-[0_12px_30px_rgba(0,0,0,0.5)] w-full max-w-2xl max-h-[90vh] overflow-hidden border border-[var(--tablet-border)] flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-[var(--tablet-border)] flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold">
                  Order #{orderDetailsOrder.external_id ? orderDetailsOrder.external_id.slice(-4).toUpperCase() : orderDetailsOrder.id.slice(-4).toUpperCase()}
                </h3>
                <p className="text-sm text-[var(--tablet-muted)]">
                  {orderDetailsOrder.customer_name || 'Guest'} • {getChannelIcon(orderDetailsOrder.channel)} {orderDetailsOrder.channel || 'POS'}
                </p>
              </div>
              <button
                onClick={() => setOrderDetailsOrder(null)}
                className="p-2 rounded-full hover:bg-[var(--tablet-border)] transition"
              >
                <X className="h-6 w-6 text-[var(--tablet-muted)]" />
              </button>
            </div>

            {/* Modal Content - Scrollable */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Order Info */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-[var(--tablet-bg)] rounded-xl p-3">
                  <div className="text-xs text-[var(--tablet-muted)] uppercase tracking-wide">Status</div>
                  <div className="mt-1">
                    <span className={clsx('px-2 py-1 rounded-full text-xs font-semibold', statusBadgeClassesForStatus(normalizeStatus(orderDetailsOrder.status)))}>
                      {normalizeStatus(orderDetailsOrder.status)}
                    </span>
                  </div>
                </div>
                <div className="bg-[var(--tablet-bg)] rounded-xl p-3">
                  <div className="text-xs text-[var(--tablet-muted)] uppercase tracking-wide">Type</div>
                  <div className="mt-1 font-semibold">{orderDetailsOrder.order_type || 'Pickup'}</div>
                </div>
                <div className="bg-[var(--tablet-bg)] rounded-xl p-3">
                  <div className="text-xs text-[var(--tablet-muted)] uppercase tracking-wide">Time</div>
                  <div className="mt-1 font-semibold">
                    {orderDetailsOrder.pickup_time
                      ? new Date(orderDetailsOrder.pickup_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : 'ASAP'}
                  </div>
                </div>
                <div className="bg-[var(--tablet-bg)] rounded-xl p-3">
                  <div className="text-xs text-[var(--tablet-muted)] uppercase tracking-wide">Total</div>
                  <div className="mt-1 text-lg font-semibold">{formatMoney(orderDetailsOrder.total_amount)}</div>
                </div>
              </div>

              {/* Customer Info */}
              <div className="bg-[var(--tablet-bg)] rounded-xl p-4">
                <h4 className="text-sm font-semibold uppercase tracking-wide text-[var(--tablet-muted)] mb-3">Customer</h4>
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-[var(--tablet-border-strong)] flex items-center justify-center text-lg font-semibold">
                    {(orderDetailsOrder.customer_name || 'G')[0]}
                  </div>
                  <div>
                    <div className="font-semibold">{orderDetailsOrder.customer_name || 'Guest'}</div>
                    <div className="text-sm text-[var(--tablet-muted)]">{orderDetailsOrder.customer_phone || 'No contact provided'}</div>
                  </div>
                </div>
              </div>

              {/* Items */}
              <div>
                <h4 className="text-sm font-semibold uppercase tracking-wide text-[var(--tablet-muted)] mb-3">Items ({orderDetailsOrder.items?.length || 0})</h4>
                <div className="space-y-3">
                  {(orderDetailsOrder.items || []).map((item, idx) => (
                    <div key={idx} className="flex items-center gap-4 p-3 bg-[var(--tablet-bg)] rounded-xl">
                      <div className="h-10 w-10 rounded-lg bg-[var(--tablet-border-strong)] flex items-center justify-center font-semibold text-sm">
                        {item.quantity || 1}
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold">{item.name}</div>
                        <div className="text-sm text-[var(--tablet-muted)]">
                          {formatMoney(item.unit_price || item.price || 0)} each
                        </div>
                      </div>
                      <div className="font-semibold">
                        {formatMoney((item.unit_price || item.price || 0) * (item.quantity || 1))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Special Instructions */}
              {orderDetailsOrder.special_instructions && (
                <div className="bg-[var(--tablet-warning)]/10 border border-[var(--tablet-warning)]/30 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-[var(--tablet-warning)] flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold text-[var(--tablet-warning)] mb-1">Special Instructions</div>
                      <div className="text-sm">{orderDetailsOrder.special_instructions}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-[var(--tablet-border)] flex gap-3">
              <button
                onClick={() => {
                  printOrder(orderDetailsOrder.id);
                  setOrderDetailsOrder(null);
                }}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-[var(--tablet-border-strong)] font-semibold uppercase transition hover:brightness-110"
              >
                <Printer className="h-5 w-5" />
                Print
              </button>
              <button
                onClick={() => setOrderDetailsOrder(null)}
                className="flex-1 py-3 rounded-xl bg-[var(--tablet-accent)] text-[var(--tablet-accent-contrast)] font-semibold uppercase transition hover:opacity-90"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

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


      <style jsx global>{`
        body {
          overscroll-behavior-y: contain;
          -webkit-tap-highlight-color: transparent;
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
        /* Tablet portrait */
        @media (min-width: 640px) and (max-width: 1023px) {
          .tablet-theme main {
            padding: 1rem;
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
