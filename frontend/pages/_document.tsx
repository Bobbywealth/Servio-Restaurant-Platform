import { Html, Head, Main, NextScript } from 'next/document'

/**
 * Custom Document Component
 * 
 * This component is used to augment the application's <html> and <body> tags.
 * Includes accessibility, SEO, and performance optimizations.
 * 
 * @see https://nextjs.org/docs/advanced-features/custom-document
 */
export default function Document() {
  return (
    <Html lang="en" suppressHydrationWarning>
      <Head>
        {/* Preconnect to critical origins for faster resource loading */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        
        {/* DNS prefetch for API endpoints */}
        <link rel="dns-prefetch" href="https://servio-backend-zexb.onrender.com" />
        
        {/* Preload critical fonts */}
        <link 
          rel="preload" 
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" 
          as="style"
          onLoad="this.onload=null;this.rel='stylesheet'"
        />
        
        {/* Fallback for no-JS */}
        <noscript>
          <link 
            rel="stylesheet" 
            href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" 
          />
        </noscript>

        {/* Theme color for mobile browsers */}
        <meta name="theme-color" content="#14b8a6" />
        <meta name="msapplication-TileColor" content="#14b8a6" />
        
        {/* iOS Safari standalone mode */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Servio" />
        
        {/* Microsoft Tiles */}
        <meta name="msapplication-config" content="/browserconfig.xml" />
        
        {/* Canonical URL base */}
        <link rel="canonical" href="https://servio.com" />
        
        {/* Favicons */}
        <link rel="icon" type="image/x-icon" href="/favicon.ico" />
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/servio-icon-192.svg" />
        <link rel="icon" type="image/png" sizes="16x16" href="/icons/servio-icon-192.svg" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/servio-icon-192.svg" />
        
        {/* Manifest files */}
        <link rel="manifest" href="/manifest.json" />
        
        {/* Critical CSS for above-the-fold content - inlined to prevent layout shift */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
              /* Critical accessibility styles */
              :focus-visible {
                outline: 3px solid #14b8a6;
                outline-offset: 2px;
              }
              
              :focus:not(:focus-visible) {
                outline: none;
              }
              
              /* Skip link styles */
              .skip-link {
                position: absolute;
                top: -40px;
                left: 0;
                background: #14b8a6;
                color: white;
                padding: 8px 16px;
                z-index: 100;
                transition: top 0.2s;
                text-decoration: none;
                font-weight: 600;
                border-radius: 0 0 4px 0;
              }
              
              .skip-link:focus {
                top: 0;
              }
              
              /* Screen reader only class */
              .sr-only {
                position: absolute;
                width: 1px;
                height: 1px;
                padding: 0;
                margin: -1px;
                overflow: hidden;
                clip: rect(0, 0, 0, 0);
                white-space: nowrap;
                border-width: 0;
              }
              
              /* Prevent layout shift from custom scrollbar */
              html {
                scrollbar-gutter: stable;
              }
              
              /* Reduce motion for users who prefer it */
              @media (prefers-reduced-motion: reduce) {
                *,
                *::before,
                *::after {
                  animation-duration: 0.01ms !important;
                  animation-iteration-count: 1 !important;
                  transition-duration: 0.01ms !important;
                  scroll-behavior: auto !important;
                }
              }
              
              /* High contrast mode support */
              @media (prefers-contrast: high) {
                * {
                  border-color: currentColor !important;
                }
              }
            `
          }}
        />
      </Head>
      <body 
        suppressHydrationWarning
        className="antialiased"
      >
        {/* Skip navigation links for accessibility */}
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <a href="#main-navigation" className="skip-link" style={{ left: 'auto', right: 0 }}>
          Skip to navigation
        </a>
        
        {/* Main app */}
        <Main />
        
        {/* Next.js scripts */}
        <NextScript />
        
        {/* No-JS fallback message */}
        <noscript>
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: '#111827',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              padding: '2rem',
              textAlign: 'center',
              fontFamily: 'system-ui, sans-serif',
              zIndex: 9999
            }}
          >
            <h1>JavaScript Required</h1>
            <p style={{ marginTop: '1rem', maxWidth: '400px' }}>
              Servio requires JavaScript to run. Please enable JavaScript in your browser settings.
            </p>
          </div>
        </noscript>
      </body>
    </Html>
  )
}
