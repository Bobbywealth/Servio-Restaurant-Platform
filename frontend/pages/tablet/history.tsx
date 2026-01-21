'use client';

import React from 'react'
import TabletLayout from '../../components/Layout/TabletLayout'
import { api } from '../../lib/api'
import { useUser } from '../../contexts/UserContext'
import { 
  History, 
  Calendar, 
  Eye, 
  X, 
  Clock, 
  User, 
  Phone, 
  CreditCard, 
  Package, 
  TrendingUp,
  Search
} from 'lucide-react'

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
  external_id?: string | null
  channel?: string | null
  status: OrderStatus
  customer_name?: string | null
  customer_phone?: string | null
  total_amount?: number | null
  payment_status?: string | null
  created_at?: string | null
  updated_at?: string | null
  prep_time_minutes?: number | null
  accepted_at?: string | null
  orderItems?: OrderItem[] | null
  items?: any[] | null
}

function formatMoney(value: any) {
  const n = typeof value === 'number' ? value : Number(value ?? 0)
  return `$${n.toFixed(2)}`
}

function statusPill(status: string) {
  const s = String(status || '').toLowerCase()
  if (s === 'completed') return 'bg-green-500/20 text-green-200 border-green-500/30'
  if (s === 'cancelled') return 'bg-red-500/20 text-red-200 border-red-500/30'
  if (s === 'ready') return 'bg-emerald-500/20 text-emerald-200 border-emerald-500/30'
  if (s === 'preparing') return 'bg-amber-500/20 text-amber-200 border-amber-500/30'
  if (s === 'received') return 'bg-orange-500/20 text-orange-200 border-orange-500/30'
  return 'bg-white/10 text-white/80 border-white/10'
}

export default function TabletHistoryPage() {
  const { user, hasPermission } = useUser()

  const [orders, setOrders] = React.useState<Order[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [selectedOrder, setSelectedOrder] = React.useState<Order | null>(null)
  const [orderDetails, setOrderDetails] = React.useState<any>(null)
  const [loadingDetails, setLoadingDetails] = React.useState(false)
  
  // Simple filters for tablet
  const [daysBack, setDaysBack] = React.useState(7)
  const [statusFilter, setStatusFilter] = React.useState<string>('all')

  const canReadOrders = hasPermission('orders:read')

  const fetchOrders = React.useCallback(async () => {
    if (!canReadOrders) return
    setLoading(true)
    setError(null)
    
    try {
      const dateFrom = new Date()
      dateFrom.setDate(dateFrom.getDate() - daysBack)
      
      const params: any = {
        dateFrom: dateFrom.toISOString().split('T')[0],
        dateTo: new Date().toISOString().split('T')[0],
        limit: 50,
        offset: 0
      }
      
      if (statusFilter !== 'all') {
        params.status = statusFilter
      }
      
      const resp = await api.get('/api/orders/history', { params })
      setOrders(resp.data?.data?.orders || [])
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || e?.message || 'Failed to load order history')
    } finally {
      setLoading(false)
    }
  }, [canReadOrders, daysBack, statusFilter])

  React.useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

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
    <TabletLayout title="Order History" onRefresh={fetchOrders}>
      {!canReadOrders ? (
        <div className="bg-red-500/15 border border-red-500/30 text-red-200 rounded-2xl p-4">
          This account doesn't have access to view order history.
        </div>
      ) : (
        <>
          {error && (
            <div className="mb-4 bg-red-500/15 border border-red-500/30 text-red-200 rounded-2xl p-4">
              {error}
            </div>
          )}

          {/* Quick Filters */}
          <div className="mb-4 flex flex-wrap gap-2">
            <div className="flex gap-2">
              {[
                { label: '1 Day', days: 1 },
                { label: '3 Days', days: 3 },
                { label: '7 Days', days: 7 },
                { label: '30 Days', days: 30 }
              ].map(period => (
                <button
                  key={period.days}
                  onClick={() => setDaysBack(period.days)}
                  className={`px-3 py-2 rounded-xl font-bold text-sm transition-colors ${
                    daysBack === period.days
                      ? 'bg-white text-gray-950'
                      : 'bg-white/10 hover:bg-white/15 active:bg-white/20'
                  }`}
                >
                  {period.label}
                </button>
              ))}
            </div>
            
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-gray-900 border border-white/10 rounded-xl px-3 py-2 text-white text-sm"
            >
              <option value="all">All Status</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="ready">Ready</option>
              <option value="preparing">Preparing</option>
            </select>
          </div>

          {/* Orders List */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {loading ? (
              <div className="lg:col-span-2 text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white/20 mx-auto"></div>
                <p className="mt-4 text-white/60">Loading order history...</p>
              </div>
            ) : orders.length === 0 ? (
              <div className="lg:col-span-2 bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
                <History className="h-12 w-12 text-white/40 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">No orders found</h3>
                <p className="text-white/60">Try adjusting the time period or status filter</p>
              </div>
            ) : (
              orders.map((order) => {
                const created = order.created_at ? new Date(order.created_at) : null
                const itemCount = Array.isArray(order.orderItems) ? order.orderItems.length : 0
                const daysSince = created ? Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24)) : 0

                return (
                  <div key={order.id} className="bg-white/5 border border-white/10 rounded-2xl p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="text-xl font-extrabold truncate">
                            {order.external_id || order.id}
                          </div>
                          <div className={`shrink-0 px-3 py-1 rounded-full border text-xs font-bold ${statusPill(order.status)}`}>
                            {order.status}
                          </div>
                        </div>
                        <div className="text-white/70 text-sm">
                          <div className="flex items-center gap-4 mb-1">
                            <div className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              <span>{daysSince === 0 ? 'Today' : `${daysSince}d ago`}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Package className="w-4 h-4" />
                              <span>{itemCount} items</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => viewOrderDetails(order)}
                        className="p-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 transition-colors"
                      >
                        <Eye className="w-5 h-5 text-white" />
                      </button>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="bg-black/20 rounded-xl p-3">
                        <div className="text-xs text-white/60">Customer</div>
                        <div className="text-base font-semibold truncate">
                          {order.customer_name || 'No name'}
                        </div>
                        {order.customer_phone && (
                          <div className="text-sm text-white/60 truncate">{order.customer_phone}</div>
                        )}
                      </div>
                      
                      <div className="bg-black/20 rounded-xl p-3">
                        <div className="text-xs text-white/60">Total</div>
                        <div className="text-xl font-extrabold">{formatMoney(order.total_amount ?? 0)}</div>
                        <div className="text-sm text-white/60">via {order.channel}</div>
                      </div>
                    </div>

                    <div className="mt-3 text-xs text-white/50">
                      {created ? created.toLocaleDateString() + ' ' + created.toLocaleTimeString() : 'Unknown date'}
                      {order.payment_status === 'pay_on_arrival' && (
                        <span className="ml-2 text-green-300">💳 Pay on arrival</span>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Order Details Modal */}
          {selectedOrder && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-75">
              <div className="bg-gray-900 border border-white/20 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-gray-900 border-b border-white/20 p-6 rounded-t-2xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-bold text-white">
                        Order History: {selectedOrder.external_id || selectedOrder.id}
                      </h2>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`px-2 py-1 rounded-full border text-xs font-bold ${statusPill(selectedOrder.status)}`}>
                          {selectedOrder.status}
                        </span>
                        <span className="text-sm text-white/60">
                          {selectedOrder.created_at ? new Date(selectedOrder.created_at).toLocaleDateString() : 'Unknown date'}
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
                          Customer
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <div className="text-sm text-white/60 mb-1">Name</div>
                            <div className="text-white font-medium">
                              {orderDetails.customerName || 'No name provided'}
                            </div>
                          </div>
                          {orderDetails.customerPhone && (
                            <div>
                              <div className="text-sm text-white/60 mb-1">Phone</div>
                              <div className="text-white font-medium flex items-center gap-2">
                                <Phone className="w-4 h-4" />
                                {orderDetails.customerPhone}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Order Timeline */}
                      <div className="bg-black/20 rounded-xl p-4 border border-white/10">
                        <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                          <Clock className="w-5 h-5" />
                          Timeline
                        </h3>
                        <div className="space-y-3">
                          <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                            <span className="text-white font-medium">Placed:</span>
                            <span className="text-white/70">
                              {orderDetails.createdAt ? new Date(orderDetails.createdAt).toLocaleString() : 'Unknown'}
                            </span>
                          </div>
                          {orderDetails.acceptedAt && (
                            <div className="flex items-center gap-3">
                              <div className="w-2 h-2 rounded-full bg-yellow-400"></div>
                              <span className="text-white font-medium">Accepted:</span>
                              <span className="text-white/70">
                                {new Date(orderDetails.acceptedAt).toLocaleString()}
                              </span>
                            </div>
                          )}
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${
                              orderDetails.status === 'completed' ? 'bg-green-400' : 
                              orderDetails.status === 'cancelled' ? 'bg-red-400' : 'bg-gray-400'
                            }`}></div>
                            <span className="text-white font-medium">Status:</span>
                            <span className="text-white/70 capitalize">
                              {orderDetails.status}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Order Items */}
                      {(orderDetails.orderItems && orderDetails.orderItems.length > 0) && (
                        <div className="bg-black/20 rounded-xl p-4 border border-white/10">
                          <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                            <Package className="w-5 h-5" />
                            Items
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
                            {orderDetails.paymentStatus === 'pay_on_arrival' && (
                              <div className="mt-2 text-green-300 font-medium">
                                💳 Payment: On arrival
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      <button
                        onClick={closeOrderDetails}
                        className="w-full px-4 py-3 rounded-xl bg-white/10 hover:bg-white/15 active:bg-white/20 transition-colors font-bold text-white"
                      >
                        Close
                      </button>
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
        </>
      )}
    </TabletLayout>
  )
}