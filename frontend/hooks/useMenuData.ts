import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../lib/api';
import toast from 'react-hot-toast';
import type { ItemSize } from '../components/Menu/ItemSizeEditor';

// TypeScript interfaces for API responses
export interface MenuCategory {
  id: string;
  name: string;
  description: string;
  image?: string;
  sort_order: number;
  is_active: boolean;
  is_hidden?: boolean;
  item_count: number;
  created_at: string;
}

export interface MenuItem {
  id: string;
  restaurant_id: string;
  category_id: string;
  name: string;
  description: string;
  price: number;
  fromPrice?: number;
  cost?: number;
  image?: string;
  images?: string[];
  is_available: boolean;
  is_featured: boolean;
  preparation_time?: number;
  allergens?: string[];
  dietary_info?: string[];
  sort_order: number;
  created_at: string;
  updated_at: string;
  sizes?: ItemSize[];
  modifierGroups?: ModifierGroupResponse[];
}

export interface ModifierGroupResponse {
  id: string;
  name: string;
  selectionType?: string;
  selection_type?: string;
  minSelections?: number;
  min_selections?: number;
  maxSelections?: number | null;
  max_selections?: number | null;
  isRequired?: boolean;
  is_required?: boolean;
  displayOrder?: number;
  assignmentLevel?: string;
  assignment_level?: string;
  overrides?: {
    overrideMin?: number | null;
    overrideMax?: number | null;
    overrideRequired?: boolean | null;
    displayOrder?: number;
  };
  options?: ModifierOptionResponse[];
}

export interface ModifierOptionResponse {
  id: string;
  name: string;
  description?: string | null;
  price_delta?: number;
  priceDelta?: number;
  is_active?: boolean;
  isActive?: boolean;
  isSoldOut?: boolean;
  is_sold_out?: boolean;
  isPreselected?: boolean;
  is_preselected?: boolean;
  displayOrder?: number;
  display_order?: number;
}

export interface CategoryWithItems extends MenuCategory {
  items: MenuItem[];
}

export interface CategoryGroupResponse {
  category_id: string;
  category_name?: string;
  category_sort_order?: number;
  items: ItemResponse[];
}

export interface ItemResponse {
  id: string;
  restaurant_id: string;
  category_id: string;
  name: string;
  description?: string;
  price?: number;
  fromPrice?: number;
  from_price?: number;
  cost?: number;
  images?: string[];
  is_available?: boolean;
  is_featured?: boolean;
  preparation_time?: number;
  allergens?: string[];
  dietary_info?: string[];
  sort_order?: number;
  created_at?: string;
  updated_at?: string;
  sizes?: ItemSizeResponse[];
  modifierGroups?: ModifierGroupResponse[];
}

export interface ItemSizeResponse {
  id: string;
  sizeName?: string;
  size_name?: string;
  price?: number;
  isPreselected?: boolean;
  is_preselected?: boolean;
  displayOrder?: number;
  display_order?: number;
}

export interface CategoriesApiResponse {
  data: MenuCategory[];
}

export interface ItemsApiResponse {
  data: {
    categories: CategoryGroupResponse[];
  };
}

export interface UseMenuDataOptions {
  userId?: string;
  autoLoad?: boolean;
}

export interface UseMenuDataReturn {
  categories: CategoryWithItems[];
  loading: boolean;
  error: Error | null;
  loadMenuData: (showSpinner?: boolean) => Promise<void>;
  refreshCategories: () => Promise<void>;
  getCategoryById: (id: string) => CategoryWithItems | undefined;
  getItemById: (id: string) => MenuItem | undefined;
  addItemToCategory: (categoryId: string, item: MenuItem) => void;
  updateItemInCategory: (categoryId: string, item: MenuItem) => void;
  removeItemFromCategory: (categoryId: string, itemId: string) => void;
  addCategory: (category: CategoryWithItems) => void;
  updateCategory: (category: CategoryWithItems) => void;
  removeCategory: (categoryId: string) => void;
}

/**
 * Custom hook for managing menu data (categories and items)
 * Handles data fetching, caching, and CRUD operations
 */
export function useMenuData(options: UseMenuDataOptions = {}): UseMenuDataReturn {
  const { userId, autoLoad = true } = options;
  
  const [categories, setCategories] = useState<CategoryWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  // Abort controller for cancelling pending requests
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Transform API response items to frontend MenuItem format
   */
  const transformItem = useCallback((item: ItemResponse, idx: number): MenuItem => ({
    id: item.id,
    restaurant_id: item.restaurant_id,
    category_id: item.category_id,
    name: item.name,
    description: item.description || '',
    price: Number(item.price || 0),
    fromPrice: Number(item.fromPrice ?? item.from_price ?? item.price ?? 0),
    cost: item.cost ? Number(item.cost) : undefined,
    images: Array.isArray(item.images) ? item.images : [],
    image: Array.isArray(item.images) ? item.images[0] : undefined,
    is_available: Boolean(item.is_available),
    is_featured: Boolean(item.is_featured),
    preparation_time: item.preparation_time ? Number(item.preparation_time) : undefined,
    allergens: Array.isArray(item.allergens) ? item.allergens : [],
    dietary_info: Array.isArray(item.dietary_info) ? item.dietary_info : [],
    sort_order: Number(item.sort_order || 0),
    created_at: item.created_at || '',
    updated_at: item.updated_at || '',
    sizes: Array.isArray(item.sizes)
      ? item.sizes.map((s: ItemSizeResponse, sizeIdx: number) => ({
          id: s.id,
          sizeName: s.sizeName ?? s.size_name ?? `Size ${sizeIdx + 1}`,
          price: Number(s.price || 0),
          isPreselected: Boolean(s.isPreselected ?? s.is_preselected),
          displayOrder: Number(s.displayOrder ?? s.display_order ?? sizeIdx)
        }))
      : [],
    modifierGroups: Array.isArray(item.modifierGroups)
      ? item.modifierGroups.map((mg: ModifierGroupResponse, mgIdx: number) => {
          const overrides = mg.overrides || {
            overrideMin: null as number | null,
            overrideMax: null as number | null,
            overrideRequired: null as boolean | null,
            displayOrder: mgIdx
          };
          return {
            ...mg,
            id: mg.id,
            name: mg.name,
            selectionType: mg.selectionType || mg.selection_type || 'single',
            minSelections: mg.minSelections ?? mg.min_selections ?? 0,
            maxSelections: mg.maxSelections ?? mg.max_selections ?? null,
            isRequired: mg.isRequired ?? mg.is_required ?? false,
            displayOrder: mg.displayOrder ?? mgIdx,
            assignmentLevel: mg.assignmentLevel || mg.assignment_level,
            overrides: {
              overrideMin: overrides.overrideMin ?? null,
              overrideMax: overrides.overrideMax ?? null,
              overrideRequired: overrides.overrideRequired ?? null,
              displayOrder: mg.displayOrder ?? mgIdx
            },
            options: Array.isArray(mg.options)
              ? mg.options.map((opt: ModifierOptionResponse) => ({
                  id: opt.id,
                  name: opt.name,
                  description: opt.description,
                  priceDelta: Number(opt.price_delta ?? opt.priceDelta ?? 0),
                  isActive: opt.is_active ?? opt.isActive ?? true,
                  isSoldOut: Boolean(opt.isSoldOut ?? opt.is_sold_out),
                  isPreselected: Boolean(opt.isPreselected ?? opt.is_preselected),
                  displayOrder: opt.displayOrder ?? opt.display_order ?? 0
                }))
              : []
          };
        })
      : []
  }), []);

  /**
   * Load menu data from API with proper abort handling
   */
  const loadMenuData = useCallback(async (showSpinner = false) => {
    if (!userId) return;

    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Create new abort controller
    abortControllerRef.current = new AbortController();

    try {
      if (showSpinner) {
        setLoading(true);
        setError(null);
      }

      const [categoriesResponse, itemsResponse] = await Promise.all([
        api.get('/api/menu/categories/all', {
          signal: abortControllerRef.current.signal
        }),
        api.get('/api/menu/items/full', {
          params: { includeInactive: '1' },
          signal: abortControllerRef.current.signal
        })
      ]);

      // Check if request was aborted
      if (abortControllerRef.current?.signal.aborted) {
        return;
      }

      const categoryRows = (categoriesResponse as CategoriesApiResponse).data?.data || [];
      const itemGroups = (itemsResponse as ItemsApiResponse).data?.data?.categories || [];

      const categoryMap = new Map<string, CategoryWithItems>();
      
      categoryRows.forEach((category: MenuCategory) => {
        categoryMap.set(category.id, {
          ...category,
          sort_order: Number(category.sort_order ?? 0),
          items: []
        });
      });

      itemGroups.forEach((group: CategoryGroupResponse) => {
        const existing = categoryMap.get(group.category_id) || {
          id: group.category_id,
          name: group.category_name || 'Uncategorized',
          description: '',
          image: undefined,
          sort_order: Number(group.category_sort_order ?? 0),
          is_active: true,
          item_count: 0,
          created_at: new Date().toISOString(),
          items: []
        };

        const items = (group.items || []).map((item: ItemResponse, idx: number) => 
          transformItem(item, idx)
        );

        existing.items = items;
        existing.item_count = items.length;
        categoryMap.set(existing.id, existing);
      });

      const mergedCategories = Array.from(categoryMap.values())
        .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));

      setCategories(mergedCategories);
    } catch (err) {
      // Don't set error if request was aborted
      if ((err as Error).name === 'AbortError' || (err as any).code === 'ERR_CANCELED') {
        return;
      }
      
      const error = err instanceof Error ? err : new Error('Failed to load menu data');
      setError(error);
      console.error('Error loading menu data:', err);
      toast.error('Failed to load menu data');
    } finally {
      setLoading(false);
    }
  }, [userId, transformItem]);

  /**
   * Refresh categories only (lighter refresh)
   */
  const refreshCategories = useCallback(async () => {
    try {
      const response = await api.get('/api/menu/categories/all');
      const categoryRows = response.data?.data || [];
      
      setCategories(prev => {
        const categoryMap = new Map<string, CategoryWithItems>();
        
        // Keep existing items
        prev.forEach(cat => {
          categoryMap.set(cat.id, cat);
        });
        
        // Update category data
        categoryRows.forEach((category: MenuCategory) => {
          const existing = categoryMap.get(category.id);
          if (existing) {
            categoryMap.set(category.id, {
              ...existing,
              ...category,
              sort_order: Number(category.sort_order ?? 0)
            });
          } else {
            categoryMap.set(category.id, {
              ...category,
              sort_order: Number(category.sort_order ?? 0),
              items: []
            });
          }
        });
        
        return Array.from(categoryMap.values())
          .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
      });
    } catch (err) {
      console.error('Error refreshing categories:', err);
      toast.error('Failed to refresh categories');
    }
  }, []);

  /**
   * Get a category by ID
   */
  const getCategoryById = useCallback((id: string): CategoryWithItems | undefined => {
    return categories.find(c => c.id === id);
  }, [categories]);

  /**
   * Get an item by ID across all categories
   */
  const getItemById = useCallback((id: string): MenuItem | undefined => {
    for (const category of categories) {
      const item = category.items.find(i => i.id === id);
      if (item) return item;
    }
    return undefined;
  }, [categories]);

  /**
   * Add item to a category
   */
  const addItemToCategory = useCallback((categoryId: string, item: MenuItem) => {
    setCategories(prev => prev.map(cat => 
      cat.id === categoryId 
        ? { ...cat, items: [...cat.items, item], item_count: cat.items.length + 1 }
        : cat
    ));
  }, []);

  /**
   * Update item in a category
   */
  const updateItemInCategory = useCallback((categoryId: string, item: MenuItem) => {
    setCategories(prev => prev.map(cat => 
      cat.id === categoryId 
        ? { 
            ...cat, 
            items: cat.items.map(i => i.id === item.id ? item : i)
          }
        : cat
    ));
  }, []);

  /**
   * Remove item from a category
   */
  const removeItemFromCategory = useCallback((categoryId: string, itemId: string) => {
    setCategories(prev => prev.map(cat => 
      cat.id === categoryId 
        ? { 
            ...cat, 
            items: cat.items.filter(i => i.id !== itemId),
            item_count: Math.max(0, cat.items.length - 1)
          }
        : cat
    ));
  }, []);

  /**
   * Add a new category
   */
  const addCategory = useCallback((category: CategoryWithItems) => {
    setCategories(prev => [...prev, category].sort((a, b) => 
      a.sort_order - b.sort_order || a.name.localeCompare(b.name)
    ));
  }, []);

  /**
   * Update a category
   */
  const updateCategory = useCallback((category: CategoryWithItems) => {
    setCategories(prev => prev.map(cat => 
      cat.id === category.id ? category : cat
    ).sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)));
  }, []);

  /**
   * Remove a category
   */
  const removeCategory = useCallback((categoryId: string) => {
    setCategories(prev => prev.filter(cat => cat.id !== categoryId));
  }, []);

  // Auto-load on mount
  useEffect(() => {
    if (autoLoad && userId) {
      loadMenuData(true);
    }
    
    // Cleanup on unmount
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [autoLoad, userId, loadMenuData]);

  return {
    categories,
    loading,
    error,
    loadMenuData,
    refreshCategories,
    getCategoryById,
    getItemById,
    addItemToCategory,
    updateItemInCategory,
    removeItemFromCategory,
    addCategory,
    updateCategory,
    removeCategory
  };
}

export default useMenuData;
