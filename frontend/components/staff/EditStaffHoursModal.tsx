import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Clock,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Calendar,
  Save,
  X,
  AlertTriangle,
  CheckCircle,
  Loader2,
  AlertCircle,
  ChevronUp
} from 'lucide-react'
import { api } from '../../lib/api'

interface StaffUser {
  id: string
  name: string
  role: string
}

interface TimeEntry {
  id: string
  user_id: string
  user_name: string
  user_role: string
  clock_in_time: string
  clock_out_time?: string
  break_minutes: number
  total_hours?: number
  position?: string | null
  notes?: string | null
}

interface EditStaffHoursModalProps {
  isOpen: boolean
  staffMember: StaffUser | null
  currentUserRole: string
  onClose: () => void
  onRefresh: () => void
}

export default function EditStaffHoursModal({
  isOpen,
  staffMember,
  currentUserRole,
  onClose,
  onRefresh
}: EditStaffHoursModalProps) {
  const [weekOffset, setWeekOffset] = useState(0)
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [expandedRow, setExpandedRow] = useState<string | null>(null)
  const [isEditingActiveEntry, setIsEditingActiveEntry] = useState(false)

  const [editForm, setEditForm] = useState({
    clockInTime: '',
    clockOutTime: '',
    breakMinutes: '',
    position: '',
    notes: ''
  })

  const [formErrors, setFormErrors] = useState({
    clockInTime: '',
    clockOutTime: ''
  })

  const [overlapWarning, setOverlapWarning] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && staffMember) {
      loadTimeEntries()
      setWeekOffset(0)
      setExpandedRow(null)
    }
  }, [isOpen, staffMember])

  useEffect(() => {
    if (isOpen && staffMember) {
      loadTimeEntries()
    }
  }, [weekOffset])

  const getWeekStart = (date: Date) => {
    const d = new Date(date)
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    return new Date(d.setDate(diff))
  }

  const getWeekRange = (offset: number) => {
    const startOfWeek = getWeekStart(new Date())
    startOfWeek.setDate(startOfWeek.getDate() + (offset * 7))
    startOfWeek.setHours(0, 0, 0, 0)

    const endOfWeek = new Date(startOfWeek)
    endOfWeek.setDate(endOfWeek.getDate() + 6)
    endOfWeek.setHours(23, 59, 59, 999)

    return { start: startOfWeek, end: endOfWeek }
  }

  const formatDateRange = () => {
    const { start, end } = getWeekRange(weekOffset)
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }
    return `${start.toLocaleDateString('en-US', options)} - ${end.toLocaleDateString('en-US', options)}`
  }

  const loadTimeEntries = async () => {
    if (!staffMember) return

    setIsLoading(true)
    setError(null)
    try {
      const { start, end } = getWeekRange(weekOffset)
      const response = await api.get('/api/timeclock/entries', {
        params: {
          userId: staffMember.id,
          startDate: start.toISOString().split('T')[0],
          endDate: end.toISOString().split('T')[0],
          limit: 100
        }
      })
      setTimeEntries(response.data?.data?.entries || [])
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load time entries')
    } finally {
      setIsLoading(false)
    }
  }

  const openEditForm = (entry: TimeEntry) => {
    setExpandedRow(entry.id)
    setIsEditingActiveEntry(!entry.clock_out_time)
    setEditForm({
      clockInTime: toLocalDateTime(entry.clock_in_time),
      clockOutTime: entry.clock_out_time ? toLocalDateTime(entry.clock_out_time) : '',
      breakMinutes: entry.break_minutes.toString(),
      position: entry.position || '',
      notes: entry.notes || ''
    })
    setFormErrors({ clockInTime: '', clockOutTime: '' })
    setOverlapWarning(null)
  }

  const closeEditForm = () => {
    setExpandedRow(null)
    setIsEditingActiveEntry(false)
    setEditForm({
      clockInTime: '',
      clockOutTime: '',
      breakMinutes: '',
      position: '',
      notes: ''
    })
    setFormErrors({ clockInTime: '', clockOutTime: '' })
    setOverlapWarning(null)
  }

  const toLocalDateTime = (isoString: string) => {
    const date = new Date(isoString)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day}T${hours}:${minutes}`
  }

  const fromLocalDateTime = (dateTimeString: string) => {
    if (!dateTimeString) return null
    return new Date(dateTimeString).toISOString()
  }

  const calculateTotalHours = () => {
    if (!editForm.clockInTime || !editForm.clockOutTime) return 0
    const clockIn = new Date(editForm.clockInTime)
    const clockOut = new Date(editForm.clockOutTime)
    if (clockOut <= clockIn) return 0
    const totalMinutes = Math.floor((clockOut.getTime() - clockIn.getTime()) / (1000 * 60))
    const breakMinutes = parseInt(editForm.breakMinutes) || 0
    return Math.max(0, (totalMinutes - breakMinutes) / 60)
  }

  const validateForm = () => {
    const errors = { clockInTime: '', clockOutTime: '' }
    let isValid = true

    if (!editForm.clockInTime) {
      errors.clockInTime = 'Clock in time is required'
      isValid = false
    }

    if (!editForm.clockOutTime) {
      if (!isEditingActiveEntry) {
        errors.clockOutTime = 'Clock out time is required'
        isValid = false
      }
    } else if (editForm.clockInTime && new Date(editForm.clockOutTime) <= new Date(editForm.clockInTime)) {
      errors.clockOutTime = 'Clock out must be after clock in'
      isValid = false
    }

    setFormErrors(errors)
    return isValid
  }

  const checkOverlappingEntries = () => {
    if (!editForm.clockInTime || !editForm.clockOutTime) return null
    if (!expandedRow) return null

    const newStart = new Date(editForm.clockInTime)
    const newEnd = new Date(editForm.clockOutTime)

    const overlaps = timeEntries.filter(entry => {
      if (entry.id === expandedRow) return false
      if (!entry.clock_in_time || !entry.clock_out_time) return false

      const existingStart = new Date(entry.clock_in_time)
      const existingEnd = new Date(entry.clock_out_time)

      return (
        (newStart < existingEnd && newEnd > existingStart)
      )
    })

    if (overlaps.length > 0) {
      return `This entry overlaps with ${overlaps.length} other shift${overlaps.length > 1 ? 's' : ''}. Saving will create duplicate time for this period.`
    }
    return null
  }

  const handleSave = async () => {
    if (!validateForm()) return

    const warning = checkOverlappingEntries()
    if (warning) {
      setOverlapWarning(warning)
    }

    setActionLoading(expandedRow)
    setError(null)
    setSuccess(null)

    try {
      const response = await api.put(`/api/timeclock/entries/${expandedRow}`, {
        clockInTime: fromLocalDateTime(editForm.clockInTime),
        clockOutTime: editForm.clockOutTime ? fromLocalDateTime(editForm.clockOutTime) : undefined,
        breakMinutes: parseInt(editForm.breakMinutes) || 0,
        position: editForm.position || undefined,
        notes: editForm.notes || undefined
      })

      if (response.data.success) {
        setSuccess('Time entry updated successfully')
        closeEditForm()
        onRefresh()
        setTimeout(() => {
          loadTimeEntries()
          setSuccess(null)
        }, 500)
      } else {
        setError(response.data.error?.message || 'Failed to update time entry')
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to update time entry')
    } finally {
      setActionLoading(null)
    }
  }

  const handleWeekChange = (direction: 'prev' | 'next') => {
    setWeekOffset(prev => prev + (direction === 'next' ? 1 : -1))
    setExpandedRow(null)
    closeEditForm()
  }

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
  }

  const formatDuration = (hours: number) => {
    const h = Math.floor(hours)
    const m = Math.round((hours - h) * 60)
    if (h === 0) return `${m}m`
    if (m === 0) return `${h}h`
    return `${h}h ${m}m`
  }

  if (!isOpen || !staffMember) return null

  const canEdit = ['manager', 'admin', 'owner'].includes(currentUserRole)

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
          className="relative bg-white dark:bg-surface-800 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col"
        >
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-surface-700 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
                  <Clock className="w-5 h-5 text-primary-500" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-surface-900 dark:text-surface-100">
                    Edit Hours
                  </h2>
                  <p className="text-sm text-surface-600 dark:text-surface-400">
                    {staffMember.name}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-surface-400 hover:text-surface-600 dark:hover:text-surface-200 rounded-lg hover:bg-gray-100 dark:hover:bg-surface-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-4 border-b border-gray-200 dark:border-surface-700 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleWeekChange('prev')}
                  disabled={weekOffset <= -12}
                  className="p-2 text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-100 rounded-lg hover:bg-gray-100 dark:hover:bg-surface-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 dark:bg-surface-700 rounded-lg">
                  <Calendar className="w-4 h-4 text-surface-500" />
                  <span className="text-sm font-medium text-surface-900 dark:text-surface-100">
                    {formatDateRange()}
                  </span>
                </div>
                <button
                  onClick={() => handleWeekChange('next')}
                  disabled={weekOffset >= 0}
                  className="p-2 text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-100 rounded-lg hover:bg-gray-100 dark:hover:bg-surface-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
              <button
                onClick={() => {
                  setWeekOffset(0)
                  setExpandedRow(null)
                  closeEditForm()
                }}
                className="text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                This Week
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {error && (
                <div className="mb-4 flex items-center gap-2 text-red-600 text-sm bg-red-50 dark:bg-red-900/20 px-4 py-3 rounded-xl">
                  <AlertCircle className="w-5 h-5" />
                  <span>{error}</span>
                </div>
              )}

              {success && (
                <div className="mb-4 flex items-center gap-2 text-green-600 text-sm bg-green-50 dark:bg-green-900/20 px-4 py-3 rounded-xl">
                  <CheckCircle className="w-5 h-5" />
                  <span>{success}</span>
                </div>
              )}

              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
                </div>
              ) : timeEntries.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Clock className="w-16 h-16 text-surface-300 mb-4" />
                  <h3 className="text-lg font-medium text-surface-900 dark:text-surface-100 mb-2">
                    No Time Entries
                  </h3>
                  <p className="text-surface-600 dark:text-surface-400">
                    No time entries found for this week
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-7 gap-4 px-4 py-2 text-xs font-medium text-surface-600 dark:text-surface-400 uppercase tracking-wide">
                    <div>Date</div>
                    <div>Clock In</div>
                    <div>Clock Out</div>
                    <div>Break</div>
                    <div>Hours</div>
                    <div>Position</div>
                    <div className="text-right">Actions</div>
                  </div>

                  {timeEntries.map((entry) => {
                    const isExpanded = expandedRow === entry.id
                    const isActiveEntry = !entry.clock_out_time

                    return (
                      <motion.div
                        key={entry.id}
                        className="border border-gray-200 dark:border-surface-700 rounded-xl overflow-hidden"
                        initial={false}
                        animate={{
                          height: isExpanded ? 'auto' : 'auto',
                          backgroundColor: isExpanded ? 'rgba(99, 102, 241, 0.05)' : 'transparent'
                        }}
                      >
                        <button
                          onClick={() => canEdit && openEditForm(entry)}
                          className="w-full px-4 py-3 grid grid-cols-7 gap-4 items-center hover:bg-gray-50 dark:hover:bg-surface-700 transition-colors disabled:cursor-not-allowed"
                          disabled={!canEdit}
                        >
                          <div className="text-sm font-medium text-surface-900 dark:text-surface-100">
                            {formatDateTime(entry.clock_in_time).split(', ')[0]}
                          </div>
                          <div className="text-sm text-surface-600 dark:text-surface-400">
                            {formatDateTime(entry.clock_in_time).split(', ')[1]}
                          </div>
                          <div className="text-sm text-surface-600 dark:text-surface-400">
                            {entry.clock_out_time ? formatDateTime(entry.clock_out_time).split(', ')[1] : (
                              <span className="inline-flex items-center gap-1 text-amber-600">
                                <Loader2 className="w-3 h-3" />
                                Active
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-surface-600 dark:text-surface-400">
                            {entry.break_minutes}m
                          </div>
                          <div className="text-sm font-medium text-surface-900 dark:text-surface-100">
                            {entry.total_hours ? formatDuration(Number(entry.total_hours)) : '-'}
                          </div>
                          <div className="text-sm text-surface-600 dark:text-surface-400">
                            {entry.position || '-'}
                          </div>
                          <div className="text-right">
                            {canEdit ? (
                              <button className="text-primary-600 hover:text-primary-700 text-sm font-medium">
                                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              </button>
                            ) : (
                              <span className="text-xs text-surface-400">No Access</span>
                            )}
                          </div>
                        </button>

                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="px-4 pb-4 pt-2 border-t border-gray-200 dark:border-surface-700"
                            >
                              <div className="space-y-4">
                                {overlapWarning && (
                                  <div className="flex items-start gap-2 text-amber-700 text-sm bg-amber-50 dark:bg-amber-900/20 px-4 py-3 rounded-xl">
                                    <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                                    <div>
                                      <p className="font-medium">Warning: Overlapping Shift</p>
                                      <p className="mt-1">{overlapWarning}</p>
                                    </div>
                                  </div>
                                )}

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div>
                                    <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                                      Clock In Time
                                    </label>
                                    <input
                                      type="datetime-local"
                                      value={editForm.clockInTime}
                                      onChange={(e) => {
                                        setEditForm({ ...editForm, clockInTime: e.target.value })
                                        if (formErrors.clockInTime) {
                                          setFormErrors({ ...formErrors, clockInTime: '' })
                                        }
                                      }}
                                      className={`w-full px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none dark:bg-surface-700 dark:text-surface-100 ${
                                        formErrors.clockInTime
                                          ? 'border-red-300 focus:border-red-500 dark:border-red-700'
                                          : 'border-gray-200 dark:border-surface-600'
                                      }`}
                                    />
                                    {formErrors.clockInTime && (
                                      <p className="text-red-600 text-xs mt-1">{formErrors.clockInTime}</p>
                                    )}
                                  </div>

                                  <div>
                                    <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                                      Clock Out Time
                                    </label>
                                    <input
                                      type="datetime-local"
                                      value={editForm.clockOutTime}
                                      onChange={(e) => {
                                        setEditForm({ ...editForm, clockOutTime: e.target.value })
                                        if (formErrors.clockOutTime) {
                                          setFormErrors({ ...formErrors, clockOutTime: '' })
                                        }
                                      }}
                                      className={`w-full px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none dark:bg-surface-700 dark:text-surface-100 ${
                                        formErrors.clockOutTime
                                          ? 'border-red-300 focus:border-red-500 dark:border-red-700'
                                          : 'border-gray-200 dark:border-surface-600'
                                      }`}
                                    />
                                    {formErrors.clockOutTime && (
                                      <p className="text-red-600 text-xs mt-1">{formErrors.clockOutTime}</p>
                                    )}
                                    {isEditingActiveEntry && !formErrors.clockOutTime && (
                                      <p className="text-xs text-surface-500 mt-1">
                                        Leave blank to keep this shift active.
                                      </p>
                                    )}
                                  </div>

                                  <div>
                                    <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                                      Break Minutes
                                    </label>
                                    <input
                                      type="number"
                                      value={editForm.breakMinutes}
                                      onChange={(e) => setEditForm({ ...editForm, breakMinutes: e.target.value })}
                                      min="0"
                                      max="1440"
                                      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-surface-600 bg-white dark:bg-surface-700 text-sm focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none dark:text-surface-100"
                                    />
                                  </div>

                                  <div>
                                    <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                                      Total Hours
                                    </label>
                                    <div className="px-3 py-2 rounded-lg bg-gray-50 dark:bg-surface-600 text-sm font-medium text-surface-900 dark:text-surface-100">
                                      {formatDuration(calculateTotalHours())}
                                    </div>
                                  </div>
                                </div>

                                <div>
                                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                                    Position
                                  </label>
                                  <input
                                    type="text"
                                    value={editForm.position}
                                    onChange={(e) => setEditForm({ ...editForm, position: e.target.value })}
                                    placeholder="e.g., Server, Cook, Cashier"
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-surface-600 bg-white dark:bg-surface-700 text-sm focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none dark:text-surface-100"
                                  />
                                </div>

                                <div>
                                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                                    Notes
                                  </label>
                                  <textarea
                                    value={editForm.notes}
                                    onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                                    placeholder="Add notes about this entry..."
                                    rows={3}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-surface-600 bg-white dark:bg-surface-700 text-sm focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none resize-none dark:text-surface-100"
                                  />
                                </div>

                                <div className="flex gap-3 pt-2">
                                  <button
                                    onClick={closeEditForm}
                                    disabled={actionLoading !== null}
                                    className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 dark:border-surface-600 text-surface-700 dark:text-surface-300 font-medium hover:bg-gray-50 dark:hover:bg-surface-700 transition-colors disabled:opacity-50"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    onClick={handleSave}
                                    disabled={actionLoading !== null}
                                    className="flex-1 px-4 py-2.5 rounded-lg bg-primary-500 hover:bg-primary-600 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                  >
                                    {actionLoading !== null ? (
                                      <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Saving...
                                      </>
                                    ) : (
                                      <>
                                        <Save className="w-4 h-4" />
                                        Save Changes
                                      </>
                                    )}
                                  </button>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
