import React from 'react'
import { LucideIcon } from 'lucide-react'
import { motion } from 'framer-motion'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  action?: {
    label: string
    onClick: () => void
  }
  secondaryAction?: {
    label: string
    onClick: () => void
  }
  className?: string
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  className = ''
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`flex flex-col items-center justify-center p-12 text-center ${className}`}
    >
      <motion.div
        className="w-20 h-20 bg-gradient-to-br from-surface-100 to-surface-200 dark:from-surface-700 dark:to-surface-800 rounded-3xl flex items-center justify-center mb-6 shadow-lg"
        whileHover={{ scale: 1.05, rotate: 5 }}
        transition={{ type: "spring", stiffness: 400 }}
      >
        <Icon className="w-10 h-10 text-surface-400 dark:text-surface-500" />
      </motion.div>

      <h3 className="text-xl font-bold text-surface-900 dark:text-surface-100 mb-3">
        {title}
      </h3>
      <p className="text-surface-600 dark:text-surface-400 mb-8 max-w-md leading-relaxed">
        {description}
      </p>

      {(action || secondaryAction) && (
        <div className="flex gap-4">
          {action && (
            <motion.button
              onClick={action.onClick}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="btn-primary"
            >
              {action.label}
            </motion.button>
          )}
          {secondaryAction && (
            <motion.button
              onClick={secondaryAction.onClick}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="btn-secondary"
            >
              {secondaryAction.label}
            </motion.button>
          )}
        </div>
      )}
    </motion.div>
  )
}

export default EmptyState
