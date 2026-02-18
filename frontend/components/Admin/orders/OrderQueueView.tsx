import Link from 'next/link'
import React from 'react'
import { Clock } from 'lucide-react'
import { AdminOrderSummary, coerceMoneyValue } from '../../../lib/adminOrders'

type OrderQueueViewProps = {
  orders: AdminOrderSummary[]
  selectedIds: string[]
  isLoading: boolean
  errorMessage: string | null
  onToggleSelectOrder: (orderId: string) => void
}

export default function OrderQueueView({
  orders,
  selectedIds,
  isLoading,
  errorMessage,
  onToggleSelectOrder
}: OrderQueueViewProps) {
  if (isLoading) {
    return <div className="p-8 text-center text-gray-500">Loading queue...</div>
  }

  if (errorMessage) {
    return <div className="p-8 text-center text-red-600">{errorMessage}</div>
  }

  if (orders.length === 0) {
    return <div className="p-8 text-center text-gray-500">No pending orders</div>
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center">
          <Clock className="w-5 h-5 mr-2 text-yellow-500" />
          Pending Orders
          <span className="ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            {orders.length}
          </span>
        </h2>
      </div>

      <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
        <ul className="divide-y divide-gray-200 dark:divide-gray-700">
          {orders.map((order) => (
            <li key={order.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700">
              <div className="flex items-center justify-between gap-4">
                <label className="inline-flex items-center gap-2">
                  <input type="checkbox" checked={selectedIds.includes(order.id)} onChange={() => onToggleSelectOrder(order.id)} />
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
      </div>
    </section>
  )
}
