import React, { useEffect, useState } from 'react'
import Head from 'next/head'
import { motion } from 'framer-motion'
import dynamic from 'next/dynamic'
import {
  TrendingUp,
  Clock,
  Users,
  Calendar,
  Download,
  AlertTriangle,
  Filter,
  ChevronDown,
  ChevronRight
} from 'lucide-react'
import { api } from '../../lib/api'
import { EmptyState } from '../../components/ui/EmptyState'
import { Button } from '../../components/ui/Button'

const DashboardLayout = dynamic(() => import('../../components/Layout/DashboardLayout'), {
  ssr: true,
  loading: () => <div className="min-h-screen bg-gray-50 animate-pulse" />
})

interface AnalyticsData {
  summary: {
    totalShifts: number
    uniqueStaff: number
    totalHours: number
    totalBreakMinutes: number
    avgHoursPerShift: number
    dateRange: {
      start: string
      end: string
    }
  }
  userHours: Array<{
    user_id: string
    user_name: string
    user_role: string
    total_hours: number
    total_break_minutes: number
    shift_count: number
  }>
  dailyBreakdown: Array<{
    date: string
    shifts: number
    total_hours: number
    unique_staff: number
  }>
  hourlyStaffing: Array<{
    hour: number
    shifts_at_hour: number
  }>
  alerts: {
    overtimeCount: number
    overtimeShifts: any[]
    lateArrivalsCount: number
    lateArrivals: any[]
  }
}

interface TimeLog {
  id: string
  user_id: string
  user_name: string
  user_email: string
  user_role: string
  clock_in_time: string
  clock_out_time: string | null
  total_hours: number | null
  break_minutes: number
  position: string | null
  notes: string | null
  status: 'active' | 'completed'
}

export default function StaffAnalyticsPage() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [timeLogs, setTimeLogs] = useState<TimeLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showExportModal, setShowExportModal] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'completed'>('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const fetchAnalytics = async () => {
    try {
      const [analyticsResp, logsResp] = await Promise.all([
        api.get('/api/staff/analytics', {
          params: startDate && endDate ? { startDate, endDate } : undefined
        }),
        api.get('/api/staff/analytics/time-logs', {
          params: {
            limit: '100',
            ...(startDate && endDate ? { startDate, endDate } : {}),
            ...(filterStatus !== 'all' ? { status: filterStatus } : {})
          }
        })
      ])

      if (analyticsResp.data.success) {
        setAnalytics(analyticsResp.data.data)
      }
      if (logsResp.data.success) {
        setTimeLogs(logsResp.data.data.logs)
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAnalytics()
  }, [filterStatus, startDate, endDate])

  const handleExport = async (format: 'csv' | 'pdf', dateRange: { start: string; end: string }) => {
    setExporting(true)
    try {
      const resp = await api.post('/api/staff/analytics/export', {
        format,
        startDate: dateRange.start,
        endDate: dateRange.end
      })

      if (format === 'csv') {
        const url = window.URL.createObjectURL(new Blob([resp.data]))
        const a = document.createElement('a')
        a.href = url
        a.download = `staff-analytics-${new Date().toISOString().split('T')[0]}.csv`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
      }
      setShowExportModal(false)
    } catch (err: any) {
      alert('Export failed: ' + (err.response?.data?.error?.message || err.message))
    } finally {
      setExporting(false)
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[600px]">
          <div className="text-surface-600 dark:text-surface-400">Loading analytics...</div>
        </div>
      </DashboardLayout>
    )
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="max-w-md mx-auto mt-12">
          <EmptyState
            icon={AlertTriangle}
            title="Error Loading Analytics"
            description={error}
            action={{ label: 'Retry', onClick: fetchAnalytics }}
          />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <>
      <Head>
        <title>Staff Analytics - Servio Restaurant Platform</title>
        <meta name="description" content="View comprehensive staff performance analytics and time logs" />
      </Head>

      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-surface-900 dark:text-surface-100">
                Staff Analytics
              </h1>
              <p className="text-surface-600 dark:text-surface-400 mt-1">
                Track performance, hours, and attendance
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                icon={Filter}
                onClick={() => setShowExportModal(true)}
              >
                Export
              </Button>
            </div>
          </div>

          {/* Stats Cards */}
          {analytics && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <motion.div
                className="bg-white dark:bg-surface-800 rounded-2xl p-6 border border-surface-200 dark:border-surface-700"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-primary-500 rounded-xl">
                    <Users className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-sm text-surface-600 dark:text-surface-400">Total Shifts</p>
                    <p className="text-2xl font-bold text-surface-900 dark:text-surface-100">
                      {analytics.summary.totalShifts}
                    </p>
                  </div>
                </div>
              </motion.div>

              <motion.div
                className="bg-white dark:bg-surface-800 rounded-2xl p-6 border border-surface-200 dark:border-surface-700"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-servio-green-500 rounded-xl">
                    <Clock className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-sm text-surface-600 dark:text-surface-400">Total Hours</p>
                    <p className="text-2xl font-bold text-surface-900 dark:text-surface-100">
                      {Math.round(analytics.summary.totalHours)}h
                    </p>
                  </div>
                </div>
              </motion.div>

              <motion.div
                className="bg-white dark:bg-surface-800 rounded-2xl p-6 border border-surface-200 dark:border-surface-700"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-servio-orange-500 rounded-xl">
                    <TrendingUp className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-sm text-surface-600 dark:text-surface-400">Avg per Shift</p>
                    <p className="text-2xl font-bold text-surface-900 dark:text-surface-100">
                      {analytics.summary.avgHoursPerShift.toFixed(1)}h
                    </p>
                  </div>
                </div>
              </motion.div>

              <motion.div
                className="bg-white dark:bg-surface-800 rounded-2xl p-6 border border-surface-200 dark:border-surface-700"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-purple-500 rounded-xl">
                    <Calendar className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-sm text-surface-600 dark:text-surface-400">Active Staff</p>
                    <p className="text-2xl font-bold text-surface-900 dark:text-surface-100">
                      {analytics.summary.uniqueStaff}
                    </p>
                  </div>
                </div>
              </motion.div>
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 bg-white dark:bg-surface-800 rounded-2xl p-4 border border-surface-200 dark:border-surface-700">
            <div className="flex items-center gap-2 flex-1">
              <Calendar className="w-4 h-4 text-surface-400" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="flex-1 px-3 py-2 text-sm rounded-xl border border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100 focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all outline-none"
              />
            </div>
            <div className="flex items-center gap-2 flex-1">
              <Calendar className="w-4 h-4 text-surface-400" />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="flex-1 px-3 py-2 text-sm rounded-xl border border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100 focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all outline-none"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="px-3 py-2 text-sm rounded-xl border border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100 focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all outline-none"
            >
              <option value="all">All Status</option>
              <option value="active">Active Only</option>
              <option value="completed">Completed Only</option>
            </select>
          </div>

          {/* Alerts Section */}
          {analytics && (analytics.alerts.overtimeCount > 0 || analytics.alerts.lateArrivalsCount > 0) && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-6"
            >
              <h3 className="text-lg font-semibold text-amber-800 dark:text-amber-200 mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Alerts ({analytics.alerts.overtimeCount + analytics.alerts.lateArrivalsCount})
              </h3>
              <div className="grid md:grid-cols-2 gap-4">
                {analytics.alerts.overtimeCount > 0 && (
                  <div>
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-2">
                      Overtime Shifts ({analytics.alerts.overtimeCount})
                    </p>
                    <div className="space-y-1">
                      {analytics.alerts.overtimeShifts.slice(0, 3).map((shift) => (
                        <div key={shift.id} className="text-xs text-amber-700 dark:text-amber-300">
                          {shift.user_name} - {shift.total_hours.toFixed(1)}h
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {analytics.alerts.lateArrivalsCount > 0 && (
                  <div>
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-2">
                      Late Arrivals ({analytics.alerts.lateArrivalsCount})
                    </p>
                    <div className="space-y-1">
                      {analytics.alerts.lateArrivals.slice(0, 3).map((arrival) => (
                        <div key={arrival.id} className="text-xs text-amber-700 dark:text-amber-300">
                          {arrival.user_name} - {new Date(arrival.clock_in_time).toLocaleTimeString()}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Time Logs Table */}
          <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-surface-200 dark:border-surface-700">
              <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-100">
                Time Logs ({timeLogs.length})
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-surface-50 dark:bg-surface-900/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-surface-600 dark:text-surface-400 uppercase tracking-wider">
                      Staff
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-surface-600 dark:text-surface-400 uppercase tracking-wider">
                      Clock In
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-surface-600 dark:text-surface-400 uppercase tracking-wider">
                      Clock Out
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-surface-600 dark:text-surface-400 uppercase tracking-wider">
                      Hours
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-surface-600 dark:text-surface-400 uppercase tracking-wider">
                      Break
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-surface-600 dark:text-surface-400 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
                  {timeLogs.map((log, index) => (
                    <motion.tr
                      key={log.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="hover:bg-surface-50 dark:hover:bg-surface-700/50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-surface-900 dark:text-surface-100">
                            {log.user_name}
                          </p>
                          <p className="text-xs text-surface-600 dark:text-surface-400">
                            {log.user_role}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-surface-700 dark:text-surface-200">
                        {new Date(log.clock_in_time).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-sm text-surface-700 dark:text-surface-200">
                        {log.clock_out_time ? new Date(log.clock_out_time).toLocaleString() : '—'}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-surface-900 dark:text-surface-100">
                        {log.total_hours ? `${log.total_hours.toFixed(1)}h` : '—'}
                      </td>
                      <td className="px-6 py-4 text-sm text-surface-700 dark:text-surface-200">
                        {log.break_minutes}m
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                          log.status === 'active'
                            ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                            : 'bg-slate-100 dark:bg-slate-900/30 text-slate-700 dark:text-slate-400'
                        }`}>
                          {log.status === 'active' ? 'Active' : 'Completed'}
                        </span>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
            {timeLogs.length === 0 && (
              <div className="text-center py-12">
                <Clock className="w-12 h-12 text-surface-400 mx-auto mb-4" />
                <p className="text-surface-600 dark:text-surface-400">
                  No time logs found for the selected filters
                </p>
              </div>
            )}
          </div>
        </div>
      </DashboardLayout>
    </>
  )
}
