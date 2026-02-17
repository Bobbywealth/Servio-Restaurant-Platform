import React, { useEffect, useMemo, useState } from 'react'
import AdminLayout from '../../components/Layout/AdminLayout'
import { api } from '../../lib/api'

type Customer = { id: string; name?: string; email?: string; phone?: string; restaurant_name: string; total_spent?: number }
type Campaign = { id: string; name: string; channel: 'sms' | 'email' | 'both'; status: string; created_at: string; total_customers: number }

export default function AdminMarketingPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [name, setName] = useState('')
  const [channel, setChannel] = useState<'sms' | 'email' | 'both'>('both')
  const [message, setMessage] = useState('')

  const load = async () => {
    const [customersRes, campaignsRes] = await Promise.all([
      api.get('/api/admin/marketing/customers'),
      api.get('/api/admin/marketing/campaigns')
    ])
    setCustomers(customersRes.data.customers || [])
    setCampaigns(campaignsRes.data.campaigns || [])
  }

  useEffect(() => { load().catch(() => undefined) }, [])

  const reachable = useMemo(() => customers.filter((c) => c.email || c.phone), [customers])

  const createCampaign = async () => {
    if (!name.trim() || !message.trim()) return
    await api.post('/api/admin/marketing/campaigns', {
      name,
      channel,
      message,
      status: 'draft',
      total_customers: reachable.length,
      audience_filter: 'all_customers'
    })
    setName('')
    setMessage('')
    await load()
  }

  return (
    <AdminLayout title="Marketing" description="Target current customers with SMS and email campaigns">
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <h2 className="font-semibold">Create Campaign</h2>
          <div className="mt-3 grid gap-3">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Campaign name" className="rounded border border-gray-300 px-3 py-2 dark:bg-gray-900" />
            <select value={channel} onChange={(e) => setChannel(e.target.value as any)} className="rounded border border-gray-300 px-3 py-2 dark:bg-gray-900">
              <option value="both">SMS + Email</option>
              <option value="sms">SMS only</option>
              <option value="email">Email only</option>
            </select>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Campaign message" rows={4} className="rounded border border-gray-300 px-3 py-2 dark:bg-gray-900" />
            <button onClick={createCampaign} className="rounded bg-red-600 px-4 py-2 font-medium text-white">Save campaign draft</button>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <h3 className="font-semibold">Audience snapshot</h3>
          <p className="mt-2 text-sm text-gray-500">Total reachable customers: {reachable.length}</p>
          <p className="text-sm text-gray-500">With phone: {customers.filter((c) => c.phone).length}</p>
          <p className="text-sm text-gray-500">With email: {customers.filter((c) => c.email).length}</p>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <h3 className="mb-2 font-semibold">Recent campaigns</h3>
        <div className="space-y-2">
          {campaigns.map((campaign) => (
            <div key={campaign.id} className="rounded border border-gray-100 px-3 py-2 text-sm dark:border-gray-700">
              <div className="font-medium">{campaign.name}</div>
              <div className="text-gray-500">{campaign.channel.toUpperCase()} • {campaign.status} • {campaign.total_customers} customers</div>
            </div>
          ))}
        </div>
      </div>
    </AdminLayout>
  )
}
