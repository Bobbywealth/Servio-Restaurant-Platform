import Head from 'next/head';
import { useEffect, useMemo, useRef, useState, useCallback, KeyboardEvent, MouseEvent } from 'react';
import { useRouter } from 'next/router';
import clsx from 'clsx';
import {
  Search,
  X,
  AlertTriangle,
} from 'lucide-react';
import { useSocket } from '../../lib/socket';
import { api } from '../../lib/api';
import { PrintReceipt } from '../../components/PrintReceipt';
import { TabletSidebar } from '../../components/tablet/TabletSidebar';
import { OrdersHeader } from '../../components/tablet/orders/OrdersHeader';
import { OrderFiltersBar } from '../../components/tablet/orders/OrderFiltersBar';
import { OrderDetailsModal } from '../../components/tablet/orders/OrderDetailsModal';
import { useOrderAlerts } from '../../hooks/tablet/useOrderAlerts';
import type { ReceiptPaperWidth } from '../../utils/receiptGenerator';
import { safeLocalStorage } from '../../lib/utils';
import { useUser } from '../../contexts/UserContext';
import { ORDER_STATUS, TABLET_STATUS_ACTION, mapTabletStatusActionToOrderStatus } from '../../hooks/tablet/orderStatus';
import type { OrderStatus } from '../../hooks/tablet/orderStatus';
import { NotificationEventPayload, shouldRefreshForNotification } from '../../lib/tablet/orderNotifications';
import { CountdownTimer } from '../../components/tablet/orders/CountdownTimer';

// Local apiGet helper - mirrors the pattern used in hooks
async function apiGet<T>(path: string): Promise<T> {
  const res = await api.get<T>(path);
  return res.data;
}

// Import shared types and utilities
import type { Order, OrderItem, OrdersResponse, PendingAction } from '../../components/tablet/orders/types';
import {
  normalizeStatus,
  formatMoney,
  formatTimeAgo,
  getOrderUrgencyLevel,
  matchesSearchQuery,
  isArchivedOrder,
  normalizeOrderItems,
  getChannelIcon,
  shortId,
  formatPrepTimeRemaining,
  getStatusLabel,
  LiveOrderCard,
  STATUS_STYLES,
  URGENCY_CONFIG,
  STALE_ORDER_THRESHOLD_MINUTES,
  PREP_TIME_THRESHOLDS,
} from '../../components/tablet/orders';

// Import custom hooks
import { useOrders } from '../../hooks/tablet/useOrders';
import { useSyncQueue } from '../../hooks/tablet/useSyncQueue';
import { useOrderActions } from '../../hooks/tablet/useOrderActions';
import { useOrderPrint } from '../../hooks/tablet/useOrderPrint';

// Types are imported from shared module
// Utility functions are imported from shared module
// Constants are imported from shared module

export default function TabletOrdersPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useUser();
  const socket = useSocket();
  
  // Use custom hooks for business logic
  const {
    orders,
    loading,
    now,
    filteredOrders,
    receivedOrders,
    preparingOrders,
    readyOrders,
    attentionOrdersCount,
    statusFilter,
    setStatusFilter,
    channelFilter,
    setChannelFilter,
    sortBy,
    setSortBy,
    searchQuery,
    setSearchQuery,
    needsAttentionOnly,
    setNeedsAttentionOnly,
    channels,
    refresh,
  } = useOrders({ enabled: false });
  
  const {
    actionQueue,
    pendingActions,
    syncAttemptStatus,
    enqueueAction,
    processActionQueue,
    retryQueueNow,
    clearFailedActions,
    upsertStatusSyncFailure,
  } = useSyncQueue();
  
  // Order actions hook
  const {
    busyId,
    setStatus,
    acceptOrder,
    declineOrder,
    setPrepTime,
  } = useOrderActions({
    enqueueAction: enqueueAction as (action: { id: string; orderId: string; type: string; payload: unknown; queuedAt: number }) => void,
    onSyncFailure: upsertStatusSyncFailure,
    socket,
  });
  
  // Print hook
  const {
    autoPrintEnabled,
    setAutoPrintEnabled,
    paperWidth,
    setPaperWidth,
    printMode,
    setPrintMode,
    fontSize,
    setFontSize,
    headerText,
    setHeaderText,
    footerText,
    setFooterText,
    printingOrderId,
    lastPrintResult,
    receiptHtml,
    setReceiptHtml,
    printOrder,
    printTestReceipt,
    fetchRestaurantProfile,
  } = useOrderPrint({
    onRestaurantProfileChange: () => {}, // Placeholder - restaurant profile state not used
  });
  
  // Local UI state (kept for modal and UI-specific state)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [socketConnected, setSocketConnected] = useState<boolean>(socket.connected);
  const [showUpdateBanner, setShowUpdateBanner] = useState(false);
  
  // New feature toggles
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showArchivedOrders, setShowArchivedOrders] = useState(false);
  const [orderDetailsOrder, setOrderDetailsOrder] = useState<Order | null>(null);
  const [prepModalOrder, setPrepModalOrder] = useState<Order | null>(null);
  const [prepMinutes, setPrepMinutes] = useState<number>(15);
  const [isDesktopLayout, setIsDesktopLayout] = useState(false);
  const [isTabletLayout, setIsTabletLayout] = useState(false);
  const [autoPrintPendingId, setAutoPrintPendingId] = useState<string | null>(null);
  const [printedOrders, setPrintedOrders] = useState<Set<string>>(new Set());
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const pollTimeoutRef = useRef<number | null>(null);
  const lastRefreshAt = useRef(0);
  const refreshInFlightRef = useRef(false);
  const refreshFailureCountRef = useRef(0);
  const printedOrdersRef = useRef<Set<string>>(new Set());
  const hasInitializedPrintedRef = useRef(false);
  const lastAutoPromptedId = useRef<string | null>(null);
  const orderQueryRetryRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Desktop: 1024px+
    const desktopQuery = window.matchMedia('(min-width: 1024px)');
    // Tablet: 768px - 1023px
    const tabletQuery = window.matchMedia('(min-width: 768px) and (max-width: 1023px)');
    
    const updateLayout = () => {
      setIsDesktopLayout(desktopQuery.matches);
      setIsTabletLayout(tabletQuery.matches);
    };
    updateLayout();

    desktopQuery.addEventListener('change', updateLayout);
    tabletQuery.addEventListener('change', updateLayout);
    return () => {
      desktopQuery.removeEventListener('change', updateLayout);
      tabletQuery.removeEventListener('change', updateLayout);
    };
  }, []);

  const handleSearchToggle = useCallback(() => {
    setIsSearchOpen(true);
  }, []);

  const handleSearchClear = useCallback(() => {
    setSearchQuery('');
    setIsSearchOpen(false);
  }, []);

  const handleSearchBlur = useCallback(() => {
    if (!searchQuery.trim()) {
      setIsSearchOpen(false);
    }
  }, [searchQuery]);

  const handleSearchKeyDown = useCallback((event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      setSearchQuery('');
      setIsSearchOpen(false);
      searchInputRef.current?.blur();
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      if (!searchQuery.trim()) {
        setIsSearchOpen(false);
      }
      searchInputRef.current?.blur();
    }
  }, [searchQuery]);

  const openAcceptModal = useCallback((order: Order) => {
    setPrepModalOrder(order);
    const initialPrepMinutes = typeof order.prep_minutes === 'number' && Number.isFinite(order.prep_minutes) && order.prep_minutes > 0
      ? order.prep_minutes
      : 15;
    setPrepMinutes(initialPrepMinutes);
  }, []);

  // Get unique channels for filter dropdown - renamed to avoid conflict with useOrders hook
  const localChannels = useMemo(() => {
    const channelSet = new Set<string>();
    orders.forEach(o => {
      if (o.channel) channelSet.add(o.channel);
    });
    return Array.from(channelSet).sort();
  }, [orders]);

  // Helper to remove auth tokens
  const removeAuthTokens = () => {
    if (typeof window === 'undefined') return;
    safeLocalStorage.removeItem('servio_access_token');
    safeLocalStorage.removeItem('servio_refresh_token');
    safeLocalStorage.removeItem('servio_user');
  };

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
    setSocketConnected(socket.connected);
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

  // Extended idle timeout - 8 hours for tablet use (restaurant shift duration)
  // Session is kept alive by _app.tsx proactive token refresh
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const idleMs = 8 * 60 * 60 * 1000;
    let idleTimer: number | null = null;
    let lastActivity = Date.now();

    const handleIdleLogout = () => {
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

    // Note: setLastPrintResult is not exported from useOrderPrint hook
    // The hook handles lastPrintResult internally
    
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
          console.log('[DEBUG] Tablet loading fontSize from server settings:', size);
          setFontSize(size);
          safeLocalStorage.setItem('servio_font_size', size);
        } else {
          console.log('[DEBUG] Tablet - printer_font_size not in valid values. Value:', settings.printer_font_size);
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

  const refreshOrders = useCallback(async () => {
    if (refreshInFlightRef.current) return;
    refreshInFlightRef.current = true;
    try {
      await refresh();
      refreshFailureCountRef.current = 0;
      lastRefreshAt.current = Date.now();
    } catch (error) {
      refreshFailureCountRef.current += 1;
      throw error;
    } finally {
      refreshInFlightRef.current = false;
    }
  }, [refresh]);

  const handleSetStatus = useCallback(async (orderId: string, nextStatus: OrderStatus) => {
    await setStatus(orderId, nextStatus);
    await refreshOrders();
  }, [refreshOrders, setStatus]);

  const handleDeclineOrder = useCallback(async (order: Order) => {
    await declineOrder(order);
    await refreshOrders();
  }, [declineOrder, refreshOrders]);

  const handleAcceptOrder = useCallback(async (order: Order, minutes: number) => {
    await acceptOrder(order, minutes);
    await refreshOrders();
  }, [acceptOrder, refreshOrders]);

  // Initial data load (polling is managed in a separate effect)
  useEffect(() => {
    void refreshOrders();
    fetchRestaurantProfile();
  }, [fetchRestaurantProfile, refreshOrders]);

  // Polling owner with visibility pause + exponential backoff
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const clearPollTimeout = () => {
      if (pollTimeoutRef.current !== null) {
        window.clearTimeout(pollTimeoutRef.current);
        pollTimeoutRef.current = null;
      }
    };

    const getPollDelayMs = () => {
      const nextDelay = 10000 * Math.pow(2, Math.min(refreshFailureCountRef.current, 2));
      return Math.min(nextDelay, 40000);
    };

    const scheduleNextPoll = () => {
      clearPollTimeout();
      if (document.visibilityState === 'hidden') return;

      pollTimeoutRef.current = window.setTimeout(async () => {
        if (Date.now() - lastRefreshAt.current < 5000) {
          scheduleNextPoll();
          return;
        }
        try {
          await refreshOrders();
        } catch {
          // backoff state is already tracked by refreshOrders
        } finally {
          scheduleNextPoll();
        }
      }, getPollDelayMs());
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        clearPollTimeout();
        return;
      }
      void refreshOrders().catch(() => undefined).finally(scheduleNextPoll);
    };

    scheduleNextPoll();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearPollTimeout();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [refreshOrders]);

  useEffect(() => {
    processActionQueue();
    const t = window.setInterval(() => {
      processActionQueue();
    }, 15000);
    return () => window.clearInterval(t);
  }, [processActionQueue]);

  useEffect(() => {
    if (!socket) return;

    const handleNewNotification = (data: NotificationEventPayload | null | undefined) => {
      if (shouldRefreshForNotification(data)) {
        void refreshOrders();
      }
    };

    const handlePrinterTest = () => {
      printTestReceipt();
    };

    // Handle new orders from website/public ordering
    const handleNewOrder = async (data: { orderId: string; totalAmount?: number }) => {
      console.log('[tablet] New order received via socket:', data);
      void refreshOrders();
    };

    // Handle order status changes from other clients
    const handleOrderStatusChanged = async (data: { orderId: string; previousStatus?: string; status: string; timestamp?: Date }) => {
      console.log('[tablet] Order status changed via socket:', data);
      void refreshOrders();
      setSelectedOrder(prev => {
        if (prev?.id === data.orderId) {
          return { ...prev, status: data.status };
        }
        return prev;
      });
    };

    socket.on('notifications.new', handleNewNotification);
    socket.on('printer.test', handlePrinterTest);
    socket.on('new-order', handleNewOrder);
    socket.on('order:status_changed', handleOrderStatusChanged);
    return () => {
      socket.off('notifications.new', handleNewNotification);
      socket.off('printer.test', handlePrinterTest);
      socket.off('new-order', handleNewOrder);
      socket.off('order:status_changed', handleOrderStatusChanged);
    };
  }, [socket, refreshOrders, printTestReceipt]);

  // Local order processing (deduplicated) - renamed to avoid conflict with useOrders hook
  const localActiveOrders = useMemo(() => {
    const activeStatuses = new Set(['received', 'preparing', 'ready']);
    // Deduplicate by order ID to prevent the same order from appearing multiple times
    const seen = new Set<string>();
    return orders.filter((o) => {
      if (seen.has(o.id)) return false;
      seen.add(o.id);
      return activeStatuses.has(normalizeStatus(o.status));
    });
  }, [orders]);

  const localAttentionOrdersCount = useMemo(() => {
    return localActiveOrders.filter((order) => {
      const { elapsedMinutes } = formatTimeAgo(order.created_at, now);
      return getOrderUrgencyLevel(elapsedMinutes) !== 'normal';
    }).length;
  }, [localActiveOrders, now]);

  const lateOrdersCount = useMemo(() => {
    return localActiveOrders.filter((order) => {
      const { elapsedMinutes } = formatTimeAgo(order.created_at, now);
      return getOrderUrgencyLevel(elapsedMinutes) === 'critical';
    }).length;
  }, [localActiveOrders, now]);

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

  useEffect(() => {
    if (!selectedOrder) return;
    const nextSelectedOrder = orders.find((order) => order.id === selectedOrder.id);
    if (!nextSelectedOrder) {
      setSelectedOrder(null);
      return;
    }

    if (nextSelectedOrder !== selectedOrder) {
      setSelectedOrder(nextSelectedOrder);
    }
  }, [orders, selectedOrder]);

  useEffect(() => {
    if (!isDesktopLayout) return;
    setOrderDetailsOrder(null);
  }, [isDesktopLayout]);

  useEffect(() => {
    if (!router.isReady) return;

    const rawOrderId = router.query.orderId;
    const orderId = Array.isArray(rawOrderId) ? rawOrderId[0] : rawOrderId;
    if (!orderId) return;

    const matchingOrder = orders.find((order) => order.id === orderId);

    const clearOrderIdQuery = () => {
      const { orderId: _orderId, ...restQuery } = router.query;
      router.replace({ pathname: router.pathname, query: restQuery }, undefined, { shallow: true });
    };

    if (matchingOrder) {
      setSelectedOrder(matchingOrder);
      if (!isDesktopLayout) {
        setOrderDetailsOrder({ ...matchingOrder, items: normalizeOrderItems(matchingOrder.items) });
      }
      orderQueryRetryRef.current.delete(orderId);
      clearOrderIdQuery();
      return;
    }

    if (orderQueryRetryRef.current.has(orderId)) return;
    orderQueryRetryRef.current.add(orderId);
    refresh();
  }, [isDesktopLayout, orders, refresh, router]);

  const { activeQueueOrders, archivedOrders } = useMemo(() => {
    const activeQueue: Order[] = [];
    const archived: Order[] = [];

    filteredOrders.forEach((order) => {
      if (isArchivedOrder(order, now)) {
        archived.push(order);
        return;
      }
      activeQueue.push(order);
    });

    return { activeQueueOrders: activeQueue, archivedOrders: archived };
  }, [filteredOrders, now]);

  const localReceivedOrders = useMemo(() => {
    return activeQueueOrders.filter((o) => normalizeStatus(o.status) === 'received');
  }, [activeQueueOrders]);

  const localPreparingOrders = useMemo(() => {
    return activeQueueOrders.filter((o) => normalizeStatus(o.status) === 'preparing');
  }, [activeQueueOrders]);

  const localReadyOrders = useMemo(() => {
    return activeQueueOrders.filter((o) => normalizeStatus(o.status) === 'ready');
  }, [activeQueueOrders]);

  const queueSections = useMemo(() => ([
    { key: 'received' as const, label: 'New', orders: localReceivedOrders },
    { key: 'preparing' as const, label: 'In Progress', orders: localPreparingOrders },
    { key: 'ready' as const, label: 'Ready', orders: localReadyOrders },
  ]), [localReceivedOrders, localPreparingOrders, localReadyOrders]);

  const visibleSections = useMemo(() => {
    if (statusFilter === 'all') {
      return queueSections;
    }

    return queueSections.filter((section) => section.key === statusFilter);
  }, [queueSections, statusFilter]);

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

  const renderOrderActions = useCallback((order: Order, options?: { stopPropagation?: boolean; className?: string; disabled?: boolean; showPickedUpAction?: boolean }) => {
    const status = normalizeStatus(order.status);
    const shouldStopPropagation = Boolean(options?.stopPropagation);
    const showPickedUpAction = options?.showPickedUpAction ?? true;
    const isActionBusy = options?.disabled ?? (busyId === order.id || pendingActions.has(order.id));

    const stopIfNeeded = (event: MouseEvent<HTMLButtonElement>) => {
      if (shouldStopPropagation) event.stopPropagation();
    };

    return (
      <div className={clsx(options?.className ?? 'mt-3 pt-3 border-t border-[var(--tablet-border)] flex items-center gap-2')}>
        {status === 'received' && (
          <>
            <button
              type="button"
              disabled={isActionBusy}
              onClick={(event) => {
                stopIfNeeded(event);
                openAcceptModal(order);
              }}
              className="flex-1 min-h-[44px] rounded-lg px-3 py-2 text-sm font-semibold text-[var(--tablet-accent-contrast)] bg-[var(--tablet-accent)] transition active:brightness-95 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:saturate-50"
            >
              Accept
            </button>
            <button
              type="button"
              disabled={isActionBusy}
              onClick={(event) => {
                stopIfNeeded(event);
                handleDeclineOrder(order);
              }}
              className="flex-1 min-h-[44px] rounded-lg px-3 py-2 text-sm font-semibold border border-[var(--tablet-danger)] text-[var(--tablet-danger)] transition active:bg-[var(--tablet-danger)]/10 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Reject
            </button>
          </>
        )}

        {status === 'preparing' && (
          <button
            type="button"
            disabled={isActionBusy}
            onClick={(event) => {
              stopIfNeeded(event);
              handleSetStatus(order.id, 'ready');
            }}
            className="w-full min-h-[44px] rounded-lg px-3 py-2 text-sm font-semibold text-[var(--tablet-accent-contrast)] bg-[var(--tablet-success)] transition active:brightness-95 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:saturate-50"
          >
            Mark Ready
          </button>
        )}

        {status === 'ready' && (
          <>
            <button
              type="button"
              disabled={isActionBusy}
              onClick={(event) => {
                stopIfNeeded(event);
                handleSetStatus(order.id, 'completed');
              }}
              className="flex-1 min-h-[44px] rounded-lg px-3 py-2 text-sm font-semibold text-[var(--tablet-success-action-contrast)] bg-[var(--tablet-success-action)] transition active:bg-[var(--tablet-success-action-active)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tablet-success-action)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--tablet-card)] disabled:opacity-50 disabled:cursor-not-allowed disabled:saturate-50 disabled:active:scale-100"
            >
              Complete
            </button>
            {showPickedUpAction && (
              <button
                type="button"
                disabled={isActionBusy}
                onClick={(event) => {
                  stopIfNeeded(event);
                  handleSetStatus(order.id, mapTabletStatusActionToOrderStatus(TABLET_STATUS_ACTION.PICKED_UP));
                }}
                className="flex-1 min-h-[44px] rounded-lg px-3 py-2 text-sm font-semibold border border-[var(--tablet-border-strong)] text-[var(--tablet-text)] transition active:bg-[color-mix(in_srgb,var(--tablet-surface-alt)_65%,var(--tablet-border-strong)_35%)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tablet-border-strong)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--tablet-card)] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
              >
                Picked Up
              </button>
            )}
          </>
        )}
      </div>
    );
  }, [busyId, pendingActions]);

  const renderOrderCard = useCallback((o: Order, laneIndex: number, options?: { isArchived?: boolean }) => {
    const isArchived = Boolean(options?.isArchived);
    const status = normalizeStatus(o.status);
    const isPreparing = status === 'preparing';
    const timeAgo = formatTimeAgo(o.created_at, now);
    const itemCount = (o.items || []).reduce((sum, it) => sum + (it.quantity || 1), 0);
    const hasPendingAction = pendingActions.has(o.id);
    const isActionBusy = busyId === o.id || hasPendingAction || isArchived;
    const isSelected = selectedOrder?.id === o.id;
    const prepTimeData = isPreparing ? formatPrepTimeRemaining(o.prep_minutes || 15, o.created_at, now) : null;

    const statusLabel = status === 'received' ? 'Needs action' : status === 'preparing' ? 'In progress' : status === 'ready' ? 'Ready' : 'Scheduled';
    const statusStyles = {
      received: { rail: 'bg-amber-500', badge: 'border-amber-300 bg-amber-50 text-amber-700', timer: 'text-amber-600' },
      preparing: { rail: 'bg-blue-500', badge: 'border-blue-300 bg-blue-50 text-blue-700', timer: 'text-blue-600' },
      ready: { rail: 'bg-emerald-500', badge: 'border-emerald-300 bg-emerald-50 text-emerald-700', timer: 'text-emerald-600' },
      default: { rail: 'bg-violet-500', badge: 'border-violet-300 bg-violet-50 text-violet-700', timer: 'text-violet-600' }
    } as const;

    const style = statusStyles[status as keyof typeof statusStyles] || statusStyles.default;

    const openOrderDetails = async () => {
      setSelectedOrder(o);
      if (!isDesktopLayout) {
        setOrderDetailsOrder({ ...o, items: normalizeOrderItems(o.items) });
      }
      try {
        const response = await apiGet<{ success: boolean; data?: Order }>(`/api/orders/${encodeURIComponent(o.id)}`);
        if (!response?.success || !response.data) return;
        const detailedOrder = { ...response.data, items: normalizeOrderItems(response.data.items) };
        if (!isDesktopLayout) setOrderDetailsOrder(detailedOrder);
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
        className={clsx('relative w-[320px] shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm', isSelected && 'ring-2 ring-blue-300', isArchived && 'opacity-60')}
      >
        <div className={clsx('absolute left-0 top-0 h-full w-1', style.rail)} />
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{statusLabel}</div>
              <div className="text-2xl font-semibold text-slate-900">{o.customer_name || 'Guest'}</div>
            </div>
            {prepTimeData ? (
              <div className="text-right">
                <div className="text-xs text-slate-500">Ready in</div>
                <div className={clsx('text-2xl font-semibold', style.timer)}>{prepTimeData.text.replace('Overdue by ', '-')}</div>
              </div>
            ) : (
              <div className={clsx('rounded border px-2 py-1 text-xs font-semibold', style.badge)}>{statusLabel}</div>
            )}
          </div>
        </div>
        <div className="space-y-4 px-5 py-4">
          <div className="font-medium text-slate-700">{o.channel || o.order_type || 'Order'}</div>
          <div className="space-y-2 text-sm text-slate-600">
            <div>🕒 {o.pickup_time ? `Pickup at ${new Date(o.pickup_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : 'Pickup time pending'}</div>
            <div>👜 {itemCount} items</div>
            <div>⏱️ {timeAgo.text} ago</div>
          </div>
          <div className="border-t border-slate-200 pt-3" />
          {(o.items || []).slice(0, 3).map((item, index) => (
            <div key={`${o.id}-${index}`} className="flex justify-between gap-3 text-sm">
              <div className="flex gap-2">
                <span className="font-semibold text-blue-600">{item.quantity || 1}</span>
                <span className="font-medium text-slate-800">{item.name || 'Item'}</span>
              </div>
              <div className="font-semibold text-slate-900">{formatMoney(item.unit_price ?? item.price)}</div>
            </div>
          ))}
          {o.special_instructions && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">{o.special_instructions}</div>
          )}
          {renderOrderActions(o, { stopPropagation: true, disabled: isActionBusy, className: 'pt-2' })}
        </div>
      </div>
    );
  }, [busyId, isDesktopLayout, now, pendingActions, renderOrderActions, selectedOrder]);

  const { soundEnabled, toggleSound } = useOrderAlerts(receivedOrders);

  const connectionText = isOnline ? (socketConnected ? 'Online' : 'Reconnecting') : 'Offline';
  const connectionDotClasses = isOnline
    ? socketConnected
      ? 'bg-emerald-400'
      : 'bg-amber-400'
    : 'bg-red-400';

  const activeFilterChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; onClear: () => void; tone: string }> = [];

    if (searchQuery) {
      chips.push({
        key: 'search',
        label: `Search: "${searchQuery}"`,
        onClear: handleSearchClear,
        tone: 'bg-[var(--tablet-info)]/25 border border-[var(--tablet-border)]'
      });
    }

    if (statusFilter !== 'all') {
      chips.push({
        key: 'status',
        label: statusFilter,
        onClear: () => setStatusFilter('all'),
        tone: 'bg-[var(--tablet-accent)] text-[var(--tablet-accent-contrast)]'
      });
    }

    if (channelFilter !== 'all') {
      chips.push({
        key: 'channel',
        label: channelFilter,
        onClear: () => setChannelFilter('all'),
        tone: 'bg-[var(--tablet-surface-alt)] border border-[var(--tablet-border)]'
      });
    }

    if (needsAttentionOnly) {
      chips.push({
        key: 'attention',
        label: 'Needs attention',
        onClear: () => setNeedsAttentionOnly(false),
        tone: 'bg-[color-mix(in_srgb,var(--tablet-danger)_16%,transparent)] border border-[var(--tablet-danger)]/40 text-[var(--tablet-danger)]'
      });
    }

    return chips;
  }, [searchQuery, statusFilter, channelFilter, needsAttentionOnly, handleSearchClear]);

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <p className="text-sm text-gray-300">Redirecting to login…</p>
      </div>
    );
  }

  return (
    <div className="tablet-theme tablet-orders-theme min-h-screen bg-slate-100 text-slate-800 font-sans">
      <Head>
        <title>Orders • Servio</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=yes" />
      </Head>

      {/* Print-only receipt (duplicate copies) */}
      <div id="print-root" className="print-only">
        {receiptHtml ? <PrintReceipt receiptHtml={receiptHtml} copies={2} paperWidth={paperWidth} /> : null}
      </div>

      <div className="no-print flex min-h-screen flex-col md:flex-row">
        <TabletSidebar statusDotClassName={isOnline && socketConnected ? 'bg-emerald-400' : 'bg-amber-400'} />

        <main className="flex-1 bg-slate-100 text-slate-800 p-4 md:p-6">
          <div className="mx-auto max-w-[1800px]">
            {/* NEW KDS-STYLE HEADER */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm mb-6">
              <div className="border-b border-slate-200 bg-slate-50 px-6 py-5">
                <div className="flex items-start justify-between gap-4">
                  {/* FILTER TABS */}
                  <div className="min-w-0 flex-1 overflow-x-auto">
                    <div className="flex gap-2 flex-nowrap">
                      {[
                        { key: 'all' as const, label: 'All', count: localActiveOrders.length },
                        { key: 'received' as const, label: 'Needs action', count: receivedOrders.length },
                        { key: 'preparing' as const, label: 'In progress', count: preparingOrders.length },
                        { key: 'ready' as const, label: 'Ready', count: readyOrders.length },
                      ].map((segment) => {
                        const isActive = statusFilter === segment.key;
                        return (
                          <button
                            key={segment.key}
                            type="button"
                            onClick={() => setStatusFilter(segment.key)}
                            className={clsx(
                              'rounded-lg border px-4 py-2 text-sm font-medium transition whitespace-nowrap',
                              isActive
                                ? 'border-blue-300 bg-blue-50 text-blue-700'
                                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                            )}
                          >
                            {segment.label}
                            <span className="ml-2 rounded-md bg-slate-100 px-2 py-0.5 text-xs">
                              {segment.count}
                            </span>
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        onClick={() => setNeedsAttentionOnly(!needsAttentionOnly)}
                        className={clsx(
                          'rounded-lg border px-4 py-2 text-sm font-medium transition whitespace-nowrap',
                          needsAttentionOnly
                            ? 'border-amber-300 bg-amber-50 text-amber-700'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                        )}
                      >
                        Needs attention
                        <span className="ml-2 rounded-md bg-slate-100 px-2 py-0.5 text-xs">
                          {attentionOrdersCount}
                        </span>
                      </button>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-3">
                    <div className={clsx(
                      'rounded-lg px-3 py-1 text-sm font-medium',
                      isOnline && socketConnected ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                    )}>
                      {isOnline && socketConnected ? 'Kitchen Online' : 'Reconnecting...'}
                    </div>
                    <div className="rounded-lg bg-white border border-slate-200 px-4 py-1.5 text-sm font-semibold text-slate-700">
                      {now ? new Date(now).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '--:--'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {showUpdateBanner && (
              <div className="bg-white text-slate-800 px-4 py-3 flex items-center justify-between rounded-xl border border-slate-300 shadow-sm mb-4">
                <div className="font-semibold">Update available — refresh to get the latest tablet improvements.</div>
                <button
                  type="button"
                  className="bg-blue-600 text-white px-3 py-1 rounded-lg font-semibold hover:bg-blue-700"
                  onClick={() => window.location.reload()}
                >
                  Refresh
                </button>
              </div>
            )}

            {/* KDS ORDER BOARD - Full width horizontal scrolling */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto px-6 py-6">
                {filteredOrders.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-slate-500 text-lg">No orders in this view</p>
                  </div>
                ) : (
                  <div className="flex min-w-max gap-5">
                    {filteredOrders.map((order) => (
                      <LiveOrderCard
                        key={order.id}
                        order={order}
                        now={now}
                        isActionBusy={busyId === order.id}
                        onAccept={openAcceptModal}
                        onReject={handleDeclineOrder}
                        onMarkReady={(liveOrder) => handleSetStatus(liveOrder.id, ORDER_STATUS.READY)}
                        onPickedUp={(liveOrder) => handleSetStatus(liveOrder.id, ORDER_STATUS.COMPLETED)}
                        onViewDetails={setOrderDetailsOrder}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Order Details Modal - for viewing order details */}
      <OrderDetailsModal
        order={orderDetailsOrder}
        onClose={() => setOrderDetailsOrder(null)}
        onConfirmOrder={(order) => {
          openAcceptModal(order);
          setOrderDetailsOrder(null);
        }}
        onDeclineOrder={(order) => {
          handleDeclineOrder(order);
          setOrderDetailsOrder(null);
        }}
        onSetStatus={(orderId, status) => {
          handleSetStatus(orderId, status);
          if (status === ORDER_STATUS.COMPLETED) {
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
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-lg">
            <h3 className="text-lg font-semibold text-slate-800">Accept order #{shortId(prepModalOrder.id)}</h3>
            <p className="mt-2 text-sm text-slate-500">Set prep time before moving this order to In Progress.</p>

            {/* Quick select preset buttons */}
            <div className="mt-4">
              <p className="text-sm font-medium text-slate-700 mb-2">Quick select</p>
              <div className="flex flex-wrap gap-2">
                {[5, 10, 15, 20, 30, 45].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setPrepMinutes(mins)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      prepMinutes === mins
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {mins} min
                  </button>
                ))}
              </div>
            </div>

            <label className="mt-4 block text-sm font-medium text-slate-700" htmlFor="prep-minutes-input">
              Or enter custom time
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
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            <div className="mt-5 flex items-center gap-2">
              <button
                type="button"
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 font-semibold text-slate-700 hover:bg-slate-50"
                onClick={() => setPrepModalOrder(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="flex-1 rounded-lg bg-blue-600 px-3 py-2 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                onClick={async () => {
                  if (!prepModalOrder) return;
                  const orderToAccept = prepModalOrder;
                  const boundedMinutes = Math.min(180, Math.max(1, Number(prepMinutes) || 15));
                  await handleAcceptOrder(orderToAccept, boundedMinutes);

                  if (autoPrintEnabled) {
                    void printOrder(orderToAccept.id);
                  } else {
                    setAutoPrintPendingId(orderToAccept.id);
                  }

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

      {autoPrintPendingId && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-lg">
            <h3 className="text-lg font-semibold text-slate-800">Order accepted</h3>
            <p className="mt-2 text-sm text-slate-500">Would you like to print this order now?</p>

            <div className="mt-5 flex items-center gap-2">
              <button
                type="button"
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 font-semibold text-slate-700 hover:bg-slate-50"
                onClick={() => setAutoPrintPendingId(null)}
              >
                Not now
              </button>
              <button
                type="button"
                className="flex-1 rounded-lg bg-blue-600 px-3 py-2 font-semibold text-white hover:bg-blue-700"
                onClick={() => {
                  void printOrder(autoPrintPendingId);
                  setAutoPrintPendingId(null);
                }}
              >
                Print now
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
