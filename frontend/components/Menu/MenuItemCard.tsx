/**
 * MenuItemCard Component
 * Optimized, memoized component for displaying a menu item in the management grid
 */

import React, { memo, useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import {
  Edit3,
  Trash2,
  Eye,
  EyeOff,
  MoreVertical,
  GripVertical,
  Copy,
  Star,
  Clock,
  DollarSign,
  CheckSquare,
  Square
} from 'lucide-react';
import type { MenuItem } from '../../hooks/useMenuData';

export interface MenuItemCardProps {
  item: MenuItem;
  isSelected: boolean;
  isEditing: boolean;
  isDragging?: boolean;
  dragHandleProps?: any;
  onSelect: (id: string, index: number, isShiftKey: boolean) => void;
  onEdit: (item: MenuItem) => void;
  onDelete: (id: string) => void;
  onDuplicate?: (id: string) => void;
  onToggleAvailability: (id: string, isAvailable: boolean) => void;
  onToggleFeatured?: (id: string, isFeatured: boolean) => void;
  formatMoney: (price: number) => string;
  getModifierSummary: (item: MenuItem) => string;
  index: number;
  isCollaboratorEditing?: boolean;
  collaboratorName?: string;
}

// Memo comparison function
const arePropsEqual = (prevProps: MenuItemCardProps, nextProps: MenuItemCardProps) => {
  return (
    prevProps.item.id === nextProps.item.id &&
    prevProps.item.name === nextProps.item.name &&
    prevProps.item.price === nextProps.item.price &&
    prevProps.item.is_available === nextProps.item.is_available &&
    prevProps.item.is_featured === nextProps.item.is_featured &&
    prevProps.item.image === nextProps.item.image &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.isEditing === nextProps.isEditing &&
    prevProps.isDragging === nextProps.isDragging &&
    prevProps.index === nextProps.index &&
    prevProps.isCollaboratorEditing === nextProps.isCollaboratorEditing
  );
};

const MenuItemCard: React.FC<MenuItemCardProps> = memo(({
  item,
  isSelected,
  isEditing,
  isDragging = false,
  dragHandleProps,
  onSelect,
  onEdit,
  onDelete,
  onDuplicate,
  onToggleAvailability,
  onToggleFeatured,
  formatMoney,
  getModifierSummary,
  index,
  isCollaboratorEditing = false,
  collaboratorName
}) => {
  const [showMenu, setShowMenu] = useState(false);

  // Handle selection with keyboard support
  const handleSelect = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(item.id, index, e.shiftKey);
  }, [item.id, index, onSelect]);

  // Handle edit click
  const handleEdit = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit(item);
  }, [item, onEdit]);

  // Handle delete click
  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(item.id);
  }, [item.id, onDelete]);

  // Handle availability toggle
  const handleToggleAvailability = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleAvailability(item.id, !item.is_available);
  }, [item.id, item.is_available, onToggleAvailability]);

  // Handle featured toggle
  const handleToggleFeatured = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleFeatured?.(item.id, !item.is_featured);
  }, [item.id, item.is_featured, onToggleFeatured]);

  // Handle duplicate
  const handleDuplicate = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onDuplicate?.(item.id);
  }, [item.id, onDuplicate]);

  // Get display price (from price or sizes)
  const displayPrice = item.sizes && item.sizes.length > 0
    ? `From ${formatMoney(item.fromPrice || item.price)}`
    : formatMoney(item.price);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ 
        opacity: isDragging ? 0.5 : 1, 
        y: 0,
        scale: isDragging ? 1.02 : 1
      }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ scale: isDragging ? 1.02 : 1.01 }}
      transition={{ duration: 0.2 }}
      className={clsx(
        'group relative bg-white dark:bg-surface-800 rounded-xl border-2 transition-all duration-200',
        isSelected 
          ? 'border-primary-500 ring-2 ring-primary-500/20' 
          : 'border-transparent hover:border-gray-200 dark:hover:border-surface-600',
        isEditing && 'border-primary-500 bg-primary-50/50 dark:bg-primary-900/10',
        !item.is_available && 'opacity-60',
        isCollaboratorEditing && 'border-amber-400 bg-amber-50/50 dark:bg-amber-900/10'
      )}
    >
      {/* Selection Checkbox */}
      <button
        onClick={handleSelect}
        className="absolute top-3 left-3 z-10 p-1 rounded-md bg-white/80 dark:bg-surface-700/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity"
        aria-label={isSelected ? 'Deselect item' : 'Select item'}
      >
        {isSelected ? (
          <CheckSquare className="w-5 h-5 text-primary-500" />
        ) : (
          <Square className="w-5 h-5 text-gray-400" />
        )}
      </button>

      {/* Drag Handle */}
      {dragHandleProps && (
        <div
          {...dragHandleProps}
          className="absolute top-3 right-3 z-10 p-1 rounded-md bg-white/80 dark:bg-surface-700/80 backdrop-blur-sm cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <GripVertical className="w-5 h-5 text-gray-400" />
        </div>
      )}

      {/* Collaborator Editing Indicator */}
      {isCollaboratorEditing && (
        <div className="absolute top-3 right-12 z-10 px-2 py-1 rounded-md bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 text-xs font-medium">
          {collaboratorName} editing
        </div>
      )}

      {/* Card Content */}
      <div className="p-4 cursor-pointer" onClick={handleEdit}>
        {/* Image */}
        {item.image ? (
          <div className="relative w-full aspect-video rounded-lg overflow-hidden mb-3 bg-gray-100 dark:bg-surface-700">
            <img
              src={item.image}
              alt={item.name}
              className="w-full h-full object-cover"
              loading="lazy"
            />
            {!item.is_available && (
              <div className="absolute inset-0 bg-gray-900/50 flex items-center justify-center">
                <EyeOff className="w-8 h-8 text-white" />
              </div>
            )}
          </div>
        ) : (
          <div className={clsx(
            'w-full aspect-video rounded-lg mb-3 flex items-center justify-center',
            'bg-gray-100 dark:bg-surface-700'
          )}>
            <DollarSign className="w-10 h-10 text-gray-300 dark:text-surface-600" />
          </div>
        )}

        {/* Item Info */}
        <div className="space-y-2">
          {/* Name and Featured */}
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-surface-900 dark:text-surface-100 line-clamp-1">
              {item.name}
            </h3>
            {item.is_featured && (
              <Star className="w-4 h-4 text-amber-500 fill-amber-500 flex-shrink-0" />
            )}
          </div>

          {/* Description */}
          {item.description && (
            <p className="text-sm text-surface-500 dark:text-surface-400 line-clamp-2">
              {item.description}
            </p>
          )}

          {/* Price */}
          <p className="text-lg font-bold text-primary-600 dark:text-primary-400">
            {displayPrice}
          </p>

          {/* Meta Info */}
          <div className="flex items-center gap-3 text-xs text-surface-500 dark:text-surface-400">
            {/* Preparation Time */}
            {item.preparation_time && (
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {item.preparation_time} min
              </span>
            )}
            
            {/* Sizes */}
            {item.sizes && item.sizes.length > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-surface-700">
                {item.sizes.length} sizes
              </span>
            )}
            
            {/* Modifiers */}
            <span>{getModifierSummary(item)}</span>
          </div>

          {/* Dietary Info */}
          {item.dietary_info && item.dietary_info.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {item.dietary_info.map((info, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                >
                  {info}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="absolute bottom-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {/* Availability Toggle */}
        <button
          onClick={handleToggleAvailability}
          className={clsx(
            'p-2 rounded-lg transition-colors',
            item.is_available
              ? 'bg-green-100 text-green-600 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-surface-700 dark:text-surface-400'
          )}
          title={item.is_available ? 'Mark as unavailable' : 'Mark as available'}
        >
          {item.is_available ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
        </button>

        {/* Featured Toggle */}
        {onToggleFeatured && (
          <button
            onClick={handleToggleFeatured}
            className={clsx(
              'p-2 rounded-lg transition-colors',
              item.is_featured
                ? 'bg-amber-100 text-amber-600 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-surface-700 dark:text-surface-400'
            )}
            title={item.is_featured ? 'Remove from featured' : 'Mark as featured'}
          >
            <Star className={clsx('w-4 h-4', item.is_featured && 'fill-current')} />
          </button>
        )}

        {/* More Options Menu */}
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="p-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-surface-700 dark:text-surface-400 transition-colors"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {showMenu && (
            <div className="absolute bottom-full right-0 mb-1 w-40 bg-white dark:bg-surface-800 rounded-lg shadow-lg border border-gray-200 dark:border-surface-600 py-1 z-20">
              <button
                onClick={handleEdit}
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-surface-700 flex items-center gap-2"
              >
                <Edit3 className="w-4 h-4" />
                Edit
              </button>
              {onDuplicate && (
                <button
                  onClick={handleDuplicate}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-surface-700 flex items-center gap-2"
                >
                  <Copy className="w-4 h-4" />
                  Duplicate
                </button>
              )}
              <button
                onClick={handleDelete}
                className="w-full px-3 py-2 text-left text-sm hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}, arePropsEqual);

MenuItemCard.displayName = 'MenuItemCard';

export default MenuItemCard;
