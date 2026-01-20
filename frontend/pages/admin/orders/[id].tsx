import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import AdminLayout from '../../../components/Layout/AdminLayout'
import { api } from '../../../lib/api'
import { 
  ArrowLeft, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Phone, 
  User, 
  MapPin,
  MessageSquare
} from 'lucide-react'
import Link from 'next/link'

interface OrderItem {
  item_id: string
  item_name_snapshot: string
  qty: number
  unit_price_snapshot: number
  modifiers_json: string
}

interface Order {
  id: string
  status: string
  customer_name?: string
  customer_phone?: string
  last_initial?: string
  total_amount?: number
  subtotal?: number
  tax?: number
  fees?: number
  order_type?: string
  pickup_time?: string
  created_at: string
  prep_time_minutes?: number
  items?: OrderItem[]
  call_id?: string
}

export default function AdminOrderDetailsPage() {
  const router = useRouter()
  const { id } = router.query
  const [order, setOrder] = useState<Order | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [prepTime, setPrepTime] = useState(30)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const fetchOrder = async () => {
    if (!id) return
    try {
      const res = await api.get(`/api/orders/${id}`)
      setOrder(res.data.data)
    } catch (error) {
      console.error('Failed to fetch order:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchOrder()
  }, [id])

  const handleAccept = async () => {
    setIsSubmitting(true)
    try {
      await api.post(`/api/orders/${id}/accept`, { prepTimeMinutes: prepTime })
      setSuccessMessage("Accepted + SMS sent")
      fetchOrder()
    } catch (error) {
      console.error('Failed to accept order:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) return <AdminLayout title="Loading..."><div className="p-8 text-center">Loading...</div></AdminLayout>
  if (!order) return <AdminLayout title="Not Found"><div className="p-8 text-center">Order not found</div></AdminLayout>

  const items = Array.isArray(order.items) ? order.items : []

  return (
    <AdminLayout title={`Order #${order.id.slice(-4)}`}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Link href="/admin/orders" className="text-sm text-gray-500 hover:text-gray-700 flex items-center">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Orders
          </Link>
        </div>

        {successMessage && (
          <div className="mb-6 p-4 bg-green-100 text-green-800 rounded-lg flex items-center">
            <CheckCircle className="w-5 h-5 mr-2" />
            {successMessage}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            {/* Order Info Card */}
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-xl font-bold">Items</h2>
                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                  order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                  order.status === 'accepted' ? 'bg-green-100 text-green-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {order.status}
                </span>
              </div>

              <div className="space-y-4">
                {items.map((item, idx) => {
                  const mods = JSON.parse(item.modifiers_json || '{}')
                  return (
                    <div key={idx} className="flex justify-between border-b dark:border-gray-700 pb-4 last:border-0 last:pb-0">
                      <div>
                        <p className="font-bold">{item.qty}x {item.item_name_snapshot}</p>
                        {Object.entries(mods).map(([key, val]) => (
                          <p key={key} className="text-xs text-gray-500 capitalize">{key.replace('_', ' ')}: {String(val)}</p>
                        ))}
                      </div>
                      <p className="font-medium">${(item.unit_price_snapshot * item.qty).toFixed(2)}</p>
                    </div>
                  )
                })}
              </div>

              <div className="mt-6 pt-6 border-t dark:border-gray-700 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Subtotal</span>
                  <span>${(order.subtotal || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Tax</span>
                  <span>${(order.tax || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-lg pt-2">
                  <span>Total</span>
                  <span className="text-red-600">${(order.total_amount || 0).toFixed(2)}</span>
                </div>
              </div>
            </div>

            {order.call_id && (
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 flex items-center text-sm text-gray-500">
                <Phone className="w-4 h-4 mr-2" />
                Vapi Call ID: <code className="ml-2 font-mono">{order.call_id}</code>
              </div>
            )}
          </div>

          <div className="space-y-6">
            {/* Acceptance Controls */}
            {order.status === 'pending' && (
              <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 border-t-4 border-yellow-400">
                <h3 className="font-bold mb-4 flex items-center">
                  <Clock className="w-4 h-4 mr-2" />
                  Set Prep Time
                </h3>
                
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <input 
                      type="number" 
                      value={prepTime}
                      onChange={(e) => setPrepTime(parseInt(e.target.value))}
                      className="input-field w-20"
                    />
                    <span className="text-sm text-gray-500">minutes</span>
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    {[15, 20, 25, 30, 35, 45, 60].map((t) => (
                      <button 
                        key={t}
                        onClick={() => setPrepTime(t)}
                        className={`text-xs py-2 rounded border ${prepTime === t ? 'bg-red-50 border-red-200 text-red-700' : 'bg-gray-50 border-gray-200 text-gray-600'}`}
                      >
                        {t}m
                      </button>
                    ))}
                  </div>

                  <button 
                    onClick={handleAccept}
                    disabled={isSubmitting}
                    className="w-full btn-primary py-3 flex items-center justify-center"
                  >
                    {isSubmitting ? 'Processing...' : 'ACCEPT ORDER'}
                  </button>
                </div>
              </div>
            )}

            {order.status === 'accepted' && (
              <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 border-t-4 border-green-500">
                <div className="mb-4">
                  <p className="text-xs text-gray-500 uppercase font-bold">Prep Time</p>
                  <p className="text-2xl font-bold">{order.prep_time_minutes} minutes</p>
                </div>
                
                <button className="w-full btn-secondary mb-2">COMPLETE ORDER</button>
                <button className="w-full text-red-600 text-sm font-medium hover:underline">Cancel Order</button>
              </div>
            )}

            {/* Customer Details */}
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
              <h3 className="font-bold mb-4">Customer</h3>
              <div className="space-y-3">
                <div className="flex items-center text-sm">
                  <User className="w-4 h-4 mr-2 text-gray-400" />
                  {order.customer_name} {order.last_initial}
                </div>
                <div className="flex items-center text-sm">
                  <Phone className="w-4 h-4 mr-2 text-gray-400" />
                  {order.customer_phone}
                </div>
                <div className="flex items-center text-sm">
                  <MapPin className="w-4 h-4 mr-2 text-gray-400" />
                  {order.order_type} @ {order.pickup_time}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
