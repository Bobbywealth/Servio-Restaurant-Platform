import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import AdminLayout from '../../../components/Layout/AdminLayout'
import { api } from '../../../lib/api'
import { AdminOrderSummary, coerceMoneyValue } from '../../../lib/adminOrders'
import { useSocket } from '../../../lib/socket'
import OrderQueueView from '../../../components/Admin/orders/OrderQueueView'
import OrderTableView from '../../../components/Admin/orders/OrderTableView'
import OrderKanbanView from '../../../components/Admin/orders/OrderKanbanView'

type Filters = {
  restaurantId: string
  channel: string
  status: string
  timeWindowHours: string
  slaBreached: string
  search: string
}

type OrdersView = 'queue' | 'table' | 'kanban'

const DEFAULT_FILTERS: Filters = {
  restaurantId: '',
  channel: 'all',
  status: 'all',
  timeWindowHours: '168',
  slaBreached: 'all',
  search: ''
}

const VIEW_OPTIONS: OrdersView[] = ['queue', 'table', 'kanban']
const DEFAULT_VIEW: OrdersView = 'queue'

const coerceView = (value: string | string[] | undefined): OrdersView => {
  if (typeof value !== 'string') return DEFAULT_VIEW
  return VIEW_OPTIONS.includes(value as OrdersView) ? (value as OrdersView) : DEFAULT_VIEW
}

export default function AdminOrdersPage() {
  const router = useRouter()
  const [orders, setOrders] = useState<AdminOrderSummary[]>([])
  const [restaurants, setRestaurants] = useState<{ id: string; name: string }[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isBulkRunning, setIsBulkRunning] = useState(false)
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0, limit: 100 })
  const [view, setView] = useState<OrdersView>(DEFAULT_VIEW)
  const socket = useSocket()

  const fetchRestaurants = useCallback(async () => {
    try {
      const res = await api.get('/api/admin/restaurants', { params: { limit: 200, page: 1 } })
      setRestaurants((res.data.restaurants || []).map((restaurant: any) => ({ id: restaurant.id, name: restaurant.name })))
    } catch (error) {
      console.error('Failed to fetch restaurants:', error)
    }
  }, [])

  const fetchOrders = useCallback(async () => {
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
  }, [filters, pagination.limit, pagination.page])

  useEffect(() => {
    if (!router.isReady) return
    setView(coerceView(router.query.view))
  }, [router.isReady, router.query.view])

  useEffect(() => {
    if (!router.isReady) return

    const queryView = coerceView(router.query.view)
    if (queryView === view) return

    router.replace(
      {
        pathname: router.pathname,
        query: { ...router.query, view }
      },
      undefined,
      { shallow: true }
    )
  }, [router, router.isReady, router.pathname, router.query, view])

  useEffect(() => {
    fetchRestaurants()
  }, [fetchRestaurants])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

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
  }, [socket, fetchOrders])

  const pendingOrders = useMemo(() => orders.filter(o => o.status === 'pending'), [orders])
  const allVisibleOrderIds = useMemo(() => orders.map(o => o.id), [orders])
  const totalRevenueVisible = useMemo(() => orders.reduce((sum, order) => sum + coerceMoneyValue(order.total_amount), 0), [orders])
  const hasSelectedAllVisible = useMemo(
    () => allVisibleOrderIds.length > 0 && allVisibleOrderIds.every((orderId) => selectedIds.includes(orderId)),
    [allVisibleOrderIds, selectedIds]
  )

  const toggleSelectOrder = (orderId: string) => {
    setSelectedIds(prev => (prev.includes(orderId) ? prev.filter(id => id !== orderId) : [...prev, orderId]))
  }

  const toggleSelectAllVisible = () => {
    setSelectedIds((prev) => {
      if (hasSelectedAllVisible) {
        return prev.filter((orderId) => !allVisibleOrderIds.includes(orderId))
      }
      return Array.from(new Set([...prev, ...allVisibleOrderIds]))
    })
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

  const renderActiveView = () => {
    if (view === 'table') {
      return (
        <OrderTableView
          orders={orders}
          selectedIds={selectedIds}
          isLoading={isLoading}
          errorMessage={errorMessage}
          onToggleSelectOrder={toggleSelectOrder}
        />
      )
    }

    if (view === 'kanban') {
      return (
        <OrderKanbanView
          orders={orders}
          selectedIds={selectedIds}
          isLoading={isLoading}
          errorMessage={errorMessage}
          onToggleSelectOrder={toggleSelectOrder}
        />
      )
    }

    return (
      <OrderQueueView
        orders={pendingOrders}
        selectedIds={selectedIds}
        isLoading={isLoading}
        errorMessage={errorMessage}
        onToggleSelectOrder={toggleSelectOrder}
      />
    )
  }

  return (
    <AdminLayout title="Order Management">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <section className="bg-white dark:bg-gray-800 shadow rounded-lg p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
            <input value={filters.search} onChange={(e) => { setPagination((prev) => ({ ...prev, page: 1 })); setFilters(prev => ({ ...prev, search: e.target.value })) }} placeholder="Search order ID, customer, phone, restaurant" className="input-field" />

            <select value={filters.restaurantId} onChange={(e) => { setPagination((prev) => ({ ...prev, page: 1 })); setFilters(prev => ({ ...prev, restaurantId: e.target.value })) }} className="input-field">
              <option value="">All restaurants</option>
              {restaurants.map((restaurant) => <option key={restaurant.id} value={restaurant.id}>{restaurant.name}</option>)}
            </select>

            <select value={filters.channel} onChange={(e) => { setPagination((prev) => ({ ...prev, page: 1 })); setFilters(prev => ({ ...prev, channel: e.target.value })) }} className="input-field">
              <option value="all">All channels</option>
              <option value="vapi_voice">Voice AI</option>
              <option value="web">Web</option>
              <option value="phone">Phone</option>
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
              <option value="72">Last 3 days</option>
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

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex rounded-md border border-gray-300 dark:border-gray-600 overflow-hidden">
              {VIEW_OPTIONS.map((option) => (
                <button
                  key={option}
                  onClick={() => setView(option)}
                  className={`px-3 py-1.5 text-sm capitalize ${view === option ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900' : 'bg-white text-gray-700 dark:bg-gray-800 dark:text-gray-200'}`}
                >
                  {option}
                </button>
              ))}
            </div>

            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" checked={hasSelectedAllVisible} onChange={toggleSelectAllVisible} />
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

        {renderActiveView()}

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
