import { useState, useCallback } from 'react';
import { api } from '../lib/api';
import toast from 'react-hot-toast';

/**
 * Types for bulk operations
 */
export interface BulkSelectionState {
  selectedIds: Set<string>;
  isAllSelected: boolean;
  lastSelectedIndex: number | null;
}

export interface BulkOperationResult {
  success: number;
  failed: number;
  errors: Array<{ id: string; error: string }>;
}

export type BulkOperation = 
  | 'delete'
  | 'toggleAvailability'
  | 'changeCategory'
  | 'duplicate'
  | 'export'
  | 'setFeatured'
  | 'removeFeatured';

export interface UseBulkOperationsOptions {
  onOperationComplete?: (operation: BulkOperation, result: BulkOperationResult) => void;
  onSelectionChange?: (selectedIds: Set<string>) => void;
}

export interface UseBulkOperationsReturn {
  // Selection state
  selectedIds: Set<string>;
  isAllSelected: boolean;
  selectionCount: number;
  
  // Selection actions
  toggleSelect: (id: string, index?: number, isShiftKey?: boolean, allIds?: string[]) => void;
  toggleSelectAll: (allIds: string[]) => void;
  clearSelection: () => void;
  selectMultiple: (ids: string[]) => void;
  
  // Bulk operations
  executeBulkOperation: (
    operation: BulkOperation,
    options?: Record<string, any>
  ) => Promise<BulkOperationResult>;
  
  // Loading states
  isProcessing: boolean;
  currentOperation: BulkOperation | null;
}

/**
 * Custom hook for managing bulk selection and operations on menu items
 */
export function useBulkOperations(options: UseBulkOperationsOptions = {}): UseBulkOperationsReturn {
  const { onOperationComplete, onSelectionChange } = options;

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isAllSelected, setIsAllSelected] = useState(false);
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentOperation, setCurrentOperation] = useState<BulkOperation | null>(null);

  /**
   * Toggle selection for a single item
   */
  const toggleSelect = useCallback((
    id: string,
    index?: number,
    isShiftKey?: boolean,
    allIds?: string[]
  ) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      
      // Shift+click for range selection
      if (isShiftKey && lastSelectedIndex !== null && index !== undefined && allIds) {
        const start = Math.min(lastSelectedIndex, index);
        const end = Math.max(lastSelectedIndex, index);
        
        for (let i = start; i <= end; i++) {
          if (allIds[i]) {
            newSet.add(allIds[i]);
          }
        }
      } else {
        // Normal toggle
        if (newSet.has(id)) {
          newSet.delete(id);
        } else {
          newSet.add(id);
        }
      }
      
      onSelectionChange?.(newSet);
      return newSet;
    });
    
    if (index !== undefined && !isShiftKey) {
      setLastSelectedIndex(index);
    }
  }, [lastSelectedIndex, onSelectionChange]);

  /**
   * Toggle select all items
   */
  const toggleSelectAll = useCallback((allIds: string[]) => {
    setSelectedIds(prev => {
      if (prev.size === allIds.length) {
        // Deselect all
        setIsAllSelected(false);
        onSelectionChange?.(new Set());
        return new Set();
      } else {
        // Select all
        setIsAllSelected(true);
        const newSet = new Set(allIds);
        onSelectionChange?.(newSet);
        return newSet;
      }
    });
  }, [onSelectionChange]);

  /**
   * Clear all selections
   */
  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setIsAllSelected(false);
    setLastSelectedIndex(null);
    onSelectionChange?.(new Set());
  }, [onSelectionChange]);

  /**
   * Select multiple specific items
   */
  const selectMultiple = useCallback((ids: string[]) => {
    const newSet = new Set(ids);
    setSelectedIds(newSet);
    onSelectionChange?.(newSet);
  }, [onSelectionChange]);

  /**
   * Execute a bulk operation
   */
  const executeBulkOperation = useCallback(async (
    operation: BulkOperation,
    operationOptions?: Record<string, any>
  ): Promise<BulkOperationResult> => {
    const ids = Array.from(selectedIds);
    
    if (ids.length === 0) {
      toast.error('No items selected');
      return { success: 0, failed: 0, errors: [] };
    }

    setIsProcessing(true);
    setCurrentOperation(operation);

    const result: BulkOperationResult = {
      success: 0,
      failed: 0,
      errors: []
    };

    try {
      switch (operation) {
        case 'delete':
          await executeBulkDelete(ids, result);
          break;
        
        case 'toggleAvailability':
          await executeBulkToggleAvailability(ids, result, operationOptions?.available);
          break;
        
        case 'changeCategory':
          await executeBulkChangeCategory(ids, result, operationOptions?.categoryId);
          break;
        
        case 'duplicate':
          await executeBulkDuplicate(ids, result);
          break;
        
        case 'setFeatured':
          await executeBulkSetFeatured(ids, result, true);
          break;
        
        case 'removeFeatured':
          await executeBulkSetFeatured(ids, result, false);
          break;
        
        case 'export':
          await executeBulkExport(ids, result);
          break;
        
        default:
          throw new Error(`Unknown operation: ${operation}`);
      }

      // Show summary toast
      if (result.success > 0) {
        toast.success(`${result.success} item${result.success === 1 ? '' : 's'} processed successfully`);
      }
      if (result.failed > 0) {
        toast.error(`${result.failed} item${result.failed === 1 ? '' : 's'} failed`);
      }

      onOperationComplete?.(operation, result);
      
      // Clear selection after successful operation
      if (result.success > 0 && operation !== 'export') {
        clearSelection();
      }
    } catch (err) {
      console.error('Bulk operation error:', err);
      toast.error('Bulk operation failed');
    } finally {
      setIsProcessing(false);
      setCurrentOperation(null);
    }

    return result;
  }, [selectedIds, clearSelection, onOperationComplete]);

  /**
   * Bulk delete items
   */
  const executeBulkDelete = async (
    ids: string[],
    result: BulkOperationResult
  ): Promise<void> => {
    const response = await api.post('/api/menu/items/bulk/delete', { itemIds: ids });
    const data = response.data;
    
    if (data.success) {
      result.success = ids.length;
    } else {
      result.failed = ids.length;
      result.errors = ids.map(id => ({ id, error: data.error || 'Delete failed' }));
    }
  };

  /**
   * Bulk toggle availability
   */
  const executeBulkToggleAvailability = async (
    ids: string[],
    result: BulkOperationResult,
    available?: boolean
  ): Promise<void> => {
    const response = await api.post('/api/menu/items/bulk/availability', {
      itemIds: ids,
      isAvailable: available
    });
    const data = response.data;
    
    if (data.success) {
      result.success = ids.length;
    } else {
      result.failed = ids.length;
      result.errors = ids.map(id => ({ id, error: data.error || 'Update failed' }));
    }
  };

  /**
   * Bulk change category
   */
  const executeBulkChangeCategory = async (
    ids: string[],
    result: BulkOperationResult,
    categoryId?: string
  ): Promise<void> => {
    if (!categoryId) {
      result.failed = ids.length;
      result.errors = ids.map(id => ({ id, error: 'No category specified' }));
      return;
    }

    const response = await api.post('/api/menu/items/bulk/category', {
      itemIds: ids,
      categoryId
    });
    const data = response.data;
    
    if (data.success) {
      result.success = ids.length;
    } else {
      result.failed = ids.length;
      result.errors = ids.map(id => ({ id, error: data.error || 'Category change failed' }));
    }
  };

  /**
   * Bulk duplicate items
   */
  const executeBulkDuplicate = async (
    ids: string[],
    result: BulkOperationResult
  ): Promise<void> => {
    const response = await api.post('/api/menu/items/bulk/duplicate', { itemIds: ids });
    const data = response.data;
    
    if (data.success) {
      result.success = ids.length;
    } else {
      result.failed = ids.length;
      result.errors = ids.map(id => ({ id, error: data.error || 'Duplicate failed' }));
    }
  };

  /**
   * Bulk set featured status
   */
  const executeBulkSetFeatured = async (
    ids: string[],
    result: BulkOperationResult,
    featured: boolean
  ): Promise<void> => {
    const response = await api.post('/api/menu/items/bulk/featured', {
      itemIds: ids,
      isFeatured: featured
    });
    const data = response.data;
    
    if (data.success) {
      result.success = ids.length;
    } else {
      result.failed = ids.length;
      result.errors = ids.map(id => ({ id, error: data.error || 'Featured update failed' }));
    }
  };

  /**
   * Bulk export items
   */
  const executeBulkExport = async (
    ids: string[],
    result: BulkOperationResult
  ): Promise<void> => {
    const response = await api.post('/api/menu/items/bulk/export', 
      { itemIds: ids },
      { responseType: 'blob' }
    );
    
    // Download the file
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `menu-items-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    
    result.success = ids.length;
  };

  return {
    // Selection state
    selectedIds,
    isAllSelected,
    selectionCount: selectedIds.size,
    
    // Selection actions
    toggleSelect,
    toggleSelectAll,
    clearSelection,
    selectMultiple,
    
    // Bulk operations
    executeBulkOperation,
    
    // Loading states
    isProcessing,
    currentOperation
  };
}

export default useBulkOperations;
