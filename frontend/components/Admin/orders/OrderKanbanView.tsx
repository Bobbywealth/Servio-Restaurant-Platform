import Link from 'next/link'
import React, { useMemo } from 'react'
import { AdminOrderSummary, coerceMoneyValue, getOrderStatusBadgeClass } from '../../../lib/adminOrders'

type OrderKanbanViewProps = {
  orders: AdminOrderSummary[]
  selectedIds: string[]
  isLoading: boolean
  errorMessage: string | null
  onToggleSelectOrder: (orderId: string) => void
}

const STATUS_COLUMNS = ['pending', 'accepted', 'preparing', 'ready', 'completed', 'cancelled']

export default function OrderKanbanView({
  orders,
  selectedIds,
  isLoading,
  errorMessage,
  onToggleSelectOrder
}: OrderKanbanViewProps) {
  const groupedOrders = useMemo(() => {
    return orders.reduce<Record<string, AdminOrderSummary[]>>((acc, order) => {
      const key = order.status || 'unknown'
      if (!acc[key]) acc[key] = []
      acc[key].push(order)
      return acc
    }, {})
  }, [orders])

  const statusColumns = useMemo(() => {
    const unknownStatuses = Object.keys(groupedOrders).filter((status) => !STATUS_COLUMNS.includes(status))
    return [...STATUS_COLUMNS, ...unknownStatuses]
  }, [groupedOrders])

  if (isLoading) {
    return <div className="p-8 text-center text-gray-500">Loading kanban view...</div>
  }

  if (errorMessage) {
    return <div className="p-8 text-center text-red-600">{errorMessage}</div>
  }

  if (orders.length === 0) {
    return <div className="p-8 text-center text-gray-500">No orders available for kanban view</div>
  }

  return (
    <section>
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Order Kanban</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {statusColumns.map((status) => {
          const columnOrders = groupedOrders[status] || []

          return (
            <div key={status} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
              <div className="flex items-center justify-between mb-3">
                <span className={`px-2 py-1 text-xs font-semibold rounded-full capitalize ${getOrderStatusBadgeClass(status)}`}>
                  {status}
                </span>
                <span className="text-xs text-gray-500">{columnOrders.length}</span>
              </div>
              <div className="space-y-2 max-h-[420px] overflow-auto pr-1">
                {columnOrders.length === 0 ? (
                  <p className="text-sm text-gray-400">No orders</p>
                ) : (
                  columnOrders.map((order) => (
                    <div key={order.id} className="rounded border border-gray-200 dark:border-gray-700 p-2 bg-gray-50 dark:bg-gray-900/40">
                      <div className="flex items-start gap-2">
                        <input type="checkbox" checked={selectedIds.includes(order.id)} onChange={() => onToggleSelectOrder(order.id)} className="mt-1" />
                        <div className="min-w-0 flex-1">
                          <Link href={`/admin/orders/${order.id}`} className="text-sm font-medium text-gray-900 dark:text-white truncate block">
                            {order.customer_name || 'Order'}
                          </Link>
                          <p className="text-xs text-gray-500 truncate">{order.restaurant_name || 'Unknown restaurant'}</p>
                          <p className="text-xs text-gray-500">${coerceMoneyValue(order.total_amount).toFixed(2)}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
