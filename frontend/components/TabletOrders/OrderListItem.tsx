import React from 'react'
import { Clock } from 'lucide-react'

export type TabletOrderListItem = {
  id: string
  externalId?: string | null
  status?: string | null
  customerName?: string | null
  createdAt?: string | null
  prepTimeMinutes?: number | null
  orderItems?: { name?: string | null; quantity?: number | null }[] | null
  items?: any[] | null
}

function statusStyles(status: string) {
  const s = String(status || '').toLowerCase()
  if (s === 'ready') return 'bg-emerald-500/15 text-emerald-100 border-emerald-500/25'
  if (s === 'completed') return 'bg-sky-500/15 text-sky-100 border-sky-500/25'
  if (s === 'preparing') return 'bg-amber-500/15 text-amber-100 border-amber-500/25'
  if (s === 'received') return 'bg-orange-500/15 text-orange-100 border-orange-500/25'
  if (s === 'cancelled') return 'bg-red-500/15 text-red-100 border-red-500/25'
  if (s === 'scheduled') return 'bg-purple-500/15 text-purple-100 border-purple-500/25'
  return 'bg-white/10 text-white/70 border-white/10'
}

export default function OrderListItem({
  order,
  selected,
  timeLabel,
  onClick
}: {
  order: TabletOrderListItem
  selected: boolean
  timeLabel?: string
  onClick: () => void
}) {
  const idLabel = order.externalId || order.id
  const status = String(order.status || '')

  const itemCount = Array.isArray(order.orderItems)
    ? order.orderItems.length
    : Array.isArray(order.items)
      ? order.items.length
      : 0

  const created = order.createdAt ? new Date(order.createdAt) : null

  return (
    <button
      onClick={onClick}
      className={[
        'w-full text-left rounded-2xl border transition-colors',
        'px-4 py-3',
        selected
          ? 'bg-white/10 border-teal-400/40 ring-2 ring-teal-500/20'
          : 'bg-white/5 hover:bg-white/7 border-white/10'
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-white font-extrabold truncate">{order.customerName || 'Guest'}</div>
          <div className="mt-1 text-xs text-white/55 flex items-center gap-2">
            <Clock className="w-3.5 h-3.5" />
            <span className="truncate">
              {timeLabel || (created ? created.toLocaleTimeString() : '—')}
            </span>
            <span className="text-white/35">•</span>
            <span className="truncate">{idLabel}</span>
          </div>
        </div>

        <div className="shrink-0 flex flex-col items-end gap-2">
          <div className={['px-2.5 py-1 rounded-full border text-[11px] font-extrabold', statusStyles(status)].join(' ')}>
            {status || '—'}
          </div>
          <div className="text-[11px] text-white/55 font-semibold">{itemCount} item{itemCount === 1 ? '' : 's'}</div>
        </div>
      </div>
    </button>
  )
}

