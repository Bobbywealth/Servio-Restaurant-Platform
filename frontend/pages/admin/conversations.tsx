import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { MessageSquare, Phone, RefreshCw, Search, AlertCircle, CheckCircle2 } from 'lucide-react'
import AdminLayout from '../../components/Layout/AdminLayout'
import { api } from '../../lib/api'

interface RestaurantOption {
  id: string
  name: string
}

interface ConversationRow {
  id: string
  restaurant_id: string
  restaurant_name: string | null
  started_at: string
  ended_at: string | null
  duration_seconds: number | null
  direction: 'inbound' | 'outbound' | null
  from_number: string | null
  to_number: string | null
  status: string
  intent_primary: string | null
  outcome: string | null
  sentiment: string | null
  quality_score: number | null
  reviewed_at: string | null
}

interface ConversationsResponse {
  conversations: ConversationRow[]
  stats: {
    total_calls: number
    completed_calls: number
    non_completed_calls: number
    average_duration_seconds: number
    positive_calls: number
    negative_calls: number
  }
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

const formatDuration = (seconds: number | null) => {
  if (!seconds || seconds <= 0) return '—'
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`
}

const maskNumber = (value: string | null) => {
  if (!value) return 'Unknown'
  const cleaned = value.replace(/\D/g, '')
  if (cleaned.length < 4) return value
  return `***-***-${cleaned.slice(-4)}`
}

export default function AdminConversationsPage() {
  const [restaurants, setRestaurants] = useState<RestaurantOption[]>([])
  const [selectedRestaurant, setSelectedRestaurant] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState<ConversationRow[]>([])
  const [stats, setStats] = useState<ConversationsResponse['stats'] | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchRestaurants = useCallback(async () => {
    const response = await api.get('/api/admin/restaurants', {
      params: { limit: 200 }
    })
    const list = Array.isArray(response.data?.restaurants) ? response.data.restaurants : []
    setRestaurants(list.map((item: any) => ({ id: item.id, name: item.name })))
  }, [])

  const fetchConversations = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)

    try {
      const response = await api.get<ConversationsResponse>('/api/admin/conversations', {
        params: {
          limit: 100,
          restaurantId: selectedRestaurant || undefined,
          status: statusFilter,
          search: search || undefined,
          days: 30
        }
      })

      setRows(response.data.conversations || [])
      setStats(response.data.stats)
    } catch (err: any) {
      console.error('Failed to load admin conversations:', err)
      setError(err?.response?.data?.error || err?.message || 'Failed to load conversations')
      setRows([])
      setStats(null)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [search, selectedRestaurant, statusFilter])

  useEffect(() => {
    fetchRestaurants()
  }, [fetchRestaurants])

  useEffect(() => {
    fetchConversations()
  }, [fetchConversations])

  const completionRate = useMemo(() => {
    if (!stats?.total_calls) return 0
    return Math.round((stats.completed_calls / stats.total_calls) * 100)
  }, [stats])

  return (
    <AdminLayout
      title="Conversations"
      description="Monitor AI phone conversations across all restaurants"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
            <p className="text-xs text-gray-500">Total Calls (30d)</p>
            <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{stats?.total_calls ?? 0}</p>
          </div>
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
            <p className="text-xs text-gray-500">Completion Rate</p>
            <p className="text-2xl font-semibold text-green-600">{completionRate}%</p>
          </div>
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
            <p className="text-xs text-gray-500">Avg Duration</p>
            <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{formatDuration(stats?.average_duration_seconds ?? 0)}</p>
          </div>
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
            <p className="text-xs text-gray-500">Sentiment (Pos/Neg)</p>
            <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{stats?.positive_calls ?? 0} / {stats?.negative_calls ?? 0}</p>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
            <select
              value={selectedRestaurant}
              onChange={(e) => setSelectedRestaurant(e.target.value)}
              className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
            >
              <option value="">All restaurants</option>
              {restaurants.map((restaurant) => (
                <option key={restaurant.id} value={restaurant.id}>{restaurant.name}</option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
            >
              <option value="all">All statuses</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="no_answer">No Answer</option>
              <option value="transcript_pending">Transcript Pending</option>
              <option value="analyzing">Analyzing</option>
              <option value="transcript_failed">Transcript Failed</option>
              <option value="analysis_failed">Analysis Failed</option>
            </select>

            <div className="relative lg:col-span-2">
              <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search restaurant, phone, summary or intent"
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 pl-9 pr-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="mt-3 flex justify-end">
            <button
              onClick={() => fetchConversations(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 text-white px-4 py-2 text-sm hover:bg-red-700"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
          {error && (
            <div className="m-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/40 text-gray-500">
                <tr>
                  <th className="text-left px-4 py-3">Restaurant</th>
                  <th className="text-left px-4 py-3">Call</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Intent/Outcome</th>
                  <th className="text-left px-4 py-3">Quality</th>
                  <th className="text-left px-4 py-3">Started</th>
                </tr>
              </thead>
              <tbody>
                {!loading && rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-gray-500">
                      <MessageSquare className="h-6 w-6 mx-auto mb-2 text-gray-400" />
                      No conversations found for the selected filters.
                    </td>
                  </tr>
                )}

                {loading && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-gray-500">Loading conversations…</td>
                  </tr>
                )}

                {!loading && rows.map((conversation) => (
                  <tr key={conversation.id} className="border-t border-gray-100 dark:border-gray-700/60">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 dark:text-gray-100">{conversation.restaurant_name || 'Unknown'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-gray-600 dark:text-gray-300">
                        <div className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{maskNumber(conversation.from_number)}</div>
                        <div className="text-xs text-gray-500">{formatDuration(conversation.duration_seconds)}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full bg-gray-100 dark:bg-gray-700 px-2 py-1 text-xs">{conversation.status}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                      <div>{conversation.intent_primary || '—'}</div>
                      <div className="text-xs text-gray-500">{conversation.outcome || '—'} • {conversation.sentiment || '—'}</div>
                    </td>
                    <td className="px-4 py-3">
                      {conversation.quality_score !== null ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 text-green-700 px-2 py-1 text-xs">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {conversation.quality_score}%
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                      <div>{new Date(conversation.started_at).toLocaleDateString()}</div>
                      <div className="text-xs text-gray-500">{new Date(conversation.started_at).toLocaleTimeString()}</div>
                      <Link href={`/admin/restaurants/${conversation.restaurant_id}`} className="text-xs text-red-600 hover:text-red-700">View restaurant</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
