/**
 * Custom hooks index file
 * Export all custom hooks for menu management
 */

export { useMenuData } from './useMenuData';
export type {
  MenuCategory,
  MenuItem,
  CategoryWithItems,
  ModifierGroupResponse,
  ModifierOptionResponse,
  UseMenuDataOptions,
  UseMenuDataReturn
} from './useMenuData';

export { useModifierGroups } from './useModifierGroups';
export type {
  ModifierGroup,
  ModifierOption,
  CreateModifierGroupData,
  CreateModifierOptionData,
  UpdateModifierGroupData,
  UpdateModifierOptionData,
  UseModifierGroupsOptions,
  UseModifierGroupsReturn
} from './useModifierGroups';

export { useItemEditor } from './useItemEditor';
export type {
  MenuItem as EditorMenuItem,
  AttachedGroup,
  EditItemState,
  NewItemState,
  UseItemEditorOptions,
  UseItemEditorReturn
} from './useItemEditor';

export { useMenuHistory } from './useMenuHistory';
export type {
  HistoryEntry,
  UseMenuHistoryOptions,
  UseMenuHistoryReturn
} from './useMenuHistory';

export { useBulkOperations } from './useBulkOperations';
export type {
  BulkSelectionState,
  BulkOperationResult,
  BulkOperation,
  UseBulkOperationsOptions,
  UseBulkOperationsReturn
} from './useBulkOperations';
