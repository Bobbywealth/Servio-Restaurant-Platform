import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Clock,
  User,
  Calendar,
  FileText,
  Save,
  Trash2,
  Loader2,
  AlertCircle
} from 'lucide-react'

interface Schedule {
  id?: string
  user_id: string
  shift_date: string
  shift_start_time: string
  shift_end_time: string
  position?: string
  notes?: string
  is_published?: boolean
}

interface StaffMember {
  id: string
  name: string
  role: string
}

interface ShiftEditorModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (schedule: Schedule) => Promise<void>
  onDelete?: (scheduleId: string) => Promise<void>
  schedule?: Schedule | null
  staff: StaffMember[]
  initialDate?: string
  initialTime?: string
}

const POSITIONS = [
  'Server',
  'Cook',
  'Host',
  'Manager',
  'Cashier',
  'Bartender',
  'Dishwasher',
  'Busser',
  'Other'
]

const TIME_SLOTS = Array.from({ length: 48 }, (_, i) => {
  const hours = Math.floor(i / 2)
  const minutes = (i % 2) * 30
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
})

export function ShiftEditorModal({
  isOpen,
  onClose,
  onSave,
  onDelete,
  schedule,
  staff,
  initialDate,
  initialTime
}: ShiftEditorModalProps) {
  const [formData, setFormData] = useState<Schedule>({
    user_id: '',
    shift_date: '',
    shift_start_time: '09:00',
    shift_end_time: '17:00',
    position: '',
    notes: '',
    is_published: false
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  const isEditing = !!schedule?.id

  // Initialize form when modal opens
  useEffect(() => {
    if (isOpen) {
      if (schedule) {
        setFormData({
          id: schedule.id,
          user_id: schedule.user_id,
          shift_date: schedule.shift_date,
          shift_start_time: schedule.shift_start_time,
          shift_end_time: schedule.shift_end_time,
          position: schedule.position || '',
          notes: schedule.notes || '',
          is_published: schedule.is_published || false
        })
      } else {
        const today = new Date().toISOString().split('T')[0]
        setFormData({
          user_id: staff[0]?.id || '',
          shift_date: initialDate || today,
          shift_start_time: initialTime || '09:00',
          shift_end_time: '17:00',
          position: '',
          notes: '',
          is_published: false
        })
      }
      setError(null)
      setDeleteConfirm(false)
    }
  }, [isOpen, schedule, initialDate, initialTime, staff])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validate form data
    if (!formData.user_id || formData.user_id.trim() === '') {
      setError('Please select a staff member')
      return
    }

    if (!formData.shift_date || formData.shift_date.trim() === '') {
      setError('Please select a date')
      return
    }

    if (!formData.shift_start_time || !formData.shift_end_time) {
      setError('Please select start and end times')
      return
    }

    if (formData.shift_start_time >= formData.shift_end_time) {
      setError('End time must be after start time')
      return
    }

    setLoading(true)
    try {
      await onSave(formData)
      onClose()
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to save shift')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!schedule?.id || !onDelete) return

    setLoading(true)
    try {
      await onDelete(schedule.id)
      onClose()
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to delete shift')
    } finally {
      setLoading(false)
    }
  }

  const formatTimeForDisplay = (time: string) => {
    const [hours, minutes] = time.split(':')
    const h = parseInt(hours)
    const ampm = h >= 12 ? 'PM' : 'AM'
    const hour12 = h % 12 || 12
    return `${hour12}:${minutes} ${ampm}`
  }

  const getInitials = (name: string) =>
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(p => p[0]?.toUpperCase())
      .join('')

  // Calculate shift duration
  const getShiftDuration = () => {
    const start = parseInt(formData.shift_start_time.split(':')[0]) + parseInt(formData.shift_start_time.split(':')[1]) / 60
    const end = parseInt(formData.shift_end_time.split(':')[0]) + parseInt(formData.shift_end_time.split(':')[1]) / 60
    const diff = end - start
    const hours = Math.floor(diff)
    const minutes = Math.round((diff - hours) * 60)
    if (hours < 0) return 'Next day'
    if (hours === 0 && minutes === 0) return '0h'
    return `${hours}h ${minutes > 0 ? `${minutes}m` : ''}`
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
          onClick={onClose}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative bg-white dark:bg-surface-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-surface-200 dark:border-surface-700">
            <h2 className="text-xl font-bold text-surface-900 dark:text-surface-100">
              {isEditing ? 'Edit Shift' : 'Add Shift'}
            </h2>
            <button
              onClick={onClose}
              className="p-2 text-surface-400 hover:text-surface-600 dark:hover:text-surface-200 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {error && (
              <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 dark:bg-red-900/20 px-4 py-3 rounded-xl">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Staff Selection */}
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                Staff Member
              </label>
              <select
                value={formData.user_id}
                onChange={(e) => setFormData({ ...formData, user_id: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100 focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-all outline-none"
              >
                <option value="">Select staff member...</option>
                {staff.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name} ({member.role})
                  </option>
                ))}
              </select>
            </div>

            {/* Date Selection */}
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                Date
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-surface-400" />
                <input
                  type="date"
                  value={formData.shift_date}
                  onChange={(e) => setFormData({ ...formData, shift_date: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100 focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-all outline-none"
                />
              </div>
            </div>

            {/* Time Selection */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                  Start Time *
                </label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-surface-400" />
                  <select
                    value={formData.shift_start_time}
                    onChange={(e) => setFormData({ ...formData, shift_start_time: e.target.value })}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100 focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-all outline-none"
                  >
                    {TIME_SLOTS.map((time) => (
                      <option key={time} value={time}>
                        {formatTimeForDisplay(time)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                  End Time *
                </label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-surface-400" />
                  <select
                    value={formData.shift_end_time}
                    onChange={(e) => setFormData({ ...formData, shift_end_time: e.target.value })}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100 focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-all outline-all"
                  >
                    {TIME_SLOTS.map((time) => (
                      <option key={time} value={time}>
                        {formatTimeForDisplay(time)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Duration Preview */}
            <div className="text-center text-sm text-surface-500 dark:text-surface-400 bg-surface-100 dark:bg-surface-700 rounded-lg py-2">
              Duration: <span className="font-medium text-surface-700 dark:text-surface-200">{getShiftDuration()}</span>
            </div>

            {/* Position Selection */}
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                Position
              </label>
              <select
                value={formData.position || ''}
                onChange={(e) => setFormData({ ...formData, position: e.target.value || undefined })}
                className="w-full px-4 py-3 rounded-xl border border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100 focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-all outline-none"
              >
                <option value="">Select position...</option>
                {POSITIONS.map((pos) => (
                  <option key={pos} value={pos}>
                    {pos}
                  </option>
                ))}
              </select>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                Notes
              </label>
              <div className="relative">
                <FileText className="absolute left-3 top-3 w-5 h-5 text-surface-400" />
                <textarea
                  value={formData.notes || ''}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Add any notes for this shift..."
                  rows={2}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100 focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-all outline-none resize-none"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              {isEditing && onDelete && (
                <button
                  type="button"
                  onClick={() => deleteConfirm ? handleDelete() : setDeleteConfirm(true)}
                  disabled={loading}
                  className={`px-4 py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors ${
                    deleteConfirm
                      ? 'bg-red-500 hover:bg-red-600 text-white'
                      : 'border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
                  }`}
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : deleteConfirm ? (
                    'Confirm Delete'
                  ) : (
                    <>
                      <Trash2 className="w-5 h-5" />
                      Delete
                    </>
                  )}
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-3 rounded-xl border border-surface-200 dark:border-surface-600 text-surface-700 dark:text-surface-300 font-medium hover:bg-surface-50 dark:hover:bg-surface-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white font-medium hover:from-orange-600 hover:to-orange-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    {isEditing ? 'Save Changes' : 'Create Shift'}
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

export default ShiftEditorModal
