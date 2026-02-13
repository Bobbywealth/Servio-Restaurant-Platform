import { useState, useCallback, useRef, useEffect } from 'react';
import { api } from '../lib/api';
import toast from 'react-hot-toast';
import type { ItemSize } from '../components/Menu/ItemSizeEditor';

// Types
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
  modifierGroups?: any[];
}

export interface AttachedGroup {
  groupId: string;
  name?: string;
  overrideMin?: number | null;
  overrideMax?: number | null;
  overrideRequired?: boolean | null;
  displayOrder?: number;
}

export interface EditItemState {
  id: string;
  name: string;
  description: string;
  price: string;
  categoryId: string;
  preparationTime: string;
  isAvailable: boolean;
  isFeatured: boolean;
  cost: string;
  allergens: string[];
  dietaryInfo: string[];
}

export interface NewItemState {
  name: string;
  description: string;
  price: string;
  categoryId: string;
  preparationTime: string;
  isAvailable: boolean;
  isFeatured: boolean;
  cost: string;
  allergens: string[];
  dietaryInfo: string[];
}

export interface UseItemEditorOptions {
  onItemSaved?: (item: MenuItem) => void;
  onItemDeleted?: (itemId: string) => void;
  onItemAdded?: (item: MenuItem) => void;
}

export interface UseItemEditorReturn {
  // Edit state
  editingItem: MenuItem | null;
  editItem: EditItemState;
  editItemImages: File[];
  editItemExistingImages: string[];
  editItemSizes: ItemSize[];
  editItemAttachedGroups: AttachedGroup[];
  editItemInheritedGroups: any[];
  editItemOriginalCategoryId: string;
  isDirty: boolean;
  isSaving: boolean;
  
  // New item state
  newItem: NewItemState;
  newItemImages: File[];
  newItemAttachedGroups: AttachedGroup[];
  isCreating: boolean;
  
  // Actions
  openEditItemModal: (item: MenuItem) => Promise<void>;
  closeEditItemModal: () => void;
  updateEditItem: (updates: Partial<EditItemState>) => void;
  setEditItemImages: (files: File[]) => void;
  setEditItemExistingImages: (urls: string[]) => void;
  setEditItemSizes: (sizes: ItemSize[]) => void;
  setEditItemAttachedGroups: (groups: AttachedGroup[]) => void;
  saveEditItem: () => Promise<MenuItem | null>;
  deleteItem: (itemId: string) => Promise<boolean>;
  
  // New item actions
  updateNewItem: (updates: Partial<NewItemState>) => void;
  setNewItemImages: (files: File[]) => void;
  setNewItemAttachedGroups: (groups: AttachedGroup[]) => void;
  createItem: () => Promise<MenuItem | null>;
  resetNewItem: () => void;
  
  // Utility
  markDirty: () => void;
  markClean: () => void;
  cancelChanges: () => void;
}

const DEFAULT_NEW_ITEM: NewItemState = {
  name: '',
  description: '',
  price: '',
  categoryId: '',
  preparationTime: '',
  isAvailable: true,
  isFeatured: false,
  cost: '',
  allergens: [],
  dietaryInfo: []
};

const DEFAULT_EDIT_ITEM: EditItemState = {
  id: '',
  name: '',
  description: '',
  price: '',
  categoryId: '',
  preparationTime: '',
  isAvailable: true,
  isFeatured: false,
  cost: '',
  allergens: [],
  dietaryInfo: []
};

/**
 * Custom hook for managing menu item editing state and operations
 * Handles both creating new items and editing existing ones
 */
export function useItemEditor(options: UseItemEditorOptions = {}): UseItemEditorReturn {
  const { onItemSaved, onItemDeleted, onItemAdded } = options;

  // Edit state
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [editItem, setEditItem] = useState<EditItemState>(DEFAULT_EDIT_ITEM);
  const [editItemImages, setEditItemImages] = useState<File[]>([]);
  const [editItemExistingImages, setEditItemExistingImages] = useState<string[]>([]);
  const [editItemSizes, setEditItemSizes] = useState<ItemSize[]>([]);
  const [editItemAttachedGroups, setEditItemAttachedGroups] = useState<AttachedGroup[]>([]);
  const [editItemInheritedGroups, setEditItemInheritedGroups] = useState<any[]>([]);
  const [editItemOriginalCategoryId, setEditItemOriginalCategoryId] = useState<string>('');
  const [editItemExistingAttachedGroups, setEditItemExistingAttachedGroups] = useState<AttachedGroup[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // New item state
  const [newItem, setNewItem] = useState<NewItemState>(DEFAULT_NEW_ITEM);
  const [newItemImages, setNewItemImages] = useState<File[]>([]);
  const [newItemAttachedGroups, setNewItemAttachedGroups] = useState<AttachedGroup[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  // Track original item for cancel functionality
  const originalItemRef = useRef<MenuItem | null>(null);

  /**
   * Open edit modal for an existing item
   */
  const openEditItemModal = useCallback(async (item: MenuItem): Promise<void> => {
    originalItemRef.current = item;
    
    setEditingItem(item);
    setEditItem({
      id: item.id,
      name: item.name,
      description: item.description || '',
      price: String(item.price),
      categoryId: item.category_id,
      preparationTime: item.preparation_time ? String(item.preparation_time) : '',
      isAvailable: item.is_available,
      isFeatured: item.is_featured,
      cost: item.cost ? String(item.cost) : '',
      allergens: item.allergens || [],
      dietaryInfo: item.dietary_info || []
    });
    setEditItemImages([]);
    setEditItemExistingImages(item.images || []);
    setEditItemSizes(item.sizes || []);
    setEditItemOriginalCategoryId(item.category_id);
    
    // Set attached groups (item-level only, not category inherited)
    const groups = Array.isArray(item.modifierGroups) ? item.modifierGroups : [];
    const attached = groups
      .filter((g: any) => (g.assignmentLevel || g.assignment_level) !== 'category')
      .map((g: any, idx: number) => ({
        groupId: g.id,
        name: g.name,
        overrideMin: g.overrides?.overrideMin ?? null,
        overrideMax: g.overrides?.overrideMax ?? null,
        overrideRequired: g.overrides?.overrideRequired ?? null,
        displayOrder: g.overrides?.displayOrder ?? g.displayOrder ?? idx
      }));
    
    setEditItemAttachedGroups(attached);
    setEditItemExistingAttachedGroups(attached);
    
    // Set inherited groups (category-level)
    setEditItemInheritedGroups(
      groups
        .filter((g: any) => (g.assignmentLevel || g.assignment_level) === 'category')
    );
    
    setIsDirty(false);
  }, []);

  /**
   * Close edit modal
   */
  const closeEditItemModal = useCallback(() => {
    setEditingItem(null);
    setEditItem(DEFAULT_EDIT_ITEM);
    setEditItemImages([]);
    setEditItemExistingImages([]);
    setEditItemSizes([]);
    setEditItemAttachedGroups([]);
    setEditItemInheritedGroups([]);
    setEditItemOriginalCategoryId('');
    setIsDirty(false);
    originalItemRef.current = null;
  }, []);

  /**
   * Update edit item state
   */
  const updateEditItem = useCallback((updates: Partial<EditItemState>) => {
    setEditItem(prev => {
      const newState = { ...prev, ...updates };
      // Check if dirty compared to original
      if (originalItemRef.current) {
        const orig = originalItemRef.current;
        const isChanged = 
          newState.name !== orig.name ||
          newState.description !== (orig.description || '') ||
          newState.price !== String(orig.price) ||
          newState.categoryId !== orig.category_id ||
          newState.isAvailable !== orig.is_available ||
          newState.isFeatured !== orig.is_featured;
        setIsDirty(isChanged);
      }
      return newState;
    });
  }, []);

  /**
   * Save edited item
   */
  const saveEditItem = useCallback(async (): Promise<MenuItem | null> => {
    if (!editingItem) return null;

    setIsSaving(true);
    try {
      // Build form data
      const formData = new FormData();
      formData.append('name', editItem.name);
      formData.append('description', editItem.description);
      formData.append('price', editItem.price);
      formData.append('category_id', editItem.categoryId);
      formData.append('is_available', String(editItem.isAvailable));
      formData.append('is_featured', String(editItem.isFeatured));
      
      if (editItem.preparationTime) {
        formData.append('preparation_time', editItem.preparationTime);
      }
      if (editItem.cost) {
        formData.append('cost', editItem.cost);
      }
      if (editItem.allergens.length > 0) {
        formData.append('allergens', JSON.stringify(editItem.allergens));
      }
      if (editItem.dietaryInfo.length > 0) {
        formData.append('dietary_info', JSON.stringify(editItem.dietaryInfo));
      }
      
      // Add existing images
      formData.append('existing_images', JSON.stringify(editItemExistingImages));
      
      // Add new images
      editItemImages.forEach((file) => {
        formData.append('images', file);
      });
      
      // Add sizes
      if (editItemSizes.length > 0) {
        formData.append('sizes', JSON.stringify(editItemSizes));
      }
      
      // Add attached modifier groups
      formData.append('modifier_groups', JSON.stringify(editItemAttachedGroups));

      const response = await api.put(`/api/menu/items/${editingItem.id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const savedItem = response.data?.data || response.data;
      
      setEditingItem(savedItem);
      originalItemRef.current = savedItem;
      setIsDirty(false);
      
      toast.success('Item saved successfully');
      onItemSaved?.(savedItem);
      
      return savedItem;
    } catch (err) {
      console.error('Error saving item:', err);
      toast.error('Failed to save item');
      return null;
    } finally {
      setIsSaving(false);
    }
  }, [editingItem, editItem, editItemImages, editItemExistingImages, editItemSizes, editItemAttachedGroups, onItemSaved]);

  /**
   * Delete an item
   */
  const deleteItem = useCallback(async (itemId: string): Promise<boolean> => {
    try {
      await api.delete(`/api/menu/items/${itemId}`);
      
      toast.success('Item deleted');
      onItemDeleted?.(itemId);
      
      return true;
    } catch (err) {
      console.error('Error deleting item:', err);
      toast.error('Failed to delete item');
      return false;
    }
  }, [onItemDeleted]);

  /**
   * Update new item state
   */
  const updateNewItem = useCallback((updates: Partial<NewItemState>) => {
    setNewItem(prev => ({ ...prev, ...updates }));
  }, []);

  /**
   * Create new item
   */
  const createItem = useCallback(async (): Promise<MenuItem | null> => {
    if (!newItem.categoryId) {
      toast.error('Please select a category');
      return null;
    }
    if (!newItem.name.trim()) {
      toast.error('Please enter an item name');
      return null;
    }

    setIsCreating(true);
    try {
      const formData = new FormData();
      formData.append('name', newItem.name);
      formData.append('description', newItem.description);
      formData.append('price', newItem.price || '0');
      formData.append('category_id', newItem.categoryId);
      formData.append('is_available', String(newItem.isAvailable));
      formData.append('is_featured', String(newItem.isFeatured));
      
      if (newItem.preparationTime) {
        formData.append('preparation_time', newItem.preparationTime);
      }
      if (newItem.cost) {
        formData.append('cost', newItem.cost);
      }
      if (newItem.allergens.length > 0) {
        formData.append('allergens', JSON.stringify(newItem.allergens));
      }
      if (newItem.dietaryInfo.length > 0) {
        formData.append('dietary_info', JSON.stringify(newItem.dietaryInfo));
      }
      
      newItemImages.forEach((file) => {
        formData.append('images', file);
      });
      
      if (newItemAttachedGroups.length > 0) {
        formData.append('modifier_groups', JSON.stringify(newItemAttachedGroups));
      }

      const response = await api.post('/api/menu/items', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const createdItem = response.data?.data || response.data;
      
      toast.success('Item created successfully');
      onItemAdded?.(createdItem);
      
      // Reset new item state
      setNewItem(DEFAULT_NEW_ITEM);
      setNewItemImages([]);
      setNewItemAttachedGroups([]);
      
      return createdItem;
    } catch (err) {
      console.error('Error creating item:', err);
      toast.error('Failed to create item');
      return null;
    } finally {
      setIsCreating(false);
    }
  }, [newItem, newItemImages, newItemAttachedGroups, onItemAdded]);

  /**
   * Reset new item form
   */
  const resetNewItem = useCallback(() => {
    setNewItem(DEFAULT_NEW_ITEM);
    setNewItemImages([]);
    setNewItemAttachedGroups([]);
  }, []);

  /**
   * Mark form as dirty
   */
  const markDirty = useCallback(() => {
    setIsDirty(true);
  }, []);

  /**
   * Mark form as clean
   */
  const markClean = useCallback(() => {
    setIsDirty(false);
  }, []);

  /**
   * Cancel changes and revert to original
   */
  const cancelChanges = useCallback(() => {
    if (originalItemRef.current) {
      const item = originalItemRef.current;
      setEditItem({
        id: item.id,
        name: item.name,
        description: item.description || '',
        price: String(item.price),
        categoryId: item.category_id,
        preparationTime: item.preparation_time ? String(item.preparation_time) : '',
        isAvailable: item.is_available,
        isFeatured: item.is_featured,
        cost: item.cost ? String(item.cost) : '',
        allergens: item.allergens || [],
        dietaryInfo: item.dietary_info || []
      });
      setEditItemImages([]);
      setEditItemExistingImages(item.images || []);
      setEditItemAttachedGroups(editItemExistingAttachedGroups);
    }
    setIsDirty(false);
  }, [editItemExistingAttachedGroups]);

  return {
    // Edit state
    editingItem,
    editItem,
    editItemImages,
    editItemExistingImages,
    editItemSizes,
    editItemAttachedGroups,
    editItemInheritedGroups,
    editItemOriginalCategoryId,
    isDirty,
    isSaving,
    
    // New item state
    newItem,
    newItemImages,
    newItemAttachedGroups,
    isCreating,
    
    // Actions
    openEditItemModal,
    closeEditItemModal,
    updateEditItem,
    setEditItemImages,
    setEditItemExistingImages,
    setEditItemSizes,
    setEditItemAttachedGroups,
    saveEditItem,
    deleteItem,
    
    // New item actions
    updateNewItem,
    setNewItemImages,
    setNewItemAttachedGroups,
    createItem,
    resetNewItem,
    
    // Utility
    markDirty,
    markClean,
    cancelChanges
  };
}

export default useItemEditor;
