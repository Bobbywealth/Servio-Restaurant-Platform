import React, { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Edit3,
  Trash2,
  GripVertical,
  Upload,
  DollarSign,
  Clock,
  Tag,
  Image as ImageIcon,
  Save,
  X,
  AlertTriangle,
  Check,
  Eye,
  EyeOff,
  Download,
  FileSpreadsheet,
  FileText,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useDropzone } from 'react-dropzone';
import DashboardLayout from '../../components/Layout/DashboardLayout';
import { useUser } from '../../contexts/UserContext';
import toast from 'react-hot-toast';

interface MenuCategory {
  id: string;
  name: string;
  description: string;
  image?: string;
  image_alt_text?: string;
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
  sku?: string;
  images: string[];
  allergens: string[];
  nutritional_info?: any;
  preparation_time: number;
  sort_order: number;
  is_available: boolean;
  category_name: string;
}

interface MenuItemFormData {
  name: string;
  description: string;
  price: string;
  cost: string;
  categoryId: string;
  allergens: string[];
  preparationTime: string;
  images: File[];
  existingImages: string[];
  modifierGroupIds: string[];
}

interface MenuImport {
  id: string;
  filename: string;
  file_type: string;
  status: string;
  total_rows: number;
  processed_rows: number;
  success_count: number;
  error_count: number;
  created_at: string;
  updated_at: string;
}

interface ModifierOption {
  id: string;
  name: string;
  description?: string;
  price_modifier: number;
  sort_order: number;
}

interface ModifierGroup {
  id: string;
  name: string;
  description?: string;
  min_selections: number;
  max_selections: number;
  is_required: boolean;
  sort_order: number;
  options: ModifierOption[];
}

const SortableCategory = ({ category, onEdit, onDelete, onToggle }: {
  category: MenuCategory;
  onEdit: (category: MenuCategory) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string, active: boolean) => void;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1000 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white dark:bg-gray-800 rounded-xl border ${
        isDragging ? 'shadow-2xl border-primary-300' : 'border-gray-200 dark:border-gray-700'
      } p-4 transition-all`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
            <GripVertical className="h-5 w-5 text-gray-400" />
          </div>
          {category.image && (
            <div className="flex-shrink-0">
              <img
                src={category.image}
                alt={category.image_alt_text || category.name}
                className="w-12 h-12 object-cover rounded-lg"
              />
            </div>
          )}
          <div className="flex-1">
            <div className="flex items-center space-x-2">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                {category.name}
              </h3>
              <span className="text-sm text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-full">
                {category.item_count} items
              </span>
              {!category.is_active && (
                <span className="text-xs text-red-600 bg-red-100 dark:bg-red-900 px-2 py-1 rounded-full">
                  Hidden
                </span>
              )}
            </div>
            {category.description && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {category.description}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => onToggle(category.id, !category.is_active)}
            className={`p-2 rounded-lg transition-colors ${
              category.is_active
                ? 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
                : 'text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
            title={category.is_active ? 'Hide category' : 'Show category'}
          >
            {category.is_active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </button>
          <button
            onClick={() => onEdit(category)}
            className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
          >
            <Edit3 className="h-4 w-4" />
          </button>
          <button
            onClick={() => onDelete(category.id)}
            className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

const CategoryForm = ({ category, onSave, onCancel }: {
  category?: MenuCategory;
  onSave: (data: { name: string; description: string; imageFile?: File; imageAltText?: string; removeImage?: boolean }) => void;
  onCancel: () => void;
}) => {
  const [formData, setFormData] = useState({
    name: category?.name || '',
    description: category?.description || '',
    imageAltText: category?.image_alt_text || ''
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(category?.image || null);
  const [removeImage, setRemoveImage] = useState(false);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'image/*': [] },
    maxFiles: 1,
    onDrop: (acceptedFiles) => {
      if (acceptedFiles[0]) {
        setImageFile(acceptedFiles[0]);
        setImagePreview(URL.createObjectURL(acceptedFiles[0]));
        setRemoveImage(false);
      }
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Category name is required');
      return;
    }
    onSave({
      ...formData,
      imageFile: imageFile || undefined,
      removeImage
    });
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setRemoveImage(true);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Category Name *
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            placeholder="e.g., Appetizers, Main Courses"
            autoFocus
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Description
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            placeholder="Brief description of this category"
            rows={3}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Category Image
          </label>
          
          {imagePreview && !removeImage && (
            <div className="mb-4">
              <div className="relative inline-block">
                <img
                  src={imagePreview}
                  alt="Category preview"
                  className="w-24 h-24 object-cover rounded-lg"
                />
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            </div>
          )}

          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
              isDragActive
                ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/20'
                : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {isDragActive
                ? 'Drop image here...'
                : 'Click or drag image here'}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
              Supports: JPG, PNG, WebP
            </p>
          </div>
        </div>

        {(imagePreview || imageFile) && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Alt Text (for accessibility)
            </label>
            <input
              type="text"
              value={formData.imageAltText}
              onChange={(e) => setFormData({ ...formData, imageAltText: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              placeholder="Describe the image for screen readers"
            />
          </div>
        )}
        <div className="flex items-center justify-end space-x-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors flex items-center space-x-2"
          >
            <Save className="h-4 w-4" />
            <span>{category ? 'Update' : 'Create'} Category</span>
          </button>
        </div>
      </form>
    </motion.div>
  );
};

const MenuItemCard = ({ item, onEdit, onToggle }: {
  item: MenuItem;
  onEdit: (item: MenuItem) => void;
  onToggle: (id: string, available: boolean) => void;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:shadow-lg transition-all"
  >
    <div className="flex items-start space-x-4">
      <div className="flex-shrink-0">
        {item.images.length > 0 ? (
          <img
            src={item.images[0]}
            alt={item.name}
            className="w-16 h-16 object-cover rounded-lg"
          />
        ) : (
          <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center">
            <ImageIcon className="h-6 w-6 text-gray-400" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between">
          <div>
            <h4 className="font-medium text-gray-900 dark:text-gray-100 truncate">
              {item.name}
            </h4>
            {item.description && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                {item.description}
              </p>
            )}
            <div className="flex items-center space-x-4 mt-2">
              <span className="text-lg font-semibold text-green-600">
                ${item.price.toFixed(2)}
              </span>
              {item.preparation_time > 0 && (
                <div className="flex items-center space-x-1 text-sm text-gray-500">
                  <Clock className="h-3 w-3" />
                  <span>{item.preparation_time}m</span>
                </div>
              )}
              {item.allergens.length > 0 && (
                <div className="flex items-center space-x-1 text-sm text-orange-600">
                  <AlertTriangle className="h-3 w-3" />
                  <span>{item.allergens.length} allergens</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => onToggle(item.id, !item.is_available)}
              className={`p-2 rounded-lg transition-colors ${
                item.is_available
                  ? 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
                  : 'text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20'
              }`}
              title={item.is_available ? 'Make unavailable' : 'Make available'}
            >
              {item.is_available ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
            </button>
            <button
              onClick={() => onEdit(item)}
              className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
            >
              <Edit3 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </motion.div>
);

const MenuItemForm = ({ item, categories, modifierGroups, onSave, onCancel }: {
  item?: MenuItem;
  categories: MenuCategory[];
  modifierGroups: ModifierGroup[];
  onSave: (data: MenuItemFormData) => void;
  onCancel: () => void;
}) => {
  const [formData, setFormData] = useState<MenuItemFormData>({
    name: item?.name || '',
    description: item?.description || '',
    price: item?.price?.toString() || '',
    cost: item?.cost?.toString() || '',
    categoryId: item?.category_id || categories[0]?.id || '',
    allergens: item?.allergens || [],
    preparationTime: item?.preparation_time?.toString() || '0',
    images: [],
    existingImages: item?.images || [],
    modifierGroupIds: []
  });
  
  const [existingModifiers, setExistingModifiers] = useState<ModifierGroup[]>([]);
  const [loadingModifiers, setLoadingModifiers] = useState(false);

  // Fetch existing modifiers for the item
  useEffect(() => {
    if (item?.id) {
      setLoadingModifiers(true);
      fetch(`/api/menu/items/${item.id}/modifiers`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setExistingModifiers(data.data);
            setFormData(prev => ({
              ...prev,
              modifierGroupIds: data.data.map((mod: any) => mod.id)
            }));
          }
        })
        .catch(console.error)
        .finally(() => setLoadingModifiers(false));
    }
  }, [item?.id]);

  const commonAllergens = [
    'Gluten', 'Dairy', 'Eggs', 'Fish', 'Shellfish', 'Tree Nuts', 'Peanuts', 'Soy', 'Sesame'
  ];

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'image/*': [] },
    maxFiles: 5,
    onDrop: (acceptedFiles) => {
      setFormData(prev => ({ ...prev, images: [...prev.images, ...acceptedFiles] }));
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.price || !formData.categoryId) {
      toast.error('Please fill in all required fields');
      return;
    }
    onSave(formData);
  };

  const toggleAllergen = (allergen: string) => {
    setFormData(prev => ({
      ...prev,
      allergens: prev.allergens.includes(allergen)
        ? prev.allergens.filter(a => a !== allergen)
        : [...prev.allergens, allergen]
    }));
  };

  const removeExistingImage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      existingImages: prev.existingImages.filter((_, i) => i !== index)
    }));
  };

  const removeNewImage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50"
    >
      <div className="bg-white dark:bg-gray-800 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {item ? 'Edit Menu Item' : 'Add Menu Item'}
            </h2>
            <button
              onClick={onCancel}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Item Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  placeholder="e.g., Grilled Salmon"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Category *
                </label>
                <select
                  value={formData.categoryId}
                  onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  {categories.map(category => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                placeholder="Describe this menu item"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Price * ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Cost ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.cost}
                  onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Prep Time (min)
                </label>
                <input
                  type="number"
                  value={formData.preparationTime}
                  onChange={(e) => setFormData({ ...formData, preparationTime: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  placeholder="0"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Allergens
              </label>
              <div className="flex flex-wrap gap-2">
                {commonAllergens.map(allergen => (
                  <button
                    key={allergen}
                    type="button"
                    onClick={() => toggleAllergen(allergen)}
                    className={`px-3 py-1 rounded-full text-sm transition-colors ${
                      formData.allergens.includes(allergen)
                        ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {allergen}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Modifiers & Add-ons
              </label>
              {loadingModifiers ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500"></div>
                </div>
              ) : (
                <div className="space-y-3">
                  {modifierGroups.length === 0 ? (
                    <p className="text-gray-500 dark:text-gray-400 text-sm">
                      No modifier groups available. Create modifier groups in the settings to add customization options.
                    </p>
                  ) : (
                    modifierGroups.map(group => {
                      const isSelected = formData.modifierGroupIds.includes(group.id);
                      return (
                        <div
                          key={group.id}
                          className={`border rounded-lg p-4 transition-colors ${
                            isSelected
                              ? 'border-primary-300 bg-primary-50 dark:bg-primary-900/20 dark:border-primary-700'
                              : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                          }`}
                        >
                          <div className="flex items-start space-x-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                const newIds = e.target.checked
                                  ? [...formData.modifierGroupIds, group.id]
                                  : formData.modifierGroupIds.filter(id => id !== group.id);
                                setFormData({ ...formData, modifierGroupIds: newIds });
                              }}
                              className="mt-1 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                            />
                            <div className="flex-1">
                              <div className="flex items-center space-x-2">
                                <h4 className="font-medium text-gray-900 dark:text-gray-100">
                                  {group.name}
                                </h4>
                                {group.is_required && (
                                  <span className="text-xs bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 px-2 py-1 rounded-full">
                                    Required
                                  </span>
                                )}
                              </div>
                              {group.description && (
                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                  {group.description}
                                </p>
                              )}
                              <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
                                <span>
                                  {group.min_selections === group.max_selections
                                    ? `Select ${group.min_selections}`
                                    : `Select ${group.min_selections}-${group.max_selections}`}
                                </span>
                                <span>{group.options.length} options</span>
                              </div>
                              {isSelected && group.options.length > 0 && (
                                <div className="mt-3 p-3 bg-white dark:bg-gray-700 rounded border">
                                  <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Available Options:
                                  </p>
                                  <div className="space-y-1">
                                    {group.options.slice(0, 3).map(option => (
                                      <div key={option.id} className="flex items-center justify-between text-sm">
                                        <span className="text-gray-600 dark:text-gray-400">{option.name}</span>
                                        <span className="text-green-600 font-medium">
                                          {option.price_modifier > 0 ? `+$${option.price_modifier.toFixed(2)}` :
                                           option.price_modifier < 0 ? `-$${Math.abs(option.price_modifier).toFixed(2)}` :
                                           'Free'}
                                        </span>
                                      </div>
                                    ))}
                                    {group.options.length > 3 && (
                                      <p className="text-xs text-gray-500">
                                        +{group.options.length - 3} more options
                                      </p>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Images
              </label>
              
              {/* Existing Images */}
              {formData.existingImages.length > 0 && (
                <div className="mb-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Current images:</p>
                  <div className="flex flex-wrap gap-2">
                    {formData.existingImages.map((image, index) => (
                      <div key={index} className="relative">
                        <img
                          src={image}
                          alt=""
                          className="w-20 h-20 object-cover rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={() => removeExistingImage(index)}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* New Images */}
              {formData.images.length > 0 && (
                <div className="mb-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">New images:</p>
                  <div className="flex flex-wrap gap-2">
                    {formData.images.map((file, index) => (
                      <div key={index} className="relative">
                        <img
                          src={URL.createObjectURL(file)}
                          alt=""
                          className="w-20 h-20 object-cover rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={() => removeNewImage(index)}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Upload Area */}
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  isDragActive
                    ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                }`}
              >
                <input {...getInputProps()} />
                <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400">
                  {isDragActive
                    ? 'Drop images here...'
                    : 'Click or drag images here to upload (max 5 images)'}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
                  Supports: JPG, PNG, WebP
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-4 pt-6 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={onCancel}
                className="px-6 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors flex items-center space-x-2"
              >
                <Save className="h-4 w-4" />
                <span>{item ? 'Update' : 'Create'} Item</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </motion.div>
  );
};

const BulkMenuUpload = ({ onClose, onImportComplete }: {
  onClose: () => void;
  onImportComplete: () => void;
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [importHistory, setImportHistory] = useState<MenuImport[]>([]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv']
    },
    maxFiles: 1,
    onDrop: async (acceptedFiles) => {
      if (acceptedFiles[0]) {
        await handleFileUpload(acceptedFiles[0]);
      }
    }
  });

  const fetchImportHistory = useCallback(async () => {
    try {
      const response = await fetch('/api/menu/imports', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      if (data.success) {
        setImportHistory(data.data);
      }
    } catch (error) {
      console.error('Error fetching import history:', error);
    }
  }, []);

  useEffect(() => {
    fetchImportHistory();
  }, [fetchImportHistory]);

  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    setImportResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/menu/import', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });

      const data = await response.json();
      if (data.success) {
        setImportResult(data.data);
        toast.success(`Import completed: ${data.data.successCount} items added`);
        onImportComplete();
        fetchImportHistory();
      } else {
        toast.error(data.error?.message || 'Import failed');
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error('Failed to upload file');
    } finally {
      setIsUploading(false);
    }
  };

  const downloadTemplate = () => {
    const csvContent = `name,category,description,price,cost,preparation_time
"Grilled Chicken Sandwich","Sandwiches","Juicy grilled chicken breast with lettuce and tomato",12.99,5.50,15
"Caesar Salad","Salads","Fresh romaine lettuce with caesar dressing and croutons",9.99,3.25,5
"Margherita Pizza","Pizza","Classic pizza with tomato sauce, mozzarella, and basil",15.99,6.00,20`;

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'menu_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50"
    >
      <div className="bg-white dark:bg-gray-800 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Bulk Menu Import
            </h2>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="space-y-6">
            {/* Template Download */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-blue-900 dark:text-blue-100">
                    Need a template?
                  </h3>
                  <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                    Download our CSV template to get started with your menu import.
                  </p>
                </div>
                <button
                  onClick={downloadTemplate}
                  className="flex items-center space-x-2 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
                >
                  <Download className="h-4 w-4" />
                  <span>Download Template</span>
                </button>
              </div>
            </div>

            {/* File Upload */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
                Upload Menu File
              </h3>
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  isDragActive
                    ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                } ${isUploading ? 'pointer-events-none opacity-50' : ''}`}
              >
                <input {...getInputProps()} disabled={isUploading} />
                {isUploading ? (
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
                ) : (
                  <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                )}
                <p className="text-gray-600 dark:text-gray-400 mb-2">
                  {isDragActive
                    ? 'Drop your file here...'
                    : isUploading
                    ? 'Processing your file...'
                    : 'Click or drag your menu file here'}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-500">
                  Supports: Excel (.xlsx, .xls) and CSV (.csv) files
                </p>
              </div>
            </div>

            {/* Import Result */}
            {importResult && (
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-3">
                  Import Results
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                      {importResult.totalRows}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Total Rows</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {importResult.successCount}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Success</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">
                      {importResult.errorCount}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Errors</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {Math.round((importResult.successCount / importResult.totalRows) * 100)}%
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Success Rate</div>
                  </div>
                </div>

                {importResult.errors && importResult.errors.length > 0 && (
                  <div>
                    <h4 className="font-medium text-red-900 dark:text-red-100 mb-2">
                      Errors ({importResult.errors.length} shown)
                    </h4>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {importResult.errors.map((error: any, index: number) => (
                        <div key={index} className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-3">
                          <div className="text-sm font-medium text-red-800 dark:text-red-200">
                            Row {error.row}: {error.error}
                          </div>
                          {error.data && (
                            <div className="text-xs text-red-600 dark:text-red-400 mt-1">
                              Data: {JSON.stringify(error.data, null, 2)}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Import History */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
                Recent Imports
              </h3>
              <div className="space-y-3">
                {importHistory.length === 0 ? (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                    No imports yet
                  </p>
                ) : (
                  importHistory.slice(0, 5).map((imp) => (
                    <div key={imp.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <div className="flex items-center space-x-3">
                        {imp.file_type === 'excel' ? (
                          <FileSpreadsheet className="h-5 w-5 text-green-600" />
                        ) : (
                          <FileText className="h-5 w-5 text-blue-600" />
                        )}
                        <div>
                          <div className="font-medium text-gray-900 dark:text-gray-100">
                            {imp.filename}
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            {new Date(imp.created_at).toLocaleDateString()} at {new Date(imp.created_at).toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <div className="text-sm font-medium">
                            {imp.success_count}/{imp.total_rows} items
                          </div>
                          <div className={`text-xs ${
                            imp.status === 'completed' ? 'text-green-600' : 
                            imp.status === 'failed' ? 'text-red-600' : 'text-yellow-600'
                          }`}>
                            {imp.status}
                          </div>
                        </div>
                        {imp.status === 'completed' ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : imp.status === 'failed' ? (
                          <XCircle className="h-5 w-5 text-red-600" />
                        ) : (
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-yellow-600"></div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Instructions */}
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                File Format Requirements
              </h3>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <li>• <strong>Required columns:</strong> name, price, category</li>
                <li>• <strong>Optional columns:</strong> description, cost, preparation_time</li>
                <li>• Categories will be created automatically if they don't exist</li>
                <li>• Price should be in decimal format (e.g., 12.99)</li>
                <li>• Preparation time should be in minutes</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default function MenuManagement() {
  const { user } = useUser();
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [modifierGroups, setModifierGroups] = useState<ModifierGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<MenuCategory | null>(null);
  const [showItemForm, setShowItemForm] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showBulkUpload, setShowBulkUpload] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const fetchCategories = useCallback(async () => {
    try {
      const response = await fetch('/api/menu/categories/all', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      if (data.success) {
        setCategories(data.data);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
      toast.error('Failed to load categories');
    }
  }, []);

  const fetchMenuItems = useCallback(async () => {
    try {
      const response = await fetch('/api/menu/items/full', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      if (data.success) {
        // Flatten the categorized items structure
        const allItems: MenuItem[] = [];
        data.data.categories.forEach((cat: any) => {
          allItems.push(...cat.items);
        });
        setMenuItems(allItems);
      }
    } catch (error) {
      console.error('Error fetching menu items:', error);
      toast.error('Failed to load menu items');
    }
  }, []);

  const fetchModifierGroups = useCallback(async () => {
    try {
      const response = await fetch('/api/menu/modifier-groups', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      if (data.success) {
        // Fetch options for each group
        const groupsWithOptions = await Promise.all(
          data.data.map(async (group: any) => {
            const optionsResponse = await fetch(`/api/menu/modifier-groups/${group.id}/options`, {
              headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            const optionsData = await optionsResponse.json();
            return {
              ...group,
              options: optionsData.success ? optionsData.data : []
            };
          })
        );
        setModifierGroups(groupsWithOptions);
      }
    } catch (error) {
      console.error('Error fetching modifier groups:', error);
      toast.error('Failed to load modifier groups');
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchCategories(), fetchMenuItems(), fetchModifierGroups()]);
      setLoading(false);
    };
    loadData();
  }, [fetchCategories, fetchMenuItems, fetchModifierGroups]);

  const handleCategoryDragEnd = (event: any) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      setCategories((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        const newOrder = arrayMove(items, oldIndex, newIndex);
        
        // Update sort orders on the server
        newOrder.forEach(async (cat, index) => {
          try {
            await fetch(`/api/menu/categories/${cat.id}`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${localStorage.getItem('token')}`
              },
              body: JSON.stringify({ sortOrder: index })
            });
          } catch (error) {
            console.error('Error updating category order:', error);
          }
        });
        
        return newOrder;
      });
    }
  };

  const handleSaveCategory = async (formData: { 
    name: string; 
    description: string; 
    imageFile?: File; 
    imageAltText?: string; 
    removeImage?: boolean 
  }) => {
    try {
      const url = editingCategory ? `/api/menu/categories/${editingCategory.id}` : '/api/menu/categories';
      const method = editingCategory ? 'PUT' : 'POST';
      
      const submitData = new FormData();
      submitData.append('name', formData.name);
      submitData.append('description', formData.description);
      submitData.append('imageAltText', formData.imageAltText || '');
      submitData.append('sortOrder', (editingCategory?.sort_order || categories.length).toString());
      
      if (formData.removeImage) {
        submitData.append('removeImage', 'true');
      } else if (formData.imageFile) {
        submitData.append('image', formData.imageFile);
      }

      const response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: submitData
      });

      const data = await response.json();
      if (data.success) {
        toast.success(editingCategory ? 'Category updated' : 'Category created');
        await fetchCategories();
        setShowCategoryForm(false);
        setEditingCategory(null);
      } else {
        toast.error(data.error?.message || 'Failed to save category');
      }
    } catch (error) {
      console.error('Error saving category:', error);
      toast.error('Failed to save category');
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Are you sure you want to delete this category?')) return;

    try {
      const response = await fetch(`/api/menu/categories/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Category deleted');
        await fetchCategories();
      } else {
        toast.error(data.error?.message || 'Failed to delete category');
      }
    } catch (error) {
      console.error('Error deleting category:', error);
      toast.error('Failed to delete category');
    }
  };

  const handleToggleCategory = async (id: string, active: boolean) => {
    try {
      const response = await fetch(`/api/menu/categories/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ isActive: active })
      });

      const data = await response.json();
      if (data.success) {
        toast.success(active ? 'Category shown' : 'Category hidden');
        await fetchCategories();
      } else {
        toast.error(data.error?.message || 'Failed to update category');
      }
    } catch (error) {
      console.error('Error toggling category:', error);
      toast.error('Failed to update category');
    }
  };

  const handleSaveMenuItem = async (formData: MenuItemFormData) => {
    try {
      const url = editingItem ? `/api/menu/items/${editingItem.id}` : '/api/menu/items';
      const method = editingItem ? 'PUT' : 'POST';
      
      const submitData = new FormData();
      submitData.append('name', formData.name);
      submitData.append('description', formData.description);
      submitData.append('price', formData.price);
      submitData.append('cost', formData.cost);
      submitData.append('categoryId', formData.categoryId);
      submitData.append('preparationTime', formData.preparationTime);
      submitData.append('allergens', JSON.stringify(formData.allergens));
      submitData.append('existingImages', JSON.stringify(formData.existingImages));

      formData.images.forEach((image) => {
        submitData.append('images', image);
      });

      const response = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: submitData
      });

      const data = await response.json();
      if (data.success) {
        const itemId = editingItem?.id || data.data.id;
        
        // Update modifiers if any are selected
        if (formData.modifierGroupIds.length > 0 || editingItem) {
          await fetch(`/api/menu/items/${itemId}/modifiers`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ modifierGroupIds: formData.modifierGroupIds })
          });
        }

        toast.success(editingItem ? 'Item updated' : 'Item created');
        await fetchMenuItems();
        setShowItemForm(false);
        setEditingItem(null);
      } else {
        toast.error(data.error?.message || 'Failed to save item');
      }
    } catch (error) {
      console.error('Error saving menu item:', error);
      toast.error('Failed to save item');
    }
  };

  const handleToggleMenuItem = async (id: string, available: boolean) => {
    try {
      const response = await fetch(`/api/menu/items/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ isAvailable: available })
      });

      const data = await response.json();
      if (data.success) {
        toast.success(available ? 'Item made available' : 'Item made unavailable');
        await fetchMenuItems();
      } else {
        toast.error(data.error?.message || 'Failed to update item');
      }
    } catch (error) {
      console.error('Error toggling menu item:', error);
      toast.error('Failed to update item');
    }
  };

  const filteredItems = selectedCategory === 'all' 
    ? menuItems 
    : menuItems.filter(item => item.category_id === selectedCategory);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-96">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-500"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <>
      <Head>
        <title>Menu Management - Servio</title>
      </Head>

      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                Menu Management
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Manage your restaurant menu categories and items
              </p>
            </div>
          </div>

          {/* Categories Section */}
          <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Menu Categories
              </h2>
              <button
                onClick={() => setShowCategoryForm(true)}
                className="flex items-center space-x-2 bg-primary-500 text-white px-4 py-2 rounded-lg hover:bg-primary-600 transition-colors"
              >
                <Plus className="h-4 w-4" />
                <span>Add Category</span>
              </button>
            </div>

            <AnimatePresence>
              {showCategoryForm && (
                <div className="mb-6">
                  <CategoryForm
                    category={editingCategory || undefined}
                    onSave={handleSaveCategory}
                    onCancel={() => {
                      setShowCategoryForm(false);
                      setEditingCategory(null);
                    }}
                  />
                </div>
              )}
            </AnimatePresence>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleCategoryDragEnd}
            >
              <SortableContext items={categories} strategy={verticalListSortingStrategy}>
                <div className="space-y-3">
                  {categories.map((category) => (
                    <SortableCategory
                      key={category.id}
                      category={category}
                      onEdit={(cat) => {
                        setEditingCategory(cat);
                        setShowCategoryForm(true);
                      }}
                      onDelete={handleDeleteCategory}
                      onToggle={handleToggleCategory}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>

          {/* Menu Items Section */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  Menu Items
                </h2>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="all">All Categories</option>
                  {categories.map(category => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setShowBulkUpload(true)}
                  className="flex items-center space-x-2 bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors"
                >
                  <Upload className="h-4 w-4" />
                  <span>Bulk Import</span>
                </button>
                <button
                  onClick={() => setShowItemForm(true)}
                  className="flex items-center space-x-2 bg-primary-500 text-white px-4 py-2 rounded-lg hover:bg-primary-600 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Item</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredItems.map((item) => (
                <MenuItemCard
                  key={item.id}
                  item={item}
                  onEdit={(item) => {
                    setEditingItem(item);
                    setShowItemForm(true);
                  }}
                  onToggle={handleToggleMenuItem}
                />
              ))}
            </div>

            {filteredItems.length === 0 && (
              <div className="text-center py-12">
                <ImageIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">
                  {selectedCategory === 'all' 
                    ? 'No menu items yet. Add your first item!' 
                    : 'No items in this category yet.'}
                </p>
              </div>
            )}
          </div>

          {/* Menu Item Form Modal */}
          <AnimatePresence>
            {showItemForm && (
              <MenuItemForm
                item={editingItem || undefined}
                categories={categories}
                modifierGroups={modifierGroups}
                onSave={handleSaveMenuItem}
                onCancel={() => {
                  setShowItemForm(false);
                  setEditingItem(null);
                }}
              />
            )}
          </AnimatePresence>

          {/* Bulk Upload Modal */}
          <AnimatePresence>
            {showBulkUpload && (
              <BulkMenuUpload
                onClose={() => setShowBulkUpload(false)}
                onImportComplete={() => {
                  fetchCategories();
                  fetchMenuItems();
                }}
              />
            )}
          </AnimatePresence>
        </div>
      </DashboardLayout>
    </>
  );
}