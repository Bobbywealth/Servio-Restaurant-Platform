import React, { useMemo } from 'react';
import clsx from 'clsx';
import { Lock, Plus, Trash2, GripVertical } from 'lucide-react';
import { DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export type ChoiceGroup = {
  id: string;
  name: string;
  description?: string | null;
  selectionType: 'single' | 'multiple' | 'quantity';
  minSelections: number;
  maxSelections: number | null;
  isRequired: boolean;
};

export type AttachedChoiceGroup = {
  groupId: string;
  name?: string;
  overrideMin?: number | null;
  overrideMax?: number | null;
  overrideRequired?: boolean | null;
  displayOrder?: number;
};

type Props = {
  availableGroups: ChoiceGroup[];
  inheritedGroups: ChoiceGroup[];
  attachedGroups: AttachedChoiceGroup[];
  onAddAttachedGroup: (groupId: string) => void;
  onRemoveAttachedGroup: (groupId: string) => void;
  onUpdateAttachedGroup: (groupId: string, patch: Partial<AttachedChoiceGroup>) => void;
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="text-xs font-black uppercase tracking-wide text-slate-500">{children}</div>;
}

export function ChoiceGroupAssignment({
  availableGroups,
  inheritedGroups,
  attachedGroups,
  onAddAttachedGroup,
  onRemoveAttachedGroup,
  onUpdateAttachedGroup
}: Props) {
  const inheritedIds = useMemo(() => new Set(inheritedGroups.map((g) => g.id)), [inheritedGroups]);
  const attachedIds = useMemo(() => new Set(attachedGroups.map((g) => g.groupId)), [attachedGroups]);

  const addable = useMemo(() => {
    return availableGroups
      .filter((g) => !attachedIds.has(g.id))
      .map((g) => ({ id: g.id, name: g.name }));
  }, [availableGroups, attachedIds]);

  const attachedWithDetails = useMemo(() => {
    const byId = new Map(availableGroups.map((g) => [g.id, g] as const));
    return attachedGroups
      .slice()
      .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
      .map((a) => {
        const g = byId.get(a.groupId);
        return { attachment: a, group: g };
      })
      .filter((x) => Boolean(x.group));
  }, [attachedGroups, availableGroups]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const attachedOrderIds = attachedWithDetails.map((x) => x.group!.id);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;
    const oldIndex = attachedOrderIds.indexOf(activeId);
    const newIndex = attachedOrderIds.indexOf(overId);
    if (oldIndex === -1 || newIndex === -1) return;
    const nextIds = arrayMove(attachedOrderIds, oldIndex, newIndex);
    nextIds.forEach((id, idx) => onUpdateAttachedGroup(id, { displayOrder: idx }));
  };

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <SectionTitle>Inherited from category</SectionTitle>
        <div className="mt-2 space-y-2">
          {inheritedGroups.length === 0 ? (
            <div className="text-sm text-slate-500">No category-level choice groups.</div>
          ) : (
            inheritedGroups.map((g) => (
              <div
                key={g.id}
                className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2"
              >
                <Lock className="h-4 w-4 text-slate-400" />
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-slate-900 truncate">{g.name}</div>
                  <div className="text-xs text-slate-500">
                    {g.isRequired ? 'Required' : 'Optional'} · {g.selectionType}
                    {g.maxSelections !== null ? ` · max ${g.maxSelections}` : ''}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <SectionTitle>Item-specific choice groups</SectionTitle>
          <div className="flex items-center gap-2">
            <select
              className="rounded-lg border border-slate-200 px-2 py-2 text-sm font-semibold"
              defaultValue=""
              onChange={(e) => {
                const id = e.target.value;
                if (!id) return;
                onAddAttachedGroup(id);
                e.currentTarget.value = '';
              }}
            >
              <option value="">Add group…</option>
              {addable.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
            <Plus className="h-4 w-4 text-slate-400" />
          </div>
        </div>

        <div className="mt-3 space-y-2">
          {attachedWithDetails.length === 0 ? (
            <div className="text-sm text-slate-500">No item-specific choice groups assigned.</div>
          ) : (
            <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
              <SortableContext items={attachedOrderIds} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {attachedWithDetails.map(({ attachment, group }) => (
                    <SortableAttachedGroupCard
                      key={group!.id}
                      group={group!}
                      attachment={attachment}
                      inherited={inheritedIds.has(group!.id)}
                      onRemove={() => onRemoveAttachedGroup(group!.id)}
                      onUpdate={(patch) => onUpdateAttachedGroup(group!.id, patch)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      </div>
    </div>
  );
}

function SortableAttachedGroupCard({
  group,
  attachment,
  inherited,
  onRemove,
  onUpdate
}: {
  group: ChoiceGroup;
  attachment: AttachedChoiceGroup;
  inherited: boolean;
  onRemove: () => void;
  onUpdate: (patch: Partial<AttachedChoiceGroup>) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: group.id });
  const style: React.CSSProperties = { transform: CSS.Transform.toString(transform), transition };

  const effectiveRequired =
    attachment.overrideRequired !== null && attachment.overrideRequired !== undefined
      ? Boolean(attachment.overrideRequired)
      : group.isRequired;
  const effectiveMin =
    attachment.overrideMin !== null && attachment.overrideMin !== undefined ? Number(attachment.overrideMin) : group.minSelections;
  const effectiveMax =
    attachment.overrideMax !== null && attachment.overrideMax !== undefined
      ? attachment.overrideMax === null
        ? null
        : Number(attachment.overrideMax)
      : group.maxSelections;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={clsx(
        'rounded-xl border px-3 py-3',
        inherited ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white',
        isDragging && 'opacity-70'
      )}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          className="mt-0.5 p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
          aria-label="Drag to reorder"
          title="Drag to reorder"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-5 w-5" />
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="font-black text-slate-900 truncate">{group.name}</div>
              <div className="text-xs text-slate-500">
                {group.selectionType} · default min {group.minSelections}
                {group.maxSelections !== null ? ` / max ${group.maxSelections}` : ''} · {group.isRequired ? 'Required' : 'Optional'}
                {inherited ? ' · overrides inherited group' : ''}
              </div>
            </div>

            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 px-2 py-1 text-sm font-bold"
              onClick={onRemove}
              title="Remove from item"
            >
              <Trash2 className="h-4 w-4" />
              Remove
            </button>
          </div>

          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <input type="checkbox" checked={effectiveRequired} onChange={(e) => onUpdate({ overrideRequired: e.target.checked })} />
              Required
            </label>

            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              Min
              <input
                type="number"
                min={0}
                className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-sm font-semibold"
                value={effectiveMin}
                onChange={(e) => onUpdate({ overrideMin: Number(e.target.value) })}
              />
            </label>

            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              Max
              <input
                type="number"
                min={0}
                className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-sm font-semibold"
                value={effectiveMax ?? ''}
                placeholder="∞"
                onChange={(e) => onUpdate({ overrideMax: e.target.value === '' ? null : Number(e.target.value) })}
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

