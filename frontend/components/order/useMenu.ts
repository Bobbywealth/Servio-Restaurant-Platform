import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../lib/api';
import type { MenuItem, RestaurantInfo } from './types';

export function useMenu(restaurantSlug: string | undefined) {
  const [restaurant, setRestaurant] = useState<RestaurantInfo | null>(null);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [onlinePaymentsEnabled, setOnlinePaymentsEnabled] = useState(false);

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [visibleCategoryCount, setVisibleCategoryCount] = useState(2);

  useEffect(() => {
    if (!restaurantSlug) return;

    const fetchData = async () => {
      try {
        const resp = await api.get(`/api/menu/public/${restaurantSlug}`);
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
      } catch {
        setError('Restaurant not found');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [restaurantSlug]);

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
    if (showAllCategories) return categories;
    return categories.slice(0, visibleCategoryCount);
  }, [categories, showAllCategories, visibleCategoryCount]);

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
  };
}
