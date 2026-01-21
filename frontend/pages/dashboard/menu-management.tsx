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
  X,
  Copy
} from 'lucide-react';
import DashboardLayout from '../../components/Layout/DashboardLayout';
import { useUser } from '../../contexts/UserContext';
import { api } from '../../lib/api';
import toast from 'react-hot-toast';

function resolveAssetUrl(url: string | null | undefined) {
  if (!url) return undefined
  if (/^https?:\/\//i.test(url)) return url
  const base = String((api as any)?.defaults?.baseURL || '').replace(/\/+$/, '')
  if (!base) return url
  return `${base}${url.startsWith('/') ? '' : '/'}${url}`
}

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
  const [isSaving, setIsSaving] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [newItemImageFile, setNewItemImageFile] = useState<File | null>(null);
  const [newItemImagePreview, setNewItemImagePreview] = useState<string | null>(null);
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
          updated_at: item.updated_at
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
      // Fallback: attempt to copy via selection API
      try {
        const el = document.getElementById('public-order-url') as HTMLInputElement | null;
        if (el) {
          el.focus();
          el.select();
          const ok = document.execCommand('copy');
          if (ok) toast.success('Public ordering link copied');
          else toast.error('Copy failed—select and copy manually');
        } else {
          toast.error('Copy failed—select and copy manually');
        }
      } catch {
        toast.error('Copy failed—select and copy manually');
      }
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
    setNewItemImageFile(null);
    setNewItemImagePreview(null);
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
      formData.append('preparationTime', String(newItem.preparationTime ? Number(newItem.preparationTime) : 0));
      formData.append('sortOrder', '0');
      formData.append('isAvailable', String(Boolean(newItem.isAvailable)));
      if (newItemImageFile) {
        formData.append('images', newItemImageFile);
      }

      await api.post('/api/menu/items', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      toast.success('Menu item created');
      setShowAddItemModal(false);
      setNewItemImageFile(null);
      setNewItemImagePreview(null);
      await loadMenuData();
    } catch (error) {
      console.error('Failed to create menu item:', error);
      toast.error('Failed to create menu item');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateItem = async () => {
    if (!editingItem || !editingItem.name.trim()) {
      toast.error('Item name is required');
      return;
    }
    if (!editingItem.price || Number(editingItem.price) <= 0) {
      toast.error('Price must be greater than 0');
      return;
    }

    setIsSaving(true);
    try {
      const formData = new FormData();
      formData.append('name', editingItem.name.trim());
      formData.append('description', editingItem.description || '');
      formData.append('price', editingItem.price.toString());
      formData.append('preparationTime', (editingItem.preparation_time || 0).toString());
      formData.append('isAvailable', editingItem.is_available.toString());

      // Preserve existing images unless user explicitly removed them.
      const existingImages = Array.isArray(editingItem.images)
        ? editingItem.images
        : editingItem.image
          ? [editingItem.image]
          : [];
      formData.append('existingImages', JSON.stringify(existingImages));
      
      if (imageFile) {
        formData.append('images', imageFile);
      }

      await api.put(`/api/menu/items/${editingItem.id}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      toast.success('Menu item updated');
      setEditingItem(null);
      setImageFile(null);
      setImagePreview(null);
      await loadMenuData();
    } catch (error) {
      console.error('Failed to update menu item:', error);
      toast.error('Failed to update menu item');
    } finally {
      setIsSaving(false);
    }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleNewItemImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setNewItemImageFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setNewItemImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (editingItem) {
      setEditingItem({ ...editingItem, images: [], image: undefined });
    }
  };

  const removeNewItemImage = () => {
    setNewItemImageFile(null);
    setNewItemImagePreview(null);
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
                    Share this link with customers to place orders for your menu.
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
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
              {filteredCategories.map((category) => (
                <CategorySection
                  key={category.id}
                  category={category}
                  isExpanded={expandedCategories.has(category.id)}
                  onToggle={() => toggleCategory(category.id)}
                  searchTerm={searchTerm}
                  onAddItem={openAddItemModal}
                  onEditItem={setEditingItem}
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
                {/* Photo Upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Photo</label>
                  <div className="space-y-4">
                    {newItemImagePreview && (
                      <div className="relative inline-block">
                        <img
                          src={newItemImagePreview}
                          alt="New item"
                          className="w-32 h-32 object-cover rounded-lg border border-gray-200 dark:border-gray-600"
                        />
                        <button
                          type="button"
                          onClick={removeNewItemImage}
                          className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    <div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleNewItemImageUpload}
                        className="hidden"
                        id="new-item-image-upload"
                      />
                      <label
                        htmlFor="new-item-image-upload"
                        className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      >
                        <Upload className="w-4 h-4" />
                        {newItemImagePreview ? 'Change Photo' : 'Upload Photo'}
                      </label>
                    </div>
                  </div>
                </div>
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
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
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
        {editingItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            onClick={() => {
              setEditingItem(null);
              setImageFile(null);
              setImagePreview(null);
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Edit Menu Item</h2>
              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
                  <input
                    type="text"
                    value={editingItem.name}
                    onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                    className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    placeholder="e.g. Jerk Chicken"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
                  <textarea
                    value={editingItem.description || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                    className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    rows={3}
                    placeholder="Describe your menu item..."
                  />
                </div>

                {/* Image Upload Section */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Image</label>
                  <div className="space-y-4">
                    {/* Current Image or Preview */}
                    {(imagePreview || editingItem.image) && (
                      <div className="relative inline-block">
                        <img
                          src={imagePreview || resolveAssetUrl(editingItem.image)}
                          alt={editingItem.name}
                          className="w-32 h-32 object-cover rounded-lg border border-gray-200 dark:border-gray-600"
                        />
                        <button
                          type="button"
                          onClick={removeImage}
                          className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                    
                    {/* Upload Button */}
                    <div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                        id="image-upload"
                      />
                      <label
                        htmlFor="image-upload"
                        className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      >
                        <Upload className="w-4 h-4" />
                        {editingItem.image || imagePreview ? 'Change Image' : 'Upload Image'}
                      </label>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Price ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editingItem.price}
                      onChange={(e) => setEditingItem({ ...editingItem, price: Number(e.target.value) })}
                      className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Prep Time (min)</label>
                    <input
                      type="number"
                      min="0"
                      value={editingItem.preparation_time || ''}
                      onChange={(e) => setEditingItem({ ...editingItem, preparation_time: Number(e.target.value) || undefined })}
                      className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      placeholder="15"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="edit-available"
                    checked={editingItem.is_available}
                    onChange={(e) => setEditingItem({ ...editingItem, is_available: e.target.checked })}
                    className="w-4 h-4 text-red-600 bg-gray-100 border-gray-300 rounded focus:ring-red-500 dark:focus:ring-red-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                  />
                  <label htmlFor="edit-available" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Available for ordering
                  </label>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setEditingItem(null);
                    setImageFile(null);
                    setImagePreview(null);
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
                  {isSaving ? 'Updating...' : 'Update Item'}
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
}

const CategorySection: React.FC<CategorySectionProps> = ({
  category,
  isExpanded,
  onToggle,
  searchTerm,
  onAddItem,
  onEditItem
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
                    <MenuItemCard key={item.id} item={item} onEdit={onEditItem} />
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
}

const MenuItemCard: React.FC<MenuItemCardProps> = ({ item, onEdit }) => {
  return (
    <div className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
      {/* Item Image */}
      <div className="w-12 h-12 bg-gray-200 dark:bg-gray-600 rounded-lg flex-shrink-0 overflow-hidden">
        {item.image ? (
          <img 
            src={resolveAssetUrl(item.image)} 
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
        <div className="flex items-center">
          {item.is_available ? (
            <CheckCircle className="w-5 h-5 text-green-500" />
          ) : (
            <XCircle className="w-5 h-5 text-red-500" />
          )}
        </div>
        
        <button 
          className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-white dark:hover:bg-gray-800 transition-colors"
          onClick={() => onEdit(item)}
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
                          src={item.image} 
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