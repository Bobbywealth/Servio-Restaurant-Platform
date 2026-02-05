import React, { useMemo } from 'react';
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import clsx from 'clsx';
import { Eye, EyeOff, GripVertical, Plus, Trash2, AlertTriangle } from 'lucide-react';

export type CategorySidebarItem = {
  id: string;
  name: string;
  description?: string | null;
  sort_order?: number;
  is_active?: boolean;
  is_hidden?: boolean;
  item_count?: number;
};

type Props = {
  categories: CategorySidebarItem[];
  selectedCategoryId: string | null;
  onSelectCategory: (categoryId: string) => void;
  onAddCategory: () => void;
  onToggleHidden: (categoryId: string, nextHidden: boolean) => void;
  onReorderCategories: (nextOrderedIds: string[]) => void;
  onDeleteCategory: (categoryId: string) => void;
};

function SortableCategoryRow({
  category,
  selected,
  onSelect,
  onToggleHidden,
  onDelete
}: {
  category: CategorySidebarItem;
  selected: boolean;
  onSelect: () => void;
  onToggleHidden: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: category.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition
  };

  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (showDeleteConfirm) {
      onDelete();
      setShowDeleteConfirm(false);
    } else {
      setShowDeleteConfirm(true);
      // Auto-hide confirmation after 3 seconds
      setTimeout(() => setShowDeleteConfirm(false), 3000);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={clsx(
        'group relative flex items-center gap-2 sm:gap-3 rounded-xl border px-3 sm:px-4 py-3 sm:py-2.5 cursor-pointer select-none touch-manipulation',
        selected
          ? 'border-servio-red-400 bg-servio-red-50 dark:border-servio-red-500 dark:bg-servio-red-900/20'
          : 'border-surface-200 bg-white hover:bg-surface-50 dark:border-surface-700 dark:bg-surface-800 dark:hover:bg-surface-700',
        isDragging && 'opacity-70'
      )}
      onClick={onSelect}
      role="button"
      tabIndex={0}
    >
      <button
        type="button"
        className="shrink-0 text-surface-400 hover:text-surface-600 active:text-surface-700 dark:text-surface-500 dark:hover:text-surface-300 dark:active:text-surface-200 touch-manipulation p-1 -ml-1"
        onClick={(e) => {
          e.stopPropagation();
        }}
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
        title="Drag to reorder"
      >
        <GripVertical className="h-6 w-6 sm:h-5 sm:w-5" />
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className={clsx('font-semibold truncate text-base sm:text-sm', category.is_hidden ? 'text-surface-400 dark:text-surface-500' : 'text-surface-900 dark:text-white')}>
              {category.name}
            </div>
            {typeof category.item_count === 'number' ? (
              <div className="text-sm sm:text-xs text-surface-500 dark:text-surface-400">{category.item_count} items</div>
            ) : null}
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              className="shrink-0 text-surface-400 hover:text-surface-600 dark:text-surface-500 dark:hover:text-surface-300 touch-manipulation p-2 -mr-2"
              onClick={(e) => {
                e.stopPropagation();
                onToggleHidden();
              }}
              aria-label={category.is_hidden ? 'Show category' : 'Hide category'}
              title={category.is_hidden ? 'Hidden from menu (tap to show)' : 'Visible on menu (tap to hide)'}
            >
              {category.is_hidden ? <EyeOff className="h-6 w-6 sm:h-5 sm:w-5" /> : <Eye className="h-6 w-6 sm:h-5 sm:w-5" />}
            </button>

            <button
              type="button"
              className={clsx(
                'shrink-0 transition-colors touch-manipulation p-2 -mr-2',
                showDeleteConfirm
                  ? 'text-red-500 animate-pulse'
                  : 'text-surface-400 hover:text-red-500 dark:text-surface-500 dark:hover:text-red-400'
              )}
              onClick={handleDelete}
              aria-label="Delete category"
              title={showDeleteConfirm ? 'Tap again to confirm delete' : 'Delete category'}
            >
              {showDeleteConfirm ? <AlertTriangle className="h-6 w-6 sm:h-5 sm:w-5" /> : <Trash2 className="h-6 w-6 sm:h-5 sm:w-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Delete confirmation tooltip */}
      {showDeleteConfirm && (
        <div className="absolute right-2 top-2 z-10 bg-red-500/90 text-white text-xs px-2 py-1 rounded">
          Tap to confirm
        </div>
      )}
    </div>
  );
}

export function CategorySidebar({
  categories,
  selectedCategoryId,
  onSelectCategory,
  onAddCategory,
  onToggleHidden,
  onReorderCategories,
  onDeleteCategory
}: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8 // Slightly larger for touch
      }
    })
  );

  const ordered = useMemo(() => {
    // Preserve incoming order, but stable sort by sort_order when present.
    const withOrder = categories.map((c, idx) => ({ c, idx }));
    withOrder.sort((a, b) => {
      const ao = typeof a.c.sort_order === 'number' ? a.c.sort_order : null;
      const bo = typeof b.c.sort_order === 'number' ? b.c.sort_order : null;
      if (ao === null && bo === null) return a.idx - b.idx;
      if (ao === null) return 1;
      if (bo === null) return -1;
      return ao - bo;
    });
    return withOrder.map((x) => x.c);
  }, [categories]);

  const ids = ordered.map((c) => c.id);

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    if (active.id === over.id) return;
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    const next = arrayMove(ids, oldIndex, newIndex);
    onReorderCategories(next);
  };

  return (
    <aside className="w-full md:w-56 lg:w-60 xl:w-72 shrink-0 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-2xl p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="text-base sm:text-sm font-bold tracking-wide text-surface-700 dark:text-surface-200 uppercase">Categories</div>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-xl bg-servio-red-600 hover:bg-servio-red-700 active:bg-servio-red-800 text-white px-4 py-2.5 sm:px-3 sm:py-2 text-sm sm:text-sm font-bold touch-manipulation min-h-[44px]"
          onClick={onAddCategory}
        >
          <Plus className="h-5 w-5 sm:h-4 sm:w-4" />
          <span className="hidden sm:inline">Add</span>
        </button>
      </div>

      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <div className="space-y-2 max-h-[calc(100vh-200px)] sm:max-h-[50vh] md:max-h-[60vh] lg:max-h-[70vh] overflow-y-auto scrollbar-thin scrollbar-thumb-surface-300 dark:scrollbar-thumb-surface-600 scrollbar-track-transparent">
            {ordered.map((c) => (
              <SortableCategoryRow
                key={c.id}
                category={c}
                selected={selectedCategoryId === c.id}
                onSelect={() => onSelectCategory(c.id)}
                onToggleHidden={() => onToggleHidden(c.id, !Boolean(c.is_hidden))}
                onDelete={() => onDeleteCategory(c.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </aside>
  );
}
