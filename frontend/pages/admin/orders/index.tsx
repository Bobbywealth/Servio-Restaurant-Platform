import React, { useEffect, useState } from 'react'
import AdminLayout from '../../../components/Layout/AdminLayout'
import { api } from '../../../lib/api'
import { AdminOrderSummary, coerceMoneyValue, getOrderStatusBadgeClass } from '../../../lib/adminOrders'
import { useSocket } from '../../../lib/socket'
import Link from 'next/link'
import { ClipboardList, Clock } from 'lucide-react'

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<AdminOrderSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const socket = useSocket()

  const fetchOrders = async () => {
    try {
      const res = await api.get('/api/admin/orders')
      setOrders(res.data.orders || [])
      setErrorMessage(null)
    } catch (error) {
      console.error('Failed to fetch orders:', error)
      setErrorMessage('Unable to load orders right now. Please refresh and try again.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchOrders()
  }, [])

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
  }, [socket])

  const pendingOrders = orders.filter(o => o.status === 'pending')
  const otherOrders = orders.filter(o => o.status !== 'pending')

  return (
    <AdminLayout title="Order Management">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Pending Orders Section */}
        <section>
          {errorMessage && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {errorMessage}
            </div>
          )}
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
            {pendingOrders.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No pending orders</div>
            ) : (
              <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                {pendingOrders.map((order) => (
                  <li key={order.id}>
                    <Link href={`/admin/orders/${order.id}`} className="block hover:bg-gray-50 dark:hover:bg-gray-700 p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-red-600 truncate">{order.customer_name || 'Anonymous'}</p>
                          <p className="text-sm text-gray-500">{order.customer_phone}</p>
                          <p className="text-xs text-gray-400">{order.restaurant_name || 'Unknown restaurant'}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-gray-900 dark:text-white">${coerceMoneyValue(order.total_amount).toFixed(2)}</p>
                          <p className="text-xs text-gray-400">{new Date(order.created_at).toLocaleTimeString()}</p>
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Recent Orders Section */}
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {order.restaurant_name || 'Unknown'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        getOrderStatusBadgeClass(order.status)
                      }`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      ${coerceMoneyValue(order.total_amount).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {new Date(order.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AdminLayout>
  )
}
