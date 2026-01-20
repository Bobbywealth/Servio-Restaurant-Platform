import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Shield, Filter, Search, Building2, User, Calendar } from 'lucide-react'
import AdminLayout from '../../components/Layout/AdminLayout'
import { api } from '../../lib/api'
import { getErrorMessage } from '../../lib/utils'
import Link from 'next/link'

interface AuditLog {
  id: string
  restaurant_id?: string
  restaurant_name?: string
  user_id?: string
  user_name?: string
  user_role?: string
  action: string
  entity_type?: string
  entity_id?: string
  metadata?: string
  created_at: string
}

export default function AdminAudit() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [restaurantFilter, setRestaurantFilter] = useState<string>('all')
  const [actionFilter, setActionFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchLogs = async () => {
    setIsLoading(true)
    setError(null)
    try {
      // For now, we'll fetch all and filter client-side
      // In production, you'd want server-side filtering
      const response = await api.get('/api/admin/activity?limit=200')
      setLogs(response.data || [])
    } catch (err: any) {
      console.error('Failed to fetch audit logs:', err)
      setError(getErrorMessage(err, 'Failed to load audit logs'))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs()
  }, [])

  const filteredLogs = logs.filter(log => {
    if (restaurantFilter !== 'all' && log.restaurant_id !== restaurantFilter) return false
    if (actionFilter !== 'all' && !log.action.toLowerCase().includes(actionFilter.toLowerCase())) return false
    if (search && !(
      log.action.toLowerCase().includes(search.toLowerCase()) ||
      log.restaurant_name?.toLowerCase().includes(search.toLowerCase()) ||
      log.user_name?.toLowerCase().includes(search.toLowerCase()) ||
      log.entity_type?.toLowerCase().includes(search.toLowerCase())
    )) return false
    return true
  })

  const uniqueRestaurants = Array.from(new Set(logs.map(l => l.restaurant_id).filter(Boolean)))
  const uniqueActions = Array.from(new Set(logs.map(l => l.action.split('.')[0]).filter(Boolean)))

  return (
    <AdminLayout title="Audit Logs" description="Platform-wide audit trail and activity logs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Audit Logs</h1>
          <p className="text-gray-600 dark:text-gray-400">Complete audit trail of platform activity</p>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by action, restaurant, user, or entity..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={restaurantFilter}
              onChange={(e) => setRestaurantFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="all">All Restaurants</option>
              {uniqueRestaurants.map((id) => {
                const log = logs.find(l => l.restaurant_id === id)
                return (
                  <option key={id} value={id}>
                    {log?.restaurant_name || id}
                  </option>
                )
              })}
            </select>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="all">All Actions</option>
              {uniqueActions.map((action) => (
                <option key={action} value={action}>
                  {action}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
            <div className="flex">
              <Shield className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Error</h3>
                <div className="mt-2 text-sm text-red-700 dark:text-red-300">{error}</div>
              </div>
            </div>
          </div>
        )}

        {/* Audit Logs List */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-2"></div>
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          ) : filteredLogs.length ? (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredLogs.map((log, index) => (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.02 }}
                  className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-sm font-medium text-gray-900 dark:text-white">{log.action}</h3>
                        {log.entity_type && (
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300">
                            {log.entity_type}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mb-2">
                        {log.restaurant_id && (
                          <Link 
                            href={`/admin/restaurants/${log.restaurant_id}`}
                            className="flex items-center gap-1 hover:text-red-600"
                          >
                            <Building2 className="h-4 w-4" />
                            {log.restaurant_name || log.restaurant_id}
                          </Link>
                        )}
                        {log.user_name && (
                          <span className="flex items-center gap-1">
                            <User className="h-4 w-4" />
                            {log.user_name} {log.user_role && `(${log.user_role})`}
                          </span>
                        )}
                      </div>
                      {log.entity_id && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                          Entity ID: {log.entity_id}
                        </p>
                      )}
                      {log.metadata && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-mono bg-gray-50 dark:bg-gray-900/50 p-2 rounded mt-2">
                          {typeof log.metadata === 'string' ? log.metadata : JSON.stringify(log.metadata)}
                        </p>
                      )}
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(log.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center">
              <Shield className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No audit logs found</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {search ? 'Try adjusting your search or filters' : 'No audit logs match the selected filters'}
              </p>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}
