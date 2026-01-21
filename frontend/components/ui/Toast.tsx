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

  const colors = {
    success: 'bg-servio-green-100 dark:bg-servio-green-900/30 text-servio-green-800 dark:text-servio-green-300 border-servio-green-200 dark:border-servio-green-800',
    error: 'bg-servio-red-100 dark:bg-servio-red-900/30 text-servio-red-800 dark:text-servio-red-300 border-servio-red-200 dark:border-servio-red-800',
    warning: 'bg-servio-orange-100 dark:bg-servio-orange-900/30 text-servio-orange-800 dark:text-servio-orange-300 border-servio-orange-200 dark:border-servio-orange-800',
    info: 'bg-primary-100 dark:bg-primary-900/30 text-primary-800 dark:text-primary-300 border-primary-200 dark:border-primary-800'
  }

  const Icon = icons[type]

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.3 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.5 }}
      className={`flex items-center p-4 rounded-xl border shadow-lg backdrop-blur-sm ${colors[type]}`}
    >
      <Icon className="w-5 h-5 mr-3 flex-shrink-0" />
      <span className="flex-1 text-sm font-medium">{message}</span>
      <button
        onClick={onClose}
        className="ml-3 p-1 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
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
      position: 'top-right'
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
      position: 'top-right'
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
      position: 'top-right'
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
      position: 'top-right'
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
      position="top-right"
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
      }}
    />
  )
}