import '../styles/globals.css'
import type { AppProps } from 'next/app'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useState, useEffect, useCallback } from 'react'
import Router from 'next/router'
import dynamic from 'next/dynamic'
import { UserProvider } from '../contexts/UserContext'
import { ThemeProvider } from '../contexts/ThemeContext'
import { Inter } from 'next/font/google'
import { usePushSubscription } from '../lib/hooks'

// LOAD INTER FONT VIA NEXT.JS FONT OPTIMIZATION
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
  preload: true,
})

// LAZY LOAD TOAST PROVIDER FOR PERFORMANCE
const ToastProvider = dynamic(() => import('../components/ui/Toast'), {
  ssr: false,
  loading: () => null
})

// Session keep-alive interval (refresh token proactively)
const SESSION_KEEPALIVE_INTERVAL = 10 * 60 * 1000 // 10 minutes

export default function App({ Component, pageProps }: AppProps) {
  const [routeLoading, setRouteLoading] = useState(false)
  const router = useRouter()
  const isTabletRoute = router.pathname.startsWith('/tablet')

  // Proactive session keep-alive to prevent auto-logout
  const keepSessionAlive = useCallback(async () => {
    if (typeof window === 'undefined') return

    const refreshToken = window.localStorage.getItem('servio_refresh_token')
    const accessToken = window.localStorage.getItem('servio_access_token')

    // Only refresh if we have tokens
    if (!refreshToken) return

    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL ||
        process.env.NEXT_PUBLIC_BACKEND_URL ||
        'http://localhost:3002'

      const response = await fetch(`${baseUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken })
      })

      if (response.ok) {
        const data = await response.json()
        const newAccessToken = data?.data?.accessToken
        if (newAccessToken) {
          window.localStorage.setItem('servio_access_token', newAccessToken)
        }
      }
    } catch (error) {
      // Silent fail - token refresh will happen on next API call if needed
    }
  }, [])

  useEffect(() => {
    // Route loading indicator
    const handleRouteStart = () => setRouteLoading(true)
    const handleRouteDone = () => setRouteLoading(false)
    Router.events.on('routeChangeStart', handleRouteStart)
    Router.events.on('routeChangeComplete', handleRouteDone)
    Router.events.on('routeChangeError', handleRouteDone)

    return () => {
      Router.events.off('routeChangeStart', handleRouteStart)
      Router.events.off('routeChangeComplete', handleRouteDone)
      Router.events.off('routeChangeError', handleRouteDone)
    }
  }, [])

  // Proactive session keep-alive
  useEffect(() => {
    if (typeof window === 'undefined') return

    // Initial keep-alive after 1 minute
    const initialTimeout = setTimeout(keepSessionAlive, 60 * 1000)

    // Regular interval keep-alive
    const interval = setInterval(keepSessionAlive, SESSION_KEEPALIVE_INTERVAL)

    // Keep alive on user activity (debounced)
    let activityTimeout: ReturnType<typeof setTimeout> | null = null
    const handleActivity = () => {
      if (activityTimeout) clearTimeout(activityTimeout)
      activityTimeout = setTimeout(keepSessionAlive, 5 * 60 * 1000) // 5 min after activity
    }

    let eventCleanup: (() => void)[] = []

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll']
    events.forEach(event => {
      const handler = (e: Event) => {
        if (e.type === 'touchstart') {
          if (activityTimeout) clearTimeout(activityTimeout)
          activityTimeout = setTimeout(keepSessionAlive, 5 * 60 * 1000)
        } else {
          handleActivity()
        }
      }
      window.addEventListener(event, handler, { passive: true })
      eventCleanup.push(() => window.removeEventListener(event, handler))
    })

    return () => {
      clearTimeout(initialTimeout)
      clearInterval(interval)
      if (activityTimeout) clearTimeout(activityTimeout)
      eventCleanup.forEach(cleanup => cleanup())
    }
  }, [keepSessionAlive])

  // Service worker registration with update handling
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

    let refreshing = false
    const handleControllerChange = () => {
      if (refreshing) return
      refreshing = true
      window.location.reload()
    }

    const sendAuthTokenToSW = () => {
      const token = window.localStorage.getItem('servio_access_token')
      if (token && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'SET_AUTH_TOKEN',
          payload: { token }
        })
        console.log('📤 Sent auth token to service worker')
      }
    }

    const clearAuthTokenInSW = () => {
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'CLEAR_AUTH_TOKEN'
        })
        console.log('📤 Cleared auth token in service worker')
      }
    }

    const registerServiceWorker = () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          registration.update()

          // Send auth token when SW is ready
          sendAuthTokenToSW()

          // Listen for token changes and update SW
          window.addEventListener('storage', (e) => {
            if (e.key === 'servio_access_token') {
              if (e.newValue) {
                sendAuthTokenToSW()
              } else {
                clearAuthTokenInSW()
              }
            }
          })

          if (registration.waiting) {
            registration.waiting.postMessage({ type: 'SKIP_WAITING' })
          }

          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing
            if (!newWorker) return
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                newWorker.postMessage({ type: 'SKIP_WAITING' })
              }
            })
          })
        })
        .catch(() => {
          // Ignore registration failures
        })
    }

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange)
    if (document.readyState === 'complete') {
      registerServiceWorker()
    } else {
      window.addEventListener('load', registerServiceWorker, { once: true })
    }

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange)
    }
  }, [])

  // Push notification subscription
  const pushSubscription = usePushSubscription()

  // Auto-subscribe to push notifications when user is authenticated
  useEffect(() => {
    // Only try to subscribe if:
    // 1. Push is supported
    // 2. User is authenticated (has access token)
    // 3. Not already subscribed
    // 4. Permission not denied
    if (
      !pushSubscription.isSupported ||
      !pushSubscription.subscription &&
      pushSubscription.permission !== 'denied' &&
      !pushSubscription.isLoading
    ) {
      // Check if user is authenticated
      const accessToken = window.localStorage.getItem('servio_access_token')
      if (accessToken) {
        // Request notification permission and subscribe
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            pushSubscription.subscribe().catch(err => {
              console.warn('[Push] Auto-subscribe failed:', err)
            })
          }
        }).catch(err => {
          console.warn('[Push] Permission request failed:', err)
        })
      }
    }
  }, [pushSubscription, pushSubscription.isSupported, pushSubscription.subscription, pushSubscription.permission, pushSubscription.isLoading])

  return (
    <>
      <Head>
        {/* OPTIMIZE VIEWPORT */}
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no, maximum-scale=1" />

        {/* PWA META TAGS */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Servio" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-tap-highlight" content="no" />
        <meta name="theme-color" content="#14B8A6" />
        <link rel="manifest" href={isTabletRoute ? '/manifest-tablet.webmanifest' : '/manifest.json'} />
        <link rel="apple-touch-icon" href="/images/servio_logo_transparent_tight.png" />

        {/* PERFORMANCE HINTS - CRITICAL */}
        <meta httpEquiv="x-dns-prefetch-control" content="on" />
        <link rel="dns-prefetch" href="//fonts.googleapis.com" />
        <link rel="dns-prefetch" href="//fonts.gstatic.com" />
        <link rel="preconnect" href="https://fonts.googleapis.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />

        {/* PRELOAD CRITICAL RESOURCES */}
        <link rel="preload" href="/manifest.json" as="fetch" crossOrigin="anonymous" />
        {isTabletRoute && (
          <link rel="preload" href="/manifest-tablet.webmanifest" as="fetch" crossOrigin="anonymous" />
        )}
      </Head>

      <style jsx global>{`
        html {
          font-family: ${inter.style.fontFamily};
        }
        /* CRITICAL: Prevent layout shift */
        html, body {
          overflow-x: hidden;
          scroll-behavior: smooth;
        }
        /* GPU acceleration for animations */
        .animate-route-progress {
          transform: translateZ(0);
          will-change: transform;
        }
      `}</style>

      <ThemeProvider>
        <UserProvider>
          {routeLoading && (
            <div className="fixed top-0 left-0 right-0 z-[9999] h-0.5 bg-primary-500 animate-route-progress" />
          )}
          <Component {...pageProps} />
          <ToastProvider />
        </UserProvider>
      </ThemeProvider>
    </>
  )
}
