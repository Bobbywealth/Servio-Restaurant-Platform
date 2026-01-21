// LIGHTNING FAST DYNAMIC COMPONENT LOADING WITH INTELLIGENT PREFETCHING
import React from 'react';
import dynamic from 'next/dynamic';
import { ComponentType } from 'react';

// Loading component for better UX
const LoadingSpinner = () => (
  <div className="flex items-center justify-center p-8">
    <div className="relative">
      <div className="w-8 h-8 border-4 border-primary-200 dark:border-primary-800 rounded-full animate-spin"></div>
      <div className="absolute top-0 left-0 w-8 h-8 border-4 border-transparent border-t-primary-500 rounded-full animate-spin"></div>
    </div>
  </div>
);

// Skeleton for layout components
const LayoutSkeleton = () => (
  <div className="animate-pulse">
    <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded mb-4"></div>
    <div className="space-y-3">
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
    </div>
  </div>
);

// Advanced dynamic loader with intelligent prefetching
interface DynamicLoaderOptions {
  ssr?: boolean;
  loading?: ComponentType;
  prefetch?: boolean;
  priority?: 'high' | 'normal' | 'low';
  preload?: boolean;
}

export function createDynamicLoader<P = {}>(
  importFn: () => Promise<{ default: ComponentType<P> }>,
  options: DynamicLoaderOptions = {}
) {
  const {
    ssr = false,
    loading = LoadingSpinner,
    prefetch = true,
    priority = 'normal',
    preload = false
  } = options;

  const DynamicComponent = dynamic(importFn, {
    ssr,
    loading: loading as any,
  });

  // Intelligent prefetching based on user interaction
  if (typeof window !== 'undefined' && prefetch) {
    let prefetched = false;
    
    const prefetchComponent = () => {
      if (!prefetched) {
        prefetched = true;
        importFn().catch(() => {
          prefetched = false; // Reset on error
        });
      }
    };

    // Prefetch strategies based on priority
    switch (priority) {
      case 'high':
        // Prefetch immediately
        setTimeout(prefetchComponent, 100);
        break;
      case 'normal':
        // Prefetch on user interaction
        const events = ['mouseenter', 'touchstart', 'focus'];
        const prefetchOnInteraction = () => {
          prefetchComponent();
          events.forEach(event => 
            document.removeEventListener(event, prefetchOnInteraction)
          );
        };
        events.forEach(event => 
          document.addEventListener(event, prefetchOnInteraction, { passive: true })
        );
        break;
      case 'low':
        // Prefetch on idle
        if ('requestIdleCallback' in window) {
          (window as any).requestIdleCallback(prefetchComponent);
        } else {
          setTimeout(prefetchComponent, 2000);
        }
        break;
    }
  }

  // Preload for critical components
  if (preload && typeof window !== 'undefined') {
    importFn();
  }

  return DynamicComponent;
}

// Pre-configured dynamic loaders for common component types

// Dashboard components (lazy loaded)
export const DashboardDynamic = {
  Assistant: createDynamicLoader(
    () => import('../components/Assistant/EmbeddedAssistant'),
    { priority: 'high', ssr: false }
  ),
  OrdersPanel: createDynamicLoader(
    () => import('../components/TabletOrders/OrdersListPanel'),
    { priority: 'high', ssr: false }
  ),
  OrderDetails: createDynamicLoader(
    () => import('../components/TabletOrders/OrderDetailsPanel'),
    { priority: 'normal', ssr: false }
  ),
  NotificationCenter: createDynamicLoader(
    () => import('../components/ui/NotificationCenter'),
    { priority: 'normal', ssr: false }
  ),
};

// Layout components (critical, but can be optimized)
export const LayoutDynamic = {
  DashboardLayout: createDynamicLoader(
    () => import('../components/Layout/DashboardLayout'),
    { priority: 'high', ssr: true, loading: LayoutSkeleton }
  ),
  TabletLayout: createDynamicLoader(
    () => import('../components/Layout/TabletLayout'),
    { priority: 'high', ssr: true, loading: LayoutSkeleton }
  ),
  AdminLayout: createDynamicLoader(
    () => import('../components/Layout/AdminLayout'),
    { priority: 'normal', ssr: true, loading: LayoutSkeleton }
  ),
};

// Page components (route-based lazy loading)
export const PageDynamic = {
  // Dashboard pages
  DashboardHome: createDynamicLoader(
    () => import('../pages/dashboard/index'),
    { priority: 'high', preload: true }
  ),
  DashboardOrders: createDynamicLoader(
    () => import('../pages/dashboard/orders'),
    { priority: 'high' }
  ),
  DashboardInventory: createDynamicLoader(
    () => import('../pages/dashboard/inventory'),
    { priority: 'normal' }
  ),
  DashboardSettings: createDynamicLoader(
    () => import('../pages/dashboard/settings'),
    { priority: 'low' }
  ),
  
  // Admin pages (low priority)
  AdminDashboard: createDynamicLoader(
    () => import('../pages/admin/index'),
    { priority: 'low', ssr: false }
  ),
  AdminOrders: createDynamicLoader(
    () => import('../pages/admin/orders/index'),
    { priority: 'low', ssr: false }
  ),
  
  // Tablet pages
  TabletOrders: createDynamicLoader(
    () => import('../pages/tablet/orders'),
    { priority: 'high', ssr: false }
  ),
  TabletAssistant: createDynamicLoader(
    () => import('../pages/tablet/assistant'),
    { priority: 'high', ssr: false }
  ),
};

// Heavy third-party components (always lazy loaded)
export const ThirdPartyDynamic = {
  ReactQuill: createDynamicLoader(
    () => import('react-quill'),
    { priority: 'low', ssr: false }
  ),
  
  ImageCrop: createDynamicLoader(
    () => import('react-image-crop'),
    { priority: 'low', ssr: false }
  ),
};

// Resource preloader for critical assets
export class ResourcePreloader {
  private static preloadedResources = new Set<string>();
  
  static preloadStylesheet(href: string) {
    if (typeof window === 'undefined' || this.preloadedResources.has(href)) {
      return;
    }
    
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'style';
    link.href = href;
    link.onload = () => {
      link.rel = 'stylesheet';
    };
    document.head.appendChild(link);
    this.preloadedResources.add(href);
  }
  
  static preloadScript(src: string) {
    if (typeof window === 'undefined' || this.preloadedResources.has(src)) {
      return;
    }
    
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'script';
    link.href = src;
    document.head.appendChild(link);
    this.preloadedResources.add(src);
  }
  
  static preloadImage(src: string) {
    if (typeof window === 'undefined' || this.preloadedResources.has(src)) {
      return;
    }
    
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = src;
    document.head.appendChild(link);
    this.preloadedResources.add(src);
  }
  
  static preloadFont(href: string) {
    if (typeof window === 'undefined' || this.preloadedResources.has(href)) {
      return;
    }
    
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'font';
    link.type = 'font/woff2';
    link.crossOrigin = 'anonymous';
    link.href = href;
    document.head.appendChild(link);
    this.preloadedResources.add(href);
  }
}

// Critical resource preloader
export const preloadCriticalResources = () => {
  if (typeof window === 'undefined') return;
  
  // Preload critical images
  ResourcePreloader.preloadImage('/images/servio_logo_transparent_tight.png');
  ResourcePreloader.preloadImage('/images/hero_background.png');
  
  // Preload critical icons
  ResourcePreloader.preloadImage('/icons/servio-icon-192.svg');
  ResourcePreloader.preloadImage('/icons/servio-icon-512.svg');
};

// Smart prefetching based on route changes
export const setupSmartPrefetching = (router: any) => {
  if (typeof window === 'undefined') return;
  
  const prefetchedRoutes = new Set<string>();
  
  router.events.on('routeChangeStart', (url: string) => {
    // Prefetch likely next routes based on current route
    const currentPath = router.asPath;
    let routesToPrefetch: string[] = [];
    
    if (currentPath === '/dashboard') {
      routesToPrefetch = ['/dashboard/orders', '/dashboard/assistant'];
    } else if (currentPath === '/dashboard/orders') {
      routesToPrefetch = ['/dashboard/inventory', '/dashboard/assistant'];
    } else if (currentPath.startsWith('/dashboard')) {
      routesToPrefetch = ['/dashboard'];
    }
    
    // Prefetch routes
    routesToPrefetch.forEach(route => {
      if (!prefetchedRoutes.has(route)) {
        router.prefetch(route);
        prefetchedRoutes.add(route);
      }
    });
  });
};

export default {
  DashboardDynamic,
  LayoutDynamic,
  PageDynamic,
  ThirdPartyDynamic,
  ResourcePreloader,
  preloadCriticalResources,
  setupSmartPrefetching,
};