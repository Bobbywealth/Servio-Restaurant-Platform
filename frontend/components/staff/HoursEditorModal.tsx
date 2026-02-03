import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  ChevronLeft,
  ChevronRight,
  Clock,
  Coffee,
  Edit3,
  Trash2,
  Plus,
  Calendar,
  Save,
  AlertCircle
} from 'lucide-react'
import { api } from '../../lib/api'

interface StaffUser {
  id: string
  name: string
  email?: string | null
  role: string
  pin?: string | null
  is_active: boolean
}

interface TimeEntry {
  id: string
  clock_in_time: string
  clock_out_time: string | null
  break_minutes: number
  total_hours: number | null
  position: string | null
  notes: string | null
  is_break?: boolean
}

interface Break {
  id: string
  break_start: string
  break_end: string | null
  duration_minutes: number | null
}

interface HoursEditorModalProps {
  isOpen: boolean
  staffMember: StaffUser | null
  onClose: () => void
  onSave: () => void
}

const formatLocalDate = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const formatLocalDateTime = (dateString: string, timeString: string) => {
  return `${dateString}T${timeString}:00`
}

const addDays = (dateString: string, days: number) => {
  const base = new Date(`${dateString}T00:00:00`)
  base.setDate(base.getDate() + days)
  return formatLocalDate(base)
}

export function HoursEditorModal({ isOpen, staffMember, onClose, onSave }: HoursEditorModalProps) {
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(getWeekStart(new Date()))
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [breaks, setBreaks] = useState<Record<string, Break[]>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null)
  const [deletingEntry, setDeletingEntry] = useState<string | null>(null)

  // Get start of week (Monday)
  function getWeekStart(date: Date): Date {
    const d = new Date(date)
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    d.setDate(diff)
    d.setHours(0, 0, 0, 0)
    return d
  }

  // Get dates for the current week
  const getWeekDates = (weekStart: Date): Date[] => {
    const dates: Date[] = []
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart)
      date.setDate(weekStart.getDate() + i)
      dates.push(date)
    }
    return dates
  }

  const weekDates = getWeekDates(currentWeekStart)
  const weekStartDate = formatLocalDate(currentWeekStart)
  const weekEndDate = new Date(currentWeekStart).setDate(currentWeekStart.getDate() + 6)
  const weekEndDateStr = formatLocalDate(new Date(weekEndDate))

  // Fetch entries for the current week
  useEffect(() => {
    if (!isOpen || !staffMember) return

    const fetchEntries = async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await api.get('/api/timeclock/entries', {
          params: {
            userId: staffMember.id,
            startDate: weekStartDate,
            endDate: weekEndDateStr,
            status: 'all',
            limit: 100
          }
        })

        const entriesData = response.data?.data?.entries || []
        setEntries(entriesData)

        // Fetch breaks for each entry
        const breaksMap: Record<string, Break[]> = {}
        for (const entry of entriesData) {
          const breaksResp = await api.get(`/api/timeclock/entry-breaks/${entry.id}`)
          breaksMap[entry.id] = breaksResp.data?.data?.breaks || []
        }
        setBreaks(breaksMap)
      } catch (err: any) {
        setError(err.response?.data?.error?.message || 'Failed to load hours')
      } finally {
        setLoading(false)
      }
    }

    fetchEntries()
  }, [isOpen, staffMember, weekStartDate, weekEndDateStr])

  // Get entries for a specific date
  const getEntriesForDate = (date: Date): TimeEntry[] => {
    const dateStr = formatLocalDate(date)
    return entries.filter(entry => {
      const entryDate = formatLocalDate(new Date(entry.clock_in_time))
      return entryDate === dateStr
    })
  }

  // Navigate weeks
  const goToPreviousWeek = () => {
    const newStart = new Date(currentWeekStart)
    newStart.setDate(newStart.getDate() - 7)
    setCurrentWeekStart(newStart)
  }

  const goToNextWeek = () => {
    const newStart = new Date(currentWeekStart)
    newStart.setDate(newStart.getDate() + 7)
    setCurrentWeekStart(newStart)
  }

  const goToCurrentWeek = () => {
    setCurrentWeekStart(getWeekStart(new Date()))
  }

  // Format time for display
  const formatTime = (dateString: string | null) => {
    if (!dateString) return '--:--'
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Format hours
  const formatHours = (hours: number | null) => {
    if (hours === null) return '--'
    const h = Math.floor(hours)
    const m = Math.round((hours - h) * 60)
    if (h === 0) return `${m}m`
    if (m === 0) return `${h}h`
    return `${h}h ${m}m`
  }

  // Handle save entry
  const handleSaveEntry = async (entryData: Partial<TimeEntry>) => {
    if (!staffMember) return

    setSaving(true)
    setError(null)

    try {
      let savedEntryId = null

      if (editingEntry && editingEntry.id) {
        // Update existing entry
        await api.put(`/api/timeclock/entries/${editingEntry.id}`, {
          clockInTime: entryData.clock_in_time,
          clockOutTime: entryData.clock_out_time,
          breakMinutes: entryData.break_minutes,
          position: entryData.position,
          notes: entryData.notes
        })
        savedEntryId = editingEntry.id
      } else {
        // Create new entry with both clock-in and clock-out times
        const createResponse = await api.post('/api/timeclock/entries', {
          userId: staffMember.id,
          clockInTime: entryData.clock_in_time,
          clockOutTime: entryData.clock_out_time,
          breakMinutes: entryData.break_minutes,
          notes: entryData.notes
        })

        savedEntryId = createResponse.data?.data?.id
      }

      // Refresh entries
      const response = await api.get('/api/timeclock/entries', {
        params: {
          userId: staffMember.id,
          startDate: weekStartDate,
          endDate: weekEndDateStr,
          status: 'all',
          limit: 100
        }
      })

      setEntries(response.data?.data?.entries || [])
      setEditingEntry(null)
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to save entry')
    } finally {
      setSaving(false)
    }
  }

  // Handle delete entry
  const handleDeleteEntry = async (entryId: string) => {
    if (!confirm('Are you sure you want to delete this time entry?')) return

    setDeletingEntry(entryId)
    try {
      await api.post('/api/timeclock/manager/reverse-entry', {
        entryId,
        reason: 'Deleted from hours editor'
      })

      // Refresh entries
      if (!staffMember) return
      const response = await api.get('/api/timeclock/entries', {
        params: {
          userId: staffMember.id,
          startDate: weekStartDate,
          endDate: weekEndDateStr,
          status: 'all',
          limit: 100
        }
      })
      setEntries(response.data?.data?.entries || [])
    } catch (err: any) {
      console.error('Delete entry error:', err)
      const errorMessage = err.response?.data?.error?.message || 
                          err.response?.data?.message || 
                          err.message || 
                          'Failed to delete entry'
      setError(errorMessage)
    } finally {
      setDeletingEntry(null)
    }
  }

  // Get day total hours
  const getDayTotal = (date: Date): number => {
    const dateStr = formatLocalDate(date)
    const dayEntries = entries.filter(entry => {
      const entryDate = formatLocalDate(new Date(entry.clock_in_time))
      return entryDate === dateStr && entry.clock_out_time !== null
    })
    return dayEntries.reduce((sum, entry) => sum + (entry.total_hours || 0), 0)
  }

  // Calculate week total
  const weekTotal = entries.reduce((sum, entry) => sum + (entry.total_hours || 0), 0)

  // Format date for header
  const formatDateRange = () => {
    const start = currentWeekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const end = new Date(currentWeekStart).setDate(currentWeekStart.getDate() + 6)
    const endStr = new Date(end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    return `${start} - ${endStr}`
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
          className="relative bg-white dark:bg-surface-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-surface-700">
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-bold text-surface-900 dark:text-surface-100">
                Edit Hours
              </h2>
              <div className="text-sm text-surface-600 dark:text-surface-400">
                {staffMember.name}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-surface-400 hover:text-surface-600 dark:hover:text-surface-200 rounded-lg hover:bg-gray-100 dark:hover:bg-surface-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Error message */}
          {error && (
            <div className="mx-6 mt-4 flex items-center gap-2 text-red-500 text-sm bg-red-50 dark:bg-red-900/20 px-4 py-3 rounded-xl">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Week Navigation */}
          <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 dark:border-surface-700">
            <div className="flex items-center gap-2">
              <button
                onClick={goToPreviousWeek}
                className="p-2 hover:bg-gray-100 dark:hover:bg-surface-700 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={goToCurrentWeek}
                className="px-3 py-1.5 text-sm font-medium text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
              >
                Today
              </button>
              <button
                onClick={goToNextWeek}
                className="p-2 hover:bg-gray-100 dark:hover:bg-surface-700 rounded-lg transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
            <div className="text-sm font-medium text-surface-700 dark:text-surface-300">
              {formatDateRange()}
            </div>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-surface-600 dark:text-surface-400">Week Total:</span>
                <span className="font-bold text-surface-900 dark:text-surface-100">
                  {formatHours(weekTotal)}
                </span>
              </div>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="flex-1 overflow-auto p-4 sm:p-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
              </div>
            ) : (
              <div className="space-y-4">
                {/* Day headers - responsive grid */}
                <div className="grid grid-cols-7 gap-2 min-w-[800px]">
                  {weekDates.map((date, idx) => {
                    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' })
                    const isToday = date.toDateString() === new Date().toDateString()
                    return (
                      <div
                        key={idx}
                        className={`text-center py-2 px-1 rounded-lg ${
                          isToday
                            ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                            : 'bg-gray-50 dark:bg-surface-700'
                        }`}
                      >
                        <div className="text-xs sm:text-sm font-medium text-surface-600 dark:text-surface-400">
                          {dayName.slice(0, 3)}
                        </div>
                        <div className={`text-sm sm:text-base font-bold mt-1 ${
                          isToday
                            ? 'text-primary-600 dark:text-primary-400'
                            : 'text-surface-900 dark:text-surface-100'
                        }`}>
                          {date.getDate()}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Day rows - scrollable on mobile */}
                <div className="overflow-x-auto min-w-[800px]">
                  <div className="grid grid-cols-7 gap-2 min-w-full">
                    {weekDates.map((date, idx) => {
                      const dayEntries = getEntriesForDate(date)
                      const dayTotal = getDayTotal(date)
                      const isToday = date.toDateString() === new Date().toDateString()
                      const isFuture = date > new Date()
                      const isWeekend = idx >= 5

                      return (
                        <div
                          key={idx}
                          className={`min-h-[220px] sm:min-h-[200px] rounded-lg border ${
                            isToday
                              ? 'border-primary-300 dark:border-primary-700 bg-primary-50/50 dark:bg-primary-900/10'
                              : 'border-gray-200 dark:border-surface-700 bg-white dark:bg-surface-800'
                          } ${isFuture ? 'opacity-50' : ''}`}
                        >
                          {/* Day total */}
                          <div className={`px-2 py-1.5 text-xs sm:text-sm font-medium border-b ${
                            isToday
                              ? 'border-primary-200 dark:border-primary-800 text-primary-700 dark:text-primary-300'
                              : 'border-gray-200 dark:border-surface-700 text-surface-600 dark:text-surface-400'
                          }`}>
                            {dayTotal > 0 ? formatHours(dayTotal) : '--'}
                          </div>

                          {/* Entries */}
                          <div className="p-2 space-y-2">
                            {dayEntries.length === 0 && !isFuture && (
                              <button
                                onClick={() => {
                                  const entryDate = new Date(date)
                                  const dateStr = formatLocalDate(entryDate)
                                  const newEntry: Partial<TimeEntry> = {
                                    clock_in_time: formatLocalDateTime(dateStr, '09:00'),
                                    clock_out_time: formatLocalDateTime(dateStr, '17:00'),
                                    position: null,
                                    notes: null,
                                    is_break: false
                                  }
                                  setEditingEntry(newEntry as TimeEntry)
                                }}
                                className="w-full py-3 sm:py-2 text-xs sm:text-sm text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors flex items-center justify-center gap-1.5 touch-manipulation"
                              >
                                <Plus className="w-4 h-4 sm:w-3 sm:h-3" />
                                Add Time Entry
                              </button>
                            )}
                            {dayEntries.length === 0 && isFuture && (
                              <div className="text-center py-4 sm:py-3 text-xs sm:text-sm text-surface-400">
                                No entries scheduled
                              </div>
                            )}
                            {dayEntries.map((entry) => {
                              const entryBreaks = breaks[entry.id] || []
                              const activeBreak = entryBreaks.find(b => !b.break_end)

                              return (
                                <div
                                  key={entry.id}
                                  className={`rounded-lg p-2 sm:p-1.5 text-xs group relative ${
                                    entry.is_break
                                      ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800'
                                      : 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800'
                                  }`}
                                >
                                  <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-1.5">
                                      {/* Type Badge */}
                                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                        entry.is_break
                                          ? 'bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200'
                                          : 'bg-emerald-200 dark:bg-emerald-800 text-emerald-800 dark:text-emerald-200'
                                      }`}>
                                        {entry.is_break ? 'Break' : 'Working'}
                                      </span>
                                      <span className="font-medium text-surface-700 dark:text-surface-300 text-[10px] sm:text-xs">
                                        {formatTime(entry.clock_in_time)}
                                        {' - '}
                                        {formatTime(entry.clock_out_time)}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button
                                        onClick={() => setEditingEntry(entry)}
                                        className="p-1.5 hover:bg-gray-200 dark:hover:bg-surface-600 rounded touch-manipulation"
                                      >
                                        <Edit3 className="w-3.5 h-3.5 sm:w-3 sm:h-3" />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteEntry(entry.id)}
                                        disabled={deletingEntry === entry.id}
                                        className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 rounded touch-manipulation"
                                      >
                                        {deletingEntry === entry.id ? (
                                          <div className="w-3.5 h-3.5 sm:w-3 sm:h-3 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
                                        ) : (
                                          <Trash2 className="w-3.5 h-3.5 sm:w-3 sm:h-3" />
                                        )}
                                      </button>
                                    </div>
                                  </div>

                                  {/* Duration */}
                                  <div className="text-surface-500 dark:text-surface-400 mb-1 text-[10px] sm:text-xs">
                                    {entry.is_break ? (
                                      <span className="flex items-center gap-1">
                                        <Coffee className="w-3 h-3 sm:w-2.5 sm:h-2.5" />
                                        {formatHours(entry.total_hours || 0)}
                                      </span>
                                    ) : (
                                      <>
                                        {formatHours(entry.total_hours || 0)}
                                        {entry.break_minutes > 0 && (
                                          <span className="ml-1 flex items-center gap-0.5">
                                            <Coffee className="w-3 h-3 sm:w-2.5 sm:h-2.5" />
                                            {entry.break_minutes}m break
                                          </span>
                                        )}
                                      </>
                                    )}
                                  </div>

                                  {/* Position */}
                                  {entry.position && (
                                    <div className="text-surface-500 dark:text-surface-400 text-[10px]">
                                      {entry.position}
                                    </div>
                                  )}

                                  {/* Active break indicator */}
                                  {activeBreak && (
                                    <div className="mt-1 px-1.5 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded text-[10px] font-medium inline-flex items-center gap-1">
                                      <Coffee className="w-3 h-3" />
                                      On Break
                                    </div>
                                  )}
                                </div>
                              )
                            })}

                            {/* Add entry button for past days */}
                            {!isFuture && (dayEntries.length === 0 || dayEntries.every(e => e.clock_out_time)) && (
                              <button
                                onClick={() => {
                                  // Pre-fill with default times
                                  const entryDate = new Date(date)
                                  const dateStr = formatLocalDate(entryDate)
                                  const newEntry: Partial<TimeEntry> = {
                                    clock_in_time: formatLocalDateTime(dateStr, '09:00'),
                                    clock_out_time: formatLocalDateTime(dateStr, '17:00'),
                                    position: null,
                                    notes: null,
                                    is_break: false
                                  }
                                  setEditingEntry(newEntry as TimeEntry)
                                }}
                                className="w-full py-2 sm:py-1 text-xs text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors flex items-center justify-center gap-1 touch-manipulation"
                              >
                                <Plus className="w-3.5 h-3.5 sm:w-3 sm:h-3" />
                                Add Entry
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-surface-700 bg-gray-50 dark:bg-surface-800">
            <div className="text-sm text-surface-600 dark:text-surface-400">
              Click on an entry to edit, or use the + button to add new entries
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-primary-500 text-white font-medium hover:bg-primary-600 transition-colors"
            >
              Done
            </button>
          </div>
        </motion.div>
      </div>

      {/* Edit Entry Modal */}
      {editingEntry && (
        <EditEntryModal
          entry={editingEntry}
          isNew={!editingEntry.id}
          onSave={handleSaveEntry}
          onClose={() => setEditingEntry(null)}
          saving={saving}
        />
      )}
    </AnimatePresence>
  )
}

// Edit Entry Modal Component
interface EditEntryModalProps {
  entry: TimeEntry
  isNew: boolean
  onSave: (data: Partial<TimeEntry>) => void
  onClose: () => void
  saving: boolean
}

function EditEntryModal({ entry, isNew, onSave, onClose, saving }: EditEntryModalProps) {
  const [clockInTime, setClockInTime] = useState(
    entry.clock_in_time ? new Date(entry.clock_in_time).toTimeString().slice(0, 5) : '09:00'
  )
  const [clockOutTime, setClockOutTime] = useState(
    entry.clock_out_time ? new Date(entry.clock_out_time).toTimeString().slice(0, 5) : '17:00'
  )
  const [breakMinutes, setBreakMinutes] = useState(entry.break_minutes?.toString() || '0')
  const [position, setPosition] = useState(entry.position || '')
  const [notes, setNotes] = useState(entry.notes || '')
  const [isBreak, setIsBreak] = useState(entry.is_break || false)
  const [date, setDate] = useState(
    entry.clock_in_time ? formatLocalDate(new Date(entry.clock_in_time)) : formatLocalDate(new Date())
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const [hours, mins] = clockInTime.split(':').map(Number)
    const [outHours, outMins] = clockOutTime.split(':').map(Number)
    const clockInDate = date
    const clockOutDate = clockOutTime <= clockInTime ? addDays(date, 1) : date

    const clockInDateTime = formatLocalDateTime(clockInDate, `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`)
    const clockOutDateTime = formatLocalDateTime(clockOutDate, `${outHours.toString().padStart(2, '0')}:${outMins.toString().padStart(2, '0')}`)

    onSave({
      clock_in_time: clockInDateTime,
      clock_out_time: clockOutDateTime,
      break_minutes: parseInt(breakMinutes) || 0,
      position: position || null,
      notes: notes || null,
      is_break: isBreak
    })
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
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
        <form onSubmit={handleSubmit}>
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-surface-700">
            <h3 className="text-lg font-bold text-surface-900 dark:text-surface-100">
              {isNew ? 'Add Time Entry' : 'Edit Time Entry'}
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-surface-400 hover:text-surface-600 dark:hover:text-surface-200 rounded-lg hover:bg-gray-100 dark:hover:bg-surface-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-4">
            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />
                Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-surface-600 bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100 focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-all outline-none"
              />
            </div>

            {/* Clock In Time */}
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                <Clock className="w-4 h-4 inline mr-1" />
                Clock In Time
              </label>
              <input
                type="time"
                value={clockInTime}
                onChange={(e) => setClockInTime(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-surface-600 bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100 focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-all outline-none"
              />
            </div>

            {/* Clock Out Time */}
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                <Clock className="w-4 h-4 inline mr-1" />
                Clock Out Time
              </label>
              <input
                type="time"
                value={clockOutTime}
                onChange={(e) => setClockOutTime(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-surface-600 bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100 focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-all outline-none"
              />
            </div>

            {/* Break Minutes */}
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                <Coffee className="w-4 h-4 inline mr-1" />
                Break (minutes)
              </label>
              <input
                type="number"
                value={breakMinutes}
                onChange={(e) => setBreakMinutes(e.target.value)}
                min="0"
                step="5"
                disabled={isBreak}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-surface-600 bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100 focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-all outline-none disabled:opacity-50"
              />
            </div>

            {/* Break Entry Toggle */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <input
                type="checkbox"
                id="isBreak"
                checked={isBreak}
                onChange={(e) => setIsBreak(e.target.checked)}
                className="w-5 h-5 text-amber-500 rounded focus:ring-amber-500/30"
              />
              <div className="flex-1">
                <label htmlFor="isBreak" className="block text-sm font-medium text-amber-800 dark:text-amber-200 cursor-pointer">
                  This is a break entry
                </label>
                <p className="text-xs text-amber-600 dark:text-amber-300 mt-0.5">
                  Check this if the time entry represents break time rather than working hours
                </p>
              </div>
            </div>

            {/* Position */}
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                Position
              </label>
              <input
                type="text"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                placeholder="e.g., Server, Cook, Host"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-surface-600 bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100 focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-all outline-none"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes..."
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-surface-600 bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100 focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-all outline-none resize-none"
              />
            </div>
          </div>

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
              disabled={saving}
              className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white font-medium hover:from-orange-600 hover:to-orange-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  {isNew ? 'Add Entry' : 'Save Changes'}
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

export default HoursEditorModal
