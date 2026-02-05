import React, { useState } from 'react'

interface MiniHoursChartProps {
  dailyHours: Record<string, number>
  weekDates: string[]
  maxHours?: number
}

export function MiniHoursChart({ dailyHours, weekDates, maxHours = 12 }: MiniHoursChartProps) {
  const [hoveredDay, setHoveredDay] = useState<string | null>(null)

  // Get day abbreviation
  const getDayAbbr = (dateStr: string) => {
    const date = new Date(dateStr + 'T12:00:00')
    return date.toLocaleDateString('en-US', { weekday: 'short' }).charAt(0)
  }

  // Get full day name
  const getDayName = (dateStr: string) => {
    const date = new Date(dateStr + 'T12:00:00')
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  // Calculate bar heights (percentage of max)
  const getBarHeight = (hours: number) => {
    if (!hours || hours <= 0) return 0
    return Math.min((hours / maxHours) * 100, 100)
  }

  // Get bar color based on hours (overtime > 8 hours)
  const getBarColor = (hours: number, isHovered: boolean) => {
    if (hours > 8) return isHovered ? 'bg-red-500 dark:bg-red-400' : 'bg-red-400 dark:bg-red-500'
    if (hours > 0) return isHovered ? 'bg-emerald-500 dark:bg-emerald-400' : 'bg-emerald-400 dark:bg-emerald-500'
    return isHovered ? 'bg-surface-300 dark:bg-surface-500' : 'bg-surface-200 dark:bg-surface-600'
  }

  // Check if today
  const isToday = (dateStr: string) => {
    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    return dateStr === todayStr
  }

  return (
    <div className="relative">
      {/* Tooltip */}
      {hoveredDay && (
        <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 z-10 px-2 py-1 bg-surface-800 dark:bg-surface-900 text-white text-xs rounded shadow-lg whitespace-nowrap">
          <span className="font-medium">{getDayName(hoveredDay)}</span>
          <span className="ml-1.5 text-emerald-300">{(dailyHours[hoveredDay] || 0).toFixed(1)}h</span>
          {(dailyHours[hoveredDay] || 0) > 8 && (
            <span className="ml-1 text-red-300">(OT)</span>
          )}
        </div>
      )}

      {/* Chart */}
      <div className="flex items-end justify-between gap-1.5 h-14 px-1">
        {weekDates.map((date) => {
          const hours = dailyHours[date] || 0
          const barHeight = getBarHeight(hours)
          const today = isToday(date)
          const isHovered = hoveredDay === date

          return (
            <div
              key={date}
              className="flex flex-col items-center flex-1 min-w-0 cursor-pointer"
              onMouseEnter={() => setHoveredDay(date)}
              onMouseLeave={() => setHoveredDay(null)}
            >
              {/* Bar container */}
              <div className="w-full h-9 flex items-end justify-center">
                <div
                  className={`w-full max-w-[10px] rounded-t-sm transition-all duration-200 ${getBarColor(hours, isHovered)} ${today ? 'ring-2 ring-primary-400 ring-offset-1 ring-offset-white dark:ring-offset-surface-800' : ''} ${isHovered ? 'scale-110' : ''}`}
                  style={{ height: barHeight > 0 ? `${Math.max(barHeight, 12)}%` : '3px' }}
                />
              </div>
              {/* Day label */}
              <span className={`text-[10px] mt-1 font-medium ${today ? 'text-primary-500 font-bold' : isHovered ? 'text-surface-700 dark:text-surface-200' : 'text-surface-400 dark:text-surface-500'}`}>
                {getDayAbbr(date)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default MiniHoursChart
