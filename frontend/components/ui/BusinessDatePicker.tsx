import React from 'react'
import { CalendarDays, RotateCcw } from 'lucide-react'
import { formatBusinessDateLabel, getTimezoneShortLabel } from '../../utils/businessDate'

interface BusinessDatePickerProps {
  selectedDate: string
  timezone: string
  isToday: boolean
  onDateChange: (date: string) => void
  onBackToToday: () => void
  className?: string
}

export default function BusinessDatePicker({
  selectedDate,
  timezone,
  isToday,
  onDateChange,
  onBackToToday,
  className = '',
}: BusinessDatePickerProps) {
  const formattedDate = formatBusinessDateLabel(selectedDate, timezone)
  const timezoneShortLabel = getTimezoneShortLabel(timezone, selectedDate)

  return (
    <div className={`card ${className}`}>
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-surface-900 dark:text-surface-100">
            Viewing: {isToday ? 'Today' : formattedDate} ({formattedDate})
          </p>
          <p className="mt-1 text-xs text-surface-500 dark:text-surface-400">
            Timezone: {timezone} ({timezoneShortLabel})
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-2 text-sm text-surface-700 dark:text-surface-300">
            <CalendarDays className="w-4 h-4" />
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => onDateChange(event.target.value)}
              className="input-field min-h-[40px]"
            />
          </label>

          {!isToday && (
            <button
              type="button"
              onClick={onBackToToday}
              className="btn-secondary inline-flex items-center gap-2 min-h-[40px]"
            >
              <RotateCcw className="w-4 h-4" />
              Back to Today
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
