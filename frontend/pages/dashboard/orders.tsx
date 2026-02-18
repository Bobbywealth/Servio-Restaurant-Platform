import React, { useEffect, useMemo, useState } from 'react'
import Head from 'next/head'
import DashboardLayout from '../../components/Layout/DashboardLayout'
import { useUser } from '../../contexts/UserContext'
import { api } from '../../lib/api'
import { useSocket } from '../../lib/socket'
import { RefreshCw, Filter, ClipboardList, Search, Clock, Phone, Globe, Smartphone, ChevronRight, X, Printer, CheckCircle, PlayCircle, Check, BarChart3 } from 'lucide-react'
import { OrderCardSkeleton, StatCardSkeleton, TableRowSkeleton } from '../../components/ui/Skeleton'
import { PullToRefresh } from '../../components/ui/PullToRefresh'
import { useHaptic } from '../../lib/haptics'
import { AnimatePresence, motion } from 'framer-motion'
import { OrderAnalytics } from '../../components/OrderAnalytics'

type OrderStatus = 'received' | 'preparing' | 'ready' | 'completed' | 'cancelled'

interface OrderItem {
  name?: string
  quantity?: number
  price?: number
  modifiers?: Record<string, any>
}

interface Order {
  id: string
  external_id?: string
  channel?: string
  status: OrderStatus
  customer_name?: string
  customer_phone?: string
  total_amount?: number
  items?: OrderItem[]
  created_at?: string
  updated_at?: string
  order_type?: string
  notes?: string
}

interface OrdersSummary {
  totalOrders: number
  activeOrders: number
  completedToday: number
  avgOrderValue: number
  ordersByStatus: Record<string, number>
  ordersByChannel: Record<string, number>
}

const statusConfig: Record<OrderStatus, { label: string; color: string; icon: React.ReactNode }> = {
  received: { label: 'Received', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400', icon: <Phone className="w-3.5 h-3.5" /> },
  preparing: { label: 'Preparing', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', icon: <PlayCircle className="w-3.5 h-3.5" /> },
  ready: { label: 'Ready', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', icon: <CheckCircle className="w-3.5 h-3.5" /> },
  completed: { label: 'Completed', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300', icon: <Check className="w-3.5 h-3.5" /> },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', icon: <X className="w-3.5 h-3.5" /> }
}

const channelConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  phone: { label: 'Phone', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400', icon: <Phone className="w-3 h-3" /> },
  vapi: { label: 'AI Phone', color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400', icon: <Smartphone className="w-3 h-3" /> },
  online: { label: 'Online', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', icon: <Globe className="w-3 h-3" /> },
  doordash: { label: 'DoorDash', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', icon: <Globe className="w-3 h-3" /> },
  grubhub: { label: 'Grubhub', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400', icon: <Globe className="w-3 h-3" /> },
  ubereats: { label: 'UberEats', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', icon: <Globe className="w-3 h-3" /> },
  test: { label: 'Test', color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300', icon: <ClipboardList className="w-3 h-3" /> }
}

function getChannelConfig(channel: string) {
  return channelConfig[channel.toLowerCase()] || { label: channel, color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300', icon: <Globe className="w-3 h-3" /> }
}

function OrderTimer({ createdAt, status }: { createdAt: string; status?: string }) {
  const [elapsed, setElapsed] = useState('')
  const [minutes, setMinutes] = useState(0)

  // Don't update timer if order is completed or cancelled
  const isFinalStatus = status === 'completed' || status === 'cancelled'

  useEffect(() => {
    // Skip interval setup for final statuses
    if (isFinalStatus) {
      const created = new Date(createdAt).getTime()
      const now = Date.now()
      const diff = Math.floor((now - created) / 1000)
      const mins = Math.floor(diff / 60)
      setMinutes(mins)
      setElapsed(mins > 0 ? `${mins}m` : '<1m')
      return
    }

    const updateElapsed = () => {
      const created = new Date(createdAt).getTime()
      const now = Date.now()
      const diff = Math.floor((now - created) / 1000)

      const mins = Math.floor(diff / 60)
      setMinutes(mins)
      setElapsed(mins > 0 ? `${mins}m` : '<1m')
    }

    updateElapsed()
    const interval = setInterval(updateElapsed, 1000)
    return () => clearInterval(interval)
  }, [createdAt, isFinalStatus])

  const timerColor = isFinalStatus 
    ? 'text-gray-400 dark:text-gray-500' 
    : minutes > 15 
      ? 'text-red-600 dark:text-red-400' 
      : minutes > 10 
        ? 'text-amber-600 dark:text-amber-400' 
        : 'text-surface-600 dark:text-surface-400'

  return (
    <div className={`flex items-center gap-1 text-sm font-mono ${timerColor}`}>
      <Clock className="w-3.5 h-3.5" />
      <span>{elapsed}</span>
      {isFinalStatus && (
        <span className="text-xs opacity-50 ml-1">
          ({status === 'completed' ? 'Done' : 'Cancelled'})
        </span>
      )}
    </div>
  )
}

function OrderDetailModal({ order, onClose }: { order: Order | null; onClose: () => void }) {
  if (!order) return null

  const channel = getChannelConfig(order.channel || 'unknown')

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Order {order.external_id || order.id.slice(0, 8)}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${channel.color}`}>
                  {channel.icon}
                  {channel.label}
                </span>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig[order.status as OrderStatus]?.color}`}>
                  {statusConfig[order.status as OrderStatus]?.icon}
                  {statusConfig[order.status as OrderStatus]?.label}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-4 overflow-y-auto max-h-[calc(90vh-200px)]">
            {/* Timer & Time */}
            <div className="flex items-center justify-between mb-4">
              <OrderTimer createdAt={order.created_at || ''} status={order.status} />
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {order.created_at && new Date(order.created_at).toLocaleString()}
              </span>
            </div>

            {/* Customer Info */}
            {(order.customer_name || order.customer_phone || order.order_type) && (
              <div className="card bg-gray-50 dark:bg-gray-700/50 mb-4">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Customer</h3>
                <div className="space-y-1 text-sm">
                  {order.customer_name && (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 dark:text-gray-400">Name:</span>
                      <span className="font-medium text-gray-900 dark:text-white">{order.customer_name}</span>
                    </div>
                  )}
                  {order.customer_phone && (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 dark:text-gray-400">Phone:</span>
                      <a href={`tel:${order.customer_phone}`} className="font-medium text-primary-600 hover:underline">
                        {order.customer_phone}
                      </a>
                    </div>
                  )}
                  {order.order_type && (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 dark:text-gray-400">Type:</span>
                      <span className="font-medium text-gray-900 dark:text-white capitalize">{order.order_type}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Order Items */}
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Items</h3>
              <div className="space-y-2">
                {Array.isArray(order.items) && order.items.map((item, idx) => (
                  <div key={idx} className="flex items-start justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 dark:text-white">{item.quantity}x</span>
                        <span className="text-gray-900 dark:text-white">{item.name}</span>
                      </div>
                      {item.modifiers && Object.keys(item.modifiers).length > 0 && (
                        <div className="mt-1 ml-6 text-xs text-gray-500 dark:text-gray-400">
                          {Object.entries(item.modifiers).map(([key, value]) => (
                            <div key={key}>• {key}: {String(value)}</div>
                          ))}
                        </div>
                      )}
                    </div>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      ${((item.price || 0) * (item.quantity || 1)).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Total */}
            <div className="flex items-center justify-between p-4 bg-gray-900 dark:bg-gray-700 rounded-xl">
              <span className="text-lg font-semibold text-white">Total</span>
              <span className="text-2xl font-bold text-white">${Number(order.total_amount || 0).toFixed(2)}</span>
            </div>

            {/* Notes */}
            {order.notes && (
              <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <span className="text-xs font-semibold text-yellow-800 dark:text-yellow-400">Note:</span>
                <p className="mt-1 text-sm text-yellow-700 dark:text-yellow-300">{order.notes}</p>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          {order.status !== 'completed' && order.status !== 'cancelled' && (
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex gap-3">
              <button className="flex-1 btn-secondary flex items-center justify-center gap-2">
                <Printer className="w-4 h-4" />
                Print
              </button>
              <button className="flex-1 btn-primary flex items-center justify-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Quick Complete
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

export default function OrdersPage() {
  const { user, hasPermission } = useUser()
  const socket = useSocket()
  const { haptic, hapticWithVisual } = useHaptic()
  const [orders, setOrders] = useState<Order[]>([])
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([])
  const [summary, setSummary] = useState<OrdersSummary | null>(null)
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all')
  const [channelFilter, setChannelFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [showAnalytics, setShowAnalytics] = useState(false)

  const canUpdateOrders = hasPermission('orders', 'update')

  const createTestOrder = async () => {
    setIsLoading(true)
    setError(null)
    try {
      await api.post('/api/orders', {
        externalId: `TEST-${Math.floor(Math.random() * 10000000000000)}`,
        channel: 'test',
        items: [
          { name: 'Test Burger', quantity: 1, price: 12.99 },
          { name: 'Test Fries', quantity: 1, price: 3.99 }
        ],
        customerName: 'Test Customer',
        customerPhone: '(555) 123-4567',
        totalAmount: 16.98
      })
      await fetchData()
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || e?.message || 'Failed to create test order')
    } finally {
      setIsLoading(false)
    }
  }

  const channels = useMemo(() => {
    const set = new Set<string>()
    orders.forEach(o => {
      if (o.channel) set.add(o.channel)
    })
    return Array.from(set).sort()
  }, [orders])

  // Filter orders based on all filters including search
  useEffect(() => {
    let result = orders

    // Apply status filter
    if (statusFilter !== 'all') {
      result = result.filter(o => o.status === statusFilter)
    }

    // Apply channel filter
    if (channelFilter !== 'all') {
      result = result.filter(o => o.channel === channelFilter)
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      result = result.filter(o =>
        o.id.toLowerCase().includes(query) ||
        o.external_id?.toLowerCase().includes(query) ||
        o.customer_name?.toLowerCase().includes(query) ||
        o.customer_phone?.includes(query) ||
        o.items?.some(item => item.name?.toLowerCase().includes(query))
      )
    }

    setFilteredOrders(result)
  }, [orders, statusFilter, channelFilter, searchQuery])

  const fetchData = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [ordersRes, summaryRes] = await Promise.all([
        api.get('/api/orders', {
          params: {
            status: statusFilter === 'all' ? undefined : statusFilter,
            channel: channelFilter === 'all' ? undefined : channelFilter,
            limit: 100,
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
  }

  useEffect(() => {
    if (!hasPermission('orders', 'read')) return
    fetchData()
  }, [statusFilter, channelFilter])

  useEffect(() => {
    if (!socket) return

    const handleNewNotification = (data: any) => {
      if (data.notification.type === 'order.created_web' ||
          data.notification.type === 'order.created_vapi' ||
          data.notification.type === 'order.status_changed') {
        fetchData()
      }
    }

    socket.on('notifications.new', handleNewNotification)
    return () => {
      socket.off('notifications.new', handleNewNotification)
    }
  }, [socket, hasPermission])

  const updateOrderStatus = async (orderId: string, status: OrderStatus) => {
    if (!canUpdateOrders) return
    haptic('medium')
    setUpdatingOrderId(orderId)
    setError(null)
    try {
      await api.post(`/api/orders/${orderId}/status`, {
        status,
        userId: user?.id || 'system'
      })

      if (socket) {
        socket.emit('order:status_changed', { orderId, status, timestamp: new Date() })
      }

      haptic('success')
      await fetchData()
    } catch (e: any) {
      haptic('error')
      setError(e?.response?.data?.error?.message || e?.message || 'Failed to update order')
    } finally {
      setUpdatingOrderId(null)
    }
  }

  return (
    <>
      <Head>
        <title>Orders - Servio</title>
        <meta name="description" content="Manage orders" />
      </Head>

      <DashboardLayout>
        <PullToRefresh onRefresh={fetchData} disabled={!hasPermission('orders', 'read')}>
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-surface-900 dark:text-surface-100 flex items-center">
                <ClipboardList className="w-6 h-6 mr-2 text-primary-600 dark:text-primary-400" />
                Orders
              </h1>
              <p className="mt-2 text-sm sm:text-base text-surface-600 dark:text-surface-400">
                Track incoming orders and update kitchen progress.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <button
                className="btn-primary inline-flex items-center justify-center min-h-[44px]"
                onClick={createTestOrder}
                disabled={isLoading}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Create Test Order</span>
                <span className="sm:hidden">Test Order</span>
              </button>

              <button
                className="btn-secondary inline-flex items-center justify-center min-h-[44px]"
                onClick={fetchData}
                disabled={isLoading}
                title="Refresh"
              >
                <RefreshCw className={`w-4 h-4 sm:mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>

              <button
                className={`inline-flex items-center justify-center min-h-[44px] px-4 ${showAnalytics ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setShowAnalytics(!showAnalytics)}
              >
                <BarChart3 className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">{showAnalytics ? 'Hide' : 'Show'} Analytics</span>
                <span className="sm:hidden">{showAnalytics ? 'Stats' : 'Analytics'}</span>
              </button>
            </div>
          </div>

          {/* Analytics Section */}
          {showAnalytics && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <OrderAnalytics onRefresh={fetchData} />
            </motion.div>
          )}

          {error && (
            <div className="card border-servio-red-200 dark:border-servio-red-800">
              <div className="status-error">{error}</div>
              <p className="mt-2 text-sm text-surface-600 dark:text-surface-400">
                Please check your internet connection or contact support if the issue persists.
              </p>
            </div>
          )}

          {/* Summary Stats */}
          {isLoading && !summary ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
            </div>
          ) : summary && (
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

          {/* Filters */}
          <div className="card">
            <div className="flex flex-wrap items-end gap-4">
              {/* Search */}
              <div className="flex-1 min-w-[200px]">
                <label className="flex flex-col gap-1.5 text-sm text-surface-700 dark:text-surface-300">
                  <span className="font-medium flex items-center gap-1">
                    <Search className="w-4 h-4" />
                    Search
                  </span>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                    <input
                      type="text"
                      placeholder="Order ID, customer, phone, item..."
                      className="input-field w-full pl-10 min-h-[44px]"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </label>
              </div>

              {/* Status Filter */}
              <div className="w-full sm:w-40">
                <label className="flex flex-col gap-1.5 text-sm text-surface-700 dark:text-surface-300">
                  <span className="font-medium">Status</span>
                  <select
                    className="input-field w-full min-h-[44px]"
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
              </div>

              {/* Channel Filter */}
              <div className="w-full sm:w-40">
                <label className="flex flex-col gap-1.5 text-sm text-surface-700 dark:text-surface-300">
                  <span className="font-medium">Channel</span>
                  <select
                    className="input-field w-full min-h-[44px]"
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

          {/* Desktop Table View */}
          <div className="hidden lg:block card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200 dark:border-surface-700">
                  <th className="text-left py-3 px-2 font-semibold text-surface-600 dark:text-surface-400">Order</th>
                  <th className="text-left py-3 px-2 font-semibold text-surface-600 dark:text-surface-400">Timer</th>
                  <th className="text-left py-3 px-2 font-semibold text-surface-600 dark:text-surface-400">Customer</th>
                  <th className="text-left py-3 px-2 font-semibold text-surface-600 dark:text-surface-400">Channel</th>
                  <th className="text-left py-3 px-2 font-semibold text-surface-600 dark:text-surface-400">Items</th>
                  <th className="text-left py-3 px-2 font-semibold text-surface-600 dark:text-surface-400">Total</th>
                  <th className="text-left py-3 px-2 font-semibold text-surface-600 dark:text-surface-400">Status</th>
                  {canUpdateOrders && (
                    <th className="text-right py-3 px-2 font-semibold text-surface-600 dark:text-surface-400">Update</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {isLoading && filteredOrders.length === 0 ? (
                  <>
                    <TableRowSkeleton columns={canUpdateOrders ? 8 : 7} />
                    <TableRowSkeleton columns={canUpdateOrders ? 8 : 7} />
                    <TableRowSkeleton columns={canUpdateOrders ? 8 : 7} />
                    <TableRowSkeleton columns={canUpdateOrders ? 8 : 7} />
                    <TableRowSkeleton columns={canUpdateOrders ? 8 : 7} />
                  </>
                ) : filteredOrders.length === 0 ? (
                  <tr>
                    <td className="py-6 px-2 text-surface-500 dark:text-surface-400" colSpan={canUpdateOrders ? 8 : 7}>
                      {searchQuery ? 'No orders match your search.' : 'No orders found.'}
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((o) => {
                    const channel = getChannelConfig(o.channel || 'unknown')
                    return (
                      <tr
                        key={o.id}
                        className="border-b border-surface-100 dark:border-surface-800 hover:bg-surface-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
                        onClick={() => setSelectedOrder(o)}
                      >
                        <td className="py-3 px-2">
                          <div className="font-semibold text-surface-900 dark:text-surface-100">{o.external_id || o.id.slice(0, 8)}</div>
                          {o.created_at && (
                            <div className="text-xs text-surface-500 dark:text-surface-400">
                              {new Date(o.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-2">
                          <OrderTimer createdAt={o.created_at || ''} status={o.status} />
                        </td>
                        <td className="py-3 px-2 text-surface-700 dark:text-surface-300">
                          {o.customer_name || '—'}
                        </td>
                        <td className="py-3 px-2">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${channel.color}`}>
                            {channel.icon}
                            {channel.label}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-surface-700 dark:text-surface-300">
                          {Array.isArray(o.items) ? o.items.length : 0}
                        </td>
                        <td className="py-3 px-2 text-surface-700 dark:text-surface-300 font-medium">
                          ${Number(o.total_amount || 0).toFixed(2)}
                        </td>
                        <td className="py-3 px-2">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig[o.status as OrderStatus]?.color}`}>
                            {statusConfig[o.status as OrderStatus]?.icon}
                            {statusConfig[o.status as OrderStatus]?.label}
                          </span>
                        </td>
                        {canUpdateOrders && (
                          <td className="py-3 px-2 text-right" onClick={(e) => e.stopPropagation()}>
                            <select
                              className="input-field inline-block w-32 text-sm"
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
                          </td>
                        )}
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile/Tablet Card View */}
          <div className="lg:hidden space-y-4">
            {isLoading && filteredOrders.length === 0 ? (
              <>
                <OrderCardSkeleton />
                <OrderCardSkeleton />
                <OrderCardSkeleton />
                <OrderCardSkeleton />
              </>
            ) : filteredOrders.length === 0 ? (
              <div className="card text-center py-12">
                <ClipboardList className="w-12 h-12 mx-auto mb-3 text-surface-300 dark:text-surface-600" />
                <p className="text-surface-500 dark:text-surface-400">
                  {searchQuery ? 'No orders match your search.' : 'No orders found.'}
                </p>
              </div>
            ) : (
              filteredOrders.map((o) => {
                const channel = getChannelConfig(o.channel || 'unknown')
                return (
                  <div
                    key={o.id}
                    className="card hover:shadow-lg transition-all cursor-pointer"
                    onClick={() => setSelectedOrder(o)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="font-semibold text-base text-surface-900 dark:text-surface-100 truncate">
                            {o.external_id || o.id.slice(0, 8)}
                          </div>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${channel.color}`}>
                            {channel.icon}
                            {channel.label}
                          </span>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig[o.status as OrderStatus]?.color}`}>
                            {statusConfig[o.status as OrderStatus]?.icon}
                            {statusConfig[o.status as OrderStatus]?.label}
                          </span>
                        </div>
                        {o.created_at && (
                          <div className="text-xs text-surface-500 dark:text-surface-400">
                            {new Date(o.created_at).toLocaleString()}
                          </div>
                        )}
                      </div>
                      <OrderTimer createdAt={o.created_at || ''} status={o.status} />
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <div className="text-xs text-surface-500 dark:text-surface-400 mb-1">Customer</div>
                        <div className="text-sm font-medium text-surface-900 dark:text-surface-100 truncate">
                          {o.customer_name || '—'}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-surface-500 dark:text-surface-400 mb-1">Items</div>
                        <div className="text-sm font-medium text-surface-900 dark:text-surface-100">
                          {Array.isArray(o.items) ? o.items.length : 0} item{Array.isArray(o.items) && o.items.length !== 1 ? 's' : ''}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-surface-500 dark:text-surface-400 mb-1">Type</div>
                        <div className="text-sm font-medium text-surface-900 dark:text-surface-100 capitalize">
                          {o.order_type || '—'}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-surface-500 dark:text-surface-400 mb-1">Total</div>
                        <div className="text-sm font-semibold text-surface-900 dark:text-surface-100">
                          ${Number(o.total_amount || 0).toFixed(2)}
                        </div>
                      </div>
                    </div>

                    {canUpdateOrders && (
                      <div className="pt-3 border-t border-surface-200 dark:border-surface-700" onClick={(e) => e.stopPropagation()}>
                        <label className="block">
                          <span className="text-xs font-medium text-surface-600 dark:text-surface-400 mb-1 block">
                            Update Status
                          </span>
                          <div className="grid grid-cols-4 gap-2">
                            {(['received', 'preparing', 'ready', 'completed'] as OrderStatus[]).map((status) => (
                              <button
                                key={status}
                                type="button"
                                className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                                  o.status === status
                                    ? statusConfig[status].color
                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                                }`}
                                onClick={() => updateOrderStatus(o.id, status)}
                                disabled={updatingOrderId === o.id}
                              >
                                {statusConfig[status].label}
                              </button>
                            ))}
                          </div>
                        </label>
                      </div>
                    )}

                    <div className="mt-3 pt-2 border-t border-surface-100 dark:border-surface-700 flex items-center justify-end text-xs text-surface-400">
                      Tap for details
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Results count */}
          {!isLoading && filteredOrders.length > 0 && (
            <div className="text-sm text-surface-500 dark:text-surface-400 text-center">
              Showing {filteredOrders.length} order{filteredOrders.length !== 1 ? 's' : ''}
              {searchQuery && <> matching "<span className="font-medium">{searchQuery}</span>"</>}
            </div>
          )}
        </div>
        </PullToRefresh>
      </DashboardLayout>

      {/* Order Detail Modal */}
      <OrderDetailModal order={selectedOrder} onClose={() => setSelectedOrder(null)} />
    </>
  )
}
