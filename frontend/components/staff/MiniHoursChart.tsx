import React from 'react'

interface MiniHoursChartProps {
  dailyHours: Record<string, number>
  weekDates: string[]
  maxHours?: number
}

export function MiniHoursChart({ dailyHours, weekDates, maxHours = 12 }: MiniHoursChartProps) {
  // Get day abbreviations
  const getDayAbbr = (dateStr: string) => {
    const date = new Date(dateStr + 'T12:00:00') // Add noon time to avoid timezone issues
    return date.toLocaleDateString('en-US', { weekday: 'short' }).charAt(0)
  }

  // Calculate bar heights (percentage of max)
  const getBarHeight = (hours: number) => {
    if (!hours || hours <= 0) return 0
    return Math.min((hours / maxHours) * 100, 100)
  }

  // Get bar color based on hours (overtime > 8 hours)
  const getBarColor = (hours: number) => {
    if (hours > 8) return 'bg-red-400 dark:bg-red-500' // Overtime
    if (hours > 0) return 'bg-emerald-400 dark:bg-emerald-500' // Normal
    return 'bg-surface-200 dark:bg-surface-600' // No hours
  }

  // Check if today
  const isToday = (dateStr: string) => {
    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    return dateStr === todayStr
  }

  return (
    <div className="flex items-end justify-between gap-1 h-12 px-1">
      {weekDates.map((date) => {
        const hours = dailyHours[date] || 0
        const barHeight = getBarHeight(hours)
        const today = isToday(date)

        return (
          <div
            key={date}
            className="flex flex-col items-center flex-1 min-w-0"
            title={`${getDayAbbr(date)}: ${hours.toFixed(1)}h`}
          >
            {/* Bar container */}
            <div className="w-full h-8 flex items-end justify-center">
              <div
                className={`w-full max-w-[8px] rounded-t-sm transition-all duration-300 ${getBarColor(hours)} ${today ? 'ring-1 ring-primary-400' : ''}`}
                style={{ height: barHeight > 0 ? `${Math.max(barHeight, 10)}%` : '2px' }}
              />
            </div>
            {/* Day label */}
            <span className={`text-[9px] mt-0.5 ${today ? 'font-bold text-primary-500' : 'text-surface-400 dark:text-surface-500'}`}>
              {getDayAbbr(date)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export default MiniHoursChart
