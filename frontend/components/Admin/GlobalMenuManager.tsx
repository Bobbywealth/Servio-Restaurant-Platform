'use client';

import React, { useState, useMemo } from 'react';
import { 
  Search, Filter, Plus, Edit2, Trash2, Eye, 
  Copy, Check, X, ChevronDown, ChevronRight,
  Globe, Send, Clock, DollarSign, Package,
  AlertTriangle, CheckCircle, Loader2
} from 'lucide-react';
import { api } from '@/lib/api';
import { useSocket } from '@/lib/socket';

// Types
interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  category?: string;
  is_available?: boolean;
  preparation_time?: number;
  image_url?: string;
}

interface Category {
  id: string;
  name: string;
  description?: string;
  sort_order: number;
  items?: MenuItem[];
}

interface Restaurant {
  id: string;
  name: string;
  slug: string;
  logo_url?: string | null;
}

interface GlobalMenuManagerProps {
  onClose?: () => void;
}

// Mock data for development
const mockRestaurants: Restaurant[] = [
  { id: '1', name: 'Downtown Location', slug: 'downtown', logo_url: null },
  { id: '2', name: 'Airport Location', slug: 'airport', logo_url: null },
  { id: '3', name: 'Mall Location', slug: 'mall', logo_url: null },
];

const mockCategories: Category[] = [
  { id: '1', name: 'Appetizers', sort_order: 1, items: [
    { id: '1', name: 'Mozzarella Sticks', price: 8.99, category: 'Appetizers', preparation_time: 8, is_available: true },
    { id: '2', name: 'Caesar Salad', price: 10.99, category: 'Appetizers', preparation_time: 5, is_available: true },
    { id: '3', name: 'Wings (12pc)', price: 14.99, category: 'Appetizers', preparation_time: 12, is_available: true },
  ]},
  { id: '2', name: 'Main Courses', sort_order: 2, items: [
    { id: '4', name: 'Grilled Salmon', price: 24.99, category: 'Main Courses', preparation_time: 18, is_available: true },
    { id: '5', name: 'Ribeye Steak', price: 32.99, category: 'Main Courses', preparation_time: 22, is_available: true },
    { id: '6', name: 'Chicken Parmesan', price: 18.99, category: 'Main Courses', preparation_time: 15, is_available: false },
  ]},
  { id: '3', name: 'Beverages', sort_order: 3, items: [
    { id: '7', name: 'Soft Drinks', price: 2.99, category: 'Beverages', preparation_time: 1, is_available: true },
    { id: '8', name: 'Fresh Lemonade', price: 4.99, category: 'Beverages', preparation_time: 2, is_available: true },
  ]},
];

// Utility functions
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

function formatTime(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

export function GlobalMenuManager({ onClose }: GlobalMenuManagerProps) {
  const socket = useSocket();
  const [activeTab, setActiveTab] = useState<'items' | 'categories' | 'push'>('items');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRestaurants, setSelectedRestaurants] = useState<Set<string>>(new Set(['1', '2', '3']));
  const [categories, setCategories] = useState<Category[]>(mockCategories);
  const [restaurants, setRestaurants] = useState<Restaurant[]>(mockRestaurants);
  const [isPushing, setIsPushing] = useState(false);
  const [pushResults, setPushResults] = useState<{ id: string; success: boolean; message: string }[] | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['1', '2', '3']));
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<MenuItem>>({});

  // Filter items based on search
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return categories;
    const query = searchQuery.toLowerCase();
    return categories.map(cat => ({
      ...cat,
      items: cat.items?.filter(item => 
        item.name.toLowerCase().includes(query) ||
        item.category?.toLowerCase().includes(query)
      ) || []
    })).filter(cat => cat.items && cat.items.length > 0);
  }, [categories, searchQuery]);

  // Select all restaurants
  const selectAll = () => {
    setSelectedRestaurants(new Set(restaurants.map(r => r.id)));
  };

  // Deselect all restaurants
  const deselectAll = () => {
    setSelectedRestaurants(new Set());
  };

  // Toggle restaurant selection
  const toggleRestaurant = (id: string) => {
    const next = new Set(selectedRestaurants);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedRestaurants(next);
  };

  // Toggle category expansion
  const toggleCategory = (id: string) => {
    const next = new Set(expandedCategories);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setExpandedCategories(next);
  };

  // Push menu to selected restaurants
  const pushToRestaurants = async () => {
    if (selectedRestaurants.size === 0) return;
    
    setIsPushing(true);
    setPushResults(null);

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const results = Array.from(selectedRestaurants).map(restaurantId => {
        const restaurant = restaurants.find(r => r.id === restaurantId);
        return {
          id: restaurantId,
          success: true,
          message: `Menu synced to ${restaurant?.name || 'restaurant'} successfully`
        };
      });
      
      setPushResults(results);
      
      // Emit socket event for real-time sync
      if (socket) {
        socket.emit('menu:global_sync', { 
          restaurantIds: Array.from(selectedRestaurants),
          timestamp: new Date()
        });
      }
    } catch (error) {
      setPushResults([{
        id: 'error',
        success: false,
        message: 'Failed to sync menu. Please try again.'
      }]);
    } finally {
      setIsPushing(false);
    }
  };

  // Start editing an item
  const startEdit = (item: MenuItem) => {
    setEditingItem(item.id);
    setEditForm({
      name: item.name,
      price: item.price,
      preparation_time: item.preparation_time,
      is_available: item.is_available
    });
  };

  // Save edited item
  const saveEdit = (categoryId: string, itemId: string) => {
    setCategories(prev => prev.map(cat => {
      if (cat.id !== categoryId) return cat;
      return {
        ...cat,
        items: cat.items?.map(item => 
          item.id === itemId ? { ...item, ...editForm } as MenuItem : item
        ) || []
      };
    }));
    setEditingItem(null);
    setEditForm({});
  };

  // Cancel editing
  const cancelEdit = () => {
    setEditingItem(null);
    setEditForm({});
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Global Menu Management
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Manage and sync menu across all restaurant locations
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex gap-2">
            {(['items', 'categories', 'push'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {tab === 'items' && 'Items'}
                {tab === 'categories' && 'Categories'}
                {tab === 'push' && 'Push to Locations'}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {activeTab === 'items' && (
            <div className="space-y-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search menu items..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input-field w-full pl-10"
                />
              </div>

              {/* Categories & Items */}
              <div className="space-y-4">
                {filteredItems.map(category => (
                  <div key={category.id} className="card">
                    {/* Category Header */}
                    <div 
                      className="flex items-center justify-between p-4 cursor-pointer"
                      onClick={() => toggleCategory(category.id)}
                    >
                      <div className="flex items-center gap-3">
                        {expandedCategories.has(category.id) ? (
                          <ChevronDown className="w-5 h-5 text-gray-400" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-gray-400" />
                        )}
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                          {category.name}
                        </h3>
                        <span className="text-sm text-gray-500">
                          ({category.items?.length || 0} items)
                        </span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          // Add item to category
                        }}
                        className="btn-secondary text-sm flex items-center gap-1"
                      >
                        <Plus className="w-4 h-4" />
                        Add Item
                      </button>
                    </div>

                    {/* Items */}
                    {expandedCategories.has(category.id) && category.items && (
                      <div className="border-t border-gray-200 dark:border-gray-700">
                        {category.items.map(item => (
                          <div 
                            key={item.id}
                            className="p-4 border-b border-gray-100 dark:border-gray-700 last:border-0"
                          >
                            {editingItem === item.id ? (
                              // Edit Form
                              <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">
                                      Name
                                    </label>
                                    <input
                                      type="text"
                                      value={editForm.name || ''}
                                      onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                                      className="input-field w-full"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">
                                      Price
                                    </label>
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={editForm.price || 0}
                                      onChange={(e) => setEditForm(prev => ({ ...prev, price: parseFloat(e.target.value) }))}
                                      className="input-field w-full"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">
                                      Prep Time (min)
                                    </label>
                                    <input
                                      type="number"
                                      value={editForm.preparation_time || 0}
                                      onChange={(e) => setEditForm(prev => ({ ...prev, preparation_time: parseInt(e.target.value) }))}
                                      className="input-field w-full"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">
                                      Status
                                    </label>
                                    <select
                                      value={editForm.is_available ? 'available' : 'unavailable'}
                                      onChange={(e) => setEditForm(prev => ({ ...prev, is_available: e.target.value === 'available' }))}
                                      className="input-field w-full"
                                    >
                                      <option value="available">Available</option>
                                      <option value="unavailable">Unavailable</option>
                                    </select>
                                  </div>
                                </div>
                                <div className="flex gap-2 justify-end">
                                  <button onClick={cancelEdit} className="btn-secondary">
                                    Cancel
                                  </button>
                                  <button 
                                    onClick={() => saveEdit(category.id, item.id)}
                                    className="btn-primary flex items-center gap-1"
                                  >
                                    <Check className="w-4 h-4" />
                                    Save
                                  </button>
                                </div>
                              </div>
                            ) : (
                              // Item Display
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-gray-900 dark:text-white">
                                      {item.name}
                                    </span>
                                    {!item.is_available && (
                                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                                        Unavailable
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                                    <span className="flex items-center gap-1">
                                      <DollarSign className="w-3.5 h-3.5" />
                                      {formatCurrency(item.price)}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <Clock className="w-3.5 h-3.5" />
                                      {formatTime(item.preparation_time || 0)}
                                    </span>
                                    <span className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-xs">
                                      {item.category}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => startEdit(item)}
                                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                  >
                                    <Edit2 className="w-4 h-4 text-gray-500" />
                                  </button>
                                  <button
                                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                  >
                                    <Copy className="w-4 h-4 text-gray-500" />
                                  </button>
                                  <button
                                    className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                  >
                                    <Trash2 className="w-4 h-4 text-red-500" />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {filteredItems.length === 0 && (
                  <div className="text-center py-12">
                    <Package className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                    <p className="text-gray-500 dark:text-gray-400">
                      No menu items found matching "{searchQuery}"
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'categories' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  Menu Categories
                </h3>
                <button className="btn-primary flex items-center gap-1">
                  <Plus className="w-4 h-4" />
                  Add Category
                </button>
              </div>
              
              <div className="space-y-2">
                {categories.map((category, idx) => (
                  <div key={category.id} className="card p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-sm font-medium text-gray-600 dark:text-gray-300">
                        {idx + 1}
                      </span>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">
                          {category.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {category.items?.length || 0} items
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                        <Edit2 className="w-4 h-4 text-gray-500" />
                      </button>
                      <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                        <ChevronDown className="w-4 h-4 text-gray-500" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'push' && (
            <div className="space-y-6">
              {/* Restaurant Selection */}
              <div className="card p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    Select Restaurants
                  </h3>
                  <div className="flex gap-2">
                    <button 
                      onClick={selectAll}
                      className="text-sm text-primary-600 hover:underline"
                    >
                      Select All
                    </button>
                    <span className="text-gray-300">|</span>
                    <button 
                      onClick={deselectAll}
                      className="text-sm text-gray-500 hover:underline"
                    >
                      Deselect All
                    </button>
                  </div>
                </div>
                
                <div className="space-y-2">
                  {restaurants.map(restaurant => (
                    <label
                      key={restaurant.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedRestaurants.has(restaurant.id)
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedRestaurants.has(restaurant.id)}
                        onChange={() => toggleRestaurant(restaurant.id)}
                        className="w-4 h-4 text-primary-600 rounded"
                      />
                      <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                        <Globe className="w-5 h-5 text-gray-500" />
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 dark:text-white">
                          {restaurant.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {restaurant.slug}
                        </div>
                      </div>
                      {selectedRestaurants.has(restaurant.id) && (
                        <CheckCircle className="w-5 h-5 text-primary-600" />
                      )}
                    </label>
                  ))}
                </div>
              </div>

              {/* Push Results */}
              {pushResults && (
                <div className="card p-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
                    Push Results
                  </h3>
                  <div className="space-y-2">
                    {pushResults.map((result, idx) => (
                      <div 
                        key={idx}
                        className={`flex items-center gap-3 p-3 rounded-lg ${
                          result.success 
                            ? 'bg-green-50 dark:bg-green-900/20' 
                            : 'bg-red-50 dark:bg-red-900/20'
                        }`}
                      >
                        {result.success ? (
                          <CheckCircle className="w-5 h-5 text-green-600" />
                        ) : (
                          <AlertTriangle className="w-5 h-5 text-red-600" />
                        )}
                        <span className={result.success ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'}>
                          {result.message}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Push Button */}
              <button
                onClick={pushToRestaurants}
                disabled={selectedRestaurants.size === 0 || isPushing}
                className={`w-full btn-primary flex items-center justify-center gap-2 py-3 ${
                  selectedRestaurants.size === 0 || isPushing ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {isPushing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Syncing Menu...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    Push to {selectedRestaurants.size} Location{selectedRestaurants.size !== 1 ? 's' : ''}
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default GlobalMenuManager;
