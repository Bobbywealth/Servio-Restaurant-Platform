import React, { useEffect, useMemo, useState } from 'react'
import Head from 'next/head'
import { motion } from 'framer-motion'
import dynamic from 'next/dynamic'
import { 
  Users, 
  Clock, 
  UserPlus,
  Search,
  Filter,
  MoreVertical,
  Edit3,
  Mail,
  DollarSign
} from 'lucide-react'
import { api } from '../../lib/api'

const DashboardLayout = dynamic(() => import('../../components/Layout/DashboardLayout'), {
  ssr: true,
  loading: () => <div className="min-h-screen bg-gray-50 animate-pulse" />
})

interface StaffUser {
  id: string
  name: string
  email?: string | null
  role: 'staff' | 'manager' | 'owner' | 'admin' | 'platform-admin'
  is_active: boolean
  created_at: string
  updated_at: string
}

interface CurrentStaff {
  user_id: string
  name: string
  role: string
  time_entry_id: string
  clock_in_time: string
  position?: string
  break_minutes: number
  is_on_break: boolean
  current_break_start?: string
  hours_worked: number
}

export default function StaffPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedRole, setSelectedRole] = useState('all')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [staff, setStaff] = useState<StaffUser[]>([])
  const [currentStaff, setCurrentStaff] = useState<CurrentStaff[]>([])
  const [hoursByUserId, setHoursByUserId] = useState<Record<string, number>>({})

  useEffect(() => {
    let isMounted = true

    const load = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const [staffResp, currentResp, statsResp] = await Promise.all([
          api.get('/api/restaurant/staff'),
          api.get('/api/timeclock/current-staff'),
          api.get('/api/timeclock/stats')
        ])

        const staffList = (staffResp.data?.data?.staff || []) as StaffUser[]
        const current = (currentResp.data?.data?.currentStaff || []) as CurrentStaff[]
        const userStats = (statsResp.data?.data?.userStats || []) as Array<{ user_id: string; total_hours: number }>

        const hoursMap: Record<string, number> = {}
        for (const s of userStats) {
          hoursMap[s.user_id] = Number(s.total_hours || 0)
        }

        if (!isMounted) return
        setStaff(staffList)
        setCurrentStaff(current)
        setHoursByUserId(hoursMap)
      } catch (e: any) {
        if (!isMounted) return
        const message =
          e?.response?.data?.error?.message ||
          e?.message ||
          'Failed to load staff data.'
        setError(message)
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    load()
    return () => {
      isMounted = false
    }
  }, [])

  const roles = useMemo(() => {
    const unique = Array.from(new Set(staff.map((s) => s.role))).sort()
    return ['all', ...unique]
  }, [staff])

  const currentByUserId = useMemo(() => {
    const m = new Map<string, CurrentStaff>()
    for (const s of currentStaff) m.set(s.user_id, s)
    return m
  }, [currentStaff])

  const getStatus = (userId: string) => {
    const active = currentByUserId.get(userId)
    if (!active) return 'off-shift'
    return active.is_on_break ? 'on-break' : 'on-shift'
  }

  const formatTime = (dateString: string) =>
    new Date(dateString).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })

  const initials = (name: string) =>
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('')

  const filteredStaff = staff.filter(member => {
    const q = searchTerm.trim().toLowerCase()
    const matchesSearch =
      !q ||
      member.name.toLowerCase().includes(q) ||
      (member.email || '').toLowerCase().includes(q)
    const matchesRole = selectedRole === 'all' || member.role === selectedRole
    return matchesSearch && matchesRole
  })

  const onShiftCount = currentStaff.filter((s) => !s.is_on_break).length
  const totalHours = Object.values(hoursByUserId).reduce((sum, v) => sum + Number(v || 0), 0)

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'on-shift':
        return 'status-success'
      case 'on-break':
        return 'status-warning'
      case 'off-shift':
        return 'status-neutral'
      default:
        return 'status-neutral'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'on-shift':
        return 'On Shift'
      case 'on-break':
        return 'On Break'
      case 'off-shift':
        return 'Off Shift'
      default:
        return 'Unknown'
    }
  }

  return (
    <>
      <Head>
        <title>Staff Management - Servio Restaurant Platform</title>
        <meta name="description" content="Manage restaurant staff, schedules, and shifts" />
      </Head>

      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-surface-900 dark:text-surface-100">
                Staff Management
              </h1>
              <p className="text-surface-600 dark:text-surface-400 mt-1">
                Manage team members, schedules, and shifts
              </p>
            </div>
            <motion.button
              className="btn-primary inline-flex items-center space-x-2"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              disabled
              title="Coming soon"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add Staff Member</span>
            </motion.button>
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3">
              {error}
            </div>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <motion.div
              className="card-hover"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <div className="flex items-center">
                <div className="p-3 rounded-xl bg-primary-500">
                  <Users className="h-6 w-6 text-white" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-surface-600 dark:text-surface-400">
                    Total Staff
                  </p>
                  <p className="text-2xl font-bold text-surface-900 dark:text-surface-100">
                    {staff.filter((s) => s.is_active).length}
                  </p>
                </div>
              </div>
            </motion.div>

            <motion.div
              className="card-hover"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <div className="flex items-center">
                <div className="p-3 rounded-xl bg-servio-green-500">
                  <Clock className="h-6 w-6 text-white" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-surface-600 dark:text-surface-400">
                    Currently On Shift
                  </p>
                  <p className="text-2xl font-bold text-surface-900 dark:text-surface-100">
                    {onShiftCount}
                  </p>
                </div>
              </div>
            </motion.div>

            <motion.div
              className="card-hover"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <div className="flex items-center">
                <div className="p-3 rounded-xl bg-servio-orange-500">
                  <DollarSign className="h-6 w-6 text-white" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-surface-600 dark:text-surface-400">
                    Total Hours This Week
                  </p>
                  <p className="text-2xl font-bold text-surface-900 dark:text-surface-100">
                    {Math.round(totalHours)}
                  </p>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-surface-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search staff members..."
                className="input-field pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-surface-500" />
              <select
                className="input-field"
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
              >
                {roles.map(role => (
                  <option key={role} value={role}>
                    {role === 'all' ? 'All Roles' : role}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Staff Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(isLoading ? [] : filteredStaff).map((member, index) => {
              const status = getStatus(member.id)
              const activeShift = currentByUserId.get(member.id)
              const shiftLabel = activeShift ? `${formatTime(activeShift.clock_in_time)} - Now` : '—'
              const hoursThisWeek = hoursByUserId[member.id] ?? 0

              return (
              <motion.div
                key={member.id}
                className="card-hover"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * index }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-primary-500 rounded-xl flex items-center justify-center text-white font-semibold">
                      {initials(member.name)}
                    </div>
                    <div>
                      <h3 className="font-semibold text-surface-900 dark:text-surface-100">
                        {member.name}
                      </h3>
                      <p className="text-sm text-surface-600 dark:text-surface-400">
                        {member.role}{!member.is_active ? ' • Inactive' : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`status-badge ${getStatusColor(status)}`}>
                      {getStatusText(status)}
                    </span>
                    <button className="btn-icon">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center space-x-2 text-sm text-surface-600 dark:text-surface-400">
                    <Mail className="w-4 h-4" />
                    <span>{member.email || '—'}</span>
                  </div>
                  <div className="flex items-center space-x-2 text-sm text-surface-600 dark:text-surface-400">
                    <Clock className="w-4 h-4" />
                    <span>{shiftLabel}</span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-surface-200 dark:border-surface-700">
                    <div>
                      <span className="text-sm text-surface-600 dark:text-surface-400">Role:</span>
                      <span className="ml-1 font-semibold text-surface-900 dark:text-surface-100">{member.role}</span>
                    </div>
                    <div>
                      <span className="text-sm text-surface-600 dark:text-surface-400">This week:</span>
                      <span className="ml-1 font-semibold text-surface-900 dark:text-surface-100">
                        {Number(hoursThisWeek || 0).toFixed(1)}h
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex space-x-2">
                  <button className="btn-secondary flex-1 text-sm" disabled title="Coming soon">
                    <Edit3 className="w-4 h-4 mr-1" />
                    Edit
                  </button>
                </div>
              </motion.div>
            )})}
          </div>

          {isLoading && (
            <div className="text-center py-12 text-surface-500">Loading staff…</div>
          )}

          {!isLoading && filteredStaff.length === 0 && (
            <motion.div
              className="text-center py-12"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <Users className="w-12 h-12 text-surface-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-surface-900 dark:text-surface-100 mb-2">
                No staff members found
              </h3>
              <p className="text-surface-600 dark:text-surface-400">
                Try adjusting your search or filter criteria
              </p>
            </motion.div>
          )}
        </div>
      </DashboardLayout>
    </>
  )
}