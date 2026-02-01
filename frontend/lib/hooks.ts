'use client';

import React, { useEffect, useRef } from 'react';

// Helper function to convert base64 VAPID key to Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const rawData = window.atob(base64);
  // Use Array.from to create a proper Uint8Array with the correct buffer type
  return Uint8Array.from(rawData, (char) => char.charCodeAt(0));
}

export function usePerformanceMonitor() {
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;

    // Mark initialization
    initialized.current = true;

    // Monitor performance
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((entries) => {
        const entryList = entries.getEntries();
        entryList.forEach((entry) => {
          if (entry.entryType === 'navigation') {
            const navEntry = entry as any;
            console.log('[Performance] Navigation metrics:', {
              loadTime: navEntry.loadEventEnd - navEntry.startTime,
              domReady: navEntry.domContentLoadedEventEnd - navEntry.startTime,
              fetchTime: navEntry.responseEnd - navEntry.requestStart,
            });
          }
          if (entry.entryType === 'longtask') {
            console.warn('[Performance] Long task detected:', {
              duration: entry.duration,
              startTime: entry.startTime,
            });
          }
        });
      });

      observer.observe({
        entryTypes: ['navigation', 'longtask', 'measure'],
      });

      return () => observer.disconnect();
    }
  }, []);

  return {
    mark: (name: string) => performance.mark(name),
    measure: (name: string, startMark: string, endMark: string) =>
      performance.measure(name, startMark, endMark),
  };
}

export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = React.useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export function useThrottle<T>(value: T, limit: number = 300): T {
  const [throttledValue, setThrottledValue] = React.useState<T>(value);
  const lastRan = useRef(Date.now());

  useEffect(() => {
    const handler = setTimeout(() => {
      if (Date.now() - lastRan.current >= limit) {
        setThrottledValue(value);
        lastRan.current = Date.now();
      }
    }, limit - (Date.now() - lastRan.current));

    return () => clearTimeout(handler);
  }, [value, limit]);

  return throttledValue;
}

export function useLazyLoad<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  deps: React.DependencyList = []
) {
  const [data, setData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);
  const hasLoaded = useRef(false);

  useEffect(() => {
    if (hasLoaded.current) return;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await fn(...deps);
        setData(result);
        hasLoaded.current = true;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to load'));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, deps);

  return { data, loading, error, refetch: () => { hasLoaded.current = false; } };
}

export function useWindowSize() {
  const [size, setSize] = React.useState({ width: 0, height: 0 });

  useEffect(() => {
    const handleResize = () => {
      setSize({ width: window.innerWidth, height: window.innerHeight });
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // Initial call

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return size;
}

export function usePrevious<T>(value: T): T | undefined {
  const ref = React.useRef<T>(undefined);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref.current;
}

export function useMediaQuery(query: string) {
  const [matches, setMatches] = React.useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    setMatches(media.matches);

    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    media.addEventListener('change', handler);

    return () => media.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

// Push Notification Subscription Hook
export interface PushSubscriptionState {
  isSupported: boolean;
  permission: NotificationPermission;
  subscription: PushSubscription | null;
  vapidKey: string | null;
  isLoading: boolean;
  error: string | null;
}

export function usePushSubscription() {
  const [state, setState] = React.useState<PushSubscriptionState>({
    isSupported: false,
    permission: 'default',
    subscription: null,
    vapidKey: null,
    isLoading: true,
    error: null,
  });

  // Check if push notifications are supported
  useEffect(() => {
    const isSupported = 'serviceWorker' in navigator && 'PushManager' in window;
    setState(prev => ({ ...prev, isSupported }));

    if (!isSupported) {
      setState(prev => ({ ...prev, isLoading: false, error: 'Push notifications not supported' }));
      return;
    }

    // Get current permission status
    setState(prev => ({ ...prev, permission: Notification.permission }));
  }, []);

  // Get VAPID key and existing subscription
  useEffect(() => {
    if (!state.isSupported) return;

    const initPush = async () => {
      try {
        // Get VAPID key from server
        const response = await fetch('/api/push/vapid-key');
        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || 'Failed to get VAPID key');
        }

        setState(prev => ({ ...prev, vapidKey: data.publicKey }));

        // Get existing subscription
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();

        setState(prev => ({
          ...prev,
          subscription,
          permission: Notification.permission,
          isLoading: false,
        }));
      } catch (error) {
        console.error('Failed to initialize push:', error);
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to initialize push notifications'
        }));
      }
    };

    initPush();
  }, [state.isSupported]);

  // Subscribe to push notifications
  const subscribe = React.useCallback(async (): Promise<PushSubscription | null> => {
    if (!state.isSupported || !state.vapidKey) {
      setState(prev => ({ ...prev, error: 'Push not supported or no VAPID key' }));
      return null;
    }

    try {
      // Request permission first
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setState(prev => ({ ...prev, permission, error: 'Permission denied' }));
        return null;
      }

      setState(prev => ({ ...prev, permission }));

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;

      // Subscribe to push
      console.log('[Push] Subscribing with VAPID key length:', state.vapidKey?.length);
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        // Use type assertion to handle the Uint8Array buffer type mismatch
        applicationServerKey: urlBase64ToUint8Array(state.vapidKey) as unknown as BufferSource,
      });
      console.log('[Push] Subscription created successfully');

      // Send subscription to server
      const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription }),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to register subscription');
      }

      setState(prev => ({
        ...prev,
        subscription,
        permission: Notification.permission,
        error: null,
      }));

      console.log('[Push] Successfully subscribed to push notifications');
      return subscription;
    } catch (error) {
      console.error('[Push] Subscribe failed:', error);
      if (error instanceof Error) {
        console.error('[Push] Error name:', error.name);
        console.error('[Push] Error message:', error.message);
      }
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to subscribe'
      }));
      return null;
    }
  }, [state.isSupported, state.vapidKey]);

  // Unsubscribe from push notifications
  const unsubscribe = React.useCallback(async (): Promise<boolean> => {
    if (!state.subscription) {
      return true;
    }

    try {
      // Unsubscribe from push manager
      await state.subscription.unsubscribe();

      // Notify server
      await fetch('/api/push/unsubscribe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscriptionId: null }),
      });

      setState(prev => ({
        ...prev,
        subscription: null,
        error: null,
      }));

      console.log('[Push] Successfully unsubscribed from push notifications');
      return true;
    } catch (error) {
      console.error('[Push] Unsubscribe failed:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to unsubscribe'
      }));
      return false;
    }
  }, [state.subscription]);

  // Resubscribe if subscription was lost
  const resubscribe = React.useCallback(async (): Promise<PushSubscription | null> => {
    if (state.subscription) {
      await unsubscribe();
    }
    return subscribe();
  }, [subscribe, unsubscribe, state.subscription]);

  return {
    ...state,
    subscribe,
    unsubscribe,
    resubscribe,
  };
}

// Notification Preferences Hook
export interface NotificationPreferences {
  pushEnabled: boolean;
  orderNotifications: boolean;
  staffNotifications: boolean;
  inventoryNotifications: boolean;
  taskNotifications: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
}

export function useNotificationPreferences() {
  const [preferences, setPreferences] = React.useState<NotificationPreferences | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Fetch preferences
  useEffect(() => {
    const fetchPreferences = async () => {
      try {
        const response = await fetch('/api/push/preferences');
        const data = await response.json();

        if (data.success) {
          setPreferences(data.data);
        } else {
          throw new Error(data.error || 'Failed to fetch preferences');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch preferences');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPreferences();
  }, []);

  // Update preferences
  const updatePreferences = React.useCallback(
    async (updates: Partial<NotificationPreferences>): Promise<boolean> => {
      try {
        const response = await fetch('/api/push/preferences', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ preferences: updates }),
        });

        const data = await response.json();

        if (data.success) {
          setPreferences(prev => (prev ? { ...prev, ...updates } : null));
          return true;
        } else {
          throw new Error(data.error || 'Failed to update preferences');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update preferences');
        return false;
      }
    },
    []
  );

  return {
    preferences,
    isLoading,
    error,
    updatePreferences,
  };
}
