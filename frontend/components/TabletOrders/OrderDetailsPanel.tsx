import React from 'react'
import { ExternalLink, MapPin, Phone, User, CreditCard, Package, Printer, CheckCircle2, Timer, Truck, XCircle } from 'lucide-react'

export type TabletOrderDetails = {
  id: string
  externalId?: string | null
  channel?: string | null
  status?: string | null
  customerName?: string | null
  customerPhone?: string | null
  totalAmount?: number | null
  paymentStatus?: string | null
  createdAt?: string | null
  prepTimeMinutes?: number | null
  acceptedAt?: string | null
  orderItems?: any[] | null
}

function formatMoney(value: any) {
  const n = typeof value === 'number' ? value : Number(value ?? 0)
  return `$${n.toFixed(2)}`
}

function statusPill(status: string) {
  const s = String(status || '').toLowerCase()
  if (s === 'ready') return 'bg-emerald-500/20 text-emerald-200 border-emerald-500/30'
  if (s === 'completed') return 'bg-sky-500/20 text-sky-200 border-sky-500/30'
  if (s === 'preparing') return 'bg-amber-500/20 text-amber-200 border-amber-500/30'
  if (s === 'received') return 'bg-orange-500/20 text-orange-200 border-orange-500/30'
  if (s === 'cancelled') return 'bg-red-500/20 text-red-200 border-red-500/30'
  return 'bg-white/10 text-white/80 border-white/10'
}

export default function OrderDetailsPanel({
  order,
  orderDetails,
  loadingDetails,
  onPrint,
  onConfirm,
  onMarkReady,
  onComplete,
  onDecline,
  onAssignDriver,
  assistant
}: {
  order: TabletOrderDetails | null
  orderDetails: TabletOrderDetails | null
  loadingDetails: boolean
  onPrint: (orderId: string) => void
  onConfirm: (orderId: string, prepTimeMinutes?: number) => void
  onMarkReady: (orderId: string) => void
  onComplete: (orderId: string) => void
  onDecline: (orderId: string) => void
  onAssignDriver: (orderId: string, driver: { name?: string; phone?: string; notes?: string }) => Promise<void> | void
  assistant: React.ReactNode
}) {
  const [assignOpen, setAssignOpen] = React.useState(false)
  const [assignName, setAssignName] = React.useState('')
  const [assignPhone, setAssignPhone] = React.useState('')
  const [assignNotes, setAssignNotes] = React.useState('')
  const [assignBusy, setAssignBusy] = React.useState(false)

  if (!order) {
    return (
      <div className="bg-black/25 border border-white/10 rounded-2xl p-6 text-white/70">
        Select an order to view details.
      </div>
    )
  }

  const detail = orderDetails || order
  const status = String(detail.status || '')
  const created = detail.createdAt ? new Date(detail.createdAt) : null
  const idLabel = detail.externalId || detail.id
  const items = Array.isArray(detail.orderItems) ? detail.orderItems : []

  const canConfirm = String(status).toLowerCase() === 'received'
  const canReady = String(status).toLowerCase() === 'preparing'
  const canComplete = String(status).toLowerCase() === 'ready'
  const canDecline = ['received', 'preparing'].includes(String(status).toLowerCase())

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="bg-black/25 border border-white/10 rounded-2xl p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-white/60 text-[11px] font-semibold tracking-widest uppercase">Order</div>
            <div className="text-white text-2xl font-extrabold truncate">{idLabel}</div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className={['px-3 py-1 rounded-full border text-xs font-extrabold', statusPill(status)].join(' ')}>
                {status || '—'}
              </span>
              <span className="text-xs text-white/60 font-semibold">
                {created ? created.toLocaleString() : '—'}
              </span>
              {detail.channel && (
                <span className="text-xs text-white/60 font-semibold">via {detail.channel}</span>
              )}
            </div>
          </div>

          <div className="shrink-0 flex gap-2">
            <button
              onClick={() => onPrint(detail.id)}
              className="px-3 py-2 rounded-xl bg-white text-gray-950 font-extrabold hover:bg-white/90 active:bg-white/80 transition-colors inline-flex items-center gap-2"
            >
              <Printer className="w-4 h-4" />
              Print
            </button>
            <a
              href={`/tablet/orders?orderId=${encodeURIComponent(detail.id)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 font-extrabold inline-flex items-center gap-2 text-white/80"
              title="Open this order in a new tab"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-4">
        {/* Left (Map area replacement + items) */}
        <div className="space-y-4 min-w-0">
          <div className="bg-black/25 border border-white/10 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2 text-white/80 font-extrabold">
                <MapPin className="w-4 h-4 text-orange-300" />
                Assistant (replaces map)
              </div>
              <div className="text-xs text-white/50 font-semibold">Hands-free ops</div>
            </div>
            <div className="p-3">{assistant}</div>
          </div>

          <div className="bg-black/25 border border-white/10 rounded-2xl p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-white/80 font-extrabold">
                <Package className="w-4 h-4 text-teal-300" />
                Items
              </div>
              <div className="text-xs text-white/50 font-semibold">{items.length} item{items.length === 1 ? '' : 's'}</div>
            </div>

            {loadingDetails ? (
              <div className="mt-4 text-white/60">Loading…</div>
            ) : items.length === 0 ? (
              <div className="mt-4 text-white/60">No items found.</div>
            ) : (
              <div className="mt-3 space-y-2">
                {items.map((it: any, idx: number) => (
                  <div key={idx} className="bg-white/5 border border-white/10 rounded-xl p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-white font-semibold">
                        {Number(it.quantity ?? 0)}× {String(it.name ?? 'Item')}
                      </div>
                      <div className="text-white/80 font-extrabold">
                        {formatMoney((Number(it.unitPrice ?? 0) || 0) * (Number(it.quantity ?? 1) || 1))}
                      </div>
                    </div>
                    {(it.notes || it.modifiers) && (
                      <div className="mt-2 text-sm text-white/65 space-y-1">
                        {it.modifiers && <div className="truncate">Modifiers: {typeof it.modifiers === 'string' ? it.modifiers : JSON.stringify(it.modifiers)}</div>}
                        {it.notes && <div className="truncate">Notes: {String(it.notes)}</div>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right (customer + actions) */}
        <div className="space-y-4">
          <div className="bg-black/25 border border-white/10 rounded-2xl p-4">
            <div className="text-white/80 font-extrabold flex items-center gap-2">
              <User className="w-4 h-4 text-white/70" />
              Customer
            </div>
            <div className="mt-3 space-y-2">
              <div className="text-lg font-extrabold text-white">{detail.customerName || 'Guest'}</div>
              {detail.customerPhone && (
                <div className="text-white/70 font-semibold inline-flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  {detail.customerPhone}
                </div>
              )}
            </div>
          </div>

          <div className="bg-black/25 border border-white/10 rounded-2xl p-4">
            <div className="text-white/80 font-extrabold flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-white/70" />
              Payment
            </div>
            <div className="mt-3 flex items-center justify-between">
              <div className="text-white/70 font-semibold">
                {detail.paymentStatus === 'pay_on_arrival' ? 'Pay on arrival' : detail.paymentStatus || '—'}
              </div>
              <div className="text-2xl font-extrabold text-white">{formatMoney(detail.totalAmount ?? 0)}</div>
            </div>
          </div>

          <div className="bg-black/25 border border-white/10 rounded-2xl p-4">
            <div className="text-white/80 font-extrabold flex items-center gap-2">
              <Timer className="w-4 h-4 text-white/70" />
              Actions
            </div>
            <div className="mt-4 space-y-2">
              <button
                onClick={() => onConfirm(detail.id, detail.prepTimeMinutes ?? undefined)}
                disabled={!canConfirm}
                className={[
                  'w-full px-4 py-3 rounded-xl font-extrabold transition-colors inline-flex items-center justify-center gap-2',
                  canConfirm ? 'bg-orange-500 hover:bg-orange-600 text-gray-950' : 'bg-white/5 border border-white/10 text-white/35'
                ].join(' ')}
              >
                <CheckCircle2 className="w-5 h-5" />
                Confirm order
              </button>

              <button
                onClick={() => onMarkReady(detail.id)}
                disabled={!canReady}
                className={[
                  'w-full px-4 py-3 rounded-xl font-extrabold transition-colors inline-flex items-center justify-center gap-2',
                  canReady ? 'bg-emerald-500 hover:bg-emerald-600 text-gray-950' : 'bg-white/5 border border-white/10 text-white/35'
                ].join(' ')}
              >
                Ready for pickup
              </button>

              <button
                onClick={() => onComplete(detail.id)}
                disabled={!canComplete}
                className={[
                  'w-full px-4 py-3 rounded-xl font-extrabold transition-colors inline-flex items-center justify-center gap-2',
                  canComplete ? 'bg-sky-500 hover:bg-sky-600 text-gray-950' : 'bg-white/5 border border-white/10 text-white/35'
                ].join(' ')}
              >
                Complete order
              </button>

              <button
                onClick={() => setAssignOpen(true)}
                className="w-full px-4 py-3 rounded-xl font-extrabold bg-white/10 hover:bg-white/15 border border-white/10 text-white/80 inline-flex items-center justify-center gap-2 transition-colors"
              >
                <Truck className="w-5 h-5" />
                Assign driver
              </button>

              <button
                onClick={() => onDecline(detail.id)}
                disabled={!canDecline}
                className={[
                  'w-full px-4 py-3 rounded-xl font-extrabold transition-colors inline-flex items-center justify-center gap-2',
                  canDecline ? 'bg-red-500/15 hover:bg-red-500/25 border border-red-500/25 text-red-100' : 'bg-white/5 border border-white/10 text-white/35'
                ].join(' ')}
              >
                <XCircle className="w-5 h-5" />
                Decline / Cancel
              </button>
            </div>
          </div>
        </div>
      </div>

      {assignOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-gray-950 border border-white/10 rounded-2xl p-5">
            <div className="text-white/60 text-sm">Assign driver</div>
            <div className="text-xl font-extrabold mt-1 truncate">{idLabel}</div>
            <div className="text-white/70 text-sm mt-2">Create a delivery/driver task for this order.</div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-semibold text-white/70">Driver name (optional)</label>
                <input
                  value={assignName}
                  onChange={(e) => setAssignName(e.target.value)}
                  className="mt-1 w-full bg-gray-900 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-teal-500/30"
                  placeholder="e.g. Alex"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-white/70">Driver phone (optional)</label>
                <input
                  value={assignPhone}
                  onChange={(e) => setAssignPhone(e.target.value)}
                  className="mt-1 w-full bg-gray-900 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-teal-500/30"
                  placeholder="e.g. (555) 987-6543"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-white/70">Notes (optional)</label>
                <textarea
                  value={assignNotes}
                  onChange={(e) => setAssignNotes(e.target.value)}
                  className="mt-1 w-full bg-gray-900 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-teal-500/30 min-h-[92px]"
                  placeholder="Drop-off instructions, ETA, etc."
                />
              </div>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setAssignOpen(false)}
                className="flex-1 px-4 py-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 font-extrabold"
                disabled={assignBusy}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setAssignBusy(true)
                  try {
                    await onAssignDriver(detail.id, {
                      name: assignName.trim() || undefined,
                      phone: assignPhone.trim() || undefined,
                      notes: assignNotes.trim() || undefined
                    })
                    setAssignOpen(false)
                    setAssignName('')
                    setAssignPhone('')
                    setAssignNotes('')
                  } finally {
                    setAssignBusy(false)
                  }
                }}
                className="flex-1 px-4 py-3 rounded-xl bg-teal-500 hover:bg-teal-600 font-extrabold text-gray-950"
                disabled={assignBusy}
              >
                {assignBusy ? 'Assigning…' : 'Assign'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

