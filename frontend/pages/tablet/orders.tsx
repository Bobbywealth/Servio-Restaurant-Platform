'use client';

import React from 'react'
import TabletLayout from '../../components/Layout/TabletLayout'
import { api } from '../../lib/api'
import { useUser } from '../../contexts/UserContext'
import { Printer, Clock, ShoppingBag, BadgeCheck } from 'lucide-react'

type OrderStatus = 'received' | 'preparing' | 'ready' | 'completed' | 'cancelled' | string

type OrderItem = {
  name?: string | null
  quantity?: number | null
  unitPrice?: number | null
  notes?: string | null
}

type Order = {
  id: string
  externalId?: string | null
  channel?: string | null
  status: OrderStatus
  customerName?: string | null
  customerPhone?: string | null
  totalAmount?: number | null
  createdAt?: string | null
  orderItems?: OrderItem[] | null
  items?: any[] | null
}

type ReceiptSettings = {
  paperSize: '80mm' | '58mm'
  headerTitle: string
  headerSubtitle: string
  showLogo: boolean
  showOrderId: boolean
  showPlacedAt: boolean
  showCustomerName: boolean
  showCustomerPhone: boolean
  showChannel: boolean
  footerText: string
}

type ReceiptMeta = {
  name?: string
  logoUrl?: string | null
  phone?: string | null
  address?: any
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

function resolveAssetUrl(url: string | null | undefined) {
  if (!url) return null
  if (/^https?:\/\//i.test(url)) return url
  const base = String((api as any)?.defaults?.baseURL || '').replace(/\/+$/, '')
  if (!base) return url
  return `${base}${url.startsWith('/') ? '' : '/'}${url}`
}

function printableTicketHtml(order: Order, config: { receipt: ReceiptSettings; restaurant: ReceiptMeta }) {
  const created = order.createdAt ? new Date(order.createdAt) : null
  const items = Array.isArray(order.orderItems) ? order.orderItems : []
  const receipt = config.receipt
  const restaurant = config.restaurant
  const paper = receipt.paperSize || '80mm'
  const widthCss = paper === '58mm' ? '58mm' : '80mm'
  const logoSrc = receipt.showLogo ? resolveAssetUrl(restaurant.logoUrl) : null
  const headerTitle = (receipt.headerTitle || restaurant.name || '').trim()
  const lines = items
    .map((it) => {
      const qty = Number(it.quantity ?? 0)
      const name = String(it.name ?? 'Item')
      const notes = it.notes ? String(it.notes) : ''
      return `
        <div class="row">
          <div class="qty">${qty}x</div>
          <div class="name">
            <div class="title">${escapeHtml(name)}</div>
            ${notes ? `<div class="notes">${escapeHtml(notes)}</div>` : ''}
          </div>
        </div>
      `
    })
    .join('')

  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Order ${escapeHtml(order.externalId || order.id)}</title>
      <style>
        * { box-sizing: border-box; }
        body { margin: 0; padding: 10px; width: ${widthCss}; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; }
        @media print {
          @page { size: ${widthCss} auto; margin: 0; }
          body { padding: 0; }
        }
        .header { border-bottom: 1px dashed #111; padding-bottom: 8px; margin-bottom: 8px; }
        .h1 { font-size: 18px; font-weight: 800; }
        .meta { font-size: 12px; margin-top: 4px; color: #111; }
        .meta div { margin-top: 2px; }
        .section { margin-top: 10px; }
        .sectionTitle { font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; margin-bottom: 6px; }
        .row { display: flex; gap: 10px; margin: 8px 0; }
        .qty { width: 36px; font-weight: 800; font-size: 14px; }
        .title { font-weight: 700; font-size: 14px; }
        .notes { font-size: 12px; margin-top: 2px; color: #333; }
        .footer { border-top: 1px dashed #111; margin-top: 10px; padding-top: 8px; font-size: 12px; }
        .center { text-align: center; }
        .logo { display: flex; justify-content: center; margin-bottom: 6px; }
        .logo img { max-height: 48px; max-width: 100%; object-fit: contain; }
      </style>
    </head>
    <body>
      <div class="header">
        ${logoSrc ? `<div class="logo"><img src="${escapeHtml(logoSrc)}" alt="Logo" /></div>` : ''}
        ${headerTitle ? `<div class="h1 center">${escapeHtml(headerTitle)}</div>` : `<div class="h1">Order ${escapeHtml(order.externalId || order.id)}</div>`}
        ${receipt.headerSubtitle ? `<div class="meta center">${escapeHtml(receipt.headerSubtitle)}</div>` : ''}
        <div class="meta">
          ${receipt.showOrderId ? `<div>Order: ${escapeHtml(order.externalId || order.id)}</div>` : ''}
          <div>Status: ${escapeHtml(String(order.status || ''))}</div>
          ${receipt.showPlacedAt && created ? `<div>Placed: ${escapeHtml(created.toLocaleString())}</div>` : ''}
          ${receipt.showCustomerName && order.customerName ? `<div>Customer: ${escapeHtml(order.customerName)}</div>` : ''}
          ${receipt.showCustomerPhone && order.customerPhone ? `<div>Phone: ${escapeHtml(order.customerPhone)}</div>` : ''}
          ${receipt.showChannel && order.channel ? `<div>Channel: ${escapeHtml(order.channel)}</div>` : ''}
        </div>
      </div>

      <div class="section">
        <div class="sectionTitle">Items</div>
        ${lines || '<div style="font-size:12px;color:#333">No items found.</div>'}
      </div>

      <div class="footer">
        Total: <strong>${escapeHtml(formatMoney(order.totalAmount ?? 0))}</strong>
        ${receipt.footerText ? `<div class="center" style="margin-top:6px;">${escapeHtml(receipt.footerText)}</div>` : ''}
      </div>
      <script>
        window.focus();
        setTimeout(() => window.print(), 50);
        setTimeout(() => window.close(), 250);
      </script>
    </body>
  </html>`
}

function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export default function TabletOrdersPage() {
  const { user, hasPermission } = useUser()

  const [orders, setOrders] = React.useState<Order[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [receiptCfg, setReceiptCfg] = React.useState<{ receipt: ReceiptSettings; restaurant: ReceiptMeta } | null>(null)

  const canReadOrders = hasPermission('orders:read')

  const loadReceiptCfg = React.useCallback(async () => {
    if (!user?.restaurantId) return
    try {
      const resp = await api.get(`/api/restaurants/${user.restaurantId}/receipt`)
      const data = resp.data?.data
      if (data?.receipt) {
        setReceiptCfg({
          receipt: data.receipt,
          restaurant: data.restaurant || {}
        })
      }
    } catch {
      // Printing should still work with defaults below
    }
  }, [user?.restaurantId])

  const fetchOrders = React.useCallback(async () => {
    if (!canReadOrders) return
    setLoading(true)
    setError(null)
    try {
      const resp = await api.get('/api/orders', {
        params: { channel: 'website', limit: 50, offset: 0 }
      })
      setOrders(resp.data?.data?.orders || [])
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || e?.message || 'Failed to load orders')
    } finally {
      setLoading(false)
    }
  }, [canReadOrders])

  React.useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  React.useEffect(() => {
    loadReceiptCfg()
  }, [loadReceiptCfg])

  const handlePrint = async (orderId: string) => {
    try {
      const detail = await api.get(`/api/orders/${orderId}`)
      const order = detail.data?.data as Order
      const w = window.open('', '_blank', 'noopener,noreferrer,width=420,height=700')
      if (!w) throw new Error('Popup blocked')
      w.document.open()
      const fallbackCfg: { receipt: ReceiptSettings; restaurant: ReceiptMeta } = receiptCfg || {
        receipt: {
          paperSize: '80mm',
          headerTitle: '',
          headerSubtitle: 'Online Order',
          showLogo: true,
          showOrderId: true,
          showPlacedAt: true,
          showCustomerName: true,
          showCustomerPhone: true,
          showChannel: true,
          footerText: 'Thank you!'
        },
        restaurant: { name: '' }
      }
      w.document.write(printableTicketHtml(order, fallbackCfg))
      w.document.close()
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || e?.message || 'Failed to print order')
    }
  }

  return (
    <TabletLayout title="Online Orders" onRefresh={fetchOrders}>
      {!canReadOrders ? (
        <div className="bg-red-500/15 border border-red-500/30 text-red-200 rounded-2xl p-4">
          This account doesn’t have access to view orders. Add the permission <code className="px-2 py-1 bg-black/30 rounded">orders:read</code>.
        </div>
      ) : (
        <>
          {error && (
            <div className="mb-4 bg-red-500/15 border border-red-500/30 text-red-200 rounded-2xl p-4">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {orders.map((o) => {
              const created = o.createdAt ? new Date(o.createdAt) : null
              const itemCount = Array.isArray(o.orderItems)
                ? o.orderItems.length
                : Array.isArray(o.items)
                  ? o.items.length
                  : 0
              const idLabel = o.externalId || o.id
              const status = String(o.status || '')
              return (
                <div key={o.id} className="bg-white/5 border border-white/10 rounded-2xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xl font-extrabold truncate">{idLabel}</div>
                      <div className="mt-1 flex items-center gap-2 text-white/70">
                        <Clock className="w-4 h-4" />
                        <span className="text-sm">
                          {created ? created.toLocaleString() : '—'}
                        </span>
                      </div>
                    </div>
                    <div className={`shrink-0 px-3 py-1.5 rounded-full border text-sm font-bold ${statusPill(status)}`}>
                      {status || '—'}
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="bg-black/20 rounded-xl p-3">
                      <div className="text-xs text-white/60">Customer</div>
                      <div className="text-base font-semibold truncate">{o.customerName || '—'}</div>
                      <div className="text-sm text-white/60 truncate">{o.customerPhone || ''}</div>
                    </div>
                    <div className="bg-black/20 rounded-xl p-3">
                      <div className="text-xs text-white/60">Total</div>
                      <div className="text-2xl font-extrabold">{formatMoney(o.totalAmount ?? 0)}</div>
                      <div className="text-sm text-white/60 inline-flex items-center gap-2">
                        <ShoppingBag className="w-4 h-4" />
                        {itemCount} items
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => handlePrint(o.id)}
                      className="flex-1 px-4 py-3 rounded-xl bg-white text-gray-950 font-extrabold hover:bg-white/90 active:bg-white/80 transition-colors inline-flex items-center justify-center gap-2"
                    >
                      <Printer className="w-5 h-5" />
                      Print
                    </button>
                    <button
                      onClick={fetchOrders}
                      className="px-4 py-3 rounded-xl bg-white/10 hover:bg-white/15 active:bg-white/20 transition-colors font-bold inline-flex items-center gap-2"
                      title="Refresh"
                    >
                      <BadgeCheck className={`w-5 h-5 ${loading ? 'opacity-60' : ''}`} />
                      <span className="hidden sm:inline">{loading ? 'Loading…' : 'Sync'}</span>
                    </button>
                  </div>
                </div>
              )
            })}

            {orders.length === 0 && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-white/70">
                {loading ? 'Loading orders…' : 'No online orders yet.'}
              </div>
            )}
          </div>
        </>
      )}
    </TabletLayout>
  )
}

