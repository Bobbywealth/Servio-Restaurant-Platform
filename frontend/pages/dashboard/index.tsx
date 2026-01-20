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

// MEMOIZED STAT CARD COMPONENT FOR PERFORMANCE
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
        className={`p-3 rounded-xl ${stat.color}`}
        whileHover={{ scale: 1.1, rotate: 5 }}
        transition={{ type: "spring", stiffness: 400, damping: 10 }}
      >
        <stat.icon className="h-6 w-6 text-white" />
      </motion.div>
      <div className="ml-4 flex-1">
        <p className="text-sm font-medium text-surface-600 dark:text-surface-400">
          {stat.name}
        </p>
        <motion.p
          className="text-2xl font-bold text-surface-900 dark:text-surface-100"
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
            ? 'text-servio-green-700 dark:text-servio-green-300 bg-servio-green-100 dark:bg-servio-green-900/30'
            : 'text-servio-red-700 dark:text-servio-red-300 bg-servio-red-100 dark:bg-servio-red-900/30'
        }`}>
          {stat.change}
        </span>
      </div>
      <span className="text-xs text-surface-500 dark:text-surface-400">
        from yesterday
      </span>
    </div>
  </motion.div>
))

StatCard.displayName = 'StatCard'

const DashboardIndex = memo(() => {
  const { user, isManagerOrOwner } = useUser()
  const socket = useSocket()
  const [activeOrders, setActiveOrders] = useState(0)
  const [recentOrders, setRecentOrders] = useState<any[]>([])
  const [pendingTasks, setPendingTasks] = useState(0)
  const [todaySales, setTodaySales] = useState(0)

  const fetchStats = async () => {
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

  // MEMOIZED STATS DATA FOR PERFORMANCE
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
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Welcome back, {user?.name || 'Team'}!
            </h1>
            <p className="mt-2 text-gray-600">
              Here&apos;s what&apos;s happening with your restaurant today.
            </p>
          </div>

          {/* Quick Access to Assistant */}
          <motion.div
            className="gradient-warning rounded-2xl p-6 text-white relative overflow-hidden"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-servio-orange-400/20 to-transparent" />
            <div className="relative flex items-center justify-between">
              <div>
                <motion.h2
                  className="text-xl font-semibold mb-2 flex items-center"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  Meet Servio Assistant
                  <motion.div
                    className="ml-2"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                  >
                    <Sparkles className="w-5 h-5" />
                  </motion.div>
                </motion.h2>
                <motion.p
                  className="text-orange-100 mb-4 max-w-md"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  Your AI-powered helper for orders, inventory, and tasks. Just talk and Servio will help!
                </motion.p>
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  <Link
                    href="/dashboard/assistant"
                    className="inline-flex items-center space-x-2 bg-white text-servio-orange-700 px-6 py-3 rounded-xl font-medium hover:bg-orange-50 transition-all duration-200 transform hover:scale-105 shadow-lg"
                  >
                    <MessageCircle className="h-5 w-5" />
                    <span>Start Talking to Servio</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </motion.div>
              </div>
              <div className="hidden md:block">
                <motion.div
                  className="w-20 h-20 bg-white bg-opacity-20 rounded-2xl flex items-center justify-center backdrop-blur-sm"
                  animate={{
                    scale: [1, 1.05, 1],
                    rotate: [0, 2, -2, 0]
                  }}
                  transition={{ duration: 4, repeat: Infinity }}
                >
                  <MessageCircle className="h-10 w-10" />
                </motion.div>
              </div>
            </div>
          </motion.div>

          {/* Stats Grid - Optimized with Memoized Components */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.map((stat, index) => (
              <StatCard key={stat.name} stat={stat} index={index} />
            ))}
          </div>

          {/* Recent Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <motion.div
              className="card"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 }}
            >
              <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-4 flex items-center">
                <ShoppingCart className="w-5 h-5 mr-2 text-primary-500" />
                Recent Orders
              </h3>
              <div className="space-y-3">
                {recentOrders.length === 0 ? (
                  <p className="text-surface-500 py-4 text-center">No recent orders</p>
                ) : (
                  recentOrders.map((order, index) => (
                    <motion.div
                      key={order.id}
                      className="flex items-center justify-between py-3 px-4 rounded-xl bg-surface-50 dark:bg-surface-800/50 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors cursor-pointer"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.7 + index * 0.1 }}
                      whileHover={{ x: 4 }}
                    >
                      <div>
                        <p className="font-medium text-surface-900 dark:text-surface-100">Order #{order.external_id || order.id.substring(0, 8)}</p>
                        <p className="text-sm text-surface-600 dark:text-surface-400">Total: ${order.total_amount?.toFixed(2)}</p>
                      </div>
                      <div className="text-right">
                        <span className={`status-badge ${
                          order.status === 'ready' ? 'status-success' : 'status-warning'
                        }`}>
                          {order.status}
                        </span>
                        <p className="text-xs text-surface-500 dark:text-surface-400 mt-1">{new Date(order.created_at).toLocaleTimeString()}</p>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </motion.div>

            <motion.div
              className="card"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 }}
            >
              <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-4 flex items-center">
                <Sparkles className="w-5 h-5 mr-2 text-servio-orange-500" />
                Quick Actions
              </h3>
              <div className="space-y-3">
                {quickActions.map((action, index) => (
                  <motion.div
                    key={action.href}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7 + index * 0.1 }}
                  >
                    <Link
                      href={action.href}
                      className={`block w-full text-left p-4 rounded-xl border transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] ${
                        action.highlight
                          ? 'border-servio-orange-200 dark:border-servio-orange-800 bg-servio-orange-50 dark:bg-servio-orange-900/20 hover:bg-servio-orange-100 dark:hover:bg-servio-orange-900/30'
                          : 'border-surface-200 dark:border-surface-700 hover:bg-surface-50 dark:hover:bg-surface-800/50'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className={`p-2 rounded-lg ${
                          action.highlight
                            ? 'bg-servio-orange-100 dark:bg-servio-orange-800/50'
                            : 'bg-surface-100 dark:bg-surface-800'
                        }`}>
                          <action.icon className={`h-5 w-5 ${action.iconColor}`} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-surface-900 dark:text-surface-100">
                              {action.title}
                            </span>
                            {action.highlight && (
                              <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                              >
                                <Sparkles className="w-4 h-4 text-servio-orange-500" />
                              </motion.div>
                            )}
                          </div>
                          <p className="text-sm text-surface-600 dark:text-surface-400 mt-1">
                            {action.description}
                          </p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-surface-400 dark:text-surface-500 group-hover:text-surface-600 dark:group-hover:text-surface-300" />
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