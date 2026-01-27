const CACHE_NAME = 'servio-staff-clock-v1';
const STATIC_CACHE = 'servio-staff-static-v1';
const DYNAMIC_CACHE = 'servio-staff-dynamic-v1';

// Static assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/staff/clock',
  '/staff/clock/hours',
  '/manifest-staff.json'
];

// API endpoints to cache with network-first strategy
const API_CACHE_PATTERNS = [
  /\/api\/timeclock\/pin-login/,
  /\/api\/timeclock\/clock-in/,
  /\/api\/timeclock\/clock-out/,
  /\/api\/timeclock\/start-break/,
  /\/api\/timeclock\/end-break/,
  /\/api\/timeclock\/my-stats/
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== STATIC_CACHE && name !== DYNAMIC_CACHE)
            .map((name) => caches.delete(name))
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch event - handle requests with appropriate strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension and other non-http requests
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // API requests - network first, fall back to cache
  if (API_CACHE_PATTERNS.some(pattern => pattern.test(url.pathname))) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Static assets - cache first, fall back to network
  if (STATIC_ASSETS.includes(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Default - network first
  event.respondWith(networkFirst(request));
});

// Cache first strategy
async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.error('Cache first failed:', error);
    return new Response('Offline', { status: 503 });
  }
}

// Network first strategy
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Return a meaningful offline response for API calls
    if (request.url.includes('/api/')) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { message: 'You are offline. Data will sync when connected.' }
        }),
        {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    return new Response('Offline', { status: 503 });
  }
}

// Handle background sync for offline clock-in/out
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-clock-action') {
    event.waitUntil(syncClockActions());
  }
});

async function syncClockActions() {
  // Get pending actions from IndexedDB and sync them
  console.log('Syncing clock actions...');
  // Implementation would sync pending actions when back online
}

// Handle push notifications (for clock-in confirmations)
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    event.waitUntil(
      self.registration.showNotification(data.title || 'Servio Staff', {
        body: data.body || 'Clock action completed',
        icon: '/icons/clock-in-192.png',
        badge: '/icons/clock-in-72.png',
        data: data.url || '/staff/clock'
      })
    );
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data || '/staff/clock')
  );
});
