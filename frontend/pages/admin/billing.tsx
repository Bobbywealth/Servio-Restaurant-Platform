import React, { useEffect, useState } from 'react'
import AdminLayout from '../../components/Layout/AdminLayout'
import { api } from '../../lib/api'

type Subscription = {
  id: string
  restaurant_name: string
  package_name: string
  status: string
  billing_cycle: string
  amount: number
  contact_email?: string
}

export default function AdminBillingPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [loading, setLoading] = useState(true)

  const fetchSubscriptions = async () => {
    setLoading(true)
    const response = await api.get('/api/admin/billing/subscriptions')
    setSubscriptions(response.data.subscriptions || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchSubscriptions().catch(() => setLoading(false))
  }, [])

  const updateSubscription = async (id: string, patch: Partial<Subscription>) => {
    await api.patch(`/api/admin/billing/subscriptions/${id}`, patch)
    await fetchSubscriptions()
  }

  return (
    <AdminLayout title="Billing" description="Track subscriptions and package assignments across restaurants">
      <div className="space-y-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Subscriptions</h2>
          <p className="text-sm text-gray-500">Manage package, status, and billing cycle from a single place.</p>
        </div>

        {loading ? <div className="text-sm text-gray-500">Loading subscriptions…</div> : (
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/30">
                <tr>
                  <th className="px-4 py-3 text-left">Restaurant</th>
                  <th className="px-4 py-3 text-left">Package</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Cycle</th>
                  <th className="px-4 py-3 text-left">Amount</th>
                  <th className="px-4 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.map((sub) => (
                  <tr key={sub.id} className="border-t border-gray-100 dark:border-gray-700">
                    <td className="px-4 py-3">{sub.restaurant_name}</td>
                    <td className="px-4 py-3">
                      <select value={sub.package_name} onChange={(e) => updateSubscription(sub.id, { package_name: e.target.value })} className="rounded border border-gray-300 px-2 py-1 dark:bg-gray-900">
                        <option value="starter">Starter</option>
                        <option value="operations">Operations</option>
                        <option value="voice">Voice</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <select value={sub.status} onChange={(e) => updateSubscription(sub.id, { status: e.target.value })} className="rounded border border-gray-300 px-2 py-1 dark:bg-gray-900">
                        <option value="active">Active</option>
                        <option value="trialing">Trialing</option>
                        <option value="past_due">Past due</option>
                        <option value="canceled">Canceled</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">{sub.billing_cycle}</td>
                    <td className="px-4 py-3">${Number(sub.amount || 0).toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => updateSubscription(sub.id, { billing_cycle: sub.billing_cycle === 'monthly' ? 'yearly' : 'monthly' })} className="rounded bg-red-600 px-3 py-1 text-white">Toggle cycle</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
