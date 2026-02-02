import React, { useMemo, useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Calendar,
  Clock,
  User,
  MoreVertical,
  Edit3,
  Trash2,
  Eye,
  EyeOff,
  Copy
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
  onCopyShift
}: ScheduleCalendarProps) {
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [hoveredDay, setHoveredDay] = useState<string | null>(null)
  const [isClient, setIsClient] = useState(false)

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
    const dateStr = formatDate(date)
    onCreateShift(dateStr, time)
  }

  const handleShiftClick = (e: React.MouseEvent, schedule: Schedule) => {
    e.stopPropagation()
    onEditShift(schedule)
  }

  const handleMenuAction = (e: React.MouseEvent, action: string, schedule: Schedule) => {
    e.stopPropagation()
    setOpenMenu(null)
    switch (action) {
      case 'edit':
        onEditShift(schedule)
        break
      case 'delete':
        onDeleteShift(schedule.id)
        break
      case 'publish':
        onTogglePublish(schedule.id, !schedule.is_published)
        break
      case 'copy':
        onCopyShift(schedule)
        break
    }
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

  return (
    <div className="bg-white dark:bg-surface-800 rounded-2xl shadow-sm border border-surface-200 dark:border-surface-700 overflow-hidden">
      {/* Calendar Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-surface-200 dark:border-surface-700">
        <div className="flex items-center gap-4">
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
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-surface-600 dark:text-surface-400">
            {weekRangeLabel}
          </span>
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
              className={`border-r border-surface-200 dark:border-surface-700 last:border-r-0 p-2 relative transition-colors ${
                hoveredDay === dateStr ? 'bg-surface-50 dark:bg-surface-700/50' : ''
              }`}
              onMouseEnter={() => setHoveredDay(dateStr)}
              onMouseLeave={() => setHoveredDay(null)}
              onClick={() => handleSlotClick(date)}
            >
              {/* Add shift button on hover */}
              <AnimatePresence>
                {hoveredDay === dateStr && (
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
                      relative group rounded-lg p-2 cursor-pointer
                      ${getPositionColor(schedule.position)} text-white
                      shadow-sm hover:shadow-md transition-all
                    `}
                    onClick={(e) => handleShiftClick(e, schedule)}
                  >
                    {/* Published indicator */}
                    <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
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

                    {/* Actions menu */}
                    <div className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setOpenMenu(openMenu === schedule.id ? null : schedule.id)
                          }}
                          className="p-1 hover:bg-white/20 rounded"
                        >
                          <MoreVertical className="w-3 h-3" />
                        </button>
                        {openMenu === schedule.id && (
                          <>
                            <div
                              className="fixed inset-0 z-10"
                              onClick={(e) => {
                                e.stopPropagation()
                                setOpenMenu(null)
                              }}
                            />
                            <div className="absolute left-0 top-6 z-20 w-32 bg-white dark:bg-surface-800 rounded-xl shadow-lg border border-surface-200 dark:border-surface-700 py-1">
                              <button
                                onClick={(e) => handleMenuAction(e, 'edit', schedule)}
                                className="w-full px-3 py-2 text-left text-xs text-surface-700 dark:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-700 flex items-center gap-2"
                              >
                                <Edit3 className="w-3 h-3" />
                                Edit
                              </button>
                              <button
                                onClick={(e) => handleMenuAction(e, 'copy', schedule)}
                                className="w-full px-3 py-2 text-left text-xs text-surface-700 dark:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-700 flex items-center gap-2"
                              >
                                <Copy className="w-3 h-3" />
                                Copy
                              </button>
                              <button
                                onClick={(e) => handleMenuAction(e, 'publish', schedule)}
                                className="w-full px-3 py-2 text-left text-xs text-surface-700 dark:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-700 flex items-center gap-2"
                              >
                                {schedule.is_published ? (
                                  <>
                                    <EyeOff className="w-3 h-3" />
                                    Unpublish
                                  </>
                                ) : (
                                  <>
                                    <Eye className="w-3 h-3" />
                                    Publish
                                  </>
                                )}
                              </button>
                              <hr className="my-1 border-surface-200 dark:border-surface-700" />
                              <button
                                onClick={(e) => handleMenuAction(e, 'delete', schedule)}
                                className="w-full px-3 py-2 text-left text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                              >
                                <Trash2 className="w-3 h-3" />
                                Delete
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}

                {/* Empty state for the day */}
                {daySchedules.length === 0 && (
                  <div className="h-full flex items-center justify-center">
                    <button
                      onClick={() => handleSlotClick(date)}
                      className="p-4 text-surface-400 dark:text-surface-500 hover:text-surface-600 dark:hover:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-700 rounded-lg transition-colors"
                    >
                      <Plus className="w-5 h-5 mx-auto" />
                      <span className="text-xs mt-1 block">Add Shift</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

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
