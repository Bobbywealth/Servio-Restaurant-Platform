import React from 'react'
import { motion } from 'framer-motion'
import { Calendar, Users } from 'lucide-react'

interface ScheduleViewToggleProps {
  view: 'cards' | 'calendar'
  onViewChange: (view: 'cards' | 'calendar') => void
  scheduledCount?: number
}

export function ScheduleViewToggle({
  view,
  onViewChange,
  scheduledCount
}: ScheduleViewToggleProps) {
  return (
    <div className="flex items-center gap-1 bg-surface-100 dark:bg-surface-700 rounded-xl p-1">
      <button
        onClick={() => onViewChange('cards')}
        className={`relative px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
          view === 'cards'
            ? 'text-white'
            : 'text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-100'
        }`}
      >
        {view === 'cards' && (
          <motion.div
            layoutId="viewToggle"
            className="absolute inset-0 bg-orange-500 rounded-lg"
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          />
        )}
        <span className="relative flex items-center gap-2">
          <Users className="w-4 h-4" />
          Staff View
        </span>
      </button>
      <button
        onClick={() => onViewChange('calendar')}
        className={`relative px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
          view === 'calendar'
            ? 'text-white'
            : 'text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-100'
        }`}
      >
        {view === 'calendar' && (
          <motion.div
            layoutId="viewToggle"
            className="absolute inset-0 bg-orange-500 rounded-lg"
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          />
        )}
        <span className="relative flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          Schedule View
          {scheduledCount !== undefined && scheduledCount > 0 && (
            <span className="ml-1 px-1.5 py-0.5 text-xs bg-white/20 rounded-full">
              {scheduledCount}
            </span>
          )}
        </span>
      </button>
    </div>
  )
}

export default ScheduleViewToggle
