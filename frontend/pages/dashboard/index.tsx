import React, { memo, useMemo, useEffect, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { useUser } from '../../contexts/UserContext'
import { api } from '../../lib/api'
import { useSocket } from '../../lib/socket'
import { MessageCircle, ShoppingCart, Package, TrendingUp, Sparkles, ArrowRight, Mic, Zap, Activity, Clock, Star } from 'lucide-react'
import toast from 'react-hot-toast'

import DashboardLayout from '../../components/Layout/DashboardLayout'
import LiveClock from '../../components/ui/LiveClock'

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
  const socket = useSocket()
  const [activeOrders, setActiveOrders] = useState(0)
  const [totalOrders, setTotalOrders] = useState(0)
  const [recentOrders, setRecentOrders] = useState<any[]>([])
  const [todaySales, setTodaySales] = useState(0)
  const [pendingOrders, setPendingOrders] = useState(0)
  const [todayOrderCount, setTodayOrderCount] = useState(0)
  const [isFetching, setIsFetching] = useState(true)
  const [restaurantTimezone, setRestaurantTimezone] = useState('America/New_York')
  const [isOpen, setIsOpen] = useState(true)
  const [restaurantName, setRestaurantName] = useState<string>('')

  const fetchStats = async () => {
    setIsFetching(true)
    try {
      const [ordersRes, summaryRes, profileRes] = await Promise.all([
        api.get('/api/orders', { params: { limit: 5 } }),
        api.get('/api/orders/stats/summary'),
        api.get('/api/restaurant/profile'),
      ])

      setRecentOrders(ordersRes.data.data.orders)
      setActiveOrders(summaryRes.data.data.activeOrders || 0)
      setTotalOrders(summaryRes.data.data.totalOrders || 0)
      setTodaySales(summaryRes.data.data.completedTodaySales || 0)
      setPendingOrders(summaryRes.data.data.pendingOrders || 0)
      setTodayOrderCount(summaryRes.data.data.todayOrders || summaryRes.data.data.totalOrders || 0)

      // Set restaurant name and timezone from profile
      const profileData = profileRes.data?.data
      if (profileData) {
        setRestaurantName(profileData.name || '')
        setRestaurantTimezone(profileData.timezone || 'America/New_York')
      }

      // Determine if restaurant is open (simplified - can be enhanced)
      const hours = new Date().getHours()
      setIsOpen(hours >= 9 && hours < 22)
    } catch (err) {
      console.error('Failed to fetch dashboard stats', err)
    } finally {
      setIsFetching(false)
    }
  }

  useEffect(() => {
    fetchStats()

    if (socket) {
      socket.on('order:new', (order) => {
        toast.success(`New order received! Total: $${order.totalAmount}`)
        fetchStats()
      })
    }

    return () => {
      if (socket) socket.off('order:new')
    }
  }, [socket])

  // STATS DATA WITH PREMIUM STYLING
  const stats = useMemo(() => [
    {
      name: 'Pending Orders',
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
      name: 'Active Orders',
      value: activeOrders.toString(),
      change: activeOrders > 0 ? 'In progress' : 'No active',
      icon: Activity,
      color: 'bg-gradient-to-br from-orange-500 to-amber-600',
      glowColor: 'from-orange-500/40 to-amber-600/40'
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
  const quickActions = useMemo(() => [
    {
      href: "/dashboard/assistant",
      icon: MessageCircle,
      iconColor: "text-servio-orange-500",
      title: "Talk to Servio",
      description: "Get help with orders, inventory, and tasks",
      highlight: true
    },
    {
      href: "/dashboard/orders",
      icon: ShoppingCart,
      iconColor: "text-primary-500",
      title: "View All Orders",
      description: "Check order status and update progress"
    },
    {
      href: "/dashboard/inventory",
      icon: Package,
      iconColor: "text-servio-green-500",
      title: "Update Inventory",
      description: "Adjust stock levels and receive items"
    }
  ], [])

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
              </motion.div>
            </div>
          </motion.div>

          {/* PREMIUM AI ASSISTANT HERO */}
          <motion.div
            className="relative rounded-[2.5rem] overflow-hidden"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.6 }}
          >
            {/* Multi-layer gradient background */}
            <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" />
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 via-transparent to-orange-500/10" />

            {/* Animated mesh gradient */}
            <div className="absolute inset-0 overflow-hidden">
              <motion.div
                className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-emerald-500/20 to-transparent rounded-full blur-3xl"
                animate={{
                  x: [0, 100, 0],
                  y: [0, 50, 0],
                  scale: [1, 1.2, 1]
                }}
                transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
              />
              <motion.div
                className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-orange-500/20 to-transparent rounded-full blur-3xl"
                animate={{
                  x: [0, -100, 0],
                  y: [0, -50, 0],
                  scale: [1.2, 1, 1.2]
                }}
                transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
              />
              <motion.div
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-gradient-to-r from-primary-500/10 to-servio-purple-500/10 rounded-full blur-3xl"
                animate={{
                  scale: [1, 1.3, 1],
                  opacity: [0.5, 0.8, 0.5]
                }}
                transition={{ duration: 10, repeat: Infinity }}
              />
            </div>

            {/* Grid pattern overlay */}
            <div className="absolute inset-0 opacity-[0.03]" style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
            }} />

            <div className="relative px-8 py-10 md:px-12 md:py-12">
              <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
                {/* Content */}
                <div className="flex-1 text-center lg:text-left">
                  {/* Badge */}
                  <motion.div
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/10 mb-6"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    <motion.div
                      className="w-2 h-2 rounded-full bg-emerald-400 shadow-glow"
                      animate={{ scale: [1, 1.3, 1], opacity: [1, 0.7, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                    <span className="text-sm font-semibold text-white/90">AI Assistant Online</span>
                    <Zap className="w-4 h-4 text-amber-400" />
                  </motion.div>

                  <motion.h2
                    className="text-4xl md:text-5xl font-black text-white mb-4 tracking-tight"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                  >
                    Your AI <span className="text-gradient-orange">Command Center</span>
                  </motion.h2>

                  <motion.p
                    className="text-lg text-white/70 mb-8 max-w-xl leading-relaxed"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                  >
                    Talk naturally to manage orders, check inventory, update menus, and run your restaurant hands-free.
                  </motion.p>

                  <motion.div
                    className="flex flex-col sm:flex-row items-center gap-4"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                  >
                    <Link
                      href="/dashboard/assistant"
                      className="group relative inline-flex items-center gap-3 bg-gradient-to-r from-white to-surface-100 text-slate-900 px-8 py-4 rounded-2xl font-bold text-lg hover:from-surface-50 hover:to-white transition-all duration-300 shadow-2xl shadow-white/20 hover:shadow-white/40 hover:scale-105"
                    >
                      <motion.div
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      >
                        <Mic className="h-6 w-6 text-primary-600" />
                      </motion.div>
                      <span>Start Talking</span>
                      <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                    </Link>

                    <div className="flex items-center gap-6 text-white/60">
                      <div className="flex items-center gap-2">
                        <Activity className="w-4 h-4 text-emerald-400" />
                        <span className="text-sm font-medium">Real-time</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-amber-400" />
                        <span className="text-sm font-medium">Voice-first</span>
                      </div>
                    </div>
                  </motion.div>
                </div>

                {/* Visual element */}
                <motion.div
                  className="hidden lg:flex items-center justify-center"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.4, duration: 0.6 }}
                >
                  <div className="relative">
                    {/* Outer ring */}
                    <motion.div
                      className="absolute inset-0 rounded-full border-2 border-white/10"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                      style={{ width: 200, height: 200, margin: -30 }}
                    />

                    {/* Middle ring */}
                    <motion.div
                      className="absolute inset-0 rounded-full border border-white/5"
                      animate={{ rotate: -360 }}
                      transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
                      style={{ width: 170, height: 170, margin: -15 }}
                    />

                    {/* Inner glowing orb */}
                    <motion.div
                      className="w-40 h-40 rounded-full bg-gradient-to-br from-emerald-400 via-emerald-500 to-orange-500 flex items-center justify-center shadow-2xl shadow-emerald-500/30 relative z-10"
                      animate={{
                        boxShadow: [
                          "0 0 60px rgba(20,184,166,0.4)",
                          "0 0 80px rgba(20,184,166,0.6)",
                          "0 0 60px rgba(20,184,166,0.4)"
                        ]
                      }}
                      transition={{ duration: 3, repeat: Infinity }}
                    >
                      <motion.div
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      >
                        <MessageCircle className="w-18 h-18 text-white" />
                      </motion.div>
                    </motion.div>

                    {/* Floating particles */}
                    <motion.div
                      className="absolute -top-3 -right-3 w-5 h-5 rounded-full bg-amber-400 shadow-glow-orange"
                      animate={{ y: [-8, 8, -8], x: [-4, 4, -4] }}
                      transition={{ duration: 4, repeat: Infinity }}
                    />
                    <motion.div
                      className="absolute -bottom-2 -left-4 w-4 h-4 rounded-full bg-teal-300 shadow-glow"
                      animate={{ y: [8, -8, 8], x: [4, -4, 4] }}
                      transition={{ duration: 3, repeat: Infinity }}
                    />
                    <motion.div
                      className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 w-3 h-3 rounded-full bg-primary-300 shadow-glow"
                      animate={{ y: [-6, 6, -6] }}
                      transition={{ duration: 2.5, repeat: Infinity }}
                    />
                    <motion.div
                      className="absolute bottom-0 right-1/2 translate-x-2 translate-y-1 w-2 h-2 rounded-full bg-servio-purple-400"
                      animate={{ y: [-4, 4, -4], x: [2, -2, 2] }}
                      transition={{ duration: 3.5, repeat: Infinity }}
                    />
                  </div>
                </motion.div>
              </div>
            </div>
          </motion.div>

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

              <div className="space-y-4">
                {recentOrders.length === 0 ? (
                  <motion.div
                    className="text-center py-12"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.7 }}
                  >
                    <div className="w-20 h-20 bg-gradient-to-br from-surface-100 to-surface-200 dark:from-surface-700 dark:to-surface-600 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-inner">
                      <ShoppingCart className="w-10 h-10 text-surface-400 dark:text-surface-500" />
                    </div>
                    <p className="text-surface-600 dark:text-surface-400 font-semibold">No recent orders</p>
                    <p className="text-sm text-surface-500 dark:text-surface-500 mt-2">Orders will appear here as they come in</p>
                  </motion.div>
                ) : (
                  recentOrders.map((order, index) => (
                    <motion.div
                      key={order.id}
                      className="group flex items-center justify-between p-5 rounded-2xl bg-gradient-to-r from-surface-50 to-surface-100/50 dark:from-surface-800/50 dark:to-surface-700/50 hover:from-primary-50 hover:to-primary-100/50 dark:hover:from-primary-900/20 dark:hover:to-primary-800/20 transition-all duration-300 cursor-pointer border border-surface-200/50 dark:border-surface-700/50 hover:border-primary-200 dark:hover:border-primary-800 hover:shadow-lg hover:shadow-primary-200/20 dark:hover:shadow-primary-900/20"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.7 + index * 0.1 }}
                      whileHover={{ x: 6, scale: 1.01 }}
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
                            ${order.total_amount?.toFixed(2)} • {new Date(order.created_at).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3">
                        <span className={`status-badge ${
                          order.status === 'ready'
                            ? 'status-success'
                            : order.status === 'preparing'
                            ? 'status-warning'
                            : 'status-info'
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
