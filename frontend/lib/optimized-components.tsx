import React, { memo, useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';

// Optimized Motion component wrapper
export const OptimizedMotion = memo(motion.div);
OptimizedMotion.displayName = 'OptimizedMotion';

// Create optimized component with memoization
export function createOptimizedComponent<P extends object>(
  Component: React.ComponentType<P>,
  propsToWatch?: (keyof P)[]
) {
  const OptimizedComponent = memo(Component, (prevProps, nextProps) => {
    if (!propsToWatch) return false;
    
    for (const prop of propsToWatch) {
      if (prevProps[prop] !== nextProps[prop]) {
        return false;
      }
    }
    return true;
  });

  OptimizedComponent.displayName = `Optimized(${Component.displayName || Component.name})`;
  return OptimizedComponent;
}

// VirtualizedList removed for TypeScript compatibility

// Intersection observer hook for lazy loading
export function useIntersectionObserver(
  elementRef: React.RefObject<Element | null>,
  options: IntersectionObserverInit = {}
) {
  const [isIntersecting, setIsIntersecting] = useState(false);
  
  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;
    
    const observer = new IntersectionObserver(
      ([entry]) => setIsIntersecting(entry.isIntersecting),
      { threshold: 0.1, ...options }
    );
    
    observer.observe(element);
    return () => observer.unobserve(element);
  }, [elementRef, options]);
  
  return isIntersecting;
}

// Lazy component with intersection observer
interface LazyComponentProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  rootMargin?: string;
  threshold?: number;
  className?: string;
}

export const LazyComponent = memo(({
  children,
  fallback = <div>Loading...</div>,
  rootMargin = '50px',
  threshold = 0.1,
  className = ''
}: LazyComponentProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const isVisible = useIntersectionObserver(ref, { rootMargin, threshold });
  
  return (
    <div ref={ref} className={className}>
      {isVisible ? children : fallback}
    </div>
  );
});

LazyComponent.displayName = 'LazyComponent';

// Batched updates hook for performance
export function useBatchedUpdates<T extends object>(initialState: T) {
  const [state, setState] = useState(initialState);
  const batchedUpdatesRef = useRef<Partial<T>>({});
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const updateState = useCallback((updates: Partial<T>) => {
    // Batch updates together
    batchedUpdatesRef.current = { ...batchedUpdatesRef.current, ...updates };
    
    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // Schedule batched update
    timeoutRef.current = setTimeout(() => {
      setState(prev => ({ ...prev, ...batchedUpdatesRef.current }));
      batchedUpdatesRef.current = {};
      timeoutRef.current = null;
    }, 0);
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return [state, updateState] as const;
}

// Performance monitoring hook
export function usePerformanceMonitor(componentName: string) {
  const renderStartTime = useRef<number>(0);

  useEffect(() => {
    renderStartTime.current = performance.now();
  });

  useEffect(() => {
    const renderTime = performance.now() - renderStartTime.current;
    if (renderTime > 16) { // More than one frame (16ms)
      console.warn(`${componentName} render took ${renderTime.toFixed(2)}ms`);
    }
  });
}

// Optimized image component
interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  loading?: 'lazy' | 'eager';
}

export const OptimizedImage = memo(({
  src,
  alt,
  width,
  height,
  className = '',
  loading = 'lazy'
}: OptimizedImageProps) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  const handleLoad = useCallback(() => setLoaded(true), []);
  const handleError = useCallback(() => setError(true), []);

  if (error) {
    return (
      <div className={`bg-gray-200 flex items-center justify-center ${className}`}>
        <span className="text-gray-500 text-sm">Failed to load</span>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {!loaded && (
        <div className="absolute inset-0 bg-gray-200 animate-pulse rounded" />
      )}
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        loading={loading}
        onLoad={handleLoad}
        onError={handleError}
        className={`transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
      />
    </div>
  );
});

OptimizedImage.displayName = 'OptimizedImage';

export default {
  OptimizedMotion,
  LazyComponent,
  createOptimizedComponent,
  useBatchedUpdates,
  useIntersectionObserver,
  usePerformanceMonitor,
  OptimizedImage,
};