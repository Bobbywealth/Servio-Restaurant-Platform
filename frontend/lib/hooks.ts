'use client';

import React, { useEffect, useRef } from 'react';

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
