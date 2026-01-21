import React, { useEffect, useRef, useState } from 'react';
import type { AppProps } from 'next/app';
import Head from 'next/head';
import { UserProvider } from '../contexts/UserContext';
import { ThemeProvider } from '../contexts/ThemeContext';
import { TourProvider } from '../contexts/TourContext';
import { Toaster } from 'react-hot-toast';
import { getPerformanceMonitor } from '../lib/performance';
import { preloadCriticalResources, setupSmartPrefetching } from '../lib/dynamic-loader';
import SplashScreen from '../components/ui/SplashScreen';
import '../styles/globals.css';

// Initialize performance monitoring
let performanceMonitor: any = null;

function MyApp({ Component, pageProps, router }: AppProps) {
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isRouteLoading, setIsRouteLoading] = useState(false);
  const [isClientMounted, setIsClientMounted] = useState(false);
  const initialLoadStartRef = useRef<number | null>(null);

  // Set client mounted state to fix hydration issues
  useEffect(() => {
    setIsClientMounted(true);
  }, []);

  // Show splash on first page load (briefly)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    initialLoadStartRef.current = window.performance?.now?.() ?? Date.now();

    const finish = () => {
      const start = initialLoadStartRef.current ?? (window.performance?.now?.() ?? Date.now());
      const now = window.performance?.now?.() ?? Date.now();
      const elapsed = now - start;
      const minMs = 450; // ensure the spin is visible
      const remaining = Math.max(0, minMs - elapsed);
      window.setTimeout(() => setIsInitialLoading(false), remaining);
    };

    if (document.readyState === 'complete') {
      finish();
      return;
    }

    window.addEventListener('load', finish);
    return () => window.removeEventListener('load', finish);
  }, []);

  // Show splash during route transitions
  useEffect(() => {
    const handleStart = () => setIsRouteLoading(true);
    const handleDone = () => setIsRouteLoading(false);

    router.events.on('routeChangeStart', handleStart);
    router.events.on('routeChangeComplete', handleDone);
    router.events.on('routeChangeError', handleDone);

    return () => {
      router.events.off('routeChangeStart', handleStart);
      router.events.off('routeChangeComplete', handleDone);
      router.events.off('routeChangeError', handleDone);
    };
  }, [router.events]);

  useEffect(() => {
    // Initialize performance monitoring
    if (typeof window !== 'undefined') {
      performanceMonitor = getPerformanceMonitor();
      
      // Preload critical resources for faster rendering
      preloadCriticalResources();
      
      // Setup smart prefetching for better navigation
      setupSmartPrefetching(router);
      
      // Track page views
      const handleRouteChange = (url: string) => {
        performanceMonitor?.mark('route-change-start');
        
        // Track page load time
        setTimeout(() => {
          performanceMonitor?.measure('page-load-time', 'route-change-start');
        }, 100);

        // Send analytics if available
        if (typeof window !== 'undefined' && (window as any).gtag) {
          (window as any).gtag('config', 'GA_MEASUREMENT_ID', {
            page_path: url,
          });
        }
      };

      // Track route changes
      router.events.on('routeChangeComplete', handleRouteChange);
      router.events.on('hashChangeComplete', handleRouteChange);

      // Track initial page load
      handleRouteChange(router.asPath);

      // Prefetch critical routes after initial load
      setTimeout(() => {
        const criticalRoutes = ['/dashboard', '/dashboard/orders', '/dashboard/assistant'];
        criticalRoutes.forEach(route => {
          if (router.asPath !== route) {
            router.prefetch(route);
          }
        });
      }, 1000);

      return () => {
        router.events.off('routeChangeComplete', handleRouteChange);
        router.events.off('hashChangeComplete', handleRouteChange);
      };
    }
  }, [router]);

  // Track component render performance
  useEffect(() => {
    if (typeof window !== 'undefined' && performanceMonitor) {
      performanceMonitor.mark('app-render');
    }
  }, []);

  // Register Service Worker for PWA (tablet + dashboard)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    // Register only on secure contexts (or localhost), as required by browsers.
    const isLocalhost =
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname === '[::1]';
    if (window.location.protocol !== 'https:' && !isLocalhost) return;

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js');

        // If there's an updated SW waiting, activate it.
        if (reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }

        reg.addEventListener('updatefound', () => {
          const sw = reg.installing;
          if (!sw) return;
          sw.addEventListener('statechange', () => {
            if (sw.state === 'installed' && navigator.serviceWorker.controller) {
              sw.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });

        // Reload when a new SW takes control.
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          window.location.reload();
        });
      } catch (e) {
        // Non-fatal: app works without SW.
        console.warn('Service worker registration failed:', e);
      }
    };

    register();
  }, []);

  // Error boundary-like error handling
  useEffect(() => {
    const handleError = (error: ErrorEvent) => {
      console.error('Global error:', error);
      
      // Send error to monitoring service
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'exception', {
          description: error.message,
          fatal: false,
        });
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('Unhandled promise rejection:', event.reason);
      
      // Send error to monitoring service
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'exception', {
          description: event.reason?.toString() || 'Unhandled promise rejection',
          fatal: false,
        });
      }
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#14B8A6" key="theme-color" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="manifest" href="/manifest.json" key="manifest" />
        <link rel="apple-touch-icon" href="/icons/servio-icon-192.svg" />
        
        {/* Advanced performance hints and resource optimization */}
        <link rel="preconnect" href={process.env.NEXT_PUBLIC_API_URL} crossOrigin="anonymous" />
        <link rel="dns-prefetch" href={process.env.NEXT_PUBLIC_API_URL} />
        <link rel="preconnect" href="https://fonts.googleapis.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://www.googletagmanager.com" />
        <link rel="dns-prefetch" href="https://www.google-analytics.com" />
        
        {/* Critical resource hints */}
        <link rel="prefetch" href="/images/servio_logo_transparent_tight.png" />
        <link rel="prefetch" href="/icons/servio-icon-192.svg" />
        
        {/* Performance meta tags */}
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Servio" />
        
        {/* Optimize rendering */}
        <meta name="color-scheme" content="light dark" />
        <meta name="supported-color-schemes" content="light dark" />
        
        {/* Production analytics */}
        {process.env.NODE_ENV === 'production' && (
          <>
            <script
              async
              src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_ID || 'GA_MEASUREMENT_ID'}`}
            />
            <script
              dangerouslySetInnerHTML={{
                __html: `
                  window.dataLayer = window.dataLayer || [];
                  function gtag(){dataLayer.push(arguments);}
                  gtag('js', new Date());
                  gtag('config', '${process.env.NEXT_PUBLIC_GA_ID || 'GA_MEASUREMENT_ID'}', {
                    send_page_view: false
                  });
                `,
              }}
            />
          </>
        )}
      </Head>

      <UserProvider>
        <ThemeProvider>
          <TourProvider>
            {(isInitialLoading || isRouteLoading) && (
              <SplashScreen message={isRouteLoading ? 'Loading…' : 'Starting Servio…'} />
            )}
            <Component {...pageProps} />
            {isClientMounted && (
              <Toaster 
                position="top-right"
                toastOptions={{
                  duration: 4000,
                  style: {
                    background: '#363636',
                    color: '#fff',
                  },
                  success: {
                    style: {
                      background: '#10b981',
                    },
                  },
                  error: {
                    style: {
                      background: '#ef4444',
                    },
                  },
                }}
              />
            )}
          </TourProvider>
        </ThemeProvider>
      </UserProvider>
    </>
  );
}

export default MyApp;