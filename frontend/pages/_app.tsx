import '../styles/globals.css'
import type { AppProps } from 'next/app'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useState, useEffect } from 'react'
import Router from 'next/router'
import dynamic from 'next/dynamic'
import { UserProvider } from '../contexts/UserContext'
import { ThemeProvider } from '../contexts/ThemeContext'
import { Inter } from 'next/font/google'

// LOAD INTER FONT VIA NEXT.JS FONT OPTIMIZATION
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

// LAZY LOAD TOAST PROVIDER FOR PERFORMANCE
const ToastProvider = dynamic(() => import('../components/ui/Toast'), {
  ssr: false,
  loading: () => null
})

export default function App({ Component, pageProps }: AppProps) {
  const [routeLoading, setRouteLoading] = useState(false)
  const router = useRouter()
  const isTabletRoute = router.pathname.startsWith('/tablet')

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

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

    let refreshing = false
    const handleControllerChange = () => {
      if (refreshing) return
      refreshing = true
      window.location.reload()
    }

    const registerServiceWorker = () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          registration.update()

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
          // Ignore registration failures to avoid breaking the app
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

  return (
    <>
      <Head>
        {/* OPTIMIZE VIEWPORT */}
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no" />

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

        {/* PERFORMANCE HINTS */}
        <meta httpEquiv="x-dns-prefetch-control" content="on" />
      </Head>

      <style jsx global>{`
        html {
          font-family: ${inter.style.fontFamily};
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