import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MoreVertical,
  Edit3,
  Clock,
  Mail,
  Coffee,
  LogIn,
  CheckCircle,
  X
} from 'lucide-react'

interface StaffCardProps {
  staff: {
    id: string
    name: string
    email?: string | null
    role: 'staff' | 'manager' | 'owner' | 'admin'
    pin?: string | null
    is_active: boolean
  }
  status: 'on-shift' | 'on-break' | 'off-shift'
  hoursThisWeek?: number
  hoursToday?: number
  activeShift?: {
    clock_in_time: string
    is_on_break: boolean
    position?: string
  }
  onEdit: (staff: any) => void
  onResetPin: (staff: any) => void
  onDeactivate: (staff: any) => void
  className?: string
}

export default function StaffCard({
  staff,
  status,
  hoursThisWeek,
  hoursToday,
  activeShift,
  onEdit,
  onResetPin,
  onDeactivate,
  className = ''
}: StaffCardProps) {
  const [showMenu, setShowMenu] = useState(false)

  const getStatusColor = () => {
    switch (status) {
      case 'on-shift': return 'bg-emerald-500'
      case 'on-break': return 'bg-amber-500'
      case 'off-shift': return 'bg-slate-400'
      default: return 'bg-slate-400'
    }
  }

  const getStatusText = () => {
    switch (status) {
      case 'on-shift': return 'On Shift'
      case 'on-break': return 'On Break'
      case 'off-shift': return 'Off Shift'
      default: return 'Unknown'
    }
  }

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const initials = (name: string) => {
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('')
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-white dark:bg-surface-800 rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 border border-surface-200 dark:border-surface-700 ${className}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between p-5 border-b border-surface-100 dark:border-surface-700">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center text-white font-semibold text-lg">
              {initials(staff.name)}
            </div>
            {status === 'on-shift' && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white dark:border-surface-800"
              >
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="w-full h-full bg-white rounded-full"
                />
              </motion.div>
            )}
          </div>
          <div>
            <h3 className="font-semibold text-surface-900 dark:text-surface-100">
              {staff.name}
            </h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs font-medium text-surface-600 dark:text-surface-400 capitalize">
                {staff.role}
              </span>
              {!staff.is_active && (
                <span className="text-xs font-medium text-slate-500">
                  • Inactive
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold text-white ${getStatusColor()}`}>
            {getStatusText()}
          </span>
          <div className="relative">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 text-surface-400 hover:text-surface-600 dark:hover:text-surface-200 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
              aria-label="More options"
            >
              <MoreVertical className="w-4 h-4" />
            </motion.button>

            {/* Dropdown Menu */}
            <AnimatePresence>
              {showMenu && (
                <>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-10"
                    onClick={() => setShowMenu(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    className="absolute right-0 top-12 z-20 w-48 bg-white dark:bg-surface-800 rounded-xl shadow-lg border border-surface-200 dark:border-surface-700 py-1"
                  >
                    <button
                      onClick={() => {
                        onEdit(staff)
                        setShowMenu(false)
                      }}
                      className="w-full px-4 py-3 text-left text-sm text-surface-700 dark:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-700 flex items-center gap-2 transition-colors"
                    >
                      <Edit3 className="w-4 h-4" />
                      Edit Staff
                    </button>
                    <button
                      onClick={() => {
                        onResetPin(staff)
                        setShowMenu(false)
                      }}
                      className="w-full px-4 py-3 text-left text-sm text-surface-700 dark:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-700 flex items-center gap-2 transition-colors"
                    >
                      <Clock className="w-4 h-4" />
                      Reset PIN
                    </button>
                    <button
                      onClick={() => {
                        onDeactivate(staff)
                        setShowMenu(false)
                      }}
                      className="w-full px-4 py-3 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 transition-colors"
                    >
                      <X className="w-4 h-4" />
                      {staff.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                   </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-5 space-y-3">
        {/* Hours Summary */}
        <div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-surface-600 dark:text-surface-400">This Week</span>
            <span className="font-semibold text-surface-900 dark:text-surface-100">
              {hoursThisWeek > 0 ? `${hoursThisWeek.toFixed(1)}h` : '0h'}
            </span>
          </div>
          {hoursToday !== undefined && (
            <div className="flex items-center justify-between text-sm mt-1">
              <span className="text-surface-600 dark:text-surface-400">Today</span>
              <span className="font-semibold text-surface-900 dark:text-surface-100">
                {hoursToday > 0 ? `${hoursToday.toFixed(1)}h` : '0h'}
              </span>
            </div>
          )}
        </div>

        {/* Contact Info */}
        <div className="flex items-center gap-2 text-sm text-surface-600 dark:text-surface-400">
          <Mail className="w-4 h-4 flex-shrink-0" />
          <span className="truncate">{staff.email || '—'}</span>
        </div>

        {/* Active Shift Info */}
        {activeShift && (
          <div className="flex items-center gap-2 text-sm text-surface-600 dark:text-surface-400">
            <Clock className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">
              {formatTime(activeShift.clock_in_time)} - Now
            </span>
            {activeShift.is_on_break && (
              <span className="inline-flex items-center gap-1 text-amber-600">
                <Coffee className="w-3 h-3" /> On Break
              </span>
            )}
          </div>
        )}

        {/* PIN Display */}
        {staff.pin && (
          <div className="flex items-center justify-between pt-3 border-t border-surface-100 dark:border-surface-700">
            <div className="flex items-center gap-2">
              <span className="text-sm text-surface-600 dark:text-surface-400">PIN:</span>
              <span className="font-mono font-semibold text-surface-900 dark:text-surface-100">
                {staff.pin}
              </span>
            </div>
            <a
              href="/staff/clock"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary-500 hover:text-primary-600 font-medium transition-colors"
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
