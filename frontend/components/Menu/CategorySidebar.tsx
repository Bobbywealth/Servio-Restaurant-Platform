import React, { useMemo } from 'react';
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import clsx from 'clsx';
import { Eye, EyeOff, GripVertical, Plus } from 'lucide-react';

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
};

function SortableCategoryRow({
  category,
  selected,
  onSelect,
  onToggleHidden
}: {
  category: CategorySidebarItem;
  selected: boolean;
  onSelect: () => void;
  onToggleHidden: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: category.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={clsx(
        'group flex items-center gap-2 rounded-xl border px-3 py-2 cursor-pointer select-none',
        selected ? 'border-teal-400 bg-teal-500/10' : 'border-gray-700 bg-gray-800/60 hover:bg-gray-800',
        isDragging && 'opacity-70'
      )}
      onClick={onSelect}
      role="button"
      tabIndex={0}
    >
      <button
        type="button"
        className="text-gray-400 hover:text-gray-200 active:text-gray-100"
        onClick={(e) => {
          e.stopPropagation();
        }}
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
        title="Drag to reorder"
      >
        <GripVertical className="h-5 w-5" />
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className={clsx('font-semibold truncate', category.is_hidden ? 'text-gray-400' : 'text-white')}>
              {category.name}
            </div>
            {typeof category.item_count === 'number' ? (
              <div className="text-xs text-gray-400">{category.item_count} items</div>
            ) : null}
          </div>

          <button
            type="button"
            className="shrink-0 text-gray-400 hover:text-gray-200"
            onClick={(e) => {
              e.stopPropagation();
              onToggleHidden();
            }}
            aria-label={category.is_hidden ? 'Show category' : 'Hide category'}
            title={category.is_hidden ? 'Hidden from menu (tap to show)' : 'Visible on menu (tap to hide)'}
          >
            {category.is_hidden ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>
      </div>
    </div>
  );
}

export function CategorySidebar({
  categories,
  selectedCategoryId,
  onSelectCategory,
  onAddCategory,
  onToggleHidden,
  onReorderCategories
}: Props) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

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
    <aside className="w-full md:w-80 shrink-0 bg-gray-900/60 border border-gray-800 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-bold tracking-wide text-gray-200 uppercase">Categories</div>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white px-3 py-2 text-sm font-bold"
          onClick={onAddCategory}
        >
          <Plus className="h-4 w-4" />
          Add
        </button>
      </div>

      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {ordered.map((c) => (
              <SortableCategoryRow
                key={c.id}
                category={c}
                selected={selectedCategoryId === c.id}
                onSelect={() => onSelectCategory(c.id)}
                onToggleHidden={() => onToggleHidden(c.id, !Boolean(c.is_hidden))}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </aside>
  );
}

