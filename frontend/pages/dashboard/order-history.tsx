import React, { useState, useEffect, useCallback } from 'react'
import Head from 'next/head'
import DashboardLayout from '../../components/Layout/DashboardLayout'
import { useUser } from '../../contexts/UserContext'
import { api } from '../../lib/api'
import { 
  History, 
  Search, 
  Filter, 
  Calendar, 
  TrendingUp,
  Eye,
  X,
  Clock,
  User,
  Phone,
  CreditCard,
  Package,
  Download,
  RefreshCw
} from 'lucide-react'

type OrderStatus = 'received' | 'preparing' | 'ready' | 'completed' | 'cancelled'

interface OrderItem {
  name?: string
  quantity?: number
  unitPrice?: number
  notes?: string
  modifiers?: any
}

interface Order {
  id: string
  external_id?: string
  channel?: string
  status: OrderStatus
  customer_name?: string
  customer_phone?: string
  total_amount?: number
  payment_status?: string
  created_at?: string
  updated_at?: string
  prep_time_minutes?: number
  accepted_at?: string
  orderItems?: OrderItem[]
  items?: any[]
}

interface OrderHistoryStats {
  totalOrders: number
  totalRevenue: number
  avgOrderValue: number
  completedOrders: number
  cancelledOrders: number
  topChannel: string
  busiest_hour: string
}

const statusLabel: Record<OrderStatus, string> = {
  received: 'Received',
  preparing: 'Preparing', 
  ready: 'Ready',
  completed: 'Completed',
  cancelled: 'Cancelled'
}

function statusBadgeClass(status: OrderStatus) {
  if (status === 'completed') return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
  if (status === 'cancelled') return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
  if (status === 'ready') return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
  if (status === 'preparing') return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
  return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300'
}

export default function OrderHistoryPage() {
  const { user, hasPermission } = useUser()
  
  const [orders, setOrders] = useState<Order[]>([])
  const [stats, setStats] = useState<OrderHistoryStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all')
  const [channelFilter, setChannelFilter] = useState<string>('all')
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 7) // Default to last 7 days
    return d.toISOString().split('T')[0]
  })
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0])
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  
  // Order details modal
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [orderDetails, setOrderDetails] = useState<any>(null)
  const [loadingDetails, setLoadingDetails] = useState(false)

  const canReadOrders = hasPermission('orders:read')
  const limit = 20 // Orders per page

  const fetchOrders = useCallback(async (page = 1) => {
    if (!canReadOrders) return
    
    setLoading(true)
    setError(null)
    
    try {
      const params: any = {
        limit,
        offset: (page - 1) * limit
      }
      
      if (statusFilter !== 'all') params.status = statusFilter
      if (channelFilter !== 'all') params.channel = channelFilter
      if (dateFrom) params.dateFrom = dateFrom
      if (dateTo) params.dateTo = dateTo
      if (searchTerm.trim()) params.search = searchTerm.trim()
      
      const [ordersResp, statsResp] = await Promise.all([
        api.get('/api/orders/history', { params }),
        api.get('/api/orders/history/stats', { 
          params: { dateFrom, dateTo, channel: channelFilter === 'all' ? undefined : channelFilter }
        })
      ])
      
      const orderData = ordersResp.data?.data
      setOrders(page === 1 ? orderData?.orders || [] : prev => [...prev, ...(orderData?.orders || [])])
      setTotalPages(Math.ceil((orderData?.total || 0) / limit))
      setHasMore(orderData?.pagination?.hasMore || false)
      
      if (page === 1) {
        setStats(statsResp.data?.data || null)
      }
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || e?.message || 'Failed to load order history')
    } finally {
      setLoading(false)
    }
  }, [canReadOrders, statusFilter, channelFilter, dateFrom, dateTo, searchTerm, limit])

  useEffect(() => {
    setCurrentPage(1)
    fetchOrders(1)
  }, [fetchOrders])

  const loadMore = () => {
    if (!loading && hasMore) {
      const nextPage = currentPage + 1
      setCurrentPage(nextPage)
      fetchOrders(nextPage)
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

  const exportOrders = async () => {
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (channelFilter !== 'all') params.set('channel', channelFilter)
      if (dateFrom) params.set('dateFrom', dateFrom)
      if (dateTo) params.set('dateTo', dateTo)
      if (searchTerm.trim()) params.set('search', searchTerm.trim())
      
      const response = await api.get(`/api/orders/export?${params.toString()}`, {
        responseType: 'blob'
      })
      
      const blob = new Blob([response.data], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `order-history-${dateFrom}-to-${dateTo}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (e: any) {
      setError('Failed to export orders')
    }
  }

  const channels = ['all', 'website', 'phone', 'doordash', 'ubereats', 'grubhub']

  if (!canReadOrders) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <History className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            Access Denied
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            You don&apos;t have permission to view order history.
          </p>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <>
      <Head>
        <title>Order History - Servio</title>
        <meta name="description" content="View and analyze historical order data" />
      </Head>

      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <History className="w-8 h-8 text-blue-600" />
                Order History
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                View, search, and analyze your historical order data
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={exportOrders}
                className="btn-secondary inline-flex items-center"
                title="Export to CSV"
              >
                <Download className="w-4 h-4 mr-2" />
                Export
              </button>
              <button
                onClick={() => fetchOrders(1)}
                disabled={loading}
                className="btn-primary inline-flex items-center"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
              <div className="text-red-800 dark:text-red-300">{error}</div>
            </div>
          )}

          {/* Stats Cards */}
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Orders</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{stats.totalOrders}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-blue-500">
                    <Package className="h-6 w-6 text-white" />
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Revenue</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                      ${stats.totalRevenue.toFixed(2)}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-green-500">
                    <TrendingUp className="h-6 w-6 text-white" />
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Avg Order Value</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                      ${stats.avgOrderValue.toFixed(2)}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-purple-500">
                    <CreditCard className="h-6 w-6 text-white" />
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Completion Rate</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                      {stats.totalOrders > 0 ? Math.round((stats.completedOrders / stats.totalOrders) * 100) : 0}%
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-orange-500">
                    <Clock className="h-6 w-6 text-white" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex items-center">
                <Filter className="w-4 h-4 mr-2 text-gray-500" />
                <span className="font-semibold text-gray-900 dark:text-gray-100">Filters</span>
              </div>
              
              <div className="flex flex-wrap gap-4">
                <div className="relative">
                  <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search orders..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 w-48"
                  />
                </div>
                
                <select
                  className="border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                >
                  <option value="all">All Statuses</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="ready">Ready</option>
                  <option value="preparing">Preparing</option>
                  <option value="received">Received</option>
                </select>

                <select
                  className="border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2"
                  value={channelFilter}
                  onChange={(e) => setChannelFilter(e.target.value)}
                >
                  {channels.map(channel => (
                    <option key={channel} value={channel}>
                      {channel === 'all' ? 'All Channels' : channel.charAt(0).toUpperCase() + channel.slice(1)}
                    </option>
                  ))}
                </select>

                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2"
                  />
                  <span className="text-gray-500">to</span>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Orders Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {loading && currentPage === 1 ? (
              <div className="lg:col-span-2 xl:col-span-3 text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
                <p className="mt-4 text-gray-500">Loading order history...</p>
              </div>
            ) : orders.length === 0 ? (
              <div className="lg:col-span-2 xl:col-span-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
                <History className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                  No orders found
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                  Try adjusting your filters or date range
                </p>
              </div>
            ) : (
              orders.map((order) => {
                const created = order.created_at ? new Date(order.created_at) : null
                const itemCount = Array.isArray(order.orderItems) ? order.orderItems.length : (Array.isArray(order.items) ? order.items.length : 0)
                const daysSince = created ? Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24)) : 0

                return (
                  <div key={order.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:shadow-lg transition-all">
                    <div className="flex items-start justify-between mb-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100 truncate">
                            {order.external_id || order.id}
                          </h3>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusBadgeClass(order.status)}`}>
                            {statusLabel[order.status] || order.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            <span>{daysSince === 0 ? 'Today' : `${daysSince}d ago`}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Package className="w-4 h-4" />
                            <span>{itemCount} items</span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => viewOrderDetails(order)}
                        className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <User className="w-4 h-4 text-gray-500" />
                          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Customer</span>
                        </div>
                        <div className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                          {order.customer_name || 'No name'}
                        </div>
                        {order.customer_phone && (
                          <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                            <Phone className="w-3 h-3" />
                            <span>{order.customer_phone}</span>
                          </div>
                        )}
                      </div>

                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <CreditCard className="w-4 h-4 text-gray-500" />
                          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Total</span>
                        </div>
                        <div className="font-bold text-lg text-gray-900 dark:text-gray-100">
                          {typeof order.total_amount === 'number' ? `$${order.total_amount.toFixed(2)}` : '—'}
                        </div>
                        <div className="text-xs text-gray-500">
                          via {order.channel || 'Unknown'}
                        </div>
                      </div>
                    </div>

                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      <div>Placed: {created ? created.toLocaleString() : 'Unknown'}</div>
                      {order.payment_status === 'pay_on_arrival' && (
                        <div className="text-green-600 dark:text-green-400 font-medium">💳 Pay on arrival</div>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Load More */}
          {hasMore && (
            <div className="text-center">
              <button
                onClick={loadMore}
                disabled={loading}
                className="btn-secondary inline-flex items-center"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin mr-2" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                {loading ? 'Loading...' : `Load More (${totalPages - currentPage} pages left)`}
              </button>
            </div>
          )}

          {/* Order Details Modal */}
          {selectedOrder && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
              <div className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6 rounded-t-xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                        Order History: {selectedOrder.external_id || selectedOrder.id}
                      </h2>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusBadgeClass(selectedOrder.status)}`}>
                          {statusLabel[selectedOrder.status] || selectedOrder.status}
                        </span>
                        <span className="text-sm text-gray-500">
                          {selectedOrder.created_at ? new Date(selectedOrder.created_at).toLocaleDateString() : 'Unknown date'}
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
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
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

                      {/* Order Timeline */}
                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                          <Clock className="w-5 h-5" />
                          Order Timeline
                        </h3>
                        <div className="space-y-3">
                          <div className="flex items-center gap-3 text-sm">
                            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                            <span className="font-medium">Placed:</span>
                            <span className="text-gray-600 dark:text-gray-400">
                              {orderDetails.createdAt ? new Date(orderDetails.createdAt).toLocaleString() : 'Unknown'}
                            </span>
                          </div>
                          {orderDetails.acceptedAt && (
                            <div className="flex items-center gap-3 text-sm">
                              <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                              <span className="font-medium">Accepted:</span>
                              <span className="text-gray-600 dark:text-gray-400">
                                {new Date(orderDetails.acceptedAt).toLocaleString()}
                              </span>
                            </div>
                          )}
                          <div className="flex items-center gap-3 text-sm">
                            <div className={`w-2 h-2 rounded-full ${
                              orderDetails.status === 'completed' ? 'bg-green-500' : 
                              orderDetails.status === 'cancelled' ? 'bg-red-500' : 'bg-gray-400'
                            }`}></div>
                            <span className="font-medium">Final Status:</span>
                            <span className="text-gray-600 dark:text-gray-400">
                              {statusLabel[orderDetails.status as OrderStatus] || orderDetails.status}
                            </span>
                          </div>
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
                            {orderDetails.paymentStatus === 'pay_on_arrival' && (
                              <div className="mt-2 text-sm text-green-600 dark:text-green-400 font-medium">
                                💳 Payment: On arrival
                              </div>
                            )}
                          </div>
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