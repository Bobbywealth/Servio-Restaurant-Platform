import React, { useEffect, useMemo, useState, useCallback } from 'react'
import Head from 'next/head'
import DashboardLayout from '../../components/Layout/DashboardLayout'
import { useUser } from '../../contexts/UserContext'
import { api } from '../../lib/api'
import { useSocket } from '../../lib/socket'
import { RefreshCw, Filter, ClipboardList, ShoppingBag, ExternalLink, Eye, X, User, Phone, MapPin, CreditCard, Clock, Package } from 'lucide-react'

type OrderStatus = 'received' | 'preparing' | 'ready' | 'completed' | 'cancelled'

interface OrderItem {
  name?: string
  quantity?: number
  price?: number
}

interface Order {
  id: string
  external_id?: string
  channel?: string
  status: OrderStatus
  customer_name?: string
  customer_phone?: string
  total_amount?: number
  // Older integrations may store items JSON on orders.items, while website orders live in order_items.
  items?: OrderItem[]
  orderItems?: Array<{
    name?: string | null
    quantity?: number | null
    unitPrice?: number | null
    notes?: string | null
  }>
  created_at?: string
  updated_at?: string
}

interface OrdersSummary {
  totalOrders: number
  activeOrders: number
  completedToday: number
  avgOrderValue: number
  ordersByStatus: Record<string, number>
  ordersByChannel: Record<string, number>
}

const statusLabel: Record<OrderStatus, string> = {
  received: 'Received',
  preparing: 'Preparing',
  ready: 'Ready',
  completed: 'Completed',
  cancelled: 'Cancelled'
}

function statusBadgeClass(status: OrderStatus) {
  if (status === 'ready' || status === 'completed') return 'status-success'
  if (status === 'received' || status === 'preparing') return 'status-warning'
  return 'status-error'
}

export default function OrdersPage() {
  const { user, hasPermission } = useUser()
  const socket = useSocket()
  const [orders, setOrders] = useState<Order[]>([])
  const [summary, setSummary] = useState<OrdersSummary | null>(null)
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all')
  const [channelFilter, setChannelFilter] = useState<string>('all')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null)
  const [restaurantSlug, setRestaurantSlug] = useState<string | null>(null)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [orderDetails, setOrderDetails] = useState<any>(null)
  const [loadingDetails, setLoadingDetails] = useState(false)

  const canUpdateOrders = hasPermission('orders:write')

  const channels = useMemo(() => {
    const set = new Set<string>()
    orders.forEach(o => {
      if (o.channel) set.add(o.channel)
    })
    return Array.from(set).sort()
  }, [orders])

  const fetchRestaurantSlug = async () => {
    if (!user?.restaurantId) return
    try {
      const response = await api.get(`/api/restaurants/${user.restaurantId}`)
      const slug = response.data?.data?.slug
      if (slug) {
        setRestaurantSlug(slug)
      }
    } catch (e: any) {
      console.warn('Failed to fetch restaurant slug:', e.message)
    }
  }

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [ordersRes, summaryRes] = await Promise.all([
        api.get('/api/orders', {
          params: {
            status: statusFilter === 'all' ? undefined : statusFilter,
            channel: channelFilter === 'all' ? undefined : channelFilter,
            limit: 50,
            offset: 0
          }
        }),
        api.get('/api/orders/stats/summary')
      ])

      const nextOrders: Order[] = ordersRes.data?.data?.orders || []
      setOrders(nextOrders)
      setSummary(summaryRes.data?.data || null)
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || e?.message || 'Failed to load orders')
    } finally {
      setIsLoading(false)
    }
  }, [statusFilter, channelFilter])

  useEffect(() => {
    if (!hasPermission('orders:read')) return
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, channelFilter])

  useEffect(() => {
    fetchRestaurantSlug()
  }, [user?.restaurantId])

  useEffect(() => {
    if (!socket || !user?.restaurantId || !hasPermission('orders:read')) return
    socket.joinRestaurantRoom(user.restaurantId)
    const onNew = () => fetchData()
    const onUpdated = () => fetchData()
    socket.on('order:new', onNew as any)
    socket.on('order:updated', onUpdated as any)
    return () => {
      socket.off('order:new', onNew as any)
      socket.off('order:updated', onUpdated as any)
    }
  }, [socket, user?.restaurantId, hasPermission, fetchData])

  const updateOrderStatus = async (orderId: string, status: OrderStatus) => {
    if (!canUpdateOrders) return
    setUpdatingOrderId(orderId)
    setError(null)
    try {
      await api.post(`/api/orders/${orderId}/status`, {
        status,
        userId: user?.id || 'system'
      })
      
      // Notify other clients via socket
      if (socket) {
        socket.emit('order:status_changed', { orderId, status, timestamp: new Date() })
      }
      
      await fetchData()
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || e?.message || 'Failed to update order')
    } finally {
      setUpdatingOrderId(null)
    }
  }

  const viewOrderDetails = async (order: Order) => {
    setSelectedOrder(order)
    setLoadingDetails(true)
    setOrderDetails(null)
    try {
      const response = await api.get(`/api/orders/${order.id}`)
      setOrderDetails(response.data?.data)
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || e?.message || 'Failed to load order details')
    } finally {
      setLoadingDetails(false)
    }
  }

  const closeOrderDetails = () => {
    setSelectedOrder(null)
    setOrderDetails(null)
  }

  return (
    <>
      <Head>
        <title>Orders - Servio</title>
        <meta name="description" content="Manage orders" />
      </Head>

      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-surface-900 dark:text-surface-100 flex items-center">
                <ClipboardList className="w-6 h-6 mr-2 text-primary-600 dark:text-primary-400" />
                Orders
              </h1>
              <p className="mt-2 text-sm sm:text-base text-surface-600 dark:text-surface-400">
                Track incoming orders and update kitchen progress.
              </p>
            </div>

            <div className="flex gap-3">
              {restaurantSlug && (
                <a
                  href={`/r/${restaurantSlug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary inline-flex items-center bg-emerald-600 hover:bg-emerald-700 text-white"
                  title="Open customer ordering page in new tab"
                >
                  <ShoppingBag className="w-4 h-4 mr-2" />
                  Test Ordering
                  <ExternalLink className="w-4 h-4 ml-1" />
                </a>
              )}
              <button
                className="btn-secondary inline-flex items-center"
                onClick={fetchData}
                disabled={isLoading}
                title="Refresh"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>

          {error && (
            <div className="card border-servio-red-200 dark:border-servio-red-800">
              <div className="status-error">{error}</div>
              <p className="mt-2 text-sm text-surface-600 dark:text-surface-400">
                Make sure the backend is running at <code className="px-1 py-0.5 bg-surface-100 dark:bg-surface-800 rounded">http://localhost:3002</code>.
              </p>
            </div>
          )}

          {summary && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="card">
                <p className="text-sm text-surface-600 dark:text-surface-400">Active Orders</p>
                <p className="mt-1 text-3xl font-bold text-surface-900 dark:text-surface-100">{summary.activeOrders}</p>
              </div>
              <div className="card">
                <p className="text-sm text-surface-600 dark:text-surface-400">Total Orders</p>
                <p className="mt-1 text-3xl font-bold text-surface-900 dark:text-surface-100">{summary.totalOrders}</p>
              </div>
              <div className="card">
                <p className="text-sm text-surface-600 dark:text-surface-400">Completed Today</p>
                <p className="mt-1 text-3xl font-bold text-surface-900 dark:text-surface-100">{summary.completedToday}</p>
              </div>
              <div className="card">
                <p className="text-sm text-surface-600 dark:text-surface-400">Avg Ticket</p>
                <p className="mt-1 text-3xl font-bold text-surface-900 dark:text-surface-100">
                  ${Number(summary.avgOrderValue || 0).toFixed(2)}
                </p>
              </div>
            </div>
          )}

          <div className="card">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center text-sm font-semibold text-surface-900 dark:text-surface-100">
                <Filter className="w-4 h-4 mr-2 text-surface-500 dark:text-surface-400" />
                Filters
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <label className="text-sm text-surface-700 dark:text-surface-300">
                  <span className="mr-2">Status</span>
                  <select
                    className="input-field inline-block w-56"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                  >
                    <option value="all">All</option>
                    <option value="received">Received</option>
                    <option value="preparing">Preparing</option>
                    <option value="ready">Ready</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </label>

                <label className="text-sm text-surface-700 dark:text-surface-300">
                  <span className="mr-2">Channel</span>
                  <select
                    className="input-field inline-block w-56"
                    value={channelFilter}
                    onChange={(e) => setChannelFilter(e.target.value)}
                  >
                    <option value="all">All</option>
                    {channels.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {orders.length === 0 ? (
              <div className="lg:col-span-2 xl:col-span-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
                <ClipboardList className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                  {isLoading ? 'Loading orders…' : 'No orders found'}
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                  {!isLoading && 'Orders will appear here as they come in'}
                </p>
              </div>
            ) : (
              orders.map((o) => {
                const created = o.created_at ? new Date(o.created_at) : null;
                const itemCount = Array.isArray(o.orderItems) ? o.orderItems.length : (Array.isArray(o.items) ? o.items.length : 0);
                const waitingMinutes = created ? Math.floor((Date.now() - created.getTime()) / (1000 * 60)) : 0;

                return (
                  <div key={o.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:shadow-lg transition-all">
                    <div className="flex items-start justify-between mb-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100 truncate">
                            {o.external_id || o.id}
                          </h3>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusBadgeClass(o.status)}`}>
                            {statusLabel[o.status] || o.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            <span>{waitingMinutes}m ago</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Package className="w-4 h-4" />
                            <span>{itemCount} items</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => viewOrderDetails(o)}
                          className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <User className="w-4 h-4 text-gray-500" />
                          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Customer</span>
                        </div>
                        <div className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                          {o.customer_name || 'No name'}
                        </div>
                        {o.customer_phone && (
                          <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                            <Phone className="w-3 h-3" />
                            <span>{o.customer_phone}</span>
                          </div>
                        )}
                      </div>

                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <CreditCard className="w-4 h-4 text-gray-500" />
                          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Total</span>
                        </div>
                        <div className="font-bold text-lg text-gray-900 dark:text-gray-100">
                          {typeof o.total_amount === 'number' ? `$${o.total_amount.toFixed(2)}` : '—'}
                        </div>
                        <div className="text-xs text-gray-500">
                          via {o.channel || 'Unknown'}
                        </div>
                      </div>
                    </div>

                    {canUpdateOrders && (
                      <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                          Update Status
                        </label>
                        <select
                          className="w-full input-field text-sm"
                          value={o.status}
                          disabled={updatingOrderId === o.id}
                          onChange={(e) => updateOrderStatus(o.id, e.target.value as OrderStatus)}
                        >
                          <option value="received">Received</option>
                          <option value="preparing">Preparing</option>
                          <option value="ready">Ready</option>
                          <option value="completed">Completed</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                        {updatingOrderId === o.id && (
                          <div className="mt-2 text-xs text-blue-600 dark:text-blue-400">
                            Updating...
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Order Details Modal */}
          {selectedOrder && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
              <div className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6 rounded-t-xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                        Order Details: {selectedOrder.external_id || selectedOrder.id}
                      </h2>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusBadgeClass(selectedOrder.status)}`}>
                          {statusLabel[selectedOrder.status] || selectedOrder.status}
                        </span>
                        <span className="text-sm text-gray-500">
                          via {selectedOrder.channel}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={closeOrderDetails}
                      className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="p-6 space-y-6">
                  {loadingDetails ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto"></div>
                      <p className="mt-4 text-gray-500">Loading order details...</p>
                    </div>
                  ) : orderDetails ? (
                    <>
                      {/* Customer Information */}
                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                          <User className="w-5 h-5" />
                          Customer Information
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Name</label>
                            <p className="text-gray-900 dark:text-gray-100 font-medium">
                              {orderDetails.customerName || 'No name provided'}
                            </p>
                          </div>
                          {orderDetails.customerPhone && (
                            <div>
                              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Phone</label>
                              <p className="text-gray-900 dark:text-gray-100 font-medium flex items-center gap-2">
                                <Phone className="w-4 h-4" />
                                {orderDetails.customerPhone}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Order Information */}
                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                          <ClipboardList className="w-5 h-5" />
                          Order Information
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Order ID</label>
                            <p className="text-gray-900 dark:text-gray-100 font-mono text-sm">
                              {orderDetails.externalId || orderDetails.id}
                            </p>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Channel</label>
                            <p className="text-gray-900 dark:text-gray-100 font-medium">
                              {orderDetails.channel || 'Unknown'}
                            </p>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Source</label>
                            <p className="text-gray-900 dark:text-gray-100 font-medium">
                              {orderDetails.source || 'Unknown'}
                            </p>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Placed At</label>
                            <p className="text-gray-900 dark:text-gray-100 font-medium flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              {orderDetails.createdAt ? new Date(orderDetails.createdAt).toLocaleString() : 'Unknown'}
                            </p>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Payment</label>
                            <p className="text-gray-900 dark:text-gray-100 font-medium flex items-center gap-1">
                              <CreditCard className="w-4 h-4" />
                              {orderDetails.paymentStatus === 'pay_on_arrival' ? 'Pay on arrival' : orderDetails.paymentStatus || 'Unknown'}
                            </p>
                          </div>
                          {orderDetails.prepTimeMinutes && (
                            <div>
                              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Prep Time</label>
                              <p className="text-gray-900 dark:text-gray-100 font-medium">
                                {orderDetails.prepTimeMinutes} minutes
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Order Items */}
                      {(orderDetails.orderItems && orderDetails.orderItems.length > 0) && (
                        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                            <Package className="w-5 h-5" />
                            Order Items
                          </h3>
                          <div className="space-y-3">
                            {orderDetails.orderItems.map((item: any, index: number) => (
                              <div key={index} className="border border-gray-200 dark:border-gray-600 rounded-lg p-3">
                                <div className="flex items-start justify-between mb-2">
                                  <div className="flex-1">
                                    <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                                      {item.quantity}x {item.name}
                                    </h4>
                                    {item.notes && (
                                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                        <strong>Notes:</strong> {item.notes}
                                      </p>
                                    )}
                                  </div>
                                  <div className="text-right">
                                    <p className="font-semibold text-gray-900 dark:text-gray-100">
                                      ${((item.unitPrice || 0) * (item.quantity || 1)).toFixed(2)}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                      ${(item.unitPrice || 0).toFixed(2)} each
                                    </p>
                                  </div>
                                </div>
                                
                                {item.modifiers && Object.keys(item.modifiers).length > 0 && (
                                  <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                                    <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Modifiers:</p>
                                    <div className="flex flex-wrap gap-1">
                                      {Object.entries(item.modifiers).map(([key, value]) => (
                                        <span key={key} className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full text-xs">
                                          {String(key).replace(/_/g, ' ')}: {String(value).replace(/_/g, ' ')}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                          
                          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                            <div className="flex justify-between items-center">
                              <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">Total</span>
                              <span className="text-xl font-bold text-gray-900 dark:text-gray-100">
                                ${(orderDetails.totalAmount || 0).toFixed(2)}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Status Update Section */}
                      {canUpdateOrders && (
                        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
                            Update Status
                          </h3>
                          <select
                            className="w-full input-field"
                            value={orderDetails.status}
                            disabled={updatingOrderId === orderDetails.id}
                            onChange={(e) => {
                              updateOrderStatus(orderDetails.id, e.target.value as OrderStatus);
                              setOrderDetails({...orderDetails, status: e.target.value});
                            }}
                          >
                            <option value="received">Received</option>
                            <option value="preparing">Preparing</option>
                            <option value="ready">Ready</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-gray-500">Failed to load order details</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </DashboardLayout>
    </>
  )
}
