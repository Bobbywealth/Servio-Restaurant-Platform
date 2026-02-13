import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../lib/api';
import toast from 'react-hot-toast';

// TypeScript interfaces
export interface ModifierGroup {
  id: string;
  name: string;
  description?: string | null;
  selectionType: 'single' | 'multiple' | 'quantity';
  minSelections: number;
  maxSelections: number | null;
  isRequired: boolean;
  displayOrder?: number;
  isActive?: boolean;
  options?: ModifierOption[];
}

export interface ModifierOption {
  id: string;
  name: string;
  description?: string | null;
  priceDelta: number;
  isActive?: boolean;
  isSoldOut?: boolean;
  isPreselected?: boolean;
  displayOrder?: number;
}

export interface ModifierGroupApiResponse {
  id: string;
  name: string;
  description?: string | null;
  selectionType?: string;
  selection_type?: string;
  minSelections?: number;
  min_selections?: number;
  maxSelections?: number | null;
  max_selections?: number | null;
  isRequired?: boolean;
  is_required?: boolean;
  displayOrder?: number;
  display_order?: number;
  isActive?: boolean;
  is_active?: boolean;
  options?: ModifierOptionApiResponse[];
}

export interface ModifierOptionApiResponse {
  id: string;
  name: string;
  description?: string | null;
  priceDelta?: number;
  price_delta?: number;
  isActive?: boolean;
  is_active?: boolean;
  isSoldOut?: boolean;
  is_sold_out?: boolean;
  isPreselected?: boolean;
  is_preselected?: boolean;
  displayOrder?: number;
  display_order?: number;
}

export interface CreateModifierGroupData {
  name: string;
  description?: string;
  selectionType: 'single' | 'multiple' | 'quantity';
  minSelections: number;
  maxSelections: number | null;
  isRequired: boolean;
  options?: CreateModifierOptionData[];
}

export interface CreateModifierOptionData {
  name: string;
  description?: string;
  priceDelta: number;
  isActive?: boolean;
  isPreselected?: boolean;
}

export interface UpdateModifierGroupData extends Partial<CreateModifierGroupData> {
  id: string;
}

export interface UpdateModifierOptionData extends Partial<CreateModifierOptionData> {
  id: string;
  groupId: string;
}

export interface UseModifierGroupsOptions {
  restaurantId?: string;
  autoLoad?: boolean;
  includeOptions?: boolean;
  activeOnly?: boolean;
}

export interface UseModifierGroupsReturn {
  modifierGroups: ModifierGroup[];
  loading: boolean;
  error: Error | null;
  loadModifierGroups: () => Promise<void>;
  createModifierGroup: (data: CreateModifierGroupData) => Promise<ModifierGroup | null>;
  updateModifierGroup: (data: UpdateModifierGroupData) => Promise<ModifierGroup | null>;
  deleteModifierGroup: (groupId: string) => Promise<boolean>;
  createModifierOption: (groupId: string, data: CreateModifierOptionData) => Promise<ModifierOption | null>;
  updateModifierOption: (data: UpdateModifierOptionData) => Promise<ModifierOption | null>;
  deleteModifierOption: (groupId: string, optionId: string) => Promise<boolean>;
  getGroupById: (id: string) => ModifierGroup | undefined;
  getOptionsForGroup: (groupId: string) => ModifierOption[];
  toggleOptionSoldOut: (groupId: string, optionId: string, isSoldOut: boolean) => Promise<boolean>;
  reorderGroups: (groupIds: string[]) => Promise<boolean>;
  reorderOptions: (groupId: string, optionIds: string[]) => Promise<boolean>;
}

/**
 * Custom hook for managing modifier groups and options
 * Handles CRUD operations and state management for menu modifiers
 */
export function useModifierGroups(options: UseModifierGroupsOptions = {}): UseModifierGroupsReturn {
  const {
    restaurantId,
    autoLoad = true,
    includeOptions = true,
    activeOnly = false
  } = options;

  const [modifierGroups, setModifierGroups] = useState<ModifierGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Abort controller for cancelling pending requests
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Transform API response to frontend ModifierGroup format
   */
  const transformGroup = useCallback((g: ModifierGroupApiResponse): ModifierGroup => ({
    id: g.id,
    name: g.name,
    description: g.description,
    selectionType: (g.selectionType || g.selection_type || 'single') as 'single' | 'multiple' | 'quantity',
    minSelections: Number(g.minSelections ?? g.min_selections ?? 0),
    maxSelections: g.maxSelections === undefined ? g.max_selections ?? null : g.maxSelections,
    isRequired: g.isRequired ?? g.is_required ?? false,
    displayOrder: g.display_order ?? g.displayOrder ?? 0,
    isActive: g.is_active ?? g.isActive ?? true,
    options: Array.isArray(g.options) ? g.options.map(transformOption) : []
  }), []);

  /**
   * Transform API response to frontend ModifierOption format
   */
  const transformOption = useCallback((opt: ModifierOptionApiResponse): ModifierOption => ({
    id: opt.id,
    name: opt.name,
    description: opt.description,
    priceDelta: Number(opt.price_delta ?? opt.priceDelta ?? 0),
    isActive: opt.is_active ?? opt.isActive ?? true,
    isSoldOut: opt.is_sold_out ?? opt.isSoldOut ?? false,
    isPreselected: opt.is_preselected ?? opt.isPreselected ?? false,
    displayOrder: opt.display_order ?? opt.displayOrder ?? 0
  }), []);

  /**
   * Load modifier groups from API
   */
  const loadModifierGroups = useCallback(async () => {
    if (!restaurantId) return;

    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    try {
      setLoading(true);
      setError(null);

      const response = await api.get(`/api/restaurants/${restaurantId}/modifier-groups`, {
        params: {
          includeOptions,
          activeOnly
        },
        signal: abortControllerRef.current.signal
      });

      // Check if request was aborted
      if (abortControllerRef.current?.signal.aborted) {
        return;
      }

      const rawGroups = response.data?.data || [];
      const mappedGroups: ModifierGroup[] = rawGroups.map(transformGroup);

      setModifierGroups(mappedGroups);
    } catch (err) {
      // Don't set error if request was aborted
      if ((err as Error).name === 'AbortError' || (err as any).code === 'ERR_CANCELED') {
        return;
      }

      const error = err instanceof Error ? err : new Error('Failed to load modifier groups');
      setError(error);
      console.error('Error loading modifier groups:', err);
      toast.error('Failed to load modifier groups');
    } finally {
      setLoading(false);
    }
  }, [restaurantId, includeOptions, activeOnly, transformGroup]);

  /**
   * Create a new modifier group
   */
  const createModifierGroup = useCallback(async (data: CreateModifierGroupData): Promise<ModifierGroup | null> => {
    if (!restaurantId) return null;

    try {
      const response = await api.post(`/api/restaurants/${restaurantId}/modifier-groups`, data);
      const newGroup = transformGroup(response.data?.data || response.data);

      setModifierGroups(prev => [...prev, newGroup].sort((a, b) => 
        (a.displayOrder || 0) - (b.displayOrder || 0)
      ));

      toast.success('Modifier group created');
      return newGroup;
    } catch (err) {
      console.error('Error creating modifier group:', err);
      toast.error('Failed to create modifier group');
      return null;
    }
  }, [restaurantId, transformGroup]);

  /**
   * Update an existing modifier group
   */
  const updateModifierGroup = useCallback(async (data: UpdateModifierGroupData): Promise<ModifierGroup | null> => {
    if (!restaurantId) return null;

    try {
      const response = await api.put(
        `/api/restaurants/${restaurantId}/modifier-groups/${data.id}`,
        data
      );
      const updatedGroup = transformGroup(response.data?.data || response.data);

      setModifierGroups(prev => prev.map(g => 
        g.id === data.id ? updatedGroup : g
      ));

      toast.success('Modifier group updated');
      return updatedGroup;
    } catch (err) {
      console.error('Error updating modifier group:', err);
      toast.error('Failed to update modifier group');
      return null;
    }
  }, [restaurantId, transformGroup]);

  /**
   * Delete a modifier group
   */
  const deleteModifierGroup = useCallback(async (groupId: string): Promise<boolean> => {
    if (!restaurantId) return false;

    try {
      await api.delete(`/api/restaurants/${restaurantId}/modifier-groups/${groupId}`);

      setModifierGroups(prev => prev.filter(g => g.id !== groupId));

      toast.success('Modifier group deleted');
      return true;
    } catch (err) {
      console.error('Error deleting modifier group:', err);
      toast.error('Failed to delete modifier group');
      return false;
    }
  }, [restaurantId]);

  /**
   * Create a new modifier option within a group
   */
  const createModifierOption = useCallback(async (
    groupId: string,
    data: CreateModifierOptionData
  ): Promise<ModifierOption | null> => {
    if (!restaurantId) return null;

    try {
      const response = await api.post(
        `/api/restaurants/${restaurantId}/modifier-groups/${groupId}/options`,
        data
      );
      const newOption = transformOption(response.data?.data || response.data);

      setModifierGroups(prev => prev.map(g => {
        if (g.id !== groupId) return g;
        return {
          ...g,
          options: [...(g.options || []), newOption].sort((a, b) => 
            (a.displayOrder || 0) - (b.displayOrder || 0)
          )
        };
      }));

      toast.success('Option added');
      return newOption;
    } catch (err) {
      console.error('Error creating modifier option:', err);
      toast.error('Failed to add option');
      return null;
    }
  }, [restaurantId, transformOption]);

  /**
   * Update an existing modifier option
   */
  const updateModifierOption = useCallback(async (data: UpdateModifierOptionData): Promise<ModifierOption | null> => {
    if (!restaurantId) return null;

    try {
      const response = await api.put(
        `/api/restaurants/${restaurantId}/modifier-groups/${data.groupId}/options/${data.id}`,
        data
      );
      const updatedOption = transformOption(response.data?.data || response.data);

      setModifierGroups(prev => prev.map(g => {
        if (g.id !== data.groupId) return g;
        return {
          ...g,
          options: g.options?.map(opt => 
            opt.id === data.id ? updatedOption : opt
          )
        };
      }));

      toast.success('Option updated');
      return updatedOption;
    } catch (err) {
      console.error('Error updating modifier option:', err);
      toast.error('Failed to update option');
      return null;
    }
  }, [restaurantId, transformOption]);

  /**
   * Delete a modifier option
   */
  const deleteModifierOption = useCallback(async (
    groupId: string,
    optionId: string
  ): Promise<boolean> => {
    if (!restaurantId) return false;

    try {
      await api.delete(
        `/api/restaurants/${restaurantId}/modifier-groups/${groupId}/options/${optionId}`
      );

      setModifierGroups(prev => prev.map(g => {
        if (g.id !== groupId) return g;
        return {
          ...g,
          options: g.options?.filter(opt => opt.id !== optionId)
        };
      }));

      toast.success('Option deleted');
      return true;
    } catch (err) {
      console.error('Error deleting modifier option:', err);
      toast.error('Failed to delete option');
      return false;
    }
  }, [restaurantId]);

  /**
   * Get a group by ID
   */
  const getGroupById = useCallback((id: string): ModifierGroup | undefined => {
    return modifierGroups.find(g => g.id === id);
  }, [modifierGroups]);

  /**
   * Get options for a specific group
   */
  const getOptionsForGroup = useCallback((groupId: string): ModifierOption[] => {
    return modifierGroups.find(g => g.id === groupId)?.options || [];
  }, [modifierGroups]);

  /**
   * Toggle option sold out status
   */
  const toggleOptionSoldOut = useCallback(async (
    groupId: string,
    optionId: string,
    isSoldOut: boolean
  ): Promise<boolean> => {
    if (!restaurantId) return false;

    try {
      // Optimistic update
      setModifierGroups(prev => prev.map(g => {
        if (g.id !== groupId) return g;
        return {
          ...g,
          options: g.options?.map(opt =>
            opt.id === optionId ? { ...opt, isSoldOut } : opt
          )
        };
      }));

      await api.patch(
        `/api/restaurants/${restaurantId}/modifier-groups/${groupId}/options/${optionId}`,
        { isSoldOut }
      );

      toast.success(isSoldOut ? 'Option marked as sold out' : 'Option back in stock');
      return true;
    } catch (err) {
      console.error('Error toggling option sold out:', err);
      // Revert optimistic update
      loadModifierGroups();
      toast.error('Failed to update option');
      return false;
    }
  }, [restaurantId, loadModifierGroups]);

  /**
   * Reorder groups
   */
  const reorderGroups = useCallback(async (groupIds: string[]): Promise<boolean> => {
    if (!restaurantId) return false;

    try {
      // Optimistic update
      const groupMap = new Map(modifierGroups.map(g => [g.id, g]));
      const reordered = groupIds
        .map((id, idx) => {
          const group = groupMap.get(id);
          return group ? { ...group, displayOrder: idx } : null;
        })
        .filter(Boolean) as ModifierGroup[];

      setModifierGroups(reordered);

      await api.put(`/api/restaurants/${restaurantId}/modifier-groups/reorder`, {
        order: groupIds
      });

      toast.success('Groups reordered');
      return true;
    } catch (err) {
      console.error('Error reordering groups:', err);
      loadModifierGroups();
      toast.error('Failed to reorder groups');
      return false;
    }
  }, [restaurantId, modifierGroups, loadModifierGroups]);

  /**
   * Reorder options within a group
   */
  const reorderOptions = useCallback(async (
    groupId: string,
    optionIds: string[]
  ): Promise<boolean> => {
    if (!restaurantId) return false;

    try {
      // Optimistic update
      setModifierGroups(prev => prev.map(g => {
        if (g.id !== groupId) return g;
        const optionMap = new Map(g.options?.map(o => [o.id, o]));
        const reordered = optionIds
          .map((id, idx) => {
            const option = optionMap.get(id);
            return option ? { ...option, displayOrder: idx } : null;
          })
          .filter(Boolean) as ModifierOption[];

        return { ...g, options: reordered };
      }));

      await api.put(
        `/api/restaurants/${restaurantId}/modifier-groups/${groupId}/options/reorder`,
        { order: optionIds }
      );

      toast.success('Options reordered');
      return true;
    } catch (err) {
      console.error('Error reordering options:', err);
      loadModifierGroups();
      toast.error('Failed to reorder options');
      return false;
    }
  }, [restaurantId, loadModifierGroups]);

  // Auto-load on mount
  useEffect(() => {
    if (autoLoad && restaurantId) {
      loadModifierGroups();
    }

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [autoLoad, restaurantId, loadModifierGroups]);

  return {
    modifierGroups,
    loading,
    error,
    loadModifierGroups,
    createModifierGroup,
    updateModifierGroup,
    deleteModifierGroup,
    createModifierOption,
    updateModifierOption,
    deleteModifierOption,
    getGroupById,
    getOptionsForGroup,
    toggleOptionSoldOut,
    reorderGroups,
    reorderOptions
  };
}

export default useModifierGroups;
