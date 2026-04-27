import React, { memo, useMemo, useEffect, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { motion } from 'framer-motion'
import { useUser } from '../../contexts/UserContext'
import { api } from '../../lib/api'
import { useSocket } from '../../lib/socket'
import { ShoppingCart, Package, TrendingUp, Sparkles, ArrowRight, Activity, Clock, Star, Home, UtensilsCrossed, Users, CheckCircle, FileText, Settings, Wifi, Menu, X, ChevronRight, Utensils, Phone, ShoppingBag } from 'lucide-react'
import toast from 'react-hot-toast'

import DashboardLayout from '../../components/Layout/DashboardLayout'
import LiveClock from '../../components/ui/LiveClock'
import BusinessDatePicker from '../../components/ui/BusinessDatePicker'
import { getDateStringInTimezone, isDateInBusinessDay, isValidDateString } from '../../utils/businessDate'

// PREMIUM STAT CARD WITH GLASSMORPHISM
const StatCard = memo(({ stat, index }: { stat: any; index: number }) => (
  <motion.div
    className="stat-card group"
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: 0.1 * (index + 1), duration: 0.5 }}
    whileHover={{ y: -6, scale: 1.02 }}
  >
    {/* Premium gradient glow on hover */}
    <div className={`absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl bg-gradient-to-r ${stat.glowColor}`} />

    <div className="relative flex items-start justify-between">
      <div>
        <p className="text-sm font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider mb-2">
          {stat.name}
        </p>
        <motion.p
          className="text-4xl font-black text-surface-900 dark:text-white tracking-tight"
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2 * (index + 1), type: "spring", bounce: 0.4 }}
        >
          {stat.value}
        </motion.p>
      </div>
      <motion.div
        className={`p-4 rounded-2xl shadow-lg ${stat.color}`}
        whileHover={{ scale: 1.1, rotate: 5 }}
        transition={{ type: "spring", stiffness: 400, damping: 10 }}
      >
        <stat.icon className="h-7 w-7 text-white" />
      </motion.div>
    </div>

    <div className="mt-4 pt-4 border-t border-surface-200/50 dark:border-surface-700/50">
      <span className="text-sm font-medium text-surface-600 dark:text-surface-400 flex items-center gap-1">
        {stat.change.startsWith('+') && (
          <TrendingUp className="w-4 h-4 text-servio-green-500" />
        )}
        {stat.change}
      </span>
    </div>
  </motion.div>
))

StatCard.displayName = 'StatCard'

// PREMIUM SKELETON LOADER
const SkeletonCard = memo(({ index = 0 }: { index?: number }) => (
  <motion.div
    className="stat-card relative overflow-hidden"
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: index * 0.1, duration: 0.5 }}
  >
    {/* Shimmer effect */}
    <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/20 to-transparent" />

    <div className="flex items-start justify-between mb-4">
      <div className="space-y-3">
        <div className="h-4 w-24 rounded-lg skeleton" />
        <div className="h-10 w-20 rounded-lg skeleton" />
      </div>
      <div className="h-14 w-14 rounded-2xl skeleton" />
    </div>
    <div className="pt-4 border-t border-surface-200/30 dark:border-surface-700/30">
      <div className="h-6 w-32 rounded-full skeleton" />
    </div>
  </motion.div>
))

SkeletonCard.displayName = 'SkeletonCard'

const DashboardIndex = memo(() => {
  const { user, isManagerOrOwner } = useUser()
  const router = useRouter()
  const socket = useSocket()
  const [activeOrders, setActiveOrders] = useState(0)
  const [totalOrders, setTotalOrders] = useState(0)
  const [recentOrders, setRecentOrders] = useState<any[]>([])
  const [todaySales, setTodaySales] = useState(0)
  const [pendingOrders, setPendingOrders] = useState(0)
  const [todayOrderCount, setTodayOrderCount] = useState(0)
  const [isFetching, setIsFetching] = useState(true)
  const [fetchError, setFetchError] = useState(false)
  const [restaurantTimezone, setRestaurantTimezone] = useState('America/New_York')
  const [isOpen, setIsOpen] = useState(true)
  const [restaurantName, setRestaurantName] = useState<string>('')
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null)
  const [selectedDate, setSelectedDate] = useState<string>(() => getDateStringInTimezone('America/New_York'))

  const todayInRestaurantTimezone = useMemo(
    () => getDateStringInTimezone(restaurantTimezone),
    [restaurantTimezone],
  )
  const isViewingToday = selectedDate === todayInRestaurantTimezone

  const getCurrentDayKey = (timezone: string) => {
    const dayName = new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      timeZone: timezone,
    }).format(new Date())
    return dayName.toLowerCase()
  }

  const getMinutesInTimezone = (timezone: string) => {
    const parts = new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: timezone,
    }).formatToParts(new Date())

    const hour = Number(parts.find((part) => part.type === 'hour')?.value || 0)
    const minute = Number(parts.find((part) => part.type === 'minute')?.value || 0)
    return hour * 60 + minute
  }

  const calculateRestaurantOpenState = (
    timezone: string,
    hoursMap: Record<string, { open: string; close: string; closed: boolean }>,
  ) => {
    const dayKey = getCurrentDayKey(timezone)
    const todayHours = hoursMap[dayKey]

    if (!todayHours || todayHours.closed) {
      return false
    }

    const [openHour = '9', openMinute = '0'] = (todayHours.open || '09:00').split(':')
    const [closeHour = '22', closeMinute = '0'] = (todayHours.close || '22:00').split(':')
    const openMinutes = Number(openHour) * 60 + Number(openMinute)
    const closeMinutes = Number(closeHour) * 60 + Number(closeMinute)
    const nowMinutes = getMinutesInTimezone(timezone)

    if (closeMinutes <= openMinutes) {
      return nowMinutes >= openMinutes || nowMinutes < closeMinutes
    }

    return nowMinutes >= openMinutes && nowMinutes < closeMinutes
  }

  const fetchStats = async (dateToFetch: string) => {
    setIsFetching(true)
    try {
      setFetchError(false)
      const [ordersRes, profileRes] = await Promise.all([
        // Get recent orders (all orders, let frontend sort by status)
        api.get('/api/orders', { params: { limit: 200, date: dateToFetch } }),
        api.get('/api/restaurant/profile'),
      ])

      const timezone = profileRes.data?.data?.timezone || restaurantTimezone || 'America/New_York'
      const ordersForDate = (ordersRes.data.data.orders || []).filter((order: any) =>
        isDateInBusinessDay(order.created_at, dateToFetch, timezone),
      )

      // Sort orders: active first (received, preparing, ready), then completed
      const orders = ordersForDate.sort((a: any, b: any) => {
        const activeStatuses = ['received', 'preparing', 'ready'];
        const aActive = activeStatuses.includes(a.status);
        const bActive = activeStatuses.includes(b.status);
        if (aActive && !bActive) return -1;
        if (!aActive && bActive) return 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      const activeStatuses = ['received', 'preparing', 'ready']
      const activeOrdersCount = ordersForDate.filter((order: any) => activeStatuses.includes(order.status)).length
      const pendingOrdersCount = ordersForDate.filter((order: any) => ['received', 'preparing'].includes(order.status)).length
      const salesForDate = ordersForDate
        .filter((order: any) => !['cancelled', 'refunded'].includes(order.status))
        .reduce((sum: number, order: any) => sum + Number(order.total_amount || 0), 0)

      setRecentOrders(orders.slice(0, 10))
      setActiveOrders(activeOrdersCount)
      setTotalOrders(ordersForDate.length)
      setTodaySales(salesForDate)
      setPendingOrders(pendingOrdersCount)
      setTodayOrderCount(ordersForDate.length)

      // Set restaurant name and timezone from profile
      const profileData = profileRes.data?.data
      if (profileData) {
        setRestaurantName(profileData.name || '')
        const timezone = profileData.timezone || 'America/New_York'
        const normalizedHours = profileData.operating_hours || {}
        setRestaurantTimezone(timezone)
        setIsOpen(calculateRestaurantOpenState(timezone, normalizedHours))
      }
      setLastUpdatedAt(new Date())
    } catch (err) {
      console.error('Failed to fetch dashboard stats', err)
      setFetchError(true)
    } finally {
      setIsFetching(false)
    }
  }

  // Helper function to get channel icon
  const getChannelIcon = (channel?: string) => {
    if (!channel) return <Utensils className="w-3.5 h-3.5" />
    
    const channelLower = channel.toLowerCase()
    if (channelLower.includes('door') || channelLower.includes('dd')) return <ShoppingBag className="w-3.5 h-3.5" />
    if (channelLower.includes('uber') || channelLower.includes('eat')) return <ShoppingBag className="w-3.5 h-3.5" />
    if (channelLower.includes('phone')) return <Phone className="w-3.5 h-3.5" />
    if (channelLower.includes('dine')) return <Utensils className="w-3.5 h-3.5" />
    return <Utensils className="w-3.5 h-3.5" />
  }

  // Helper function to get channel label
  const getChannelLabel = (channel?: string) => {
    if (!channel) return 'In-house'
    
    const channelLower = channel.toLowerCase()
    if (channelLower.includes('door') || channelLower.includes('dd')) return 'DoorDash'
    if (channelLower.includes('uber') || channelLower.includes('eat')) return 'Uber Eats'
    if (channelLower.includes('phone')) return 'Phone'
    if (channelLower.includes('dine')) return 'Dine-in'
    return 'In-house'
  }

  useEffect(() => {
    if (!router.isReady) return

    const queryDate = Array.isArray(router.query.date) ? router.query.date[0] : router.query.date
    const localStorageDate = typeof window !== 'undefined' ? window.localStorage.getItem('servio:businessDate') : null
    const initialDate = [queryDate, localStorageDate].find((value): value is string => Boolean(value && isValidDateString(value)))

    if (initialDate) {
      setSelectedDate(initialDate)
      return
    }

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
    if (!isValidDateString(selectedDate)) return

    fetchStats(selectedDate)

    const interval = setInterval(() => {
      fetchStats(selectedDate)
    }, 60000)

    if (socket) {
      socket.on('order:new', (order) => {
        toast.success(`New order received! Total: $${order.totalAmount}`)
        fetchStats(selectedDate)
      })
    }

    return () => {
      clearInterval(interval)
      if (socket) socket.off('order:new')
    }
  }, [socket, selectedDate])

  // STATS DATA WITH PREMIUM STYLING
  const stats = useMemo(() => [
    {
      name: 'New Orders',
      value: pendingOrders.toString(),
      change: pendingOrders > 0 ? `${pendingOrders} waiting` : 'All clear',
      icon: Clock,
      color: 'bg-gradient-to-br from-blue-500 to-indigo-600',
      glowColor: 'from-blue-500/40 to-indigo-600/40'
    },
    {
      name: 'Orders Today',
      value: todayOrderCount.toString(),
      change: `$${todaySales.toFixed(2)} revenue`,
      icon: Package,
      color: 'bg-gradient-to-br from-violet-500 to-purple-600',
      glowColor: 'from-violet-500/40 to-purple-600/40'
    },
    {
      name: 'In Kitchen',
      value: activeOrders.toString(),
      change: activeOrders > 0 ? 'In progress' : 'No active',
      icon: Activity,
      color: activeOrders > 5 ? 'bg-gradient-to-br from-red-500 to-orange-600' : 'bg-gradient-to-br from-orange-500 to-amber-600',
      glowColor: activeOrders > 5 ? 'from-red-500/40 to-orange-600/40' : 'from-orange-500/40 to-amber-600/40'
    },
    {
      name: 'Today\'s Sales',
      value: `$${todaySales.toFixed(2)}`,
      change: `${todayOrderCount} orders`,
      icon: TrendingUp,
      color: 'bg-gradient-to-br from-emerald-500 to-teal-600',
      glowColor: 'from-emerald-500/40 to-teal-600/40'
    }
  ], [activeOrders, totalOrders, todaySales, pendingOrders, todayOrderCount])

  // MEMOIZED QUICK ACTIONS FOR PERFORMANCE
  const quickActions = useMemo(() => {
    const now = new Date()
    const hours = now.getHours()
    const isPeakHours = (hours >= 11 && hours < 14) || (hours >= 17 && hours < 21)
    const hasRevenue = todaySales > 0
    
    if (isPeakHours) {
      return [
        {
          href: "/dashboard/orders",
          icon: ShoppingCart,
          iconColor: "text-primary-500",
          title: "Check Late Orders",
          description: "Review orders that are running behind schedule",
          highlight: false
        },
        {
          href: "/dashboard/orders",
          icon: Activity,
          iconColor: "text-orange-500",
          title: "View Active Orders",
          description: "See all orders being prepared right now",
          highlight: false
        },
        {
          href: "/dashboard/menu-management",
          icon: UtensilsCrossed,
          iconColor: "text-amber-500",
          title: "86 Low Stock Items",
          description: "Quickly mark items with low inventory",
          highlight: false
        }
      ]
    } else if (hasRevenue) {
      return [
        {
          href: "/dashboard",
          icon: TrendingUp,
          iconColor: "text-emerald-500",
          title: "Review Today's Sales",
          description: "Analyze today's revenue and performance",
          highlight: false
        },
        {
          href: "/dashboard/menu-management",
          icon: UtensilsCrossed,
          iconColor: "text-amber-500",
          title: "Update Menu",
          description: "Modify menu items and categories",
          highlight: false
        },
        {
          href: "/dashboard/staff",
          icon: Users,
          iconColor: "text-purple-500",
          title: "Schedule Staff",
          description: "Manage staff schedules for today",
          highlight: false
        }
      ]
    } else {
      return [
        {
          href: "/dashboard/integrations",
          icon: Wifi,
          iconColor: "text-cyan-500",
          title: "Verify Integrations",
          description: "Check DoorDash, Uber Eats, and other connections",
          highlight: false
        },
        {
          href: "/dashboard/orders",
          icon: ShoppingCart,
          iconColor: "text-primary-500",
          title: "Check Order Sync",
          description: "Verify orders are syncing correctly",
          highlight: false
        }
      ]
    }
  }, [todaySales])

  return (
    <>
      <Head>
        <title>Dashboard - Servio Restaurant Platform</title>
        <meta name="description" content="Restaurant operations dashboard" />
      </Head>

      <DashboardLayout>
        <div className="space-y-8">
          {/* Welcome Section */}
          <motion.div
            className="mb-2"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <motion.div
                  className="flex items-center gap-3 mb-3"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.1 }}
                >
                  <span className="text-sm font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-widest">Dashboard</span>
                  <span className="text-surface-300 dark:text-surface-600">•</span>
                  <LiveClock
                    timezone={restaurantTimezone}
                    showIcon={false}
                    className="text-sm text-surface-400 dark:text-surface-500"
                    showTimezone={true}
                  />
                </motion.div>
                <motion.h1
                  className="text-4xl md:text-5xl font-black text-surface-900 dark:text-white tracking-tight"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  Welcome back, <span className="text-gradient">{restaurantName || user?.name?.split(' ')[0] || 'Team'}</span>
                </motion.h1>
              </div>

              <motion.div
                className="flex items-center gap-3"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4 }}
              >
                <div className={`flex items-center gap-2 px-4 py-2.5 rounded-full border ${
                  isOpen
                    ? 'bg-gradient-to-r from-servio-green-100 to-servio-green-50 dark:from-servio-green-900/30 dark:to-servio-green-800/20 border-servio-green-200 dark:border-servio-green-800'
                    : 'bg-surface-100 dark:bg-surface-800 border-surface-200 dark:border-surface-700'
                }`}>
                  <motion.div
                    className={`w-2.5 h-2.5 rounded-full ${isOpen ? 'bg-servio-green-500 shadow-glow' : 'bg-surface-500'}`}
                    animate={isOpen ? { scale: [1, 1.3, 1], opacity: [1, 0.7, 1] } : {}}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                  <span className={`text-sm font-semibold ${
                    isOpen
                      ? 'text-servio-green-700 dark:text-servio-green-300'
                      : 'text-surface-700 dark:text-surface-300'
                  }`}>
                    {isOpen ? 'Open' : 'Closed'}
                  </span>
                </div>

                {lastUpdatedAt && (
                  <div className="text-xs text-surface-500 dark:text-surface-400">
                    Updated {lastUpdatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                )}
              </motion.div>
            </div>
          </motion.div>

          {/* Fetch Error Banner */}
          {fetchError && (
            <motion.div
              className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <span className="font-semibold text-sm">⚠ Could not load dashboard stats — displaying last known values. Check your connection and try refreshing.</span>
            </motion.div>
          )}

          <BusinessDatePicker
            selectedDate={selectedDate}
            timezone={restaurantTimezone}
            isToday={isViewingToday}
            onDateChange={setSelectedDate}
            onBackToToday={() => setSelectedDate(todayInRestaurantTimezone)}
          />

          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {isFetching
              ? Array.from({ length: 4 }).map((_, idx) => <SkeletonCard key={`skeleton-${idx}`} index={idx} />)
              : stats.map((stat, index) => (
                  <StatCard key={stat.name} stat={stat} index={index} />
                ))}
          </div>

          {/* Recent Activity & Quick Actions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Orders */}
            <motion.div
              className="glass-card-premium"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 }}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-surface-900 dark:text-surface-100 flex items-center">
                  <div className="p-3 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 mr-4 shadow-lg shadow-primary-200 dark:shadow-primary-900/30">
                    <ShoppingCart className="w-6 h-6 text-white" />
                  </div>
                  Recent Orders
                </h3>
                <motion.div
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary-100 dark:bg-primary-900/30"
                  animate={{ opacity: [0.6, 1, 0.6] }}
                  transition={{ duration: 3, repeat: Infinity }}
                >
                  <div className="w-2 h-2 bg-primary-500 rounded-full animate-pulse" />
                  <span className="text-xs font-semibold text-primary-700 dark:text-primary-300">Live</span>
                </motion.div>
              </div>
              
              {/* Real-time indicator */}
              {socket && (
                <motion.div
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 mb-4"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                  <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Real-time updates enabled</span>
                </motion.div>
              )}

              <div className="space-y-4">
                {isFetching ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-surface-600 dark:text-surface-400 font-medium">Revenue syncing...</p>
                  </div>
                ) : recentOrders.length === 0 ? (
                  <motion.div
                    className="text-center py-12"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.7 }}
                  >
                    <div className="w-20 h-20 bg-gradient-to-br from-surface-100 to-surface-200 dark:from-surface-700 dark:to-surface-600 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-inner">
                      <ShoppingCart className="w-10 h-10 text-surface-400 dark:text-surface-500" />
                    </div>
                    <p className="text-surface-600 dark:text-surface-400 font-semibold">No orders yet today</p>
                    <p className="text-sm text-surface-500 dark:text-surface-500 mt-2">Orders will appear here as they come in</p>
                  </motion.div>
                ) : (
                  recentOrders.map((order, index) => (
                    <motion.div
                      key={order.id}
                      className="group flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-surface-50 to-surface-100/50 dark:from-surface-800/50 dark:to-surface-700/50 hover:from-primary-50 hover:to-primary-100/50 dark:hover:from-primary-900/20 dark:hover:to-primary-800/20 transition-all duration-300 cursor-pointer border border-surface-200/50 dark:border-surface-700/50 hover:border-primary-200 dark:hover:border-primary-800 hover:shadow-lg hover:shadow-primary-200/20 dark:hover:shadow-primary-900/20"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.7 + index * 0.1 }}
                      whileHover={{ x: 6, scale: 1.01 }}
                      onClick={() => router.push(`/dashboard/orders/${order.id}`)}
                    >
                      <div className="flex items-center space-x-4">
                        <div className="w-14 h-14 bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl flex items-center justify-center shadow-lg group-hover:shadow-xl group-hover:shadow-primary-300 dark:group-hover:shadow-primary-900/50 transition-all">
                          <span className="text-white font-bold text-lg">#{order.external_id?.slice(-2) || order.id.substring(0, 2).toUpperCase()}</span>
                        </div>
                        <div>
                          <p className="font-semibold text-surface-900 dark:text-surface-100 group-hover:text-primary-700 dark:group-hover:text-primary-300 transition-colors">
                            Order #{order.external_id || order.id.substring(0, 8)}
                          </p>
                          <p className="text-sm text-surface-600 dark:text-surface-400">
                            ${order.total_amount?.toFixed(2)} • {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3">
                        {/* Channel badge */}
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-100 dark:bg-surface-800 text-xs font-medium text-surface-600 dark:text-surface-400">
                          {getChannelIcon(order.channel)}
                          <span>{getChannelLabel(order.channel)}</span>
                        </div>
                        
                        {/* Status badge with color coding */}
                        <span className={`status-badge ${
                          order.status === 'ready'
                            ? 'status-success'
                            : order.status === 'preparing'
                            ? 'status-warning'
                            : order.status === 'received'
                            ? 'status-info'
                            : order.status === 'cancelled'
                            ? 'status-error'
                            : 'status-neutral'
                        }`}>
                          {order.status}
                        </span>
                        <motion.div
                          className="text-surface-400 group-hover:text-primary-500 transition-colors"
                          whileHover={{ x: 4 }}
                          transition={{ type: "spring", stiffness: 400, damping: 10 }}
                        >
                          <ArrowRight className="w-5 h-5" />
                        </motion.div>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </motion.div>

            {/* Quick Actions */}
            <motion.div
              className="glass-card-premium"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 }}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-surface-900 dark:text-surface-100 flex items-center">
                  <div className="p-3 rounded-2xl bg-gradient-to-br from-servio-orange-500 to-servio-orange-600 mr-4 shadow-lg shadow-servio-orange-200 dark:shadow-servio-orange-900/30">
                    <Sparkles className="w-6 h-6 text-white" />
                  </div>
                  Quick Actions
                </h3>
                <div className="flex space-x-1.5">
                  <motion.div
                    className="w-2 h-2 bg-servio-orange-400 rounded-full"
                    animate={{ scale: [1, 1.2, 1], opacity: [1, 0.6, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                  <motion.div
                    className="w-2 h-2 bg-primary-400 rounded-full"
                    animate={{ scale: [1, 1.2, 1], opacity: [1, 0.6, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }}
                  />
                  <motion.div
                    className="w-2 h-2 bg-servio-green-400 rounded-full"
                    animate={{ scale: [1, 1.2, 1], opacity: [1, 0.6, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity, delay: 0.6 }}
                  />
                </div>
              </div>

              <div className="space-y-4">
                {quickActions.map((action, index) => (
                  <motion.div
                    key={action.href}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7 + index * 0.1 }}
                  >
                    <Link
                      href={action.href}
                      className={`group block w-full text-left p-5 rounded-2xl border-2 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl active:scale-[0.98] relative overflow-hidden ${
                        action.highlight
                          ? 'border-servio-orange-200 dark:border-servio-orange-800 bg-gradient-to-r from-servio-orange-50 to-orange-50 dark:from-servio-orange-900/20 dark:to-servio-orange-800/20 hover:from-servio-orange-100 hover:to-orange-100 dark:hover:from-servio-orange-900/30 dark:hover:to-servio-orange-800/30'
                          : 'border-surface-200 dark:border-surface-600 bg-surface-50 dark:bg-surface-700/50 hover:bg-surface-100 dark:hover:bg-surface-700'
                      }`}
                    >
                      {action.highlight && (
                        <>
                          <div className="absolute inset-0 bg-gradient-to-r from-servio-orange-500/5 to-primary-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                          <motion.div
                            className="absolute top-2 right-2"
                            animate={{ rotate: 360 }}
                            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                          >
                            <Star className="w-4 h-4 text-servio-orange-400 opacity-50" />
                          </motion.div>
                        </>
                      )}

                      <div className="relative flex items-center space-x-4">
                        <motion.div
                          className={`flex-shrink-0 p-4 rounded-2xl shadow-lg ${
                            action.highlight
                              ? 'bg-gradient-to-br from-servio-orange-500 to-servio-orange-600 group-hover:shadow-servio-orange-300 dark:group-hover:shadow-servio-orange-900/50'
                              : action.href.includes('orders')
                              ? 'bg-gradient-to-br from-primary-500 to-primary-600 group-hover:shadow-primary-300 dark:group-hover:shadow-primary-900/50'
                              : 'bg-gradient-to-br from-servio-green-500 to-servio-green-600 group-hover:shadow-servio-green-300 dark:group-hover:shadow-servio-green-900/50'
                          } group-hover:shadow-xl transition-all duration-300`}
                          whileHover={{ rotate: 5, scale: 1.1 }}
                          transition={{ type: "spring", stiffness: 400, damping: 10 }}
                        >
                          <action.icon className="h-6 w-6 text-white" />
                        </motion.div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h4 className="font-bold text-surface-900 dark:text-surface-100 group-hover:text-surface-700 dark:group-hover:text-surface-200 transition-colors">
                              {action.title}
                            </h4>
                            <motion.div
                              className="text-surface-400 group-hover:text-surface-600 dark:group-hover:text-surface-300"
                              whileHover={{ x: 4 }}
                              transition={{ type: "spring", stiffness: 400, damping: 10 }}
                            >
                              <ArrowRight className="w-5 h-5" />
                            </motion.div>
                          </div>
                          <p className="text-sm text-surface-600 dark:text-surface-400 mt-1 group-hover:text-surface-500 dark:group-hover:text-surface-300 transition-colors">
                            {action.description}
                          </p>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </DashboardLayout>
    </>
  )
})

DashboardIndex.displayName = 'DashboardIndex'

export default DashboardIndex
