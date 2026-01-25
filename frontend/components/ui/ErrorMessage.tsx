import React from 'react'
import { AlertCircle, RefreshCw, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface ErrorMessageProps {
  title?: string
  message: string
  details?: string
  onRetry?: () => void
  onDismiss?: () => void
  className?: string
  variant?: 'inline' | 'banner' | 'card'
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({
  title = 'Error',
  message,
  details,
  onRetry,
  onDismiss,
  className = '',
  variant = 'inline'
}) => {
  const variants = {
    inline: 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4',
    banner: 'bg-red-100 dark:bg-red-900/30 border-l-4 border-red-500 p-4',
    card: 'bg-white dark:bg-gray-800 border-2 border-red-200 dark:border-red-800 rounded-xl p-6 shadow-lg'
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className={`${variants[variant]} ${className}`}
      >
        <div className="flex items-start">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div className="ml-3 flex-1">
            <h3 className="text-sm font-semibold text-red-800 dark:text-red-300">
              {title}
            </h3>
            <p className="mt-1 text-sm text-red-700 dark:text-red-400">
              {message}
            </p>
            {details && (
              <details className="mt-2">
                <summary className="text-xs text-red-600 dark:text-red-500 cursor-pointer hover:underline">
                  Technical details
                </summary>
                <pre className="mt-2 text-xs text-red-600 dark:text-red-500 bg-red-100 dark:bg-red-900/30 p-2 rounded overflow-x-auto">
                  {details}
                </pre>
              </details>
            )}
            {(onRetry || onDismiss) && (
              <div className="mt-3 flex gap-2">
                {onRetry && (
                  <button
                    onClick={onRetry}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/40 hover:bg-red-200 dark:hover:bg-red-900/60 rounded-lg transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Retry
                  </button>
                )}
                {onDismiss && (
                  <button
                    onClick={onDismiss}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                    Dismiss
                  </button>
                )}
              </div>
            )}
          </div>
          {onDismiss && variant !== 'inline' && (
            <button
              onClick={onDismiss}
              className="ml-4 text-red-400 hover:text-red-600 dark:hover:text-red-300 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

export default ErrorMessage
