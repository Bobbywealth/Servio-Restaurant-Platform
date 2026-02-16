import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Megaphone, Search, AlertCircle, CheckCircle2, Clock, XCircle, ExternalLink } from 'lucide-react'
import AdminLayout from '../../components/Layout/AdminLayout'
import { api } from '../../lib/api'
import { getErrorMessage } from '../../lib/utils'
import Link from 'next/link'
import { useSocket } from '../../lib/socket'

/**
 * API contract: GET /api/admin/campaigns
 * Response: { campaigns: Campaign[], pagination: { page, limit, total, pages } }
 */
interface Campaign {
  id: string
  restaurant_id: string
  restaurant_name?: string
  name: string
  type: 'sms' | 'email'
  status: string
  message: string
  scheduled_at?: string
  sent_at?: string
  total_recipients: number
  successful_sends: number
  failed_sends: number
  created_at: string
}

type CampaignEventType = 'created' | 'approved' | 'disapproved' | 'sent'

interface CampaignEvent {
  id: string
  event_type: CampaignEventType
  action: string
  label: string
  campaign_id: string
  campaign_name: string | null
  restaurant_id: string | null
  restaurant_name: string | null
  timestamp: string
  metadata: Record<string, unknown>
  view_url: string
}

const EVENT_FILTERS: Array<'all' | CampaignEventType> = ['all', 'created', 'approved', 'disapproved', 'sent']

export default function AdminCampaigns() {
  const socket = useSocket()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [campaignFilter, setCampaignFilter] = useState<string>('all')
  const [eventFilter, setEventFilter] = useState<'all' | CampaignEventType>('all')
  const [campaignEvents, setCampaignEvents] = useState<CampaignEvent[]>([])
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isEventsLoading, setIsEventsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [pendingMutationId, setPendingMutationId] = useState<string | null>(null)

  const fetchCampaigns = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const status = campaignFilter === 'all' ? '' : campaignFilter
      const response = await api.get(`/api/admin/campaigns?status=${status}&limit=100`)
      setCampaigns(response.data.campaigns || [])
    } catch (err: any) {
      console.error('Failed to fetch campaigns:', err)
      setError(getErrorMessage(err, 'Failed to load campaigns'))
    } finally {
      setIsLoading(false)
    }
  }, [campaignFilter])

  const fetchCampaignEvents = useCallback(async () => {
    setIsEventsLoading(true)
    try {
      const queryType = eventFilter === 'all' ? '' : `&eventType=${eventFilter}`
      const response = await api.get(`/api/admin/campaign-events?limit=20${queryType}`)
      setCampaignEvents(response.data.events || [])
    } catch (err) {
      console.error('Failed to fetch campaign events:', err)
    } finally {
      setIsEventsLoading(false)
    }
  }, [eventFilter])

  useEffect(() => {
    fetchCampaigns()
  }, [fetchCampaigns])

  useEffect(() => {
    fetchCampaignEvents()
  }, [fetchCampaignEvents])

  useEffect(() => {
    const onCampaignEvent = (event: {
      eventType: CampaignEventType
      campaignId: string
      campaignName?: string
      restaurantId: string
      restaurantName?: string
      timestamp: string
      metadata?: Record<string, unknown>
    }) => {
      const shouldDisplay = eventFilter === 'all' || eventFilter === event.eventType
      if (!shouldDisplay) {
        return
      }

      setCampaignEvents((prev) => [
        {
          id: `${event.campaignId}-${event.timestamp}`,
          event_type: event.eventType,
          action: `campaign_${event.eventType}`,
          label: `Campaign ${event.eventType}`,
          campaign_id: event.campaignId,
          campaign_name: event.campaignName || null,
          restaurant_id: event.restaurantId,
          restaurant_name: event.restaurantName || null,
          timestamp: event.timestamp,
          metadata: event.metadata || {},
          view_url: `/admin/restaurants/${event.restaurantId}?tab=campaigns&campaignId=${event.campaignId}`
        },
        ...prev
      ].slice(0, 20))
    }

    socket.on('campaign:event', onCampaignEvent)
    return () => {
      socket.off('campaign:event', onCampaignEvent)
    }
  }, [eventFilter, socket])

  const filteredCampaigns = useMemo(() => campaigns.filter(c =>
    search === '' ||
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.restaurant_name?.toLowerCase().includes(search.toLowerCase())
  ), [campaigns, search])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
      case 'approved':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />
      case 'sending':
      case 'pending_owner_approval':
        return <Clock className="h-4 w-4 text-blue-600" />
      case 'failed':
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-600" />
      case 'draft':
      case 'scheduled':
        return <Clock className="h-4 w-4 text-yellow-600" />
      default:
        return <AlertCircle className="h-4 w-4 text-gray-600" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent':
      case 'approved':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300'
      case 'sending':
      case 'pending_owner_approval':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300'
      case 'failed':
      case 'rejected':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300'
      case 'draft':
      case 'scheduled':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300'
    }
  }

  return (
    <AdminLayout title="Campaigns" description="Global marketing campaign management">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Marketing Campaigns</h1>
          <p className="text-gray-600 dark:text-gray-400">Monitor and manage campaigns across all restaurants</p>
        </div>

        <div className="mb-6 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Campaign announcements</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Latest create/approval/send lifecycle events.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {EVENT_FILTERS.map((type) => (
                <button
                  key={type}
                  onClick={() => setEventFilter(type)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    eventFilter === type
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {type === 'all' ? 'All events' : type[0].toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {isEventsLoading ? (
            <div className="text-sm text-gray-500 dark:text-gray-400">Loading campaign events…</div>
          ) : campaignEvents.length === 0 ? (
            <div className="text-sm text-gray-500 dark:text-gray-400">No campaign events found for this filter.</div>
          ) : (
            <div className="space-y-2">
              {campaignEvents.map((event) => (
                <div key={event.id} className="flex items-start justify-between gap-3 rounded-md border border-gray-100 dark:border-gray-700 px-3 py-2">
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">{event.label}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {event.campaign_name || event.campaign_id} • {event.restaurant_name || 'Unknown restaurant'}
                    </div>
                    <div className="text-xs text-gray-400 dark:text-gray-500">{new Date(event.timestamp).toLocaleString()}</div>
                  </div>
                  <Link href={event.view_url} className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-500">
                    View campaign
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search campaigns..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
          <div className="flex gap-2">
            {['all', 'pending_owner_approval', 'approved', 'scheduled', 'rejected', 'sent', 'failed'].map((status) => (
              <button
                key={status}
                onClick={() => setCampaignFilter(status)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  campaignFilter === status
                    ? 'bg-red-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                {status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
            <div className="flex">
              <AlertCircle className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Error</h3>
                <div className="mt-2 text-sm text-red-700 dark:text-red-300">{error}</div>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-2"></div>
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          ) : filteredCampaigns.length ? (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredCampaigns.map((campaign, index) => {
                const isPendingApproval = campaign.status === 'pending_owner_approval'
                const isMutating = pendingMutationId === campaign.id

                return (
                  <motion.div
                    key={campaign.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          {getStatusIcon(campaign.status)}
                          <h3 className="text-lg font-medium text-gray-900 dark:text-white">{campaign.name}</h3>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(campaign.status)}`}>
                            {campaign.status}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                          {campaign.restaurant_name} • {campaign.type.toUpperCase()}
                        </p>
                        <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">{campaign.message}</p>
                        <div className="mt-3 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                          <span>Recipients: {campaign.total_recipients}</span>
                          <span>Success: {campaign.successful_sends}</span>
                          {campaign.failed_sends > 0 && (
                            <span className="text-red-600">Failed: {campaign.failed_sends}</span>
                          )}
                          <span>Created: {new Date(campaign.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>

                      {isPendingApproval && (
                        <div className="flex flex-col sm:flex-row gap-2">
                          <button
                            type="button"
                            disabled={isMutating}
                            onClick={() => handleModeration(campaign.id, 'approve')}
                            className="px-3 py-1.5 text-sm rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isMutating ? 'Working...' : 'Approve'}
                          </button>
                          <button
                            type="button"
                            disabled={isMutating}
                            onClick={() => handleModeration(campaign.id, 'disapprove')}
                            className="px-3 py-1.5 text-sm rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isMutating ? 'Working...' : 'Disapprove'}
                          </button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )
              })}
            </div>
          ) : (
            <div className="p-12 text-center">
              <Megaphone className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No campaigns found</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {search ? 'Try adjusting your search or filters' : 'No campaigns match the selected filter'}
              </p>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}
