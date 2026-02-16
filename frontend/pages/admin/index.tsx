import React, { useEffect, useState, useMemo } from 'react'
import Head from 'next/head'
import { motion, AnimatePresence } from 'framer-motion'
import {
  DollarSign,
  ShoppingBag,
  Building2,
  Users,
  Plus,
  TrendingUp,
  Clock,
  AlertCircle,
  ChevronRight,
  RefreshCw,
  BarChart3,
  Phone,
  Globe,
  Utensils
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

interface SummaryStats {
  totalRevenueToday: number
  totalRevenueWeek: number
  totalRevenueMonth: number
  activeOrders: number
  totalRestaurants: number
  staffOnDuty: number
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

const RestaurantCardSkeleton: React.FC = () => (
  <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
    <div className="flex items-center gap-4 mb-4">
      <Skeleton variant="circular" width={56} height={56} />
      <div className="flex-1">
        <Skeleton variant="text" width={120} height={20} className="mb-2" />
        <Skeleton variant="text" width={80} height={14} />
      </div>
    </div>
    <div className="grid grid-cols-2 gap-4">
      <Skeleton variant="rounded" height={60} />
      <Skeleton variant="rounded" height={60} />
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
// Restaurant Card Component
// ============================================================================

interface RestaurantCardProps {
  restaurant: RestaurantMetrics
  onView: (id: string) => void
  onManage: (id: string) => void
}

const RestaurantCard: React.FC<RestaurantCardProps> = ({
  restaurant,
  onView,
  onManage
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ y: -4 }}
      className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 hover:shadow-xl transition-all duration-300"
    >
      <div className="flex items-center gap-4 mb-4">
        <div className="relative">
          {restaurant.logo_url ? (
            <img
              src={restaurant.logo_url}
              alt={restaurant.name}
              className="w-14 h-14 rounded-xl object-cover"
            />
          ) : (
            <div className="w-14 h-14 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
              <Utensils className="w-7 h-7 text-primary-600 dark:text-primary-400" />
            </div>
          )}
          <span
            className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white dark:border-gray-800 ${
              restaurant.is_active ? 'bg-green-500' : 'bg-gray-400'
            }`}
          />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 dark:text-white truncate">
            {restaurant.name}
          </h3>
          <div className="flex items-center gap-2 mt-1">
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                restaurant.is_active
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
              }`}
            >
              {restaurant.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
            <ShoppingBag className="w-4 h-4" />
            <span className="text-xs">Active Orders</span>
          </div>
          <div className="text-xl font-bold text-gray-900 dark:text-white">
            {restaurant.activeOrders}
          </div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
            <DollarSign className="w-4 h-4" />
            <span className="text-xs">Today's Revenue</span>
          </div>
          <div className="text-xl font-bold text-gray-900 dark:text-white">
            ${restaurant.todayRevenue.toLocaleString()}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <Users className="w-4 h-4" />
          <span>{restaurant.staffOnDuty} staff on duty</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onView(restaurant.id)}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-gray-400 transition-colors"
            title="View Details"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </motion.div>
  )
}

// ============================================================================
// Add Restaurant Card Component
// ============================================================================

const AddRestaurantCard: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <motion.button
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    whileHover={{ y: -4 }}
    onClick={onClick}
    className="bg-white dark:bg-gray-800 rounded-xl p-6 border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-primary-500 dark:hover:border-primary-400 hover:shadow-xl transition-all duration-300 group text-center"
  >
    <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-gray-100 dark:bg-gray-700 group-hover:bg-primary-100 dark:group-hover:bg-primary-900/30 flex items-center justify-center transition-colors">
      <Plus className="w-7 h-7 text-gray-400 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors" />
    </div>
    <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
      Add New Restaurant
    </h3>
    <p className="text-sm text-gray-500 dark:text-gray-400">
      Expand your restaurant network
    </p>
  </motion.button>
)

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

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      setError(null)

      const [companyRes, restaurantsRes, analyticsRes, activitiesRes] = await Promise.all([
        api.get('/api/company'),
        api.get('/api/company/restaurants'),
        api.get('/api/company/analytics'),
        api.get('/api/company/activities')
      ])

      setCompany(companyRes.data?.data || companyRes.data)
      setRestaurants(restaurantsRes.data?.data || restaurantsRes.data || [])
      setAnalytics(analyticsRes.data?.data || analyticsRes.data)
      setActivities(activitiesRes.data?.data || activitiesRes.data || [])
    } catch (err: any) {
      console.error('Failed to fetch dashboard data:', err)
      setError(err.response?.data?.message || 'Failed to load dashboard data')
      
      // Set mock data for development/demo
      setMockData()
    } finally {
      setLoading(false)
    }
  }

  const setMockData = () => {
    setCompany({
      id: '1',
      name: 'Servio Restaurant Group',
      logo_url: undefined,
      totalRestaurants: 5,
      totalRevenueToday: 12500,
      totalRevenueWeek: 87500,
      totalRevenueMonth: 350000
    })
    setRestaurants([
      { id: '1', name: 'Downtown Bistro', logo_url: undefined, is_active: true, activeOrders: 12, todayRevenue: 4200, staffOnDuty: 8 },
      { id: '2', name: 'Harbor View', logo_url: undefined, is_active: true, activeOrders: 8, todayRevenue: 3100, staffOnDuty: 6 },
      { id: '3', name: 'Garden Terrace', logo_url: undefined, is_active: true, activeOrders: 15, todayRevenue: 3800, staffOnDuty: 10 },
      { id: '4', name: 'City Center Express', logo_url: undefined, is_active: false, activeOrders: 0, todayRevenue: 1400, staffOnDuty: 4 }
    ])
    setActivities([
      { id: '1', type: 'order', message: 'New order #1234 received', timestamp: new Date().toISOString(), restaurant: 'Downtown Bistro' },
      { id: '2', type: 'staff', message: 'Sarah J. clocked in', timestamp: new Date(Date.now() - 300000).toISOString(), restaurant: 'Harbor View' },
      { id: '3', type: 'alert', message: 'Low inventory alert: Chicken breast', timestamp: new Date(Date.now() - 600000).toISOString(), restaurant: 'Garden Terrace' },
      { id: '4', type: 'order', message: 'Order #1233 completed', timestamp: new Date(Date.now() - 900000).toISOString(), restaurant: 'City Center Express' }
    ])
    setAnalytics({
      revenueByRestaurant: [
        { name: 'Downtown Bistro', revenue: 15420 },
        { name: 'Harbor View', revenue: 12350 },
        { name: 'Garden Terrace', revenue: 11200 },
        { name: 'City Center Express', revenue: 8500 }
      ],
      ordersByChannel: [
        { channel: 'In-Store', count: 145 },
        { channel: 'Online', count: 89 },
        { channel: 'Phone', count: 34 },
        { channel: 'Third-Party', count: 67 }
      ],
      hourlyDistribution: [
        { hour: 8, orders: 12 }, { hour: 9, orders: 18 }, { hour: 10, orders: 15 },
        { hour: 11, orders: 28 }, { hour: 12, orders: 45 }, { hour: 13, orders: 38 },
        { hour: 14, orders: 22 }, { hour: 15, orders: 18 }, { hour: 16, orders: 25 },
        { hour: 17, orders: 35 }, { hour: 18, orders: 48 }, { hour: 19, orders: 52 },
        { hour: 20, orders: 42 }, { hour: 21, orders: 28 }, { hour: 22, orders: 15 }
      ]
    })
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

  const handleViewRestaurant = (id: string) => {
    console.log('View restaurant:', id)
    // Navigate to restaurant details
  }

  const handleManageRestaurant = (id: string) => {
    console.log('Manage restaurant:', id)
    // Navigate to restaurant management
  }

  const handleAddRestaurant = () => {
    console.log('Add new restaurant')
    // Open add restaurant modal or navigate
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

  if (error && !company) {
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
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => <RestaurantCardSkeleton key={i} />)}
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Summary Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
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
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Restaurant Grid */}
                <div className="xl:col-span-2 space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                      Restaurants
                    </h2>
                    <button
                      onClick={handleAddRestaurant}
                      className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium"
                    >
                      View All
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {restaurants.map((restaurant) => (
                      <RestaurantCard
                        key={restaurant.id}
                        restaurant={restaurant}
                        onView={handleViewRestaurant}
                        onManage={handleManageRestaurant}
                      />
                    ))}
                    <AddRestaurantCard onClick={handleAddRestaurant} />
                  </div>
                </div>

                {/* Recent Activity Feed */}
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                      Recent Activity
                    </h2>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                    <ActivityFeed activities={activities} />
                  </div>
                </div>
              </div>

              {/* Analytics Section */}
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Cross-Restaurant Analytics
                </h2>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Revenue by Restaurant */}
                  <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2 mb-4">
                      <BarChart3 className="w-5 h-5 text-primary-500" />
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        Revenue by Restaurant
                      </h3>
                    </div>
                    {analytics?.revenueByRestaurant ? (
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
                    {analytics?.ordersByChannel ? (
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
                    {analytics?.hourlyDistribution ? (
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
