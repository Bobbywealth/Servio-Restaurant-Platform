import Link from 'next/link'
import React from 'react'
import { ClipboardList } from 'lucide-react'
import { AdminOrderSummary, coerceMoneyValue, getOrderStatusBadgeClass } from '../../../lib/adminOrders'

type OrderTableViewProps = {
  orders: AdminOrderSummary[]
  selectedIds: string[]
  isLoading: boolean
  errorMessage: string | null
  onToggleSelectOrder: (orderId: string) => void
}

export default function OrderTableView({
  orders,
  selectedIds,
  isLoading,
  errorMessage,
  onToggleSelectOrder
}: OrderTableViewProps) {
  return (
    <section>
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center">
        <ClipboardList className="w-5 h-5 mr-2 text-gray-400" />
        Recent Activity
      </h2>
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading table view...</div>
        ) : errorMessage ? (
          <div className="p-8 text-center text-red-600">{errorMessage}</div>
        ) : orders.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No orders found for the selected filters</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Select</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Restaurant</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Channel</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SLA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {orders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input type="checkbox" checked={selectedIds.includes(order.id)} onChange={() => onToggleSelectOrder(order.id)} />
                  </td>
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
        )}
      </div>
    </section>
  )
}
