import React, { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Search,
  Filter,
  ChevronDown,
  ChevronRight,
  Edit3,
  Trash2,
  Eye,
  EyeOff,
  MoreHorizontal,
  Settings,
  ExternalLink,
  Upload,
  Download,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  Tag,
  Sparkles,
  X,
  Copy
} from 'lucide-react';
import DashboardLayout from '../../components/Layout/DashboardLayout';
import { useUser } from '../../contexts/UserContext';
import { api } from '../../lib/api';
import toast from 'react-hot-toast';
import { resolveMediaUrl } from '../../lib/utils';

interface MenuCategory {
  id: string;
  name: string;
  description: string;
  image?: string;
  sort_order: number;
  is_active: boolean;
  item_count: number;
  created_at: string;
}

interface MenuItem {
  id: string;
  restaurant_id: string;
  category_id: string;
  name: string;
  description: string;
  price: number;
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
}

interface CategoryWithItems extends MenuCategory {
  items: MenuItem[];
}

interface ModifierGroup {
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

interface ModifierOption {
  id: string;
  name: string;
  description?: string | null;
  priceDelta: number;
  isActive?: boolean;
  displayOrder?: number;
}

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
const formatFileSize = (bytes: number) => {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${bytes}B`;
};

const MenuManagement: React.FC = () => {
  const { user } = useUser();
  const [categories, setCategories] = useState<CategoryWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [restaurantSlug, setRestaurantSlug] = useState<string | null>(null);
  const [publicOrderUrl, setPublicOrderUrl] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [showPreview, setShowPreview] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [editingCategory, setEditingCategory] = useState<MenuCategory | null>(null);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [showEditItemModal, setShowEditItemModal] = useState(false);
  const [showAddModifierGroupModal, setShowAddModifierGroupModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingModifier, setIsSavingModifier] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isGeneratingNewDescription, setIsGeneratingNewDescription] = useState(false);
  const [isGeneratingEditDescription, setIsGeneratingEditDescription] = useState(false);
  const [newItemImages, setNewItemImages] = useState<File[]>([]);
  const [editItemImages, setEditItemImages] = useState<File[]>([]);
  const [editItemExistingImages, setEditItemExistingImages] = useState<string[]>([]);
  const [modifierGroups, setModifierGroups] = useState<ModifierGroup[]>([]);
  const [modifierOptions, setModifierOptions] = useState<Record<string, ModifierOption[]>>({});
  const [expandedModifierGroups, setExpandedModifierGroups] = useState<Set<string>>(new Set());
  const [newCategory, setNewCategory] = useState({
    name: '',
    description: '',
    sortOrder: 0
  });
  const [newItem, setNewItem] = useState({
    name: '',
    description: '',
    price: '',
    categoryId: '',
    preparationTime: '',
    isAvailable: true
  });
  const [editItem, setEditItem] = useState({
    id: '',
    name: '',
    description: '',
    price: '',
    categoryId: '',
    preparationTime: '',
    isAvailable: true
  });
  type AttachedGroup = {
    groupId: string;
    name?: string;
    overrideMin?: number | null;
    overrideMax?: number | null;
    overrideRequired?: boolean | null;
    displayOrder?: number;
  };
  const [newItemAttachedGroups, setNewItemAttachedGroups] = useState<AttachedGroup[]>([]);
  const [editItemAttachedGroups, setEditItemAttachedGroups] = useState<AttachedGroup[]>([]);
  const [editItemExistingAttachedGroups, setEditItemExistingAttachedGroups] = useState<AttachedGroup[]>([]);
  const [newModifierGroup, setNewModifierGroup] = useState({
    name: '',
    description: '',
    minSelections: 0,
    maxSelections: 1,
    isRequired: false,
    selectionType: 'single' as 'single' | 'multiple' | 'quantity'
  });
  const [newModifierOptionDrafts, setNewModifierOptionDrafts] = useState<Record<string, { name: string; description: string; priceModifier: string }>>({});

  // Load menu data
  const loadMenuData = useCallback(async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      const [categoriesResponse, itemsResponse] = await Promise.all([
        api.get('/api/menu/categories/all'),
        api.get('/api/menu/items/full')
      ]);

      const categoryRows = categoriesResponse.data?.data || [];
      const itemGroups = itemsResponse.data?.data?.categories || [];

      const categoryMap = new Map<string, CategoryWithItems>();
      categoryRows.forEach((category: MenuCategory) => {
        categoryMap.set(category.id, {
          ...category,
          items: []
        });
      });

      itemGroups.forEach((group: any) => {
        const existing = categoryMap.get(group.category_id) || {
          id: group.category_id,
          name: group.category_name || 'Uncategorized',
          description: '',
          image: undefined,
          sort_order: group.category_sort_order || 0,
          is_active: true,
          item_count: 0,
          created_at: new Date().toISOString(),
          items: []
        };

        const items = (group.items || []).map((item: any) => ({
          id: item.id,
          restaurant_id: item.restaurant_id,
          category_id: item.category_id,
          name: item.name,
          description: item.description || '',
          price: Number(item.price || 0),
          cost: item.cost ? Number(item.cost) : undefined,
          images: Array.isArray(item.images) ? item.images : [],
          image: Array.isArray(item.images) ? item.images[0] : undefined,
          is_available: Boolean(item.is_available),
          is_featured: Boolean(item.is_featured),
          preparation_time: item.preparation_time ? Number(item.preparation_time) : undefined,
          allergens: Array.isArray(item.allergens) ? item.allergens : [],
          dietary_info: Array.isArray(item.dietary_info) ? item.dietary_info : [],
          sort_order: Number(item.sort_order || 0),
          created_at: item.created_at,
          updated_at: item.updated_at,
          modifierGroups: Array.isArray(item.modifierGroups)
            ? item.modifierGroups.map((mg: any, idx: number) => ({
                ...mg,
                id: mg.id,
                name: mg.name,
                selectionType: mg.selectionType || mg.selection_type || 'single',
                minSelections: mg.minSelections ?? mg.min_selections ?? 0,
                maxSelections: mg.maxSelections ?? mg.max_selections ?? null,
                isRequired: mg.isRequired ?? mg.is_required ?? false,
                displayOrder: mg.displayOrder ?? idx,
                overrides: mg.overrides || {
                  overrideMin: mg.overrideMin ?? null,
                  overrideMax: mg.overrideMax ?? null,
                  overrideRequired: mg.overrideRequired ?? null,
                  displayOrder: mg.displayOrder ?? idx
                },
                options: Array.isArray(mg.options)
                  ? mg.options.map((opt: any) => ({
                      id: opt.id,
                      name: opt.name,
                      description: opt.description,
                      priceDelta: Number(opt.price_delta ?? opt.priceDelta ?? 0),
                      isActive: opt.is_active ?? opt.isActive ?? true,
                      displayOrder: opt.display_order ?? 0
                    }))
                  : []
              }))
            : []
        }));

        existing.items = items;
        existing.item_count = items.length;
        categoryMap.set(existing.id, existing);
      });

      const mergedCategories = Array.from(categoryMap.values())
        .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));

      setCategories(mergedCategories);
      setExpandedCategories(new Set(mergedCategories.map((cat) => cat.id)));
    } catch (error) {
      console.error('Error loading menu data:', error);
      toast.error('Failed to load menu data');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadMenuData();
  }, [loadMenuData]);

  const loadModifierGroups = useCallback(async () => {
    try {
      const restaurantId = user?.restaurantId;
      if (!restaurantId) return;
      const resp = await api.get(`/api/restaurants/${restaurantId}/modifier-groups`, {
        params: { includeOptions: true, activeOnly: false }
      });
      const rawGroups = resp.data?.data || [];
      const mappedGroups: ModifierGroup[] = rawGroups.map((g: any) => ({
        id: g.id,
        name: g.name,
        description: g.description,
        selectionType: g.selectionType || g.selection_type || 'single',
        minSelections: Number(g.minSelections ?? g.min_selections ?? 0),
        maxSelections: g.maxSelections === undefined ? g.max_selections ?? null : g.maxSelections,
        isRequired: g.isRequired ?? g.is_required ?? false,
        displayOrder: g.display_order ?? 0,
        isActive: g.is_active ?? g.isActive ?? true,
        options: g.options
      }));
      setModifierGroups(mappedGroups);
      const optionsMap: Record<string, ModifierOption[]> = {};
      mappedGroups.forEach((g: any) => {
        if (Array.isArray(g.options)) {
          optionsMap[g.id] = g.options.map((opt: any) => ({
            id: opt.id,
            name: opt.name,
            description: opt.description,
            priceDelta: Number(opt.price_delta ?? opt.priceDelta ?? 0),
            isActive: opt.is_active ?? opt.isActive ?? true,
            displayOrder: opt.display_order ?? 0
          }));
        }
      });
      setModifierOptions(optionsMap);
    } catch (error) {
      console.error('Error loading modifier groups:', error);
    }
  }, [user?.restaurantId]);

  useEffect(() => {
    if (!user?.restaurantId) return;
    loadModifierGroups();
  }, [user?.restaurantId, loadModifierGroups]);

  // Load restaurant slug for public ordering link
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    const run = async () => {
      try {
        const resp = await api.get('/api/restaurant/profile');
        const slug = resp.data?.data?.slug as string | undefined;
        if (cancelled) return;
        if (slug) {
          setRestaurantSlug(slug);
          if (typeof window !== 'undefined') {
            setPublicOrderUrl(`${window.location.origin}/r/${slug}`);
          }
        } else {
          setRestaurantSlug(null);
          setPublicOrderUrl('');
        }
      } catch {
        if (cancelled) return;
        setRestaurantSlug(null);
        setPublicOrderUrl('');
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const copyPublicLink = async () => {
    if (!publicOrderUrl) return;
    try {
      await navigator.clipboard.writeText(publicOrderUrl);
      toast.success('Public ordering link copied');
    } catch {
      // Fallback
      toast.error('Failed to copy. Please copy manually.');
    }
  };

  const filterImageFiles = (files: File[]) => {
    const valid = files.filter((file) => file.size <= MAX_IMAGE_SIZE_BYTES);
    const rejected = files.filter((file) => file.size > MAX_IMAGE_SIZE_BYTES);
    if (rejected.length > 0) {
      toast.error(`Images must be ${formatFileSize(MAX_IMAGE_SIZE_BYTES)} or smaller.`);
    }
    return valid;
  };

  const toggleModifierGroupExpanded = async (groupId: string) => {
    setExpandedModifierGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const handleCreateModifierGroup = async () => {
    if (!newModifierGroup.name.trim()) {
      toast.error('Modifier group name is required');
      return;
    }
    if (newModifierGroup.maxSelections < newModifierGroup.minSelections) {
      toast.error('Max selections must be >= min selections');
      return;
    }
    if (newModifierGroup.selectionType === 'single') {
      newModifierGroup.maxSelections = 1;
      if (newModifierGroup.isRequired && newModifierGroup.minSelections < 1) {
        newModifierGroup.minSelections = 1;
      }
      if (!newModifierGroup.isRequired && newModifierGroup.minSelections > 1) {
        newModifierGroup.minSelections = 0;
      }
    }
    setIsSavingModifier(true);
    try {
      const restaurantId = user?.restaurantId;
      if (!restaurantId) throw new Error('Missing restaurant id');
      await api.post(`/api/restaurants/${restaurantId}/modifier-groups`, {
        name: newModifierGroup.name.trim(),
        description: newModifierGroup.description.trim(),
        selectionType: newModifierGroup.selectionType || 'single',
        minSelections: Number(newModifierGroup.minSelections || 0),
        maxSelections: newModifierGroup.maxSelections === null ? null : Number(newModifierGroup.maxSelections || 1),
        isRequired: Boolean(newModifierGroup.isRequired)
      });
      toast.success('Modifier group created');
      setNewModifierGroup({
        name: '',
        description: '',
        minSelections: 0,
        maxSelections: 1,
        isRequired: false,
        selectionType: 'single'
      });
      setShowAddModifierGroupModal(false);
      await loadModifierGroups();
    } catch (error) {
      console.error('Failed to create modifier group:', error);
      toast.error('Failed to create modifier group');
    } finally {
      setIsSavingModifier(false);
    }
  };

  const handleAddModifierOption = async (groupId: string) => {
    const draft = newModifierOptionDrafts[groupId] || { name: '', description: '', priceModifier: '' };
    if (!draft.name.trim()) {
      toast.error('Option name is required');
      return;
    }
    setIsSavingModifier(true);
    try {
      await api.post(`/api/modifier-groups/${groupId}/options`, {
        name: draft.name.trim(),
        description: draft.description.trim(),
        priceDelta: draft.priceModifier ? Number(draft.priceModifier) : 0
      });
      toast.success('Option added');
      setNewModifierOptionDrafts((prev) => ({ ...prev, [groupId]: { name: '', description: '', priceModifier: '' } }));
      await loadModifierGroups();
    } catch (error) {
      console.error('Failed to add modifier option:', error);
      toast.error('Failed to add modifier option');
    } finally {
      setIsSavingModifier(false);
    }
  };

  const syncItemModifierGroups = async (
    itemId: string,
    attachments: AttachedGroup[],
    existingAttachments: AttachedGroup[]
  ) => {
    // Detach existing
    for (const existing of existingAttachments) {
      if (existing.groupId) {
        try {
          await api.delete(`/api/menu-items/${itemId}/modifier-groups/${existing.groupId}`);
        } catch (err) {
          console.warn('Failed to detach modifier group', existing.groupId, err);
        }
      }
    }

    // Attach current list
    for (const [idx, att] of attachments.entries()) {
      try {
        await api.post(`/api/menu-items/${itemId}/modifier-groups`, {
          groupId: att.groupId,
          overrideMin: att.overrideMin ?? null,
          overrideMax: att.overrideMax ?? null,
          overrideRequired: att.overrideRequired ?? null,
          displayOrder: att.displayOrder ?? idx
        });
      } catch (err) {
        console.warn('Failed to attach modifier group', att.groupId, err);
      }
    }
  };

  const handleImportFile = async (file: File) => {
    setIsImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const resp = await api.post('/api/menu/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const data = resp.data?.data;
      toast.success(`Import completed: ${data?.successCount ?? 0} items`);
      await loadMenuData();
    } catch (error: any) {
      const message = error?.response?.data?.error?.message || 'Failed to import menu';
      toast.error(message);
    } finally {
      setIsImporting(false);
    }
  };

  const fetchModifierSummaries = async (itemId: string): Promise<string[]> => {
    try {
      const resp = await api.get(`/api/menu/items/${itemId}/modifiers`);
      const groups = resp.data?.data || [];
      return groups.map((group: any) => {
        const options = Array.isArray(group.options)
          ? group.options.map((opt: any) => opt?.name).filter(Boolean)
          : [];
        return options.length > 0 ? `${group.name}: ${options.join(', ')}` : group.name;
      }).filter(Boolean);
    } catch {
      return [];
    }
  };

  const handleGenerateNewDescription = async () => {
    if (!newItem.name.trim()) {
      toast.error('Enter an item name first');
      return;
    }
    setIsGeneratingNewDescription(true);
    try {
      const categoryName = categories.find((cat) => cat.id === newItem.categoryId)?.name;
      const resp = await api.post('/api/menu/items/describe', {
        name: newItem.name.trim(),
        category: categoryName || undefined,
        modifiers: []
      });
      const description = resp.data?.data?.description || '';
      setNewItem((prev) => ({ ...prev, description }));
    } catch (error: any) {
      const message = error?.response?.data?.error?.message || 'Failed to generate description';
      toast.error(message);
    } finally {
      setIsGeneratingNewDescription(false);
    }
  };

  const handleGenerateEditDescription = async () => {
    if (!editItem.name.trim()) {
      toast.error('Enter an item name first');
      return;
    }
    setIsGeneratingEditDescription(true);
    try {
      const categoryName = categories.find((cat) => cat.id === editItem.categoryId)?.name;
      const modifiers = editingItem?.id ? await fetchModifierSummaries(editingItem.id) : [];
      const resp = await api.post('/api/menu/items/describe', {
        name: editItem.name.trim(),
        category: categoryName || undefined,
        modifiers
      });
      const description = resp.data?.data?.description || '';
      setEditItem((prev) => ({ ...prev, description }));
    } catch (error: any) {
      const message = error?.response?.data?.error?.message || 'Failed to generate description';
      toast.error(message);
    } finally {
      setIsGeneratingEditDescription(false);
    }
  };

  const openAddCategoryModal = () => {
    setNewCategory({ name: '', description: '', sortOrder: 0 });
    setShowAddCategoryModal(true);
  };

  const openAddItemModal = (categoryId?: string) => {
    setNewItem({
      name: '',
      description: '',
      price: '',
      categoryId: categoryId || (categories[0]?.id ?? ''),
      preparationTime: '',
      isAvailable: true
    });
    setNewItemImages([]);
    setNewItemAttachedGroups([]);
    setShowAddItemModal(true);
  };

  const handleCreateCategory = async () => {
    if (!newCategory.name.trim()) {
      toast.error('Category name is required');
      return;
    }

    setIsSaving(true);
    try {
      await api.post('/api/menu/categories', {
        name: newCategory.name.trim(),
        description: newCategory.description.trim(),
        sortOrder: Number(newCategory.sortOrder || 0)
      });
      toast.success('Category created');
      setShowAddCategoryModal(false);
      await loadMenuData();
    } catch (error) {
      console.error('Failed to create category:', error);
      toast.error('Failed to create category');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateItem = async () => {
    if (!newItem.name.trim()) {
      toast.error('Item name is required');
      return;
    }
    if (!newItem.categoryId) {
      toast.error('Category is required');
      return;
    }
    if (!newItem.price || Number(newItem.price) <= 0) {
      toast.error('Price must be greater than 0');
      return;
    }

    setIsSaving(true);
    try {
      const formData = new FormData();
      formData.append('name', newItem.name.trim());
      formData.append('description', newItem.description.trim());
      formData.append('price', String(Number(newItem.price)));
      formData.append('categoryId', newItem.categoryId);
      formData.append('preparationTime', newItem.preparationTime ? String(Number(newItem.preparationTime)) : '0');
      formData.append('sortOrder', '0');
      formData.append('isAvailable', newItem.isAvailable ? '1' : '');
      newItemImages.forEach((file) => formData.append('images', file));

      const resp = await api.post('/api/menu/items', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const createdId = resp.data?.data?.id as string | undefined;
      if (createdId && newItemAttachedGroups.length > 0) {
        await syncItemModifierGroups(createdId, newItemAttachedGroups, []);
      }
      toast.success('Menu item created');
      setShowAddItemModal(false);
      setNewItemImages([]);
      setNewItemAttachedGroups([]);
      await loadMenuData();
    } catch (error) {
      console.error('Failed to create menu item:', error);
      toast.error('Failed to create menu item');
    } finally {
      setIsSaving(false);
    }
  };

  const openEditItemModal = (item: MenuItem) => {
    setEditItem({
      id: item.id,
      name: item.name,
      description: item.description || '',
      price: String(item.price),
      categoryId: item.category_id,
      preparationTime: item.preparation_time ? String(item.preparation_time) : '',
      isAvailable: item.is_available
    });
    setEditingItem(item);
    setEditItemImages([]);
    setEditItemExistingImages(item.images || []);
    const attached = Array.isArray((item as any).modifierGroups)
      ? (item as any).modifierGroups.map((g: any, idx: number) => ({
          groupId: g.id,
          name: g.name,
          overrideMin: g.overrides?.overrideMin ?? null,
          overrideMax: g.overrides?.overrideMax ?? null,
          overrideRequired: g.overrides?.overrideRequired ?? null,
          displayOrder: g.overrides?.displayOrder ?? g.displayOrder ?? idx
        }))
      : [];
    setEditItemAttachedGroups(attached);
    setEditItemExistingAttachedGroups(attached);
    setEditItemModifierGroupIds(attached.map((g) => g.groupId));
    setShowEditItemModal(true);
  };

  const handleUpdateItem = async () => {
    if (!editItem.name.trim()) {
      toast.error('Item name is required');
      return;
    }
    if (!editItem.categoryId) {
      toast.error('Category is required');
      return;
    }
    if (!editItem.price || Number(editItem.price) <= 0) {
      toast.error('Price must be greater than 0');
      return;
    }

    setIsSaving(true);
    try {
      const formData = new FormData();
      formData.append('name', editItem.name.trim());
      formData.append('description', editItem.description.trim());
      formData.append('price', String(Number(editItem.price)));
      formData.append('categoryId', editItem.categoryId);
      formData.append('preparationTime', editItem.preparationTime ? String(Number(editItem.preparationTime)) : '0');
      formData.append('isAvailable', editItem.isAvailable ? '1' : '');
      formData.append('existingImages', JSON.stringify(editItemExistingImages));
      editItemImages.forEach((file) => formData.append('images', file));

      await api.put(`/api/menu/items/${editItem.id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      await syncItemModifierGroups(editItem.id, editItemAttachedGroups, editItemExistingAttachedGroups);
      toast.success('Menu item updated');
      setShowEditItemModal(false);
      setEditingItem(null);
      setEditItemImages([]);
      setEditItemExistingImages([]);
      setEditItemAttachedGroups([]);
      setEditItemExistingAttachedGroups([]);
      setEditItemModifierGroupIds([]);
      await loadMenuData();
    } catch (error) {
      console.error('Failed to update menu item:', error);
      toast.error('Failed to update menu item');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleAvailability = async (item: MenuItem) => {
    try {
      const endpoint = item.is_available ? '/api/menu/items/set-unavailable' : '/api/menu/items/set-available';
      await api.post(endpoint, { itemId: item.id });
      toast.success(item.is_available ? 'Item marked as unavailable' : 'Item marked as available');
      await loadMenuData();
    } catch (error) {
      console.error('Failed to toggle availability:', error);
      toast.error('Failed to update item availability');
    }
  };

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  };

  const filteredCategories = categories.filter(category => {
    if (selectedCategory !== 'all' && category.id !== selectedCategory) return false;
    
    const matchesSearch = category.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         category.items?.some(item => 
                           item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           item.description.toLowerCase().includes(searchTerm.toLowerCase())
                         );
    
    return matchesSearch;
  });

  const totalItems = categories.reduce((sum, cat) => sum + (cat.item_count || 0), 0);
  const availableItems = categories.reduce((sum, cat) => 
    sum + (cat.items?.filter(item => item.is_available).length || 0), 0
  );

  return (
    <DashboardLayout>
      <Head>
        <title>Menu Management - Servio</title>
      </Head>

      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Menu Manager
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {user?.name}&apos;s Restaurant • {totalItems} items • {availableItems} available
                </p>
              </div>
              
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowPreview(!showPreview)}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg transition-colors"
                >
                  <Eye className="w-4 h-4" />
                  Preview Menu
                </button>
                
                <button
                  onClick={openAddCategoryModal}
                  className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
                >
                  <Settings className="w-4 h-4" />
                  Add Category
                </button>

                <button
                  onClick={() => setShowAddModifierGroupModal(true)}
                  className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
                >
                  <Tag className="w-4 h-4" />
                  Add Modifier Group
                </button>

                <label className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors cursor-pointer ${
                  isImporting
                    ? 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                    : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200'
                }`}>
                  <Upload className="w-4 h-4" />
                  {isImporting ? 'Importing…' : 'Import Menu'}
                  <input
                    type="file"
                    accept=".csv,.xls,.xlsx,.pdf,.docx"
                    className="hidden"
                    disabled={isImporting}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        handleImportFile(file);
                      }
                      e.currentTarget.value = '';
                    }}
                  />
                </label>
                
                <button
                  onClick={() => openAddItemModal()}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Item
                </button>
              </div>
            </div>

            {/* Public ordering link (shareable) */}
            <div className="mt-4">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                <div className="min-w-0">
                  <div className="text-xs font-semibold tracking-widest uppercase text-gray-500 dark:text-gray-400">
                    Public ordering link
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      id="public-order-url"
                      readOnly
                      value={publicOrderUrl || (restaurantSlug ? `/r/${restaurantSlug}` : '')}
                      placeholder="No restaurant slug found"
                      className="w-full lg:w-[520px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono text-sm"
                    />
                  </div>
                  <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    {restaurantSlug ? 'Share this link with customers to place orders for your menu.' : 'Set your public ordering slug in Restaurant Profile first.'}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => window.location.href = '/dashboard/restaurant-profile'}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:hover:bg-gray-700 transition-colors"
                  >
                    Edit slug
                  </button>
                  <button
                    onClick={copyPublicLink}
                    disabled={!publicOrderUrl}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title={publicOrderUrl ? 'Copy link' : 'Link unavailable'}
                  >
                    <Copy className="w-4 h-4" />
                    Copy
                  </button>
                  <a
                    href={publicOrderUrl || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => {
                      if (!publicOrderUrl) e.preventDefault();
                    }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors ${!publicOrderUrl ? 'opacity-50 pointer-events-none' : ''}`}
                    title="Open public menu"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Open
                  </a>
                </div>
              </div>
            </div>

            {/* Search and Filters */}
            <div className="flex items-center gap-4 mt-6">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search for an item"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>
              
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white min-w-[150px]"
              >
                <option value="all">All items</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>

              <button className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-lg hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 transition-colors">
                <Filter className="w-4 h-4" />
                Filter
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto"></div>
              <p className="text-gray-500 mt-2">Loading menu...</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Add-ons & Modifiers</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Create modifier groups and options, then assign them to menu items.</p>
                  </div>
                  <button
                    onClick={() => setShowAddModifierGroupModal(true)}
                    className="flex items-center gap-2 px-3 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    New Group
                  </button>
                </div>
                {modifierGroups.length === 0 ? (
                  <div className="text-sm text-gray-500 dark:text-gray-400">No modifier groups yet.</div>
                ) : (
                  <div className="space-y-3">
                    {modifierGroups.map((group) => {
                      const options = modifierOptions[group.id] || [];
                      const isExpanded = expandedModifierGroups.has(group.id);
                      const draft = newModifierOptionDrafts[group.id] || { name: '', description: '', priceModifier: '' };
                      return (
                        <div key={group.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                          <button
                            className="w-full flex items-center justify-between text-left"
                            onClick={() => toggleModifierGroupExpanded(group.id)}
                            type="button"
                          >
                            <div>
                              <div className="font-semibold text-gray-900 dark:text-white">{group.name}</div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {group.selectionType} • {group.minSelections}-{group.maxSelections ?? '∞'} selections
                                {group.isRequired ? ' • Required' : ''} • {options.length} options
                              </div>
                            </div>
                            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                          </button>
                          {isExpanded && (
                            <div className="mt-3 space-y-3">
                              {options.length > 0 ? (
                                <div className="space-y-2">
                                  {options.map((opt) => (
                                    <div key={opt.id} className="flex items-center justify-between text-sm text-gray-700 dark:text-gray-300">
                                      <div>
                                        <span className="font-medium">{opt.name}</span>
                                        {opt.description ? <span className="text-xs text-gray-500 ml-2">{opt.description}</span> : null}
                                      </div>
                                      <span className="text-xs text-gray-500">+{Number((opt as any).priceDelta ?? opt.priceDelta ?? opt.price_modifier ?? 0).toFixed(2)}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-xs text-gray-500 dark:text-gray-400">No options yet.</div>
                              )}
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                <input
                                  type="text"
                                  value={draft.name}
                                  onChange={(e) =>
                                    setNewModifierOptionDrafts((prev) => ({
                                      ...prev,
                                      [group.id]: { ...draft, name: e.target.value }
                                    }))
                                  }
                                  placeholder="Option name"
                                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                />
                                <input
                                  type="text"
                                  value={draft.description}
                                  onChange={(e) =>
                                    setNewModifierOptionDrafts((prev) => ({
                                      ...prev,
                                      [group.id]: { ...draft, description: e.target.value }
                                    }))
                                  }
                                  placeholder="Description (optional)"
                                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                />
                                <div className="flex gap-2">
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={draft.priceModifier}
                                    onChange={(e) =>
                                      setNewModifierOptionDrafts((prev) => ({
                                        ...prev,
                                        [group.id]: { ...draft, priceModifier: e.target.value }
                                      }))
                                    }
                                    placeholder="Price +"
                                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                  />
                                  <button
                                    onClick={() => handleAddModifierOption(group.id)}
                                    className="px-3 py-2 bg-slate-900 text-white rounded-lg text-sm hover:bg-slate-800"
                                    disabled={isSavingModifier}
                                  >
                                    Add
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              {filteredCategories.map((category) => (
                <CategorySection
                  key={category.id}
                  category={category}
                  isExpanded={expandedCategories.has(category.id)}
                  onToggle={() => toggleCategory(category.id)}
                  searchTerm={searchTerm}
                  onAddItem={openAddItemModal}
                  onEditItem={openEditItemModal}
                  onToggleAvailability={handleToggleAvailability}
                />
              ))}
              
              {filteredCategories.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-gray-500 text-lg">No items found</p>
                  <p className="text-gray-400 text-sm mt-1">Try adjusting your search or filters</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Menu Preview Modal */}
      <AnimatePresence>
        {showPreview && (
          <MenuPreviewModal 
            categories={categories}
            onClose={() => setShowPreview(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAddCategoryModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            onClick={() => setShowAddCategoryModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-lg max-w-lg w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Add Category</h2>
              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
                  <input
                    type="text"
                    value={newCategory.name}
                    onChange={(e) => setNewCategory((prev) => ({ ...prev, name: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    placeholder="e.g. Appetizers"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
                  <textarea
                    value={newCategory.description}
                    onChange={(e) => setNewCategory((prev) => ({ ...prev, description: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    rows={3}
                    placeholder="Short description"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Sort order</label>
                  <input
                    type="number"
                    value={newCategory.sortOrder}
                    onChange={(e) => setNewCategory((prev) => ({ ...prev, sortOrder: Number(e.target.value) }))}
                    className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setShowAddCategoryModal(false)}
                  className="px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:text-gray-900 dark:border-gray-600 dark:text-gray-300"
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateCategory}
                  className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white"
                  disabled={isSaving}
                >
                  {isSaving ? 'Saving...' : 'Create'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAddModifierGroupModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            onClick={() => setShowAddModifierGroupModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-lg max-w-lg w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Add Modifier Group</h2>
              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
                  <input
                    type="text"
                    value={newModifierGroup.name}
                    onChange={(e) => setNewModifierGroup((prev) => ({ ...prev, name: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    placeholder="e.g. Sides, Add-ons"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
                  <textarea
                    value={newModifierGroup.description}
                    onChange={(e) => setNewModifierGroup((prev) => ({ ...prev, description: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    rows={3}
                    placeholder="Optional description"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Selection type</label>
                    <select
                      value={newModifierGroup.selectionType}
                      onChange={(e) => setNewModifierGroup((prev) => ({ ...prev, selectionType: e.target.value as any }))}
                      className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    >
                      <option value="single">Single</option>
                      <option value="multiple">Multiple</option>
                      <option value="quantity">Quantity</option>
                    </select>
                  </div>
                  <div></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Min selections</label>
                    <input
                      type="number"
                      min={0}
                      value={newModifierGroup.minSelections}
                      onChange={(e) => setNewModifierGroup((prev) => ({ ...prev, minSelections: Number(e.target.value) }))}
                      className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Max selections</label>
                    <input
                      type="number"
                      min={0}
                      value={newModifierGroup.maxSelections}
                      onChange={(e) => setNewModifierGroup((prev) => ({ ...prev, maxSelections: Number(e.target.value) }))}
                      className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id="modifier-required"
                    type="checkbox"
                    checked={newModifierGroup.isRequired}
                    onChange={(e) => setNewModifierGroup((prev) => ({ ...prev, isRequired: e.target.checked }))}
                    className="h-4 w-4 text-red-600 border-gray-300 rounded"
                  />
                  <label htmlFor="modifier-required" className="text-sm text-gray-700 dark:text-gray-300">
                    Required group
                  </label>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setShowAddModifierGroupModal(false)}
                  className="px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:text-gray-900 dark:border-gray-600 dark:text-gray-300"
                  disabled={isSavingModifier}
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateModifierGroup}
                  className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white"
                  disabled={isSavingModifier}
                >
                  {isSavingModifier ? 'Saving...' : 'Create'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAddItemModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            onClick={() => setShowAddItemModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-lg max-w-lg w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Add Menu Item</h2>
              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
                  <input
                    type="text"
                    value={newItem.name}
                    onChange={(e) => setNewItem((prev) => ({ ...prev, name: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    placeholder="e.g. Jerk Chicken"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
                    <button
                      type="button"
                      onClick={handleGenerateNewDescription}
                      disabled={isGeneratingNewDescription}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-700 disabled:text-gray-400"
                    >
                      <Sparkles className="w-3 h-3" />
                      {isGeneratingNewDescription ? 'Generating...' : 'Generate with AI'}
                    </button>
                  </div>
                  <textarea
                    value={newItem.description}
                    onChange={(e) => setNewItem((prev) => ({ ...prev, description: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    rows={3}
                    placeholder="Short description"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Price</label>
                    <input
                      type="number"
                      step="0.01"
                      value={newItem.price}
                      onChange={(e) => setNewItem((prev) => ({ ...prev, price: e.target.value }))}
                      className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Prep time (mins)</label>
                    <input
                      type="number"
                      value={newItem.preparationTime}
                      onChange={(e) => setNewItem((prev) => ({ ...prev, preparationTime: e.target.value }))}
                      className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      placeholder="15"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Category</label>
                  <select
                    value={newItem.categoryId}
                    onChange={(e) => setNewItem((prev) => ({ ...prev, categoryId: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  >
                    <option value="">Select category</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>
                {modifierGroups.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Attached Modifier Groups
                      </label>
                    </div>
                    <div className="flex gap-2">
                      <select
                        className="flex-1 px-3 py-2 border border-gray-200 rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        onChange={(e) => {
                          const val = e.target.value;
                          if (!val) return;
                          setNewItemAttachedGroups((prev) => {
                            if (prev.some((p) => p.groupId === val)) return prev;
                            const found = modifierGroups.find((g) => g.id === val);
                            return [
                              ...prev,
                              {
                                groupId: val,
                                name: found?.name,
                                displayOrder: prev.length
                              }
                            ];
                          });
                          e.target.value = '';
                        }}
                        defaultValue=""
                      >
                        <option value="">Select group to attach</option>
                        {modifierGroups
                          .filter((g) => !newItemAttachedGroups.some((a) => a.groupId === g.id))
                          .map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.name} ({g.selectionType})
                            </option>
                          ))}
                      </select>
                    </div>
                    {newItemAttachedGroups.length > 0 && (
                      <div className="space-y-2">
                        {newItemAttachedGroups.map((att, idx) => (
                          <div
                            key={att.groupId}
                            className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 text-sm flex flex-col gap-2"
                          >
                            <div className="flex justify-between items-center">
                              <div className="font-semibold text-gray-900 dark:text-white">
                                {att.name || att.groupId}
                              </div>
                              <button
                                type="button"
                                className="text-red-600 text-xs"
                                onClick={() =>
                                  setNewItemAttachedGroups((prev) =>
                                    prev.filter((p) => p.groupId !== att.groupId)
                                  )
                                }
                              >
                                Detach
                              </button>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <label className="block text-xs text-gray-500">Override Min</label>
                                <input
                                  type="number"
                                  value={att.overrideMin ?? ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setNewItemAttachedGroups((prev) =>
                                      prev.map((p) =>
                                        p.groupId === att.groupId ? { ...p, overrideMin: val === '' ? null : Number(val) } : p
                                      )
                                    );
                                  }}
                                  className="w-full px-2 py-1 border border-gray-200 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-500">Override Max</label>
                                <input
                                  type="number"
                                  value={att.overrideMax ?? ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setNewItemAttachedGroups((prev) =>
                                      prev.map((p) =>
                                        p.groupId === att.groupId ? { ...p, overrideMax: val === '' ? null : Number(val) } : p
                                      )
                                    );
                                  }}
                                  className="w-full px-2 py-1 border border-gray-200 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-500">Display Order</label>
                                <input
                                  type="number"
                                  value={att.displayOrder ?? idx}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setNewItemAttachedGroups((prev) =>
                                      prev.map((p) =>
                                        p.groupId === att.groupId ? { ...p, displayOrder: val === '' ? idx : Number(val) } : p
                                      )
                                    );
                                  }}
                                  className="w-full px-2 py-1 border border-gray-200 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                />
                              </div>
                            </div>
                            <label className="inline-flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
                              <input
                                type="checkbox"
                                checked={att.overrideRequired ?? false}
                                onChange={(e) =>
                                  setNewItemAttachedGroups((prev) =>
                                    prev.map((p) =>
                                      p.groupId === att.groupId ? { ...p, overrideRequired: e.target.checked } : p
                                    )
                                  )
                                }
                                className="h-4 w-4 text-red-600 border-gray-300 rounded"
                              />
                              Required
                            </label>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Images</label>
                  <div className="mt-1 flex flex-col gap-2">
                    <label className="inline-flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:text-gray-900 hover:border-gray-400 cursor-pointer dark:border-gray-600 dark:text-gray-300 dark:hover:text-white">
                      <Upload className="w-4 h-4" />
                      Upload images (up to 5)
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          const files = Array.from(e.target.files || []);
                          const validFiles = filterImageFiles(files).slice(0, 5);
                          setNewItemImages(validFiles);
                        }}
                      />
                    </label>
                    <div className="text-xs text-gray-500">
                      Max file size: {formatFileSize(MAX_IMAGE_SIZE_BYTES)} each.
                    </div>
                    {newItemImages.length > 0 && (
                      <div className="text-xs text-gray-500">
                        {newItemImages.length} file{newItemImages.length > 1 ? 's' : ''} selected
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id="item-available"
                    type="checkbox"
                    checked={newItem.isAvailable}
                    onChange={(e) => setNewItem((prev) => ({ ...prev, isAvailable: e.target.checked }))}
                    className="h-4 w-4 text-red-600 border-gray-300 rounded"
                  />
                  <label htmlFor="item-available" className="text-sm text-gray-700 dark:text-gray-300">
                    Item is available
                  </label>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setShowAddItemModal(false)}
                  className="px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:text-gray-900 dark:border-gray-600 dark:text-gray-300"
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateItem}
                  className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white"
                  disabled={isSaving}
                >
                  {isSaving ? 'Saving...' : 'Create'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Item Modal */}
      <AnimatePresence>
        {showEditItemModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            onClick={() => { setShowEditItemModal(false); setEditingItem(null); setEditItemAttachedGroups([]); setEditItemExistingAttachedGroups([]); }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-lg max-w-lg w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Edit Menu Item</h2>
              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
                  <input
                    type="text"
                    value={editItem.name}
                    onChange={(e) => setEditItem((prev) => ({ ...prev, name: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    placeholder="e.g. Jerk Chicken"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
                    <button
                      type="button"
                      onClick={handleGenerateEditDescription}
                      disabled={isGeneratingEditDescription}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-700 disabled:text-gray-400"
                    >
                      <Sparkles className="w-3 h-3" />
                      {isGeneratingEditDescription ? 'Generating...' : 'Generate with AI'}
                    </button>
                  </div>
                  <textarea
                    value={editItem.description}
                    onChange={(e) => setEditItem((prev) => ({ ...prev, description: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    rows={3}
                    placeholder="Short description"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Price</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editItem.price}
                      onChange={(e) => setEditItem((prev) => ({ ...prev, price: e.target.value }))}
                      className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Prep time (mins)</label>
                    <input
                      type="number"
                      value={editItem.preparationTime}
                      onChange={(e) => setEditItem((prev) => ({ ...prev, preparationTime: e.target.value }))}
                      className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      placeholder="15"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Category</label>
                  <select
                    value={editItem.categoryId}
                    onChange={(e) => setEditItem((prev) => ({ ...prev, categoryId: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  >
                    <option value="">Select category</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>
                {modifierGroups.length > 0 && (
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Attached Modifier Groups</label>
                    <div className="flex gap-2">
                      <select
                        className="flex-1 px-3 py-2 border border-gray-200 rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        onChange={(e) => {
                          const val = e.target.value;
                          if (!val) return;
                          setEditItemAttachedGroups((prev) => {
                            if (prev.some((p) => p.groupId === val)) return prev;
                            const found = modifierGroups.find((g) => g.id === val);
                            return [
                              ...prev,
                              {
                                groupId: val,
                                name: found?.name,
                                displayOrder: prev.length
                              }
                            ];
                          });
                          e.target.value = '';
                        }}
                        defaultValue=""
                      >
                        <option value="">Select group to attach</option>
                        {modifierGroups
                          .filter((g) => !editItemAttachedGroups.some((a) => a.groupId === g.id))
                          .map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.name} ({g.selectionType})
                            </option>
                          ))}
                      </select>
                    </div>
                    {editItemAttachedGroups.length > 0 && (
                      <div className="space-y-2">
                        {editItemAttachedGroups.map((att, idx) => (
                          <div
                            key={att.groupId}
                            className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 text-sm flex flex-col gap-2"
                          >
                            <div className="flex justify-between items-center">
                              <div className="font-semibold text-gray-900 dark:text-white">
                                {att.name || att.groupId}
                              </div>
                              <button
                                type="button"
                                className="text-red-600 text-xs"
                                onClick={() =>
                                  setEditItemAttachedGroups((prev) =>
                                    prev.filter((p) => p.groupId !== att.groupId)
                                  )
                                }
                              >
                                Detach
                              </button>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <label className="block text-xs text-gray-500">Override Min</label>
                                <input
                                  type="number"
                                  value={att.overrideMin ?? ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setEditItemAttachedGroups((prev) =>
                                      prev.map((p) =>
                                        p.groupId === att.groupId ? { ...p, overrideMin: val === '' ? null : Number(val) } : p
                                      )
                                    );
                                  }}
                                  className="w-full px-2 py-1 border border-gray-200 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-500">Override Max</label>
                                <input
                                  type="number"
                                  value={att.overrideMax ?? ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setEditItemAttachedGroups((prev) =>
                                      prev.map((p) =>
                                        p.groupId === att.groupId ? { ...p, overrideMax: val === '' ? null : Number(val) } : p
                                      )
                                    );
                                  }}
                                  className="w-full px-2 py-1 border border-gray-200 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-500">Display Order</label>
                                <input
                                  type="number"
                                  value={att.displayOrder ?? idx}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setEditItemAttachedGroups((prev) =>
                                      prev.map((p) =>
                                        p.groupId === att.groupId ? { ...p, displayOrder: val === '' ? idx : Number(val) } : p
                                      )
                                    );
                                  }}
                                  className="w-full px-2 py-1 border border-gray-200 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                />
                              </div>
                            </div>
                            <label className="inline-flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
                              <input
                                type="checkbox"
                                checked={att.overrideRequired ?? false}
                                onChange={(e) =>
                                  setEditItemAttachedGroups((prev) =>
                                    prev.map((p) =>
                                      p.groupId === att.groupId ? { ...p, overrideRequired: e.target.checked } : p
                                    )
                                  )
                                }
                                className="h-4 w-4 text-red-600 border-gray-300 rounded"
                              />
                              Required
                            </label>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Images</label>
                  <div className="mt-1 flex flex-col gap-2">
                    <label className="inline-flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:text-gray-900 hover:border-gray-400 cursor-pointer dark:border-gray-600 dark:text-gray-300 dark:hover:text-white">
                      <Upload className="w-4 h-4" />
                      Add images (up to 5)
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          const files = Array.from(e.target.files || []);
                          const validFiles = filterImageFiles(files).slice(0, 5);
                          setEditItemImages(validFiles);
                        }}
                      />
                    </label>
                    <div className="text-xs text-gray-500">
                      Max file size: {formatFileSize(MAX_IMAGE_SIZE_BYTES)} each.
                    </div>
                    {(editItemExistingImages.length > 0 || editItemImages.length > 0) && (
                      <div className="text-xs text-gray-500">
                        {editItemExistingImages.length} existing, {editItemImages.length} new
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id="edit-item-available"
                    type="checkbox"
                    checked={editItem.isAvailable}
                    onChange={(e) => setEditItem((prev) => ({ ...prev, isAvailable: e.target.checked }))}
                    className="h-4 w-4 text-red-600 border-gray-300 rounded"
                  />
                  <label htmlFor="edit-item-available" className="text-sm text-gray-700 dark:text-gray-300">
                    Item is available
                  </label>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => { setShowEditItemModal(false); setEditingItem(null); setEditItemAttachedGroups([]); setEditItemExistingAttachedGroups([]); }}
                  className="px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:text-gray-900 dark:border-gray-600 dark:text-gray-300"
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateItem}
                  className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white"
                  disabled={isSaving}
                >
                  {isSaving ? 'Saving...' : 'Update'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
};

// Category Section Component
interface CategorySectionProps {
  category: CategoryWithItems;
  isExpanded: boolean;
  onToggle: () => void;
  searchTerm: string;
  onAddItem: (categoryId: string) => void;
  onEditItem: (item: MenuItem) => void;
  onToggleAvailability: (item: MenuItem) => void;
}

const CategorySection: React.FC<CategorySectionProps> = ({
  category,
  isExpanded,
  onToggle,
  searchTerm,
  onAddItem,
  onEditItem,
  onToggleAvailability
}) => {
  const filteredItems = category.items?.filter(item =>
    searchTerm === '' ||
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.description.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      {/* Category Header */}
      <div 
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {isExpanded ? (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronRight className="w-5 h-5 text-gray-400" />
            )}
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {category.name}
            </h3>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm rounded-full">
              {category.item_count || 0} items
            </span>
            {!category.is_active && (
              <span className="px-2 py-1 bg-red-100 text-red-700 text-sm rounded-full">
                Inactive
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button 
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              // Handle edit category
            }}
          >
            <Edit3 className="w-4 h-4" />
          </button>
          <button className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Category Items */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-700">
              {filteredItems.length > 0 ? (
                <div className="space-y-2 pt-3">
                  {filteredItems.map((item) => (
                    <MenuItemCard 
                      key={item.id} 
                      item={item} 
                      onEdit={onEditItem}
                      onToggleAvailability={onToggleAvailability}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500">No items in this category</p>
                  <button
                    onClick={() => onAddItem(category.id)}
                    className="text-red-600 hover:text-red-700 text-sm mt-1"
                  >
                    Add your first item
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Menu Item Card Component
interface MenuItemCardProps {
  item: MenuItem;
  onEdit: (item: MenuItem) => void;
  onToggleAvailability: (item: MenuItem) => void;
}

const MenuItemCard: React.FC<MenuItemCardProps> = ({ item, onEdit, onToggleAvailability }) => {
  return (
    <div className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
      {/* Item Image */}
      <div className="w-12 h-12 bg-gray-200 dark:bg-gray-600 rounded-lg flex-shrink-0 overflow-hidden">
        {item.image ? (
          <img 
            src={resolveMediaUrl(item.image)} 
            alt={item.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <Tag className="w-5 h-5" />
          </div>
        )}
      </div>

      {/* Item Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="font-medium text-gray-900 dark:text-white truncate">
            {item.name}
          </h4>
          {item.is_featured && (
            <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full">
              Featured
            </span>
          )}
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 truncate mt-0.5">
          {item.description}
        </p>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            ${item.price.toFixed(2)}
          </span>
          {item.preparation_time && (
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <Clock className="w-3 h-3" />
              {item.preparation_time}m
            </span>
          )}
        </div>
      </div>

      {/* Item Actions */}
      <div className="flex items-center gap-2">
        <button 
          onClick={() => onToggleAvailability(item)}
          className="flex items-center"
          title={item.is_available ? 'Mark as unavailable' : 'Mark as available'}
        >
          {item.is_available ? (
            <CheckCircle className="w-5 h-5 text-green-500 hover:text-green-600" />
          ) : (
            <XCircle className="w-5 h-5 text-red-500 hover:text-red-600" />
          )}
        </button>
        
        <button 
          onClick={() => onEdit(item)}
          className="p-2 text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 rounded-lg hover:bg-white dark:hover:bg-gray-800 transition-colors"
          title="Edit item"
        >
          <Edit3 className="w-4 h-4" />
        </button>
        
        <button className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-white dark:hover:bg-gray-800 transition-colors">
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// Menu Preview Modal Component
interface MenuPreviewModalProps {
  categories: CategoryWithItems[];
  onClose: () => void;
}

const MenuPreviewModal: React.FC<MenuPreviewModalProps> = ({ categories, onClose }) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[80vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Preview Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Menu Preview</h2>
            <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
              How your menu appears to customers
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors">
              <ExternalLink className="w-4 h-4" />
              Open in new tab
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Preview Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          <div className="space-y-8">
            {categories.filter(cat => cat.is_active).map((category) => (
              <div key={category.id}>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                  {category.name}
                </h3>
                {category.description && (
                  <p className="text-gray-600 dark:text-gray-400 mb-6">
                    {category.description}
                  </p>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {category.items?.filter(item => item.is_available).map((item) => (
                    <div key={item.id} className="flex gap-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                      {item.image && (
                        <img 
                          src={resolveMediaUrl(item.image)} 
                          alt={item.name}
                          className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
                        />
                      )}
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <h4 className="font-semibold text-gray-900 dark:text-white">
                            {item.name}
                          </h4>
                          <span className="font-bold text-green-600">
                            ${item.price.toFixed(2)}
                          </span>
                        </div>
                        <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
                          {item.description}
                        </p>
                        {item.preparation_time && (
                          <div className="flex items-center gap-1 text-xs text-gray-500 mt-2">
                            <Clock className="w-3 h-3" />
                            {item.preparation_time} mins
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default MenuManagement;