// LIGHTNING FAST CACHING VERSION v3.1.0 - ULTRA TURBO MODE WITH AUTH
const CACHE_VERSION = 'v3.1.0-ultra'
const STATIC_CACHE_NAME = `servio-static-${CACHE_VERSION}`
const DYNAMIC_CACHE_NAME = `servio-dynamic-${CACHE_VERSION}`
const API_CACHE_NAME = `servio-api-${CACHE_VERSION}`
const IMAGE_CACHE_NAME = `servio-images-${CACHE_VERSION}`
const FONT_CACHE_NAME = `servio-fonts-${CACHE_VERSION}`

// AUTH TOKEN STORAGE (IndexedDB)
let cachedAuthToken = null
let cachedAuthTokenTime = 0
const TOKEN_CACHE_MS = 60 * 60 * 1000 // 1 hour

// AGGRESSIVE PRE-CACHING FOR INSTANT LOADS
const CRITICAL_ASSETS = [
  '/offline',
  '/manifest.json',
  '/manifest-tablet.webmanifest',
  '/icons/servio-icon-192.svg',
  '/icons/servio-icon-512.svg',
  '/icons/servio-icon-maskable.svg',
  '/images/servio_logo_transparent_tight.png'
]

// CACHE CONFIGURATION
const CACHE_CONFIG = {
  STATIC_TTL: 365 * 24 * 60 * 60 * 1000,    // 1 year for static assets
  DYNAMIC_TTL: 24 * 60 * 60 * 1000,          // 1 day for dynamic content
  API_TTL: 30 * 1000,                         // 30 seconds for API (mostly network-first)
  IMAGES_TTL: 30 * 24 * 60 * 60 * 1000,      // 30 days for images
  FONTS_TTL: 365 * 24 * 60 * 60 * 1000,      // 1 year for fonts
  MAX_CACHE_SIZE: 100,                        // Max items per cache
  STALE_THRESHOLD: 5 * 60 * 1000             // 5 minutes for stale-while-revalidate
}

// ULTRA FAST INSTALL - Pre-cache critical assets
self.addEventListener('install', (event) => {
  console.log('⚡ Servio SW v3.0.0: ULTRA TURBO Installing...')

  event.waitUntil(
    Promise.all([
      // Pre-cache static assets with high priority
      caches.open(STATIC_CACHE_NAME).then(cache => {
        console.log('🚀 SW: Pre-caching critical assets')
        return cache.addAll(CRITICAL_ASSETS.filter(url => !url.includes('/_next/')))
      }),
      // Initialize other caches
      caches.open(DYNAMIC_CACHE_NAME),
      caches.open(API_CACHE_NAME),
      caches.open(IMAGE_CACHE_NAME),
      caches.open(FONT_CACHE_NAME)
    ]).then(() => {
      console.log('✅ SW: All caches initialized - ULTRA TURBO MODE')
      return self.skipWaiting()
    })
  )
})

// LIGHTNING ACTIVATE - Clean old caches immediately
self.addEventListener('activate', (event) => {
  console.log('⚡ Servio SW: ULTRA TURBO Activating...')

  const currentCaches = [
    STATIC_CACHE_NAME,
    DYNAMIC_CACHE_NAME,
    API_CACHE_NAME,
    IMAGE_CACHE_NAME,
    FONT_CACHE_NAME
  ]

  event.waitUntil(
    Promise.all([
      // Clean old caches aggressively
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cache => {
            if (!currentCaches.includes(cache)) {
              console.log('🗑️ SW: Cleaning old cache:', cache)
              return caches.delete(cache)
            }
          })
        )
      }),
      // Take control immediately
      self.clients.claim()
    ]).then(() => {
      console.log('✅ SW: ULTRA TURBO MODE ACTIVATED')
      // Notify all clients
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'SW_ACTIVATED',
            version: CACHE_VERSION,
            message: 'Servio ULTRA TURBO MODE activated! ⚡'
          })
        })
      })
    })
  )
})

// ULTRA-OPTIMIZED FETCH HANDLER
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET requests (except for API mutations we want to handle)
  if (request.method !== 'GET') {
    return
  }

  // Skip chrome-extension and other non-http requests
  if (!url.protocol.startsWith('http')) {
    return
  }

  // STRATEGY 1: API REQUESTS - Network first, fast timeout
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleAPIRequest(request))
    return
  }

  // STRATEGY 2: FONTS - Cache first (immutable)
  if (isFont(url)) {
    event.respondWith(handleFontRequest(request))
    return
  }

  // STRATEGY 3: STATIC ASSETS - Cache first with background update
  if (isStaticAsset(url)) {
    event.respondWith(handleStaticAsset(request))
    return
  }

  // STRATEGY 4: IMAGES - Cache first with lazy update
  if (isImageRequest(url)) {
    event.respondWith(handleImageRequest(request))
    return
  }

  // STRATEGY 5: NAVIGATION - Network first with instant offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request))
    return
  }

  // STRATEGY 6: OTHER - Stale while revalidate
  event.respondWith(handleGenericRequest(request))
})

// API HANDLER - Network first with fast timeout for real-time data
async function handleAPIRequest(request) {
  const url = new URL(request.url)

  // Never cache auth endpoints
  if (url.pathname.includes('/auth/')) {
    try {
      return await fetch(request)
    } catch (error) {
      return createOfflineResponse()
    }
  }

  // Clone request to add auth header
  let authRequest = request
  const authToken = await getAuthToken()
  
  if (authToken) {
    const headers = new Headers(request.headers)
    headers.set('Authorization', `Bearer ${authToken}`)
    authRequest = new Request(request.url, {
      method: request.method,
      headers,
      body: request.body,
      mode: request.mode,
      credentials: request.credentials,
      cache: request.cache,
      redirect: request.redirect,
      referrer: request.referrer,
      integrity: request.integrity
    })
  }

  // Use network with fast timeout for other API calls
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 3000) // 3s timeout

  try {
    const response = await fetch(authRequest, { signal: controller.signal })
    clearTimeout(timeoutId)
    return response
  } catch (error) {
    clearTimeout(timeoutId)
    return createOfflineResponse()
  }
}

// AUTH TOKEN MANAGEMENT
async function getAuthToken() {
  // Check memory cache first
  if (cachedAuthToken && Date.now() - cachedAuthTokenTime < TOKEN_CACHE_MS) {
    return cachedAuthToken
  }

  try {
    // Try IndexedDB first
    const token = await getTokenFromIndexedDB()
    if (token) {
      cachedAuthToken = token
      cachedAuthTokenTime = Date.now()
      return token
    }
  } catch (e) {
    // IndexedDB not available
  }

  return null
}

async function getTokenFromIndexedDB() {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open('servioAuth', 1)

      request.onerror = () => resolve(null)
      request.onsuccess = () => {
        const db = request.result
        const tx = db.transaction('tokens', 'readonly')
        const store = tx.objectStore('tokens')
        const getRequest = store.get('accessToken')

        getRequest.onsuccess = () => {
          const result = getRequest.result
          resolve(result?.value || null)
        }
        getRequest.onerror = () => resolve(null)
      }

      request.onupgradeneeded = (event) => {
        const db = event.target.result
        if (!db.objectStoreNames.contains('tokens')) {
          db.createObjectStore('tokens', { keyPath: 'id' })
        }
      }
    } catch (e) {
      resolve(null)
    }
  })
}

async function saveTokenToIndexedDB(token) {
  try {
    const request = indexedDB.open('servioAuth', 1)

    request.onsuccess = () => {
      const db = request.result
      const tx = db.transaction('tokens', 'readwrite')
      const store = tx.objectStore('tokens')
      store.put({ id: 'accessToken', value: token, timestamp: Date.now() })
    }
  } catch (e) {
    // Ignore IndexedDB errors
  }
}

// FONT HANDLER - Aggressive cache first (fonts rarely change)
async function handleFontRequest(request) {
  const cache = await caches.open(FONT_CACHE_NAME)
  const cached = await cache.match(request)

  if (cached) {
    return cached
  }

  try {
    const response = await fetch(request)
    if (response.ok) {
      // Clone and cache with long TTL
      cache.put(request, response.clone())
    }
    return response
  } catch (error) {
    // Return empty response for fonts (page still works)
    return new Response('', { status: 503 })
  }
}

// STATIC ASSET HANDLER - Cache first with instant delivery
async function handleStaticAsset(request) {
  const cache = await caches.open(STATIC_CACHE_NAME)
  const cached = await cache.match(request)

  if (cached) {
    // Background update for stale assets
    updateInBackground(request, STATIC_CACHE_NAME)
    return cached
  }

  try {
    const response = await fetch(request)
    if (isCacheableResponse(response)) {
      cache.put(request, response.clone())
    }
    return response
  } catch (error) {
    throw error
  }
}

// IMAGE HANDLER - Cache first with placeholder fallback
async function handleImageRequest(request) {
  const cache = await caches.open(IMAGE_CACHE_NAME)
  const cached = await cache.match(request)

  if (cached) {
    return cached
  }

  try {
    const response = await fetch(request)
    if (isCacheableResponse(response)) {
      // Limit image cache size
      trimCache(IMAGE_CACHE_NAME, CACHE_CONFIG.MAX_CACHE_SIZE)
      cache.put(request, response.clone())
    }
    return response
  } catch (error) {
    return createPlaceholderImage()
  }
}

// NAVIGATION HANDLER - Network first with instant offline fallback
async function handleNavigation(request) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 5000) // 5s timeout for navigation

  try {
    const response = await fetch(request, { signal: controller.signal })
    clearTimeout(timeoutId)
    return response
  } catch (error) {
    clearTimeout(timeoutId)
    // Return offline page instantly
    const offlinePage = await caches.match('/offline')
    return offlinePage || createOfflinePage()
  }
}

// GENERIC HANDLER - Stale while revalidate
async function handleGenericRequest(request) {
  const cache = await caches.open(DYNAMIC_CACHE_NAME)
  const cached = await cache.match(request)

  const fetchPromise = fetch(request)
    .then(response => {
      if (isCacheableResponse(response)) {
        cache.put(request, response.clone())
      }
      return response
    })
    .catch(() => null)

  // Return cached immediately if available
  if (cached) {
    fetchPromise.catch(() => {}) // Update in background
    return cached
  }

  // Wait for network if no cache
  const response = await fetchPromise
  if (response) return response

  // Return offline response as last resort
  return createOfflineResponse()
}

// UTILITY FUNCTIONS
function isStaticAsset(url) {
  return url.pathname.includes('/_next/static/') ||
         url.pathname.endsWith('.js') ||
         url.pathname.endsWith('.css') ||
         url.pathname.endsWith('.json')
}

function isFont(url) {
  return url.pathname.endsWith('.woff2') ||
         url.pathname.endsWith('.woff') ||
         url.pathname.endsWith('.ttf') ||
         url.pathname.endsWith('.otf') ||
         url.pathname.includes('fonts.googleapis.com') ||
         url.pathname.includes('fonts.gstatic.com')
}

function isImageRequest(url) {
  return /\.(jpg|jpeg|png|gif|webp|svg|ico|avif)$/i.test(url.pathname)
}

function isCacheableResponse(response) {
  if (!response || response.status === 206) return false
  const contentType = response.headers.get('content-type') || ''
  // Don't cache HTML to avoid stale pages
  if (contentType.includes('text/html')) return false
  return response.ok
}

async function updateInBackground(request, cacheName) {
  try {
    const response = await fetch(request)
    if (isCacheableResponse(response)) {
      const cache = await caches.open(cacheName)
      cache.put(request, response)
    }
  } catch (error) {
    // Silently fail background updates
  }
}

async function trimCache(cacheName, maxSize) {
  const cache = await caches.open(cacheName)
  const keys = await cache.keys()
  if (keys.length > maxSize) {
    // Delete oldest entries
    const toDelete = keys.slice(0, keys.length - maxSize)
    await Promise.all(toDelete.map(key => cache.delete(key)))
  }
}

function createOfflineResponse() {
  return new Response(
    JSON.stringify({
      error: 'Offline',
      message: 'Network unavailable - please check your connection',
      offline: true
    }),
    {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    }
  )
}

function createPlaceholderImage() {
  return new Response(
    `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
      <rect width="200" height="200" fill="#1a1a1a"/>
      <text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="#6a6a6a" font-family="system-ui" font-size="12">
        Image unavailable
      </text>
    </svg>`,
    { headers: { 'Content-Type': 'image/svg+xml' } }
  )
}

function createOfflinePage() {
  return new Response(
    `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Offline - Servio</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: system-ui, -apple-system, sans-serif;
          background: #1a1a1a; color: #fff;
          min-height: 100vh; display: flex;
          align-items: center; justify-content: center;
          text-align: center; padding: 2rem;
        }
        h1 { font-size: 2rem; margin-bottom: 1rem; }
        p { color: #888; margin-bottom: 2rem; }
        button {
          background: #c4a661; color: #1a1a1a;
          border: none; padding: 1rem 2rem;
          border-radius: 0.5rem; font-weight: 600;
          cursor: pointer; font-size: 1rem;
        }
        button:hover { opacity: 0.9; }
      </style>
    </head>
    <body>
      <div>
        <h1>You're Offline</h1>
        <p>Check your internet connection and try again.</p>
        <button onclick="window.location.reload()">Retry</button>
      </div>
    </body>
    </html>`,
    { headers: { 'Content-Type': 'text/html' } }
  )
}

// BACKGROUND SYNC - Queue offline actions
self.addEventListener('sync', (event) => {
  console.log('⚡ SW: Background sync -', event.tag)
  if (event.tag === 'servio-sync') {
    event.waitUntil(processOfflineQueue())
  }
})

async function processOfflineQueue() {
  // This will be handled by the app when back online
  console.log('🔄 SW: Processing offline queue')
}

// PUSH NOTIFICATIONS - Enhanced
self.addEventListener('push', (event) => {
  // Default notification options
  const defaultOptions = {
    body: 'New notification from Servio',
    icon: '/icons/servio-icon-192.svg',
    badge: '/icons/servio-icon-192.svg',
    vibrate: [200, 100, 200, 100, 200],
    tag: 'servio-notification',
    renotify: true,
    requireInteraction: false,
    silent: false,
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1,
      url: '/tablet/orders'
    },
    actions: [
      { action: 'view', title: 'View', icon: '/icons/servio-icon-192.svg' },
      { action: 'dismiss', title: 'Dismiss', icon: '/icons/servio-icon-192.svg' }
    ]
  }

  let options = { ...defaultOptions }

  // Parse push data
  if (event.data) {
    try {
      const data = event.data.json()
      options = { ...defaultOptions, ...data }

      // Ensure data object exists
      if (!options.data) {
        options.data = defaultOptions.data
      }

      // Map notification type to appropriate routing
      if (options.data?.type) {
        options.data.url = getNotificationUrl(options.data.type, options.data)
      }

      // Set vibration pattern based on priority
      if (options.data?.severity === 'critical') {
        options.vibrate = [500, 200, 500, 200, 500]
        options.requireInteraction = true
      } else if (options.data?.severity === 'high') {
        options.vibrate = [300, 100, 300, 100, 300]
        options.requireInteraction = true
      }
    } catch (e) {
      // Fallback for plain text push
      options.body = event.data.text() || options.body
    }
  }

  console.log('🔔 SW: Received push notification', { tag: options.tag, body: options.body })

  event.waitUntil(
    self.registration.showNotification('Servio', options)
  )
})

// Helper function to get the appropriate URL for notification type
function getNotificationUrl(type, data) {
  const routes = {
    'order.created_web': '/tablet/orders',
    'order.created_vapi': '/tablet/orders',
    'order.status_changed': '/tablet/orders',
    'order': '/tablet/orders',
    'staff.clock_in': '/dashboard/staff',
    'staff.clock_out': '/dashboard/staff',
    'staff': '/dashboard/staff',
    'inventory.low_stock': '/dashboard/inventory',
    'inventory': '/dashboard/inventory',
    'task.created': '/dashboard/tasks',
    'task': '/dashboard/tasks',
    'system.error': '/admin/system-health',
    'system.warning': '/admin/system-health',
    'system': '/dashboard'
  }

  // Check for specific order ID in data
  if ((type.includes('order') || data?.orderId) && data?.orderId) {
    return `/tablet/orders/${data.orderId}`
  }

  // Check for specific task ID in data
  if ((type.includes('task') || data?.taskId) && data?.taskId) {
    return `/dashboard/tasks?task=${data.taskId}`
  }

  return routes[type] || routes[type.split('.')[0]] || '/dashboard'
}

// NOTIFICATION CLICK - Smart routing with action handling
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const data = event.notification.data || {}
  const action = event.action
  let url = data.url || '/dashboard'

  console.log('🔔 SW: Notification clicked', { action, url })

  // Handle different actions
  if (action === 'dismiss') {
    // Just close the notification - no action needed
    return
  }

  // Default action (click on notification body) - view the notification
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Try to focus an existing window first
      for (const client of clientList) {
        // Check if this client matches our app
        if (client.url.includes(self.registration.scope) && 'focus' in client) {
          // Navigate to the URL
          client.postMessage({
            type: 'NOTIFICATION_CLICK',
            url,
            data
          })
          return client.focus()
        }
      }

      // No existing window - open a new one
      if (clients.openWindow) {
        return clients.openWindow(url)
      }
    })
  )
})

// NOTIFICATION CLOSE - Handle when user dismisses notification
self.addEventListener('notificationclose', (event) => {
  const data = event.notification.data
  console.log('🔔 SW: Notification closed', { tag: event.notification.tag })

  // Could send analytics event here
  if (data?.type) {
    // Track notification dismissal
  }
})

// MESSAGE HANDLER - Inter-client communication
self.addEventListener('message', (event) => {
  const { type, payload } = event.data || {}

  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting()
      break

    case 'GET_VERSION':
      event.ports[0]?.postMessage({ version: CACHE_VERSION })
      break

    case 'CLEAR_CACHES':
      event.waitUntil(
        caches.keys().then(names =>
          Promise.all(names.map(name => caches.delete(name)))
        ).then(() => {
          event.ports[0]?.postMessage({ success: true })
        })
      )
      break

    case 'KEEP_ALIVE':
      // Used to prevent idle timeout - respond with acknowledgment
      event.ports[0]?.postMessage({ alive: true, timestamp: Date.now() })
      break

    case 'SET_AUTH_TOKEN':
      // Store auth token from frontend
      if (payload?.token) {
        cachedAuthToken = payload.token
        cachedAuthTokenTime = Date.now()
        // Also save to IndexedDB for persistence
        saveTokenToIndexedDB(payload.token)
        console.log('🔐 SW: Auth token received and stored')
      }
      break

    case 'CLEAR_AUTH_TOKEN':
      // Clear auth token on logout
      cachedAuthToken = null
      cachedAuthTokenTime = 0
      try {
        indexedDB.deleteDatabase('servioAuth')
      } catch (e) {
        // Ignore
      }
      console.log('🔐 SW: Auth token cleared')
      break

    default:
      console.log('🔔 SW: Message received:', type)
  }
})

console.log(`⚡ Servio Service Worker ${CACHE_VERSION} - ULTRA TURBO MODE WITH AUTH 🚀`)
