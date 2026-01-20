import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { 
  Building2, 
  ShoppingCart, 
  Users, 
  TrendingUp,
  Activity,
  Clock,
  RefreshCw,
  AlertCircle
} from 'lucide-react'
import AdminLayout from '../../components/Layout/AdminLayout'
import { api } from '../../lib/api'

interface PlatformStats {
  total_restaurants: number
  active_restaurants_7d: number
  total_orders: number
  orders_30d: number
  timeclock_entries_30d: number
  inventory_transactions_30d: number
  audit_events_24h: number
}

interface RecentActivity {
  restaurant_name: string
  restaurant_id: string
  orders_today: number
}

interface PlatformData {
  stats: PlatformStats
  recentActivity: RecentActivity[]
}

export default function AdminDashboard() {
  const [data, setData] = useState<PlatformData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await api.get('/api/admin/platform-stats')
      setData(response.data)
    } catch (err: any) {
      console.error('Failed to fetch platform stats:', err)
      setError(err.response?.data?.message || 'Failed to load platform statistics')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const statsCards = data ? [
    {
      title: 'Total Restaurants',
      value: data.stats.total_restaurants,
      subtitle: `${data.stats.active_restaurants_7d} active this week`,
      icon: Building2,
      color: 'blue'
    },
    {
      title: 'Total Orders',
      value: data.stats.total_orders.toLocaleString(),
      subtitle: `${data.stats.orders_30d} in last 30 days`,
      icon: ShoppingCart,
      color: 'green'
    },
    {
      title: 'Time Clock Entries',
      value: data.stats.timeclock_entries_30d.toLocaleString(),
      subtitle: 'Last 30 days',
      icon: Clock,
      color: 'purple'
    },
    {
      title: 'Recent Activity',
      value: data.stats.audit_events_24h.toLocaleString(),
      subtitle: 'Audit events (24h)',
      icon: Activity,
      color: 'orange'
    }
  ] : []

  return (
    <AdminLayout title="Platform Dashboard" description="Overview of all Servio restaurants and platform metrics">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header with refresh button */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Platform Overview</h1>
            <p className="text-gray-600 dark:text-gray-400">Monitor platform-wide performance and activity</p>
          </div>
          <button
            onClick={fetchData}
            disabled={isLoading}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh Data
          </button>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
            <div className="flex">
              <AlertCircle className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Error loading data</h3>
                <div className="mt-2 text-sm text-red-700 dark:text-red-300">{error}</div>
              </div>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {isLoading ? (
            // Loading skeletons
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 animate-pulse">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
                    <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
                  </div>
                  <div className="h-12 w-12 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                </div>
              </div>
            ))
          ) : (
            statsCards.map((stat, index) => (
              <motion.div
                key={stat.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-md transition-shadow p-6"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{stat.title}</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-500">{stat.subtitle}</p>
                  </div>
                  <div className={`p-3 rounded-lg bg-${stat.color}-50 dark:bg-${stat.color}-900/20`}>
                    <stat.icon className={`h-6 w-6 text-${stat.color}-600 dark:text-${stat.color}-400`} />
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>

        {/* Recent Activity */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">Restaurant Activity Today</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">Orders processed by each restaurant today</p>
          </div>
          
          {isLoading ? (
            <div className="p-6 space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center space-x-4 animate-pulse">
                  <div className="h-10 w-10 bg-gray-200 dark:bg-gray-700 rounded"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
                  </div>
                  <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-12"></div>
                </div>
              ))}
            </div>
          ) : data?.recentActivity.length ? (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {data.recentActivity.slice(0, 10).map((restaurant, index) => (
                <motion.div
                  key={restaurant.restaurant_id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
                        <Building2 className="h-5 w-5 text-red-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {restaurant.restaurant_name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          ID: {restaurant.restaurant_id}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {restaurant.orders_today} orders
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">today</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="px-6 py-8 text-center">
              <TrendingUp className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No activity yet</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Restaurant activity will appear here as orders are processed.
              </p>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}