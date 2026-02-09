import React, { useEffect, useMemo, useState, useCallback } from 'react'
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
  History,
  CalendarDays,
  Copy,
  Eye,
  EyeOff,
  Trash2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import { api } from '../../lib/api'
import { socketManager } from '../../lib/socket'
import { useUser } from '../../contexts/UserContext'
import EditStaffHoursModal from '../../components/staff/EditStaffHoursModal'
import { showToast } from '../../components/ui/Toast'
import ScheduleViewToggle from '../../components/schedule/ScheduleViewToggle'
import { ScheduleCalendar } from '../../components/schedule/ScheduleCalendar'
import StaffCard from '../../components/staff/StaffCard'

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

// Schedule types
interface Schedule {
  id: string
  user_id: string
  user_name: string
  shift_date: string
  shift_start_time: string
  shift_end_time: string
  position?: string
  notes?: string
  is_published: boolean
}

interface ShiftTemplate {
  id: string
  name: string
  start_time: string
  end_time: string
  break_minutes: number
  position?: string
  color?: string
  is_active: boolean
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
  const { user, isManagerOrOwner, isAdmin } = useUser()
  const currentUserRole = user?.role || 'staff'
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
  const [showEditHoursModal, setShowEditHoursModal] = useState(false)
  const [editingHoursStaff, setEditingHoursStaff] = useState<StaffUser | null>(null)
  const [viewingHistoryStaff, setViewingHistoryStaff] = useState<StaffUser | null>(null)
  const [openMenu, setOpenMenu] = useState<string | null>(null)

  // Schedule state
  const [scheduleView, setScheduleView] = useState<'cards' | 'calendar'>('cards')
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [templates, setTemplates] = useState<ShiftTemplate[]>([])
  const [selectedWeekStart, setSelectedWeekStart] = useState<Date>(() => {
    const now = new Date()
    const dayOfWeek = now.getDay() // 0 = Sunday, 6 = Saturday
    const sunday = new Date(now)
    sunday.setDate(now.getDate() - dayOfWeek) // Go back to Sunday
    sunday.setHours(0, 0, 0, 0)
    return sunday
  })
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null)
  const [showShiftModal, setShowShiftModal] = useState(false)
  const [showTemplatesModal, setShowTemplatesModal] = useState(false)
  const [shiftModalDate, setShiftModalDate] = useState<string>('')
  const [shiftModalTime, setShiftModalTime] = useState<string | undefined>(undefined)
  const [scheduleLoading, setScheduleLoading] = useState(false)

  // Format date as YYYY-MM-DD using local timezone (not UTC)
  const formatLocalDate = (date: Date): string => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const normalizeScheduleDate = (value?: string) => {
    if (!value) return value
    return value.split('T')[0]
  }

  const getWeekRange = useCallback((weekStart?: Date) => {
    const start = weekStart ? new Date(weekStart) : new Date(selectedWeekStart)
    start.setHours(0, 0, 0, 0)

    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    end.setHours(23, 59, 59, 999)

    return {
      startDate: formatLocalDate(start),
      endDate: formatLocalDate(end)
    }
  }, [selectedWeekStart])

  // For backward compatibility - returns current calendar week
  const getCurrentWeekRange = () => {
    const now = new Date()
    const dayOfWeek = now.getDay()
    const start = new Date(now)
    start.setDate(now.getDate() - dayOfWeek)
    start.setHours(0, 0, 0, 0)

    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    end.setHours(23, 59, 59, 999)

    return {
      startDate: formatLocalDate(start),
      endDate: formatLocalDate(end)
    }
  }

  // Check if currently viewing the current week
  const isCurrentWeek = useMemo(() => {
    const now = new Date()
    const dayOfWeek = now.getDay()
    const currentSunday = new Date(now)
    currentSunday.setDate(now.getDate() - dayOfWeek)
    currentSunday.setHours(0, 0, 0, 0)
    return formatLocalDate(selectedWeekStart) === formatLocalDate(currentSunday)
  }, [selectedWeekStart])

  const selectedWeekDates = useMemo(() => {
    const dates: string[] = []
    for (let i = 0; i < 7; i++) {
      const date = new Date(selectedWeekStart)
      date.setDate(selectedWeekStart.getDate() + i)
      dates.push(formatLocalDate(date))
    }
    return dates
  }, [selectedWeekStart])

  const actualHoursByUserId = useMemo(() => {
    if (!dailyHours?.userDailyHours) return undefined
    const totals: Record<string, number> = {}
    for (const [userId, daily] of Object.entries(dailyHours.userDailyHours)) {
      totals[userId] = selectedWeekDates.reduce((sum, date) => sum + (daily[date] || 0), 0)
    }
    return totals
  }, [dailyHours, selectedWeekDates])

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
          const { startDate, endDate } = getCurrentWeekRange()
          const [statsResp, todayResp, dailyResp] = await Promise.all([
            api.get('/api/timeclock/stats', {
              params: { startDate, endDate }
            }),
            api.get('/api/timeclock/staff-hours'),
            api.get('/api/timeclock/user-daily-hours', {
              params: { startDate, endDate }
            })
          ])

          const userStats = (statsResp.data?.data?.userStats || []) as Array<{ user_id: string; total_hours: number }>
          const hoursMap: Record<string, number> = {}
          for (const s of userStats) {
            hoursMap[s.user_id] = Number(s.total_hours || 0)
          }
          if (isMounted) setHoursByUserId(hoursMap)

          const todayHours = (todayResp.data?.data?.staffHours || []) as Array<{ userId: string; todayHours: number }>
          const todayHoursMap: Record<string, number> = {}
          for (const s of todayHours) {
            todayHoursMap[s.userId] = s.todayHours
          }
          if (isMounted) setTodayHoursByUserId(todayHoursMap)

          if (isMounted) setDailyHours(dailyResp.data?.data || null)
        } catch (statsError) {
          console.warn('Failed to load timeclock data:', statsError)
        }

        // Fetch schedules for the current week
        if (isMounted) {
          await loadSchedules()
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

  // Socket listeners for real-time updates
  useEffect(() => {
    const handleTimeEntryCreated = (data: { userId: string; entry?: any }) => {
      console.log('Time entry created:', data)
      showToast.success('Staff clock in recorded')
      // Refresh current staff and hours
      refreshStaffData()
    }

    const handleTimeEntryUpdated = (data: { userId: string; entry?: any }) => {
      console.log('Time entry updated:', data)
      // Refresh hours data
      refreshHoursData()
    }

    const handleScheduleUpdated = () => {
      console.log('Schedule updated')
      showToast.info('Schedule has been updated')
      refreshStaffData()
    }

    const handleBreakStarted = (data: { userId: string }) => {
      console.log('Break started:', data)
      showToast.success('Break started')
      refreshStaffData()
    }

    const handleBreakEnded = (data: { userId: string }) => {
      console.log('Break ended:', data)
      showToast.success('Break ended')
      refreshStaffData()
    }

    // Connect and listen
    if (!socketManager.connected) {
      socketManager.connect()
    }

    socketManager.on('staff:clock_in', handleTimeEntryCreated)
    socketManager.on('staff:clock_out', handleTimeEntryUpdated)
    socketManager.on('staff.schedule_updated', handleScheduleUpdated)
    socketManager.on('staff:break_start', handleBreakStarted)
    socketManager.on('staff:break_end', handleBreakEnded)

    return () => {
      socketManager.off('staff:clock_in', handleTimeEntryCreated)
      socketManager.off('staff:clock_out', handleTimeEntryUpdated)
      socketManager.off('staff.schedule_updated', handleScheduleUpdated)
      socketManager.off('staff:break_start', handleBreakStarted)
      socketManager.off('staff:break_end', handleBreakEnded)
    }
  }, [])

  // Helper functions to refresh data
  const refreshStaffData = async () => {
    try {
      const currentResp = await api.get('/api/timeclock/current-staff')
      setCurrentStaff(currentResp.data?.data?.currentStaff || [])
    } catch (e) {
      console.error('Failed to refresh current staff:', e)
    }
  }

  const refreshStaffList = async () => {
    try {
      const staffResp = await api.get('/api/restaurant/staff')
      setStaff((staffResp.data?.data?.staff || []) as StaffUser[])
    } catch (e) {
      console.error('Failed to refresh staff list:', e)
    }
  }

  const refreshHoursData = async () => {
    try {
      const { startDate, endDate } = getWeekRange()
      const [statsResp, todayResp, dailyResp] = await Promise.all([
        api.get('/api/timeclock/stats', {
          params: { startDate, endDate }
        }),
        api.get('/api/timeclock/staff-hours'),
        api.get('/api/timeclock/user-daily-hours', {
          params: { startDate, endDate }
        })
      ])

      const userStats = (statsResp.data?.data?.userStats || []) as Array<{ user_id: string; total_hours: number }>
      const hoursMap: Record<string, number> = {}
      for (const s of userStats) {
        hoursMap[s.user_id] = Number(s.total_hours || 0)
      }
      setHoursByUserId(hoursMap)

      const todayHours = (todayResp.data?.data?.staffHours || []) as Array<{ userId: string; todayHours: number }>
      const todayHoursMap: Record<string, number> = {}
      for (const s of todayHours) {
        todayHoursMap[s.userId] = s.todayHours
      }
      setTodayHoursByUserId(todayHoursMap)
      setDailyHours(dailyResp.data?.data || null)
    } catch (e) {
      console.error('Failed to refresh hours:', e)
    }
  }

  const loadWeekData = async (weekStart?: Date) => {
    const ws = weekStart || selectedWeekStart
    const { startDate, endDate } = getWeekRange(ws)

    try {
      const [statsResp, dailyResp] = await Promise.all([
        api.get('/api/timeclock/stats', {
          params: { startDate, endDate }
        }),
        api.get('/api/timeclock/user-daily-hours', {
          params: { startDate, endDate }
        })
      ])

      const userStats = (statsResp.data?.data?.userStats || []) as Array<{ user_id: string; total_hours: number }>
      const hoursMap: Record<string, number> = {}
      for (const s of userStats) {
        hoursMap[s.user_id] = Number(s.total_hours || 0)
      }
      setHoursByUserId(hoursMap)
      setDailyHours(dailyResp.data?.data || null)
    } catch (e) {
      console.warn('Failed to load week data:', e)
    }
  }

  const loadSchedules = async (showError = false, weekStart?: Date) => {
    const ws = weekStart || selectedWeekStart
    try {
      const endDate = new Date(ws)
      endDate.setDate(ws.getDate() + 6)

      const startDateStr = formatLocalDate(ws)
      const endDateStr = formatLocalDate(endDate)

      console.log('[SCHEDULING-FRONTEND] Fetching schedules for date range:', startDateStr, 'to', endDateStr);

      const [schedulesResp, templatesResp] = await Promise.all([
        api.get('/api/staff/scheduling/schedules', {
          params: {
            startDate: startDateStr,
            endDate: endDateStr
          }
        }),
        api.get('/api/staff/scheduling/templates')
      ])

      const schedules = schedulesResp.data?.data?.schedules || []
      const normalizedSchedules = schedules.map((schedule: Schedule) => ({
        ...schedule,
        shift_date: normalizeScheduleDate(schedule.shift_date) || schedule.shift_date
      }))
      console.log('[SCHEDULING-FRONTEND] Received', schedules.length, 'schedules');
      if (schedules.length > 0) {
        console.log('[SCHEDULING-FRONTEND] Sample schedules:', schedules.slice(0, 3).map((s: Schedule) => ({
          id: s.id?.slice(0, 8),
          date: s.shift_date,
          user: s.user_name
        })));
      }

      setSchedules(normalizedSchedules)
      setTemplates(templatesResp.data?.data?.templates || [])
      return normalizedSchedules
    } catch (error) {
      console.warn('Failed to load schedules:', error)
      if (showError) {
        showToast.error('Failed to load schedules')
      }
      return []
    }
  }

  const loadTemplates = async () => {
    try {
      const resp = await api.get('/api/staff/scheduling/templates')
      setTemplates(resp.data?.data?.templates || [])
    } catch (error) {
      console.warn('Failed to load templates:', error)
    }
  }

  const handleCreateShift = (date: string, time?: string) => {
    setShiftModalDate(date)
    setShiftModalTime(time)
    setEditingSchedule(null)
    setShowShiftModal(true)
  }

  const handleEditShift = (schedule: Schedule) => {
    setEditingSchedule(schedule)
    setShiftModalDate(schedule.shift_date)
    setShiftModalTime(undefined)
    setShowShiftModal(true)
  }

  const handleSaveShift = async (scheduleData: any) => {
    console.log('[SCHEDULING-FRONTEND] Saving shift:', {
      user_id: scheduleData.user_id,
      shift_date: scheduleData.shift_date,
      shift_start_time: scheduleData.shift_start_time,
      shift_end_time: scheduleData.shift_end_time,
      isEdit: !!editingSchedule?.id
    });

    try {
      if (editingSchedule?.id) {
        // Update existing schedule
        await api.put(`/api/staff/scheduling/schedules/${editingSchedule.id}`, scheduleData)
        showToast.success('Shift updated successfully')
      } else {
        // Create new schedule
        await api.post('/api/staff/scheduling/schedules', scheduleData)
        showToast.success('Shift created successfully')
      }
      // Refresh schedules and verify
      const refreshedSchedules = await loadSchedules(true)
      console.log('[SCHEDULING-FRONTEND] After save, loaded', refreshedSchedules.length, 'schedules');
      if (!refreshedSchedules || refreshedSchedules.length === 0) {
        showToast.error('Schedule saved but failed to refresh the view')
      }
    } catch (error: any) {
      console.error('[SCHEDULING-FRONTEND] ERROR saving shift:', error.response?.data?.error?.message || error.message);
      if (error.response?.status === 403) {
        showToast.error('You do not have permission to modify schedules')
      } else {
        showToast.error(error.response?.data?.error?.message || 'Failed to save shift')
      }
      throw error
    }
  }

  const handleDeleteShift = async (scheduleId: string) => {
    try {
      await api.delete(`/api/staff/scheduling/schedules/${scheduleId}`)
      showToast.success('Shift deleted successfully')
      await loadSchedules()
    } catch (error: any) {
      console.error('Failed to delete shift:', error)
      if (error.response?.status === 403) {
        showToast.error('You do not have permission to delete schedules')
      } else {
        showToast.error(error.response?.data?.error?.message || 'Failed to delete shift')
      }
      throw error
    }
  }

  const handleTogglePublish = async (scheduleId: string, isPublished: boolean) => {
    try {
      await api.put(`/api/staff/scheduling/schedules/${scheduleId}`, { is_published: isPublished })
      showToast.success(isPublished ? 'Schedule published' : 'Schedule unpublished')
      await loadSchedules()
    } catch (error: any) {
      showToast.error('Failed to update schedule')
    }
  }

  const handleCopyShift = async (schedule: Schedule) => {
    // Open the shift modal with copied data
    setEditingSchedule(null)
    setShiftModalDate(schedule.shift_date)
    setShiftModalTime(schedule.shift_start_time)
    setShowShiftModal(true)
  }

  const handleCopyShiftMultiple = async (schedule: Schedule, dates: string[]) => {
    const schedulesToCopy = dates
      .filter((date) => date !== schedule.shift_date)
      .map((date) => ({
        user_id: schedule.user_id,
        shift_date: date,
        shift_start_time: schedule.shift_start_time,
        shift_end_time: schedule.shift_end_time,
        position: schedule.position,
        notes: schedule.notes
      }))

    if (schedulesToCopy.length === 0) {
      showToast.info('No new days selected for copying.')
      return
    }

    try {
      const resp = await api.post('/api/staff/scheduling/schedules/bulk', {
        schedules: schedulesToCopy
      })
      showToast.success(`Copied ${resp.data?.data?.created || schedulesToCopy.length} shifts`)
      await loadSchedules()
    } catch (error: any) {
      console.error('Failed to copy shifts:', error)
      showToast.error(error.response?.data?.error?.message || 'Failed to copy shifts')
    }
  }

  const handleMoveShift = async (scheduleId: string, targetDate: string) => {
    const schedule = schedules.find((item) => item.id === scheduleId)
    if (!schedule || schedule.shift_date === targetDate) return
    try {
      await api.put(`/api/staff/scheduling/schedules/${scheduleId}`, {
        shift_date: targetDate
      })
      showToast.success('Shift moved successfully')
      await loadSchedules()
    } catch (error: any) {
      console.error('Failed to move shift:', error)
      showToast.error(error.response?.data?.error?.message || 'Failed to move shift')
    }
  }

  const handleCreateTemplate = async (template: Omit<ShiftTemplate, 'id' | 'is_active'>) => {
    await api.post('/api/staff/scheduling/templates', template)
    showToast.success('Template created')
    await loadTemplates()
  }

  const handleUpdateTemplate = async (id: string, template: Partial<ShiftTemplate>) => {
    await api.put(`/api/staff/scheduling/templates/${id}`, template)
    showToast.success('Template updated')
    await loadTemplates()
  }

  const handleDeleteTemplate = async (id: string) => {
    await api.delete(`/api/staff/scheduling/templates/${id}`)
    showToast.success('Template deleted')
    await loadTemplates()
  }

  const handleApplyTemplate = async (templateId: string, weekStartDate: string) => {
    const template = templates.find(t => t.id === templateId)
    if (!template) return

    // Get the week dates
    const dates: string[] = []
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStartDate)
      date.setDate(date.getDate() + i)
      dates.push(date.toISOString().split('T')[0])
    }

    // Create schedules for each day of the week
    const schedules: any[] = []
    for (const date of dates) {
      schedules.push({
        user_id: staff[0]?.id, // Default to first staff member - user will need to edit
        shift_date: date,
        shift_start_time: template.start_time,
        shift_end_time: template.end_time,
        position: template.position,
        notes: `From template: ${template.name}`
      })
    }

    try {
      const resp = await api.post('/api/staff/scheduling/schedules/bulk', { schedules })
      showToast.success(`Created ${resp.data.data.created} shifts from template`)
      await loadSchedules()
    } catch (error: any) {
      showToast.error('Failed to apply template')
    }
  }

  const handleWeekChange = useCallback(async (date: Date) => {
    setSelectedWeekStart(date)
    await Promise.all([
      loadSchedules(false, date),
      loadWeekData(date)
    ])
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
        await Promise.all([refreshStaffData(), refreshHoursData()])
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

  const handleQuickAction = async (userId: string, time: Date, reason?: string, quickActionType?: 'clock-in' | 'clock-out') => {
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
    await Promise.all([refreshStaffData(), refreshHoursData()])

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

  const handleDeactivateStaff = async (member: StaffUser) => {
    if (!confirm(`Deactivate ${member.name}? They will no longer be able to clock in.`)) return

    try {
      await api.delete(`/api/restaurant/staff/${member.id}`)
      showToast.success(`${member.name} has been deactivated`)
      await Promise.all([refreshStaffList(), refreshStaffData(), refreshHoursData()])
    } catch (err: any) {
      console.error('Failed to deactivate staff member:', err)
      showToast.error(err.response?.data?.error?.message || 'Failed to deactivate staff member')
    }
  }

  const handleDeleteStaff = async (member: StaffUser) => {
    if (!confirm(`Delete ${member.name} permanently? This removes their history and cannot be undone.`)) return

    try {
      await api.delete(`/api/restaurant/staff/${member.id}`, {
        params: { mode: 'hard' }
      })
      showToast.success(`${member.name} has been deleted`)
      await Promise.all([refreshStaffList(), refreshStaffData(), refreshHoursData()])
    } catch (err: any) {
      console.error('Failed to delete staff member:', err)
      showToast.error(err.response?.data?.error?.message || 'Failed to delete staff member')
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

  // Staff members cannot edit hours - only managers/owners/admins can
  const canEditHours = isManagerOrOwner || isAdmin

  const handleEditHours = (member: StaffUser) => {
    if (canEditHours) {
      setEditingHoursStaff(member)
      setShowEditHoursModal(true)
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

        <EditStaffHoursModal
          isOpen={showEditHoursModal}
          staffMember={editingHoursStaff}
          currentUserRole={currentUserRole}
          onClose={() => {
            setShowEditHoursModal(false)
            setEditingHoursStaff(null)
          }}
          onRefresh={handleStaffCreated}
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
              <ScheduleViewToggle
                view={scheduleView}
                onViewChange={setScheduleView}
                scheduledCount={schedules.length}
              />
              {scheduleView === 'calendar' && canEditHours && (
                <motion.button
                  className="btn-secondary inline-flex items-center space-x-2"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowTemplatesModal(true)}
                >
                  <CalendarDays className="w-4 h-4" />
                  <span>Templates</span>
                </motion.button>
              )}
              <a
                href="/staff/clock"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary inline-flex items-center space-x-2"
              >
                <Smartphone className="w-4 h-4" />
                <span>Staff Clock-In</span>
              </a>
              <motion.button
                className="btn-primary inline-flex items-center space-x-2"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowAddModal(true)}
              >
                <UserPlus className="w-4 h-4" />
                <span>Add Staff</span>
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
                    {isCurrentWeek ? 'Total Hours This Week' : 'Total Hours Selected Week'}
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

          {/* Loading State */}
          {isLoading && (
            <div className="text-center py-12 text-surface-500">Loading staff...</div>
          )}

          {/* Staff Cards Grid - shown when view is 'cards' */}
          {scheduleView === 'cards' && !isLoading && (
            <>
              {/* Week Navigation */}
              <div className="flex items-center justify-between bg-white dark:bg-surface-800 rounded-xl px-4 py-3 border border-surface-200 dark:border-surface-700">
                <button
                  onClick={() => {
                    const prev = new Date(selectedWeekStart)
                    prev.setDate(prev.getDate() - 7)
                    handleWeekChange(prev)
                  }}
                  className="p-2 text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-100 rounded-lg hover:bg-gray-100 dark:hover:bg-surface-700 transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 dark:bg-surface-700 rounded-lg">
                    <Calendar className="w-4 h-4 text-surface-500" />
                    <span className="text-sm font-medium text-surface-900 dark:text-surface-100">
                      {selectedWeekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {(() => {
                        const end = new Date(selectedWeekStart)
                        end.setDate(end.getDate() + 6)
                        return end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                      })()}
                    </span>
                  </div>
                  {!isCurrentWeek && (
                    <button
                      onClick={() => {
                        const now = new Date()
                        const dayOfWeek = now.getDay()
                        const sunday = new Date(now)
                        sunday.setDate(now.getDate() - dayOfWeek)
                        sunday.setHours(0, 0, 0, 0)
                        handleWeekChange(sunday)
                      }}
                      className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                    >
                      This Week
                    </button>
                  )}
                </div>
                <button
                  onClick={() => {
                    const next = new Date(selectedWeekStart)
                    next.setDate(next.getDate() + 7)
                    handleWeekChange(next)
                  }}
                  disabled={isCurrentWeek}
                  className="p-2 text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-100 rounded-lg hover:bg-gray-100 dark:hover:bg-surface-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              {filteredStaff.length === 0 ? (
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
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  {filteredStaff.map((member) => {
                    const status = getStatus(member.id)
                    const activeShift = currentByUserId.get(member.id)
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
                        weekDates={selectedWeekDates}
                        onEditStaff={setEditingStaff}
                        onResetPin={handleResetPin}
                        onEditHours={canEditHours ? handleEditHours : undefined}
                        onViewHistory={setViewingHistoryStaff}
                        onClockIn={handleClockIn}
                        onClockOut={handleClockOut}
                        onStartBreak={handleStartBreak}
                        onEndBreak={handleEndBreak}
                        onDeactivate={handleDeactivateStaff}
                        onDelete={handleDeleteStaff}
                      />
                    )
                  })}
                </div>
              )}
            </>
          )}

          {/* Schedule Calendar - shown when view is 'calendar' */}
          {scheduleView === 'calendar' && !isLoading && (
            <ScheduleCalendar
              schedules={schedules}
              staff={filteredStaff.map(s => ({ id: s.id, name: s.name, role: s.role }))}
              selectedWeekStart={selectedWeekStart}
              onWeekChange={handleWeekChange}
              onCreateShift={(date, time) => {
                setShiftModalDate(date)
                setShiftModalTime(time)
                setShowShiftModal(true)
              }}
              onEditShift={setEditingSchedule}
              onDeleteShift={handleDeleteShift}
              onTogglePublish={handleTogglePublish}
              onCopyShift={handleCopyShift}
              onCopyShiftMultiple={handleCopyShiftMultiple}
              onMoveShift={handleMoveShift}
              actualHoursByUserId={actualHoursByUserId}
              canEdit={canEditHours}
            />
          )}
        </div>
      </DashboardLayout>
    </>
  )
}
