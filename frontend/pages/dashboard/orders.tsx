import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import DashboardLayout from '../../components/Layout/DashboardLayout'
import { useUser } from '../../contexts/UserContext'
import { api } from '../../lib/api'
import { useSocket } from '../../lib/socket'
import { RefreshCw, Filter, ClipboardList, Search, Clock, Phone, Globe, Smartphone, ChevronRight, X, Printer, CheckCircle, PlayCircle, Check, BarChart3 } from 'lucide-react'
import { OrderCardSkeleton, StatCardSkeleton, TableRowSkeleton } from '../../components/ui/Skeleton'
import { PullToRefresh } from '../../components/ui/PullToRefresh'
import { useHaptic } from '../../lib/haptics'
import { AnimatePresence, motion } from 'framer-motion'
import { OrderAnalytics } from '../../components/OrderAnalytics'
import BusinessDatePicker from '../../components/ui/BusinessDatePicker'
import { getDateStringInTimezone, isDateInBusinessDay, isValidDateString } from '../../utils/businessDate'

type OrderStatus = 'received' | 'preparing' | 'ready' | 'completed' | 'cancelled'

interface OrderItem {
  name?: string
  quantity?: number
  price?: number
  modifiers?: Record<string, any>
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
  order_type?: string
  notes?: string
}

interface OrdersSummary {
  totalOrders: number
  activeOrders: number
  completedToday: number
  avgOrderValue: number
  ordersByStatus: Record<string, number>
  ordersByChannel: Record<string, number>
}

const statusConfig: Record<OrderStatus, { label: string; color: string; icon: React.ReactNode }> = {
  received: { label: 'Received', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400', icon: <Phone className="w-3.5 h-3.5" /> },
  preparing: { label: 'Preparing', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', icon: <PlayCircle className="w-3.5 h-3.5" /> },
  ready: { label: 'Ready', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', icon: <CheckCircle className="w-3.5 h-3.5" /> },
  completed: { label: 'Completed', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300', icon: <Check className="w-3.5 h-3.5" /> },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', icon: <X className="w-3.5 h-3.5" /> }
}

const channelConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  phone: { label: 'Phone', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400', icon: <Phone className="w-3 h-3" /> },
  vapi: { label: 'AI Phone', color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400', icon: <Smartphone className="w-3 h-3" /> },
  online: { label: 'Online', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', icon: <Globe className="w-3 h-3" /> },
  doordash: { label: 'DoorDash', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', icon: <Globe className="w-3 h-3" /> },
  grubhub: { label: 'Grubhub', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400', icon: <Globe className="w-3 h-3" /> },
  ubereats: { label: 'UberEats', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', icon: <Globe className="w-3 h-3" /> },
  test: { label: 'Test', color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300', icon: <ClipboardList className="w-3 h-3" /> }
}

function getChannelConfig(channel: string) {
  return channelConfig[channel.toLowerCase()] || { label: channel, color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300', icon: <Globe className="w-3 h-3" /> }
}

function humanizeModifierText(value: string): string {
  const normalized = value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!normalized) return ''

  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

function looksLikeOpaqueId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    || /^[a-z0-9]{20,}$/i.test(value)
}

function extractModifierValues(value: unknown): string[] {
  if (value == null) return []

  if (Array.isArray(value)) {
    return value.flatMap(extractModifierValues).filter(Boolean)
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed || looksLikeOpaqueId(trimmed)) return []
    return [humanizeModifierText(trimmed)]
  }

  if (typeof value === 'number') {
    return [String(value)]
  }

  if (typeof value === 'boolean') {
    return value ? ['Yes'] : ['No']
  }

  if (typeof value === 'object') {
    const optionLikeValue = (value as any).optionName || (value as any).option_name || (value as any).name || (value as any).label || (value as any).value
    if (typeof optionLikeValue === 'string') {
      const parsedOption = extractModifierValues(optionLikeValue)
      if (parsedOption.length > 0) return parsedOption
    }

    return Object.entries(value as Record<string, unknown>).flatMap(([key, nestedValue]) => {
      if (typeof nestedValue === 'boolean') {
        return nestedValue ? [humanizeModifierText(key)] : []
      }

      const nested = extractModifierValues(nestedValue)
      if (nested.length === 0) return []

      return nested.map(entry => `${humanizeModifierText(key)}: ${entry}`)
    })
  }

  return [String(value)]
}

function formatElapsed(seconds: number): string {
  if (seconds < 60) return '<1m'

  const totalMinutes = Math.floor(seconds / 60)

  if (totalMinutes < 60) return `${totalMinutes}m`

  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (hours < 24) return `${hours}h ${minutes}m`

  const days = Math.floor(hours / 24)
  const remainingHours = hours % 24
  return `${days}d ${remainingHours}h`
}

function OrderTimer({ createdAt, updatedAt, status }: { createdAt: string; updatedAt?: string; status?: string }) {
  const [elapsed, setElapsed] = useState('')
  const [minutes, setMinutes] = useState(0)

  // Don't update timer if order is completed or cancelled
  const isFinalStatus = status === 'completed' || status === 'cancelled'

  useEffect(() => {
    const created = new Date(createdAt).getTime()
    if (!Number.isFinite(created)) {
      setMinutes(0)
      setElapsed('—')
      return
    }

    const getDiffSeconds = () => {
      const endTime = isFinalStatus && updatedAt ? new Date(updatedAt).getTime() : Date.now()

      if (!Number.isFinite(endTime)) {
        return Math.max(0, Math.floor((Date.now() - created) / 1000))
      }

      return Math.max(0, Math.floor((endTime - created) / 1000))
    }

    const updateElapsed = () => {
      const diffSeconds = getDiffSeconds()
      const mins = Math.floor(diffSeconds / 60)
      setMinutes(mins)
      setElapsed(formatElapsed(diffSeconds))
    }

    // Skip interval setup for final statuses
    if (isFinalStatus) {
      updateElapsed()
      return
    }

    updateElapsed()
    const interval = setInterval(updateElapsed, 1000)
    return () => clearInterval(interval)
  }, [createdAt, updatedAt, isFinalStatus])

  const timerColor = isFinalStatus 
    ? 'text-gray-400 dark:text-gray-500' 
    : minutes > 15 
      ? 'text-red-600 dark:text-red-400' 
      : minutes > 10 
        ? 'text-amber-600 dark:text-amber-400' 
        : 'text-surface-600 dark:text-surface-400'

  return (
    <div className={`flex items-center gap-1 text-sm font-mono ${timerColor}`}>
      <Clock className="w-3.5 h-3.5" />
      <span>{elapsed}</span>
      {isFinalStatus && (
        <span className="text-xs opacity-50 ml-1">
          ({status === 'completed' ? 'Done' : 'Cancelled'})
        </span>
      )}
    </div>
  )
}

function OrderDetailModal({ order, onClose }: { order: Order | null; onClose: () => void }) {
  if (!order) return null

  const channel = getChannelConfig(order.channel || 'unknown')

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Order {order.external_id || order.id.slice(0, 8)}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${channel.color}`}>
                  {channel.icon}
                  {channel.label}
                </span>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig[order.status as OrderStatus]?.color}`}>
                  {statusConfig[order.status as OrderStatus]?.icon}
                  {statusConfig[order.status as OrderStatus]?.label}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-4 overflow-y-auto max-h-[calc(90vh-200px)]">
            {/* Timer & Time */}
            <div className="flex items-center justify-between mb-4">
              <OrderTimer createdAt={order.created_at || ''} updatedAt={order.updated_at} status={order.status} />
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {order.created_at && new Date(order.created_at).toLocaleString()}
              </span>
            </div>

            {/* Customer Info */}
            {(order.customer_name || order.customer_phone || order.order_type) && (
              <div className="card bg-gray-50 dark:bg-gray-700/50 mb-4">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Customer</h3>
                <div className="space-y-1 text-sm">
                  {order.customer_name && (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 dark:text-gray-400">Name:</span>
                      <span className="font-medium text-gray-900 dark:text-white">{order.customer_name}</span>
                    </div>
                  )}
                  {order.customer_phone && (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 dark:text-gray-400">Phone:</span>
                      <a href={`tel:${order.customer_phone}`} className="font-medium text-primary-600 hover:underline">
                        {order.customer_phone}
                      </a>
                    </div>
                  )}
                  {order.order_type && (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 dark:text-gray-400">Type:</span>
                      <span className="font-medium text-gray-900 dark:text-white capitalize">{order.order_type}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Order Items */}
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Items</h3>
              <div className="space-y-2">
                {Array.isArray(order.items) && order.items.map((item, idx) => (
                  <div key={idx} className="flex items-start justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 dark:text-white">{item.quantity}x</span>
                        <span className="text-gray-900 dark:text-white">{item.name}</span>
                      </div>
                      {item.modifiers && Object.keys(item.modifiers).length > 0 && (
                        <div className="mt-2 ml-6 space-y-1 text-xs text-gray-600 dark:text-gray-300">
                          {Object.entries(item.modifiers).map(([key, value]) => {
                            const modifierValues = extractModifierValues(value)
                            const label = humanizeModifierText(key)

                            return (
                              <div key={key} className="leading-relaxed">
                                <span className="text-gray-800 dark:text-gray-100">• {label}</span>
                                {modifierValues.length > 0 && (
                                  <span className="text-gray-500 dark:text-gray-400">: {modifierValues.join(', ')}</span>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      ${((item.price || 0) * (item.quantity || 1)).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Total */}
            <div className="flex items-center justify-between p-4 bg-gray-900 dark:bg-gray-700 rounded-xl">
              <span className="text-lg font-semibold text-white">Total</span>
              <span className="text-2xl font-bold text-white">${Number(order.total_amount || 0).toFixed(2)}</span>
            </div>

            {/* Notes */}
            {order.notes && (
              <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <span className="text-xs font-semibold text-yellow-800 dark:text-yellow-400">Note:</span>
                <p className="mt-1 text-sm text-yellow-700 dark:text-yellow-300">{order.notes}</p>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          {order.status !== 'completed' && order.status !== 'cancelled' && (
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex gap-3">
              <button className="flex-1 btn-secondary flex items-center justify-center gap-2">
                <Printer className="w-4 h-4" />
                Print
              </button>
              <button className="flex-1 btn-primary flex items-center justify-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Quick Complete
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

type DateMode = 'today' | 'custom-day' | 'range'

export default function OrdersPage() {
  const router = useRouter()
  const { user, hasPermission } = useUser()
  const socket = useSocket()
  const { haptic, hapticWithVisual } = useHaptic()
  const [orders, setOrders] = useState<Order[]>([])
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([])
  const [summary, setSummary] = useState<OrdersSummary | null>(null)
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'active' | 'all'>('all')
  const [channelFilter, setChannelFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [showAnalytics, setShowAnalytics] = useState(false)
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null)
  const [secondsUntilRefresh, setSecondsUntilRefresh] = useState(30)
  const [restaurantTimezone, setRestaurantTimezone] = useState('America/New_York')
  const [selectedDate, setSelectedDate] = useState(() => getDateStringInTimezone('America/New_York'))
  const [dateMode, setDateMode] = useState<DateMode>('today')

  const todayInRestaurantTimezone = useMemo(
    () => getDateStringInTimezone(restaurantTimezone),
    [restaurantTimezone],
  )
  const isViewingToday = selectedDate === todayInRestaurantTimezone

  const canUpdateOrders = hasPermission('orders', 'update')

  useEffect(() => {
    if (!router.isReady) return

    const queryDate = Array.isArray(router.query.date) ? router.query.date[0] : router.query.date
    const localStorageDate = typeof window !== 'undefined' ? window.localStorage.getItem('servio:businessDate') : null
    const initialDate = [queryDate, localStorageDate].find((value): value is string => Boolean(value && isValidDateString(value)))

    if (initialDate) {
      setSelectedDate(initialDate)
      setDateMode(initialDate === todayInRestaurantTimezone ? 'today' : 'custom-day')
      return
    }

    setDateMode('today')
    setSelectedDate(todayInRestaurantTimezone)
  }, [router.isReady, router.query.date, todayInRestaurantTimezone])

  useEffect(() => {
    if (!router.isReady || !isValidDateString(selectedDate)) return

    const currentQueryDate = Array.isArray(router.query.date) ? router.query.date[0] : router.query.date
    if (currentQueryDate !== selectedDate) {
      router.replace(
        {
          pathname: router.pathname,
          query: { ...router.query, date: selectedDate },
        },
        undefined,
        { shallow: true },
      )
    }

    if (typeof window !== 'undefined') {
      window.localStorage.setItem('servio:businessDate', selectedDate)
    }
  }, [router, selectedDate])

  useEffect(() => {
    const orderIdParam = router.query.orderId
    const orderId = Array.isArray(orderIdParam) ? orderIdParam[0] : orderIdParam

    if (!orderId || orders.length === 0) return

    const matchingOrder = orders.find(order => order.id === orderId || order.external_id === orderId)
    if (!matchingOrder) return

    setSelectedOrder(matchingOrder)
    setStatusFilter('all')

    router.replace(
      {
        pathname: '/dashboard/orders',
        query: selectedDate ? { date: selectedDate } : undefined,
      },
      undefined,
      { shallow: true },
    )
  }, [orders, router, selectedDate])

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

  const resetListPosition = useCallback(() => {
    setSelectedOrder(null)
  }, [])

  const handleSelectToday = useCallback(() => {
    setDateMode('today')
    setSelectedDate(getDateStringInTimezone(restaurantTimezone))
    resetListPosition()
  }, [restaurantTimezone, resetListPosition])

  const handleSelectYesterday = useCallback(() => {
    setDateMode('custom-day')
    setSelectedDate(getDateStringInTimezone(restaurantTimezone, new Date(Date.now() - 24 * 60 * 60 * 1000)))
    resetListPosition()
  }, [restaurantTimezone, resetListPosition])

  const handleCustomDateChange = useCallback((date: string) => {
    setDateMode('custom-day')
    setSelectedDate(date)
    resetListPosition()
  }, [resetListPosition])

  const channels = useMemo(() => {
    const set = new Set<string>()
    orders.forEach(o => {
      if (o.channel) set.add(o.channel)
    })
    return Array.from(set).sort()
  }, [orders])

  useEffect(() => {
    const fetchRestaurantProfile = async () => {
      try {
        const profileRes = await api.get('/api/restaurant/profile')
        const timezone = profileRes.data?.data?.timezone || 'America/New_York'
        setRestaurantTimezone(timezone)
      } catch (e) {
        console.warn('Failed to load restaurant profile timezone for orders page', e)
      }
    }

    fetchRestaurantProfile()
  }, [])

  useEffect(() => {
    if (dateMode === 'today') {
      setSelectedDate(getDateStringInTimezone(restaurantTimezone))
    }
  }, [dateMode, restaurantTimezone])

  // Filter orders based on all filters including search
  useEffect(() => {
    let result = orders

    // Apply status filter
    if (statusFilter !== 'all') {
      if (statusFilter === 'active') {
        result = result.filter(o => ['received', 'preparing', 'ready'].includes(o.status))
      } else {
        result = result.filter(o => o.status === statusFilter)
      }
    }

    // Apply channel filter
    if (channelFilter !== 'all') {
      result = result.filter(o => o.channel === channelFilter)
    }

    // Apply date range filter
    if (dateFrom) {
      const startDate = new Date(`${dateFrom}T00:00:00`)
      if (!Number.isNaN(startDate.getTime())) {
        result = result.filter(o => {
          if (!o.created_at) return false
          const createdAt = new Date(o.created_at)
          return !Number.isNaN(createdAt.getTime()) && createdAt >= startDate
        })
      }
    }

    if (dateTo) {
      const endDate = new Date(`${dateTo}T23:59:59.999`)
      if (!Number.isNaN(endDate.getTime())) {
        result = result.filter(o => {
          if (!o.created_at) return false
          const createdAt = new Date(o.created_at)
          return !Number.isNaN(createdAt.getTime()) && createdAt <= endDate
        })
      }
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      result = result.filter(o =>
        o.id.toLowerCase().includes(query) ||
        o.external_id?.toLowerCase().includes(query) ||
        o.customer_name?.toLowerCase().includes(query) ||
        o.customer_phone?.includes(query) ||
        o.items?.some(item => item.name?.toLowerCase().includes(query))
      )
    }

    setFilteredOrders(result)
  }, [orders, statusFilter, channelFilter, dateFrom, dateTo, searchQuery])

  const emptyStateMessage = useMemo(() => {
    if (searchQuery) return 'No orders match your search.'
    if (dateFrom || dateTo) return 'No orders for selected date range.'
    return 'No orders found.'
  }, [searchQuery, dateFrom, dateTo])

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const [ordersRes, profileRes] = await Promise.all([
        api.get('/api/orders', {
          params: {
            dateFrom,
            dateTo,
            status: statusFilter === 'all' || statusFilter === 'active' ? undefined : statusFilter,
            channel: channelFilter === 'all' ? undefined : channelFilter,
            date: selectedDate,
            limit: 100,
            offset: 0
          }
        }),
        api.get('/api/restaurant/profile')
      ])

      const timezone = profileRes.data?.data?.timezone || restaurantTimezone
      setRestaurantTimezone(timezone)

      const nextOrders: Order[] = (ordersRes.data?.data?.orders || []).filter((order: Order) =>
        isDateInBusinessDay(order.created_at, selectedDate, timezone),
      )
      setOrders(nextOrders)

      const activeStatuses: OrderStatus[] = ['received', 'preparing', 'ready']
      const completedToday = nextOrders.filter((order) => order.status === 'completed').length
      const revenueOrders = nextOrders.filter((order) => !['cancelled'].includes(order.status))
      const revenueTotal = revenueOrders.reduce((sum, order) => sum + Number(order.total_amount || 0), 0)
      const summaryForDate: OrdersSummary = {
        totalOrders: nextOrders.length,
        activeOrders: nextOrders.filter((order) => activeStatuses.includes(order.status)).length,
        completedToday,
        avgOrderValue: revenueOrders.length ? revenueTotal / revenueOrders.length : 0,
        ordersByStatus: nextOrders.reduce<Record<string, number>>((acc, order) => {
          acc[order.status] = (acc[order.status] || 0) + 1
          return acc
        }, {}),
        ordersByChannel: nextOrders.reduce<Record<string, number>>((acc, order) => {
          const key = order.channel || 'unknown'
          acc[key] = (acc[key] || 0) + 1
          return acc
        }, {}),
      }

      setSummary(summaryForDate)
      setLastRefreshedAt(new Date())
      setSecondsUntilRefresh(30)
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || e?.message || 'Failed to load orders')
    } finally {
      setIsLoading(false)
    }
  }, [statusFilter, channelFilter, selectedDate, restaurantTimezone])

  useEffect(() => {
    if (!hasPermission('orders', 'read')) return
    fetchData()
  }, [statusFilter, channelFilter, dateFrom, dateTo, hasPermission, fetchData])

  useEffect(() => {
    if (!hasPermission('orders', 'read')) return

    const interval = setInterval(() => {
      setSecondsUntilRefresh((prev) => {
        if (prev <= 1) {
          fetchData()
          return 30
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [hasPermission, fetchData, dateFrom, dateTo])

  useEffect(() => {
    resetListPosition()
  }, [statusFilter, channelFilter, resetListPosition])

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
  }, [socket, fetchData])

  const updateOrderStatus = async (orderId: string, status: OrderStatus) => {
    if (!canUpdateOrders) return
    haptic('medium')
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

      haptic('success')
      await fetchData()
    } catch (e: any) {
      haptic('error')
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
        <PullToRefresh onRefresh={fetchData} disabled={!hasPermission('orders', 'read')}>
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-surface-900 dark:text-surface-100 flex items-center">
                <ClipboardList className="w-6 h-6 mr-2 text-primary-600 dark:text-primary-400" />
                Orders
              </h1>
              <p className="mt-1 text-sm text-surface-500 dark:text-surface-400">
                Track incoming orders and update kitchen progress.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <button
                className="btn-secondary inline-flex items-center justify-center min-h-[44px]"
                onClick={createTestOrder}
                disabled={isLoading}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Create Test Order</span>
                <span className="sm:hidden">Test Order</span>
              </button>

              <button
                className="btn-secondary inline-flex items-center justify-center min-h-[44px]"
                onClick={fetchData}
                disabled={isLoading}
                title={lastRefreshedAt ? `Last refreshed ${lastRefreshedAt.toLocaleTimeString()}` : 'Refresh'}
              >
                <RefreshCw className={`w-4 h-4 sm:mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>

              <button
                className={`inline-flex items-center justify-center min-h-[44px] px-4 ${showAnalytics ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setShowAnalytics(!showAnalytics)}
              >
                <BarChart3 className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">{showAnalytics ? 'Hide' : 'View'} Analytics</span>
                <span className="sm:hidden">{showAnalytics ? 'Stats' : 'Analytics'}</span>
              </button>
            </div>
          </div>

          <BusinessDatePicker
            selectedDate={selectedDate}
            timezone={restaurantTimezone}
            isToday={isViewingToday}
            onDateChange={setSelectedDate}
            onBackToToday={() => setSelectedDate(todayInRestaurantTimezone)}
          />

          <div className="text-xs text-surface-500 dark:text-surface-400">
            {lastRefreshedAt ? `Last refreshed ${lastRefreshedAt.toLocaleTimeString()}` : 'Loading orders...'}
            {!isLoading && <span className="ml-2">• Auto-refresh in {secondsUntilRefresh}s</span>}
          </div>

          {/* Analytics Section */}
          {showAnalytics && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <OrderAnalytics onRefresh={fetchData} />
            </motion.div>
          )}

          {error && (
            <div className="card border-servio-red-200 dark:border-servio-red-800">
              <div className="status-error">{error}</div>
              <p className="mt-2 text-sm text-surface-600 dark:text-surface-400">
                Please check your internet connection or contact support if the issue persists.
              </p>
            </div>
          )}

          {/* Summary Stats */}
          {isLoading && !summary ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
            </div>
          ) : summary && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <button className="card text-left hover:shadow-md transition-shadow" onClick={() => setStatusFilter('active')}>
                <p className="text-sm text-surface-600 dark:text-surface-400">Active Orders</p>
                <p className="mt-1 text-3xl font-bold text-surface-900 dark:text-surface-100">{summary.activeOrders}</p>
              </button>
              <button className="card text-left hover:shadow-md transition-shadow" onClick={() => setStatusFilter('all')}>
                <p className="text-sm text-surface-600 dark:text-surface-400">Total Orders</p>
                <p className="mt-1 text-3xl font-bold text-surface-900 dark:text-surface-100">{summary.totalOrders}</p>
              </button>
              <button className="card text-left hover:shadow-md transition-shadow" onClick={() => setStatusFilter('completed')}>
                <p className="text-sm text-surface-600 dark:text-surface-400">Completed Today</p>
                <p className="mt-1 text-3xl font-bold text-surface-900 dark:text-surface-100">{summary.completedToday}</p>
              </button>
              <div className="card">
                <p className="text-sm text-surface-600 dark:text-surface-400">Avg Ticket</p>
                <p className="mt-1 text-3xl font-bold text-surface-900 dark:text-surface-100">
                  ${Number(summary.avgOrderValue || 0).toFixed(2)}
                </p>
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="card sticky top-2 z-10 bg-white/95 dark:bg-surface-800/95 backdrop-blur sm:static">
            <div className="flex flex-col sm:flex-row sm:flex-wrap items-end gap-4">
              <div className="w-full">
                <label className="flex flex-col gap-2 text-sm text-surface-700 dark:text-surface-300">
                  <span className="font-medium flex items-center gap-1">
                    <Filter className="w-4 h-4" />
                    Day
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className={`px-3 py-2 rounded-full text-sm font-medium border transition-colors ${
                        dateMode === 'today'
                          ? 'bg-primary-600 border-primary-600 text-white'
                          : 'bg-white dark:bg-surface-800 border-surface-300 dark:border-surface-600 text-surface-700 dark:text-surface-300'
                      }`}
                      onClick={handleSelectToday}
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      className={`px-3 py-2 rounded-full text-sm font-medium border transition-colors ${
                        dateMode === 'custom-day' && selectedDate === getDateStringInTimezone(restaurantTimezone, new Date(Date.now() - 24 * 60 * 60 * 1000))
                          ? 'bg-primary-600 border-primary-600 text-white'
                          : 'bg-white dark:bg-surface-800 border-surface-300 dark:border-surface-600 text-surface-700 dark:text-surface-300'
                      }`}
                      onClick={handleSelectYesterday}
                    >
                      Yesterday
                    </button>
                    <input
                      type="date"
                      className="input-field min-h-[44px]"
                      value={selectedDate}
                      onChange={(e) => handleCustomDateChange(e.target.value)}
                    />
                  </div>
                </label>
              </div>

              {/* Search */}
              <div className="flex-1 min-w-[200px]">
                <label className="flex flex-col gap-1.5 text-sm text-surface-700 dark:text-surface-300">
                  <span className="font-medium flex items-center gap-1">
                    <Search className="w-4 h-4" />
                    Search
                  </span>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                    <input
                      type="text"
                      placeholder="Order ID, customer, phone, item..."
                      className="input-field w-full pl-10 pr-10 min-h-[44px]"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 hover:text-surface-700"
                        aria-label="Clear search"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </label>
              </div>

              {/* Status Filter */}
              <div className="w-full sm:w-40">
                <label className="flex flex-col gap-1.5 text-sm text-surface-700 dark:text-surface-300">
                  <span className="font-medium">Status</span>
                  <select
                    className="input-field w-full min-h-[44px]"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                  >
                    <option value="all">All</option>
                    <option value="active">Active</option>
                    <option value="received">Received</option>
                    <option value="preparing">Preparing</option>
                    <option value="ready">Ready</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </label>
              </div>

              {/* Channel Filter */}
              <div className="w-full sm:w-40">
                <label className="flex flex-col gap-1.5 text-sm text-surface-700 dark:text-surface-300">
                  <span className="font-medium">Channel</span>
                  <select
                    className="input-field w-full min-h-[44px]"
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

              {/* Date From */}
              <div className="w-full sm:w-44">
                <label className="flex flex-col gap-1.5 text-sm text-surface-700 dark:text-surface-300">
                  <span className="font-medium">From Date</span>
                  <input
                    type="date"
                    className="input-field w-full min-h-[44px]"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                </label>
              </div>

              {/* Date To */}
              <div className="w-full sm:w-44">
                <label className="flex flex-col gap-1.5 text-sm text-surface-700 dark:text-surface-300">
                  <span className="font-medium">To Date</span>
                  <input
                    type="date"
                    className="input-field w-full min-h-[44px]"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Desktop Table View */}
          <div className="hidden lg:block card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200 dark:border-surface-700">
                  <th className="text-left py-3 px-2 font-semibold text-surface-600 dark:text-surface-400">Order</th>
                  <th className="text-left py-3 px-2 font-semibold text-surface-600 dark:text-surface-400">Age</th>
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
                {isLoading && filteredOrders.length === 0 ? (
                  <>
                    <TableRowSkeleton columns={canUpdateOrders ? 8 : 7} />
                    <TableRowSkeleton columns={canUpdateOrders ? 8 : 7} />
                    <TableRowSkeleton columns={canUpdateOrders ? 8 : 7} />
                    <TableRowSkeleton columns={canUpdateOrders ? 8 : 7} />
                    <TableRowSkeleton columns={canUpdateOrders ? 8 : 7} />
                  </>
                ) : filteredOrders.length === 0 ? (
                  <tr>
                    <td className="py-6 px-2 text-surface-500 dark:text-surface-400" colSpan={canUpdateOrders ? 8 : 7}>
                      {emptyStateMessage}
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((o) => {
                    const channel = getChannelConfig(o.channel || 'unknown')
                    return (
                      <tr
                        key={o.id}
                        className="border-b border-surface-100 dark:border-surface-800 hover:bg-surface-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
                        onClick={() => setSelectedOrder(o)}
                      >
                        <td className="py-3 px-2">
                          <div className="font-semibold text-surface-900 dark:text-surface-100">{o.external_id || o.id.slice(0, 8)}</div>
                          {o.created_at && (
                            <div className="text-xs text-surface-500 dark:text-surface-400">
                              {new Date(o.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-2">
                          <OrderTimer createdAt={o.created_at || ''} updatedAt={o.updated_at} status={o.status} />
                        </td>
                        <td className="py-3 px-2 text-surface-700 dark:text-surface-300">
                          {o.customer_name || '—'}
                        </td>
                        <td className="py-3 px-2">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${channel.color}`}>
                            {channel.icon}
                            {channel.label}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-surface-700 dark:text-surface-300">
                          {Array.isArray(o.items) ? o.items.length : 0}
                        </td>
                        <td className="py-3 px-2 text-surface-700 dark:text-surface-300 font-medium">
                          ${Number(o.total_amount || 0).toFixed(2)}
                        </td>
                        <td className="py-3 px-2">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig[o.status as OrderStatus]?.color}`}>
                            {statusConfig[o.status as OrderStatus]?.icon}
                            {statusConfig[o.status as OrderStatus]?.label}
                          </span>
                        </td>
                        {canUpdateOrders && (
                          <td className="py-3 px-2 text-right" onClick={(e) => e.stopPropagation()}>
                            <select
                              className="input-field inline-block w-32 text-sm"
                              value={o.status}
                              disabled={updatingOrderId === o.id || o.status === 'completed' || o.status === 'cancelled'}
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
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile/Tablet Card View */}
          <div className="lg:hidden space-y-4">
            {isLoading && filteredOrders.length === 0 ? (
              <>
                <OrderCardSkeleton />
                <OrderCardSkeleton />
                <OrderCardSkeleton />
                <OrderCardSkeleton />
              </>
            ) : filteredOrders.length === 0 ? (
              <div className="card text-center py-12">
                <ClipboardList className="w-12 h-12 mx-auto mb-3 text-surface-300 dark:text-surface-600" />
                <p className="text-surface-500 dark:text-surface-400">
                  {emptyStateMessage}
                </p>
              </div>
            ) : (
              filteredOrders.map((o) => {
                const channel = getChannelConfig(o.channel || 'unknown')
                return (
                  <div
                    key={o.id}
                    className="card hover:shadow-lg transition-all cursor-pointer"
                    onClick={() => setSelectedOrder(o)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="font-semibold text-base text-surface-900 dark:text-surface-100 truncate">
                            {o.external_id || o.id.slice(0, 8)}
                          </div>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${channel.color}`}>
                            {channel.icon}
                            {channel.label}
                          </span>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig[o.status as OrderStatus]?.color}`}>
                            {statusConfig[o.status as OrderStatus]?.icon}
                            {statusConfig[o.status as OrderStatus]?.label}
                          </span>
                        </div>
                        {o.created_at && (
                          <div className="text-xs text-surface-500 dark:text-surface-400">
                            {new Date(o.created_at).toLocaleString()}
                          </div>
                        )}
                      </div>
                      <OrderTimer createdAt={o.created_at || ''} updatedAt={o.updated_at} status={o.status} />
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <div className="text-xs text-surface-500 dark:text-surface-400 mb-1">Customer</div>
                        <div className="text-sm font-medium text-surface-900 dark:text-surface-100 truncate">
                          {o.customer_name || '—'}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-surface-500 dark:text-surface-400 mb-1">Items</div>
                        <div className="text-sm font-medium text-surface-900 dark:text-surface-100">
                          {Array.isArray(o.items) ? o.items.length : 0} item{Array.isArray(o.items) && o.items.length !== 1 ? 's' : ''}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-surface-500 dark:text-surface-400 mb-1">Type</div>
                        <div className="text-sm font-medium text-surface-900 dark:text-surface-100 capitalize">
                          {o.order_type || '—'}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-surface-500 dark:text-surface-400 mb-1">Total</div>
                        <div className="text-sm font-semibold text-surface-900 dark:text-surface-100">
                          ${Number(o.total_amount || 0).toFixed(2)}
                        </div>
                      </div>
                    </div>

                    {canUpdateOrders && (
                      <div className="pt-3 border-t border-surface-200 dark:border-surface-700" onClick={(e) => e.stopPropagation()}>
                        <label className="block">
                          <span className="text-xs font-medium text-surface-600 dark:text-surface-400 mb-1 block">
                            Update Status
                          </span>
                          <div className="grid grid-cols-4 gap-2">
                            {(['received', 'preparing', 'ready', 'completed'] as OrderStatus[]).map((status) => (
                              <button
                                key={status}
                                type="button"
                            className={`px-3 py-2 min-h-[44px] min-w-[44px] rounded-lg text-xs font-medium transition-all ${
                              o.status === status
                                ? statusConfig[status].color
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                                }`}
                                onClick={() => updateOrderStatus(o.id, status)}
                                disabled={updatingOrderId === o.id}
                              >
                                {statusConfig[status].label}
                              </button>
                            ))}
                          </div>
                        </label>
                      </div>
                    )}

                    <div className="mt-3 pt-2 border-t border-surface-100 dark:border-surface-700 flex items-center justify-end text-xs text-surface-400">
                      Tap for details
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Results count */}
          {!isLoading && filteredOrders.length > 0 && (
            <div className="text-sm text-surface-500 dark:text-surface-400 text-center">
              Showing {filteredOrders.length} order{filteredOrders.length !== 1 ? 's' : ''}
              {searchQuery && <> matching &quot;<span className="font-medium">{searchQuery}</span>&quot;</>}
            </div>
          )}
        </div>
        </PullToRefresh>
      </DashboardLayout>

      {/* Order Detail Modal */}
      <OrderDetailModal order={selectedOrder} onClose={() => setSelectedOrder(null)} />
    </>
  )
}
