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
  X
} from 'lucide-react';
import DashboardLayout from '../../components/Layout/DashboardLayout';
import { useUser } from '../../contexts/UserContext';
import toast from 'react-hot-toast';

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
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [showPreview, setShowPreview] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [editingCategory, setEditingCategory] = useState<MenuCategory | null>(null);

  // Load menu data
  const loadMenuData = useCallback(async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/menu/categories?restaurant_id=${user.id}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('servio_access_token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setCategories(data.categories || []);
        // Auto-expand all categories initially
        setExpandedCategories(new Set(data.categories?.map((cat: MenuCategory) => cat.id) || []));
      } else {
        toast.error('Failed to load menu data');
      }
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
                
                <button className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors">
                  <Settings className="w-4 h-4" />
                  Menu Settings
                </button>
                
                <button className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors">
                  <Plus className="w-4 h-4" />
                  Add Item
                </button>
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
    </DashboardLayout>
  );
};

// Category Section Component
interface CategorySectionProps {
  category: CategoryWithItems;
  isExpanded: boolean;
  onToggle: () => void;
  searchTerm: string;
}

const CategorySection: React.FC<CategorySectionProps> = ({ 
  category, 
  isExpanded, 
  onToggle,
  searchTerm 
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
                    <MenuItemCard key={item.id} item={item} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500">No items in this category</p>
                  <button className="text-red-600 hover:text-red-700 text-sm mt-1">
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
}

const MenuItemCard: React.FC<MenuItemCardProps> = ({ item }) => {
  return (
    <div className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
      {/* Item Image */}
      <div className="w-12 h-12 bg-gray-200 dark:bg-gray-600 rounded-lg flex-shrink-0 overflow-hidden">
        {item.image ? (
          <img 
            src={item.image} 
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
        
        <button className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-white dark:hover:bg-gray-800 transition-colors">
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