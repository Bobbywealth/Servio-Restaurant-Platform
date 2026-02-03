import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Clock,
  Calendar,
  AlertCircle,
  LogIn,
  LogOut,
  Coffee,
  User
} from 'lucide-react'

interface StaffUser {
  id: string
  name: string
  role: string
  position?: string | null
}

interface QuickTimeActionModalProps {
  isOpen: boolean
  staffMember: StaffUser | null
  action: 'clock-in' | 'clock-out' | 'start-break' | 'end-break'
  onAction: (userId: string, time: Date, reason?: string) => Promise<void>
  onClose: () => void
}

export function QuickTimeActionModal({
  isOpen,
  staffMember,
  action,
  onAction,
  onClose
}: QuickTimeActionModalProps) {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [selectedTime, setSelectedTime] = useState(new Date().toTimeString().slice(0, 5))
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const getActionTitle = () => {
    switch (action) {
      case 'clock-in':
        return 'Clock In Staff'
      case 'clock-out':
        return 'Clock Out Staff'
      case 'start-break':
        return 'Start Break'
      case 'end-break':
        return 'End Break'
      default:
        return 'Quick Action'
    }
  }

  const getActionIcon = () => {
    switch (action) {
      case 'clock-in':
        return <LogIn className="w-6 h-6" />
      case 'clock-out':
        return <LogOut className="w-6 h-6" />
      case 'start-break':
      case 'end-break':
        return <Coffee className="w-6 h-6" />
      default:
        return <Clock className="w-6 h-6" />
    }
  }

  const getActionColor = () => {
    switch (action) {
      case 'clock-in':
        return 'bg-green-500'
      case 'clock-out':
        return 'bg-red-500'
      case 'start-break':
      case 'end-break':
        return 'bg-yellow-500'
      default:
        return 'bg-primary-500'
    }
  }

  const isBackdated = () => {
    const selected = new Date(`${selectedDate}T${selectedTime}`)
    const now = new Date()
    return selected < now
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!staffMember) return

    // Require reason for backdated actions
    if (isBackdated() && !reason.trim()) {
      setError('Please provide a reason for backdating this action')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const dateTime = new Date(`${selectedDate}T${selectedTime}`)
      await onAction(staffMember.id, dateTime, reason)
      onClose()
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Action failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const formatDateTime = () => {
    const date = new Date(`${selectedDate}T${selectedTime}`)
    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
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
          onClick={onClose}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative bg-white dark:bg-surface-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center gap-4 px-6 py-4 border-b border-gray-200 dark:border-surface-700">
            <div className={`p-3 rounded-xl ${getActionColor()}`}>
              <div className="text-white">
                {getActionIcon()}
              </div>
            </div>
            <div>
              <h2 className="text-xl font-bold text-surface-900 dark:text-surface-100">
                {getActionTitle()}
              </h2>
              <div className="flex items-center gap-2 text-sm text-surface-600 dark:text-surface-400">
                <User className="w-4 h-4" />
                <span>{staffMember.name}</span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="ml-auto p-2 text-surface-400 hover:text-surface-600 dark:hover:text-surface-200 rounded-lg hover:bg-gray-100 dark:hover:bg-surface-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="p-6 space-y-4">
              {/* Error message */}
              {error && (
                <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 dark:bg-red-900/20 px-4 py-3 rounded-xl">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Time Selection */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                    <Calendar className="w-4 h-4 inline mr-1" />
                    Date
                  </label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    max={new Date().toISOString().split('T')[0]}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-surface-600 bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100 focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-all outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                    <Clock className="w-4 h-4 inline mr-1" />
                    Time
                  </label>
                  <input
                    type="time"
                    value={selectedTime}
                    onChange={(e) => setSelectedTime(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-surface-600 bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100 focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-all outline-none"
                  />
                </div>
              </div>

              {/* Preview */}
              <div className="bg-gray-50 dark:bg-surface-700 rounded-xl p-4">
                <div className="text-sm text-surface-600 dark:text-surface-400 mb-1">
                  Action will be recorded at:
                </div>
                <div className="text-lg font-bold text-surface-900 dark:text-surface-100">
                  {formatDateTime()}
                </div>
              </div>

              {/* Reason for backdating */}
              {isBackdated() && (
                <div>
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                    <AlertCircle className="w-4 h-4 inline mr-1" />
                    Reason for backdating (required)
                  </label>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Explain why this action is being recorded retroactively..."
                    rows={3}
                    required={isBackdated()}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-surface-600 bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100 focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-all outline-none resize-none"
                  />
                </div>
              )}

              {/* Info notice for backdating */}
              {isBackdated() && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-amber-800 dark:text-amber-200">
                      <p className="font-medium">This action will be backdated.</p>
                      <p className="mt-1 opacity-80">
                        A reason is required and this change will be logged for audit purposes.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex gap-3 px-6 py-4 border-t border-gray-200 dark:border-surface-700">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-3 rounded-xl border border-gray-200 dark:border-surface-600 text-surface-700 dark:text-surface-300 font-medium hover:bg-gray-50 dark:hover:bg-surface-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || (isBackdated() && !reason.trim())}
                className={`flex-1 px-4 py-3 rounded-xl text-white font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2 ${getActionColor()}`}
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    {getActionIcon()}
                    Confirm {action === 'clock-in' ? 'Clock In' : action === 'clock-out' ? 'Clock Out' : action === 'start-break' ? 'Start Break' : 'End Break'}
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}

export default QuickTimeActionModal
