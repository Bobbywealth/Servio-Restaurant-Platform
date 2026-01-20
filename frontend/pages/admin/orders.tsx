import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ShoppingCart, Filter, Search, AlertCircle, Building2 } from 'lucide-react'
import AdminLayout from '../../components/Layout/AdminLayout'
import { api } from '../../lib/api'
import { getErrorMessage } from '../../lib/utils'
import Link from 'next/link'

interface Order {
  id: string
  restaurant_id: string
  restaurant_name?: string
  customer_name?: string
  status: string
  source: string
  total_amount: number
  items: any
  created_at: string
}

export default function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([])
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [sourceFilter, setSourceFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchOrders = async () => {
    setIsLoading(true)
    setError(null)
    try {
      let url = '/api/admin/orders?limit=100'
      if (statusFilter !== 'all') url += `&status=${statusFilter}`
      if (sourceFilter !== 'all') url += `&source=${sourceFilter}`
      
      const response = await api.get(url)
      setOrders(response.data.orders || [])
    } catch (err: any) {
      console.error('Failed to fetch orders:', err)
      setError(getErrorMessage(err, 'Failed to load orders'))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchOrders()
  }, [statusFilter, sourceFilter])

  const filteredOrders = orders.filter(o => 
    search === '' || 
    o.id.toLowerCase().includes(search.toLowerCase()) ||
    o.restaurant_name?.toLowerCase().includes(search.toLowerCase()) ||
    o.customer_name?.toLowerCase().includes(search.toLowerCase())
  )

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300'
      case 'cancelled':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300'
    }
  }

  const getSourceColor = (source: string) => {
    switch (source) {
      case 'vapi':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300'
      case 'web':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300'
    }
  }

  return (
    <AdminLayout title="Orders" description="Global order management across all restaurants">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Global Orders</h1>
          <p className="text-gray-600 dark:text-gray-400">View and monitor orders across all restaurants</p>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by order ID, restaurant, or customer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="accepted">Accepted</option>
              <option value="preparing">Preparing</option>
              <option value="ready">Ready</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="all">All Sources</option>
              <option value="web">Web</option>
              <option value="vapi">Voice (VAPI)</option>
              <option value="phone">Phone</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
            <div className="flex">
              <AlertCircle className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Error</h3>
                <div className="mt-2 text-sm text-red-700 dark:text-red-300">{error}</div>
              </div>
            </div>
          </div>
        )}

        {/* Orders List */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-2"></div>
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          ) : filteredOrders.length ? (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredOrders.map((order, index) => {
                const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items || []
                return (
                  <motion.div
                    key={order.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Order #{order.id.slice(-8)}</h3>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(order.status)}`}>
                            {order.status}
                          </span>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getSourceColor(order.source)}`}>
                            {order.source}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mb-2">
                          <Link href={`/admin/restaurants/${order.restaurant_id}`} className="flex items-center gap-1 hover:text-red-600">
                            <Building2 className="h-4 w-4" />
                            {order.restaurant_name || order.restaurant_id}
                          </Link>
                          {order.customer_name && <span>• {order.customer_name}</span>}
                        </div>
                        {items.length > 0 && (
                          <div className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                            {items.slice(0, 3).map((item: any, i: number) => (
                              <span key={i}>
                                {item.quantity}x {item.name}
                                {i < Math.min(items.length, 3) - 1 && ', '}
                              </span>
                            ))}
                            {items.length > 3 && ` +${items.length - 3} more`}
                          </div>
                        )}
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(order.created_at).toLocaleString()}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-semibold text-gray-900 dark:text-white">
                          ${Number(order.total_amount).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          ) : (
            <div className="p-12 text-center">
              <ShoppingCart className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No orders found</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {search ? 'Try adjusting your search or filters' : 'No orders match the selected filters'}
              </p>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}
