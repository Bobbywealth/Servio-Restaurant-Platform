/**
 * Admin Diagnostics Page
 * Shows system health, recent errors, and integration status
 */

import React, { useState, useEffect } from 'react'
import Head from 'next/head'
import { motion } from 'framer-motion'
import { Activity, AlertCircle, CheckCircle, XCircle, RefreshCw, Database, Server, Zap, Mail, Phone, CreditCard, History, Search, Filter, Download } from 'lucide-react'
import DashboardLayout from '../../components/Layout/DashboardLayout'

interface HealthCheck {
  status: 'healthy' | 'unhealthy' | 'degraded'
  message?: string
  latency?: number
}

interface IntegrationStatus {
  sms: HealthCheck
  email: HealthCheck
  voice: HealthCheck
  payment: HealthCheck
}

interface RecentError {
  id: string
  timestamp: string
  requestId: string
  level: 'error' | 'warning' | 'info'
  message: string
  statusCode?: number
  url?: string
}

interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  uptime: number
  version: string
  environment: string
  checks: {
    database: HealthCheck
    api: HealthCheck
    integrations: IntegrationStatus
    disk?: {
      status: 'healthy' | 'unhealthy'
      message?: string
      free?: string
      total?: string
    }
  }
}

export default function DiagnosticsPage() {
  const [health, setHealth] = useState<SystemHealth | null>(null)
  const [recentErrors, setRecentErrors] = useState<RecentError[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterLevel, setFilterLevel] = useState<'all' | 'error' | 'warning' | 'info'>('all')

  // Fetch health data
  useEffect(() => {
    fetchHealthData()
    fetchRecentErrors()

    // Refresh every 30 seconds
    const interval = setInterval(() => {
      fetchHealthData()
      fetchRecentErrors()
    }, 30000)

    return () => clearInterval(interval)
  }, [])

  const fetchHealthData = async () => {
    try {
      const response = await fetch('/api/health')
      const data = await response.json()
      setHealth(data)
    } catch (error) {
      console.error('Failed to fetch health data:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchRecentErrors = async () => {
    try {
      const response = await fetch('/api/admin/errors/recent')
      const data = await response.json()
      setRecentErrors(data.errors || [])
    } catch (error) {
      console.error('Failed to fetch recent errors:', error)
    }
  }

  const getStatusIcon = (status: 'healthy' | 'unhealthy' | 'degraded') => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-5 h-5 text-green-500" />
      case 'unhealthy':
        return <XCircle className="w-5 h-5 text-red-500" />
      case 'degraded':
        return <AlertCircle className="w-5 h-5 text-yellow-500" />
    }
  }

  const getStatusColor = (status: 'healthy' | 'unhealthy' | 'degraded') => {
    switch (status) {
      case 'healthy':
        return 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
      case 'unhealthy':
        return 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
      case 'degraded':
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400'
    }
  }

  const getIntegrationIcon = (name: string) => {
    switch (name) {
      case 'sms':
        return <Phone className="w-4 h-4" />
      case 'email':
        return <Mail className="w-4 h-4" />
      case 'voice':
        return <Zap className="w-4 h-4" />
      case 'payment':
        return <CreditCard className="w-4 h-4" />
    }
  }

  const getIntegrationColor = (status: HealthCheck) => {
    if (status.status === 'healthy') return 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
    if (status.status === 'degraded') return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400'
    return 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
  }

  const getLevelBadge = (level: string) => {
    switch (level) {
      case 'error':
        return <span className="px-2 py-1 text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full">Error</span>
      case 'warning':
        return <span className="px-2 py-1 text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 rounded-full">Warning</span>
      case 'info':
        return <span className="px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full">Info</span>
    }
  }

  const filteredErrors = recentErrors.filter(error => {
    const matchesSearch = searchTerm === '' ||
      error.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
      error.requestId.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesFilter = filterLevel === 'all' || error.level === filterLevel
    return matchesSearch && matchesFilter
  })

  return (
    <>
      <Head>
        <title>System Diagnostics - Servio</title>
        <meta name="description" content="Monitor system health, errors, and integration status" />
      </Head>

      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-surface-900 dark:text-surface-100">
                System Diagnostics
              </h1>
              <p className="text-surface-600 dark:text-surface-400 mt-1">
                Monitor system health, errors, and integration status
              </p>
            </div>
            <div className="flex items-center gap-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  fetchHealthData()
                  fetchRecentErrors()
                }}
                className="btn-secondary inline-flex items-center space-x-2"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Refresh</span>
              </motion.button>
            </div>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="text-center py-12">
              <RefreshCw className="w-8 h-8 text-surface-400 animate-spin mx-auto mb-4" />
              <p className="text-surface-600 dark:text-surface-400">Loading diagnostics...</p>
            </div>
          )}

          {!loading && health && (
            <>
              {/* Overall Status */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className={`rounded-xl p-6 ${
                  health.status === 'healthy' ? 'bg-green-50 dark:bg-green-900/20' :
                  health.status === 'degraded' ? 'bg-yellow-50 dark:bg-yellow-900/20' :
                  'bg-red-50 dark:bg-red-900/20'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`p-4 rounded-xl ${
                      health.status === 'healthy' ? 'bg-green-100 dark:bg-green-900/50' :
                      health.status === 'degraded' ? 'bg-yellow-100 dark:bg-yellow-900/50' :
                      'bg-red-100 dark:bg-red-900/50'
                    }`}>
                      {getStatusIcon(health.status)}
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-surface-900 dark:text-surface-100">
                        {health.status === 'healthy' ? 'System Healthy' :
                         health.status === 'degraded' ? 'System Degraded' :
                         'System Unhealthy'}
                      </h2>
                      <p className="text-surface-600 dark:text-surface-400">
                        Uptime: {formatUptime(health.uptime)} • Version: {health.version} • {health.environment}
                      </p>
                    </div>
                  </div>
                  <div className={`px-4 py-2 rounded-lg ${getStatusColor(health.status)}`}>
                    <span className="font-medium capitalize">{health.status}</span>
                  </div>
                </div>
              </motion.div>

              {/* Health Checks Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Database */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="bg-white dark:bg-surface-800 rounded-xl p-6 shadow-sm border border-surface-200 dark:border-surface-700"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900/50">
                      <Database className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <h3 className="font-semibold text-surface-900 dark:text-surface-100">Database</h3>
                  </div>
                  <div className={`flex items-center gap-2 ${getStatusColor(health.checks.database.status)}`}>
                    {getStatusIcon(health.checks.database.status)}
                    <span className="font-medium capitalize">{health.checks.database.status}</span>
                  </div>
                  {health.checks.database.latency && (
                    <p className="text-sm text-surface-600 dark:text-surface-400 mt-2">
                      Latency: {health.checks.database.latency}ms
                    </p>
                  )}
                  {health.checks.database.message && (
                    <p className="text-sm text-surface-600 dark:text-surface-400 mt-1">
                      {health.checks.database.message}
                    </p>
                  )}
                </motion.div>

                {/* API */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="bg-white dark:bg-surface-800 rounded-xl p-6 shadow-sm border border-surface-200 dark:border-surface-700"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-3 rounded-lg bg-purple-100 dark:bg-purple-900/50">
                      <Server className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <h3 className="font-semibold text-surface-900 dark:text-surface-100">API</h3>
                  </div>
                  <div className={`flex items-center gap-2 ${getStatusColor(health.checks.api.status)}`}>
                    {getStatusIcon(health.checks.api.status)}
                    <span className="font-medium capitalize">{health.checks.api.status}</span>
                  </div>
                  {health.checks.api.message && (
                    <p className="text-sm text-surface-600 dark:text-surface-400 mt-2">
                      {health.checks.api.message}
                    </p>
                  )}
                </motion.div>

                {/* Disk */}
                {health.checks.disk && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="bg-white dark:bg-surface-800 rounded-xl p-6 shadow-sm border border-surface-200 dark:border-surface-700"
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-3 rounded-lg bg-orange-100 dark:bg-orange-900/50">
                        <Activity className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                      </div>
                      <h3 className="font-semibold text-surface-900 dark:text-surface-100">Disk</h3>
                    </div>
                    <div className={`flex items-center gap-2 ${getStatusColor(health.checks.disk.status)}`}>
                      {getStatusIcon(health.checks.disk.status)}
                      <span className="font-medium capitalize">{health.checks.disk.status}</span>
                    </div>
                    {health.checks.disk.free && (
                      <p className="text-sm text-surface-600 dark:text-surface-400 mt-2">
                        Free: {health.checks.disk.free}
                      </p>
                    )}
                    {health.checks.disk.total && (
                      <p className="text-sm text-surface-600 dark:text-surface-400">
                        Total: {health.checks.disk.total}
                      </p>
                    )}
                  </motion.div>
                )}
              </div>

              {/* Integration Status */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="bg-white dark:bg-surface-800 rounded-xl p-6 shadow-sm border border-surface-200 dark:border-surface-700"
              >
                <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-4">
                  Integration Status
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {Object.entries(health.checks.integrations).map(([name, status]) => (
                    <div
                      key={name}
                      className={`flex items-center gap-3 p-4 rounded-lg ${getIntegrationColor(status)}`}
                    >
                      {getIntegrationIcon(name)}
                      <div className="flex-1">
                        <p className="font-medium capitalize">{name}</p>
                        <p className="text-sm opacity-75 capitalize">{status.status}</p>
                      </div>
                      {getStatusIcon(status.status)}
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* Recent Errors */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="bg-white dark:bg-surface-800 rounded-xl p-6 shadow-sm border border-surface-200 dark:border-surface-700"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-100">
                    Recent Errors
                  </h3>
                  <div className="flex items-center gap-2">
                    <Search className="w-4 h-4 text-surface-400" />
                    <input
                      type="text"
                      placeholder="Search errors..."
                      className="input-field pl-8 w-48"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <Filter className="w-4 h-4 text-surface-400" />
                    <select
                      className="input-field"
                      value={filterLevel}
                      onChange={(e) => setFilterLevel(e.target.value as any)}
                    >
                      <option value="all">All Levels</option>
                      <option value="error">Errors</option>
                      <option value="warning">Warnings</option>
                      <option value="info">Info</option>
                    </select>
                  </div>
                </div>

                {filteredErrors.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                    <p className="text-surface-600 dark:text-surface-400">
                      No recent errors found
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {filteredErrors.map((error) => (
                      <div
                        key={error.id}
                        className="flex items-start gap-4 p-4 rounded-lg bg-gray-50 dark:bg-surface-900 border border-gray-200 dark:border-surface-700 hover:border-primary-500 dark:hover:border-primary-500 transition-colors"
                      >
                        <div className="flex-shrink-0">
                          {error.level === 'error' ? (
                            <XCircle className="w-5 h-5 text-red-500" />
                          ) : error.level === 'warning' ? (
                            <AlertCircle className="w-5 h-5 text-yellow-500" />
                          ) : (
                            <Activity className="w-5 h-5 text-blue-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {getLevelBadge(error.level)}
                            <span className="text-sm text-surface-500">
                              {new Date(error.timestamp).toLocaleString()}
                            </span>
                            {error.requestId && (
                              <span className="text-xs font-mono text-surface-400">
                                {error.requestId.slice(0, 8)}...
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-medium text-surface-900 dark:text-surface-100 mb-1">
                            {error.message}
                          </p>
                          {error.url && (
                            <p className="text-xs text-surface-500 font-mono">
                              {error.url}
                            </p>
                          )}
                          {error.statusCode && (
                            <p className="text-xs text-surface-500">
                              Status: {error.statusCode}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            </>
          )}
        </div>
      </DashboardLayout>
    </>
  )
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  return `${minutes}m`
}
