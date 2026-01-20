import React, { memo, useMemo, useEffect, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { motion } from 'framer-motion'
import dynamic from 'next/dynamic'
import { useUser } from '../../contexts/UserContext'
import { api } from '../../lib/api'
import { useSocket } from '../../lib/socket'
import { MessageCircle, ShoppingCart, Package, CheckSquare, TrendingUp, Sparkles, ArrowRight } from 'lucide-react'
import toast from 'react-hot-toast'

import DashboardLayout from '../../components/Layout/DashboardLayout'

// STAT CARD COMPONENT FOR PERFORMANCE
const StatCard = memo(({ stat, index }: { stat: any; index: number }) => (
  <motion.div
    className="card-hover"
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: 0.1 * (index + 2) }}
    whileHover={{ y: -4 }}
  >
    <div className="flex items-center">
      <motion.div
        className={`p-3 rounded-xl ${stat.color || 'bg-primary-500'}`}
        whileHover={{ scale: 1.1, rotate: 5 }}
        transition={{ type: "spring", stiffness: 400, damping: 10 }}
      >
        <stat.icon className="h-6 w-6 text-white" />
      </motion.div>
      <div className="ml-4 flex-1">
        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
          {stat.name}
        </p>
        <motion.p
          className="text-2xl font-bold text-gray-900 dark:text-gray-100"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2 * (index + 2), type: "spring", bounce: 0.4 }}
        >
          {stat.value}
        </motion.p>
      </div>
    </div>
    <div className="mt-4 flex items-center justify-between">
      <div className="flex items-center">
        <span className={`text-sm font-medium inline-flex items-center px-2 py-1 rounded-full ${
          stat.changeType === 'increase'
            ? 'text-servio-green-700 bg-servio-green-100'
            : 'text-servio-red-700 bg-servio-red-100'
        }`}>
          {stat.change}
        </span>
      </div>
      <span className="text-xs text-gray-500">
        from yesterday
      </span>
    </div>
  </motion.div>
))

StatCard.displayName = 'StatCard'

const SkeletonCard = memo(() => (
  <motion.div 
    className="bg-white dark:bg-surface-800 rounded-2xl p-6 shadow-lg border border-surface-100 dark:border-surface-700 animate-pulse"
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5 }}
  >
    <div className="flex items-center justify-between mb-4">
      <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-surface-200 to-surface-300 dark:from-surface-700 dark:to-surface-600" />
      <div className="h-6 w-16 rounded-full bg-surface-200 dark:bg-surface-700" />
    </div>
    <div className="space-y-3">
      <div className="h-4 w-24 rounded bg-surface-200 dark:bg-surface-700" />
      <div className="flex items-baseline space-x-2">
        <div className="h-8 w-20 rounded bg-surface-200 dark:bg-surface-700" />
        <div className="h-4 w-12 rounded bg-surface-200 dark:bg-surface-700" />
      </div>
      <div className="h-3 w-32 rounded bg-surface-200 dark:bg-surface-700" />
    </div>
  </motion.div>
))

SkeletonCard.displayName = 'SkeletonCard'

const DashboardIndex = memo(() => {
  const { user, isManagerOrOwner } = useUser()
  const socket = useSocket()
  const [activeOrders, setActiveOrders] = useState(0)
  const [recentOrders, setRecentOrders] = useState<any[]>([])
  const [pendingTasks, setPendingTasks] = useState(0)
  const [todaySales, setTodaySales] = useState(0)
  const [isFetching, setIsFetching] = useState(true)

  const fetchStats = async () => {
    setIsFetching(true)
    try {
      const [ordersRes, summaryRes, tasksRes] = await Promise.all([
        api.get('/api/orders', { params: { limit: 5 } }),
        api.get('/api/orders/stats/summary'),
        api.get('/api/tasks/stats')
      ])
      
      setRecentOrders(ordersRes.data.data.orders)
      setActiveOrders(summaryRes.data.data.activeOrders)
      setTodaySales(summaryRes.data.data.completedTodaySales || 0) // adjusted field
      setPendingTasks(tasksRes.data.data.pending)
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

  // STATS DATA FOR PERFORMANCE
  const stats = useMemo(() => [
    {
      name: 'Active Orders',
      value: activeOrders.toString(),
      change: '+2.5%',
      changeType: 'increase' as const,
      icon: ShoppingCart,
      color: 'bg-primary-500'
    },
    {
      name: 'Items 86\'d',
      value: '0',
      change: '+0',
      changeType: 'increase' as const,
      icon: Package,
      color: 'bg-servio-red-500'
    },
    {
      name: 'Pending Tasks',
      value: pendingTasks.toString(),
      change: '-3',
      changeType: 'decrease' as const,
      icon: CheckSquare,
      color: 'bg-servio-orange-500'
    },
    {
      name: 'Today\'s Sales',
      value: `$${todaySales.toFixed(2)}`,
      change: '+12.5%',
      changeType: 'increase' as const,
      icon: TrendingUp,
      color: 'bg-servio-green-500'
    }
  ], [activeOrders, pendingTasks, todaySales])

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
        <div className="space-y-6">
          {/* Welcome Section */}
          <motion.div
            className="mb-2 welcome-header"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center justify-between">
              <div>
                <motion.h1 
                  className="text-4xl font-bold bg-gradient-to-r from-surface-900 via-primary-700 to-servio-orange-600 bg-clip-text text-transparent dark:from-surface-100 dark:via-primary-300 dark:to-servio-orange-400"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  Welcome back, {user?.name || 'Team'}! 👋
                </motion.h1>
                <motion.p 
                  className="mt-3 text-lg text-surface-600 dark:text-surface-400"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  Here&apos;s what&apos;s happening with your restaurant today.
                </motion.p>
              </div>
              
              <motion.div
                className="hidden md:flex items-center space-x-3"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4 }}
              >
                <div className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-servio-green-100 to-servio-green-50 dark:from-servio-green-900/30 dark:to-servio-green-800/20 rounded-full">
                  <motion.div
                    className="w-2 h-2 bg-servio-green-500 rounded-full"
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                  <span className="text-sm font-medium text-servio-green-700 dark:text-servio-green-300">Restaurant Online</span>
                </div>
              </motion.div>
            </div>
          </motion.div>

          {/* Hero Assistant Section */}
          <motion.div
            className="relative bg-gradient-to-r from-teal-500 via-teal-400 to-orange-500 rounded-3xl p-8 text-white overflow-hidden shadow-2xl assistant-hero"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            {/* Animated background patterns */}
            <div className="absolute inset-0 opacity-20">
              <div className="absolute top-0 left-0 w-72 h-72 bg-white rounded-full mix-blend-soft-light filter blur-xl opacity-70 animate-pulse"></div>
              <div className="absolute bottom-0 right-0 w-96 h-96 bg-gradient-to-r from-yellow-300 to-orange-300 rounded-full mix-blend-soft-light filter blur-2xl opacity-50"></div>
            </div>
            
            <div className="relative flex items-center justify-between">
              <div className="flex-1">
                <motion.div
                  className="flex items-center mb-4"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3 mr-4">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                    >
                      <Sparkles className="w-8 h-8" />
                    </motion.div>
                  </div>
                  <div>
                    <h2 className="text-3xl font-bold tracking-tight">Meet Servio Assistant</h2>
                    <div className="flex items-center mt-1">
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse mr-2"></div>
                      <span className="text-sm font-medium text-orange-100">AI-Powered • Ready to Help</span>
                    </div>
                  </div>
                </motion.div>
                
                <motion.p
                  className="text-lg text-orange-50 mb-6 max-w-2xl leading-relaxed"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  Your AI-powered helper for orders, inventory, and tasks.
                  Just talk and Servio will help!
                </motion.p>
                
                <motion.div
                  className="flex flex-wrap gap-4"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  <Link
                    href="/dashboard/assistant"
                    className="inline-flex items-center space-x-3 bg-white text-servio-orange-600 px-8 py-4 rounded-2xl font-semibold hover:bg-orange-50 transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 shadow-xl hover:shadow-2xl group"
                  >
                    <MessageCircle className="h-6 w-6 group-hover:animate-bounce" />
                    <span className="text-lg">Start Talking to Servio</span>
                    <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </Link>
                  
                  <div className="flex items-center space-x-4 text-orange-100">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                      <span className="text-sm font-medium">Voice Ready</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '0.5s' }}></div>
                      <span className="text-sm font-medium">Real-time Sync</span>
                    </div>
                  </div>
                </motion.div>
              </div>
              
              <div className="hidden lg:block ml-8">
                <motion.div
                  className="relative"
                  animate={{
                    y: [-10, 10, -10],
                  }}
                  transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                >
                  <div className="w-32 h-32 bg-white/20 backdrop-blur-sm rounded-3xl flex items-center justify-center border border-white/30">
                    <motion.div
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      <MessageCircle className="h-16 w-16" />
                    </motion.div>
                  </div>
                  {/* Floating accent elements */}
                  <motion.div
                    className="absolute -top-2 -right-2 w-6 h-6 bg-yellow-300 rounded-full"
                    animate={{ scale: [1, 1.2, 1], rotate: 360 }}
                    transition={{ duration: 3, repeat: Infinity }}
                  />
                  <motion.div
                    className="absolute -bottom-1 -left-1 w-4 h-4 bg-green-300 rounded-full"
                    animate={{ scale: [1, 1.3, 1] }}
                    transition={{ duration: 2, repeat: Infinity, delay: 1 }}
                  />
                </motion.div>
              </div>
            </div>
          </motion.div>

          {/* Stats Grid - Optimized with Memoized Components */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 stats-grid">
            {isFetching
              ? Array.from({ length: 4 }).map((_, idx) => <SkeletonCard key={`skeleton-${idx}`} />)
              : stats.map((stat, index) => (
                  <StatCard key={stat.name} stat={stat} index={index} />
                ))}
          </div>

          {/* Recent Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <motion.div
              className="bg-white dark:bg-surface-800 rounded-2xl p-6 shadow-lg border border-surface-100 dark:border-surface-700"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 }}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-surface-900 dark:text-surface-100 flex items-center">
                  <div className="p-2 rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 mr-3">
                    <ShoppingCart className="w-5 h-5 text-white" />
                  </div>
                  Recent Orders
                </h3>
                <motion.div
                  className="flex items-center space-x-2 text-xs font-medium text-surface-500 dark:text-surface-400"
                  animate={{ opacity: [0.6, 1, 0.6] }}
                  transition={{ duration: 3, repeat: Infinity }}
                >
                  <div className="w-2 h-2 bg-primary-400 rounded-full"></div>
                  <span>Live Updates</span>
                </motion.div>
              </div>
              
              <div className="space-y-3">
                {recentOrders.length === 0 ? (
                  <motion.div 
                    className="text-center py-12"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.7 }}
                  >
                    <div className="w-16 h-16 bg-gradient-to-br from-surface-100 to-surface-200 dark:from-surface-700 dark:to-surface-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <ShoppingCart className="w-8 h-8 text-surface-400 dark:text-surface-500" />
                    </div>
                    <p className="text-surface-500 dark:text-surface-400 font-medium">No recent orders</p>
                    <p className="text-sm text-surface-400 dark:text-surface-500 mt-1">Orders will appear here as they come in</p>
                  </motion.div>
                ) : (
                  recentOrders.map((order, index) => (
                    <motion.div
                      key={order.id}
                      className="group flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-surface-50 to-surface-100/50 dark:from-surface-700/50 dark:to-surface-600/50 hover:from-primary-50 hover:to-primary-100/50 dark:hover:from-primary-900/20 dark:hover:to-primary-800/20 transition-all duration-300 cursor-pointer border border-surface-200/50 dark:border-surface-600/50 hover:border-primary-200 dark:hover:border-primary-800 hover:shadow-lg"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.7 + index * 0.1 }}
                      whileHover={{ x: 6, scale: 1.01 }}
                    >
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl flex items-center justify-center shadow-lg group-hover:shadow-primary-200 dark:group-hover:shadow-primary-900/50 transition-shadow">
                          <span className="text-white font-bold text-sm">#{order.external_id?.slice(-2) || order.id.substring(0, 2).toUpperCase()}</span>
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
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold shadow-sm ${
                          order.status === 'ready' 
                            ? 'bg-servio-green-100 dark:bg-servio-green-900/30 text-servio-green-700 dark:text-servio-green-300 ring-1 ring-servio-green-200 dark:ring-servio-green-800' 
                            : order.status === 'preparing'
                            ? 'bg-servio-orange-100 dark:bg-servio-orange-900/30 text-servio-orange-700 dark:text-servio-orange-300 ring-1 ring-servio-orange-200 dark:ring-servio-orange-800'
                            : 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 ring-1 ring-primary-200 dark:ring-primary-800'
                        }`}>
                          {order.status}
                        </span>
                        <motion.div
                          className="text-surface-400 group-hover:text-primary-500 transition-colors"
                          whileHover={{ x: 4 }}
                          transition={{ type: "spring", stiffness: 400, damping: 10 }}
                        >
                          <ArrowRight className="w-4 h-4" />
                        </motion.div>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </motion.div>

            <motion.div
              className="bg-white dark:bg-surface-800 rounded-2xl p-6 shadow-lg border border-surface-100 dark:border-surface-700"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 }}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-surface-900 dark:text-surface-100 flex items-center">
                  <div className="p-2 rounded-xl bg-gradient-to-r from-servio-orange-500 to-servio-orange-600 mr-3">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  Quick Actions
                </h3>
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-servio-orange-400 rounded-full animate-pulse"></div>
                  <div className="w-2 h-2 bg-primary-400 rounded-full animate-pulse" style={{ animationDelay: '0.5s' }}></div>
                  <div className="w-2 h-2 bg-servio-green-400 rounded-full animate-pulse" style={{ animationDelay: '1s' }}></div>
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
                      className={`group block w-full text-left p-5 rounded-2xl border-2 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg active:scale-[0.98] relative overflow-hidden ${
                        action.highlight
                          ? 'border-servio-orange-200 dark:border-servio-orange-800 bg-gradient-to-r from-servio-orange-50 to-orange-50 dark:from-servio-orange-900/20 dark:to-servio-orange-800/20 hover:from-servio-orange-100 hover:to-orange-100 dark:hover:from-servio-orange-900/30 dark:hover:to-servio-orange-800/30'
                          : 'border-surface-200 dark:border-surface-600 bg-surface-50 dark:bg-surface-700/50 hover:bg-surface-100 dark:hover:bg-surface-700'
                      }`}
                    >
                      {action.highlight && (
                        <div className="absolute inset-0 bg-gradient-to-r from-servio-orange-500/5 to-primary-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                      
                      <div className="relative flex items-center space-x-4">
                        <motion.div 
                          className={`flex-shrink-0 p-3 rounded-2xl shadow-lg ${
                            action.highlight
                              ? 'bg-gradient-to-br from-servio-orange-500 to-servio-orange-600 group-hover:shadow-servio-orange-200 dark:group-hover:shadow-servio-orange-900/50'
                              : action.href.includes('orders')
                              ? 'bg-gradient-to-br from-primary-500 to-primary-600 group-hover:shadow-primary-200 dark:group-hover:shadow-primary-900/50'
                              : 'bg-gradient-to-br from-servio-green-500 to-servio-green-600 group-hover:shadow-servio-green-200 dark:group-hover:shadow-servio-green-900/50'
                          } group-hover:shadow-xl transition-all duration-300`}
                          whileHover={{ rotate: 5, scale: 1.1 }}
                          transition={{ type: "spring", stiffness: 400, damping: 10 }}
                        >
                          <action.icon className="h-6 w-6 text-white" />
                        </motion.div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h4 className="font-semibold text-surface-900 dark:text-surface-100 group-hover:text-surface-700 dark:group-hover:text-surface-200 transition-colors">
                              {action.title}
                            </h4>
                            <div className="flex items-center space-x-2">
                              {action.highlight && (
                                <motion.div
                                  animate={{ rotate: 360 }}
                                  transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                                >
                                  <Sparkles className="w-4 h-4 text-servio-orange-500" />
                                </motion.div>
                              )}
                              <motion.div
                                className="text-surface-400 group-hover:text-surface-600 dark:group-hover:text-surface-300"
                                whileHover={{ x: 4 }}
                                transition={{ type: "spring", stiffness: 400, damping: 10 }}
                              >
                                <ArrowRight className="w-5 h-5" />
                              </motion.div>
                            </div>
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