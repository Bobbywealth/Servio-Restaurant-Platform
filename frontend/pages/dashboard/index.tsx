import React from 'react'
import Head from 'next/head'
import Link from 'next/link'
import DashboardLayout from '../../components/Layout/DashboardLayout'
import { useUser } from '../../contexts/UserContext'
import { MessageCircle, ShoppingCart, Package, CheckSquare, TrendingUp } from 'lucide-react'

export default function DashboardIndex() {
  const { user, isManagerOrOwner } = useUser()

  const stats = [
    {
      name: 'Active Orders',
      value: '12',
      change: '+2.5%',
      changeType: 'increase',
      icon: ShoppingCart,
      color: 'text-blue-600 bg-blue-100'
    },
    {
      name: 'Items 86\'d',
      value: '3',
      change: '+1',
      changeType: 'increase',
      icon: Package,
      color: 'text-red-600 bg-red-100'
    },
    {
      name: 'Pending Tasks',
      value: '7',
      change: '-3',
      changeType: 'decrease',
      icon: CheckSquare,
      color: 'text-yellow-600 bg-yellow-100'
    },
    {
      name: 'Today\'s Sales',
      value: '$2,847',
      change: '+12.5%',
      changeType: 'increase',
      icon: TrendingUp,
      color: 'text-green-600 bg-green-100'
    }
  ]

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
              Here's what's happening with your restaurant today.
            </p>
          </div>

          {/* Quick Access to Assistant */}
          <div className="bg-gradient-to-r from-servio-orange to-orange-600 rounded-lg p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold mb-2">
                  Meet Servio Assistant
                </h2>
                <p className="text-orange-100 mb-4">
                  Your AI-powered helper for orders, inventory, and tasks. Just talk and Servio will help!
                </p>
                <Link
                  href="/dashboard/assistant"
                  className="inline-flex items-center space-x-2 bg-white text-servio-orange px-4 py-2 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                >
                  <MessageCircle className="h-5 w-5" />
                  <span>Start Talking to Servio</span>
                </Link>
              </div>
              <div className="hidden md:block">
                <div className="w-20 h-20 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                  <MessageCircle className="h-10 w-10" />
                </div>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.map((stat) => (
              <div key={stat.name} className="card">
                <div className="flex items-center">
                  <div className={`p-2 rounded-lg ${stat.color}`}>
                    <stat.icon className="h-6 w-6" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">
                      {stat.name}
                    </p>
                    <p className="text-2xl font-bold text-gray-900">
                      {stat.value}
                    </p>
                  </div>
                </div>
                <div className="mt-4">
                  <span className={`text-sm font-medium ${
                    stat.changeType === 'increase' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {stat.change}
                  </span>
                  <span className="text-sm text-gray-500 ml-2">
                    from yesterday
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Recent Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Recent Orders
              </h3>
              <div className="space-y-3">
                {[
                  { id: '214', item: 'Jerk Chicken Plate', time: '2 min ago', status: 'preparing' },
                  { id: '215', item: 'Curry Goat', time: '5 min ago', status: 'ready' },
                  { id: '216', item: 'Oxtail Dinner', time: '8 min ago', status: 'preparing' }
                ].map((order) => (
                  <div key={order.id} className="flex items-center justify-between py-2">
                    <div>
                      <p className="font-medium text-gray-900">Order #{order.id}</p>
                      <p className="text-sm text-gray-600">{order.item}</p>
                    </div>
                    <div className="text-right">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        order.status === 'ready' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {order.status}
                      </span>
                      <p className="text-xs text-gray-500 mt-1">{order.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Quick Actions
              </h3>
              <div className="space-y-2">
                <Link
                  href="/dashboard/assistant"
                  className="block w-full text-left px-4 py-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <MessageCircle className="h-5 w-5 text-servio-orange" />
                    <span className="font-medium">Talk to Servio</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    Get help with orders, inventory, and tasks
                  </p>
                </Link>
                
                <Link
                  href="/dashboard/orders"
                  className="block w-full text-left px-4 py-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <ShoppingCart className="h-5 w-5 text-blue-600" />
                    <span className="font-medium">View All Orders</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    Check order status and update progress
                  </p>
                </Link>

                <Link
                  href="/dashboard/inventory"
                  className="block w-full text-left px-4 py-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <Package className="h-5 w-5 text-green-600" />
                    <span className="font-medium">Update Inventory</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    Adjust stock levels and receive items
                  </p>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    </>
  )
}