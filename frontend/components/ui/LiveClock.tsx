import React, { useState, useEffect } from 'react'
import { Clock } from 'lucide-react'

interface LiveClockProps {
  timezone?: string
  showIcon?: boolean
  className?: string
  format?: 'full' | 'time' | 'date'
}

export const LiveClock: React.FC<LiveClockProps> = ({
  timezone = 'America/New_York',
  showIcon = true,
  className = '',
  format = 'full'
}) => {
  const [time, setTime] = useState<Date>(new Date())

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  const formatTime = () => {
    const options: Intl.DateTimeFormatOptions = {
      timeZone: timezone,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }

    const dateOptions: Intl.DateTimeFormatOptions = {
      timeZone: timezone,
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    }

    const timeString = time.toLocaleString('en-US', options)
    const dateString = time.toLocaleString('en-US', dateOptions)

    if (format === 'time') return timeString
    if (format === 'date') return dateString
    return `${dateString} • ${timeString}`
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {showIcon && <Clock className="w-4 h-4" />}
      <span className="font-medium tabular-nums">{formatTime()}</span>
    </div>
  )
}

export default LiveClock
