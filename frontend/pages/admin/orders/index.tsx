import React, { useEffect, useMemo, useState } from 'react'
import AdminLayout from '../../../components/Layout/AdminLayout'
import { api } from '../../../lib/api'
import { AdminOrderSummary, coerceMoneyValue, getOrderStatusBadgeClass } from '../../../lib/adminOrders'
import { useSocket } from '../../../lib/socket'
import Link from 'next/link'
import { ClipboardList, Clock } from 'lucide-react'

type Filters = {
  restaurantId: string
  channel: string
  status: string
  timeWindowHours: string
  slaBreached: string
  search: string
}

const DEFAULT_FILTERS: Filters = {
  restaurantId: '',
  channel: 'all',
  status: 'all',
  timeWindowHours: '168',
  slaBreached: 'all',
  search: ''
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<AdminOrderSummary[]>([])
  const [restaurants, setRestaurants] = useState<{ id: string; name: string }[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isBulkRunning, setIsBulkRunning] = useState(false)
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0, limit: 100 })
  const socket = useSocket()

  const fetchRestaurants = async () => {
    try {
      const res = await api.get('/api/admin/restaurants', { params: { limit: 200, page: 1 } })
      setRestaurants((res.data.restaurants || []).map((restaurant: any) => ({ id: restaurant.id, name: restaurant.name })))
    } catch (error) {
      console.error('Failed to fetch restaurants:', error)
    }
  }

  const fetchOrders = async () => {
    setIsLoading(true)
    try {
      const params: Record<string, string> = {
        timeWindowHours: filters.timeWindowHours,
        page: String(pagination.page),
        limit: String(pagination.limit)
      }
      if (filters.status !== 'all') params.status = filters.status
      if (filters.channel !== 'all') params.channel = filters.channel
      if (filters.restaurantId) params.restaurantId = filters.restaurantId
      if (filters.slaBreached !== 'all') params.slaBreached = filters.slaBreached
      if (filters.search.trim()) params.search = filters.search.trim()

      const res = await api.get('/api/admin/orders', { params })
      setOrders(res.data.orders || [])
      setPagination((prev) => ({ ...prev, ...(res.data?.pagination || {}) }))
      setErrorMessage(null)
    } catch (error) {
      console.error('Failed to fetch orders:', error)
      setErrorMessage('Unable to load orders right now. Please refresh and try again.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchRestaurants()
  }, [])

  useEffect(() => {
    fetchOrders()
  }, [filters, pagination.page, pagination.limit])

  useEffect(() => {
    if (!socket) return

    socket.on('notifications.new', (data) => {
      if (data.notification.type === 'order.created_vapi' || data.notification.type === 'order.created_web') {
        fetchOrders()
      }
    })

    return () => {
      socket.off('notifications.new')
    }
  }, [socket, filters])

  const pendingOrders = useMemo(() => orders.filter(o => o.status === 'pending'), [orders])
  const otherOrders = useMemo(() => orders.filter(o => o.status !== 'pending'), [orders])
  const allVisibleOrderIds = useMemo(() => orders.map(o => o.id), [orders])
  const totalRevenueVisible = useMemo(() => orders.reduce((sum, order) => sum + coerceMoneyValue(order.total_amount), 0), [orders])

  const toggleSelectOrder = (orderId: string) => {
    setSelectedIds(prev => (prev.includes(orderId) ? prev.filter(id => id !== orderId) : [...prev, orderId]))
  }

  const toggleSelectAllVisible = () => {
    setSelectedIds(prev => (prev.length === allVisibleOrderIds.length ? [] : allVisibleOrderIds))
  }

  const runBulkCancelStale = async () => {
    setIsBulkRunning(true)
    try {
      const res = await api.post('/api/admin/orders/bulk/cancel-stale', { staleMinutes: 45 }, {
        headers: { 'x-idempotency-key': `bulk-stale-${Date.now()}` }
      })
      const total = res?.data?.totalCancelled ?? 0
      setErrorMessage(total > 0 ? null : 'No stale pending orders were found to cancel.')
      fetchOrders()
      setSelectedIds([])
    } catch (error) {
      console.error('Failed to run stale cleanup:', error)
      setErrorMessage('Failed to run stale pending cleanup.')
    } finally {
      setIsBulkRunning(false)
    }
  }

  return (
    <AdminLayout title="Order Management">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {errorMessage && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        <section className="bg-white dark:bg-gray-800 shadow rounded-lg p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
            <input value={filters.search} onChange={(e) => { setPagination((prev) => ({ ...prev, page: 1 })); setFilters(prev => ({ ...prev, search: e.target.value })) }} placeholder="Search order ID, customer, phone, restaurant" className="input-field" />

            <select value={filters.restaurantId} onChange={(e) => { setPagination((prev) => ({ ...prev, page: 1 })); setFilters(prev => ({ ...prev, restaurantId: e.target.value })) }} className="input-field">
              <option value="">All restaurants</option>
              {restaurants.map((restaurant) => <option key={restaurant.id} value={restaurant.id}>{restaurant.name}</option>)}
            </select>

            <select value={filters.channel} onChange={(e) => { setPagination((prev) => ({ ...prev, page: 1 })); setFilters(prev => ({ ...prev, channel: e.target.value })) }} className="input-field">
              <option value="all">All channels</option>
              <option value="voice">Voice</option>
              <option value="web">Web</option>
              <option value="sms">SMS</option>
              <option value="email">Email</option>
            </select>

            <select value={filters.status} onChange={(e) => { setPagination((prev) => ({ ...prev, page: 1 })); setFilters(prev => ({ ...prev, status: e.target.value })) }} className="input-field">
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="accepted">Accepted</option>
              <option value="preparing">Preparing</option>
              <option value="ready">Ready</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>

            <select value={filters.timeWindowHours} onChange={(e) => { setPagination((prev) => ({ ...prev, page: 1 })); setFilters(prev => ({ ...prev, timeWindowHours: e.target.value })) }} className="input-field">
              <option value="24">Last 24 hours</option>
              <option value="72">Last 72 hours</option>
              <option value="168">Last 7 days</option>
              <option value="720">Last 30 days</option>
              <option value="8760">All orders (last 12 months)</option>
            </select>

            <select value={filters.slaBreached} onChange={(e) => { setPagination((prev) => ({ ...prev, page: 1 })); setFilters(prev => ({ ...prev, slaBreached: e.target.value })) }} className="input-field">
              <option value="all">All SLA states</option>
              <option value="true">SLA breached</option>
              <option value="false">Within SLA</option>
            </select>
          </div>

          <div className="flex items-center justify-between">
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" checked={selectedIds.length > 0 && selectedIds.length === allVisibleOrderIds.length} onChange={toggleSelectAllVisible} />
              Select all visible ({selectedIds.length} selected)
            </label>
            <button onClick={runBulkCancelStale} disabled={isBulkRunning} className="btn-secondary text-sm">
              {isBulkRunning ? 'Running...' : 'Bulk cancel stale pending'}
            </button>
          </div>
        </section>

        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
            <p className="text-xs text-gray-500">Loaded orders</p>
            <p className="text-xl font-semibold text-gray-900 dark:text-white">{orders.length}</p>
          </div>
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
            <p className="text-xs text-gray-500">Matching orders (all pages)</p>
            <p className="text-xl font-semibold text-gray-900 dark:text-white">{pagination.total}</p>
          </div>
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
            <p className="text-xs text-gray-500">Visible revenue</p>
            <p className="text-xl font-semibold text-gray-900 dark:text-white">${totalRevenueVisible.toFixed(2)}</p>
          </div>
        </section>

        {/* Pending Orders Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center">
              <Clock className="w-5 h-5 mr-2 text-yellow-500" />
              Pending Orders
              {pendingOrders.length > 0 && (
                <span className="ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                  {pendingOrders.length}
                </span>
              )}
            </h2>
          </div>

          <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
            {isLoading ? <div className="p-8 text-center text-gray-500">Loading orders...</div> : pendingOrders.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No pending orders</div>
            ) : (
              <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                {pendingOrders.map((order) => (
                  <li key={order.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700">
                    <div className="flex items-center justify-between gap-4">
                      <label className="inline-flex items-center gap-2">
                        <input type="checkbox" checked={selectedIds.includes(order.id)} onChange={() => toggleSelectOrder(order.id)} />
                        <Link href={`/admin/orders/${order.id}`} className="block">
                          <p className="text-sm font-medium text-red-600 truncate">{order.customer_name || 'Anonymous'}</p>
                          <p className="text-sm text-gray-500">{order.customer_phone}</p>
                          <p className="text-xs text-gray-400">{order.restaurant_name || 'Unknown restaurant'}</p>
                        </Link>
                      </label>
                      <div className="text-right">
                        <p className="text-sm font-bold text-gray-900 dark:text-white">${coerceMoneyValue(order.total_amount).toFixed(2)}</p>
                        <p className="text-xs text-gray-400">{new Date(order.created_at).toLocaleTimeString()}</p>
                        {order.is_sla_breached ? <p className="text-xs font-semibold text-red-600">SLA breached</p> : <p className="text-xs text-green-600">SLA OK</p>}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center">
            <ClipboardList className="w-5 h-5 mr-2 text-gray-400" />
            Recent Activity
          </h2>
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Restaurant</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Channel</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SLA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {otherOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link href={`/admin/orders/${order.id}`} className="text-sm font-medium text-gray-900 dark:text-white">
                        {order.customer_name || 'Order'}
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{order.restaurant_name || 'Unknown'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{order.channel || 'unknown'}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getOrderStatusBadgeClass(order.status)}`}>{order.status}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${coerceMoneyValue(order.total_amount).toFixed(2)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {order.is_sla_breached ? <span className="text-red-600 font-medium">Breached</span> : <span className="text-green-600">On time</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-300">
          <p>Page {pagination.page} of {Math.max(1, pagination.pages)}</p>
          <div className="flex items-center gap-2">
            <button disabled={pagination.page <= 1} onClick={() => setPagination((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))} className="rounded border border-gray-300 px-3 py-1 disabled:opacity-50">Previous</button>
            <button disabled={pagination.page >= pagination.pages} onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))} className="rounded border border-gray-300 px-3 py-1 disabled:opacity-50">Next</button>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
