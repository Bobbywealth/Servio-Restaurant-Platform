import React from 'react'
import { Search } from 'lucide-react'
import OrderListItem, { TabletOrderListItem } from './OrderListItem'

type FilterKey = 'all' | 'received' | 'preparing' | 'ready' | 'completed' | 'cancelled'

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'received', label: 'New' },
  { key: 'preparing', label: 'In Progress' },
  { key: 'ready', label: 'Ready' },
  { key: 'completed', label: 'Done' },
  { key: 'cancelled', label: 'Cancelled' }
]

function normalizeStatus(s: any) {
  return String(s || '').toLowerCase()
}

export default function OrdersListPanel({
  orders,
  selectedOrderId,
  onSelectOrderId,
  nowMs
}: {
  orders: TabletOrderListItem[]
  selectedOrderId: string | null
  onSelectOrderId: (id: string) => void
  nowMs: number
}) {
  const [filter, setFilter] = React.useState<FilterKey>('all')
  const [query, setQuery] = React.useState('')

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    return orders
      .filter((o) => {
        const s = normalizeStatus(o.status)
        if (filter !== 'all' && s !== filter) return false
        if (!q) return true
        const idLabel = String(o.externalId || o.id).toLowerCase()
        const name = String(o.customerName || '').toLowerCase()
        return idLabel.includes(q) || name.includes(q)
      })
      .sort((a, b) => {
        // Newest first by createdAt; fallback stable by id.
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0
        return tb - ta || String(a.id).localeCompare(String(b.id))
      })
  }, [orders, filter, query])

  const timeLabel = React.useCallback(
    (order: TabletOrderListItem) => {
      const createdMs = order.createdAt ? new Date(order.createdAt).getTime() : 0
      if (!createdMs) return '—'
      const mins = Math.max(0, Math.floor((nowMs - createdMs) / 60000))
      if (mins < 1) return 'Just now'
      if (mins < 60) return `${mins}m ago`
      const hrs = Math.floor(mins / 60)
      return `${hrs}h ago`
    },
    [nowMs]
  )

  return (
    <div className="bg-black/25 border border-white/10 rounded-2xl overflow-hidden">
      <div className="p-4 border-b border-white/10 bg-gray-950/40">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-white/60 text-[11px] font-semibold tracking-widest uppercase">Orders</div>
            <div className="text-white text-xl font-extrabold leading-tight">All Orders</div>
          </div>
          <div className="px-2.5 py-1.5 rounded-xl bg-white/5 border border-white/10 text-white/70 text-xs font-bold">
            {filtered.length}
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/35" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search customer or order #…"
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-3 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-teal-500/30"
            />
          </div>
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {FILTERS.map((f) => {
            const active = filter === f.key
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={[
                  'shrink-0 px-3 py-2 rounded-xl border text-sm font-extrabold transition-colors',
                  active ? 'bg-white text-gray-950 border-white' : 'bg-white/5 text-white/70 border-white/10 hover:bg-white/10'
                ].join(' ')}
              >
                {f.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="p-3 space-y-2 max-h-[calc(100vh-220px)] overflow-y-auto">
        {filtered.map((o) => (
          <OrderListItem
            key={o.id}
            order={o}
            selected={selectedOrderId === o.id}
            timeLabel={timeLabel(o)}
            onClick={() => onSelectOrderId(o.id)}
          />
        ))}

        {filtered.length === 0 && (
          <div className="p-6 text-center text-white/55">
            No orders match this filter.
          </div>
        )}
      </div>
    </div>
  )
}

