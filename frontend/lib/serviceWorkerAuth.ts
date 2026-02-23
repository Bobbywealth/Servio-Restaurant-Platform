let lastSyncedServiceWorkerToken: string | null = null

// Sync auth token to service worker for offline/PWA support
export function syncTokenToServiceWorker(token: string | null): void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  if (token === lastSyncedServiceWorkerToken) return

  navigator.serviceWorker.ready.then((registration) => {
    if (!registration.active) return

    if (token) {
      registration.active.postMessage({
        type: 'SET_AUTH_TOKEN',
        payload: { token }
      })
    } else {
      registration.active.postMessage({
        type: 'CLEAR_AUTH_TOKEN'
      })
    }

    lastSyncedServiceWorkerToken = token
  }).catch(() => {
    // Service worker not available
  })
}

// Cross-tab fallback: storage events fire in other tabs, not current tab.
export function registerTokenStorageSync(onTokenChange: (token: string | null) => void): () => void {
  const handleStorage = (event: StorageEvent) => {
    if (event.key === 'servio_access_token') {
      onTokenChange(event.newValue)
    }
  }

  window.addEventListener('storage', handleStorage)

  return () => {
    window.removeEventListener('storage', handleStorage)
  }
}

export function resetServiceWorkerTokenSyncState(): void {
  lastSyncedServiceWorkerToken = null
}
