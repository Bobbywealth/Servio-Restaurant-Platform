import React from 'react'
import { Toaster, toast } from 'react-hot-toast'
import { CheckCircle2, XCircle, AlertCircle, Info, X } from 'lucide-react'
import { motion } from 'framer-motion'

// Custom toast component
const CustomToast = ({
  message,
  type,
  onClose
}: {
  message: string
  type: 'success' | 'error' | 'warning' | 'info'
  onClose: () => void
}) => {
  const icons = {
    success: CheckCircle2,
    error: XCircle,
    warning: AlertCircle,
    info: Info
  }

  const colorSchemes = {
    success: {
      bg: 'bg-gradient-to-r from-servio-green-100/90 to-servio-green-50/90 dark:from-servio-green-900/90 dark:to-servio-green-800/90',
      border: 'border-servio-green-300/50 dark:border-servio-green-700/50',
      text: 'text-servio-green-800 dark:text-servio-green-200',
      icon: 'text-servio-green-500',
      glow: 'shadow-servio-green-500/20'
    },
    error: {
      bg: 'bg-gradient-to-r from-servio-red-100/90 to-servio-red-50/90 dark:from-servio-red-900/90 dark:to-servio-red-800/90',
      border: 'border-servio-red-300/50 dark:border-servio-red-700/50',
      text: 'text-servio-red-800 dark:text-servio-red-200',
      icon: 'text-servio-red-500',
      glow: 'shadow-servio-red-500/20'
    },
    warning: {
      bg: 'bg-gradient-to-r from-servio-orange-100/90 to-servio-orange-50/90 dark:from-servio-orange-900/90 dark:to-servio-orange-800/90',
      border: 'border-servio-orange-300/50 dark:border-servio-orange-700/50',
      text: 'text-servio-orange-800 dark:text-servio-orange-200',
      icon: 'text-servio-orange-500',
      glow: 'shadow-servio-orange-500/20'
    },
    info: {
      bg: 'bg-gradient-to-r from-primary-100/90 to-primary-50/90 dark:from-primary-900/90 dark:to-primary-800/90',
      border: 'border-primary-300/50 dark:border-primary-700/50',
      text: 'text-primary-800 dark:text-primary-200',
      icon: 'text-primary-500',
      glow: 'shadow-primary-500/20'
    }
  }

  const colors = colorSchemes[type]
  const Icon = icons[type]

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.3 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.5 }}
      className={`
        flex items-center p-4 rounded-2xl border shadow-xl backdrop-blur-md
        ${colors.bg} ${colors.border}
      `}
    >
      <div className={`
        p-2 rounded-xl ${colors.icon} bg-white/50 dark:bg-black/20
      `}>
        <Icon className="w-5 h-5" />
      </div>
      <span className={`flex-1 text-sm font-semibold ${colors.text} ml-3`}>{message}</span>
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={onClose}
        className={`ml-3 p-2 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-colors ${colors.text} opacity-60 hover:opacity-100`}
      >
        <X className="w-4 h-4" />
      </motion.button>
    </motion.div>
  )
}

// Toast functions
export const showToast = {
  success: (message: string) => {
    toast.custom((t) => (
      <CustomToast
        message={message}
        type="success"
        onClose={() => toast.dismiss(t.id)}
      />
    ), {
      duration: 4000,
      position: 'top-center'
    })
  },

  error: (message: string) => {
    toast.custom((t) => (
      <CustomToast
        message={message}
        type="error"
        onClose={() => toast.dismiss(t.id)}
      />
    ), {
      duration: 6000,
      position: 'top-center'
    })
  },

  warning: (message: string) => {
    toast.custom((t) => (
      <CustomToast
        message={message}
        type="warning"
        onClose={() => toast.dismiss(t.id)}
      />
    ), {
      duration: 5000,
      position: 'top-center'
    })
  },

  info: (message: string) => {
    toast.custom((t) => (
      <CustomToast
        message={message}
        type="info"
        onClose={() => toast.dismiss(t.id)}
      />
    ), {
      duration: 4000,
      position: 'top-center'
    })
  },

  promise: <T,>(
    promise: Promise<T>,
    {
      loading,
      success,
      error,
    }: {
      loading: string
      success: string | ((data: T) => string)
      error: string | ((err: any) => string)
    }
  ) => {
    return toast.promise(promise, {
      loading,
      success,
      error,
    })
  }
}

// Toast provider component
export default function ToastProvider() {
  return (
    <Toaster
      position="top-center"
      gutter={8}
      containerClassName="z-[9999]"
      toastOptions={{
        duration: 4000,
        style: {
          background: 'transparent',
          border: 'none',
          padding: 0,
          boxShadow: 'none',
        },
        success: {
          duration: 4000,
          position: 'top-center',
        },
        error: {
          duration: 6000,
          position: 'top-center',
        },
      }}
    />
  )
}
