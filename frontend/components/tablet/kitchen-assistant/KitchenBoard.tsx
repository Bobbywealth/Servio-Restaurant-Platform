import React, { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { clsx } from 'clsx';
import { Order, OrdersResponse } from '../../../hooks/tablet/ordersTypes';
import { ORDER_STATUS, OrderStatus, postOrderStatus } from '../../../hooks/tablet/orderStatus';
import { api } from '../../../lib/api';
import { safeLocalStorage } from '../../../lib/utils';
import { CountdownTimer } from '../orders/CountdownTimer';
import { OrderDetailsModal } from '../orders/OrderDetailsModal';

const ORDER_CACHE_KEY = 'servio_cached_orders';

type TabType = 'all' | 'needs-action' | 'in-progress';

interface Tab {
  name: string;
  id: TabType;
  status?: OrderStatus;
}

const TABS: Tab[] = [
  { name: 'All', id: 'all' },
  { name: 'Needs action', id: 'needs-action', status: ORDER_STATUS.RECEIVED },
  { name: 'In progress', id: 'in-progress', status: ORDER_STATUS.PREPARING },
];

const statusStyles = {
  [ORDER_STATUS.RECEIVED]: {
    rail: 'bg-amber-500',
    badge: 'border-amber-300 bg-amber-50 text-amber-700',
    timer: 'text-amber-600',
  },
  [ORDER_STATUS.PREPARING]: {
    rail: 'bg-blue-500',
    badge: 'border-blue-300 bg-blue-50 text-blue-700',
    timer: 'text-blue-600',
  },
  [ORDER_STATUS.READY]: {
    rail: 'bg-emerald-500',
    badge: 'border-emerald-300 bg-emerald-50 text-emerald-700',
    timer: 'text-emerald-600',
  },
  [ORDER_STATUS.COMPLETED]: {
    rail: 'bg-gray-500',
    badge: 'border-gray-300 bg-gray-50 text-gray-700',
    timer: 'text-gray-600',
  },
  [ORDER_STATUS.CANCELLED]: {
    rail: 'bg-red-500',
    badge: 'border-red-300 bg-red-50 text-red-700',
    timer: 'text-red-600',
  },
  scheduled: {
    rail: 'bg-violet-500',
    badge: 'border-violet-300 bg-violet-50 text-violet-700',
    timer: 'text-violet-600',
  },
};

interface KitchenBoardProps {
  orders: Order[];
  setOrders: Dispatch<SetStateAction<Order[]>>;
  onAcceptOrder: (order: Order) => void;
  onDeclineOrder: (order: Order) => void;
  onMarkReady: (order: Order) => void;
  onMarkPickedUp: (order: Order) => void;
  busyId: string | null;
}

export function KitchenBoard({
  orders,
  onAcceptOrder,
  onDeclineOrder,
  onMarkReady,
  onMarkPickedUp,
  busyId,
}: KitchenBoardProps) {
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [printOrderId, setPrintOrderId] = useState<string | null>(null);

  const { filteredOrders, tabCounts } = useMemo(() => {
    const counts = {
      all: orders.length,
      'needs-action': 0,
      'in-progress': 0,
    };

    const filtered = orders.filter((order) => {
      const status = order.status as OrderStatus;
      
      if (status === ORDER_STATUS.RECEIVED) {
        counts['needs-action']++;
      } else if (status === ORDER_STATUS.PREPARING) {
        counts['in-progress']++;
      } else if (status === ORDER_STATUS.CANCELLED) {
        // Don't show cancelled orders
        return false;
      }

      // Filter by tab
      if (activeTab === 'all') return true;
      if (activeTab === 'needs-action') return status === ORDER_STATUS.RECEIVED;
      if (activeTab === 'in-progress') return status === ORDER_STATUS.PREPARING;
      return true;
    });

    return { filteredOrders: filtered, tabCounts: counts };
  }, [orders, activeTab]);

  const getActionButton = (order: Order) => {
    const status = order.status as OrderStatus;
    const isBusy = busyId === order.id;

    if (status === ORDER_STATUS.RECEIVED) {
      return (
        <div className="grid grid-cols-2 gap-2 pt-2">
          <button
            onClick={() => onAcceptOrder(order)}
            disabled={isBusy}
            className="rounded-lg bg-blue-600 text-white py-2 font-semibold hover:bg-blue-700 disabled:opacity-50"
          >
            {isBusy ? 'Accepting...' : 'Accept'}
          </button>
          <button
            onClick={() => onDeclineOrder(order)}
            disabled={isBusy}
            className="rounded-lg border border-slate-300 py-2 font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      );
    }

    if (status === ORDER_STATUS.PREPARING) {
      return (
        <button
          onClick={() => onMarkReady(order)}
          disabled={isBusy}
          className="w-full rounded-lg bg-slate-800 text-white py-2 font-semibold hover:bg-slate-700 disabled:opacity-50"
        >
          {isBusy ? 'Marking...' : 'Ready for pickup'}
        </button>
      );
    }

    if (status === ORDER_STATUS.READY) {
      return (
        <button
          onClick={() => onMarkPickedUp(order)}
          disabled={isBusy}
          className="w-full rounded-lg bg-emerald-600 text-white py-2 font-semibold hover:bg-emerald-700 disabled:opacity-50"
        >
          {isBusy ? 'Marking...' : 'Mark as picked up'}
        </button>
      );
    }

    return null;
  };

  const getOrderAge = (createdAt: string | null | undefined): string => {
    if (!createdAt) return '';
    const created = new Date(createdAt);
    const now = new Date();
    const diffMs = now.getTime() - created.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ${diffMins % 60}m`;
    return `${Math.floor(diffHours / 24)}d ${diffHours % 24}h`;
  };

  const formatPickupTime = (pickupTime: string | null | undefined): string => {
    if (!pickupTime) return '';
    const date = new Date(pickupTime);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const getStatusLabel = (status: string | null | undefined): string => {
    if (status === ORDER_STATUS.RECEIVED) return 'Needs action';
    if (status === ORDER_STATUS.PREPARING) return 'In progress';
    if (status === ORDER_STATUS.READY) return 'Ready';
    if (status === ORDER_STATUS.COMPLETED) return 'Completed';
    if (status === ORDER_STATUS.CANCELLED) return 'Cancelled';
    return status || 'Unknown';
  };

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6">
      <div className="mx-auto max-w-[1600px]">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {/* HEADER */}
          <div className="border-b border-slate-200 bg-slate-50 px-6 py-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div /> {/* Spacer to maintain alignment */}
              </div>

              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-700">
                  Kitchen Online
                </div>
                <div className="rounded-lg bg-white border border-slate-200 px-4 py-1.5 text-sm font-semibold text-slate-700">
                  {new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                </div>
              </div>
            </div>

            {/* FILTER TABS */}
            <div className="mt-4 overflow-x-auto">
              <div className="flex gap-2">
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={clsx(
                      'rounded-lg border px-4 py-2 text-sm font-medium transition',
                      activeTab === tab.id
                        ? 'border-blue-300 bg-blue-50 text-blue-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                    )}
                  >
                    {tab.name}
                    <span className="ml-2 rounded-md bg-slate-100 px-2 py-0.5 text-xs">
                      {tabCounts[tab.id] || 0}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ORDER BOARD */}
          <div className="overflow-x-auto px-6 py-6">
            {filteredOrders.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-slate-500 text-lg">No orders in this view</p>
              </div>
            ) : (
              <div className="flex min-w-max gap-5">
                {filteredOrders.map((order) => {
                  const style = statusStyles[order.status as OrderStatus] || statusStyles.scheduled;
                  const items = order.items || [];
                  const totalItems = items.reduce((sum, item) => sum + (item.quantity || item.qty || 0), 0);

                  return (
                    <div
                      key={order.id}
                      className="relative w-[320px] shrink-0 rounded-xl border border-slate-200 bg-white shadow-sm cursor-pointer hover:shadow-lg hover:border-blue-300 transition-all"
                      onClick={() => setSelectedOrder(order)}
                    >
                      <div className={clsx('absolute left-0 top-0 h-full w-1', style.rail)} />

                      {/* ORDER HEADER */}
                      <div className="border-b border-slate-200 px-5 py-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="text-xs font-semibold text-slate-500 uppercase">
                              {getStatusLabel(order.status)}
                            </div>
                            <div className="text-2xl font-semibold text-slate-900">
                              {order.customer_name || 'Guest'}
                            </div>
                          </div>

                          {order.status === ORDER_STATUS.PREPARING && (
                            <div className="text-right">
                              <div className="text-xs text-slate-500">Ready in</div>
                              <div className={clsx('text-2xl font-semibold', style.timer)}>
                                {order.prep_minutes ? `${order.prep_minutes}m` : '--'}
                              </div>
                            </div>
                          )}

                          {order.status === ORDER_STATUS.RECEIVED && (
                            <div className="text-right">
                              <div className="text-xs text-slate-500">Accept by</div>
                              <div className={clsx('text-2xl font-semibold', style.timer)}>
                                <CountdownTimer
                                  orderReceivedAt={order.created_at}
                                  durationSeconds={180}
                                  visible={true}
                                  orderType={order.order_type}
                                />
                              </div>
                            </div>
                          )}

                          {order.status === ORDER_STATUS.READY && (
                            <div className={clsx('text-xs font-semibold border px-2 py-1 rounded', style.badge)}>
                              Ready
                            </div>
                          )}
                        </div>
                      </div>

                      {/* ORDER BODY */}
                      <div className="space-y-4 px-5 py-4">
                        <div className="text-slate-700 font-medium">
                          {order.order_type === 'delivery' ? 'Delivery' : order.order_type === 'pickup' ? 'Pickup' : 'Dine-in'} •{' '}
                          {order.channel || 'Online'}
                        </div>

                        <div className="space-y-2 text-sm text-slate-600">
                          {order.pickup_time && (
                            <div>🕒 Pickup at {formatPickupTime(order.pickup_time)}</div>
                          )}
                          <div>👜 {totalItems} items</div>
                          <div>🍴 {order.order_type === 'dine-in' ? 'Dine-in' : 'No utensils'}</div>
                        </div>

                        <div className="border-t border-slate-200 pt-3" />

                        {items.map((item, index) => (
                          <div key={index} className="flex justify-between">
                            <div className="flex gap-2">
                              <span className="font-semibold text-blue-600">
                                {item.quantity || item.qty || 1}
                              </span>
                              <span className="text-slate-800 font-medium">
                                {item.name}
                              </span>
                            </div>
                            <div className="font-semibold text-slate-900">
                              ${((item.unit_price || item.price || 0) * (item.quantity || item.qty || 1)).toFixed(2)}
                            </div>
                          </div>
                        ))}

                        {/* Modifiers/Extras */}
                        {items.some((item) => item.modifiers && (Array.isArray(item.modifiers) ? item.modifiers.length > 0 : Object.keys(item.modifiers).length > 0)) && (
                          <div className="text-sm text-slate-500">
                            <div className="font-medium">Extras</div>
                            {items.map((item, idx) => {
                              const mods = item.modifiers;
                              if (!mods) return null;
                              const modArray = Array.isArray(mods) ? mods : Object.values(mods);
                              return modArray.map((mod: any, modIdx: number) => (
                                <div key={modIdx}>{typeof mod === 'string' ? mod : mod.name || mod}</div>
                              ));
                            })}
                          </div>
                        )}

                        {/* Special Instructions */}
                        {order.special_instructions && (
                          <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-700">
                            {order.special_instructions}
                          </div>
                        )}

                        {/* ACTION BUTTONS */}
                        {getActionButton(order)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Order Details Modal */}
      {selectedOrder && (
        <OrderDetailsModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onConfirmOrder={(order) => {
            onAcceptOrder(order);
            setSelectedOrder(null);
          }}
          onDeclineOrder={(order) => {
            onDeclineOrder(order);
            setSelectedOrder(null);
          }}
          onSetStatus={(orderId, status) => {
            // Handle status change
            setSelectedOrder(null);
          }}
          onPrintOrder={(orderId) => {
            // Trigger print - would need to integrate with printing system
            setPrintOrderId(orderId);
          }}
          busyOrderId={busyId}
          printingOrderId={printOrderId}
          formatMoney={(v) => `$${(v || 0).toFixed(2)}`}
        />
      )}
    </div>
  );
}

// Hook to load and manage orders with real-time updates
export function useKitchenBoardOrders() {
  const [orders, setOrders] = React.useState<Order[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    try {
      const res = await api.get('/api/orders?limit=50&offset=0');
      const json = res.data as OrdersResponse;
      const list = Array.isArray(json?.data?.orders) ? json.data.orders : [];
      setOrders(list || []);
    } catch (error) {
      console.error('Failed to load orders:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const setStatus = React.useCallback(async (orderId: string, status: OrderStatus) => {
    setBusyId(orderId);
    // Optimistic update
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status } : o)));
    try {
      await postOrderStatus(api, orderId, status);
    } catch (error) {
      console.error('Failed to update order status:', error);
      // Revert on error
      refresh();
    } finally {
      setBusyId(null);
    }
  }, [refresh]);

  const acceptOrder = React.useCallback(async (order: Order) => {
    await setStatus(order.id, ORDER_STATUS.PREPARING);
  }, [setStatus]);

  const declineOrder = React.useCallback(async (order: Order) => {
    await setStatus(order.id, ORDER_STATUS.CANCELLED);
  }, [setStatus]);

  const markReady = React.useCallback(async (order: Order) => {
    await setStatus(order.id, ORDER_STATUS.READY);
  }, [setStatus]);

  const markPickedUp = React.useCallback(async (order: Order) => {
    await setStatus(order.id, ORDER_STATUS.COMPLETED);
  }, [setStatus]);

  React.useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 10000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  return { 
    orders, 
    loading, 
    refresh, 
    busyId,
    acceptOrder, 
    declineOrder, 
    markReady, 
    markPickedUp 
  };
}
