import React, { useMemo, useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Calendar,
  Clock,
  Eye,
  EyeOff,
  Copy,
  Users,
  AlertCircle,
  CheckCircle
} from 'lucide-react'

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

interface StaffMember {
  id: string
  name: string
  role: string
}

interface ScheduleCalendarProps {
  schedules: Schedule[]
  staff: StaffMember[]
  selectedWeekStart: Date
  onWeekChange: (date: Date) => void
  onCreateShift: (date: string, time?: string) => void
  onEditShift: (schedule: Schedule) => void
  onDeleteShift: (scheduleId: string) => void
  onTogglePublish: (scheduleId: string, isPublished: boolean) => void
  onCopyShift: (schedule: Schedule) => void
  onCopyShiftMultiple: (schedule: Schedule, dates: string[]) => void
  onMoveShift: (scheduleId: string, targetDate: string) => void
  actualHoursByUserId?: Record<string, number>
  canEdit?: boolean
}

const POSITION_COLORS: Record<string, string> = {
  'Server': 'bg-blue-500',
  'Cook': 'bg-orange-500',
  'Host': 'bg-purple-500',
  'Manager': 'bg-emerald-500',
  'Cashier': 'bg-cyan-500',
  'Bartender': 'bg-amber-500',
  'Dishwasher': 'bg-gray-500',
  'Busser': 'bg-teal-500',
  'default': 'bg-primary-500'
}

export function ScheduleCalendar({
  schedules,
  staff,
  selectedWeekStart,
  onWeekChange,
  onCreateShift,
  onEditShift,
  onDeleteShift,
  onTogglePublish,
  onCopyShift,
  onCopyShiftMultiple,
  onMoveShift,
  actualHoursByUserId,
  canEdit = true
}: ScheduleCalendarProps) {
  const [hoveredDay, setHoveredDay] = useState<string | null>(null)
  const [isClient, setIsClient] = useState(false)
  const [copySchedule, setCopySchedule] = useState<Schedule | null>(null)
  const [selectedCopyDates, setSelectedCopyDates] = useState<Record<string, boolean>>({})

  // Ensure client-side only rendering for dates to avoid hydration mismatch
  useEffect(() => {
    setIsClient(true)
  }, [])

  // Get week dates
  const weekDates = useMemo(() => {
    if (!isClient || !selectedWeekStart) return []
    const dates: Date[] = []
    const start = new Date(selectedWeekStart)
    for (let i = 0; i < 7; i++) {
      const date = new Date(start)
      date.setDate(start.getDate() + i)
      dates.push(date)
    }
    return dates
  }, [selectedWeekStart, isClient])

  // Format date as YYYY-MM-DD using local timezone (not UTC)
  const formatDate = (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':')
    const h = parseInt(hours)
    const ampm = h >= 12 ? 'PM' : 'AM'
    const hour12 = h % 12 || 12
    return `${hour12}:${minutes} ${ampm}`
  }

  const getPositionColor = (position?: string) => {
    if (!position) return POSITION_COLORS.default
    return POSITION_COLORS[position] || POSITION_COLORS.default
  }

  const getInitials = (name: string) =>
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(p => p[0]?.toUpperCase())
      .join('')

  const getSchedulesForDate = (date: Date) => {
    const dateStr = formatDate(date)
    return schedules
      .filter(s => s.shift_date === dateStr)
      .sort((a, b) => a.shift_start_time.localeCompare(b.shift_start_time))
  }

  const getShiftHours = (schedule: Schedule) => {
    const [startHour, startMinute] = schedule.shift_start_time.split(':').map(Number)
    const [endHour, endMinute] = schedule.shift_end_time.split(':').map(Number)
    const start = startHour + startMinute / 60
    const end = endHour + endMinute / 60
    return Math.max(0, end - start)
  }

  const scheduleTotalsByUserId = useMemo(() => {
    const totals: Record<string, number> = {}
    for (const schedule of schedules) {
      totals[schedule.user_id] = (totals[schedule.user_id] || 0) + getShiftHours(schedule)
    }
    return totals
  }, [schedules])

  const totalScheduledHours = useMemo(() => {
    return Object.values(scheduleTotalsByUserId).reduce((sum, hours) => sum + hours, 0)
  }, [scheduleTotalsByUserId])

  const totalActualHours = useMemo(() => {
    if (!actualHoursByUserId) return null
    return Object.values(actualHoursByUserId).reduce((sum, hours) => sum + hours, 0)
  }, [actualHoursByUserId])

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newDate = new Date(selectedWeekStart)
    newDate.setDate(selectedWeekStart.getDate() + (direction === 'next' ? 7 : -7))
    onWeekChange(newDate)
  }

  const goToToday = () => {
    const today = new Date()
    const dayOfWeek = today.getDay()
    const monday = new Date(today)
    monday.setDate(today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1))
    onWeekChange(monday)
  }

  const handleSlotClick = (date: Date, time?: string) => {
    if (!canEdit) return
    const dateStr = formatDate(date)
    onCreateShift(dateStr, time)
  }

  const handleShiftClick = (e: React.MouseEvent, schedule: Schedule) => {
    if (!canEdit) return
    e.stopPropagation()
    onEditShift(schedule)
  }

  const handleDragStart = (e: React.DragEvent, scheduleId: string) => {
    if (!canEdit) return
    e.dataTransfer.setData('text/plain', scheduleId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDropShift = (e: React.DragEvent, dateStr: string) => {
    if (!canEdit) return
    e.preventDefault()
    const scheduleId = e.dataTransfer.getData('text/plain')
    if (!scheduleId) return
    onMoveShift(scheduleId, dateStr)
  }

  const openCopyModal = (schedule: Schedule) => {
    const nextSelections: Record<string, boolean> = {}
    for (const date of weekDates) {
      const dateStr = formatDate(date)
      nextSelections[dateStr] = dateStr !== schedule.shift_date
    }
    setCopySchedule(schedule)
    setSelectedCopyDates(nextSelections)
  }

  const confirmCopyMultiple = () => {
    if (!copySchedule) return
    const selectedDates = Object.entries(selectedCopyDates)
      .filter(([, selected]) => selected)
      .map(([date]) => date)
    if (selectedDates.length === 0) {
      setCopySchedule(null)
      return
    }
    onCopyShiftMultiple(copySchedule, selectedDates)
    setCopySchedule(null)
  }

  const weekRangeLabel =
    isClient && weekDates.length === 7
      ? `${weekDates[0].toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric'
        })} - ${weekDates[6].toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        })}`
      : 'Loading...'

  const coverageGapDates = weekDates
    .filter(date => getSchedulesForDate(date).length === 0)
    .map(date => formatDate(date))

  return (
    <div className="bg-white dark:bg-surface-800 rounded-2xl shadow-sm border border-surface-200 dark:border-surface-700 overflow-hidden">
      {/* Calendar Header */}
      <div className="px-6 py-4 border-b border-surface-200 dark:border-surface-700 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <h2 className="text-xl font-bold text-surface-900 dark:text-surface-100">
              Schedule
            </h2>
            <div className="flex items-center gap-2 bg-surface-100 dark:bg-surface-700 rounded-xl p-1">
              <button
                onClick={() => navigateWeek('prev')}
                className="p-2 hover:bg-surface-200 dark:hover:bg-surface-600 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-4 h-4 text-surface-600 dark:text-surface-400" />
              </button>
              <button
                onClick={goToToday}
                className="px-3 py-1 text-sm font-medium text-surface-700 dark:text-surface-300 hover:bg-surface-200 dark:hover:bg-surface-600 rounded-lg transition-colors"
              >
                Today
              </button>
              <button
                onClick={() => navigateWeek('next')}
                className="p-2 hover:bg-surface-200 dark:hover:bg-surface-600 rounded-lg transition-colors"
              >
                <ChevronRight className="w-4 h-4 text-surface-600 dark:text-surface-400" />
              </button>
            </div>
            <span className="text-sm text-surface-600 dark:text-surface-400">
              {weekRangeLabel}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-surface-500 dark:text-surface-400">
            <span className="inline-flex items-center gap-1 rounded-full bg-surface-100 dark:bg-surface-700 px-3 py-1">
              <Clock className="w-3 h-3" />
              {totalScheduledHours.toFixed(1)}h scheduled
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-surface-100 dark:bg-surface-700 px-3 py-1">
              <Users className="w-3 h-3" />
              {staff.length} staff
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-surface-100 dark:bg-surface-700 px-3 py-1">
              <AlertCircle className="w-3 h-3" />
              {coverageGapDates.length} coverage gaps
            </span>
            {totalActualHours !== null && (
              <span className="inline-flex items-center gap-1 rounded-full bg-surface-100 dark:bg-surface-700 px-3 py-1">
                <CheckCircle className="w-3 h-3" />
                {totalActualHours.toFixed(1)}h actual
              </span>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-700/40 p-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-surface-800 dark:text-surface-100">
                Weekly hours by staff
              </h3>
              <p className="text-xs text-surface-500 dark:text-surface-400">
                Scheduled vs actual hours for the selected week.
              </p>
            </div>
            <span className="text-xs text-surface-500 dark:text-surface-400">
              Tip: drag & drop shifts to move them to another day.
            </span>
          </div>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {staff.map((member) => {
              const scheduledHours = scheduleTotalsByUserId[member.id] || 0
              const actualHours = actualHoursByUserId?.[member.id]
              const variance =
                actualHours !== undefined ? scheduledHours - actualHours : null
              return (
                <div
                  key={member.id}
                  className="flex items-center justify-between rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium text-surface-900 dark:text-surface-100">
                      {member.name}
                    </p>
                    <p className="text-xs text-surface-500 dark:text-surface-400">
                      {member.role}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-surface-900 dark:text-surface-100">
                      {scheduledHours.toFixed(1)}h
                    </p>
                    <p className="text-xs text-surface-500 dark:text-surface-400">
                      {actualHours !== undefined
                        ? `${actualHours.toFixed(1)}h actual`
                        : 'Actual hours unavailable'}
                    </p>
                    {variance !== null && (
                      <p className={`text-[11px] ${variance >= 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {variance >= 0 ? '+' : ''}
                        {variance.toFixed(1)}h vs actual
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Week Grid Header */}
      <div className="grid grid-cols-7 border-b border-surface-200 dark:border-surface-700">
        {weekDates.map((date) => {
          const isToday = formatDate(date) === formatDate(new Date())
          const daySchedules = getSchedulesForDate(date)
          const totalHours = daySchedules.reduce((sum, s) => {
            const start = parseInt(s.shift_start_time.split(':')[0]) + parseInt(s.shift_start_time.split(':')[1]) / 60
            const end = parseInt(s.shift_end_time.split(':')[0]) + parseInt(s.shift_end_time.split(':')[1]) / 60
            return sum + Math.max(0, end - start)
          }, 0)
          const isCoverageGap = daySchedules.length === 0

          return (
            <div
              key={formatDate(date)}
              className={`p-3 text-center border-r border-surface-200 dark:border-surface-700 last:border-r-0 ${
                isToday ? 'bg-primary-50 dark:bg-primary-900/10' : ''
              }`}
            >
              <div className="text-xs font-medium text-surface-500 dark:text-surface-400 uppercase">
                {date.toLocaleDateString('en-US', { weekday: 'short' })}
              </div>
              <div className={`text-lg font-bold mt-1 ${
                isToday
                  ? 'text-primary-600 dark:text-primary-400'
                  : 'text-surface-900 dark:text-surface-100'
              }`}>
                {date.getDate()}
              </div>
              {daySchedules.length > 0 && (
                <div className="text-xs text-surface-500 dark:text-surface-400 mt-1">
                  {totalHours.toFixed(1)}h
                </div>
              )}
              {isCoverageGap && (
                <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
                  Coverage gap
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Schedule Grid */}
      <div className="grid grid-cols-7 min-h-[500px]">
        {weekDates.map((date) => {
          const dateStr = formatDate(date)
          const daySchedules = getSchedulesForDate(date)

          return (
            <div
              key={dateStr}
              className={`border-r border-surface-200 dark:border-surface-700 p-2 relative transition-colors ${
                hoveredDay === dateStr ? 'bg-surface-50 dark:bg-surface-700/50' : ''
              } ${canEdit ? 'cursor-pointer' : 'cursor-default'}`}
              onMouseEnter={() => setHoveredDay(dateStr)}
              onMouseLeave={() => setHoveredDay(null)}
              onClick={() => canEdit && handleSlotClick(date)}
              onDragOver={(event) => {
                if (canEdit) {
                  event.preventDefault()
                }
              }}
              onDrop={(event) => handleDropShift(event, dateStr)}
            >
              {/* Add shift button on hover */}
              <AnimatePresence>
                {hoveredDay === dateStr && canEdit && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="absolute top-1 right-1 z-10 p-1.5 bg-primary-500 hover:bg-primary-600 text-white rounded-lg shadow-lg transition-colors"
                    title="Add shift"
                  >
                    <Plus className="w-4 h-4" />
                  </motion.button>
                )}
              </AnimatePresence>

              {/* Shifts */}
              <div className="space-y-2 mt-6">
                {daySchedules.map((schedule) => (
                  <motion.div
                    key={schedule.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`
                      group relative rounded-lg p-2 cursor-pointer
                      ${getPositionColor(schedule.position)} text-white
                      shadow-sm hover:shadow-md transition-all
                    `}
                    onClick={(e) => canEdit && handleShiftClick(e, schedule)}
                    draggable={canEdit}
                    onDragStart={(event) => handleDragStart(event, schedule.id)}
                  >
                    {/* Published indicator */}
                    <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onTogglePublish(schedule.id, !schedule.is_published)
                        }}
                        className="p-1 hover:bg-white/20 rounded"
                      >
                        {schedule.is_published ? (
                          <Eye className="w-3 h-3" />
                        ) : (
                          <EyeOff className="w-3 h-3" />
                        )}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onCopyShift(schedule)
                        }}
                        className="p-1 hover:bg-white/20 rounded"
                        title="Copy shift"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          openCopyModal(schedule)
                        }}
                        className="p-1 hover:bg-white/20 rounded"
                        title="Copy to multiple days"
                      >
                        <Calendar className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Avatar and name */}
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center text-xs font-medium">
                        {getInitials(schedule.user_name)}
                      </div>
                      <span className="text-xs font-medium truncate">
                        {schedule.user_name}
                      </span>
                    </div>

                    {/* Time */}
                    <div className="flex items-center gap-1 text-xs opacity-90">
                      <Clock className="w-3 h-3" />
                      <span>
                        {formatTime(schedule.shift_start_time)} - {formatTime(schedule.shift_end_time)}
                      </span>
                    </div>

                    {/* Position badge */}
                    {schedule.position && (
                      <div className="mt-1 inline-flex items-center px-1.5 py-0.5 bg-white/20 rounded text-[10px] font-medium">
                        {schedule.position}
                      </div>
                    )}

                    {/* Actions menu - TODO: refactor to separate component */}
                  </motion.div>
                ))}
              </div>

              {/* Empty state for the day */}
              {daySchedules.length === 0 && (
                <div className="h-full flex items-center justify-center">
                  {canEdit ? (
                    <button
                      onClick={() => handleSlotClick(date)}
                      className="p-4 text-surface-400 dark:text-surface-500 hover:text-surface-600 dark:hover:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-700 rounded-lg transition-colors"
                    >
                      <Plus className="w-5 h-5 mx-auto" />
                      <span className="text-xs mt-1 block">Add Shift</span>
                    </button>
                  ) : (
                    <span className="text-xs text-surface-400 dark:text-surface-500">No shifts scheduled</span>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Copy to multiple days modal */}
      <AnimatePresence>
        {copySchedule && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md rounded-2xl bg-white dark:bg-surface-800 shadow-xl border border-surface-200 dark:border-surface-700"
            >
              <div className="px-6 py-4 border-b border-surface-200 dark:border-surface-700">
                <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-100">
                  Copy shift to multiple days
                </h3>
                <p className="text-sm text-surface-500 dark:text-surface-400">
                  Select the days you want to duplicate {copySchedule.user_name}&apos;s shift.
                </p>
              </div>
              <div className="px-6 py-4 space-y-3">
                {weekDates.map((date) => {
                  const dateStr = formatDate(date)
                  return (
                    <label key={dateStr} className="flex items-center justify-between text-sm text-surface-700 dark:text-surface-200">
                      <span>
                        {date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                      </span>
                      <input
                        type="checkbox"
                        checked={!!selectedCopyDates[dateStr]}
                        onChange={() =>
                          setSelectedCopyDates((prev) => ({
                            ...prev,
                            [dateStr]: !prev[dateStr]
                          }))
                        }
                        className="h-4 w-4 rounded border-surface-300 text-primary-500 focus:ring-primary-500"
                      />
                    </label>
                  )
                })}
              </div>
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-surface-200 dark:border-surface-700">
                <button
                  onClick={() => setCopySchedule(null)}
                  className="px-4 py-2 text-sm rounded-lg border border-surface-200 dark:border-surface-600 text-surface-600 dark:text-surface-200 hover:bg-surface-50 dark:hover:bg-surface-700"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmCopyMultiple}
                  className="px-4 py-2 text-sm rounded-lg bg-primary-500 text-white hover:bg-primary-600"
                >
                  Copy shifts
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Legend */}
      <div className="flex items-center justify-between px-6 py-3 border-t border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-700/50">
        <div className="flex items-center gap-4">
          <span className="text-xs text-surface-600 dark:text-surface-400">Positions:</span>
          {Object.entries(POSITION_COLORS).filter(([key]) => key !== 'default').map(([position, color]) => (
            <div key={position} className="flex items-center gap-1">
              <div className={`w-3 h-3 ${color} rounded`} />
              <span className="text-xs text-surface-600 dark:text-surface-400">{position}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 text-xs text-surface-500">
          <Eye className="w-3 h-3" />
          <span>Published</span>
          <EyeOff className="w-3 h-3 ml-2" />
          <span>Unpublished</span>
        </div>
      </div>
    </div>
  )
}

export default ScheduleCalendar
