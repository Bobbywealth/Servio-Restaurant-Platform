import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { 
  Building2, 
  Search, 
  Filter,
  Eye,
  Users,
  ShoppingCart,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  AlertCircle
} from 'lucide-react'
import AdminLayout from '../../../components/Layout/AdminLayout'
import { api } from '../../../lib/api'
import { getErrorMessage } from '../../../lib/utils'

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
  last_order_at: string | null
  owner_count: number
}

interface RestaurantsResponse {
  restaurants: Restaurant[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

export default function RestaurantsList() {
  const [data, setData] = useState<RestaurantsResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)

  const fetchData = React.useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await api.get('/api/admin/restaurants', {
        params: {
          page,
          limit: 20,
          search: searchTerm || undefined,
          status: statusFilter === 'all' ? undefined : statusFilter
        }
      })
      setData(response.data)
    } catch (err: any) {
      console.error('Failed to fetch restaurants:', err)
      setError(getErrorMessage(err, 'Failed to load restaurants'))
    } finally {
      setIsLoading(false)
    }
  }, [page, searchTerm, statusFilter])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleSearch = (value: string) => {
    setSearchTerm(value)
    setPage(1) // Reset to first page when searching
  }

  const handleStatusFilter = (status: string) => {
    setStatusFilter(status)
    setPage(1) // Reset to first page when filtering
  }

  return (
    <AdminLayout title="Restaurants" description="Manage all restaurants on the Servio platform">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Restaurants</h1>
            <p className="text-gray-600 dark:text-gray-400">
              {data ? `${data.pagination.total} restaurants total` : 'Loading restaurants...'}
            </p>
          </div>
          <button
            onClick={fetchData}
            disabled={isLoading}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Search Restaurants
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Search by name or email..."
                  className="pl-10 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm focus:border-red-500 focus:ring-red-500"
                />
              </div>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => handleStatusFilter(e.target.value)}
                className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm focus:border-red-500 focus:ring-red-500"
              >
                <option value="all">All Restaurants</option>
                <option value="active">Active Only</option>
                <option value="inactive">Inactive Only</option>
              </select>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
            <div className="flex">
              <AlertCircle className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Error loading restaurants</h3>
                <div className="mt-2 text-sm text-red-700 dark:text-red-300">{error}</div>
              </div>
            </div>
          </div>
        )}

        {/* Restaurants Table */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Restaurant
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Users
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Orders
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Last Activity
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {isLoading ? (
                  // Loading rows
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-10 w-10 bg-gray-200 dark:bg-gray-700 rounded"></div>
                          <div className="ml-4 space-y-2">
                            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
                            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-12"></div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-16 ml-auto"></div>
                      </td>
                    </tr>
                  ))
                ) : data?.restaurants.map((restaurant, index) => (
                  <motion.tr
                    key={restaurant.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
                          <Building2 className="h-5 w-5 text-red-600" />
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {restaurant.name}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {restaurant.email || restaurant.slug}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
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
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-gray-900 dark:text-white">
                        <Users className="h-4 w-4 mr-1 text-gray-400" />
                        {restaurant.user_count}
                        {restaurant.owner_count > 0 && (
                          <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                            ({restaurant.owner_count} owners)
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-white">
                        <div className="flex items-center">
                          <ShoppingCart className="h-4 w-4 mr-1 text-gray-400" />
                          {restaurant.total_orders.toLocaleString()}
                        </div>
                        {restaurant.orders_today > 0 && (
                          <div className="text-xs text-green-600 dark:text-green-400">
                            +{restaurant.orders_today} today
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {restaurant.last_order_at ? (
                        <div className="flex items-center">
                          <Clock className="h-4 w-4 mr-1" />
                          {new Date(restaurant.last_order_at).toLocaleDateString()}
                        </div>
                      ) : (
                        <span className="text-gray-400">No orders yet</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Link
                        href={`/admin/restaurants/${restaurant.id}`}
                        className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-red-500"
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Link>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data && data.pagination.pages > 1 && (
            <div className="bg-white dark:bg-gray-800 px-4 py-3 border-t border-gray-200 dark:border-gray-700 sm:px-6">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-700 dark:text-gray-300">
                  Showing page {data.pagination.page} of {data.pagination.pages} 
                  ({data.pagination.total} total restaurants)
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setPage(page - 1)}
                    disabled={page <= 1}
                    className="px-3 py-1 text-sm border rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage(page + 1)}
                    disabled={page >= data.pagination.pages}
                    className="px-3 py-1 text-sm border rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Empty state */}
          {!isLoading && !data?.restaurants.length && (
            <div className="text-center py-12">
              <Building2 className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No restaurants found</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {searchTerm || statusFilter !== 'all' 
                  ? 'Try adjusting your search or filters.' 
                  : 'No restaurants have been registered yet.'
                }
              </p>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}