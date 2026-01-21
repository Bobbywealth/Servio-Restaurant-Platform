import React, { useEffect } from 'react';
import type { AppProps } from 'next/app';
import Head from 'next/head';
import { UserProvider } from '../contexts/UserContext';
import { ThemeProvider } from '../contexts/ThemeContext';
import { TourProvider } from '../contexts/TourContext';
import { Toaster } from 'react-hot-toast';
import { getPerformanceMonitor } from '../lib/performance';
import '../styles/globals.css';

// Initialize performance monitoring
let performanceMonitor: any = null;

function MyApp({ Component, pageProps, router }: AppProps) {
  useEffect(() => {
    // Initialize performance monitoring
    if (typeof window !== 'undefined') {
      performanceMonitor = getPerformanceMonitor();
      
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
        <meta name="theme-color" content="#000000" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/servio-icon-192.svg" />
        
        {/* Performance hints */}
        <link rel="preconnect" href={process.env.NEXT_PUBLIC_API_URL} />
        <link rel="dns-prefetch" href={process.env.NEXT_PUBLIC_API_URL} />
        
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
            <Component {...pageProps} />
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
          </TourProvider>
        </ThemeProvider>
      </UserProvider>
    </>
  );
}

export default MyApp;