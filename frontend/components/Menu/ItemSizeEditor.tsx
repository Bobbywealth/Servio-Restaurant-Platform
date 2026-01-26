import React, { useMemo, useState } from 'react';
import clsx from 'clsx';
import { CheckCircle2, Plus, Trash2 } from 'lucide-react';

export type ItemSize = {
  id: string;
  sizeName: string;
  price: number;
  isPreselected: boolean;
  displayOrder: number;
};

type Props = {
  sizes: ItemSize[];
  onCreate: (input: { sizeName: string; price: number; isPreselected: boolean; displayOrder: number }) => Promise<void> | void;
  onUpdate: (sizeId: string, patch: Partial<{ sizeName: string; price: number; isPreselected: boolean; displayOrder: number }>) => Promise<void> | void;
  onDelete: (sizeId: string) => Promise<void> | void;
};

function formatMoney(v: number) {
  const n = Number.isFinite(v) ? v : 0;
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(n);
  } catch {
    return `$${n.toFixed(2)}`;
  }
}

export function ItemSizeEditor({ sizes, onCreate, onUpdate, onDelete }: Props) {
  const ordered = useMemo(() => {
    const copy = [...(sizes || [])];
    copy.sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
    return copy;
  }, [sizes]);

  const [draftName, setDraftName] = useState('');
  const [draftPrice, setDraftPrice] = useState<string>('');
  const [draftPre, setDraftPre] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const canAdd = draftName.trim().length > 0 && draftPrice.trim().length > 0 && Number.isFinite(Number(draftPrice));

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-black uppercase tracking-wide text-slate-600">Sizes</div>
        <div className="text-sm font-bold text-slate-500">
          {ordered.length > 0 ? `From ${formatMoney(Math.min(...ordered.map((s) => s.price)))}` : 'No sizes'}
        </div>
      </div>

      {ordered.length > 0 && (
        <div className="mt-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
          <p className="text-xs font-semibold text-amber-900">
            ⚠️ Size prices override the base price above. Enter the full final price customers will pay for each size (before modifiers).
          </p>
        </div>
      )}

      <div className="mt-3 space-y-2">
        {ordered.length > 0 && (
          <div className="flex gap-2 px-3 text-xs font-semibold text-slate-500">
            <div className="w-full sm:w-28">Size Name</div>
            <div className="w-full sm:w-28">Final Price</div>
          </div>
        )}
        {ordered.map((s) => (
          <div key={s.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
            <input
              className="w-full sm:w-28 rounded-lg border border-slate-200 px-2 py-1 text-sm font-semibold"
              value={s.sizeName}
              onChange={(e) => onUpdate(s.id, { sizeName: e.target.value })}
              placeholder="Medium"
              aria-label="Size name"
            />
            <input
              className="w-full sm:w-28 rounded-lg border border-slate-200 px-2 py-1 text-sm font-semibold"
              value={String(s.price)}
              onChange={(e) => {
                const v = e.target.value;
                const n = Number(v);
                if (v.trim() === '' || Number.isFinite(n)) onUpdate(s.id, { price: v.trim() === '' ? 0 : n });
              }}
              placeholder="25.00"
              inputMode="decimal"
              aria-label="Final price for this size"
              title="Final price customers pay for this size (before modifiers)"
            />

            <button
              type="button"
              className={clsx(
                'sm:ml-auto inline-flex items-center gap-2 rounded-lg px-2 py-1 text-sm font-bold',
                s.isPreselected ? 'bg-teal-100 text-teal-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              )}
              disabled={busy === s.id}
              onClick={async () => {
                try {
                  setBusy(s.id);
                  await onUpdate(s.id, { isPreselected: true });
                } finally {
                  setBusy(null);
                }
              }}
              title="Mark as default selected"
            >
              <CheckCircle2 className="h-4 w-4" />
              Default
            </button>

            <button
              type="button"
              className="inline-flex items-center justify-center rounded-lg bg-red-50 text-red-700 hover:bg-red-100 px-2 py-1"
              onClick={async () => {
                try {
                  setBusy(s.id);
                  await onDelete(s.id);
                } finally {
                  setBusy(null);
                }
              }}
              disabled={busy === s.id}
              title="Delete size"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-xl border border-dashed border-slate-300 p-3">
        <div className="text-xs font-semibold text-slate-600 mb-2">Add New Size</div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex-1 min-w-[120px]">
            <label className="text-xs text-slate-500 font-medium">Size Name</label>
            <input
              className="w-full rounded-lg border border-slate-200 px-2 py-1 text-sm font-semibold mt-1"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              placeholder="Small"
              maxLength={40}
            />
          </div>
          <div className="flex-1 min-w-[120px]">
            <label className="text-xs text-slate-500 font-medium">Final Price</label>
            <input
              className="w-full rounded-lg border border-slate-200 px-2 py-1 text-sm font-semibold mt-1"
              value={draftPrice}
              onChange={(e) => setDraftPrice(e.target.value)}
              placeholder="24.78"
              inputMode="decimal"
            />
          </div>
          <label className="sm:ml-auto flex items-center gap-2 text-sm font-semibold text-slate-600">
            <input
              type="checkbox"
              checked={draftPre}
              onChange={(e) => setDraftPre(e.target.checked)}
            />
            Default
          </label>
          <button
            type="button"
            disabled={!canAdd}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-black text-white px-3 py-2 text-sm font-black disabled:opacity-50"
            onClick={async () => {
              const price = Number(draftPrice);
              if (!draftName.trim() || !Number.isFinite(price)) return;
              await onCreate({
                sizeName: draftName.trim(),
                price,
                isPreselected: draftPre,
                displayOrder: ordered.length
              });
              setDraftName('');
              setDraftPrice('');
              setDraftPre(false);
            }}
          >
            <Plus className="h-4 w-4" />
            Add size
          </button>
        </div>
      </div>
    </div>
  );
}
