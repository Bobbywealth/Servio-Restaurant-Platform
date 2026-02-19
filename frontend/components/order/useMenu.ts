import axios from 'axios';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../lib/api';
import type { MenuItem, RestaurantInfo } from './types';

export type MenuErrorCode =
  | 'restaurant_not_found'
  | 'restaurant_unavailable'
  | 'connection_issue'
  | 'unknown';

type MenuErrorState = {
  code: MenuErrorCode;
  message: string;
  statusCode: number | null;
  requestId: string | null;
};

const getRequestId = (headers: Record<string, unknown> | undefined): string | null => {
  if (!headers) return null;
  const requestId = headers['x-request-id'] || headers['x-correlation-id'];
  if (typeof requestId === 'string') return requestId;
  if (Array.isArray(requestId) && typeof requestId[0] === 'string') return requestId[0];
  return null;
};

const getMenuErrorState = (error: unknown): MenuErrorState => {
  if (axios.isAxiosError(error)) {
    const statusCode = error.response?.status ?? null;
    const requestId = getRequestId(error.response?.headers as Record<string, unknown> | undefined);

    if (statusCode === 404) {
      return { code: 'restaurant_not_found', message: 'Restaurant not found', statusCode, requestId };
    }

    if (statusCode && statusCode >= 500) {
      return { code: 'restaurant_unavailable', message: 'Restaurant unavailable, try again', statusCode, requestId };
    }

    if (error.code === 'ECONNABORTED' || !error.response) {
      return { code: 'connection_issue', message: 'Connection issue', statusCode, requestId };
    }
  }

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { code: 'connection_issue', message: 'Connection issue', statusCode: null, requestId: null };
  }

  return { code: 'unknown', message: 'Unable to load restaurant menu', statusCode: null, requestId: null };
};

export function useMenu(restaurantSlug: string | undefined) {
  const [restaurant, setRestaurant] = useState<RestaurantInfo | null>(null);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorState, setErrorState] = useState<MenuErrorState | null>(null);
  const [onlinePaymentsEnabled, setOnlinePaymentsEnabled] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [visibleCategoryCount, setVisibleCategoryCount] = useState(2);

  useEffect(() => {
    if (!restaurantSlug) return;
    let isMounted = true;

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      setErrorState(null);

      try {
        const resp = await api.get(`/api/menu/public/${restaurantSlug}`);
        if (!isMounted) return;

        setRestaurant(resp.data.data.restaurant);
        const rawItems = resp.data.data.items || [];
        const normalized = rawItems.map((item: any) => {
          let images: string[] = [];
          if (Array.isArray(item.images)) {
            images = item.images;
          } else if (typeof item.images === 'string') {
            try {
              images = JSON.parse(item.images);
            } catch {
              images = [];
            }
          }
          return {
            ...item,
            description: item.description || '',
            images,
            image: images[0]
          } as MenuItem;
        });
        setItems(normalized);
        const settings = resp.data.data.restaurant?.settings;
        if (settings?.online_payments_enabled) {
          setOnlinePaymentsEnabled(true);
        }
      } catch (fetchError) {
        if (!isMounted) return;

        const nextErrorState = getMenuErrorState(fetchError);
        setRestaurant(null);
        setItems([]);
        setError(nextErrorState.message);
        setErrorState(nextErrorState);
        console.error('[menu.fetch.failed]', {
          slug: restaurantSlug,
          errorCode: nextErrorState.code,
          statusCode: nextErrorState.statusCode,
          requestId: nextErrorState.requestId,
        });
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [restaurantSlug, retryCount]);

  const retryFetch = useCallback(() => {
    setRetryCount(count => count + 1);
  }, []);

  const categories = useMemo(() => {
    const seen = new Map<string, number>();
    for (const item of items) {
      if (!seen.has(item.category_name)) {
        seen.set(item.category_name, item.category_sort_order ?? 0);
      }
    }
    return Array.from(seen.entries())
      .sort((a, b) => a[1] - b[1])
      .map(([name]) => name);
  }, [items]);

  const filteredItems = useMemo(() => {
    let filtered = items;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query)
      );
    }
    if (activeFilters.length > 0) {
      filtered = filtered.filter(() => {
        // Placeholder - would check item metadata for tags
        return true;
      });
    }
    return filtered;
  }, [items, searchQuery, activeFilters]);

  const itemsByCategory = useMemo(() => {
    const result: Record<string, MenuItem[]> = {};
    categories.forEach(cat => {
      result[cat] = filteredItems.filter(i => i.category_name === cat);
    });
    return result;
  }, [categories, filteredItems]);

  const visibleCategories = useMemo(() => {
    const hasActiveSearchOrFilters = Boolean(searchQuery.trim()) || activeFilters.length > 0;

    if (hasActiveSearchOrFilters) {
      return categories.filter(category => (itemsByCategory[category] || []).length > 0);
    }

    if (showAllCategories) return categories;
    return categories.slice(0, visibleCategoryCount);
  }, [
    activeFilters.length,
    categories,
    itemsByCategory,
    searchQuery,
    showAllCategories,
    visibleCategoryCount,
  ]);

  const toggleFilter = useCallback((filter: string) => {
    setActiveFilters(prev =>
      prev.includes(filter) ? prev.filter(f => f !== filter) : [...prev, filter]
    );
  }, []);

  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setActiveFilters([]);
  }, []);

  const toggleCategory = useCallback((cat: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }, []);

  const scrollToCategory = useCallback((cat: string) => {
    setSelectedCategory(cat === 'all' ? null : cat);
    const element = document.getElementById(`category-${cat.replace(/\s+/g, '-').toLowerCase()}`);
    if (element) {
      const offset = 120;
      const elementPosition = element.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: elementPosition - offset, behavior: 'smooth' });
    }
  }, []);

  const handleShowMoreCategories = useCallback(() => {
    setVisibleCategoryCount(prev => prev + 2);
  }, []);

  const handleShowAllCategories = useCallback(() => {
    setShowAllCategories(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleShowLessCategories = useCallback(() => {
    setVisibleCategoryCount(2);
    setShowAllCategories(false);
  }, []);

  return {
    restaurant,
    items,
    isLoading,
    error,
    errorState,
    onlinePaymentsEnabled,
    searchQuery,
    setSearchQuery,
    activeFilters,
    selectedCategory,
    collapsedCategories,
    showAllCategories,
    visibleCategoryCount,
    categories,
    filteredItems,
    itemsByCategory,
    visibleCategories,
    toggleFilter,
    clearFilters,
    toggleCategory,
    scrollToCategory,
    handleShowMoreCategories,
    handleShowAllCategories,
    handleShowLessCategories,
    setShowAllCategories,
    retryFetch,
  };
}
