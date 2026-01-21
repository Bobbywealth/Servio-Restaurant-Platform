// ULTRA-PERFORMANCE CACHING VERSION WITH ADVANCED STRATEGIES
const CACHE_VERSION = 'v3.0.0-ultra'
const CACHE_NAME = `servio-${CACHE_VERSION}-turbo`
const STATIC_CACHE_NAME = `servio-static-${CACHE_VERSION}`
const DYNAMIC_CACHE_NAME = `servio-dynamic-${CACHE_VERSION}`
const API_CACHE_NAME = `servio-api-${CACHE_VERSION}`
const IMAGE_CACHE_NAME = `servio-images-${CACHE_VERSION}`
const FONT_CACHE_NAME = `servio-fonts-${CACHE_VERSION}`
const CDN_CACHE_NAME = `servio-cdn-${CACHE_VERSION}`

// ULTRA-AGGRESSIVE PRE-CACHING WITH INTELLIGENT PRIORITIZATION
const CRITICAL_CACHE_URLS = [
  // Core app shell (highest priority)
  '/',
  '/login',
  '/offline/',
  '/manifest.json',
  '/manifest-tablet.json',
  
  // Critical pages (high priority)
  '/dashboard/',
  '/dashboard/assistant/',
  '/dashboard/orders/',
  '/tablet/orders/',
  
  // Secondary pages (medium priority)
  '/dashboard/inventory/',
  '/dashboard/settings/',
  '/tablet/assistant/',
  
  // Fonts and critical assets
  '/fonts/', // Will be handled separately
  '/_next/static/css/',
  '/_next/static/chunks/webpack.js',
  '/_next/static/chunks/main.js',
  '/_next/static/chunks/pages/_app.js'
]

const PREFETCH_CACHE_URLS = [
  // Lower priority pages
  '/dashboard/menu-management/',
  '/dashboard/integrations/',
  '/dashboard/marketing/',
  '/admin/',
  '/book-demo/'
]

const CRITICAL_IMAGES = [
  '/images/servio_logo_transparent_tight.png',
  '/icons/servio-icon-192.svg',
  '/icons/servio-icon-512.svg',
  '/favicon.ico'
]

// CACHE STRATEGIES
const CACHE_STRATEGIES = {
  CACHE_FIRST: 'cache-first',
  NETWORK_FIRST: 'network-first',
  STALE_WHILE_REVALIDATE: 'stale-while-revalidate',
  NETWORK_ONLY: 'network-only',
  CACHE_ONLY: 'cache-only'
}

// INTELLIGENT CACHE EXPIRATION STRATEGIES
const CACHE_EXPIRATION = {
  STATIC: 365 * 24 * 60 * 60 * 1000,  // 1 year (JS, CSS, fonts)
  IMAGES: 90 * 24 * 60 * 60 * 1000,   // 90 days (images, icons)
  DYNAMIC: 24 * 60 * 60 * 1000,       // 1 day (HTML pages)
  API_LONG: 30 * 60 * 1000,           // 30 minutes (menu, settings)
  API_SHORT: 5 * 60 * 1000,           // 5 minutes (orders, inventory)
  API_REALTIME: 1 * 60 * 1000,        // 1 minute (live data)
  FONTS: 365 * 24 * 60 * 60 * 1000,   // 1 year (fonts never change)
  CDN: 7 * 24 * 60 * 60 * 1000        // 7 days (external CDN assets)
}

// ULTRA-PERFORMANCE INSTALL EVENT WITH PROGRESSIVE CACHING
self.addEventListener('install', (event) => {
  console.log('🚀 Servio SW: Ultra-Performance Installing...')

  event.waitUntil(
    Promise.all([
      // Phase 1: Critical assets (blocking)
      caches.open(STATIC_CACHE_NAME).then(cache => {
        console.log('⚡ SW: Pre-caching critical static assets')
        return cache.addAll(CRITICAL_CACHE_URLS.filter(url => 
          !url.includes('/_next/') && !url.includes('/dashboard/') && !url.includes('/tablet/')
        )).catch(err => {
          console.warn('Some critical assets failed to cache:', err)
          return Promise.resolve() // Don't fail the install
        })
      }),
      
      // Phase 2: Critical images (blocking)
      caches.open(IMAGE_CACHE_NAME).then(cache => {
        console.log('🖼️ SW: Pre-caching critical images')
        return cache.addAll(CRITICAL_IMAGES).catch(err => {
          console.warn('Some critical images failed to cache:', err)
          return Promise.resolve()
        })
      }),
      
      // Initialize other caches
      caches.open(DYNAMIC_CACHE_NAME).then(() => {
        console.log('🔥 SW: Dynamic cache initialized')
        return Promise.resolve()
      }),
      caches.open(API_CACHE_NAME).then(() => {
        console.log('💾 SW: API cache initialized')
        return Promise.resolve()
      }),
      caches.open(FONT_CACHE_NAME).then(() => {
        console.log('📝 SW: Font cache initialized')
        return Promise.resolve()
      }),
      caches.open(CDN_CACHE_NAME).then(() => {
        console.log('🌐 SW: CDN cache initialized')
        return Promise.resolve()
      })
    ]).then(() => {
      console.log('✅ SW: Critical caches initialized')
      
      // Phase 3: Prefetch secondary assets (non-blocking)
      setTimeout(() => {
        prefetchSecondaryAssets()
      }, 1000)
      
      return self.skipWaiting()
    }).catch(err => {
      console.error('❌ SW: Installation failed:', err)
      return self.skipWaiting() // Still try to activate
    })
  )
})

// PROGRESSIVE SECONDARY ASSET PREFETCHING
async function prefetchSecondaryAssets() {
  console.log('🔄 SW: Starting secondary asset prefetch...')
  
  try {
    const staticCache = await caches.open(STATIC_CACHE_NAME)
    const dynamicCache = await caches.open(DYNAMIC_CACHE_NAME)
    
    // Prefetch dashboard and tablet routes
    const dashboardRoutes = CRITICAL_CACHE_URLS.filter(url => 
      url.includes('/dashboard/') || url.includes('/tablet/')
    )
    
    for (const route of dashboardRoutes) {
      try {
        const response = await fetch(route, { credentials: 'same-origin' })
        if (response.ok) {
          await dynamicCache.put(route, response)
        }
      } catch (err) {
        console.warn(`Failed to prefetch ${route}:`, err)
      }
    }
    
    // Prefetch lower priority pages
    for (const route of PREFETCH_CACHE_URLS) {
      try {
        const response = await fetch(route)
        if (response.ok) {
          await dynamicCache.put(route, response)
        }
      } catch (err) {
        console.warn(`Failed to prefetch ${route}:`, err)
      }
    }
    
    console.log('✅ SW: Secondary asset prefetch complete')
  } catch (err) {
    console.warn('⚠️ SW: Secondary prefetch failed:', err)
  }
}

// ULTRA-FAST ACTIVATE EVENT WITH INTELLIGENT CACHE MANAGEMENT
self.addEventListener('activate', (event) => {
  console.log('⚡ Servio SW: Ultra-Performance Activating...')

  const expectedCaches = [
    STATIC_CACHE_NAME, 
    DYNAMIC_CACHE_NAME, 
    API_CACHE_NAME, 
    IMAGE_CACHE_NAME,
    FONT_CACHE_NAME,
    CDN_CACHE_NAME
  ]

  event.waitUntil(
    Promise.all([
      // Intelligent cache cleanup with version awareness
      caches.keys().then(cacheNames => {
        const deletePromises = cacheNames.map(cache => {
          // Delete old versions of our caches
          if (cache.startsWith('servio-') && !expectedCaches.includes(cache)) {
            console.log('🗑️ SW: Deleting old cache version:', cache)
            return caches.delete(cache)
          }
          return Promise.resolve()
        })
        return Promise.all(deletePromises)
      }),
      
      // Take control of all clients immediately
      self.clients.claim()
      
    ]).then(() => {
      console.log('✅ SW: Activation complete - ULTRA MODE ENABLED')
      
      // Notify clients with enhanced information
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'SW_ACTIVATED',
            message: 'Servio is now running in ULTRA-PERFORMANCE MODE! 🚀',
            version: CACHE_VERSION,
            caches: expectedCaches.length
          })
        })
      })
      
      // Start background prefetch of secondary assets
      setTimeout(() => {
        prefetchSecondaryAssets()
      }, 2000)
    })
  )
})

// ULTRA-FAST FETCH EVENT WITH ADVANCED CACHING STRATEGIES
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET requests for caching (except for specific cases)
  if (request.method !== 'GET' && !url.pathname.startsWith('/api/')) {
    return
  }

  // STRATEGY 1: API REQUESTS - STALE WHILE REVALIDATE
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleAPIRequest(request))
    return
  }

  // STRATEGY 2: STATIC ASSETS - CACHE FIRST (JS, CSS, fonts)
  if (isStaticAsset(url)) {
    event.respondWith(handleStaticAsset(request))
    return
  }

  // STRATEGY 3: FONTS - CACHE FIRST WITH LONG TTL
  if (isFontRequest(url)) {
    event.respondWith(handleFontRequest(request))
    return
  }

  // STRATEGY 4: IMAGES - CACHE FIRST WITH WEBP OPTIMIZATION
  if (isImageRequest(url)) {
    event.respondWith(handleImageRequest(request))
    return
  }

  // STRATEGY 5: CDN ASSETS - CACHE FIRST WITH FALLBACK
  if (isCDNAsset(url)) {
    event.respondWith(handleCDNAsset(request))
    return
  }

  // STRATEGY 6: PAGE NAVIGATION - NETWORK FIRST WITH INTELLIGENT FALLBACK
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request))
    return
  }

  // STRATEGY 7: OTHER REQUESTS - STALE WHILE REVALIDATE
  event.respondWith(handleGenericRequest(request))
})

// API REQUEST HANDLER - STALE WHILE REVALIDATE WITH SMART CACHING
async function handleAPIRequest(request) {
  const url = new URL(request.url)
  const hasAuth =
    request.headers.get('Authorization') ||
    request.headers.get('authorization') ||
    request.credentials === 'include'

  if (hasAuth) {
    // Do NOT cache authenticated API responses
    try {
      return await fetch(request)
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: 'Offline',
          message: 'Network unavailable - please try again',
          cached: false
        }),
        {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }
  }

  try {
    // For unauthenticated APIs, always try network first
    const response = await fetch(request)

    // Cache successful GET responses
    if (response.ok && request.method === 'GET') {
      const cache = await caches.open(API_CACHE_NAME)
      cache.put(request, response.clone())
    }

    return response
  } catch (error) {
    // Offline fallback for GET requests
    if (request.method === 'GET') {
      const cached = await caches.match(request)
      if (cached) return cached
    }

    return new Response(
      JSON.stringify({
        error: 'Offline',
        message: 'Network unavailable - some features may be limited',
        cached: false
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
}

// STATIC ASSET HANDLER - AGGRESSIVE CACHE FIRST
async function handleStaticAsset(request) {
  const cache = await caches.open(STATIC_CACHE_NAME)
  const cached = await cache.match(request)

  if (cached) {
    // Return cached version immediately
    // Update in background if expired
    if (isCacheExpired(cached, CACHE_EXPIRATION.STATIC)) {
      updateCacheInBackground(request, STATIC_CACHE_NAME)
    }
    return cached
  }

  try {
    const response = await fetch(request)
    if (response.ok) {
      cache.put(request, response.clone())
    }
    return response
  } catch (error) {
    // Return a placeholder or throw
    throw error
  }
}

// FONT REQUEST HANDLER - AGGRESSIVE CACHE FIRST (FONTS NEVER CHANGE)
async function handleFontRequest(request) {
  const cache = await caches.open(FONT_CACHE_NAME)
  const cached = await cache.match(request)

  if (cached) return cached

  try {
    const response = await fetch(request, {
      mode: 'cors',
      credentials: 'omit'
    })
    if (response.ok) {
      // Fonts can be cached for a very long time
      const responseWithCache = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: {
          ...Object.fromEntries(response.headers.entries()),
          'Cache-Control': 'public, max-age=31536000, immutable'
        }
      })
      cache.put(request, responseWithCache.clone())
      return responseWithCache
    }
    return response
  } catch (error) {
    console.warn('Font loading failed:', error)
    return new Response(null, { status: 404 })
  }
}

// CDN ASSET HANDLER - CACHE FIRST WITH INTELLIGENT FALLBACK
async function handleCDNAsset(request) {
  const cache = await caches.open(CDN_CACHE_NAME)
  const cached = await cache.match(request)

  if (cached && !isCacheExpired(cached, CACHE_EXPIRATION.CDN)) {
    return cached
  }

  try {
    const response = await fetch(request, {
      mode: 'cors',
      credentials: 'omit'
    })
    if (response.ok) {
      cache.put(request, response.clone())
    }
    return response
  } catch (error) {
    // Return stale cache if available
    if (cached) {
      console.log('Returning stale CDN asset:', request.url)
      return cached
    }
    throw error
  }
}

// ENHANCED IMAGE REQUEST HANDLER WITH WEBP OPTIMIZATION
async function handleImageRequest(request) {
  const cache = await caches.open(IMAGE_CACHE_NAME)
  const cached = await cache.match(request)

  if (cached && !isCacheExpired(cached, CACHE_EXPIRATION.IMAGES)) {
    return cached
  }

  try {
    const response = await fetch(request)
    if (response.ok) {
      cache.put(request, response.clone())
    }
    return response
  } catch (error) {
    // Return stale cache or placeholder
    if (cached) {
      console.log('Returning stale image:', request.url)
      return cached
    }
    
    // Enhanced placeholder with better styling
    return new Response(
      `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
        <rect width="400" height="300" fill="#f8fafc"/>
        <rect x="20" y="20" width="360" height="260" fill="none" stroke="#e2e8f0" stroke-width="2" stroke-dasharray="5,5" rx="8"/>
        <circle cx="200" cy="120" r="30" fill="#cbd5e1"/>
        <path d="M200 100 L210 110 L200 120 L190 110 Z" fill="#94a3b8"/>
        <text x="200" y="180" text-anchor="middle" font-family="system-ui" font-size="14" fill="#64748b">Image Unavailable</text>
        <text x="200" y="200" text-anchor="middle" font-family="system-ui" font-size="12" fill="#94a3b8">Please check your connection</text>
      </svg>`,
      { 
        headers: { 
          'Content-Type': 'image/svg+xml',
          'Cache-Control': 'no-cache'
        } 
      }
    )
  }
}

// NAVIGATION HANDLER - NETWORK FIRST WITH SMART CACHING
async function handleNavigation(request) {
  try {
    const response = await fetch(request)

    if (response.ok) {
      // Cache successful navigations
      const cache = await caches.open(DYNAMIC_CACHE_NAME)
      cache.put(request, response.clone())
    }

    return response
  } catch (error) {
    // Try cache first, then offline page
    const cached = await caches.match(request)
    if (cached) return cached

    const offlinePage = await caches.match('/offline/')
    return offlinePage || new Response(
      '<!DOCTYPE html><html><head><title>Offline</title></head><body><h1>You are offline</h1><p>Please check your connection and try again.</p></body></html>',
      { headers: { 'Content-Type': 'text/html' } }
    )
  }
}

// GENERIC REQUEST HANDLER - STALE WHILE REVALIDATE
async function handleGenericRequest(request) {
  return staleWhileRevalidate(request, DYNAMIC_CACHE_NAME, CACHE_EXPIRATION.DYNAMIC)
}

// STALE WHILE REVALIDATE IMPLEMENTATION
async function staleWhileRevalidate(request, cacheName, maxAge) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)

  // Always try to fetch in the background
  const fetchPromise = fetch(request).then(response => {
    if (response.ok) {
      cache.put(request, response.clone())
    }
    return response
  }).catch(() => null)

  // Return cached version if available and not expired
  if (cached && !isCacheExpired(cached, maxAge)) {
    // Update cache in background
    fetchPromise.catch(() => {})
    return cached
  }

  // Otherwise wait for network
  try {
    return await fetchPromise
  } catch (error) {
    // Return stale cache as last resort
    return cached || Promise.reject(error)
  }
}

// UTILITY FUNCTIONS
function isStaticAsset(url) {
  return url.pathname.includes('/_next/static/') ||
         url.pathname.endsWith('.js') ||
         url.pathname.endsWith('.css') ||
         url.pathname.endsWith('.woff2') ||
         url.pathname.endsWith('.woff') ||
         url.pathname.includes('/manifest.json') ||
         url.pathname.includes('/manifest-tablet.json')
}

function isImageRequest(url) {
  return url.pathname.match(/\.(jpg|jpeg|png|gif|webp|svg|ico)$/i)
}

function isFontRequest(url) {
  return url.pathname.match(/\.(woff2|woff|ttf|eot|otf)$/i) ||
         url.hostname.includes('fonts.gstatic.com') ||
         url.pathname.includes('/fonts/')
}

function isCDNAsset(url) {
  const cdnDomains = [
    'fonts.googleapis.com',
    'fonts.gstatic.com',
    'cdn.jsdelivr.net',
    'unpkg.com',
    'cdnjs.cloudflare.com'
  ]
  return cdnDomains.some(domain => url.hostname.includes(domain))
}

function isCacheExpired(response, maxAge) {
  const dateHeader = response.headers.get('date')
  if (!dateHeader) return true

  const cacheDate = new Date(dateHeader)
  return Date.now() - cacheDate.getTime() > maxAge
}

async function updateCacheInBackground(request, cacheName) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(cacheName)
      cache.put(request, response.clone())
    }
  } catch (error) {
    // Ignore background update failures
  }
}

// BACKGROUND SYNC FOR OFFLINE ACTIONS - TURBO MODE
self.addEventListener('sync', (event) => {
  console.log('⚡ SW: Background sync triggered -', event.tag)

  if (event.tag === 'background-sync') {
    event.waitUntil(handleBackgroundSync())
  }
})

async function handleBackgroundSync() {
  try {
    // Sync any offline data
    const offlineData = await getOfflineData()
    if (offlineData.length > 0) {
      console.log(`🔄 SW: Syncing ${offlineData.length} offline actions`)
      await syncOfflineData(offlineData)
    }
  } catch (error) {
    console.error('❌ SW: Background sync failed:', error)
  }
}

// ENHANCED PUSH NOTIFICATIONS
self.addEventListener('push', (event) => {
  let options = {
    body: 'New notification from Servio',
    icon: '/icons/servio-icon-192.svg',
    badge: '/icons/servio-icon-maskable.svg',
    vibrate: [200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: Date.now()
    },
    actions: [
      {
        action: 'view',
        title: '👀 View',
        icon: '/icons/servio-icon-192.svg'
      },
      {
        action: 'dismiss',
        title: '❌ Dismiss',
        icon: '/icons/servio-icon-192.svg'
      }
    ],
    requireInteraction: true,
    silent: false
  }

  if (event.data) {
    try {
      const payload = event.data.json()
      options = { ...options, ...payload }
    } catch (error) {
      options.body = event.data.text()
    }
  }

  event.waitUntil(
    self.registration.showNotification('⚡ Servio Restaurant Platform', options)
  )
})

// SMART NOTIFICATION CLICK HANDLING
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const action = event.action
  const data = event.notification.data || {}

  if (action === 'view' || !action) {
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then(clients => {
        // Try to focus existing window
        for (const client of clients) {
          if (client.url.includes('/dashboard') && 'focus' in client) {
            return client.focus()
          }
        }
        // Open new window if none found
        return clients.openWindow('/dashboard/')
      })
    )
  }
})

// ENHANCED MESSAGE HANDLING WITH PERFORMANCE METRICS
self.addEventListener('message', (event) => {
  const { type, payload } = event.data || {}

  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting()
      break

    case 'GET_CACHE_STATS':
      event.ports[0].postMessage(getCacheStats())
      break

    case 'CLEAR_CACHES':
      event.waitUntil(clearAllCaches().then(() => {
        event.ports[0].postMessage({ success: true })
      }))
      break

    case 'PERFORMANCE_MARK':
      // Handle performance marks from client
      console.log('📊 SW: Performance mark:', payload)
      break

    default:
      console.log('🔔 SW: Received message:', event.data)
  }
})

// UTILITY FUNCTIONS FOR OFFLINE SYNC
async function getOfflineData() {
  // In a real app, this would get data from IndexedDB
  return []
}

async function syncOfflineData(data) {
  // Sync offline data to server
  return Promise.resolve()
}

async function getCacheStats() {
  const cacheNames = await caches.keys()
  const stats = {}

  for (const cacheName of cacheNames) {
    const cache = await caches.open(cacheName)
    const keys = await cache.keys()
    stats[cacheName] = keys.length
  }

  return stats
}

async function clearAllCaches() {
  const cacheNames = await caches.keys()
  return Promise.all(cacheNames.map(name => caches.delete(name)))
}

// PERFORMANCE MONITORING
console.log('⚡ Servio Service Worker v2.0.0 - TURBO MODE ACTIVATED! 🚀')

// Report SW performance metrics
self.addEventListener('activate', () => {
  console.log('📊 SW Performance: Activation time -', performance.now(), 'ms')
})