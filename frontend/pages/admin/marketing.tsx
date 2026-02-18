import React, { useEffect, useMemo, useState } from 'react'
import { Megaphone, Mail, MessageSquare, RefreshCw, Users } from 'lucide-react'
import AdminLayout from '../../components/Layout/AdminLayout'
import { api } from '../../lib/api'
import { getErrorMessage } from '../../lib/utils'

type Customer = { id: string; name?: string; email?: string; phone?: string; restaurant_name: string; total_spent?: number }
type Campaign = { id: string; name: string; channel: 'sms' | 'email' | 'both'; status: string; created_at: string; total_customers: number }

export default function AdminMarketingPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [name, setName] = useState('')
  const [channel, setChannel] = useState<'sms' | 'email' | 'both'>('both')
  const [message, setMessage] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [customersRes, campaignsRes] = await Promise.all([
        api.get('/api/admin/marketing/customers'),
        api.get('/api/admin/marketing/campaigns')
      ])
      setCustomers(customersRes.data.customers || [])
      setCampaigns(campaignsRes.data.campaigns || [])
    } catch (err: any) {
      setError(getErrorMessage(err, 'Failed to load marketing data'))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { load().catch(() => undefined) }, [])

  const reachable = useMemo(() => customers.filter((c) => c.email || c.phone), [customers])
  const smsReachable = useMemo(() => customers.filter((c) => c.phone).length, [customers])
  const emailReachable = useMemo(() => customers.filter((c) => c.email).length, [customers])
  const audienceValue = useMemo(() => customers.reduce((sum, c) => sum + Number(c.total_spent || 0), 0), [customers])

  const createCampaign = async () => {
    if (!name.trim() || !message.trim()) return
    setIsSaving(true)
    setError(null)
    try {
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
    } catch (err: any) {
      setError(getErrorMessage(err, 'Failed to create campaign'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <AdminLayout title="Marketing" description="Plan and launch campaigns using real customer reach data.">
      <div className="space-y-4">
        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard icon={Users} label="Reachable customers" value={String(reachable.length)} />
          <MetricCard icon={MessageSquare} label="SMS reachable" value={String(smsReachable)} />
          <MetricCard icon={Mail} label="Email reachable" value={String(emailReachable)} />
          <MetricCard icon={Megaphone} label="Audience value" value={`$${audienceValue.toFixed(2)}`} />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 dark:text-white">Create campaign</h2>
              <button onClick={load} disabled={isLoading} className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2.5 py-1 text-xs text-gray-600 dark:border-gray-600 dark:text-gray-300">
                <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
            <div className="grid gap-3">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Campaign name" className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900" />
              <select value={channel} onChange={(e) => setChannel(e.target.value as 'sms' | 'email' | 'both')} className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900">
                <option value="both">SMS + Email</option>
                <option value="sms">SMS only</option>
                <option value="email">Email only</option>
              </select>
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Campaign message" rows={4} className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900" />
              <button onClick={createCampaign} disabled={isSaving || isLoading} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60">
                {isSaving ? 'Saving...' : 'Save campaign draft'}
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <h3 className="font-semibold text-gray-900 dark:text-white">Audience quality</h3>
            <p className="mt-2 text-sm text-gray-500">Customers with contact data and recent spend are prioritized first.</p>
            <div className="mt-4 space-y-2 text-sm">
              <p className="text-gray-700 dark:text-gray-200">Total customers: <span className="font-medium">{customers.length}</span></p>
              <p className="text-gray-700 dark:text-gray-200">Reachable today: <span className="font-medium">{reachable.length}</span></p>
              <p className="text-gray-700 dark:text-gray-200">Draft campaigns: <span className="font-medium">{campaigns.filter((campaign) => campaign.status === 'draft').length}</span></p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <h3 className="mb-3 font-semibold text-gray-900 dark:text-white">Recent campaigns</h3>
          <div className="space-y-2">
            {isLoading ? <p className="text-sm text-gray-500">Loading campaigns…</p> : campaigns.length === 0 ? <p className="text-sm text-gray-500">No campaigns found.</p> : campaigns.map((campaign) => (
              <div key={campaign.id} className="rounded-lg border border-gray-100 px-3 py-3 text-sm dark:border-gray-700">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">{campaign.name}</div>
                    <div className="text-xs text-gray-500">Created {new Date(campaign.created_at).toLocaleString()}</div>
                  </div>
                  <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium uppercase text-gray-700 dark:bg-gray-700 dark:text-gray-100">{campaign.channel}</span>
                </div>
                <div className="mt-2 text-xs text-gray-500">{campaign.status} • {campaign.total_customers} customers</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}

function MetricCard({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">{label}</p>
        <Icon className="h-4 w-4 text-red-600" />
      </div>
      <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">{value}</p>
    </div>
  )
}
