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
  MapPin,
  Megaphone,
  Settings
} from 'lucide-react'
import AdminLayout from '../../../components/Layout/AdminLayout'
import { api } from '../../../lib/api'
import { getErrorMessage, safeLocalStorage } from '../../../lib/utils'
import Modal from '../../../components/ui/Modal'

interface Restaurant {
  id: string
  name: string
  slug: string
  email: string
  phone: string
  address: string
  is_active: boolean
  created_at: string
  logo_url?: string
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


interface OverrideSummary {
  action: string
  actorName: string | null
  actorRole: string | null
  reason: string | null
  createdAt: string
}

interface OverridesData {
  lastOverrides: {
    phone: OverrideSummary | null
    integrations: OverrideSummary | null
  }
  disabledChannels: string[]
}

type TabName = 'overview' | 'orders' | 'campaigns' | 'inventory' | 'timeclock' | 'audit' | 'integrations' | 'phone'

export default function RestaurantDetail() {
  const router = useRouter()
  const { id } = router.query

  const [activeTab, setActiveTab] = useState<TabName>('overview')
  const [restaurantData, setRestaurantData] = useState<RestaurantData | null>(null)
  const [tabData, setTabData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isTabLoading, setIsTabLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentUserRole, setCurrentUserRole] = useState<string>('admin')

  const tabs = [
    { id: 'overview', name: 'Overview', icon: Building2 },
    { id: 'orders', name: 'Orders', icon: ShoppingCart },
    { id: 'campaigns', name: 'Campaigns', icon: Megaphone },
    { id: 'phone', name: 'Phone System', icon: Phone },
    { id: 'inventory', name: 'Inventory', icon: Package },
    { id: 'timeclock', name: 'Time Clock', icon: Clock },
    { id: 'audit', name: 'Audit Logs', icon: FileText },
    { id: 'integrations', name: 'Integrations', icon: Settings },
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
      setError(getErrorMessage(err, 'Failed to load restaurant details'))
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
        case 'campaigns':
          endpoint = `/api/admin/restaurants/${id}/campaigns`
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
        case 'integrations':
        case 'phone':
          // Read-only view, no endpoint needed
          return
      }

      const response = await api.get(endpoint, {
        params: { limit: 50, days: 30 }
      })
      setTabData(response.data)
    } catch (err: any) {
      console.error(`Failed to fetch ${tab} data:`, err)
      setTabData({ error: getErrorMessage(err, `Failed to load ${tab} data`) })
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

  useEffect(() => {
    const storedUser = safeLocalStorage.getItem('servio_user')
    if (!storedUser) return

    try {
      const parsed = JSON.parse(storedUser)
      if (parsed?.role) {
        setCurrentUserRole(parsed.role)
      }
    } catch (err) {
      console.warn('Failed to parse current user role', err)
    }
  }, [])

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
                {restaurant.logo_url ? (
                  <img
                    src={restaurant.logo_url}
                    alt={`${restaurant.name} logo`}
                    className="h-16 w-16 rounded-full object-cover"
                  />
                ) : (
                  <div className="h-16 w-16 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
                    <Building2 className="h-8 w-8 text-red-600" />
                  </div>
                )}
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
                currentUserRole={currentUserRole}
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
  currentUserRole: string
}

const TabContent: React.FC<TabContentProps> = ({ tab, restaurant, userBreakdown, data, currentUserRole }) => {
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
    case 'campaigns':
      return <CampaignsTab campaigns={data?.campaigns || []} pagination={data?.pagination} />
    case 'inventory':
      return <InventoryTab transactions={data?.transactions || []} pagination={data?.pagination} />
    case 'timeclock':
      return <TimeclockTab entries={data?.timeEntries || []} pagination={data?.pagination} />
    case 'audit':
      return <AuditTab logs={data?.auditLogs || []} pagination={data?.pagination} />
    case 'integrations':
      return <IntegrationsTab restaurant={restaurant} currentUserRole={currentUserRole} />
    case 'phone':
      return <PhoneSystemTab restaurant={restaurant} currentUserRole={currentUserRole} />
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

// Campaigns Tab Component
/**
 * API contract: GET /api/admin/restaurants/:id/campaigns
 * Response: { campaigns: Campaign[], pagination: { page, limit, total, pages } }
 */
interface Campaign {
  id: string
  name: string
  type: 'sms' | 'email'
  status: string
  message: string
  scheduled_at?: string
  sent_at?: string
  total_recipients: number
  successful_sends: number
  failed_sends: number
  created_at: string
}

const CampaignsTab: React.FC<{ campaigns: Campaign[]; pagination: any }> = ({ campaigns, pagination }) => (
  <div className="space-y-4">
    {campaigns.length > 0 ? (
      <div className="space-y-4">
        {campaigns.map((campaign) => (
          <div key={campaign.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-medium text-gray-900 dark:text-white">{campaign.name}</span>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    campaign.status === 'sent' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300' :
                    campaign.status === 'failed' ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300' :
                    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300'
                  }`}>
                    {campaign.status}
                  </span>
                  <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300">
                    {campaign.type.toUpperCase()}
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">{campaign.message}</p>
                <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                  <span>Recipients: {campaign.total_recipients}</span>
                  <span>Success: {campaign.successful_sends}</span>
                  {campaign.failed_sends > 0 && <span className="text-red-600">Failed: {campaign.failed_sends}</span>}
                  <span>Created: {new Date(campaign.created_at).toLocaleDateString()}</span>
                </div>
              </div>
              <Megaphone className="h-5 w-5 text-gray-400" />
            </div>
          </div>
        ))}
      </div>
    ) : (
      <div className="text-center py-8">
        <Megaphone className="mx-auto h-8 w-8 text-gray-400" />
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">No campaigns found</p>
      </div>
    )}
  </div>
)

// Integrations Tab Component
// Phone System Tab - Separate from in-app AI Assistant
const PhoneSystemTab: React.FC<{ restaurant: Restaurant; currentUserRole: string }> = ({ restaurant, currentUserRole }) => {
  const [vapiSettings, setVapiSettings] = useState<any>(null)
  const [overrides, setOverrides] = useState<OverridesData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [isOverrideSubmitting, setIsOverrideSubmitting] = useState(false)
  const [testResult, setTestResult] = useState<any>(null)
  const [overrideAction, setOverrideAction] = useState<'reconnect' | 'rotate-config' | null>(null)
  const [overrideReason, setOverrideReason] = useState('')
  const [overrideError, setOverrideError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    enabled: false,
    apiKey: '',
    webhookSecret: '',
    assistantId: '',
    phoneNumberId: '',
    phoneNumber: ''
  })

  const canRunOverrides = currentUserRole === 'platform-admin'

  useEffect(() => {
    loadVapiSettings()
    loadOverrides()
  }, [restaurant.id])

  const loadOverrides = async () => {
    try {
      const response = await api.get(`/api/admin/restaurants/${restaurant.id}/overrides`)
      setOverrides(response.data)
    } catch (err) {
      console.error('Failed to load override metadata', err)
    }
  }

  const loadVapiSettings = async () => {
    try {
      const response = await api.get(`/api/restaurants/${restaurant.id}/vapi`)
      setVapiSettings(response.data)
      setFormData({
        enabled: response.data.enabled || false,
        apiKey: '',
        webhookSecret: '',
        assistantId: response.data.assistantId || '',
        phoneNumberId: response.data.phoneNumberId || '',
        phoneNumber: response.data.phoneNumber || ''
      })
    } catch (err: any) {
      console.error('Failed to load Vapi settings:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const saveSettings = async () => {
    setIsSaving(true)
    try {
      await api.put(`/api/restaurants/${restaurant.id}/vapi`, formData)
      alert('Phone system settings saved successfully!')
      await loadVapiSettings()
    } catch (err: any) {
      alert(getErrorMessage(err, 'Failed to save settings'))
    } finally {
      setIsSaving(false)
    }
  }

  const testConnection = async () => {
    setIsTesting(true)
    setTestResult(null)
    try {
      const response = await api.post(`/api/restaurants/${restaurant.id}/vapi/test`)
      setTestResult({ success: true, data: response.data })
    } catch (err: any) {
      setTestResult({ success: false, error: getErrorMessage(err, 'Connection test failed') })
    } finally {
      setIsTesting(false)
    }
  }

  const runOverride = async () => {
    if (!overrideAction) return
    const trimmedReason = overrideReason.trim()
    if (!trimmedReason) {
      setOverrideError('Reason is required for admin overrides.')
      return
    }

    setIsOverrideSubmitting(true)
    setOverrideError(null)
    try {
      const endpoint = overrideAction === 'reconnect'
        ? `/api/admin/restaurants/${restaurant.id}/overrides/phone/reconnect`
        : `/api/admin/restaurants/${restaurant.id}/overrides/phone/rotate-config`

      await api.post(endpoint, { reason: trimmedReason })
      setOverrideAction(null)
      setOverrideReason('')
      await Promise.all([loadOverrides(), loadVapiSettings()])
    } catch (err: any) {
      setOverrideError(getErrorMessage(err, 'Failed to run override action'))
    } finally {
      setIsOverrideSubmitting(false)
    }
  }

  if (isLoading) {
    return <div className="text-center py-8">Loading phone system settings...</div>
  }

  const lastPhoneOverride = overrides?.lastOverrides?.phone

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-start">
          <Phone className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-3 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-blue-900 dark:text-blue-300">Phone System (Vapi) - For Incoming Customer Calls</h3>
            <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">This is separate from the in-app AI Assistant. Vapi handles incoming phone calls from customers who want to place orders by calling your restaurant.</p>
          </div>
        </div>
      </div>

      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-300">Admin override controls</h3>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">Overrides are restricted to platform-admin and require a reason for audit logging.</p>
            {lastPhoneOverride ? (
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-2">Last override by <span className="font-medium">{lastPhoneOverride.actorName || 'Unknown user'}</span> on {new Date(lastPhoneOverride.createdAt).toLocaleString()} — “{lastPhoneOverride.reason || 'No reason recorded'}”</p>
            ) : (
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-2">No phone override has been recorded yet.</p>
            )}
          </div>
          <div className="flex flex-col gap-2 w-full sm:w-auto">
            <button onClick={() => setOverrideAction('reconnect')} disabled={!canRunOverrides} className="px-3 py-2 bg-amber-600 text-white rounded-lg text-sm hover:bg-amber-700 disabled:opacity-50">Admin override: reconnect/check</button>
            <button onClick={() => setOverrideAction('rotate-config')} disabled={!canRunOverrides} className="px-3 py-2 bg-orange-600 text-white rounded-lg text-sm hover:bg-orange-700 disabled:opacity-50">Admin override: rotate service config</button>
            {!canRunOverrides && <p className="text-xs text-gray-600 dark:text-gray-400">Read-only for admin role.</p>}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Vapi Configuration</h3>
        <div className="space-y-4">
          <div className="flex items-center"><input type="checkbox" checked={formData.enabled} onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })} className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500" /><label className="ml-2 text-sm font-medium text-gray-900 dark:text-white">Enable Phone System</label></div>
          <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Vapi API Key {vapiSettings?.hasApiKey && <span className="text-green-600">(Configured)</span>}</label><input type="password" value={formData.apiKey} onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })} placeholder={vapiSettings?.hasApiKey ? '••••••••••••' : 'Enter your Vapi API key'} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" /></div>
          <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone Number ID</label><input type="text" value={formData.phoneNumberId} onChange={(e) => setFormData({ ...formData, phoneNumberId: e.target.value })} placeholder="e.g., 12345678-1234-1234-1234-123456789012" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" /></div>
          <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone Number (Display)</label><input type="text" value={formData.phoneNumber} onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })} placeholder="e.g., +1 (555) 123-4567" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" /></div>
          <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Assistant ID</label><input type="text" value={formData.assistantId} onChange={(e) => setFormData({ ...formData, assistantId: e.target.value })} placeholder="Optional - Vapi assistant ID" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" /></div>
          <div className="flex gap-3 pt-4"><button onClick={saveSettings} disabled={isSaving} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">{isSaving ? 'Saving...' : 'Save Settings'}</button><button onClick={testConnection} disabled={isTesting || !formData.enabled || !vapiSettings?.hasApiKey} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">{isTesting ? 'Testing...' : 'Test Connection'}</button></div>
          {testResult && <div className={`p-4 rounded-lg ${testResult.success ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}><div className={`text-sm ${testResult.success ? 'text-green-800 dark:text-green-300' : 'text-red-800 dark:text-red-300'}`}>{testResult.success ? '✓ Connection successful!' : '✗ ' + testResult.error}</div>{testResult.data && <div className="text-xs text-gray-600 dark:text-gray-400 mt-2">Phone: {testResult.data.phoneNumber}</div>}</div>}
        </div>
      </div>

      <Modal isOpen={Boolean(overrideAction)} onClose={() => { if (!isOverrideSubmitting) { setOverrideAction(null); setOverrideReason(''); setOverrideError(null) } }} title="Confirm admin override" description="Override actions are high impact and require a reason." size="md">
        <div className="space-y-4">
          <p className="text-sm text-gray-700 dark:text-gray-300">{overrideAction === 'rotate-config' ? 'Rotate/refresh phone service config for this restaurant?' : 'Trigger phone integration reconnection/check for this restaurant?'}</p>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reason (required)</label>
            <textarea value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} rows={3} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" placeholder="Document why this override is needed..." />
          </div>
          {overrideError && <p className="text-sm text-red-600">{overrideError}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={() => setOverrideAction(null)} className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600" disabled={isOverrideSubmitting}>Cancel</button>
            <button onClick={runOverride} className="px-3 py-2 rounded-lg bg-red-600 text-white disabled:opacity-50" disabled={isOverrideSubmitting}>{isOverrideSubmitting ? 'Submitting...' : 'Confirm override'}</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

const IntegrationsTab: React.FC<{ restaurant: Restaurant; currentUserRole: string }> = ({ restaurant, currentUserRole }) => {
  const [overrides, setOverrides] = useState<OverridesData | null>(null)
  const [isLoadingOverrides, setIsLoadingOverrides] = useState(true)
  const [overrideReason, setOverrideReason] = useState('')
  const [overrideError, setOverrideError] = useState<string | null>(null)
  const [overrideModal, setOverrideModal] = useState<'recheck' | 'disable-channel' | 'enable-channel' | null>(null)
  const [channelInput, setChannelInput] = useState('ubereats')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const canRunOverrides = currentUserRole === 'platform-admin'

  const loadOverrides = async () => {
    try {
      const response = await api.get(`/api/admin/restaurants/${restaurant.id}/overrides`)
      setOverrides(response.data)
    } catch (err) {
      console.error('Failed to load override metadata', err)
    } finally {
      setIsLoadingOverrides(false)
    }
  }

  useEffect(() => {
    loadOverrides()
  }, [restaurant.id])

  const submitOverride = async () => {
    const reason = overrideReason.trim()
    const channel = channelInput.trim().toLowerCase()
    if (!reason) {
      setOverrideError('Reason is required for admin overrides.')
      return
    }
    if ((overrideModal === 'disable-channel' || overrideModal === 'enable-channel') && !channel) {
      setOverrideError('Channel is required.')
      return
    }

    setIsSubmitting(true)
    setOverrideError(null)
    try {
      if (overrideModal === 'recheck') {
        await api.post(`/api/admin/restaurants/${restaurant.id}/overrides/integrations/recheck`, { reason })
      } else if (overrideModal === 'disable-channel') {
        await api.patch(`/api/admin/restaurants/${restaurant.id}/overrides/channels/${channel}`, { reason, disable: true })
      } else if (overrideModal === 'enable-channel') {
        await api.patch(`/api/admin/restaurants/${restaurant.id}/overrides/channels/${channel}`, { reason, disable: false })
      }

      setOverrideModal(null)
      setOverrideReason('')
      await loadOverrides()
    } catch (err: any) {
      setOverrideError(getErrorMessage(err, 'Failed to run override action'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const lastIntegrationOverride = overrides?.lastOverrides?.integrations

  return (
    <div className="space-y-6">
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-4"><div className="flex items-start"><AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mr-3 mt-0.5" /><div><h3 className="text-sm font-medium text-yellow-900 dark:text-yellow-300">Looking for Phone System?</h3><p className="text-xs text-yellow-700 dark:text-yellow-400 mt-1">Vapi phone configuration has been moved to the "Phone System" tab (not shown here to avoid confusion with in-app AI Assistant)</p></div></div></div>

      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-300">Integration admin overrides</h3>
            {isLoadingOverrides ? <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">Loading override history...</p> : lastIntegrationOverride ? <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">Last override by <span className="font-medium">{lastIntegrationOverride.actorName || 'Unknown user'}</span> on {new Date(lastIntegrationOverride.createdAt).toLocaleString()} — “{lastIntegrationOverride.reason || 'No reason recorded'}”</p> : <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">No integration override has been recorded yet.</p>}
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-2">Disabled channels: {overrides?.disabledChannels?.length ? overrides.disabledChannels.join(', ') : 'none'}</p>
          </div>
          <div className="flex flex-col gap-2 w-full sm:w-auto">
            <button onClick={() => setOverrideModal('recheck')} disabled={!canRunOverrides} className="px-3 py-2 bg-amber-600 text-white rounded-lg text-sm hover:bg-amber-700 disabled:opacity-50">Admin override: reconnect/check integrations</button>
            <button onClick={() => setOverrideModal('disable-channel')} disabled={!canRunOverrides} className="px-3 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-50">Admin override: disable channel</button>
            <button onClick={() => setOverrideModal('enable-channel')} disabled={!canRunOverrides} className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50">Admin override: enable channel</button>
            {!canRunOverrides && <p className="text-xs text-gray-600 dark:text-gray-400">Read-only for admin role.</p>}
          </div>
        </div>
      </div>

      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Other Integration Status</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg"><div><div className="font-medium text-gray-900 dark:text-white">Twilio</div><div className="text-sm text-gray-500 dark:text-gray-400">SMS and phone services</div></div><span className="px-3 py-1 text-sm font-medium rounded-full bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300">Active</span></div>
          <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg"><div><div className="font-medium text-gray-900 dark:text-white">Storage</div><div className="text-sm text-gray-500 dark:text-gray-400">File and image storage</div></div><span className="px-3 py-1 text-sm font-medium rounded-full bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300">Active</span></div>
        </div>
      </div>

      <Modal isOpen={Boolean(overrideModal)} onClose={() => { if (!isSubmitting) { setOverrideModal(null); setOverrideReason(''); setOverrideError(null) } }} title="Confirm admin override" description="A reason is mandatory and will be stored in audit logs." size="md">
        <div className="space-y-4">
          <p className="text-sm text-gray-700 dark:text-gray-300">{overrideModal === 'recheck' ? 'Trigger integration reconnect/check now?' : overrideModal === 'disable-channel' ? 'Temporarily disable a problematic channel?' : 'Re-enable a previously disabled channel?'}</p>
          {(overrideModal === 'disable-channel' || overrideModal === 'enable-channel') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Channel</label>
              <input type="text" value={channelInput} onChange={(e) => setChannelInput(e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" placeholder="e.g. doordash" />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reason (required)</label>
            <textarea value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} rows={3} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" placeholder="Document why this override is needed..." />
          </div>
          {overrideError && <p className="text-sm text-red-600">{overrideError}</p>}
          <div className="flex justify-end gap-2"><button onClick={() => setOverrideModal(null)} className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600" disabled={isSubmitting}>Cancel</button><button onClick={submitOverride} className="px-3 py-2 rounded-lg bg-red-600 text-white disabled:opacity-50" disabled={isSubmitting}>{isSubmitting ? 'Submitting...' : 'Confirm override'}</button></div>
        </div>
      </Modal>
    </div>
  )
}

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