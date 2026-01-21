import React, { useEffect, useMemo, useState } from 'react'
import Head from 'next/head'
import DashboardLayout from '../../components/Layout/DashboardLayout'
import { useUser } from '../../contexts/UserContext'
import { api } from '../../lib/api'
import { useSocket } from '../../lib/socket'
import { RefreshCw, Filter, ClipboardList } from 'lucide-react'

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
  items?: OrderItem[]
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

  const fetchData = async () => {
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
  }

  useEffect(() => {
    if (!hasPermission('orders', 'read')) return
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
              <button
                className="btn-primary inline-flex items-center"
                onClick={createTestOrder}
                disabled={isLoading}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Create Test Order
              </button>
              
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
                Please check your internet connection or contact support if the issue persists.
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

          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200 dark:border-surface-700">
                  <th className="text-left py-3 px-2 font-semibold text-surface-600 dark:text-surface-400">Order</th>
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
                {orders.length === 0 ? (
                  <tr>
                    <td className="py-6 px-2 text-surface-500 dark:text-surface-400" colSpan={canUpdateOrders ? 7 : 6}>
                      {isLoading ? 'Loading orders…' : 'No orders found.'}
                    </td>
                  </tr>
                ) : (
                  orders.map((o) => (
                    <tr key={o.id} className="border-b border-surface-100 dark:border-surface-800">
                      <td className="py-3 px-2">
                        <div className="font-semibold text-surface-900 dark:text-surface-100">{o.external_id || o.id}</div>
                        {o.created_at && (
                          <div className="text-xs text-surface-500 dark:text-surface-400">
                            {new Date(o.created_at).toLocaleString()}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-2 text-surface-700 dark:text-surface-300">
                        {o.customer_name || '—'}
                      </td>
                      <td className="py-3 px-2 text-surface-700 dark:text-surface-300">
                        {o.channel || '—'}
                      </td>
                      <td className="py-3 px-2 text-surface-700 dark:text-surface-300">
                        {Array.isArray(o.items) ? o.items.length : 0}
                      </td>
                      <td className="py-3 px-2 text-surface-700 dark:text-surface-300">
                        {typeof o.total_amount === 'number' ? `$${o.total_amount.toFixed(2)}` : '—'}
                      </td>
                      <td className="py-3 px-2">
                        <span className={statusBadgeClass(o.status)}>
                          {statusLabel[o.status] || o.status}
                        </span>
                      </td>
                      {canUpdateOrders && (
                        <td className="py-3 px-2 text-right">
                          <select
                            className="input-field inline-block w-48"
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
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </DashboardLayout>
    </>
  )
}
