import React, { useEffect, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { WifiOff, RefreshCw, Home, Mic, Clock } from 'lucide-react'

export default function OfflinePage() {
  const [isOnline, setIsOnline] = useState(false)
  const [lastOnline, setLastOnline] = useState<Date | null>(null)

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      setTimeout(() => {
        window.location.reload()
      }, 1000)
    }

    const handleOffline = () => {
      setIsOnline(false)
      setLastOnline(new Date())
    }

    // Check initial status
    setIsOnline(navigator.onLine)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const retryConnection = () => {
    if (navigator.onLine) {
      window.location.reload()
    }
  }

  return (
    <>
      <Head>
        <title>Offline - Servio Restaurant Platform</title>
        <meta name="description" content="You are currently offline" />
        <meta name="robots" content="noindex" />
      </Head>

      <div className="min-h-screen gradient-surface flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="card"
          >
            {/* Offline Icon */}
            <motion.div
              className="mx-auto mb-6"
              animate={{
                scale: [1, 1.1, 1],
                opacity: [0.7, 1, 0.7]
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            >
              <div className="w-20 h-20 bg-surface-100 dark:bg-surface-800 rounded-full flex items-center justify-center">
                <WifiOff className="w-10 h-10 text-surface-400 dark:text-surface-500" />
              </div>
            </motion.div>

            {/* Status */}
            <div className="mb-6">
              {isOnline ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-servio-green-600 dark:text-servio-green-400"
                >
                  <div className="w-6 h-6 bg-servio-green-500 rounded-full mx-auto mb-2 animate-pulse" />
                  <p className="font-semibold">Back Online!</p>
                  <p className="text-sm">Reconnecting...</p>
                </motion.div>
              ) : (
                <div className="text-surface-600 dark:text-surface-400">
                  <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100 mb-2">
                    You&apos;re Offline
                  </h1>
                  <p className="text-surface-600 dark:text-surface-400 mb-4">
                    Check your internet connection and try again.
                  </p>
                </div>
              )}
            </div>

            {/* Last Online */}
            {lastOnline && !isOnline && (
              <div className="mb-6 p-3 bg-surface-100 dark:bg-surface-800 rounded-lg">
                <div className="flex items-center justify-center text-sm text-surface-500 dark:text-surface-400">
                  <Clock className="w-4 h-4 mr-2" />
                  <span>Last online: {lastOnline.toLocaleTimeString()}</span>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="space-y-3">
              <button
                onClick={retryConnection}
                className="btn-primary w-full flex items-center justify-center"
                disabled={isOnline}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isOnline ? 'animate-spin' : ''}`} />
                {isOnline ? 'Reconnecting...' : 'Try Again'}
              </button>

              <Link
                href="/"
                className="btn-secondary w-full flex items-center justify-center"
              >
                <Home className="w-4 h-4 mr-2" />
                Go to Homepage
              </Link>
            </div>

            {/* Offline Features */}
            <div className="mt-8 p-4 bg-surface-50 dark:bg-surface-800/50 rounded-lg">
              <h3 className="font-semibold text-surface-900 dark:text-surface-100 mb-3">
                Available Offline
              </h3>
              <div className="space-y-2 text-sm text-surface-600 dark:text-surface-400">
                <div className="flex items-center">
                  <Mic className="w-4 h-4 mr-2 text-servio-orange-500" />
                  <span>Voice recordings (saved locally)</span>
                </div>
                <div className="flex items-center">
                  <div className="w-4 h-4 mr-2 bg-primary-500 rounded-full" />
                  <span>Cached dashboard data</span>
                </div>
                <div className="flex items-center">
                  <div className="w-4 h-4 mr-2 bg-servio-green-500 rounded-full" />
                  <span>Previous order history</span>
                </div>
              </div>
            </div>

            {/* Network Info */}
            <div className="mt-4 text-2xs text-surface-400 dark:text-surface-500">
              <p>Connection: {navigator.onLine ? 'Online' : 'Offline'}</p>
              <p>Servio will sync when connection is restored</p>
            </div>
          </motion.div>
        </div>
      </div>
    </>
  )
}