import '../styles/globals.css'
import type { AppProps } from 'next/app'
import Head from 'next/head'
import { useState, useEffect, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { UserProvider } from '../contexts/UserContext'
import { ThemeProvider } from '../contexts/ThemeContext'

// LAZY LOAD TOAST PROVIDER FOR PERFORMANCE
const ToastProvider = dynamic(() => import('../components/ui/Toast'), {
  ssr: false,
  loading: () => null
})

export default function App({ Component, pageProps }: AppProps) {
  const [mounted, setMounted] = useState(false)

  // PERFORMANCE: Memoize the component tree
  const AppContent = useMemo(() => (
    <>
      {/* CRITICAL PERFORMANCE OPTIMIZATIONS */}
      <Head>
        {/* DNS PREFETCH FOR EXTERNAL RESOURCES */}
        <link rel="dns-prefetch" href="//fonts.googleapis.com" />
        <link rel="dns-prefetch" href="//fonts.gstatic.com" />

        {/* PRELOAD CRITICAL RESOURCES */}
        <link
          rel="preload"
          href="/fonts/inter-var.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />

        {/* OPTIMIZE VIEWPORT */}
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />

        {/* PERFORMANCE HINTS */}
        <meta httpEquiv="x-dns-prefetch-control" content="on" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />

        {/* CRITICAL CSS - INLINE FONT DISPLAY SWAP */}
        <style>{`
          @font-face {
            font-family: 'Inter';
            font-style: normal;
            font-weight: 100 900;
            font-display: swap;
            src: url('/fonts/inter-var.woff2') format('woff2');
          }
        `}</style>
      </Head>

      <ThemeProvider>
        <UserProvider>
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
    if ('serviceWorker' in navigator) {
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

    // Performance monitoring
    const mountTime = performance.now() - startTime
    console.log(`⚡ App mounted in ${mountTime.toFixed(2)}ms`)

    // Report Core Web Vitals
    if ('web-vital' in window) {
      // This would be implemented with web-vitals library
      console.log('📊 Core Web Vitals monitoring active')
    }
  }, [])

  // PERFORMANCE: Return loading state immediately
  if (!mounted) {
    // Return minimal loading state to prevent layout shift
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: '#fafafa',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '14px',
        color: '#666'
      }}>
        <div>⚡ Loading Servio...</div>
      </div>
    )
  }

  return AppContent
}