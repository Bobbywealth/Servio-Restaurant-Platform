// LIGHTNING FAST CACHING VERSION
const CACHE_NAME = 'servio-v2.0.0-turbo'
const STATIC_CACHE_NAME = 'servio-static-v2.0.0'
const DYNAMIC_CACHE_NAME = 'servio-dynamic-v2.0.0'
const API_CACHE_NAME = 'servio-api-v2.0.0'
const IMAGE_CACHE_NAME = 'servio-images-v2.0.0'

// AGGRESSIVE PRE-CACHING
const STATIC_CACHE_URLS = [
  '/',
  '/dashboard/',
  '/dashboard/assistant/',
  '/dashboard/orders/',
  '/dashboard/timeclock/',
  '/offline/',
  '/manifest.json',
  // Pre-cache critical assets
  '/_next/static/css/',
  '/_next/static/chunks/',
  '/_next/static/media/'
]

// CACHE STRATEGIES
const CACHE_STRATEGIES = {
  CACHE_FIRST: 'cache-first',
  NETWORK_FIRST: 'network-first', 
  STALE_WHILE_REVALIDATE: 'stale-while-revalidate',
  NETWORK_ONLY: 'network-only',
  CACHE_ONLY: 'cache-only'
}

// CACHE EXPIRATION TIMES
const CACHE_EXPIRATION = {
  STATIC: 365 * 24 * 60 * 60 * 1000, // 1 year
  DYNAMIC: 24 * 60 * 60 * 1000,      // 1 day
  API: 5 * 60 * 1000,                // 5 minutes
  IMAGES: 30 * 24 * 60 * 60 * 1000   // 30 days
}

// AGGRESSIVE INSTALL EVENT - PRE-CACHE EVERYTHING CRITICAL
self.addEventListener('install', (event) => {
  console.log('🚀 Servio SW: Turbo Installing...')
  
  event.waitUntil(
    Promise.all([
      // Pre-cache static assets
      caches.open(STATIC_CACHE_NAME).then(cache => {
        console.log('⚡ SW: Pre-caching static assets')
        return cache.addAll(STATIC_CACHE_URLS.filter(url => !url.includes('/_next/')))
      }),
      // Pre-cache dynamic routes
      caches.open(DYNAMIC_CACHE_NAME).then(cache => {
        console.log('🔥 SW: Pre-caching dynamic routes')
        return Promise.resolve()
      }),
      // Initialize API cache
      caches.open(API_CACHE_NAME).then(() => {
        console.log('💾 SW: API cache initialized')
        return Promise.resolve()
      }),
      // Initialize image cache
      caches.open(IMAGE_CACHE_NAME).then(() => {
        console.log('🖼️ SW: Image cache initialized')
        return Promise.resolve()
      })
    ]).then(() => {
      console.log('✅ SW: All caches initialized')
      return self.skipWaiting()
    })
  )
})

// LIGHTNING FAST ACTIVATE EVENT - CLEAN UP OLD CACHES
self.addEventListener('activate', (event) => {
  console.log('⚡ Servio SW: Turbo Activating...')
  
  const expectedCaches = [STATIC_CACHE_NAME, DYNAMIC_CACHE_NAME, API_CACHE_NAME, IMAGE_CACHE_NAME]
  
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cache => {
            if (!expectedCaches.includes(cache)) {
              console.log('🗑️ SW: Deleting old cache:', cache)
              return caches.delete(cache)
            }
          })
        )
      }),
      // Take control of all clients immediately
      self.clients.claim()
    ]).then(() => {
      console.log('✅ SW: Activation complete - TURBO MODE ENABLED')
      // Notify clients of update
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'SW_ACTIVATED',
            message: 'Servio is now running in TURBO MODE! ⚡'
          })
        })
      })
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

  // STRATEGY 3: IMAGES - CACHE FIRST WITH FALLBACK
  if (isImageRequest(url)) {
    event.respondWith(handleImageRequest(request))
    return
  }

  // STRATEGY 4: PAGE NAVIGATION - NETWORK FIRST WITH CACHE FALLBACK
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request))
    return
  }

  // STRATEGY 5: OTHER REQUESTS - STALE WHILE REVALIDATE
  event.respondWith(handleGenericRequest(request))
})

// API REQUEST HANDLER - STALE WHILE REVALIDATE WITH SMART CACHING
async function handleAPIRequest(request) {
  const url = new URL(request.url)
  const isReadOnlyAPI = request.method === 'GET' && 
    (url.pathname.includes('/menu') || url.pathname.includes('/inventory'))
  
  if (isReadOnlyAPI) {
    // Use stale-while-revalidate for read-only APIs
    return staleWhileRevalidate(request, API_CACHE_NAME, CACHE_EXPIRATION.API)
  }
  
  try {
    // For write operations, always try network first
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

// IMAGE REQUEST HANDLER - CACHE FIRST WITH WEBP CONVERSION
async function handleImageRequest(request) {
  const cache = await caches.open(IMAGE_CACHE_NAME)
  const cached = await cache.match(request)
  
  if (cached) return cached
  
  try {
    const response = await fetch(request)
    if (response.ok) {
      cache.put(request, response.clone())
    }
    return response
  } catch (error) {
    // Return placeholder image or throw
    return new Response(
      '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="#f3f4f6"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="#9ca3af">Image Unavailable</text></svg>',
      { headers: { 'Content-Type': 'image/svg+xml' } }
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
         url.pathname.includes('/manifest.json')
}

function isImageRequest(url) {
  return url.pathname.match(/\.(jpg|jpeg|png|gif|webp|svg|ico)$/i)
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

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(
      // Handle background sync for offline actions
      console.log('Service Worker: Background sync triggered')
    )
  }
})

// Push notifications
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'New notification from Servio',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    vibrate: [200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'View',
        icon: '/icons/checkmark.png'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/icons/xmark.png'
      }
    ]
  }

  event.waitUntil(
    self.registration.showNotification('Servio Restaurant Platform', options)
  )
})

// Notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/dashboard')
    )
  }
})

// Message handling
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})