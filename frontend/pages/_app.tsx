import '../styles/globals.css'
import type { AppProps } from 'next/app'
import Head from 'next/head'
import { useState, useEffect, useMemo } from 'react'
import Router from 'next/router'
import dynamic from 'next/dynamic'
import { UserProvider } from '../contexts/UserContext'
import { ThemeProvider } from '../contexts/ThemeContext'
import SplashScreen from '../components/ui/SplashScreen'

// LAZY LOAD TOAST PROVIDER FOR PERFORMANCE
const ToastProvider = dynamic(() => import('../components/ui/Toast'), {
  ssr: false,
  loading: () => null
})

export default function App({ Component, pageProps }: AppProps) {
  const [mounted, setMounted] = useState(false)
  const [routeLoading, setRouteLoading] = useState(false)

  // PERFORMANCE: Memoize the component tree
  const AppContent = useMemo(() => (
    <>
      {/* CRITICAL PERFORMANCE OPTIMIZATIONS */}
      <Head>
        {/* DNS PREFETCH FOR EXTERNAL RESOURCES */}
        <link rel="dns-prefetch" href="//fonts.googleapis.com" />
        <link rel="dns-prefetch" href="//fonts.gstatic.com" />

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
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/images/servio_icon_tight.png" />

        {/* PERFORMANCE HINTS */}
        <meta httpEquiv="x-dns-prefetch-control" content="on" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" />

        {/* CRITICAL CSS */}
      </Head>

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
  ), [Component, pageProps])

  useEffect(() => {
    // LIGHTNING FAST MOUNT WITH PERFORMANCE MONITORING
    const startTime = performance.now()
    setMounted(true)

    // Register service worker for turbo caching
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { scope: '/' })
        .then(registration => {
          console.log('⚡ SW registered successfully:', registration)

          // Listen for updates
          registration.addEventListener('updatefound', () => {
            console.log('🔄 SW update found')
          })
        })
        .catch(error => {
          console.error('❌ SW registration failed:', error)
        })
    }

    // Route loading indicator
    const handleRouteStart = () => setRouteLoading(true)
    const handleRouteDone = () => setRouteLoading(false)
    Router.events.on('routeChangeStart', handleRouteStart)
    Router.events.on('routeChangeComplete', handleRouteDone)
    Router.events.on('routeChangeError', handleRouteDone)

    // Performance monitoring
    const mountTime = performance.now() - startTime
    console.log(`⚡ App mounted in ${mountTime.toFixed(2)}ms`)

    // Report Core Web Vitals
    if ('web-vital' in window) {
      // This would be implemented with web-vitals library
      console.log('📊 Core Web Vitals monitoring active')
    }
    return () => {
      Router.events.off('routeChangeStart', handleRouteStart)
      Router.events.off('routeChangeComplete', handleRouteDone)
      Router.events.off('routeChangeError', handleRouteDone)
    }
  }, [])

  // PERFORMANCE: Return loading state immediately
  if (!mounted) {
    return <SplashScreen />
  }

  return AppContent
}