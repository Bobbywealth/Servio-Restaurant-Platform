import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { 
  Building2, 
  ShoppingCart, 
  Phone,
  Megaphone,
  Activity,
  AlertTriangle,
  RefreshCw,
  AlertCircle,
  Clock
} from 'lucide-react'
import AdminLayout from '../../components/Layout/AdminLayout'
import { api } from '../../lib/api'

interface AdminStats {
  activeRestaurants: number
  ordersToday: number
  voiceCallsToday: number
  pendingCampaignApprovals: number
  openShifts: number
  failedJobs: number
}

interface ActivityItem {
  id: string
  restaurant_id: string
  restaurant_name?: string
  action: string
  entity_type?: string
  entity_id?: string
  user_name?: string
  user_role?: string
  created_at: string
  source: string
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [pendingCampaigns, setPendingCampaigns] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAdminStats = async () => {
    try {
      const response = await api.get('/api/admin/stats/summary')
      setStats(response.data)
    } catch (err: any) {
      console.error('Failed to fetch admin stats:', err)
      throw err
    }
  }

  const fetchActivity = async () => {
    try {
      const response = await api.get('/api/admin/activity?limit=25')
      setActivity(response.data)
    } catch (err: any) {
      console.error('Failed to fetch activity:', err)
      throw err
    }
  }

  const fetchPendingCampaigns = async () => {
    try {
      const response = await api.get('/api/admin/campaigns?status=pending_owner_approval&limit=10')
      setPendingCampaigns(response.data.campaigns || [])
    } catch (err: any) {
      console.error('Failed to fetch campaigns:', err)
      // Don't throw, campaigns are optional
    }
  }

  const fetchData = async () => {
    setIsLoading(true)
    setError(null)
    try {
      await Promise.all([
        fetchAdminStats(),
        fetchActivity(),
        fetchPendingCampaigns()
      ])
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load dashboard data')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const statsCards = stats ? [
    {
      title: 'Active Restaurants',
      value: stats.activeRestaurants,
      subtitle: 'Currently active',
      icon: Building2,
      color: 'blue'
    },
    {
      title: 'Orders Today',
      value: stats.ordersToday.toLocaleString(),
      subtitle: 'Across all restaurants',
      icon: ShoppingCart,
      color: 'green'
    },
    {
      title: 'Voice Calls Today',
      value: stats.voiceCallsToday.toLocaleString(),
      subtitle: 'VAPI interactions',
      icon: Phone,
      color: 'purple'
    },
    {
      title: 'Pending Approvals',
      value: stats.pendingCampaignApprovals,
      subtitle: 'Campaigns awaiting approval',
      icon: Megaphone,
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

        {/* System Warnings */}
        {stats && (stats.failedJobs > 0 || stats.openShifts > 0) && (
          <div className="mb-8 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <div className="flex items-start">
              <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
              <div className="ml-3 flex-1">
                <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">System Warnings</h3>
                <div className="mt-2 text-sm text-yellow-700 dark:text-yellow-300">
                  {stats.failedJobs > 0 && (
                    <p>• {stats.failedJobs} failed job{stats.failedJobs !== 1 ? 's' : ''} detected</p>
                  )}
                  {stats.openShifts > 0 && (
                    <p>• {stats.openShifts} open shift{stats.openShifts !== 1 ? 's' : ''} (no clock out)</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Pending Campaigns */}
        {pendingCampaigns.length > 0 && (
          <div className="mb-8 bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-medium text-gray-900 dark:text-white">Campaigns Pending Approval</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">Campaigns awaiting owner approval</p>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {pendingCampaigns.map((campaign, index) => (
                <motion.div
                  key={campaign.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{campaign.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {campaign.restaurant_name} • {campaign.type}
                      </p>
                    </div>
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300">
                      {campaign.status}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Global Activity Feed */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">Global Activity Feed</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">Recent platform activity across all restaurants</p>
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
                </div>
              ))}
            </div>
          ) : activity.length ? (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {activity.map((item, index) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex items-start space-x-4">
                    <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0">
                      <Activity className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {item.action}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {item.restaurant_name && `${item.restaurant_name} • `}
                        {item.user_name && `${item.user_name} (${item.user_role}) • `}
                        {new Date(item.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="px-6 py-8 text-center">
              <Activity className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No activity yet</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Platform activity will appear here as events occur.
              </p>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}