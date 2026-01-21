import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Activity, AlertTriangle, CheckCircle2, XCircle, RefreshCw, Server, Database, Zap } from 'lucide-react'
import AdminLayout from '../../components/Layout/AdminLayout'
import { api } from '../../lib/api'
import { getErrorMessage } from '../../lib/utils'

interface SystemHealth {
  status: string
  apiUp?: boolean
  dbConnected?: boolean
  worker?: {
    healthy: boolean
    lastSeenAt: string | null
  }
  jobBacklogCount?: number
  errorRateLast1h?: number
  lastVapiCallLogReceivedAt?: string | null
  lastOrderCreatedAt?: string | null
  lastNotificationCreatedAt?: string | null
  failedJobs: number
  recentErrors: Array<{
    action: string
    entity_type?: string
    entity_id?: string
    restaurant_id?: string
    created_at: string
  }>
  storageErrors: Array<any>
  timestamp: string
}

interface Job {
  id: string
  restaurant_id?: string
  restaurant_name?: string
  job_type: string
  status: string
  error_message?: string
  created_at: string
}

export default function SystemHealth() {
  const [health, setHealth] = useState<SystemHealth | null>(null)
  const [failedJobs, setFailedJobs] = useState<Job[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchHealth = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [healthResponse, jobsResponse] = await Promise.all([
        api.get('/api/admin/system/health'),
        api.get('/api/admin/jobs?status=failed&limit=20')
      ])
      setHealth(healthResponse.data)
      setFailedJobs(jobsResponse.data.jobs || [])
    } catch (err: any) {
      console.error('Failed to fetch system health:', err)
      setError(getErrorMessage(err, 'Failed to load system health'))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchHealth()
    const interval = setInterval(fetchHealth, 30000) // Refresh every 30 seconds
    return () => clearInterval(interval)
  }, [])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'operational':
        return <CheckCircle2 className="h-6 w-6 text-green-600" />
      case 'degraded':
        return <AlertTriangle className="h-6 w-6 text-yellow-600" />
      case 'down':
        return <XCircle className="h-6 w-6 text-red-600" />
      default:
        return <Activity className="h-6 w-6 text-gray-600" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'operational':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300'
      case 'degraded':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300'
      case 'down':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300'
    }
  }

  return (
    <AdminLayout title="System Health" description="Platform health monitoring and diagnostics">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">System Health</h1>
            <p className="text-gray-600 dark:text-gray-400">Monitor platform status and service health</p>
          </div>
          <button
            onClick={fetchHealth}
            disabled={isLoading}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
            <div className="flex">
              <AlertTriangle className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Error</h3>
                <div className="mt-2 text-sm text-red-700 dark:text-red-300">{error}</div>
              </div>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 animate-pulse">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-4"></div>
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : health && (
          <>
            {/* Status Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-gray-800 rounded-lg shadow p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Overall Status</h3>
                  {getStatusIcon(health.status)}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(health.status)}`}>
                    {health.status.charAt(0).toUpperCase() + health.status.slice(1)}
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Last updated: {new Date(health.timestamp).toLocaleString()}
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white dark:bg-gray-800 rounded-lg shadow p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Failed Jobs</h3>
                  <Database className="h-5 w-5 text-gray-400" />
                </div>
                <div className="text-3xl font-bold text-gray-900 dark:text-white">
                  {health.failedJobs}
                </div>
                {health.failedJobs > 0 && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                    Action required
                  </p>
                )}
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white dark:bg-gray-800 rounded-lg shadow p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Recent Errors</h3>
                  <AlertTriangle className="h-5 w-5 text-gray-400" />
                </div>
                <div className="text-3xl font-bold text-gray-900 dark:text-white">
                  {health.recentErrors.length}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Last 24 hours
                </p>
              </motion.div>
            </div>

            {/* System Checks */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">API</h3>
                  <Server className="h-5 w-5 text-gray-400" />
                </div>
                <div className="text-sm text-gray-900 dark:text-white">
                  {health.apiUp === false ? 'Down' : 'Up'}
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Database</h3>
                  <Database className="h-5 w-5 text-gray-400" />
                </div>
                <div className="text-sm text-gray-900 dark:text-white">
                  {health.dbConnected === false ? 'Disconnected' : 'Connected'}
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Worker Heartbeat</h3>
                  <Zap className="h-5 w-5 text-gray-400" />
                </div>
                <div className="text-sm text-gray-900 dark:text-white">
                  {health.worker?.healthy ? 'Healthy' : 'Stale / Missing'}
                </div>
                {health.worker?.lastSeenAt && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    Last seen: {new Date(health.worker.lastSeenAt).toLocaleString()}
                  </p>
                )}
              </div>
            </div>

            {/* Last-seen + rates */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Job Backlog</h3>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {health.jobBacklogCount ?? 0}
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Error rate (last 1h)</h3>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {((health.errorRateLast1h ?? 0) * 100).toFixed(1)}%
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Last Vapi call log</h3>
                  <div className="text-sm text-gray-900 dark:text-white">
                    {health.lastVapiCallLogReceivedAt ? new Date(health.lastVapiCallLogReceivedAt).toLocaleString() : '—'}
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Last order created</h3>
                  <div className="text-sm text-gray-900 dark:text-white">
                    {health.lastOrderCreatedAt ? new Date(health.lastOrderCreatedAt).toLocaleString() : '—'}
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Last notification created</h3>
                  <div className="text-sm text-gray-900 dark:text-white">
                    {health.lastNotificationCreatedAt ? new Date(health.lastNotificationCreatedAt).toLocaleString() : '—'}
                  </div>
                </div>
              </div>
            </div>

            {/* Failed Jobs */}
            {failedJobs.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-8">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                  <h2 className="text-lg font-medium text-gray-900 dark:text-white">Failed Jobs</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Sync jobs that have failed</p>
                </div>
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {failedJobs.map((job, index) => (
                    <motion.div
                      key={job.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-sm font-medium text-gray-900 dark:text-white">{job.job_type}</h3>
                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300">
                              {job.status}
                            </span>
                          </div>
                          {job.restaurant_name && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                              Restaurant: {job.restaurant_name}
                            </p>
                          )}
                          {job.error_message && (
                            <p className="text-sm text-red-600 dark:text-red-400 mt-2">
                              {job.error_message}
                            </p>
                          )}
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                            {new Date(job.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Errors */}
            {health.recentErrors.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                  <h2 className="text-lg font-medium text-gray-900 dark:text-white">Recent Errors</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Error events from audit logs</p>
                </div>
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {health.recentErrors.map((err, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="text-sm font-medium text-gray-900 dark:text-white">{err.action}</h3>
                          {err.entity_type && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                              Entity: {err.entity_type} {err.entity_id && `(${err.entity_id})`}
                            </p>
                          )}
                          {err.restaurant_id && (
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              Restaurant: {err.restaurant_id}
                            </p>
                          )}
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                            {new Date(err.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {health.failedJobs === 0 && health.recentErrors.length === 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
                <CheckCircle2 className="mx-auto h-12 w-12 text-green-600" />
                <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">All systems operational</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  No failed jobs or errors detected
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  )
}
