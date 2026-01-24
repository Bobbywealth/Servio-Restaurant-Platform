import React, { useEffect, useMemo, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import DashboardLayout from '../../../components/Layout/DashboardLayout'
import { useUser } from '../../../contexts/UserContext'
import { api } from '../../../lib/api'
import { useSocket } from '../../../lib/socket'
import { ClipboardList, RefreshCw } from 'lucide-react'

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

function formatCurrency(amount?: number) {
  if (typeof amount !== 'number') return '—'
  return `$${amount.toFixed(2)}`
}

export default function OrdersTabletPage() {
  const { user, hasPermission } = useUser()
  const socket = useSocket()
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null)

  const canUpdateOrders = hasPermission('orders', 'update')

  const latestOrder = useMemo(() => {
    if (orders.length === 0) return null
    return [...orders].sort((a, b) => {
      const aTime = new Date(a.created_at || 0).getTime()
      const bTime = new Date(b.created_at || 0).getTime()
      return bTime - aTime
    })[0]
  }, [orders])

  const fetchData = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const ordersRes = await api.get('/api/orders', {
        params: {
          limit: 50,
          offset: 0
        }
      })

      const nextOrders: Order[] = ordersRes.data?.data?.orders || []
      setOrders(nextOrders)
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
  }, [])

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
  }, [socket])

  const updateOrderStatus = async (orderId: string, status: OrderStatus) => {
    if (!canUpdateOrders) return
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
        <title>Orders Tablet - Servio</title>
        <meta name="description" content="Tablet-friendly order management" />
      </Head>

      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-surface-900 dark:text-surface-100 flex items-center">
                <ClipboardList className="w-6 h-6 mr-2 text-primary-600 dark:text-primary-400" />
                Orders Tablet View
              </h1>
              <p className="mt-2 text-sm sm:text-base text-surface-600 dark:text-surface-400">
                Tablet layout focused on the latest order.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link className="btn-secondary" href="/dashboard/orders">
                Back to Orders
              </Link>
              <button
                className="btn-primary inline-flex items-center"
                onClick={fetchData}
                disabled={isLoading}
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

          <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)_320px]">
            <section className="card space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-surface-900 dark:text-surface-100">Orders</h2>
                <span className="text-xs text-surface-500 dark:text-surface-400">{orders.length} total</span>
              </div>

              <div className="space-y-3">
                {orders.length === 0 ? (
                  <div className="text-sm text-surface-500 dark:text-surface-400">
                    {isLoading ? 'Loading orders…' : 'No orders available.'}
                  </div>
                ) : (
                  orders.map((order) => (
                    <div
                      key={order.id}
                      className={`rounded-2xl border p-4 transition ${
                        latestOrder?.id === order.id
                          ? 'border-primary-300 bg-primary-50/60 dark:border-primary-600 dark:bg-primary-900/20'
                          : 'border-surface-200 dark:border-surface-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-surface-900 dark:text-surface-100">
                            {order.external_id || order.id}
                          </p>
                          <p className="text-xs text-surface-500 dark:text-surface-400">
                            {order.customer_name || 'Walk-in'}
                          </p>
                        </div>
                        <span className={statusBadgeClass(order.status)}>{statusLabel[order.status]}</span>
                      </div>
                      <div className="mt-3 flex items-center justify-between text-xs text-surface-500 dark:text-surface-400">
                        <span>{order.channel || 'In-store'}</span>
                        <span>{formatCurrency(order.total_amount)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="card space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-surface-900 dark:text-surface-100">Latest Order</h2>
                {latestOrder?.created_at && (
                  <span className="text-xs text-surface-500 dark:text-surface-400">
                    {new Date(latestOrder.created_at).toLocaleString()}
                  </span>
                )}
              </div>

              {latestOrder ? (
                <>
                  <div className="rounded-2xl border border-surface-200 dark:border-surface-700 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-lg font-semibold text-surface-900 dark:text-surface-100">
                          {latestOrder.external_id || latestOrder.id}
                        </p>
                        <p className="text-sm text-surface-600 dark:text-surface-400">
                          {latestOrder.customer_name || 'Walk-in customer'}
                        </p>
                      </div>
                      <span className={statusBadgeClass(latestOrder.status)}>{statusLabel[latestOrder.status]}</span>
                    </div>

                    <div className="mt-4 grid gap-2 text-sm text-surface-600 dark:text-surface-400 sm:grid-cols-2">
                      <div>Channel: <span className="text-surface-900 dark:text-surface-100">{latestOrder.channel || 'In-store'}</span></div>
                      <div>Total: <span className="text-surface-900 dark:text-surface-100">{formatCurrency(latestOrder.total_amount)}</span></div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-surface-900 dark:text-surface-100">Items</h3>
                    <div className="mt-3 space-y-3">
                      {Array.isArray(latestOrder.items) && latestOrder.items.length > 0 ? (
                        latestOrder.items.map((item, index) => (
                          <div key={`${item.name || 'item'}-${index}`} className="flex items-center justify-between rounded-xl border border-surface-200 dark:border-surface-700 px-4 py-3">
                            <div>
                              <p className="text-sm font-semibold text-surface-900 dark:text-surface-100">
                                {item.name || 'Item'}
                              </p>
                              <p className="text-xs text-surface-500 dark:text-surface-400">
                                Qty: {item.quantity || 1}
                              </p>
                            </div>
                            <span className="text-sm text-surface-700 dark:text-surface-300">
                              {formatCurrency(item.price)}
                            </span>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-surface-500 dark:text-surface-400">No items listed.</p>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-sm text-surface-500 dark:text-surface-400">
                  {isLoading ? 'Loading latest order…' : 'No orders yet.'}
                </div>
              )}
            </section>

            <section className="card space-y-6">
              <h2 className="text-base font-semibold text-surface-900 dark:text-surface-100">Customer & Actions</h2>

              <div className="rounded-2xl border border-surface-200 dark:border-surface-700 p-4">
                <p className="text-xs uppercase tracking-wide text-surface-500 dark:text-surface-400">Customer</p>
                <p className="mt-2 text-sm font-semibold text-surface-900 dark:text-surface-100">
                  {latestOrder?.customer_name || 'Walk-in customer'}
                </p>
                <p className="mt-1 text-sm text-surface-600 dark:text-surface-400">
                  {latestOrder?.customer_phone || 'No phone on file'}
                </p>
              </div>

              <div className="rounded-2xl border border-surface-200 dark:border-surface-700 p-4">
                <p className="text-xs uppercase tracking-wide text-surface-500 dark:text-surface-400">Notes</p>
                <p className="mt-2 text-sm text-surface-600 dark:text-surface-400">
                  Use this area to display prep notes, allergy alerts, or pickup instructions.
                </p>
              </div>

              <div className="space-y-3">
                <button
                  className="btn-primary w-full"
                  disabled={!latestOrder || updatingOrderId === latestOrder?.id || !canUpdateOrders}
                  onClick={() => latestOrder && updateOrderStatus(latestOrder.id, 'preparing')}
                >
                  Mark as Preparing
                </button>
                <button
                  className="btn-secondary w-full"
                  disabled={!latestOrder || updatingOrderId === latestOrder?.id || !canUpdateOrders}
                  onClick={() => latestOrder && updateOrderStatus(latestOrder.id, 'ready')}
                >
                  Ready for Pickup
                </button>
                <button
                  className="btn-outline w-full"
                  disabled={!latestOrder || updatingOrderId === latestOrder?.id || !canUpdateOrders}
                  onClick={() => latestOrder && updateOrderStatus(latestOrder.id, 'completed')}
                >
                  Complete Order
                </button>
              </div>
            </section>
          </div>
        </div>
      </DashboardLayout>
    </>
  )
}
