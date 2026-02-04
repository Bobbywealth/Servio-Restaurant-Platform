import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MoreVertical,
  Edit3,
  Clock,
  Coffee,
  LogIn,
  LogOut,
  History,
  RefreshCw,
  Trash2,
  Calendar,
  AlertTriangle,
  Check,
  X,
  Mail
} from 'lucide-react'
import { api } from '../../lib/api'
import { useUser } from '../../contexts/UserContext'

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

interface DailyHours {
  userDailyHours: Record<string, Record<string, number>>
  weekStartDate: string
}

interface StaffCardProps {
  member: StaffUser
  status: 'on-shift' | 'on-break' | 'off-shift'
  activeShift?: CurrentStaff | null
  hoursThisWeek: number
  hoursToday: number
  dailyHours?: DailyHours | null
  weekDates?: string[]
  onEditStaff?: (member: StaffUser) => void
  onResetPin?: (member: StaffUser) => void
  onEditHours?: (member: StaffUser) => void
  onViewHistory?: (member: StaffUser) => void
  onClockIn?: (userId: string) => Promise<void>
  onClockOut?: (userId: string) => Promise<void>
  onStartBreak?: (userId: string) => Promise<void>
  onEndBreak?: (userId: string) => Promise<void>
  onEdit?: (staff: any) => void
  onDeactivate?: (staff: any) => void
  className?: string
  showScheduleView?: boolean
}

export function StaffCard({
  member,
  status,
  activeShift,
  hoursThisWeek,
  hoursToday,
  dailyHours,
  weekDates = [],
  onEditStaff,
  onResetPin,
  onEditHours,
  onViewHistory,
  onClockIn,
  onClockOut,
  onStartBreak,
  onEndBreak,
  onEdit,
  onDeactivate,
  className = '',
  showScheduleView = false
}: StaffCardProps) {
  const { isManagerOrOwner, isAdmin } = useUser()
  const [openMenu, setOpenMenu] = useState<string | null | boolean>(null)
  const [loading, setLoading] = useState<string | null>(null)
  const [shiftDuration, setShiftDuration] = useState<string>('')
  const [isHovering, setIsHovering] = useState(false)

  // Staff members cannot edit hours - only managers/owners/admins can
  const canEditHours = isManagerOrOwner || isAdmin

  // Calculate real-time shift duration
  useEffect(() => {
    if (!activeShift || status === 'off-shift') {
      setShiftDuration('')
      return
    }

    const updateDuration = () => {
      const now = new Date()
      const clockIn = new Date(activeShift.clock_in_time)
      const diffMs = now.getTime() - clockIn.getTime()
      const diffMins = Math.floor(diffMs / 60000)
      const hours = Math.floor(diffMins / 60)
      const mins = diffMins % 60

      if (hours > 0) {
        setShiftDuration(`${hours}h ${mins}m`)
      } else {
        setShiftDuration(`${mins}m`)
      }
    }

    updateDuration()
    const interval = setInterval(updateDuration, 60000)

    return () => clearInterval(interval)
  }, [activeShift, status])

  const handleClockIn = async () => {
    if (!onClockIn || !member) return
    setLoading('clock-in')
    try {
      await onClockIn(member.id)
    } finally {
      setLoading(null)
    }
  }

  const handleClockOut = async () => {
    if (!onClockOut || !member) return
    setLoading('clock-out')
    try {
      await onClockOut(member.id)
    } finally {
      setLoading(null)
    }
  }

  const handleStartBreak = async () => {
    if (!onStartBreak || !member) return
    setLoading('break-start')
    try {
      await onStartBreak(member.id)
    } finally {
      setLoading(null)
    }
  }

  const handleEndBreak = async () => {
    if (!onEndBreak || !member) return
    setLoading('break-end')
    try {
      await onEndBreak(member.id)
    } finally {
      setLoading(null)
    }
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'on-shift':
        return 'bg-emerald-500'
      case 'on-break':
        return 'bg-amber-500'
      case 'off-shift':
        return 'bg-slate-400'
      default:
        return 'bg-slate-400'
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

  // Calculate if overtime (>8 hours today or >40 hours this week)
  const isOvertimeToday = hoursToday > 8
  const isOvertimeWeek = hoursThisWeek > 40

  const handleEdit = () => {
    if (onEdit) {
      onEdit(member)
    } else if (onEditStaff) {
      onEditStaff(member)
    }
    setOpenMenu(null)
  }

  const handleResetPin = async () => {
    if (onResetPin) {
      await onResetPin(member)
    }
    setOpenMenu(null)
  }

  const handleDeactivate = () => {
    if (onDeactivate) {
      onDeactivate(member)
    }
    setOpenMenu(null)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-white dark:bg-surface-800 rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 border border-surface-200 dark:border-surface-700 ${className}`}
    >
      {/* Overtime indicator */}
      {(isOvertimeToday || isOvertimeWeek) && (
        <div className="absolute -top-2 -right-2 z-10">
          <div className={`px-2 py-1 rounded-full text-xs font-bold ${
            isOvertimeToday ? 'bg-red-500 text-white' : 'bg-yellow-500 text-white'
          }`}>
            {isOvertimeToday ? 'OT Today' : 'OT Week'}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between p-5 border-b border-surface-100 dark:border-surface-700">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center text-white font-semibold text-lg">
              {initials(member.name)}
            </div>
            {status === 'on-shift' && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white dark:border-surface-800"
              />
            )}
          </div>
          <div>
            <h3 className="font-semibold text-surface-900 dark:text-surface-100">
              {member.name}
            </h3>
            <p className="text-sm text-surface-500 dark:text-surface-400">
              {member.role}{!member.is_active ? ' • Inactive' : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-1 rounded-full text-xs font-medium text-white ${getStatusColor(status)}`}>
            {getStatusText(status)}
          </span>
          <div className="relative">
            <button
              onClick={() => setOpenMenu(openMenu === member.id ? null : member.id)}
              className="p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
              aria-label="More options"
            >
              <MoreVertical className="w-4 h-4 text-surface-500" />
            </button>
            {/* Dropdown Menu */}
            {openMenu === member.id && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setOpenMenu(null)}
                />
                <div className="absolute right-0 top-10 z-20 w-48 bg-white dark:bg-surface-800 rounded-xl shadow-lg border border-gray-200 dark:border-surface-700 py-1">
                  <button
                    onClick={handleEdit}
                    className="w-full px-4 py-3 text-left text-sm text-surface-700 dark:text-surface-200 hover:bg-gray-100 dark:hover:bg-surface-700 flex items-center gap-2"
                  >
                    <Edit3 className="w-4 h-4" />
                    Edit Staff
                  </button>
                  {canEditHours && onEditHours && (
                    <button
                      onClick={() => {
                        onEditHours(member)
                        setOpenMenu(null)
                      }}
                      className="w-full px-4 py-3 text-left text-sm text-surface-700 dark:text-surface-200 hover:bg-gray-100 dark:hover:bg-surface-700 flex items-center gap-2"
                    >
                      <Clock className="w-4 h-4" />
                      Edit Hours
                    </button>
                  )}
                  {onViewHistory && (
                    <button
                      onClick={() => {
                        onViewHistory(member)
                        setOpenMenu(null)
                      }}
                      className="w-full px-4 py-3 text-left text-sm text-surface-700 dark:text-surface-200 hover:bg-gray-100 dark:hover:bg-surface-700 flex items-center gap-2"
                    >
                      <History className="w-4 h-4" />
                      View History
                    </button>
                  )}
                  <button
                    onClick={handleResetPin}
                    className="w-full px-4 py-3 text-left text-sm text-surface-700 dark:text-surface-200 hover:bg-gray-100 dark:hover:bg-surface-700 flex items-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Reset PIN
                  </button>
                  <hr className="my-1 border-gray-200 dark:border-surface-700" />
                  <button
                    onClick={handleDeactivate}
                    className="w-full px-4 py-3 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Deactivate
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Clock Action Buttons */}
      {onClockIn && onClockOut && (
        <div className="px-5 py-3 border-b border-surface-100 dark:border-surface-700 flex gap-2">
          {status === 'off-shift' && (
            <button
              onClick={handleClockIn}
              disabled={loading === 'clock-in'}
              className="flex-1 px-3 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              {loading === 'clock-in' ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  Clock In
                </>
              )}
            </button>
          )}
          {status === 'on-shift' && (
            <>
              <button
                onClick={handleStartBreak}
                disabled={loading === 'break-start'}
                className="flex-1 px-3 py-2.5 bg-yellow-500 hover:bg-yellow-600 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                {loading === 'break-start' ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Coffee className="w-4 h-4" />
                    Start Break
                  </>
                )}
              </button>
              <button
                onClick={handleClockOut}
                disabled={loading === 'clock-out'}
                className="flex-1 px-3 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                {loading === 'clock-out' ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <LogOut className="w-4 h-4" />
                    Clock Out
                  </>
                )}
              </button>
            </>
          )}
          {status === 'on-break' && (
            <>
              <button
                onClick={handleEndBreak}
                disabled={loading === 'break-end'}
                className="flex-1 px-3 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                {loading === 'break-end' ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    End Break
                  </>
                )}
              </button>
              <button
                onClick={handleClockOut}
                disabled={loading === 'clock-out'}
                className="flex-1 px-3 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                {loading === 'clock-out' ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <LogOut className="w-4 h-4" />
                    Clock Out
                  </>
                )}
              </button>
            </>
          )}
        </div>
      )}

      {/* Content */}
      <div className="p-5">
        {/* Current Shift Info */}
        {activeShift && status !== 'off-shift' && (
          <div className="bg-gray-50 dark:bg-surface-700 rounded-xl p-3 mb-3">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-surface-600 dark:text-surface-300">
                <Clock className="w-4 h-4" />
                <span>{formatTime(activeShift.clock_in_time)} - Now</span>
              </div>
              <div className="flex items-center gap-2">
                {shiftDuration && (
                  <span className="font-bold text-surface-900 dark:text-surface-100">
                    {shiftDuration}
                  </span>
                )}
                {status === 'on-break' && (
                  <span className="text-amber-500 flex items-center gap-1 text-xs font-medium">
                    <Coffee className="w-3 h-3" />
                    On Break
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Contact Info */}
        <div className="flex items-center space-x-2 text-sm text-surface-600 dark:text-surface-400">
          <Mail className="w-4 h-4" />
          <span>{member.email || '—'}</span>
        </div>

        {/* PIN and Clock In link */}
        {member.pin && (
          <div className="flex items-center justify-between pt-3 mt-3 border-t border-surface-200 dark:border-surface-700">
            <div className="flex items-center gap-2">
              <span className="text-sm text-surface-600 dark:text-surface-400">PIN:</span>
              <span className="font-mono font-bold text-surface-900 dark:text-surface-100">
                {member.pin}
              </span>
            </div>
            <a
              href={`/staff/clock`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary-500 hover:text-primary-600 font-medium"
            >
              <LogIn className="w-4 h-4" />
              Clock In
            </a>
          </div>
        )}
      </div>
    </motion.div>
  )
}

export default StaffCard
