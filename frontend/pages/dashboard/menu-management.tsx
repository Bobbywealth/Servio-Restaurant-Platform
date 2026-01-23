import React, { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
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
  Copy,
  GripVertical
} from 'lucide-react';
import DashboardLayout from '../../components/Layout/DashboardLayout';
import { useUser } from '../../contexts/UserContext';
import { api } from '../../lib/api';
import toast from 'react-hot-toast';
import { resolveMediaUrl } from '../../lib/utils';
import { CategorySidebar } from '../../components/Menu/CategorySidebar';
import { ItemSizeEditor, type ItemSize } from '../../components/Menu/ItemSizeEditor';
import { ChoiceGroupAssignment, type ChoiceGroup as ChoiceGroupType } from '../../components/Menu/ChoiceGroupAssignment';
import { DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface MenuCategory {
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

interface MenuItem {
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
  // Combined modifier groups (category-level first, then item-level)
  modifierGroups?: any[];
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
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [editorTab, setEditorTab] = useState<'basics' | 'availability' | 'modifiers' | 'preview'>('basics');
  const [basicsDirty, setBasicsDirty] = useState(false);
  const [pendingSelection, setPendingSelection] = useState<{ type: 'category' | 'item'; id: string } | null>(null);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [editingCategory, setEditingCategory] = useState<MenuCategory | null>(null);
  const [categoryInheritedGroups, setCategoryInheritedGroups] = useState<ChoiceGroupType[]>([]);
  const [categoryModifierGroupIds, setCategoryModifierGroupIds] = useState<string[]>([]);
  const [isLoadingCategoryGroups, setIsLoadingCategoryGroups] = useState(false);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [showEditItemModal, setShowEditItemModal] = useState(false);
  const [showAddModifierGroupModal, setShowAddModifierGroupModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingModifier, setIsSavingModifier] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [useAiImport, setUseAiImport] = useState(true);
  const [isGeneratingNewDescription, setIsGeneratingNewDescription] = useState(false);
  const [isGeneratingEditDescription, setIsGeneratingEditDescription] = useState(false);
  const [newItemImages, setNewItemImages] = useState<File[]>([]);
  const [editItemImages, setEditItemImages] = useState<File[]>([]);
  const [editItemExistingImages, setEditItemExistingImages] = useState<string[]>([]);
  const [editItemSizes, setEditItemSizes] = useState<ItemSize[]>([]);
  const [editItemInheritedGroups, setEditItemInheritedGroups] = useState<ChoiceGroupType[]>([]);
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
          created_at: item.created_at,
          updated_at: item.updated_at,
          sizes: Array.isArray(item.sizes)
            ? item.sizes.map((s: any, idx: number) => ({
                id: s.id,
                sizeName: s.sizeName ?? s.size_name ?? `Size ${idx + 1}`,
                price: Number(s.price || 0),
                isPreselected: Boolean(s.isPreselected ?? s.is_preselected),
                displayOrder: Number(s.displayOrder ?? s.display_order ?? idx)
              }))
            : [],
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
                assignmentLevel: mg.assignmentLevel || mg.assignment_level,
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
                      isSoldOut: Boolean(opt.isSoldOut ?? opt.is_sold_out),
                      isPreselected: Boolean(opt.isPreselected ?? opt.is_preselected),
                      displayOrder: opt.displayOrder ?? opt.display_order ?? 0
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
      setSelectedCategory((prev) => (prev === 'all' && mergedCategories[0]?.id ? mergedCategories[0].id : prev));
    } catch (error) {
      console.error('Error loading menu data:', error);
      toast.error('Failed to load menu data');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const activeCategoryId = selectedCategory !== 'all' ? selectedCategory : categories[0]?.id || null;
  const activeCategory = activeCategoryId ? categories.find((c) => c.id === activeCategoryId) : null;

  const cancelBasicsChanges = useCallback(() => {
    if (!editingItem) return;
    setEditItem({
      id: editingItem.id,
      name: editingItem.name,
      description: editingItem.description || '',
      price: String(editingItem.price),
      categoryId: editingItem.category_id,
      preparationTime: editingItem.preparation_time ? String(editingItem.preparation_time) : '',
      isAvailable: editingItem.is_available
    });
    setEditItemImages([]);
    setEditItemExistingImages(editingItem.images || []);
    const groups = Array.isArray((editingItem as any).modifierGroups) ? (editingItem as any).modifierGroups : [];
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
    setEditItemInheritedGroups(
      groups
        .filter((g: any) => (g.assignmentLevel || g.assignment_level) === 'category')
        .map((g: any) => toChoiceGroup(g))
    );
    setBasicsDirty(false);
  }, [editingItem]);

  const proceedPendingSelection = useCallback(async () => {
    if (!pendingSelection) return;
    const pending = pendingSelection;
    setPendingSelection(null);
    setShowDiscardConfirm(false);
    cancelBasicsChanges();

    if (pending.type === 'category') {
      setSelectedCategory(pending.id);
      const nextCat = categories.find((c) => c.id === pending.id);
      const first = nextCat?.items?.[0];
      if (first) {
        await openEditItemModal(first);
      } else {
        setSelectedItemId(null);
        setEditingItem(null);
      }
      return;
    }

    const cat = categories.find((c) => c.items.some((i) => i.id === pending.id));
    const item = cat?.items.find((i) => i.id === pending.id);
    if (item) {
      await openEditItemModal(item);
    }
  }, [pendingSelection, cancelBasicsChanges, categories]);

  const requestSelectCategory = useCallback(
    async (categoryId: string) => {
      if (basicsDirty) {
        setPendingSelection({ type: 'category', id: categoryId });
        setShowDiscardConfirm(true);
        return;
      }
      setSelectedCategory(categoryId);
      const cat = categories.find((c) => c.id === categoryId);
      const first = cat?.items?.[0];
      if (first) {
        await openEditItemModal(first);
      } else {
        setSelectedItemId(null);
        setEditingItem(null);
      }
    },
    [basicsDirty, categories]
  );

  const requestSelectItem = useCallback(
    async (item: MenuItem) => {
      if (basicsDirty) {
        setPendingSelection({ type: 'item', id: item.id });
        setShowDiscardConfirm(true);
        return;
      }
      await openEditItemModal(item);
    },
    [basicsDirty]
  );

  const modifierSummaryForItem = (item: MenuItem) => {
    const groups = Array.isArray((item as any).modifierGroups) ? (item as any).modifierGroups : [];
    const required = groups.filter((g: any) => Boolean(g.isRequired ?? g.is_required)).length;
    return `${groups.length} group${groups.length === 1 ? '' : 's'}${required > 0 ? `, ${required} required` : ''}`;
  };

  const formatMoney = (v: number) => {
    const n = Number.isFinite(v) ? v : 0;
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(n);
    } catch {
      return `$${n.toFixed(2)}`;
    }
  };

  useEffect(() => {
    loadMenuData();
  }, [loadMenuData]);

  // Selection behavior: keep editor selection valid and auto-select first item when category changes.
  useEffect(() => {
    if (loading) return;
    if (basicsDirty) return;
    if (!activeCategoryId) {
      setSelectedItemId(null);
      setEditingItem(null);
      return;
    }
    const cat = categories.find((c) => c.id === activeCategoryId);
    const items = cat?.items || [];
    if (!items.length) {
      setSelectedItemId(null);
      setEditingItem(null);
      return;
    }
    const stillExists = selectedItemId ? items.find((i) => i.id === selectedItemId) : null;
    if (stillExists) {
      // Keep current selection in sync with refreshed object
      setEditingItem(stillExists);
      return;
    }
    // Auto-select first item in category
    void openEditItemModal(items[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategoryId, categories, loading, basicsDirty, selectedItemId]);

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

  const toChoiceGroup = (g: any): ChoiceGroupType => ({
    id: String(g.id),
    name: String(g.name || ''),
    description: g.description ?? null,
    selectionType: (g.selectionType || g.selection_type || 'single') as any,
    minSelections: Number(g.minSelections ?? g.min_selections ?? 0),
    maxSelections: g.maxSelections === undefined ? (g.max_selections ?? null) : g.maxSelections,
    isRequired: Boolean(g.isRequired ?? g.is_required ?? false)
  });

  const loadCategoryChoiceGroups = useCallback(async (categoryId: string) => {
    if (!categoryId) return;
    try {
      setIsLoadingCategoryGroups(true);
      const resp = await api.get(`/api/menu/categories/${encodeURIComponent(categoryId)}/modifier-groups`);
      const rows = resp.data?.data || [];
      const groups = Array.isArray(rows) ? rows.map((r: any) => toChoiceGroup({
        id: r.groupId ?? r.group_id ?? r.id,
        name: r.name,
        description: r.description,
        selectionType: r.selectionType,
        minSelections: r.minSelections,
        maxSelections: r.maxSelections,
        isRequired: r.isRequired
      })) : [];
      setCategoryInheritedGroups(groups);
      setCategoryModifierGroupIds(groups.map((g) => g.id));
    } catch (error) {
      console.error('Failed to load category choice groups', error);
      setCategoryInheritedGroups([]);
      setCategoryModifierGroupIds([]);
    } finally {
      setIsLoadingCategoryGroups(false);
    }
  }, []);

  // Keep category-level groups in sync with selected category
  useEffect(() => {
    const categoryId = selectedCategory && selectedCategory !== 'all' ? selectedCategory : categories[0]?.id;
    if (!categoryId) return;
    loadCategoryChoiceGroups(categoryId);
  }, [selectedCategory, categories, loadCategoryChoiceGroups]);

  // DnD sensors (must be defined at top-level for hooks)
  const categoryGroupSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const itemTableSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

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

  const handleToggleCategoryHidden = async (categoryId: string, nextHidden: boolean) => {
    try {
      await api.put(`/api/menu/categories/${encodeURIComponent(categoryId)}/visibility`, { isHidden: nextHidden });
      setCategories((prev) =>
        prev.map((c) => (c.id === categoryId ? { ...c, is_hidden: nextHidden } : c))
      );
      toast.success(nextHidden ? 'Category hidden from menu' : 'Category shown on menu');
    } catch (error) {
      console.error('Failed to toggle category visibility', error);
      toast.error('Failed to update category visibility');
    }
  };

  const handleReorderCategories = async (nextOrderedIds: string[]) => {
    // Optimistic reorder in UI
    setCategories((prev) => {
      const byId = new Map(prev.map((c) => [c.id, c] as const));
      const next = nextOrderedIds.map((id, idx) => {
        const c = byId.get(id);
        return c ? { ...c, sort_order: idx } : null;
      }).filter(Boolean) as CategoryWithItems[];
      // Append anything not in nextOrderedIds (safety)
      const remaining = prev.filter((c) => !nextOrderedIds.includes(c.id));
      return [...next, ...remaining];
    });

    try {
      await api.put('/api/menu/categories/reorder', { categoryIds: nextOrderedIds });
    } catch (error) {
      console.error('Failed to persist category order', error);
      toast.error('Failed to save category order');
    }
  };

  const handleSetCategoryModifierGroups = async (categoryId: string, groupIds: string[]) => {
    try {
      await api.post(`/api/menu/categories/${encodeURIComponent(categoryId)}/modifier-groups`, { groupIds });
      setCategoryModifierGroupIds(groupIds);
      await loadCategoryChoiceGroups(categoryId);
      toast.success('Category choice groups updated');
    } catch (error) {
      console.error('Failed to update category modifier groups', error);
      toast.error('Failed to update category choice groups');
    }
  };

  const handleReorderItems = async (categoryId: string, orderedItemIds: string[]) => {
    // Optimistic reorder in UI
    setCategories((prev) =>
      prev.map((cat) => {
        if (cat.id !== categoryId) return cat;
        const byId = new Map((cat.items || []).map((i) => [i.id, i] as const));
        const nextItems = orderedItemIds
          .map((id, idx) => {
            const it = byId.get(id);
            return it ? { ...it, sort_order: idx } : null;
          })
          .filter(Boolean) as MenuItem[];
        const remaining = (cat.items || []).filter((i) => !orderedItemIds.includes(i.id));
        return { ...cat, items: [...nextItems, ...remaining] };
      })
    );

    try {
      await api.put(`/api/menu/categories/${encodeURIComponent(categoryId)}/items/reorder`, { itemIds: orderedItemIds });
    } catch (error) {
      console.error('Failed to save item order', error);
      toast.error('Failed to save item order');
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
      const ext = (file?.name || '').toLowerCase();
      const isPdfOrDocx = ext.endsWith('.pdf') || ext.endsWith('.docx');
      const url = isPdfOrDocx && useAiImport ? '/api/menu/import?useAi=1' : '/api/menu/import';
      const resp = await api.post(url, formData, {
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

  const getModifierSummariesFromItem = (item: MenuItem | null): string[] => {
    if (!item) return [];
    const groups = Array.isArray((item as any).modifierGroups) ? (item as any).modifierGroups : [];
    return groups
      .map((group: any) => {
        const options = Array.isArray(group.options) ? group.options.map((opt: any) => opt?.name).filter(Boolean) : [];
        return options.length > 0 ? `${group.name}: ${options.join(', ')}` : group.name;
      })
      .filter(Boolean);
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
      const modifiers = getModifierSummariesFromItem(editingItem);
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

  const openEditItemModal = async (item: MenuItem) => {
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
    const groups = Array.isArray((item as any).modifierGroups) ? (item as any).modifierGroups : [];
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
    setEditItemInheritedGroups(
      groups
        .filter((g: any) => (g.assignmentLevel || g.assignment_level) === 'category')
        .map((g: any) => toChoiceGroup(g))
    );
    try {
      const [sizesResp, catGroupsResp] = await Promise.all([
        api.get(`/api/menu/items/${encodeURIComponent(item.id)}/sizes`),
        api.get(`/api/menu/categories/${encodeURIComponent(item.category_id)}/modifier-groups`)
      ]);
      const sizeRows = sizesResp.data?.data || [];
      setEditItemSizes(
        Array.isArray(sizeRows)
          ? sizeRows.map((s: any, idx: number) => ({
              id: s.id,
              sizeName: s.sizeName ?? s.size_name ?? `Size ${idx + 1}`,
              price: Number(s.price || 0),
              isPreselected: Boolean(s.isPreselected ?? s.is_preselected),
              displayOrder: Number(s.displayOrder ?? s.display_order ?? idx)
            }))
          : []
      );

      const rows = catGroupsResp.data?.data || [];
      const inherited = Array.isArray(rows)
        ? rows.map((r: any) =>
            toChoiceGroup({
              id: r.groupId ?? r.group_id ?? r.id,
              name: r.name,
              description: r.description,
              selectionType: r.selectionType,
              minSelections: r.minSelections,
              maxSelections: r.maxSelections,
              isRequired: r.isRequired
            })
          )
        : [];
      setEditItemInheritedGroups(inherited);
    } catch (error) {
      console.warn('Failed to load item sizes/category groups for edit modal', error);
      setEditItemSizes([]);
      // keep previously set inherited groups from item payload
    }
    setSelectedItemId(item.id);
    setEditorTab('basics');
    setBasicsDirty(false);
  };

  const reloadEditItemSizes = async (itemId: string) => {
    const resp = await api.get(`/api/menu/items/${encodeURIComponent(itemId)}/sizes`);
    const rows = resp.data?.data || [];
    setEditItemSizes(
      Array.isArray(rows)
        ? rows.map((s: any, idx: number) => ({
            id: s.id,
            sizeName: s.sizeName ?? s.size_name ?? `Size ${idx + 1}`,
            price: Number(s.price || 0),
            isPreselected: Boolean(s.isPreselected ?? s.is_preselected),
            displayOrder: Number(s.displayOrder ?? s.display_order ?? idx)
          }))
        : []
    );
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
      setBasicsDirty(false);
      // Optimistically update local state so the editor stays consistent immediately.
      setCategories((prev) =>
        prev.map((cat) => ({
          ...cat,
          items: (cat.items || []).map((it) =>
            it.id === editItem.id
              ? {
                  ...it,
                  name: editItem.name,
                  description: editItem.description,
                  price: Number(editItem.price || 0),
                  category_id: editItem.categoryId,
                  preparation_time: editItem.preparationTime ? Number(editItem.preparationTime) : undefined,
                  is_available: Boolean(editItem.isAvailable)
                }
              : it
          )
        }))
      );
      await loadMenuData();
    } catch (error) {
      console.error('Failed to update menu item:', error);
      toast.error('Failed to update menu item');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleAvailability = async (item: MenuItem) => {
    const nextAvailable = !item.is_available;
    // Optimistic update (no full refresh unless failure)
    setCategories((prev) =>
      prev.map((cat) => ({
        ...cat,
        items: (cat.items || []).map((it) => (it.id === item.id ? { ...it, is_available: nextAvailable } : it))
      }))
    );
    try {
      const endpoint = item.is_available ? '/api/menu/items/set-unavailable' : '/api/menu/items/set-available';
      await api.post(endpoint, { itemId: item.id });
      toast.success(nextAvailable ? 'Item marked as available' : 'Item marked as unavailable');
    } catch (error) {
      // Revert
      setCategories((prev) =>
        prev.map((cat) => ({
          ...cat,
          items: (cat.items || []).map((it) => (it.id === item.id ? { ...it, is_available: item.is_available } : it))
        }))
      );
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

                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
                      <input
                        type="checkbox"
                        checked={useAiImport}
                        onChange={(e) => setUseAiImport(e.target.checked)}
                        disabled={isImporting}
                      />
                      AI organizer (PDF/DOCX)
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
              
              <div className="hidden md:block text-sm text-gray-500 dark:text-gray-400">
                Use the category sidebar to manage hierarchy.
              </div>
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
            <div className="flex flex-col lg:flex-row gap-6">
              <CategorySidebar
                categories={categories.map((c) => ({
                  id: c.id,
                  name: c.name,
                  description: c.description,
                  sort_order: c.sort_order,
                  is_active: c.is_active,
                  is_hidden: Boolean((c as any).is_hidden),
                  item_count: c.item_count
                }))}
                selectedCategoryId={activeCategoryId}
                onSelectCategory={(id) => {
                  requestSelectCategory(id);
                }}
                onAddCategory={() => setShowAddCategoryModal(true)}
                onToggleHidden={handleToggleCategoryHidden}
                onReorderCategories={handleReorderCategories}
              />

              {/* Middle pane: Items */}
              <div className="flex-1 min-w-0 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-gray-900 dark:text-white truncate">
                      {activeCategory ? activeCategory.name : 'Items'}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {activeCategory ? `${activeCategory.items?.length || 0} items` : 'Select a category to view items.'}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-lg bg-red-600 hover:bg-red-700 text-white px-3 py-2 text-sm font-bold disabled:opacity-50"
                    disabled={!activeCategoryId}
                    onClick={() => openAddItemModal(activeCategoryId || undefined)}
                  >
                    <Plus className="w-4 h-4" />
                    Add Item
                  </button>
                </div>

                {!activeCategory ? (
                  <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                    No category selected.
                  </div>
                ) : (
                  (() => {
                    const items =
                      (activeCategory.items || []).filter((item) => {
                        if (!searchTerm.trim()) return true;
                        const q = searchTerm.toLowerCase();
                        return (
                          item.name.toLowerCase().includes(q) ||
                          (item.description || '').toLowerCase().includes(q)
                        );
                      }) || [];
                    if (items.length === 0) {
                      return (
                        <div className="p-8 text-center">
                          <div className="text-gray-600 dark:text-gray-300 font-semibold">This category has no items.</div>
                          <button
                            type="button"
                            className="mt-2 text-sm font-bold text-red-600 hover:text-red-700"
                            onClick={() => openAddItemModal(activeCategory.id)}
                          >
                            Add your first item
                          </button>
                        </div>
                      );
                    }
                    return (
                      <div className="overflow-auto">
                        <table className="w-full text-sm">
                          <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900/40">
                            <tr className="text-left text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                              <th className="px-4 py-3">Item</th>
                              <th className="px-4 py-3">Price</th>
                              <th className="px-4 py-3">Availability</th>
                              <th className="px-4 py-3">Modifiers</th>
                              <th className="px-4 py-3 text-right">Actions</th>
                            </tr>
                          </thead>
                          <DndContext
                            sensors={itemTableSensors}
                            onDragEnd={(event) => {
                              if (searchTerm.trim()) return; // avoid surprising reorder while filtered
                              const { active, over } = event;
                              if (!over) return;
                              const activeId = String(active.id);
                              const overId = String(over.id);
                              if (activeId === overId) return;
                              const ordered = items.slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
                              const ids = ordered.map((i) => i.id);
                              const oldIndex = ids.indexOf(activeId);
                              const newIndex = ids.indexOf(overId);
                              if (oldIndex === -1 || newIndex === -1) return;
                              const next = arrayMove(ids, oldIndex, newIndex);
                              handleReorderItems(activeCategory.id, next);
                            }}
                          >
                            <SortableContext
                              items={items.slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).map((i) => i.id)}
                              strategy={verticalListSortingStrategy}
                            >
                              <tbody>
                                {items
                                  .slice()
                                  .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
                                  .map((item) => (
                                    <SortableItemTableRow
                                      key={item.id}
                                      item={item}
                                      selected={selectedItemId === item.id}
                                      disableDrag={Boolean(searchTerm.trim())}
                                      onSelect={() => requestSelectItem(item)}
                                      onToggleAvailability={() => handleToggleAvailability(item)}
                                      modifierSummary={modifierSummaryForItem(item)}
                                      formatMoney={formatMoney}
                                    />
                                  ))}
                              </tbody>
                            </SortableContext>
                          </DndContext>
                        </table>
                        {searchTerm.trim() ? (
                          <div className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400">
                            Reordering is disabled while searching.
                          </div>
                        ) : null}
                      </div>
                    );
                  })()
                )}
              </div>

              {/* Right pane: Item editor */}
              <div className="w-full lg:w-[420px] shrink-0 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                {!editingItem || !selectedItemId ? (
                  <div className="p-6">
                    <div className="text-lg font-black text-gray-900 dark:text-white">Item Editor</div>
                    <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">Select an item to edit.</div>
                  </div>
                ) : (
                  <div className="flex flex-col h-full">
                    <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-lg font-black text-gray-900 dark:text-white truncate">{editingItem.name}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {activeCategory?.name ? `Category: ${activeCategory.name}` : ''}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="shrink-0 inline-flex items-center gap-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 px-3 py-2 text-sm font-bold"
                          onClick={() => setShowAddModifierGroupModal(true)}
                        >
                          <Plus className="h-4 w-4" />
                          New Group
                        </button>
                      </div>

                      <div className="mt-3 flex items-center gap-2">
                        {(['basics', 'availability', 'modifiers', 'preview'] as const).map((tab) => (
                          <button
                            key={tab}
                            type="button"
                            className={clsx(
                              'rounded-lg px-3 py-2 text-sm font-black',
                              editorTab === tab
                                ? 'bg-red-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
                            )}
                            onClick={() => setEditorTab(tab)}
                          >
                            {tab === 'basics'
                              ? 'Basics'
                              : tab === 'availability'
                                ? 'Availability'
                                : tab === 'modifiers'
                                  ? 'Modifiers'
                                  : 'Preview'}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="p-4 overflow-auto">
                      {editorTab === 'basics' ? (
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">Name</label>
                            <input
                              type="text"
                              value={editItem.name}
                              onChange={(e) => {
                                setBasicsDirty(true);
                                setEditItem((prev) => ({ ...prev, name: e.target.value }));
                              }}
                              className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            />
                          </div>

                          <div>
                            <div className="flex items-center justify-between">
                              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">Description</label>
                              <button
                                type="button"
                                onClick={handleGenerateEditDescription}
                                disabled={isGeneratingEditDescription}
                                className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-700 disabled:text-gray-400"
                              >
                                <Sparkles className="w-3 h-3" />
                                {isGeneratingEditDescription ? 'Generating...' : 'Generate'}
                              </button>
                            </div>
                            <textarea
                              value={editItem.description}
                              onChange={(e) => {
                                setBasicsDirty(true);
                                setEditItem((prev) => ({ ...prev, description: e.target.value }));
                              }}
                              className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                              rows={3}
                            />
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">Price</label>
                              <input
                                type="number"
                                step="0.01"
                                value={editItem.price}
                                onChange={(e) => {
                                  setBasicsDirty(true);
                                  setEditItem((prev) => ({ ...prev, price: e.target.value }));
                                }}
                                className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">Prep time (mins)</label>
                              <input
                                type="number"
                                value={editItem.preparationTime}
                                onChange={(e) => {
                                  setBasicsDirty(true);
                                  setEditItem((prev) => ({ ...prev, preparationTime: e.target.value }));
                                }}
                                className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">Category</label>
                            <select
                              value={editItem.categoryId}
                              onChange={(e) => {
                                setBasicsDirty(true);
                                setEditItem((prev) => ({ ...prev, categoryId: e.target.value }));
                              }}
                              className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            >
                              <option value="">Select category</option>
                              {categories.map((category) => (
                                <option key={category.id} value={category.id}>
                                  {category.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          <ItemSizeEditor
                            sizes={editItemSizes}
                            onCreate={async (input) => {
                              await api.post(`/api/menu/items/${encodeURIComponent(editItem.id)}/sizes`, {
                                sizeName: input.sizeName,
                                price: input.price,
                                isPreselected: input.isPreselected,
                                displayOrder: input.displayOrder
                              });
                              await reloadEditItemSizes(editItem.id);
                            }}
                            onUpdate={async (sizeId, patch) => {
                              await api.put(`/api/menu/items/${encodeURIComponent(editItem.id)}/sizes/${encodeURIComponent(sizeId)}`, patch);
                              await reloadEditItemSizes(editItem.id);
                            }}
                            onDelete={async (sizeId) => {
                              await api.delete(`/api/menu/items/${encodeURIComponent(editItem.id)}/sizes/${encodeURIComponent(sizeId)}`);
                              await reloadEditItemSizes(editItem.id);
                            }}
                          />

                          <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">Images</label>
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
                                    setBasicsDirty(true);
                                    setEditItemImages(validFiles);
                                  }}
                                />
                              </label>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {editItemExistingImages.length} existing, {editItemImages.length} new
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-end gap-3 pt-2">
                            <button
                              type="button"
                              className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700 disabled:opacity-50"
                              disabled={!basicsDirty || isSaving}
                              onClick={() => cancelBasicsChanges()}
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold disabled:opacity-50"
                              disabled={isSaving || !basicsDirty}
                              onClick={handleUpdateItem}
                            >
                              {isSaving ? 'Saving...' : 'Save'}
                            </button>
                          </div>
                        </div>
                      ) : editorTab === 'availability' ? (
                        <div className="space-y-4">
                          <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="font-bold text-gray-900 dark:text-white">Availability</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">Quick toggle for daily ops.</div>
                              </div>
                              <button
                                type="button"
                                className={clsx(
                                  'inline-flex items-center gap-2 rounded-lg px-3 py-2 font-bold',
                                  editingItem.is_available
                                    ? 'bg-teal-100 text-teal-700 hover:bg-teal-200'
                                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200'
                                )}
                                onClick={() => handleToggleAvailability(editingItem)}
                              >
                                {editingItem.is_available ? 'Available' : '86'}
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : editorTab === 'modifiers' ? (
                        <div className="space-y-4">
                          <ChoiceGroupAssignment
                            availableGroups={modifierGroups.map((g: any) => toChoiceGroup(g))}
                            inheritedGroups={editItemInheritedGroups}
                            attachedGroups={editItemAttachedGroups}
                            onAddAttachedGroup={(groupId) => {
                              setEditItemAttachedGroups((prev) => {
                                if (prev.some((p) => p.groupId === groupId)) return prev;
                                const found = modifierGroups.find((g) => g.id === groupId);
                                return [
                                  ...prev,
                                  {
                                    groupId,
                                    name: found?.name,
                                    displayOrder: prev.length
                                  }
                                ];
                              });
                            }}
                            onRemoveAttachedGroup={(groupId) => setEditItemAttachedGroups((prev) => prev.filter((p) => p.groupId !== groupId))}
                            onUpdateAttachedGroup={(groupId, patch) =>
                              setEditItemAttachedGroups((prev) => prev.map((p) => (p.groupId === groupId ? { ...p, ...patch } : p)))
                            }
                          />

                          <div className="flex justify-end gap-3">
                            <button
                              type="button"
                              className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold disabled:opacity-50"
                              disabled={isSaving}
                              onClick={async () => {
                                try {
                                  setIsSaving(true);
                                  await syncItemModifierGroups(editItem.id, editItemAttachedGroups, editItemExistingAttachedGroups);
                                  await loadMenuData();
                                  toast.success('Modifiers updated');
                                } catch (e) {
                                  toast.error('Failed to update modifiers');
                                } finally {
                                  setIsSaving(false);
                                }
                              }}
                            >
                              {isSaving ? 'Saving...' : 'Save modifiers'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <ItemPreviewPanel item={editingItem} sizes={editItemSizes} />
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Unsaved changes guard */}
      <AnimatePresence>
        {showDiscardConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
            onClick={() => setShowDiscardConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.98, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.98, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-5 border border-gray-200 dark:border-gray-700"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-lg font-black text-gray-900 dark:text-white">Discard changes?</div>
              <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                You have unsaved edits. If you continue, your changes will be lost.
              </div>
              <div className="mt-4 flex justify-end gap-3">
                <button
                  type="button"
                  className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                  onClick={() => setShowDiscardConfirm(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold"
                  onClick={() => proceedPendingSelection()}
                >
                  Discard
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
            onClick={() => {
              setShowEditItemModal(false);
              setEditingItem(null);
              setEditItemAttachedGroups([]);
              setEditItemExistingAttachedGroups([]);
              setEditItemSizes([]);
              setEditItemInheritedGroups([]);
            }}
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
                <ItemSizeEditor
                  sizes={editItemSizes}
                  onCreate={async (input) => {
                    await api.post(`/api/menu/items/${encodeURIComponent(editItem.id)}/sizes`, {
                      sizeName: input.sizeName,
                      price: input.price,
                      isPreselected: input.isPreselected,
                      displayOrder: input.displayOrder
                    });
                    await reloadEditItemSizes(editItem.id);
                  }}
                  onUpdate={async (sizeId, patch) => {
                    await api.put(`/api/menu/items/${encodeURIComponent(editItem.id)}/sizes/${encodeURIComponent(sizeId)}`, patch);
                    await reloadEditItemSizes(editItem.id);
                  }}
                  onDelete={async (sizeId) => {
                    await api.delete(`/api/menu/items/${encodeURIComponent(editItem.id)}/sizes/${encodeURIComponent(sizeId)}`);
                    await reloadEditItemSizes(editItem.id);
                  }}
                />

                <ChoiceGroupAssignment
                  availableGroups={modifierGroups.map((g: any) => toChoiceGroup(g))}
                  inheritedGroups={editItemInheritedGroups}
                  attachedGroups={editItemAttachedGroups}
                  onAddAttachedGroup={(groupId) => {
                    setEditItemAttachedGroups((prev) => {
                      if (prev.some((p) => p.groupId === groupId)) return prev;
                      const found = modifierGroups.find((g) => g.id === groupId);
                      return [
                        ...prev,
                        {
                          groupId,
                          name: found?.name,
                          displayOrder: prev.length
                        }
                      ];
                    });
                  }}
                  onRemoveAttachedGroup={(groupId) =>
                    setEditItemAttachedGroups((prev) => prev.filter((p) => p.groupId !== groupId))
                  }
                  onUpdateAttachedGroup={(groupId, patch) =>
                    setEditItemAttachedGroups((prev) =>
                      prev.map((p) => (p.groupId === groupId ? { ...p, ...patch } : p))
                    )
                  }
                />
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
                  onClick={() => {
                    setShowEditItemModal(false);
                    setEditingItem(null);
                    setEditItemAttachedGroups([]);
                    setEditItemExistingAttachedGroups([]);
                    setEditItemSizes([]);
                    setEditItemInheritedGroups([]);
                  }}
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

const SortableItemTableRow: React.FC<{
  item: MenuItem;
  selected: boolean;
  disableDrag: boolean;
  onSelect: () => void;
  onToggleAvailability: () => void;
  modifierSummary: string;
  formatMoney: (v: number) => string;
}> = ({ item, selected, disableDrag, onSelect, onToggleAvailability, modifierSummary, formatMoney }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition
  };

  const thumb = Array.isArray(item.images) ? item.images[0] : undefined;
  const price = Number(item.fromPrice ?? item.price ?? 0);

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={clsx(
        'border-t border-gray-100 dark:border-gray-700 cursor-pointer',
        selected ? 'bg-red-50/60 dark:bg-red-900/10' : 'hover:bg-gray-50 dark:hover:bg-gray-700/40',
        isDragging && 'opacity-70'
      )}
      onClick={onSelect}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            className={clsx(
              'shrink-0 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200',
              disableDrag && 'opacity-40 cursor-not-allowed'
            )}
            onClick={(e) => e.stopPropagation()}
            disabled={disableDrag}
            {...(!disableDrag ? attributes : {})}
            {...(!disableDrag ? listeners : {})}
            aria-label="Drag to reorder"
            title={disableDrag ? 'Reorder disabled while searching' : 'Drag to reorder'}
          >
            <GripVertical className="h-5 w-5" />
          </button>

          <div className="h-10 w-10 rounded-lg bg-gray-100 dark:bg-gray-700 overflow-hidden shrink-0">
            {thumb ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={resolveMediaUrl(thumb)} alt="" className="h-full w-full object-cover" />
            ) : null}
          </div>

          <div className="min-w-0">
            <div className="font-semibold text-gray-900 dark:text-white truncate">{item.name}</div>
            {item.description ? (
              <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{item.description}</div>
            ) : null}
          </div>
        </div>
      </td>

      <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">
        {Array.isArray(item.sizes) && item.sizes.length > 0 ? `From ${formatMoney(price)}` : formatMoney(price)}
      </td>

      <td className="px-4 py-3">
        <button
          type="button"
          className={clsx(
            'inline-flex items-center gap-2 rounded-lg px-3 py-1.5 font-bold',
            item.is_available
              ? 'bg-teal-100 text-teal-700 hover:bg-teal-200'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200'
          )}
          onClick={(e) => {
            e.stopPropagation();
            onToggleAvailability();
          }}
        >
          {item.is_available ? 'Available' : '86'}
        </button>
      </td>

      <td className="px-4 py-3 text-gray-700 dark:text-gray-200">{modifierSummary}</td>

      <td className="px-4 py-3 text-right">
        <div className="inline-flex items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 px-3 py-1.5 font-bold text-gray-800 dark:text-gray-100"
            onClick={(e) => {
              e.stopPropagation();
              onSelect();
            }}
          >
            <Edit3 className="h-4 w-4" />
            Edit
          </button>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-lg bg-gray-100 px-3 py-1.5 font-bold text-gray-400 dark:bg-gray-700"
            disabled
            title="Duplicate (coming soon)"
            onClick={(e) => e.stopPropagation()}
          >
            <Copy className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-lg bg-gray-100 px-3 py-1.5 font-bold text-gray-400 dark:bg-gray-700"
            disabled
            title="Delete (coming soon)"
            onClick={(e) => e.stopPropagation()}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </td>
    </tr>
  );
};

const ItemPreviewPanel: React.FC<{ item: MenuItem; sizes: ItemSize[] }> = ({ item, sizes }) => {
  const formatMoney = (v: number) => {
    const n = Number.isFinite(v) ? v : 0;
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(n);
    } catch {
      return `$${n.toFixed(2)}`;
    }
  };

  const groups = Array.isArray((item as any).modifierGroups) ? (item as any).modifierGroups : [];
  const sizeList = Array.isArray(sizes) ? sizes : [];
  const defaultSizeId =
    sizeList.find((s) => s.isPreselected)?.id || sizeList[0]?.id || null;
  const [selectedSizeId, setSelectedSizeId] = useState<string | null>(defaultSizeId);
  const [singleSelections, setSingleSelections] = useState<Record<string, string | null>>({});
  const [multiSelections, setMultiSelections] = useState<Record<string, Record<string, boolean>>>({});
  const [qtySelections, setQtySelections] = useState<Record<string, Record<string, number>>>({});

  useEffect(() => {
    setSelectedSizeId(defaultSizeId);
    setSingleSelections({});
    setMultiSelections({});
    setQtySelections({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  const basePrice = (() => {
    if (selectedSizeId) {
      const s = sizeList.find((x) => x.id === selectedSizeId);
      if (s) return Number(s.price || 0);
    }
    return Number(item.fromPrice ?? item.price ?? 0);
  })();

  const modifiersTotal = groups.reduce((sum: number, g: any) => {
    const groupId = String(g.id);
    const selectionType = (g.selectionType || g.selection_type || 'single') as string;
    const options = Array.isArray(g.options) ? g.options : [];
    if (selectionType === 'single') {
      const selected = singleSelections[groupId];
      const opt = options.find((o: any) => String(o.id) === String(selected));
      return sum + Number(opt?.priceDelta ?? opt?.price_delta ?? 0);
    }
    if (selectionType === 'quantity') {
      const qtyMap = qtySelections[groupId] || {};
      return (
        sum +
        options.reduce((s2: number, o: any) => {
          const qty = Number(qtyMap[String(o.id)] || 0);
          const delta = Number(o.priceDelta ?? o.price_delta ?? 0);
          return s2 + qty * delta;
        }, 0)
      );
    }
    // multiple
    const map = multiSelections[groupId] || {};
    return (
      sum +
      options.reduce((s2: number, o: any) => {
        if (!map[String(o.id)]) return s2;
        return s2 + Number(o.priceDelta ?? o.price_delta ?? 0);
      }, 0)
    );
  }, 0);

  const total = basePrice + modifiersTotal;

  const thumb = Array.isArray(item.images) ? item.images[0] : undefined;

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="h-14 w-14 rounded-xl bg-gray-100 dark:bg-gray-700 overflow-hidden shrink-0">
          {thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={resolveMediaUrl(thumb)} alt="" className="h-full w-full object-cover" />
          ) : null}
        </div>
        <div className="min-w-0">
          <div className="text-lg font-black text-gray-900 dark:text-white truncate">{item.name}</div>
          <div className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{item.description || ''}</div>
          <div className="mt-2 text-sm font-bold text-gray-900 dark:text-white">
            {sizeList.length > 0 ? `From ${formatMoney(Math.min(...sizeList.map((s) => s.price)))}` : formatMoney(Number(item.price || 0))}
            <span className="ml-2 text-xs font-semibold text-gray-500 dark:text-gray-400">(Preview total: {formatMoney(total)})</span>
          </div>
        </div>
      </div>

      {sizeList.length > 0 ? (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3">
          <div className="text-xs font-black uppercase tracking-wide text-gray-500 dark:text-gray-400">Sizes</div>
          <div className="mt-2 space-y-2">
            {sizeList
              .slice()
              .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
              .map((s) => (
                <label key={s.id} className="flex items-center justify-between gap-3 text-sm font-semibold text-gray-800 dark:text-gray-200">
                  <span className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      name="preview-size"
                      checked={selectedSizeId === s.id}
                      onChange={() => setSelectedSizeId(s.id)}
                    />
                    {s.sizeName}
                  </span>
                  <span>{formatMoney(Number(s.price || 0))}</span>
                </label>
              ))}
          </div>
        </div>
      ) : null}

      {groups.length === 0 ? (
        <div className="text-sm text-gray-500 dark:text-gray-400">No modifier groups for this item.</div>
      ) : (
        <div className="space-y-3">
          {groups.map((g: any) => {
            const groupId = String(g.id);
            const name = String(g.name || '');
            const selectionType = (g.selectionType || g.selection_type || 'single') as 'single' | 'multiple' | 'quantity';
            const minSelections = Number(g.minSelections ?? g.min_selections ?? 0);
            const maxSelections = g.maxSelections ?? g.max_selections ?? null;
            const isRequired = Boolean(g.isRequired ?? g.is_required);
            const options = Array.isArray(g.options) ? g.options : [];

            return (
              <div key={groupId} className="rounded-xl border border-gray-200 dark:border-gray-700 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-black text-gray-900 dark:text-white truncate">{name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {isRequired ? 'Required' : 'Optional'} · {selectionType}
                      {maxSelections !== null ? ` · min ${minSelections} / max ${maxSelections}` : minSelections ? ` · min ${minSelections}` : ''}
                    </div>
                  </div>
                </div>

                <div className="mt-2 space-y-2">
                  {options.map((o: any) => {
                    const optId = String(o.id);
                    const optName = String(o.name || '');
                    const delta = Number(o.priceDelta ?? o.price_delta ?? 0);

                    if (selectionType === 'single') {
                      const selected = singleSelections[groupId] || null;
                      return (
                        <label key={optId} className="flex items-center justify-between gap-3 text-sm font-semibold text-gray-800 dark:text-gray-200">
                          <span className="inline-flex items-center gap-2">
                            <input
                              type="radio"
                              name={`preview-${groupId}`}
                              checked={selected === optId}
                              onChange={() => setSingleSelections((prev) => ({ ...prev, [groupId]: optId }))}
                            />
                            {optName}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">{delta ? `+${formatMoney(delta)}` : ''}</span>
                        </label>
                      );
                    }

                    if (selectionType === 'quantity') {
                      const qty = Number((qtySelections[groupId] || {})[optId] || 0);
                      return (
                        <div key={optId} className="flex items-center justify-between gap-3 text-sm font-semibold text-gray-800 dark:text-gray-200">
                          <div className="min-w-0">
                            <div className="truncate">{optName}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">{delta ? `+${formatMoney(delta)} each` : ''}</div>
                          </div>
                          <input
                            type="number"
                            min={0}
                            value={qty}
                            onChange={(e) => {
                              const next = Math.max(0, Number(e.target.value) || 0);
                              setQtySelections((prev) => ({
                                ...prev,
                                [groupId]: { ...(prev[groupId] || {}), [optId]: next }
                              }));
                            }}
                            className="w-20 rounded-lg border border-gray-200 px-2 py-1 text-sm font-bold dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                          />
                        </div>
                      );
                    }

                    // multiple
                    const checked = Boolean((multiSelections[groupId] || {})[optId]);
                    return (
                      <label key={optId} className="flex items-center justify-between gap-3 text-sm font-semibold text-gray-800 dark:text-gray-200">
                        <span className="inline-flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) =>
                              setMultiSelections((prev) => ({
                                ...prev,
                                [groupId]: { ...(prev[groupId] || {}), [optId]: e.target.checked }
                              }))
                            }
                          />
                          {optName}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">{delta ? `+${formatMoney(delta)}` : ''}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
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
  onReorderItems: (categoryId: string, orderedItemIds: string[]) => void;
}

const CategorySection: React.FC<CategorySectionProps> = ({
  category,
  isExpanded,
  onToggle,
  searchTerm,
  onAddItem,
  onEditItem,
  onToggleAvailability,
  onReorderItems
}) => {
  const filteredItems = category.items?.filter(item =>
    searchTerm === '' ||
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.description.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const itemIds = filteredItems.map((i) => i.id);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;
    const oldIndex = itemIds.indexOf(activeId);
    const newIndex = itemIds.indexOf(overId);
    if (oldIndex === -1 || newIndex === -1) return;
    const nextIds = arrayMove(itemIds, oldIndex, newIndex);
    onReorderItems(category.id, nextIds);
  };

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
                <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
                  <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
                    <div className="space-y-2 pt-3">
                      {filteredItems.map((item) => (
                        <SortableMenuItemRow
                          key={item.id}
                          item={item}
                          onEdit={onEditItem}
                          onToggleAvailability={onToggleAvailability}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
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

const SortableMenuItemRow: React.FC<{
  item: MenuItem;
  onEdit: (item: MenuItem) => void;
  onToggleAvailability: (item: MenuItem) => void;
}> = ({ item, onEdit, onToggleAvailability }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={clsx(isDragging && 'opacity-70')}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          className="mt-2 p-2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          aria-label="Drag to reorder"
          title="Drag to reorder"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <MenuItemCard item={item} onEdit={onEdit} onToggleAvailability={onToggleAvailability} />
        </div>
      </div>
    </div>
  );
};

const SortableCategoryGroupChip: React.FC<{
  id: string;
  label: string;
  onRemove: () => void;
}> = ({ id, label, onRemove }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={clsx(
        'inline-flex items-center gap-2 px-3 py-2 rounded-full bg-gray-100 dark:bg-gray-700 text-sm font-semibold text-gray-800 dark:text-gray-200',
        isDragging && 'opacity-70'
      )}
    >
      <button
        type="button"
        className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
        aria-label="Drag to reorder"
        title="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="w-4 h-4" />
      </button>
      <span className="truncate max-w-[240px]">{label}</span>
      <button
        type="button"
        className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
        aria-label="Remove"
        title="Remove"
        onClick={onRemove}
      >
        ×
      </button>
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
            {(item.sizes && item.sizes.length > 0 ? 'From ' : '')}${(Number(item.fromPrice ?? item.price) || 0).toFixed(2)}
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
                            {(item.sizes && item.sizes.length > 0 ? 'From ' : '')}${(Number(item.fromPrice ?? item.price) || 0).toFixed(2)}
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