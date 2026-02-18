import React, { useEffect, useState, useMemo } from 'react'
import Head from 'next/head'
import { motion, AnimatePresence } from 'framer-motion'
import {
  DollarSign,
  ShoppingBag,
  Building2,
  Users,
  TrendingUp,
  Clock,
  AlertCircle,
  RefreshCw,
  BarChart3,
  Phone,
  Globe
} from 'lucide-react'
import AdminLayout from '../../components/Layout/AdminLayout'
import { LiveClock } from '../../components/ui/LiveClock'
import { Skeleton } from '../../components/ui/Skeleton'
import RestaurantSwitcher, { Restaurant } from '../../components/Admin/RestaurantSwitcher'
import { api } from '../../lib/api'

// ============================================================================
// Types
// ============================================================================

interface CompanyData {
  id: string
  name: string
  logo_url?: string
  totalRestaurants: number
  totalRevenueToday: number
  totalRevenueWeek: number
  totalRevenueMonth: number
}

interface RestaurantMetrics {
  id: string
  name: string
  logo_url?: string
  is_active: boolean
  activeOrders: number
  todayRevenue: number
  staffOnDuty: number
}

interface ActivityItem {
  id: string
  type: 'order' | 'staff' | 'alert'
  message: string
  timestamp: string
  restaurant?: string
}

interface AnalyticsData {
  revenueByRestaurant: { name: string; revenue: number }[]
  ordersByChannel: { channel: string; count: number }[]
  hourlyDistribution: { hour: number; orders: number }[]
}


/**
 * API contract: GET /api/company/audit-logs
 * Response: { success: boolean, data: { logs: CompanyAuditLog[] } }
 */
interface CompanyAuditLog {
  id: string
  action: string
  entity_type?: string
  entity_id?: string
  created_at: string
  user?: {
    name?: string
    email?: string
  } | null
}

const mapAuditLogToActivity = (log: CompanyAuditLog): ActivityItem => {
  const lowerAction = (log.action || '').toLowerCase()
  const lowerEntityType = (log.entity_type || '').toLowerCase()
  const isAlert =
    lowerAction.includes('error') ||
    lowerAction.includes('fail') ||
    lowerAction.includes('alert') ||
    lowerEntityType.includes('error')

  let type: ActivityItem['type'] = 'order'
  if (isAlert) {
    type = 'alert'
  } else if (lowerEntityType.includes('staff') || lowerAction.includes('clock') || lowerAction.includes('staff')) {
    type = 'staff'
  }

  const actor = log.user?.name ? `${log.user.name}: ` : ''
  const entity = log.entity_type ? ` (${log.entity_type})` : ''

  return {
    id: log.id,
    type,
    message: `${actor}${log.action}${entity}`,
    timestamp: log.created_at
  }
}

interface SummaryStats {
  totalRevenueToday: number
  totalRevenueWeek: number
  totalRevenueMonth: number
  activeOrders: number
  totalRestaurants: number
  staffOnDuty: number
}

interface DashboardWidgetErrors {
  platformStats: string | null
  restaurants: string | null
  activities: string | null
  analytics: string | null
}

const DEFAULT_WIDGET_ERRORS: DashboardWidgetErrors = {
  platformStats: null,
  restaurants: null,
  activities: null,
  analytics: null
}

const parseApiError = (error: any, fallbackMessage: string) => {
  const responseData = error?.response?.data
  if (typeof responseData?.error === 'string' && responseData.error.trim()) {
    return responseData.error
  }
  if (typeof responseData?.message === 'string' && responseData.message.trim()) {
    return responseData.message
  }
  if (typeof error?.message === 'string' && error.message.trim()) {
    return error.message
  }
  return fallbackMessage
}

// ============================================================================
// Loading Skeleton Components
// ============================================================================

const StatsSkeleton: React.FC = () => (
  <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
    <div className="flex items-center justify-between mb-4">
      <Skeleton variant="circular" width={48} height={48} />
      <Skeleton variant="text" width={80} height={20} />
    </div>
    <Skeleton variant="text" width={100} height={32} className="mb-2" />
    <Skeleton variant="text" width={60} height={16} />
  </div>
)

const PanelSkeleton: React.FC = () => (
  <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
    <div className="flex items-center justify-between mb-4">
      <Skeleton variant="text" width={180} height={24} />
      <Skeleton variant="text" width={70} height={20} />
    </div>
    <div className="space-y-3">
      {[...Array(5)].map((_, index) => (
        <Skeleton key={index} variant="rounded" height={48} />
      ))}
    </div>
  </div>
)

const WidgetErrorBanner: React.FC<{ message: string }> = ({ message }) => (
  <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-300">
    <div className="flex items-start gap-2">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  </div>
)

// ============================================================================
// Summary Stats Card Component
// ============================================================================

interface StatsCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: React.ElementType
  trend?: { value: number; label: string }
  color: 'green' | 'blue' | 'orange' | 'purple'
}

const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  color
}) => {
  const colorClasses = {
    green: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400',
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
    orange: 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400',
    purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400'
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow duration-300"
    >
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
        {trend && (
          <div className="flex items-center gap-1 text-green-600 dark:text-green-400 text-sm font-medium">
            <TrendingUp className="w-4 h-4" />
            <span>+{trend.value}%</span>
            <span className="text-gray-500 dark:text-gray-400">{trend.label}</span>
          </div>
        )}
      </div>
      <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
        {value}
      </div>
      <div className="text-sm text-gray-500 dark:text-gray-400">{title}</div>
      {subtitle && (
        <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">{subtitle}</div>
      )}
    </motion.div>
  )
}

// ============================================================================
// Simple Chart Components (Inline)
// ============================================================================

const RevenueBarChart: React.FC<{ data: { name: string; revenue: number }[] }> = ({ data }) => {
  const maxRevenue = Math.max(...data.map(d => d.revenue), 1)

  return (
    <div className="space-y-3">
      {data.map((item, index) => (
        <div key={item.name} className="flex items-center gap-3">
          <div className="w-24 text-sm text-gray-600 dark:text-gray-400 truncate">
            {item.name}
          </div>
          <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-3">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(item.revenue / maxRevenue) * 100}%` }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="h-full bg-gradient-to-r from-primary-500 to-primary-400 rounded-full"
            />
          </div>
          <div className="w-20 text-right text-sm font-medium text-gray-900 dark:text-white">
            ${item.revenue.toLocaleString()}
          </div>
        </div>
      ))}
    </div>
  )
}

const OrdersPieChart: React.FC<{ data: { channel: string; count: number }[] }> = ({ data }) => {
  const total = data.reduce((sum, d) => sum + d.count, 0)
  const colors = [
    'bg-primary-500',
    'bg-servio-orange-500',
    'bg-servio-green-500',
    'bg-servio-blue-500',
    'bg-servio-purple-500'
  ]

  return (
    <div className="space-y-3">
      {data.map((item, index) => {
        const percentage = total > 0 ? (item.count / total) * 100 : 0
        return (
          <div key={item.channel} className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${colors[index % colors.length]}`} />
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-gray-600 dark:text-gray-400">{item.channel}</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {item.count} ({percentage.toFixed(0)}%)
                </span>
              </div>
              <div className="bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${percentage}%` }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  className={`h-full rounded-full ${colors[index % colors.length]}`}
                />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

const HourlyChart: React.FC<{ data: { hour: number; orders: number }[] }> = ({ data }) => {
  const maxOrders = Math.max(...data.map(d => d.orders), 1)

  return (
    <div className="flex items-end justify-between gap-1 h-32">
      {data.map((item, index) => (
        <div key={item.hour} className="flex-1 flex flex-col items-center gap-1">
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: `${(item.orders / maxOrders) * 100}%` }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
            className="w-full bg-gradient-to-t from-primary-600 to-primary-400 rounded-t"
          />
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {item.hour > 12 ? `${item.hour - 12}p` : item.hour === 0 ? '12a' : `${item.hour}a`}
          </span>
        </div>
      ))}
    </div>
  )
}

// ============================================================================
// Activity Feed Component
// ============================================================================

const ActivityFeed: React.FC<{ activities: ActivityItem[] }> = ({ activities }) => {
  const getIcon = (type: ActivityItem['type']) => {
    switch (type) {
      case 'order':
        return <ShoppingBag className="w-4 h-4 text-primary-500" />
      case 'staff':
        return <Users className="w-4 h-4 text-green-500" />
      case 'alert':
        return <AlertCircle className="w-4 h-4 text-orange-500" />
    }
  }

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)

    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    return date.toLocaleDateString()
  }

  return (
    <div className="space-y-3">
      {activities.map((activity, index) => (
        <motion.div
          key={activity.id}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.05 }}
          className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
        >
          <div className="mt-0.5">{getIcon(activity.type)}</div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-900 dark:text-white">
              {activity.message}
            </p>
            {activity.restaurant && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {activity.restaurant}
              </p>
            )}
          </div>
          <div className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
            {formatTime(activity.timestamp)}
          </div>
        </motion.div>
      ))}
    </div>
  )
}

// ============================================================================
// Header Component
// ============================================================================

interface DashboardHeaderProps {
  company: CompanyData | null
  currentRestaurant: Restaurant | null
  restaurants: Restaurant[]
  onSwitchRestaurant: (id: string) => void
}

const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  company,
  currentRestaurant,
  restaurants,
  onSwitchRestaurant
}) => {
  return (
    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8">
      <div className="flex items-center gap-4">
        {company?.logo_url ? (
          <img
            src={company.logo_url}
            alt={company.name}
            className="w-12 h-12 rounded-xl object-cover"
          />
        ) : (
          <div className="w-12 h-12 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
            <Building2 className="w-6 h-6 text-primary-600 dark:text-primary-400" />
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {company?.name || 'Company Dashboard'}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Multi-restaurant overview
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <RestaurantSwitcher
          currentRestaurant={currentRestaurant || undefined}
          restaurants={restaurants}
          onSwitch={onSwitchRestaurant}
          showAllOption={true}
          allOptionLabel="All Restaurants"
        />
        <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <Clock className="w-4 h-4 text-gray-500" />
          <LiveClock format="full" showIcon={false} className="text-sm" />
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Main Admin Dashboard Page
// ============================================================================

const AdminDashboard: React.FC = () => {
  const [company, setCompany] = useState<CompanyData | null>(null)
  const [restaurants, setRestaurants] = useState<RestaurantMetrics[]>([])
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [widgetErrors, setWidgetErrors] = useState<DashboardWidgetErrors>(DEFAULT_WIDGET_ERRORS)

  const fetchDashboardData = async () => {
    try {
      setLoading(true)

      const [platformStatsResult, restaurantsResult, analyticsResult, activitiesResult] = await Promise.allSettled([
        api.get('/api/admin/platform-stats'),
        api.get('/api/admin/restaurants?limit=12'),
        api.get('/api/admin/analytics?days=30'),
        api.get('/api/admin/recent-activity?limit=20')
      ])

      const nextWidgetErrors: DashboardWidgetErrors = { ...DEFAULT_WIDGET_ERRORS }
      let hasSuccessfulSection = false

      const analyticsPayload = analyticsResult.status === 'fulfilled' ? analyticsResult.value.data : null
      const revenueByRestaurant = analyticsPayload?.revenueByRestaurant || []

      if (platformStatsResult.status === 'fulfilled') {
        hasSuccessfulSection = true
        const platformStatsRes = platformStatsResult.value
        const stats = platformStatsRes.data?.stats || {}

        setCompany({
          id: 'platform',
          name: 'Servio Platform',
          totalRestaurants: Number(stats.total_restaurants || 0),
          totalRevenueToday: Number(stats.revenue_today || 0),
          totalRevenueWeek: Number(stats.revenue_week || 0),
          totalRevenueMonth: Number(stats.revenue_month || 0)
        })
      } else {
        nextWidgetErrors.platformStats = parseApiError(platformStatsResult.reason, 'Platform stats unavailable')
      }

      if (restaurantsResult.status === 'fulfilled') {
        hasSuccessfulSection = true
        const restaurantsData = restaurantsResult.value.data?.restaurants || []

        const revenueByName = new Map(
          (revenueByRestaurant || []).map((entry: any) => [String(entry?.name || ''), Number(entry?.revenue || 0)])
        )

        setRestaurants(restaurantsData.map((restaurant: any) => ({
          id: restaurant.id,
          name: restaurant.name,
          logo_url: restaurant.logo_url,
          is_active: Boolean(restaurant.is_active),
          activeOrders: Number(restaurant.orders_today || 0),
          todayRevenue: revenueByName.get(String(restaurant.name || '')) || 0,
          staffOnDuty: Number(restaurant.user_count || 0)
        })))
      } else {
        nextWidgetErrors.restaurants = parseApiError(restaurantsResult.reason, 'Restaurants unavailable')
      }

      if (analyticsResult.status === 'fulfilled') {
        hasSuccessfulSection = true
        setAnalytics(analyticsResult.value.data || null)
      } else {
        nextWidgetErrors.analytics = parseApiError(analyticsResult.reason, 'Analytics unavailable')
      }

      if (activitiesResult.status === 'fulfilled') {
        hasSuccessfulSection = true
        setActivities((activitiesResult.value.data?.activities || []).map((activity: any) => ({
          id: activity.id,
          type: ['order', 'staff', 'alert'].includes(activity.type) ? activity.type : 'alert',
          message: activity.message,
          timestamp: activity.timestamp,
          restaurant: activity.restaurant || activity.restaurant_name
        })))
      } else if (platformStatsResult.status === 'fulfilled') {
        const recentActivity = platformStatsResult.value.data?.recentActivity || []
        setActivities(recentActivity.map((activity: any) => ({
          id: activity.id,
          type: ['order', 'staff', 'alert'].includes(activity.type) ? activity.type : 'alert',
          message: activity.message,
          timestamp: activity.timestamp,
          restaurant: activity.restaurant || activity.restaurant_name
        })))
      } else {
        nextWidgetErrors.activities = parseApiError(activitiesResult.reason, 'Recent activity unavailable')
      }

      setWidgetErrors(nextWidgetErrors)

      if (hasSuccessfulSection) {
        setError(null)
      } else {
        setError('Failed to load dashboard data')
      }
    } catch (err: any) {
      console.error('Failed to fetch dashboard data:', err)
      setError(parseApiError(err, 'Failed to load dashboard data'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboardData()
    
    // Auto-refresh every 60 seconds
    const interval = setInterval(fetchDashboardData, 60000)
    return () => clearInterval(interval)
  }, [])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchDashboardData()
    setRefreshing(false)
  }

  const currentRestaurant = useMemo(() => {
    if (!company || restaurants.length === 0) return null
    return {
      id: company.id,
      name: company.name,
      slug: company.name.toLowerCase().replace(/\s+/g, '-'),
      logo_url: company.logo_url
    }
  }, [company, restaurants])

  const summaryStats: SummaryStats = useMemo(() => ({
    totalRevenueToday: company?.totalRevenueToday || restaurants.reduce((sum, r) => sum + r.todayRevenue, 0),
    totalRevenueWeek: company?.totalRevenueWeek || 0,
    totalRevenueMonth: company?.totalRevenueMonth || 0,
    activeOrders: restaurants.reduce((sum, r) => sum + r.activeOrders, 0),
    totalRestaurants: restaurants.length,
    staffOnDuty: restaurants.reduce((sum, r) => sum + r.staffOnDuty, 0)
  }), [company, restaurants])

  const peakHour = useMemo(() => {
    const hourlyDistribution = analytics?.hourlyDistribution || []
    if (hourlyDistribution.length === 0) return null
    return hourlyDistribution.reduce((highest, current) => (
      current.orders > highest.orders ? current : highest
    ), hourlyDistribution[0])
  }, [analytics])

  const topChannel = useMemo(() => {
    const ordersByChannel = analytics?.ordersByChannel || []
    if (ordersByChannel.length === 0) return null
    return ordersByChannel.reduce((highest, current) => (
      current.count > highest.count ? current : highest
    ), ordersByChannel[0])
  }, [analytics])

  if (error && !company && restaurants.length === 0 && activities.length === 0 && !analytics) {
    return (
      <AdminLayout title="Admin Dashboard">
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Failed to Load Dashboard
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mb-4">{error}</p>
          <button
            onClick={fetchDashboardData}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </AdminLayout>
    )
  }

  return (
    <>
      <Head>
        <title>Admin Dashboard | Servio Platform</title>
        <meta name="description" content="Multi-restaurant company dashboard for Servio" />
      </Head>

      <AdminLayout title="Admin Dashboard">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <DashboardHeader
            company={company}
            currentRestaurant={currentRestaurant}
            restaurants={restaurants.map(r => ({
              id: r.id,
              name: r.name,
              logo_url: r.logo_url,
              slug: r.name.toLowerCase().replace(/\s+/g, '-'),
              is_active: r.is_active,
              metrics: {
                activeOrders: r.activeOrders,
                todayRevenue: r.todayRevenue,
                staffOnDuty: r.staffOnDuty
              }
            }))}
            onSwitchRestaurant={() => {}}
          />

          {/* Refresh Button */}
          <div className="flex justify-end mb-4">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>

          {loading ? (
            <div className="space-y-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[...Array(4)].map((_, i) => <StatsSkeleton key={i} />)}
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {[...Array(2)].map((_, i) => <PanelSkeleton key={i} />)}
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Summary Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {widgetErrors.restaurants && (
                  <div className="sm:col-span-2 lg:col-span-4">
                    <WidgetErrorBanner message={widgetErrors.restaurants} />
                  </div>
                )}
                {widgetErrors.platformStats && (
                  <div className="sm:col-span-2 lg:col-span-4">
                    <WidgetErrorBanner message={widgetErrors.platformStats} />
                  </div>
                )}
                <StatsCard
                  title="Today's Revenue"
                  value={`$${summaryStats.totalRevenueToday.toLocaleString()}`}
                  subtitle="vs yesterday"
                  icon={DollarSign}
                  trend={{ value: 12, label: 'vs yesterday' }}
                  color="green"
                />
                <StatsCard
                  title="Active Orders"
                  value={summaryStats.activeOrders}
                  subtitle="Across all locations"
                  icon={ShoppingBag}
                  color="blue"
                />
                <StatsCard
                  title="Total Restaurants"
                  value={summaryStats.totalRestaurants}
                  subtitle={`${restaurants.filter(r => r.is_active).length} active`}
                  icon={Building2}
                  color="orange"
                />
                <StatsCard
                  title="Staff On Duty"
                  value={summaryStats.staffOnDuty}
                  subtitle="Across all locations"
                  icon={Users}
                  color="purple"
                />
              </div>

              {/* Main Content Grid */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="space-y-6">
                  {widgetErrors.activities && <WidgetErrorBanner message={widgetErrors.activities} />}
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                      Recent Activity
                    </h2>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 max-h-[36rem] overflow-y-auto">
                    <ActivityFeed activities={activities} />
                  </div>
                </div>

                <div className="space-y-6">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Operational Snapshot
                  </h2>
                  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 p-4">
                        <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Active Restaurants</p>
                        <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
                          {restaurants.filter(r => r.is_active).length}
                        </p>
                      </div>
                      <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 p-4">
                        <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Top Channel</p>
                        <p className="mt-2 text-xl font-semibold text-gray-900 dark:text-white">
                          {topChannel ? `${topChannel.channel} (${topChannel.count})` : 'No channel data'}
                        </p>
                      </div>
                    </div>

                    <div>
                      <div className="mb-3 flex items-center justify-between">
                        <h3 className="font-semibold text-gray-900 dark:text-white">Hourly Order Trend</h3>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {peakHour ? `Peak: ${peakHour.hour}:00 (${peakHour.orders} orders)` : 'No hourly data'}
                        </span>
                      </div>
                      {analytics?.hourlyDistribution?.length ? (
                        <HourlyChart data={analytics.hourlyDistribution} />
                      ) : (
                        <p className="text-sm text-gray-500 dark:text-gray-400">No hourly activity available.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Analytics Section */}
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Cross-Restaurant Analytics
                </h2>
                {widgetErrors.analytics && <WidgetErrorBanner message={widgetErrors.analytics} />}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Revenue by Restaurant */}
                  <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2 mb-4">
                      <BarChart3 className="w-5 h-5 text-primary-500" />
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        Revenue by Restaurant
                      </h3>
                    </div>
                    {widgetErrors.analytics ? (
                      <p className="text-red-600 dark:text-red-400">Analytics unavailable</p>
                    ) : analytics?.revenueByRestaurant ? (
                      <RevenueBarChart data={analytics.revenueByRestaurant} />
                    ) : (
                      <p className="text-gray-500 dark:text-gray-400">No data available</p>
                    )}
                  </div>

                  {/* Orders by Channel */}
                  <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2 mb-4">
                      <Globe className="w-5 h-5 text-primary-500" />
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        Orders by Channel
                      </h3>
                    </div>
                    {widgetErrors.analytics ? (
                      <p className="text-red-600 dark:text-red-400">Analytics unavailable</p>
                    ) : analytics?.ordersByChannel ? (
                      <OrdersPieChart data={analytics.ordersByChannel} />
                    ) : (
                      <p className="text-gray-500 dark:text-gray-400">No data available</p>
                    )}
                  </div>

                  {/* Hourly Distribution */}
                  <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2 mb-4">
                      <Clock className="w-5 h-5 text-primary-500" />
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        Hourly Distribution
                      </h3>
                    </div>
                    {widgetErrors.analytics ? (
                      <p className="text-red-600 dark:text-red-400">Analytics unavailable</p>
                    ) : analytics?.hourlyDistribution ? (
                      <HourlyChart data={analytics.hourlyDistribution} />
                    ) : (
                      <p className="text-gray-500 dark:text-gray-400">No data available</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </AdminLayout>
    </>
  )
}

export default AdminDashboard
