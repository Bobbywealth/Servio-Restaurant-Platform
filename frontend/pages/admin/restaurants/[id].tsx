import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { 
  Building2, 
  Users, 
  ShoppingCart, 
  Mic,
  Package,
  Clock,
  FileText,
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  XCircle,
  Calendar,
  Phone,
  Mail,
  MapPin
} from 'lucide-react'
import AdminLayout from '../../../components/Layout/AdminLayout'
import { api } from '../../../lib/api'

interface Restaurant {
  id: string
  name: string
  slug: string
  email: string
  phone: string
  address: string
  is_active: boolean
  created_at: string
  user_count: number
  total_orders: number
  orders_today: number
  orders_7d: number
  orders_30d: number
  revenue_30d: number
  last_order_at: string | null
}

interface UserBreakdown {
  role: string
  count: number
  active_count: number
}

interface RestaurantData {
  restaurant: Restaurant
  userBreakdown: UserBreakdown[]
}

interface Order {
  id: string
  external_id: string
  channel: string
  status: string
  customer_name: string
  total_amount: number
  created_at: string
  items: any[]
}

interface VoiceActivity {
  id: string
  action: string
  user_id: string
  details: any
  created_at: string
}

interface Transaction {
  id: string
  item_id: string
  item_name: string
  type: string
  quantity_change: number
  user_name: string
  created_at: string
}

interface TimeEntry {
  id: string
  user_id: string
  user_name: string
  user_role: string
  clock_in: string
  clock_out: string | null
  hours_worked: number | null
  created_at: string
}

interface AuditLog {
  id: string
  action: string
  user_id: string
  user_name: string
  user_role: string
  details: any
  created_at: string
}

type TabName = 'overview' | 'orders' | 'voice' | 'inventory' | 'timeclock' | 'audit'

export default function RestaurantDetail() {
  const router = useRouter()
  const { id } = router.query

  const [activeTab, setActiveTab] = useState<TabName>('overview')
  const [restaurantData, setRestaurantData] = useState<RestaurantData | null>(null)
  const [tabData, setTabData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isTabLoading, setIsTabLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const tabs = [
    { id: 'overview', name: 'Overview', icon: Building2 },
    { id: 'orders', name: 'Orders', icon: ShoppingCart },
    { id: 'voice', name: 'Voice Activity', icon: Mic },
    { id: 'inventory', name: 'Inventory', icon: Package },
    { id: 'timeclock', name: 'Time Clock', icon: Clock },
    { id: 'audit', name: 'Audit Logs', icon: FileText },
  ]

  const fetchRestaurantData = React.useCallback(async () => {
    if (!id) return
    
    setIsLoading(true)
    setError(null)
    try {
      const response = await api.get(`/api/admin/restaurants/${id}`)
      setRestaurantData(response.data)
    } catch (err: any) {
      console.error('Failed to fetch restaurant:', err)
      setError(err.response?.data?.message || 'Failed to load restaurant details')
    } finally {
      setIsLoading(false)
    }
  }, [id])

  const fetchTabData = React.useCallback(async (tab: TabName) => {
    if (!id || tab === 'overview') return

    setIsTabLoading(true)
    try {
      let endpoint = ''
      switch (tab) {
        case 'orders':
          endpoint = `/api/admin/restaurants/${id}/orders`
          break
        case 'voice':
          endpoint = `/api/admin/restaurants/${id}/voice-activity`
          break
        case 'inventory':
          endpoint = `/api/admin/restaurants/${id}/inventory-transactions`
          break
        case 'timeclock':
          endpoint = `/api/admin/restaurants/${id}/timeclock`
          break
        case 'audit':
          endpoint = `/api/admin/restaurants/${id}/audit-logs`
          break
      }

      const response = await api.get(endpoint, {
        params: { limit: 50, days: 30 }
      })
      setTabData(response.data)
    } catch (err: any) {
      console.error(`Failed to fetch ${tab} data:`, err)
      setTabData({ error: err.response?.data?.message || `Failed to load ${tab} data` })
    } finally {
      setIsTabLoading(false)
    }
  }, [id])

  useEffect(() => {
    if (id) {
      fetchRestaurantData()
    }
  }, [id, fetchRestaurantData])

  useEffect(() => {
    setTabData(null)
    fetchTabData(activeTab)
  }, [activeTab, id, fetchTabData])

  if (isLoading) {
    return (
      <AdminLayout title="Loading..." description="Loading restaurant details">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-64"></div>
            <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-96 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>
        </div>
      </AdminLayout>
    )
  }

  if (error || !restaurantData) {
    return (
      <AdminLayout title="Error" description="Failed to load restaurant">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center py-12">
            <AlertCircle className="mx-auto h-12 w-12 text-red-400" />
            <h3 className="mt-2 text-lg font-medium text-gray-900 dark:text-white">Error loading restaurant</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{error}</p>
            <div className="mt-6">
              <button
                onClick={fetchRestaurantData}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </button>
            </div>
          </div>
        </div>
      </AdminLayout>
    )
  }

  const restaurant = restaurantData.restaurant

  return (
    <AdminLayout 
      title={restaurant.name}
      description={`Manage ${restaurant.name} - ID: ${restaurant.id}`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <Link
              href="/admin/restaurants"
              className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Restaurants
            </Link>
          </div>
          <button
            onClick={fetchRestaurantData}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </button>
        </div>

        {/* Restaurant Info Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-6">
          <div className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-4">
                <div className="h-16 w-16 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
                  <Building2 className="h-8 w-8 text-red-600" />
                </div>
                <div>
                  <div className="flex items-center space-x-3">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                      {restaurant.name}
                    </h1>
                    {restaurant.is_active ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300">
                        <XCircle className="h-3 w-3 mr-1" />
                        Inactive
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">ID: {restaurant.id}</p>
                  <div className="mt-2 flex flex-wrap gap-4 text-sm text-gray-500 dark:text-gray-400">
                    {restaurant.email && (
                      <div className="flex items-center">
                        <Mail className="h-4 w-4 mr-1" />
                        {restaurant.email}
                      </div>
                    )}
                    {restaurant.phone && (
                      <div className="flex items-center">
                        <Phone className="h-4 w-4 mr-1" />
                        {restaurant.phone}
                      </div>
                    )}
                    {restaurant.address && (
                      <div className="flex items-center">
                        <MapPin className="h-4 w-4 mr-1" />
                        {restaurant.address}
                      </div>
                    )}
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 mr-1" />
                      Joined {new Date(restaurant.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Quick Stats */}
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                  <div className="text-lg font-semibold text-gray-900 dark:text-white">
                    {restaurant.user_count}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Users</div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                  <div className="text-lg font-semibold text-gray-900 dark:text-white">
                    {restaurant.total_orders.toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Total Orders</div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                  <div className="text-lg font-semibold text-gray-900 dark:text-white">
                    {restaurant.orders_today}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Today</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          {/* Tab Navigation */}
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="-mb-px flex overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabName)}
                  className={`whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                    activeTab === tab.id
                      ? 'border-red-500 text-red-600 dark:text-red-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                >
                  <tab.icon className="h-4 w-4" />
                  <span>{tab.name}</span>
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {isTabLoading ? (
              <div className="animate-pulse space-y-4">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
              </div>
            ) : (
              <TabContent 
                tab={activeTab} 
                restaurant={restaurant} 
                userBreakdown={restaurantData.userBreakdown}
                data={tabData} 
              />
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}

// Tab Content Component
interface TabContentProps {
  tab: TabName
  restaurant: Restaurant
  userBreakdown: UserBreakdown[]
  data: any
}

const TabContent: React.FC<TabContentProps> = ({ tab, restaurant, userBreakdown, data }) => {
  if (data?.error) {
    return (
      <div className="text-center py-8">
        <AlertCircle className="mx-auto h-8 w-8 text-red-400" />
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{data.error}</p>
      </div>
    )
  }

  switch (tab) {
    case 'overview':
      return <OverviewTab restaurant={restaurant} userBreakdown={userBreakdown} />
    case 'orders':
      return <OrdersTab orders={data?.orders || []} pagination={data?.pagination} />
    case 'voice':
      return <VoiceTab activity={data?.voiceActivity || []} pagination={data?.pagination} />
    case 'inventory':
      return <InventoryTab transactions={data?.transactions || []} pagination={data?.pagination} />
    case 'timeclock':
      return <TimeclockTab entries={data?.timeEntries || []} pagination={data?.pagination} />
    case 'audit':
      return <AuditTab logs={data?.auditLogs || []} pagination={data?.pagination} />
    default:
      return <div>Tab not implemented</div>
  }
}

// Individual Tab Components
const OverviewTab: React.FC<{ restaurant: Restaurant; userBreakdown: UserBreakdown[] }> = ({ 
  restaurant, 
  userBreakdown 
}) => (
  <div className="space-y-6">
    {/* Performance Metrics */}
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
        <div className="text-2xl font-bold text-blue-900 dark:text-blue-300">
          {restaurant.orders_7d}
        </div>
        <div className="text-sm text-blue-600 dark:text-blue-400">Orders (7 days)</div>
      </div>
      <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
        <div className="text-2xl font-bold text-green-900 dark:text-green-300">
          {restaurant.orders_30d}
        </div>
        <div className="text-sm text-green-600 dark:text-green-400">Orders (30 days)</div>
      </div>
      <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
        <div className="text-2xl font-bold text-purple-900 dark:text-purple-300">
          ${restaurant.revenue_30d?.toFixed(2) || '0.00'}
        </div>
        <div className="text-sm text-purple-600 dark:text-purple-400">Revenue (30 days)</div>
      </div>
      <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4">
        <div className="text-2xl font-bold text-orange-900 dark:text-orange-300">
          {restaurant.last_order_at ? 
            Math.floor((Date.now() - new Date(restaurant.last_order_at).getTime()) / (1000 * 60 * 60 * 24)) :
            'N/A'
          }
        </div>
        <div className="text-sm text-orange-600 dark:text-orange-400">Days since last order</div>
      </div>
    </div>

    {/* User Breakdown */}
    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6">
      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">User Breakdown</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {userBreakdown.map((breakdown) => (
          <div key={breakdown.role} className="bg-white dark:bg-gray-800 rounded-lg p-4">
            <div className="text-lg font-semibold text-gray-900 dark:text-white capitalize">
              {breakdown.role}s
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {breakdown.active_count} active / {breakdown.count} total
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
)

// Orders Tab Component
const OrdersTab: React.FC<{ orders: Order[]; pagination: any }> = ({ orders, pagination }) => (
  <div className="space-y-4">
    {orders.length > 0 ? (
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Order
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Customer
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Amount
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Date
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {orders.map((order) => (
              <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-6 py-4">
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    #{order.external_id || order.id}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {order.channel}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    order.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300' :
                    order.status === 'cancelled' ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300' :
                    'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300'
                  }`}>
                    {order.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                  {order.customer_name || 'Anonymous'}
                </td>
                <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                  ${order.total_amount?.toFixed(2) || '0.00'}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                  {new Date(order.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <div className="text-center py-8">
        <ShoppingCart className="mx-auto h-8 w-8 text-gray-400" />
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">No orders found</p>
      </div>
    )}
  </div>
)

// Voice Tab Component
const VoiceTab: React.FC<{ activity: VoiceActivity[]; pagination: any }> = ({ activity, pagination }) => (
  <div className="space-y-4">
    {activity.length > 0 ? (
      <div className="space-y-4">
        {activity.map((item) => (
          <div key={item.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex justify-between items-start">
              <div>
                <div className="font-medium text-gray-900 dark:text-white">{item.action}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {new Date(item.created_at).toLocaleString()}
                </div>
                {item.details && (
                  <pre className="text-xs text-gray-600 dark:text-gray-400 mt-2 bg-gray-50 dark:bg-gray-700 p-2 rounded overflow-x-auto">
                    {JSON.stringify(item.details, null, 2)}
                  </pre>
                )}
              </div>
              <Mic className="h-5 w-5 text-gray-400" />
            </div>
          </div>
        ))}
      </div>
    ) : (
      <div className="text-center py-8">
        <Mic className="mx-auto h-8 w-8 text-gray-400" />
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">No voice activity found</p>
      </div>
    )}
  </div>
)

// Inventory Tab Component  
const InventoryTab: React.FC<{ transactions: Transaction[]; pagination: any }> = ({ transactions, pagination }) => (
  <div className="space-y-4">
    {transactions.length > 0 ? (
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Item
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Change
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                User
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Date
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {transactions.map((transaction) => (
              <tr key={transaction.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                  {transaction.item_name}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                  {transaction.type}
                </td>
                <td className="px-6 py-4">
                  <span className={`text-sm font-medium ${
                    transaction.quantity_change > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                  }`}>
                    {transaction.quantity_change > 0 ? '+' : ''}{transaction.quantity_change}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                  {transaction.user_name}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                  {new Date(transaction.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <div className="text-center py-8">
        <Package className="mx-auto h-8 w-8 text-gray-400" />
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">No inventory transactions found</p>
      </div>
    )}
  </div>
)

// Time Clock Tab Component
const TimeclockTab: React.FC<{ entries: TimeEntry[]; pagination: any }> = ({ entries, pagination }) => (
  <div className="space-y-4">
    {entries.length > 0 ? (
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                User
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Clock In
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Clock Out
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Hours
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {entries.map((entry) => (
              <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-6 py-4">
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    {entry.user_name}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {entry.user_role}
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                  {new Date(entry.clock_in).toLocaleString()}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                  {entry.clock_out ? new Date(entry.clock_out).toLocaleString() : 'Still clocked in'}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                  {entry.hours_worked?.toFixed(2) || 'N/A'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <div className="text-center py-8">
        <Clock className="mx-auto h-8 w-8 text-gray-400" />
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">No time entries found</p>
      </div>
    )}
  </div>
)

// Audit Tab Component
const AuditTab: React.FC<{ logs: AuditLog[]; pagination: any }> = ({ logs, pagination }) => (
  <div className="space-y-4">
    {logs.length > 0 ? (
      <div className="space-y-4">
        {logs.map((log) => (
          <div key={log.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <span className="font-medium text-gray-900 dark:text-white">{log.action}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    by {log.user_name} ({log.user_role})
                  </span>
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {new Date(log.created_at).toLocaleString()}
                </div>
                {log.details && (
                  <pre className="text-xs text-gray-600 dark:text-gray-400 mt-2 bg-gray-50 dark:bg-gray-700 p-2 rounded overflow-x-auto">
                    {JSON.stringify(log.details, null, 2)}
                  </pre>
                )}
              </div>
              <FileText className="h-5 w-5 text-gray-400 flex-shrink-0" />
            </div>
          </div>
        ))}
      </div>
    ) : (
      <div className="text-center py-8">
        <FileText className="mx-auto h-8 w-8 text-gray-400" />
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">No audit logs found</p>
      </div>
    )}
  </div>
)