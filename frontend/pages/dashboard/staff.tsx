import React, { useEffect, useMemo, useState } from 'react'
import Head from 'next/head'
import { motion, AnimatePresence } from 'framer-motion'
import dynamic from 'next/dynamic'
import {
  Users,
  Clock,
  Calendar,
  Coffee,
  UserPlus,
  Search,
  Filter,
  MoreVertical,
  Edit3,
  Mail,
  DollarSign,
  LogIn,
  Smartphone,
  X,
  Loader2,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  History
} from 'lucide-react'
import { api } from '../../lib/api'
import { StaffCard, HoursEditorModal, QuickTimeActionModal } from '../../components/staff'
import { showToast } from '../../components/ui/Toast'

const DashboardLayout = dynamic(() => import('../../components/Layout/DashboardLayout'), {
  ssr: true,
  loading: () => <div className="min-h-screen bg-gray-50 animate-pulse" />
})

interface StaffUser {
  id: string
  name: string
  email?: string | null
  role: 'staff' | 'manager' | 'owner' | 'admin' | 'platform-admin'
  pin?: string | null
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

// Daily hours breakdown type
interface DailyHours {
  userDailyHours: Record<string, Record<string, number>>
  userCurrentHours: Record<string, number>
  weekStartDate: string
}

// Add Staff Modal
interface AddStaffModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

function AddStaffModal({ isOpen, onClose, onSuccess }: AddStaffModalProps) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'staff' | 'manager'>('staff')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [createdStaff, setCreatedStaff] = useState<{ name: string; pin: string } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const response = await api.post('/api/restaurant/staff', {
        name,
        email: email || undefined,
        role
      })

      if (response.data.success) {
        setCreatedStaff({
          name: response.data.data.name,
          pin: response.data.data.pin
        })
        setSuccess(true)
        setTimeout(() => {
          onSuccess()
          onClose()
          resetForm()
        }, 3000)
      } else {
        setError(response.data.error?.message || 'Failed to create staff member')
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to create staff member')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setName('')
    setEmail('')
    setRole('staff')
    setError(null)
    setSuccess(false)
    setCreatedStaff(null)
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={handleClose}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative bg-white dark:bg-surface-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-surface-700">
            <h2 className="text-xl font-bold text-surface-900 dark:text-surface-100">
              Add Staff Member
            </h2>
            <button
              onClick={handleClose}
              className="p-2 text-surface-400 hover:text-surface-600 dark:hover:text-surface-200 rounded-lg hover:bg-gray-100 dark:hover:bg-surface-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            {success && createdStaff ? (
              <div className="text-center py-6">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-green-500" />
                </div>
                <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-2">
                  Staff Member Created!
                </h3>
                <p className="text-surface-600 dark:text-surface-400 mb-4">
                  {createdStaff.name} has been added successfully.
                </p>
                <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-4 mb-4">
                  <p className="text-sm text-orange-800 dark:text-orange-200 mb-1">
                    Their PIN is:
                  </p>
                  <p className="text-3xl font-bold text-orange-600 dark:text-orange-400 font-mono">
                    {createdStaff.pin}
                  </p>
                </div>
                <p className="text-xs text-surface-500">
                  Please save this PIN. It will only be shown once.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 dark:bg-red-900/20 px-4 py-3 rounded-xl">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    placeholder="John Doe"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-surface-600 bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100 focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-all outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="john@restaurant.com"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-surface-600 bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100 focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-all outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                    Role
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as 'staff' | 'manager')}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-surface-600 bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100 focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-all outline-none"
                  >
                    <option value="staff">Staff</option>
                    <option value="manager">Manager</option>
                  </select>
                </div>

                <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-orange-100 dark:bg-orange-900/50 rounded-lg flex items-center justify-center flex-shrink-0">
                      <LogIn className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-orange-800 dark:text-orange-200">
                        Auto-Generated PIN
                      </p>
                      <p className="text-xs text-orange-600 dark:text-orange-300 mt-1">
                        A unique 4-digit PIN will be automatically generated for this staff member to clock in.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="flex-1 px-4 py-3 rounded-xl border border-gray-200 dark:border-surface-600 text-surface-700 dark:text-surface-300 font-medium hover:bg-gray-50 dark:hover:bg-surface-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading || !name.trim()}
                    className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white font-medium hover:from-orange-600 hover:to-orange-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-5 h-5" />
                        Add Staff Member
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}

// Edit Staff Modal
interface EditStaffModalProps {
  isOpen: boolean
  staffMember: StaffUser | null
  onClose: () => void
  onSuccess: () => void
}

function EditStaffModal({ isOpen, staffMember, onClose, onSuccess }: EditStaffModalProps) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'staff' | 'manager'>('staff')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Initialize form when modal opens with staff member
  useEffect(() => {
    if (staffMember) {
      setName(staffMember.name || '')
      setEmail(staffMember.email || '')
      setRole(staffMember.role as 'staff' | 'manager' || 'staff')
      setError(null)
    }
  }, [staffMember, isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!staffMember) return

    setSaving(true)
    setError(null)

    try {
      const response = await api.put(`/api/restaurant/staff/${staffMember.id}`, {
        name,
        email: email || undefined,
        role
      })

      if (response.data.success) {
        onSuccess()
        onClose()
      } else {
        setError(response.data.error?.message || 'Failed to update staff member')
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to update staff member')
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    setError(null)
    onClose()
  }

  const handleResetPin = async () => {
    if (!staffMember) return

    setLoading(true)
    setError(null)

    try {
      const response = await api.post(`/api/restaurant/staff/${staffMember.id}/reset-pin`, {})

      if (response.data.success) {
        alert(`PIN reset to: ${response.data.data.pin}`)
      } else {
        setError(response.data.error?.message || 'Failed to reset PIN')
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to reset PIN')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen || !staffMember) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={handleClose}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative bg-white dark:bg-surface-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-surface-700">
            <h2 className="text-xl font-bold text-surface-900 dark:text-surface-100">
              Edit Staff Member
            </h2>
            <button
              onClick={handleClose}
              className="p-2 text-surface-400 hover:text-surface-600 dark:hover:text-surface-200 rounded-lg hover:bg-gray-100 dark:hover:bg-surface-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            {error && (
              <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 dark:bg-red-900/20 px-4 py-3 rounded-xl mb-4">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-surface-600 bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100 focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-all outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="john@restaurant.com"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-surface-600 bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100 focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-all outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                  Role
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as 'staff' | 'manager')}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-surface-600 bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100 focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-all outline-none"
                >
                  <option value="staff">Staff</option>
                  <option value="manager">Manager</option>
                </select>
              </div>

              <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-orange-100 dark:bg-orange-900/50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <RefreshCw className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-orange-800 dark:text-orange-200">
                      Reset PIN
                    </p>
                    <p className="text-xs text-orange-600 dark:text-orange-300 mt-1 mb-2">
                      Generate a new 4-digit PIN for this staff member.
                    </p>
                    <button
                      type="button"
                      onClick={handleResetPin}
                      disabled={loading}
                      className="px-3 py-1.5 text-xs font-medium bg-orange-100 dark:bg-orange-900/50 text-orange-600 dark:text-orange-400 rounded-lg hover:bg-orange-200 dark:hover:bg-orange-900/70 transition-colors disabled:opacity-50"
                    >
                      {loading ? 'Resetting...' : 'Reset PIN'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 px-4 py-3 rounded-xl border border-gray-200 dark:border-surface-600 text-surface-700 dark:text-surface-300 font-medium hover:bg-gray-50 dark:hover:bg-surface-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !name.trim()}
                  className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white font-medium hover:from-orange-600 hover:to-orange-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}

export default function StaffPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedRole, setSelectedRole] = useState('all')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [staff, setStaff] = useState<StaffUser[]>([])
  const [currentStaff, setCurrentStaff] = useState<CurrentStaff[]>([])
  const [hoursByUserId, setHoursByUserId] = useState<Record<string, number>>({})
  const [todayHoursByUserId, setTodayHoursByUserId] = useState<Record<string, number>>({})
  const [dailyHours, setDailyHours] = useState<DailyHours | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingStaff, setEditingStaff] = useState<StaffUser | null>(null)
  const [hoursEditorStaff, setHoursEditorStaff] = useState<StaffUser | null>(null)
  const [viewingHistoryStaff, setViewingHistoryStaff] = useState<StaffUser | null>(null)
  const [quickActionStaff, setQuickActionStaff] = useState<StaffUser | null>(null)
  const [quickActionType, setQuickActionType] = useState<'clock-in' | 'clock-out' | 'start-break' | 'end-break'>('clock-in')
  const [openMenu, setOpenMenu] = useState<string | null>(null)

  // Get week dates for the bar chart
  const getWeekDates = () => {
    const now = new Date()
    const dayOfWeek = now.getDay()
    const monday = new Date(now)
    monday.setDate(now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1))

    const dates: string[] = []
    for (let i = 0; i < 7; i++) {
      const date = new Date(monday)
      date.setDate(monday.getDate() + i)
      dates.push(date.toISOString().split('T')[0])
    }
    return dates
  }

  const weekDates = getWeekDates()

  useEffect(() => {
    let isMounted = true

    const load = async () => {
      setIsLoading(true)
      setError(null)
      try {
        // Fetch staff data
        const staffResp = await api.get('/api/restaurant/staff')
        const staffList = (staffResp.data?.data?.staff || []) as StaffUser[]

        if (!isMounted) return
        setStaff(staffList)

        // Fetch timeclock data separately
        try {
          const currentResp = await api.get('/api/timeclock/current-staff')
          const current = (currentResp.data?.data?.currentStaff || []) as CurrentStaff[]
          if (isMounted) setCurrentStaff(current)
        } catch (timeclockError) {
          console.warn('Failed to load current staff timeclock data:', timeclockError)
        }

        try {
          const statsResp = await api.get('/api/timeclock/stats')
          const userStats = (statsResp.data?.data?.userStats || []) as Array<{ user_id: string; total_hours: number }>
          const hoursMap: Record<string, number> = {}
          for (const s of userStats) {
            hoursMap[s.user_id] = Number(s.total_hours || 0)
          }
          if (isMounted) setHoursByUserId(hoursMap)
        } catch (statsError) {
          console.warn('Failed to load timeclock stats:', statsError)
        }

        // Fetch today's hours for each staff member
        try {
          const todayResp = await api.get('/api/timeclock/staff-hours')
          const todayHours = (todayResp.data?.data?.staffHours || []) as Array<{ userId: string; todayHours: number }>
          const todayHoursMap: Record<string, number> = {}
          for (const s of todayHours) {
            todayHoursMap[s.userId] = s.todayHours
          }
          if (isMounted) setTodayHoursByUserId(todayHoursMap)
        } catch (todayError) {
          console.warn('Failed to load today hours:', todayError)
        }

        // Fetch daily hours breakdown for the week
        try {
          const dailyResp = await api.get('/api/timeclock/user-daily-hours')
          if (isMounted) setDailyHours(dailyResp.data?.data || null)
        } catch (dailyError) {
          console.warn('Failed to load daily hours:', dailyError)
        }
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

  const handleStaffCreated = () => {
    // Reload staff data
    const load = async () => {
      try {
        const staffResp = await api.get('/api/restaurant/staff')
        setStaff(staffResp.data?.data?.staff || [])
      } catch (e) {
        console.error('Failed to reload staff:', e)
      }
    }
    load()
  }

  // Clock action handlers
  const handleClockIn = async (userId: string) => {
    try {
      const response = await api.post('/api/timeclock/manager/clock-in', {
        userId,
        managerId: 'current-user'
      })

      if (response.data.success) {
        // Refresh current staff data
        const currentResp = await api.get('/api/timeclock/current-staff')
        setCurrentStaff(currentResp.data?.data?.currentStaff || [])
        showToast.success(`${response.data.data.userName} clocked in successfully`)
      }
    } catch (err: any) {
      console.error('Failed to clock in:', err)
      showToast.error(err.response?.data?.error?.message || 'Failed to clock in staff member')
      throw err
    }
  }

  const handleClockOut = async (userId: string) => {
    try {
      const response = await api.post('/api/timeclock/manager/clock-out', {
        userId,
        managerId: 'current-user'
      })

      if (response.data.success) {
        // Refresh current staff data
        const currentResp = await api.get('/api/timeclock/current-staff')
        setCurrentStaff(currentResp.data?.data?.currentStaff || [])

        // Refresh today's hours
        const todayResp = await api.get('/api/timeclock/staff-hours')
        const todayHours = (todayResp.data?.data?.staffHours || []) as Array<{ userId: string; todayHours: number }>
        const todayHoursMap: Record<string, number> = {}
        for (const s of todayHours) {
          todayHoursMap[s.userId] = s.todayHours
        }
        setTodayHoursByUserId(todayHoursMap)

        // Refresh weekly stats
        const statsResp = await api.get('/api/timeclock/stats')
        const userStats = (statsResp.data?.data?.userStats || []) as Array<{ user_id: string; total_hours: number }>
        const hoursMap: Record<string, number> = {}
        for (const s of userStats) {
          hoursMap[s.user_id] = Number(s.total_hours || 0)
        }
        setHoursByUserId(hoursMap)

        showToast.success(`${response.data.data.userName} clocked out successfully`)
      }
    } catch (err: any) {
      console.error('Failed to clock out:', err)
      showToast.error(err.response?.data?.error?.message || 'Failed to clock out staff member')
      throw err
    }
  }

  const handleStartBreak = async (userId: string) => {
    try {
      const response = await api.post('/api/timeclock/start-break', {
        userId
      })

      if (response.data.success) {
        // Refresh current staff data
        const currentResp = await api.get('/api/timeclock/current-staff')
        setCurrentStaff(currentResp.data?.data?.currentStaff || [])
        showToast.success('Break started successfully')
      }
    } catch (err: any) {
      console.error('Failed to start break:', err)
      showToast.error(err.response?.data?.error?.message || 'Failed to start break')
      throw err
    }
  }

  const handleEndBreak = async (userId: string) => {
    try {
      const response = await api.post('/api/timeclock/end-break', {
        userId
      })

      if (response.data.success) {
        // Refresh current staff data
        const currentResp = await api.get('/api/timeclock/current-staff')
        setCurrentStaff(currentResp.data?.data?.currentStaff || [])
        showToast.success('Break ended successfully')
      }
    } catch (err: any) {
      console.error('Failed to end break:', err)
      showToast.error(err.response?.data?.error?.message || 'Failed to end break')
      throw err
    }
  }

  const handleQuickAction = async (userId: string, time: Date, reason?: string) => {
    // This is called from QuickTimeActionModal for backdated actions
    switch (quickActionType) {
      case 'clock-in':
        await api.post('/api/timeclock/manager/clock-in', {
          userId,
          clockInTime: time.toISOString(),
          managerId: 'current-user',
          reason
        })
        break
      case 'clock-out':
        await api.post('/api/timeclock/manager/clock-out', {
          userId,
          clockOutTime: time.toISOString(),
          managerId: 'current-user',
          notes: reason
        })
        break
    }

    // Refresh all data
    const [currentResp, todayResp, statsResp, dailyResp] = await Promise.all([
      api.get('/api/timeclock/current-staff'),
      api.get('/api/timeclock/staff-hours'),
      api.get('/api/timeclock/stats'),
      api.get('/api/timeclock/user-daily-hours')
    ])

    setCurrentStaff(currentResp.data?.data?.currentStaff || [])

    const todayHours = (todayResp.data?.data?.staffHours || []) as Array<{ userId: string; todayHours: number }>
    const todayHoursMap: Record<string, number> = {}
    for (const s of todayHours) {
      todayHoursMap[s.userId] = s.todayHours
    }
    setTodayHoursByUserId(todayHoursMap)

    const userStats = (statsResp.data?.data?.userStats || []) as Array<{ user_id: string; total_hours: number }>
    const hoursMap: Record<string, number> = {}
    for (const s of userStats) {
      hoursMap[s.user_id] = Number(s.total_hours || 0)
    }
    setHoursByUserId(hoursMap)

    setDailyHours(dailyResp.data?.data || null)

    const actionText = quickActionType === 'clock-in' ? 'clocked in' : 'clocked out'
    showToast.success(`Staff ${actionText} successfully`)
  }

  const handleResetPin = async (member: StaffUser) => {
    try {
      const response = await api.post(`/api/restaurant/staff/${member.id}/reset-pin`, {})
      if (response.data.success) {
        showToast.success(`PIN reset to: ${response.data.data.pin}`)
      }
    } catch (err: any) {
      console.error('Failed to reset PIN:', err)
      showToast.error(err.response?.data?.error?.message || 'Failed to reset PIN')
    }
  }

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
        <AddStaffModal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          onSuccess={handleStaffCreated}
        />

        <EditStaffModal
          isOpen={!!editingStaff}
          staffMember={editingStaff}
          onClose={() => setEditingStaff(null)}
          onSuccess={handleStaffCreated}
        />

        <HoursEditorModal
          isOpen={!!hoursEditorStaff}
          staffMember={hoursEditorStaff}
          onClose={() => setHoursEditorStaff(null)}
          onSave={handleStaffCreated}
        />

        <QuickTimeActionModal
          isOpen={!!quickActionStaff}
          staffMember={quickActionStaff}
          action={quickActionType}
          onAction={handleQuickAction}
          onClose={() => setQuickActionStaff(null)}
        />

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
            <div className="flex items-center gap-3">
              <a
                href="/staff/clock"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary inline-flex items-center space-x-2"
              >
                <Smartphone className="w-4 h-4" />
                <span>Staff Clock-In PWA</span>
              </a>
              <motion.button
                className="btn-primary inline-flex items-center space-x-2"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowAddModal(true)}
              >
                <UserPlus className="w-4 h-4" />
                <span>Add Staff Member</span>
              </motion.button>
            </div>
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

          {/* Staff Cards Grid - Using enhanced StaffCard component */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {(isLoading ? [] : filteredStaff).map((member, index) => {
              const status = getStatus(member.id)
              const activeShift = currentByUserId.get(member.id)
              const shiftLabel = activeShift ? `${formatTime(activeShift.clock_in_time)} - Now` : '—'
              const hoursThisWeek = hoursByUserId[member.id] ?? 0
              const hoursToday = todayHoursByUserId[member.id] ?? 0

              return (
                <StaffCard
                  key={member.id}
                  member={member}
                  status={status as 'on-shift' | 'on-break' | 'off-shift'}
                  activeShift={activeShift}
                  hoursThisWeek={hoursThisWeek}
                  hoursToday={hoursToday}
                  dailyHours={dailyHours || undefined}
                  weekDates={weekDates}
                  onEditStaff={setEditingStaff}
                  onResetPin={handleResetPin}
                  onEditHours={setHoursEditorStaff}
                  onViewHistory={setViewingHistoryStaff}
                  onClockIn={handleClockIn}
                  onClockOut={handleClockOut}
                  onStartBreak={handleStartBreak}
                  onEndBreak={handleEndBreak}
                />
              )
            })}
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
