'use client';

import React from 'react'
import TabletLayout from '../../components/Layout/TabletLayout'
import { api } from '../../lib/api'
import { useUser } from '../../contexts/UserContext'
import { useSocket } from '../../lib/socket'
import { Printer, Clock, ShoppingBag, BadgeCheck, CheckCircle2, XCircle, Timer, Volume2, ExternalLink, Eye, X, User, Phone, CreditCard, Package } from 'lucide-react'

type OrderStatus = 'received' | 'preparing' | 'ready' | 'completed' | 'cancelled' | string

type OrderItem = {
  name?: string | null
  quantity?: number | null
  unitPrice?: number | null
  notes?: string | null
  modifiers?: any
}

type Order = {
  id: string
  externalId?: string | null
  channel?: string | null
  status: OrderStatus
  customerName?: string | null
  customerPhone?: string | null
  totalAmount?: number | null
  paymentStatus?: string | null
  createdAt?: string | null
  prepTimeMinutes?: number | null
  acceptedAt?: string | null
  acceptedByUserId?: string | null
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
  printMode?: 'browser' | 'agent' | 'bluetooth'
  agentUrl?: string
  agentPrinter?: null | { name?: string; host: string; port?: number; type?: string }
  autoPrint?: boolean
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
      const mods = formatModifiers(it.modifiers)
      return `
        <div class="row">
          <div class="qty">${qty}x</div>
          <div class="name">
            <div class="title">${escapeHtml(name)}</div>
            ${mods ? `<div class="notes">Modifiers: ${escapeHtml(mods)}</div>` : ''}
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
          ${order.paymentStatus === 'pay_on_arrival' ? `<div><strong>💳 PAYMENT: On arrival</strong></div>` : ''}
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

function textTicket(order: Order, config: { receipt: ReceiptSettings; restaurant: ReceiptMeta }) {
  const r = config.receipt
  const rest = config.restaurant
  const created = order.createdAt ? new Date(order.createdAt) : null
  const lines: string[] = []

  const title = (r.headerTitle || rest.name || '').trim()
  if (title) lines.push(title)
  if (r.headerSubtitle) lines.push(r.headerSubtitle)
  lines.push('------------------------------')
  if (r.showOrderId) lines.push(`Order: ${order.externalId || order.id}`)
  lines.push(`Status: ${String(order.status || '')}`)
  if (r.showPlacedAt && created) lines.push(`Placed: ${created.toLocaleString()}`)
  if (r.showCustomerName && order.customerName) lines.push(`Customer: ${order.customerName}`)
  if (r.showCustomerPhone && order.customerPhone) lines.push(`Phone: ${order.customerPhone}`)
  if (r.showChannel && order.channel) lines.push(`Channel: ${order.channel}`)
  if (order.prepTimeMinutes != null) lines.push(`Ready in: ${Number(order.prepTimeMinutes)} min`)
  if (order.paymentStatus === 'pay_on_arrival') lines.push('PAYMENT: On arrival')
  lines.push('')
  lines.push('ITEMS')
  lines.push('------------------------------')
  const items = Array.isArray(order.orderItems) ? order.orderItems : []
  for (const it of items) {
    const qty = Number(it.quantity ?? 0)
    const name = String(it.name ?? 'Item')
    lines.push(`${qty}x ${name}`)
    const mods = formatModifiers(it.modifiers)
    if (mods) lines.push(`  * ${mods}`)
    if (it.notes) lines.push(`  - ${String(it.notes)}`)
  }
  lines.push('')
  lines.push(`Total: ${formatMoney(order.totalAmount ?? 0)}`)
  if (r.footerText) {
    lines.push('')
    lines.push(r.footerText)
  }
  lines.push('\n')
  return lines.join('\n')
}

function formatModifiers(modifiers: any): string {
  if (!modifiers) return ''
  if (Array.isArray(modifiers)) {
    return modifiers
      .map((m) => {
        if (typeof m === 'string') return m
        if (m && typeof m === 'object') return m.name || m.label || JSON.stringify(m)
        return String(m)
      })
      .filter(Boolean)
      .join(', ')
  }
  if (typeof modifiers === 'object') {
    const entries = Object.entries(modifiers)
      .map(([k, v]) => {
        if (v == null) return null
        if (Array.isArray(v)) return `${k}: ${v.join(', ')}`
        if (typeof v === 'object') return `${k}: ${JSON.stringify(v)}`
        return `${k}: ${String(v)}`
      })
      .filter(Boolean) as string[]
    return entries.join(' | ')
  }
  return String(modifiers)
}

async function printViaAgent(agentUrl: string, printer: { host: string; port?: number }, text: string) {
  const url = String(agentUrl || 'http://localhost:8787').replace(/\/+$/, '')
  const resp = await fetch(`${url}/print`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      printer: { host: printer.host, port: printer.port || 9100 },
      text
    })
  })
  const data = await resp.json().catch(() => ({}))
  if (!resp.ok || data?.success === false) {
    throw new Error(data?.error?.message || 'Print agent failed')
  }
  return true
}

export default function TabletOrdersPage() {
  const { user, hasPermission } = useUser()
  const socket = useSocket()
  const [debugEnabled, setDebugEnabled] = React.useState(false)
  const [debugInfo, setDebugInfo] = React.useState<any>(null)

  const [orders, setOrders] = React.useState<Order[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [receiptCfg, setReceiptCfg] = React.useState<{ receipt: ReceiptSettings; restaurant: ReceiptMeta } | null>(null)
  const [soundEnabled, setSoundEnabled] = React.useState(false)
  const [activeModalOrder, setActiveModalOrder] = React.useState<Order | null>(null)
  const [prepTimeMinutes, setPrepTimeMinutes] = React.useState<number>(15)
  const [actingOrderId, setActingOrderId] = React.useState<string | null>(null)
  const [nowTick, setNowTick] = React.useState<number>(() => Date.now())
  const [restaurantSlug, setRestaurantSlug] = React.useState<string | null>(null)
  const [selectedOrder, setSelectedOrder] = React.useState<Order | null>(null)
  const [orderDetails, setOrderDetails] = React.useState<any>(null)
  const [loadingDetails, setLoadingDetails] = React.useState(false)

  const canReadOrders = hasPermission('orders:read')
  const canWriteOrders = hasPermission('orders:write')

  // Tick once per second for countdown timers
  React.useEffect(() => {
    const t = window.setInterval(() => setNowTick(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [])

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

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    setDebugEnabled(params.get('debug') === '1')
  }, [])

  React.useEffect(() => {
    if (!debugEnabled) return
    const update = () => setDebugInfo(socket.getDebugInfo())
    update()
    const id = window.setInterval(update, 1000)
    return () => window.clearInterval(id)
  }, [debugEnabled, socket])

  const fetchRestaurantSlug = React.useCallback(async () => {
    if (!user?.restaurantId) return
    try {
      const response = await api.get(`/api/restaurants/${user.restaurantId}`)
      const slug = response.data?.data?.slug
      if (slug) {
        setRestaurantSlug(slug)
      }
    } catch (e: any) {
      console.warn('Failed to fetch restaurant slug:', e.message)
    }
  }, [user?.restaurantId])

  const fetchOrders = React.useCallback(async () => {
    if (!canReadOrders) return
    setLoading(true)
    setError(null)
    try {
      const resp = await api.get('/api/orders', {
        // Tablet should show all incoming orders (web + phone), not just website.
        params: { limit: 50, offset: 0 }
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

  React.useEffect(() => {
    fetchRestaurantSlug()
  }, [fetchRestaurantSlug])

  // Enable sound only after a user gesture (mobile browser policy)
  React.useEffect(() => {
    const onFirstGesture = () => setSoundEnabled(true)
    window.addEventListener('pointerdown', onFirstGesture, { once: true })
    return () => window.removeEventListener('pointerdown', onFirstGesture as any)
  }, [])

  // Loud alarm loop (keeps playing while there are actionable orders)
  const alarmRef = React.useRef<{
    ctx: AudioContext
    osc: OscillatorNode
    gain: GainNode
  } | null>(null)

  const stopAlarm = React.useCallback(() => {
    const a = alarmRef.current
    if (!a) return
    try {
      a.gain.gain.setValueAtTime(0.0001, a.ctx.currentTime)
      a.osc.stop()
    } catch {}
    try {
      a.ctx.close()
    } catch {}
    alarmRef.current = null
  }, [])

  const startAlarm = React.useCallback(() => {
    if (!soundEnabled) return
    if (alarmRef.current) return
    try {
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext
      if (!AudioCtx) return
      const ctx: AudioContext = new AudioCtx()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'square'
      osc.frequency.value = 1100 // sharp alarm tone
      gain.gain.value = 0.0001
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()

      // Pulse volume continuously (very loud)
      const pulse = () => {
        const t = ctx.currentTime
        gain.gain.cancelScheduledValues(t)
        gain.gain.setValueAtTime(0.0001, t)
        gain.gain.exponentialRampToValueAtTime(0.85, t + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.25)
      }

      // Schedule pulses forever using an interval; stopAlarm() closes ctx.
      const id = window.setInterval(() => {
        try {
          pulse()
        } catch {}
      }, 350)

      // Tie interval lifecycle to ctx
      const originalClose = ctx.close.bind(ctx)
      ;(ctx as any).close = async () => {
        window.clearInterval(id)
        return originalClose()
      }

      alarmRef.current = { ctx, osc, gain }
      pulse()
    } catch {
      // ignore
    }
  }, [soundEnabled])

  const playNewOrderSound = React.useCallback(() => {
    if (!soundEnabled) return
    try {
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext
      if (!AudioCtx) return
      const ctx = new AudioCtx()
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = 'sine'
      o.frequency.value = 880
      g.gain.value = 0.0001
      o.connect(g)
      g.connect(ctx.destination)
      const now = ctx.currentTime
      g.gain.setValueAtTime(0.0001, now)
      g.gain.exponentialRampToValueAtTime(0.25, now + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.18)
      o.start(now)
      o.stop(now + 0.2)
      o.onended = () => {
        try { ctx.close() } catch {}
      }
    } catch {
      // ignore
    }
  }, [soundEnabled])

  const startOfToday = React.useMemo(() => {
    const d = new Date(nowTick)
    d.setHours(0, 0, 0, 0)
    return d.getTime()
  }, [nowTick])

  const todaysOrders = React.useMemo(() => {
    return orders.filter((o) => {
      const ts = o.createdAt ? new Date(o.createdAt).getTime() : 0
      return ts >= startOfToday
    })
  }, [orders, startOfToday])

  const actionableOrders = React.useMemo(() => {
    return todaysOrders.filter((o) => String(o.status || '').toLowerCase() === 'received')
  }, [todaysOrders])

  const missedOrderIds = React.useMemo(() => {
    const limitMs = 4 * 60 * 1000
    const set = new Set<string>()
    for (const o of actionableOrders) {
      const createdMs = o.createdAt ? new Date(o.createdAt).getTime() : 0
      if (createdMs && nowTick - createdMs >= limitMs) set.add(o.id)
    }
    return set
  }, [actionableOrders, nowTick])

  // Keep alarm running while any order is awaiting action (even if "missed")
  React.useEffect(() => {
    if (!soundEnabled) return
    if (actionableOrders.length > 0) startAlarm()
    else stopAlarm()
  }, [actionableOrders.length, soundEnabled, startAlarm, stopAlarm])

  // Always cleanup alarm on unmount (navigation away)
  React.useEffect(() => {
    return () => {
      stopAlarm()
    }
  }, [stopAlarm])

  // Live updates: beep + refresh when new order arrives
  React.useEffect(() => {
    if (!socket || !user?.restaurantId) return

    // Ensure we're in the restaurant room (socket manager also does this on connect).
    socket.joinRestaurantRoom(user.restaurantId)

    const onNew = (payload: any) => {
      // Short chime + then the loud alarm will persist until accepted/declined.
      playNewOrderSound()
      socket.markOrderNew()
      fetchOrders()
      
      // Auto-print if enabled
      if (receiptCfg?.receipt?.autoPrint && payload?.orderId) {
        setTimeout(async () => {
          try {
            const detail = await api.get(`/api/orders/${payload.orderId}`)
            const order = detail.data?.data
            const w = window.open('', '_blank', 'noopener,noreferrer,width=420,height=700')
            if (!w) {
              setError('Popup blocked. Allow popups to enable browser printing.')
              return
            }
            w.document.open()
            w.document.write(printableTicketHtml(order, receiptCfg))
            w.document.close()
          } catch (e) {
            console.error('Auto-print failed:', e)
          }
        }, 1500) // Small delay to ensure order data is loaded
      }
    }
    const onUpdated = () => {
      fetchOrders()
    }
    socket.on('order:new', onNew as any)
    socket.on('order:updated', onUpdated as any)

    return () => {
      socket.off('order:new', onNew as any)
      socket.off('order:updated', onUpdated as any)
    }
  }, [socket, user?.restaurantId, fetchOrders, playNewOrderSound, receiptCfg])

  const handlePrint = async (orderId: string) => {
    try {
      const detail = await api.get(`/api/orders/${orderId}`)
      const order = detail.data?.data as Order
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
          footerText: 'Thank you!',
          printMode: 'browser',
          agentUrl: 'http://localhost:8787',
          agentPrinter: null
        },
        restaurant: { name: '' }
      }
      const mode = fallbackCfg.receipt.printMode || 'browser'

      if (mode === 'agent' && fallbackCfg.receipt.agentUrl && fallbackCfg.receipt.agentPrinter?.host) {
        const text = textTicket(order, fallbackCfg)
        await printViaAgent(fallbackCfg.receipt.agentUrl, fallbackCfg.receipt.agentPrinter, text)
        return
      }

      // bluetooth: handled by browser support; fallback to browser print if unsupported
      const w = window.open('', '_blank', 'noopener,noreferrer,width=420,height=700')
      if (!w) throw new Error('Popup blocked')
      w.document.open()
      w.document.write(printableTicketHtml(order, fallbackCfg))
      w.document.close()
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || e?.message || 'Failed to print order')
    }
  }

  const openAccept = (order: Order) => {
    setActiveModalOrder(order)
    setPrepTimeMinutes(Number(order.prepTimeMinutes ?? 15))
  }

  const acceptOrder = async () => {
    if (!activeModalOrder) return
    setError(null)
    setActingOrderId(activeModalOrder.id)
    try {
      await api.post(`/api/orders/${activeModalOrder.id}/accept`, {
        prepTimeMinutes
      })
      setActiveModalOrder(null)
      await fetchOrders()
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || e?.message || 'Failed to accept order')
    } finally {
      setActingOrderId(null)
    }
  }

  const declineOrder = async (orderId: string) => {
    setError(null)
    setActingOrderId(orderId)
    try {
      await api.post(`/api/orders/${orderId}/status`, { status: 'cancelled' })
      await fetchOrders()
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || e?.message || 'Failed to decline order')
    } finally {
      setActingOrderId(null)
    }
  }

  const timeLeftText = (order: Order) => {
    const createdMs = order.createdAt ? new Date(order.createdAt).getTime() : 0
    if (!createdMs) return '—'
    const limit = 4 * 60
    const elapsed = Math.floor((nowTick - createdMs) / 1000)
    const left = Math.max(0, limit - elapsed)
    const mm = String(Math.floor(left / 60)).padStart(1, '0')
    const ss = String(left % 60).padStart(2, '0')
    return `${mm}:${ss}`
  }

  const viewOrderDetails = async (order: Order) => {
    setSelectedOrder(order)
    setLoadingDetails(true)
    setOrderDetails(null)
    try {
      const detail = await api.get(`/api/orders/${order.id}`)
      setOrderDetails(detail.data?.data)
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || e?.message || 'Failed to load order details')
    } finally {
      setLoadingDetails(false)
    }
  }

  const closeOrderDetails = () => {
    setSelectedOrder(null)
    setOrderDetails(null)
  }

  return (
    <TabletLayout title="Online Orders" onRefresh={fetchOrders}>
      {!canReadOrders ? (
        <div className="bg-red-500/15 border border-red-500/30 text-red-200 rounded-2xl p-4">
          This account doesn’t have access to view orders. Add the permission <code className="px-2 py-1 bg-black/30 rounded">orders:read</code>.
        </div>
      ) : (
        <>
          {restaurantSlug && (
            <div className="mb-4 flex justify-end">
              <a
                href={`/r/${restaurantSlug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold inline-flex items-center gap-2 transition-colors"
                title="Open customer ordering page in new tab"
              >
                <ShoppingBag className="w-5 h-5" />
                Preview & Test Ordering
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          )}

          {!soundEnabled && (
            <div className="mb-4 bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between">
              <div className="text-white/70 text-sm">
                Tap anywhere once to enable the <span className="text-white font-semibold">new order sound</span>.
              </div>
              <div className="px-3 py-2 rounded-xl bg-white/10 border border-white/10 inline-flex items-center gap-2 text-sm font-bold text-white/80">
                <Volume2 className="w-4 h-4" />
                Sound
              </div>
            </div>
          )}

          {actionableOrders.length > 0 && (
            <div className="mb-4 bg-orange-500/15 border border-orange-500/30 text-orange-100 rounded-2xl p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="font-extrabold">
                  {actionableOrders.length} order{actionableOrders.length === 1 ? '' : 's'} need action
                </div>
                <div className="text-sm text-orange-100/80">
                  Answer within <span className="font-extrabold">4:00</span> or it becomes <span className="font-extrabold">MISSED</span>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-4 bg-red-500/15 border border-red-500/30 text-red-200 rounded-2xl p-4">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {todaysOrders.map((o) => {
              const created = o.createdAt ? new Date(o.createdAt) : null
              const itemCount = Array.isArray(o.orderItems)
                ? o.orderItems.length
                : Array.isArray(o.items)
                  ? o.items.length
                  : 0
              const idLabel = o.externalId || o.id
              const status = String(o.status || '')
              const isNew = String(o.status || '').toLowerCase() === 'received'
              const isMissed = isNew && missedOrderIds.has(o.id)
              const isActing = actingOrderId === o.id
              const itemLines = Array.isArray(o.orderItems) ? o.orderItems : []
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
                    <div className="shrink-0 flex flex-col items-end gap-2">
                      <div className={`px-3 py-1.5 rounded-full border text-sm font-bold ${statusPill(status)}`}>
                        {status || '—'}
                      </div>
                      {isNew && (
                        <div className={`px-3 py-1 rounded-full border text-xs font-extrabold ${
                          isMissed ? 'bg-red-500/20 text-red-100 border-red-500/30' : 'bg-orange-500/20 text-orange-100 border-orange-500/30'
                        }`}>
                          {isMissed ? 'MISSED' : `TIME LEFT ${timeLeftText(o)}`}
                        </div>
                      )}
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
                      {o.paymentStatus === 'pay_on_arrival' && (
                        <div className="text-xs text-green-300 font-medium">💳 Pay on arrival</div>
                      )}
                      <div className="text-sm text-white/60 inline-flex items-center gap-2">
                        <ShoppingBag className="w-4 h-4" />
                        {itemCount} items
                      </div>
                      {o.prepTimeMinutes != null && (
                        <div className="text-sm text-white/70 mt-1 inline-flex items-center gap-2">
                          <Timer className="w-4 h-4" />
                          Ready in {Number(o.prepTimeMinutes)} min
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Item details */}
                  {itemLines.length > 0 && (
                    <div className="mt-4 bg-black/20 rounded-xl p-3">
                      <div className="text-xs text-white/60 mb-2">Items</div>
                      <div className="space-y-2">
                        {itemLines.map((it, idx) => {
                          const qty = Number(it.quantity ?? 0)
                          const name = String(it.name ?? 'Item')
                          const mods = formatModifiers((it as any).modifiers)
                          const notes = it.notes ? String(it.notes) : ''
                          return (
                            <div key={idx} className="border-b border-white/10 last:border-b-0 pb-2 last:pb-0">
                              <div className="flex items-start justify-between gap-3">
                                <div className="text-white font-semibold">
                                  {qty}× {name}
                                </div>
                              </div>
                              {(mods || notes) && (
                                <div className="text-sm text-white/70 mt-1 space-y-1">
                                  {mods && <div>Modifiers: {mods}</div>}
                                  {notes && <div>Notes: {notes}</div>}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => viewOrderDetails(o)}
                      className="px-4 py-3 rounded-xl bg-blue-600 text-white font-extrabold hover:bg-blue-700 active:bg-blue-800 transition-colors inline-flex items-center justify-center gap-2"
                    >
                      <Eye className="w-5 h-5" />
                      Details
                    </button>
                    <button
                      onClick={() => handlePrint(o.id)}
                      className="flex-1 px-4 py-3 rounded-xl bg-white text-gray-950 font-extrabold hover:bg-white/90 active:bg-white/80 transition-colors inline-flex items-center justify-center gap-2"
                    >
                      <Printer className="w-5 h-5" />
                      Print
                    </button>
                  </div>

                  {canWriteOrders && (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        disabled={!isNew || isActing}
                        onClick={() => openAccept(o)}
                        className={`px-4 py-3 rounded-xl font-extrabold inline-flex items-center justify-center gap-2 border transition-colors ${
                          isNew
                            ? 'bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-500/25 text-emerald-100'
                            : 'bg-white/5 border-white/10 text-white/40'
                        }`}
                      >
                        <CheckCircle2 className="w-5 h-5" />
                        Accept
                      </button>
                      <button
                        disabled={!isNew || isActing}
                        onClick={() => declineOrder(o.id)}
                        className={`px-4 py-3 rounded-xl font-extrabold inline-flex items-center justify-center gap-2 border transition-colors ${
                          isNew
                            ? 'bg-red-500/15 hover:bg-red-500/25 border-red-500/25 text-red-100'
                            : 'bg-white/5 border-white/10 text-white/40'
                        }`}
                      >
                        <XCircle className="w-5 h-5" />
                        Decline
                      </button>
                    </div>
                  )}
                </div>
              )
            })}

            {todaysOrders.length === 0 && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-white/70">
                {loading ? 'Loading orders…' : 'No online orders yet.'}
              </div>
            )}
          </div>

          {/* Accept modal */}
          {activeModalOrder && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
              <div className="w-full max-w-md bg-gray-950 border border-white/10 rounded-2xl p-5">
                <div className="text-white/60 text-sm">Accept order</div>
                <div className="text-xl font-extrabold mt-1">{activeModalOrder.externalId || activeModalOrder.id}</div>
                <div className="text-white/70 text-sm mt-2">
                  How long until it’s ready?
                </div>

                <div className="mt-4 grid grid-cols-4 gap-2">
                  {[10, 15, 20, 30].map((m) => (
                    <button
                      key={m}
                      onClick={() => setPrepTimeMinutes(m)}
                      className={`px-3 py-3 rounded-xl font-extrabold border transition-colors ${
                        prepTimeMinutes === m
                          ? 'bg-white text-gray-950 border-white'
                          : 'bg-white/10 hover:bg-white/15 border-white/10 text-white'
                      }`}
                    >
                      {m}m
                    </button>
                  ))}
                </div>

                <div className="mt-3">
                  <label className="text-sm font-semibold text-white/80">Custom minutes</label>
                  <input
                    type="number"
                    min={0}
                    max={240}
                    value={prepTimeMinutes}
                    onChange={(e) => setPrepTimeMinutes(Number(e.target.value))}
                    className="mt-2 w-full bg-gray-900 border border-white/10 rounded-xl px-4 py-3 text-white text-lg outline-none focus:ring-2 focus:ring-teal-500/40"
                  />
                </div>

                <div className="mt-5 flex gap-2">
                  <button
                    onClick={() => setActiveModalOrder(null)}
                    className="flex-1 px-4 py-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 font-extrabold"
                    disabled={actingOrderId === activeModalOrder.id}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={acceptOrder}
                    className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-teal-600 to-orange-500 hover:from-teal-700 hover:to-orange-600 font-extrabold"
                    disabled={actingOrderId === activeModalOrder.id}
                  >
                    {actingOrderId === activeModalOrder.id ? 'Accepting…' : 'Accept'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Order Details Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-75">
          <div className="bg-gray-900 border border-white/20 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gray-900 border-b border-white/20 p-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white">
                    Order Details: {selectedOrder.externalId || selectedOrder.id}
                  </h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`px-2 py-1 rounded-full border text-xs font-bold ${statusPill(selectedOrder.status)}`}>
                      {selectedOrder.status}
                    </span>
                    <span className="text-sm text-white/60">
                      via {selectedOrder.channel}
                    </span>
                  </div>
                </div>
                <button
                  onClick={closeOrderDetails}
                  className="p-2 text-white/60 hover:text-white rounded-lg hover:bg-white/10"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {loadingDetails ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white/20 mx-auto"></div>
                  <p className="mt-4 text-white/60">Loading order details...</p>
                </div>
              ) : orderDetails ? (
                <>
                  {/* Customer Information */}
                  <div className="bg-black/20 rounded-xl p-4 border border-white/10">
                    <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                      <User className="w-5 h-5" />
                      Customer Information
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-white/60 mb-1">Name</label>
                        <p className="text-white font-medium">
                          {orderDetails.customerName || 'No name provided'}
                        </p>
                      </div>
                      {orderDetails.customerPhone && (
                        <div>
                          <label className="block text-sm font-medium text-white/60 mb-1">Phone</label>
                          <p className="text-white font-medium flex items-center gap-2">
                            <Phone className="w-4 h-4" />
                            {orderDetails.customerPhone}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Order Information */}
                  <div className="bg-black/20 rounded-xl p-4 border border-white/10">
                    <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                      <Clock className="w-5 h-5" />
                      Order Information
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-white/60 mb-1">Placed At</label>
                        <p className="text-white font-medium">
                          {orderDetails.createdAt ? new Date(orderDetails.createdAt).toLocaleString() : 'Unknown'}
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-white/60 mb-1">Payment</label>
                        <p className="text-white font-medium flex items-center gap-1">
                          <CreditCard className="w-4 h-4" />
                          {orderDetails.paymentStatus === 'pay_on_arrival' ? '💳 Pay on arrival' : orderDetails.paymentStatus || 'Unknown'}
                        </p>
                      </div>
                      {orderDetails.prepTimeMinutes && (
                        <>
                          <div>
                            <label className="block text-sm font-medium text-white/60 mb-1">Prep Time</label>
                            <p className="text-white font-medium">
                              {orderDetails.prepTimeMinutes} minutes
                            </p>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-white/60 mb-1">Ready At</label>
                            <p className="text-white font-medium">
                              {new Date(new Date(orderDetails.acceptedAt || orderDetails.createdAt).getTime() + orderDetails.prepTimeMinutes * 60000).toLocaleTimeString()}
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Order Items */}
                  {(orderDetails.orderItems && orderDetails.orderItems.length > 0) && (
                    <div className="bg-black/20 rounded-xl p-4 border border-white/10">
                      <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                        <Package className="w-5 h-5" />
                        Order Items
                      </h3>
                      <div className="space-y-3">
                        {orderDetails.orderItems.map((item: any, index: number) => (
                          <div key={index} className="border border-white/10 rounded-lg p-3 bg-white/5">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <h4 className="font-semibold text-white text-lg">
                                  {item.quantity}x {item.name}
                                </h4>
                                {item.notes && (
                                  <p className="text-sm text-white/70 mt-1">
                                    <strong>Notes:</strong> {item.notes}
                                  </p>
                                )}
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-white text-lg">
                                  ${((item.unitPrice || 0) * (item.quantity || 1)).toFixed(2)}
                                </p>
                                <p className="text-xs text-white/60">
                                  ${(item.unitPrice || 0).toFixed(2)} each
                                </p>
                              </div>
                            </div>
                            
                            {item.modifiers && Object.keys(item.modifiers).length > 0 && (
                              <div className="mt-2 pt-2 border-t border-white/10">
                                <p className="text-xs font-medium text-white/60 mb-2">Modifiers:</p>
                                <div className="flex flex-wrap gap-1">
                                  {Object.entries(item.modifiers).map(([key, value]) => (
                                    <span key={key} className="px-2 py-1 bg-blue-500/20 text-blue-200 border border-blue-500/30 rounded-full text-xs font-medium">
                                      {String(key).replace(/_/g, ' ')}: {String(value).replace(/_/g, ' ')}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                      
                      <div className="mt-4 pt-4 border-t border-white/10">
                        <div className="flex justify-between items-center">
                          <span className="text-xl font-semibold text-white">Total</span>
                          <span className="text-2xl font-extrabold text-white">
                            ${(orderDetails.totalAmount || 0).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handlePrint(orderDetails.id)}
                      className="flex-1 px-4 py-3 rounded-xl bg-white text-gray-950 font-extrabold hover:bg-white/90 active:bg-white/80 transition-colors inline-flex items-center justify-center gap-2"
                    >
                      <Printer className="w-5 h-5" />
                      Print Ticket
                    </button>
                    <button
                      onClick={closeOrderDetails}
                      className="px-4 py-3 rounded-xl bg-white/10 hover:bg-white/15 active:bg-white/20 transition-colors font-bold"
                    >
                      Close
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <p className="text-white/60">Failed to load order details</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {debugEnabled && (
        <div className="fixed bottom-4 right-4 z-50 rounded-xl border border-white/15 bg-black/70 text-white text-xs p-3 space-y-1 shadow-lg">
          <div className="font-semibold">Realtime Debug</div>
          <div>socket: {debugInfo?.connected ? 'connected' : 'disconnected'}</div>
          <div>socketId: {debugInfo?.id || 'n/a'}</div>
          <div>baseURL: {debugInfo?.baseUrl || 'n/a'}</div>
          <div>room: {debugInfo?.restaurantId || 'none'}</div>
          <div>last order:new: {debugInfo?.lastOrderNewAt || 'never'}</div>
        </div>
      )}
    </TabletLayout>
  )
}

