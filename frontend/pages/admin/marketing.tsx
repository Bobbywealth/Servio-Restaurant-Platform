import React, { useEffect, useMemo, useState } from 'react'
import { BarChart3, CalendarClock, Mail, Megaphone, MessageSquare, RefreshCw, Send, Users, XCircle } from 'lucide-react'
import AdminLayout from '../../components/Layout/AdminLayout'
import { api } from '../../lib/api'
import { getErrorMessage } from '../../lib/utils'

type TabKey = 'audience' | 'builder' | 'performance'

type Customer = {
  id: string
  name?: string
  email?: string
  phone?: string
  restaurant_name: string
  total_spent?: number
  last_order_date?: string
}

type Campaign = {
  id: string
  name: string
  channel: 'sms' | 'email' | 'both'
  status: string
  created_at: string
  scheduled_at?: string | null
  sent_at?: string | null
  cancelled_at?: string | null
  total_customers: number
  sent_count: number
  delivered_count: number
  click_count: number
  revenue_attributed: number
}

type SpendBand = 'all' | 'low' | 'mid' | 'high'
type LastOrderWindow = 'all' | '30' | '60' | '90'
type ReachableChannel = 'all' | 'sms' | 'email' | 'both'

type CampaignSortField = 'created_at' | 'name' | 'status' | 'sent_count' | 'revenue_attributed'

type Pagination = { page: number; limit: number; total: number; pages: number }

const DEFAULT_PAGINATION: Pagination = { page: 1, limit: 8, total: 0, pages: 1 }

const getStatusBadge = (campaign: Campaign) => {
  const status = campaign.cancelled_at ? 'cancelled' : campaign.status
  if (status === 'sent') return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
  if (status === 'scheduled') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
  if (status === 'cancelled') return 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200'
  return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
}

export default function AdminMarketingPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('audience')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [pagination, setPagination] = useState<Pagination>(DEFAULT_PAGINATION)
  const [sortBy, setSortBy] = useState<CampaignSortField>('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  const [restaurantFilter, setRestaurantFilter] = useState('all')
  const [spendBand, setSpendBand] = useState<SpendBand>('all')
  const [lastOrderWindow, setLastOrderWindow] = useState<LastOrderWindow>('all')
  const [reachableChannel, setReachableChannel] = useState<ReachableChannel>('all')

  const [name, setName] = useState('')
  const [channel, setChannel] = useState<'sms' | 'email' | 'both'>('both')
  const [message, setMessage] = useState('')

  const [isAudienceLoading, setIsAudienceLoading] = useState(true)
  const [isCampaignLoading, setIsCampaignLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isUpdatingActionId, setIsUpdatingActionId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadCustomers = async () => {
    setIsAudienceLoading(true)
    try {
      const customersRes = await api.get('/api/admin/marketing/customers')
      setCustomers(customersRes.data.customers || [])
    } finally {
      setIsAudienceLoading(false)
    }
  }

  const loadCampaigns = async (page = pagination.page) => {
    setIsCampaignLoading(true)
    try {
      const campaignsRes = await api.get('/api/admin/marketing/campaigns', {
        params: { page, limit: pagination.limit, sort_by: sortBy, sort_order: sortOrder }
      })
      setCampaigns(campaignsRes.data.campaigns || [])
      setPagination(campaignsRes.data.pagination || DEFAULT_PAGINATION)
    } finally {
      setIsCampaignLoading(false)
    }
  }

  const load = async (page = pagination.page) => {
    setError(null)
    try {
      await Promise.all([loadCustomers(), loadCampaigns(page)])
    } catch (err: any) {
      setError(getErrorMessage(err, 'Failed to load marketing data'))
    }
  }

  useEffect(() => {
    load().catch(() => undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    loadCampaigns(1).catch((err) => setError(getErrorMessage(err, 'Failed to load campaigns')))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortBy, sortOrder])

  const restaurants = useMemo(() => ['all', ...Array.from(new Set(customers.map((c) => c.restaurant_name)))], [customers])

  const filteredCustomers = useMemo(() => {
    return customers.filter((customer) => {
      const spend = Number(customer.total_spent || 0)
      const restaurantMatch = restaurantFilter === 'all' || customer.restaurant_name === restaurantFilter
      const spendMatch = spendBand === 'all'
        || (spendBand === 'low' && spend < 100)
        || (spendBand === 'mid' && spend >= 100 && spend < 300)
        || (spendBand === 'high' && spend >= 300)

      const orderDate = customer.last_order_date ? new Date(customer.last_order_date) : null
      const daysSinceOrder = orderDate ? Math.floor((Date.now() - orderDate.getTime()) / (1000 * 60 * 60 * 24)) : Number.POSITIVE_INFINITY
      const orderWindowMatch = lastOrderWindow === 'all' || daysSinceOrder <= Number(lastOrderWindow)

      const hasSms = Boolean(customer.phone)
      const hasEmail = Boolean(customer.email)
      const reachableMatch = reachableChannel === 'all'
        || (reachableChannel === 'sms' && hasSms)
        || (reachableChannel === 'email' && hasEmail)
        || (reachableChannel === 'both' && hasSms && hasEmail)

      return restaurantMatch && spendMatch && orderWindowMatch && reachableMatch
    })
  }, [customers, lastOrderWindow, reachableChannel, restaurantFilter, spendBand])

  const audienceValue = useMemo(() => filteredCustomers.reduce((sum, c) => sum + Number(c.total_spent || 0), 0), [filteredCustomers])
  const smsReachable = useMemo(() => filteredCustomers.filter((c) => c.phone).length, [filteredCustomers])
  const emailReachable = useMemo(() => filteredCustomers.filter((c) => c.email).length, [filteredCustomers])

  const performance = useMemo(() => campaigns.reduce((acc, campaign) => {
    acc.sent += Number(campaign.sent_count || 0)
    acc.delivered += Number(campaign.delivered_count || 0)
    acc.clicks += Number(campaign.click_count || 0)
    acc.revenue += Number(campaign.revenue_attributed || 0)
    return acc
  }, { sent: 0, delivered: 0, clicks: 0, revenue: 0 }), [campaigns])

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
        total_customers: filteredCustomers.length,
        audience_filter: JSON.stringify({ restaurantFilter, spendBand, lastOrderWindow, reachableChannel })
      })
      setName('')
      setMessage('')
      setActiveTab('performance')
      await loadCampaigns(1)
    } catch (err: any) {
      setError(getErrorMessage(err, 'Failed to create campaign'))
    } finally {
      setIsSaving(false)
    }
  }

  const performCampaignAction = async (campaignId: string, action: 'schedule' | 'send' | 'cancel') => {
    setIsUpdatingActionId(campaignId)
    setError(null)
    try {
      await api.post(`/api/admin/marketing/campaigns/${campaignId}/action`, { action })
      await loadCampaigns(pagination.page)
    } catch (err: any) {
      setError(getErrorMessage(err, `Failed to ${action} campaign`))
    } finally {
      setIsUpdatingActionId(null)
    }
  }

  return (
    <AdminLayout title="Marketing" description="Plan and launch campaigns using real customer reach data.">
      <div className="space-y-4">
        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <div className="rounded-xl border border-gray-200 bg-white p-2 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="flex flex-wrap gap-2">
            <TabButton label="Audience" active={activeTab === 'audience'} onClick={() => setActiveTab('audience')} />
            <TabButton label="Campaign Builder" active={activeTab === 'builder'} onClick={() => setActiveTab('builder')} />
            <TabButton label="Campaign Performance" active={activeTab === 'performance'} onClick={() => setActiveTab('performance')} />
            <button onClick={() => load().catch(() => undefined)} disabled={isAudienceLoading || isCampaignLoading} className="ml-auto inline-flex items-center gap-1 rounded-md border border-gray-300 px-2.5 py-1 text-xs text-gray-600 dark:border-gray-600 dark:text-gray-300">
              <RefreshCw className={`h-3.5 w-3.5 ${(isAudienceLoading || isCampaignLoading) ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {activeTab === 'audience' && (
          <div className="space-y-4">
            {isAudienceLoading ? <SectionSkeleton /> : (
              <>
                <div className="grid gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 md:grid-cols-4">
                  <FilterSelect label="Restaurant" value={restaurantFilter} onChange={setRestaurantFilter} options={restaurants.map((restaurant) => ({ label: restaurant === 'all' ? 'All restaurants' : restaurant, value: restaurant }))} />
                  <FilterSelect label="Spend band" value={spendBand} onChange={(value) => setSpendBand(value as SpendBand)} options={[{ label: 'All spend tiers', value: 'all' }, { label: 'Low (< $100)', value: 'low' }, { label: 'Mid ($100 - $299)', value: 'mid' }, { label: 'High ($300+)', value: 'high' }]} />
                  <FilterSelect label="Last-order window" value={lastOrderWindow} onChange={(value) => setLastOrderWindow(value as LastOrderWindow)} options={[{ label: 'All time', value: 'all' }, { label: 'Last 30 days', value: '30' }, { label: 'Last 60 days', value: '60' }, { label: 'Last 90 days', value: '90' }]} />
                  <FilterSelect label="Reachable channel" value={reachableChannel} onChange={(value) => setReachableChannel(value as ReachableChannel)} options={[{ label: 'Any reachable', value: 'all' }, { label: 'SMS', value: 'sms' }, { label: 'Email', value: 'email' }, { label: 'SMS + Email', value: 'both' }]} />
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <MetricCard icon={Users} label="Reachable customers" value={String(filteredCustomers.length)} />
                  <MetricCard icon={MessageSquare} label="SMS reachable" value={String(smsReachable)} />
                  <MetricCard icon={Mail} label="Email reachable" value={String(emailReachable)} />
                  <MetricCard icon={Megaphone} label="Audience value" value={`$${audienceValue.toFixed(2)}`} />
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'builder' && (
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            {isAudienceLoading ? <SectionSkeleton /> : (
              <div className="grid gap-3">
                <h2 className="font-semibold text-gray-900 dark:text-white">Create campaign</h2>
                <p className="text-xs text-gray-500">Current audience: {filteredCustomers.length} customers ({reachableChannel.toUpperCase()} reach).</p>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Campaign name" className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900" />
                <select value={channel} onChange={(e) => setChannel(e.target.value as 'sms' | 'email' | 'both')} className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900">
                  <option value="both">SMS + Email</option>
                  <option value="sms">SMS only</option>
                  <option value="email">Email only</option>
                </select>
                <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Campaign message" rows={4} className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900" />
                <button onClick={createCampaign} disabled={isSaving || isCampaignLoading} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60">
                  {isSaving ? 'Saving...' : 'Save campaign draft'}
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'performance' && (
          <div className="space-y-4">
            {isCampaignLoading ? <SectionSkeleton /> : (
              <>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <MetricCard icon={Send} label="Sent" value={String(performance.sent)} />
                  <MetricCard icon={Users} label="Delivered" value={String(performance.delivered)} />
                  <MetricCard icon={BarChart3} label="Clicks" value={String(performance.clicks)} />
                  <MetricCard icon={Megaphone} label="Attributed revenue" value={`$${performance.revenue.toFixed(2)}`} />
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-semibold text-gray-900 dark:text-white">Campaign history</h3>
                    <div className="flex items-center gap-2">
                      <select value={sortBy} onChange={(e) => setSortBy(e.target.value as CampaignSortField)} className="rounded-lg border border-gray-300 px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-900">
                        <option value="created_at">Sort: Created</option>
                        <option value="name">Sort: Name</option>
                        <option value="status">Sort: Status</option>
                        <option value="sent_count">Sort: Sent count</option>
                        <option value="revenue_attributed">Sort: Revenue</option>
                      </select>
                      <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')} className="rounded-lg border border-gray-300 px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-900">
                        <option value="desc">Desc</option>
                        <option value="asc">Asc</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {campaigns.length === 0 ? <p className="text-sm text-gray-500">No campaigns found.</p> : campaigns.map((campaign) => (
                      <div key={campaign.id} className="rounded-lg border border-gray-100 px-3 py-3 text-sm dark:border-gray-700">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <div className="font-medium text-gray-900 dark:text-white">{campaign.name}</div>
                            <div className="text-xs text-gray-500">Created {new Date(campaign.created_at).toLocaleString()}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`rounded-full px-2 py-1 text-xs font-medium uppercase ${getStatusBadge(campaign)}`}>{campaign.cancelled_at ? 'cancelled' : campaign.status}</span>
                            <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium uppercase text-gray-700 dark:bg-gray-700 dark:text-gray-100">{campaign.channel}</span>
                          </div>
                        </div>
                        <div className="mt-2 grid gap-1 text-xs text-gray-500 sm:grid-cols-2">
                          <p>Sent: {campaign.sent_count} • Delivered: {campaign.delivered_count} • Clicks: {campaign.click_count}</p>
                          <p>Attributed revenue: ${Number(campaign.revenue_attributed || 0).toFixed(2)}</p>
                          {campaign.scheduled_at && <p className="inline-flex items-center gap-1"><CalendarClock className="h-3 w-3" /> Scheduled {new Date(campaign.scheduled_at).toLocaleString()}</p>}
                          {campaign.sent_at && <p>Sent at {new Date(campaign.sent_at).toLocaleString()}</p>}
                          {campaign.cancelled_at && <p>Cancelled at {new Date(campaign.cancelled_at).toLocaleString()}</p>}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button disabled={isUpdatingActionId === campaign.id} onClick={() => performCampaignAction(campaign.id, 'schedule')} className="rounded-md border border-blue-200 px-2.5 py-1 text-xs text-blue-700 hover:bg-blue-50 disabled:opacity-50 dark:border-blue-700 dark:text-blue-300">Schedule</button>
                          <button disabled={isUpdatingActionId === campaign.id} onClick={() => performCampaignAction(campaign.id, 'send')} className="rounded-md border border-green-200 px-2.5 py-1 text-xs text-green-700 hover:bg-green-50 disabled:opacity-50 dark:border-green-700 dark:text-green-300">Send now</button>
                          <button disabled={isUpdatingActionId === campaign.id} onClick={() => performCampaignAction(campaign.id, 'cancel')} className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2.5 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300"><XCircle className="h-3.5 w-3.5" />Cancel</button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
                    <p>Page {pagination.page} of {pagination.pages} ({pagination.total} campaigns)</p>
                    <div className="flex items-center gap-2">
                      <button disabled={pagination.page <= 1 || isCampaignLoading} onClick={() => loadCampaigns(pagination.page - 1).catch(() => undefined)} className="rounded-md border border-gray-300 px-2 py-1 disabled:opacity-50 dark:border-gray-600">Previous</button>
                      <button disabled={pagination.page >= pagination.pages || isCampaignLoading} onClick={() => loadCampaigns(pagination.page + 1).catch(() => undefined)} className="rounded-md border border-gray-300 px-2 py-1 disabled:opacity-50 dark:border-gray-600">Next</button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${active ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200'}`}>
      {label}
    </button>
  )
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ label: string; value: string }> }) {
  return (
    <label className="grid gap-1 text-xs text-gray-600 dark:text-gray-300">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-900">
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  )
}

function SectionSkeleton() {
  return (
    <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="h-4 w-1/3 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
      <div className="h-10 w-full animate-pulse rounded bg-gray-100 dark:bg-gray-700" />
      <div className="h-10 w-full animate-pulse rounded bg-gray-100 dark:bg-gray-700" />
      <div className="h-24 w-full animate-pulse rounded bg-gray-100 dark:bg-gray-700" />
    </div>
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
