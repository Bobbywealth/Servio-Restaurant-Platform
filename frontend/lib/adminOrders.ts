export type OrderStatus = 'pending' | 'accepted' | 'preparing' | 'ready' | 'completed' | 'cancelled' | string

export interface AdminOrderSummary {
  id: string
  status: OrderStatus
  restaurant_id?: string
  restaurant_name?: string | null
  channel?: string | null
  customer_name?: string
  customer_phone?: string
  total_amount?: number | string | null
  created_at: string
  source?: string
  is_sla_breached?: boolean
  sla_minutes_elapsed?: number
}

export const coerceMoneyValue = (value: number | string | null | undefined): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return 0
}

export const getOrderStatusBadgeClass = (status: OrderStatus): string => {
  switch (status) {
    case 'pending':
      return 'bg-yellow-100 text-yellow-800'
    case 'accepted':
      return 'bg-blue-100 text-blue-800'
    case 'preparing':
      return 'bg-indigo-100 text-indigo-800'
    case 'ready':
      return 'bg-purple-100 text-purple-800'
    case 'completed':
      return 'bg-green-100 text-green-800'
    case 'cancelled':
      return 'bg-red-100 text-red-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}
