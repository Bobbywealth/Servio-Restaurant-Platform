import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Head from 'next/head'
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Timer,
  XCircle,
  Building2
} from 'lucide-react'
import AdminLayout from '../../components/Layout/AdminLayout'
import { EmptyState } from '../../components/ui/EmptyState'
import { Button } from '../../components/ui/Button'
import { api } from '../../lib/api'

type AssistantStatus = 'operational' | 'degraded' | 'down'

interface VoiceConversationStats {
  total: number
  active: number
  completed: number
  abandoned: number
  avgMessages: number
}

interface VoiceConversation {
  id: string
  status: string
  startedAt: string
  lastActivityAt: string
  restaurant_id?: string
  restaurant_name?: string
}

interface AssistantHealthData {
  status?: string
  services?: {
    assistant?: string
  }
}

interface AssistantStatusPayload {
  status: AssistantStatus
  kpis: {
    activeCalls: number
    failedCallsLast24h: number
    avgResponseLatencyMs: number | null
    transcriptionBacklog: number
  }
  incidents: AssistantIncident[]
  totalCalls: number
}

interface AssistantIncident {
  id: string
  source: string
  message: string
  severity: 'warning' | 'critical'
  timestamp: string
  restaurant_id?: string
  restaurant_name?: string
}

const getStatusMeta = (status: AssistantStatus) => {
  if (status === 'operational') {
    return {
      label: 'Operational',
      icon: CheckCircle2,
      classes: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300'
    }
  }

  if (status === 'degraded') {
    return {
      label: 'Degraded',
      icon: AlertTriangle,
      classes: 'bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300'
    }
  }

  return {
    label: 'Down',
    icon: XCircle,
    classes: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300'
  }
}

const computeTopLevelStatus = (
  stats: VoiceConversationStats,
  health?: AssistantHealthData
): AssistantStatus => {
  const assistantService = health?.services?.assistant

  if (assistantService === 'error') {
    return 'down'
  }

  if (health?.status === 'degraded' || stats.abandoned > 0) {
    return 'degraded'
  }

  return 'operational'
}

export default function AdminAssistantStatusPage() {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [payload, setPayload] = useState<AssistantStatusPayload | null>(null)
  const [lastRefreshAt, setLastRefreshAt] = useState<Date | null>(null)
  const [restaurantStats, setRestaurantStats] = useState<Record<string, { active: number; abandoned: number; name: string }>>({})

  const fetchStatus = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }

    setError(null)

    try {
      const [statsResponse, conversationsResponse, healthResponse] = await Promise.allSettled([
        api.get('/api/voice-conversations/stats'),
        api.get('/api/voice-conversations', {
          params: { limit: '100', offset: '0' }
        }),
        api.get('/api/vapi/health')
      ])

      if (statsResponse.status !== 'fulfilled' || !statsResponse.value.data?.success) {
        throw new Error('Unable to load assistant status metrics.')
      }

      const stats = statsResponse.value.data.data as VoiceConversationStats
      const conversations =
        conversationsResponse.status === 'fulfilled' && conversationsResponse.value.data?.success
          ? (conversationsResponse.value.data.data?.conversations as VoiceConversation[]) || []
          : []
      const healthData =
        healthResponse.status === 'fulfilled'
          ? (healthResponse.value.data as AssistantHealthData)
          : undefined

      // Calculate stats per restaurant
      const perRestaurant: Record<string, { active: number; abandoned: number; name: string }> = {}
      conversations.forEach((conv) => {
        const rid = conv.restaurant_id || 'unknown'
        if (!perRestaurant[rid]) {
          perRestaurant[rid] = { active: 0, abandoned: 0, name: conv.restaurant_name || 'Unknown Restaurant' }
        }
        if (conv.status === 'active' || conv.status === 'in_progress') {
          perRestaurant[rid].active++
        } else if (conv.status === 'abandoned') {
          perRestaurant[rid].abandoned++
        }
      })
      setRestaurantStats(perRestaurant)

      const status = computeTopLevelStatus(stats, healthData)

      const incidents: AssistantIncident[] = conversations
        .filter((conversation) => conversation.status === 'abandoned')
        .slice(0, 10)
        .map((conversation) => ({
          id: conversation.id,
          source: conversation.restaurant_name || 'Voice Conversation',
          message: 'Call ended before completion',
          severity: 'warning' as const,
          timestamp: conversation.lastActivityAt || conversation.startedAt,
          restaurant_id: conversation.restaurant_id,
          restaurant_name: conversation.restaurant_name
        }))

      if (healthData?.services?.assistant === 'error') {
        incidents.unshift({
          id: 'assistant-service',
          source: 'Assistant Health',
          message: 'Assistant service probe is failing',
          severity: 'critical',
          timestamp: new Date().toISOString()
        })
      }

      setPayload({
        status,
        kpis: {
          activeCalls: stats.active,
          failedCallsLast24h: stats.abandoned,
          avgResponseLatencyMs: healthData?.status ? null : null,
          transcriptionBacklog: Math.max(stats.active - stats.completed, 0)
        },
        incidents,
        totalCalls: stats.total
      })

      setLastRefreshAt(new Date())
    } catch (fetchError: any) {
      setError(fetchError?.message || 'Failed to load assistant status data.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  const statusMeta = useMemo(() => getStatusMeta(payload?.status || 'operational'), [payload?.status])

  const kpiCards = [
    {
      title: 'Active calls',
      value: payload?.kpis.activeCalls ?? 0,
      icon: Activity,
      hint: 'Current in-progress conversations'
    },
    {
      title: 'Failed calls (24h)',
      value: payload?.kpis.failedCallsLast24h ?? 0,
      icon: AlertCircle,
      hint: 'Calls abandoned before completion'
    },
    {
      title: 'Avg response latency',
      value:
        payload?.kpis.avgResponseLatencyMs == null
          ? 'N/A'
          : `${Math.round(payload.kpis.avgResponseLatencyMs)} ms`,
      icon: Timer,
      hint: 'Service-level response metric'
    },
    {
      title: 'Transcription backlog',
      value: payload?.kpis.transcriptionBacklog ?? 0,
      icon: Loader2,
      hint: 'Conversations awaiting final transcript'
    }
  ]

  return (
    <>
      <Head>
        <title>Assistant Status - Servio Platform</title>
        <meta name="description" content="Platform-wide assistant operational status and incidents" />
      </Head>

      <AdminLayout title="Assistant Status" description="Platform-wide AI assistant health and monitoring">
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Assistant Status</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Platform-wide AI assistant health, call metrics, and incidents across all restaurants
              </p>
            </div>
            <div className="flex items-center gap-3">
              {lastRefreshAt && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Last refresh: {lastRefreshAt.toLocaleString()}
                </p>
              )}
              <Button
                variant="secondary"
                icon={RefreshCw}
                onClick={() => fetchStatus(true)}
                disabled={refreshing}
              >
                {refreshing ? 'Refreshing...' : 'Refresh'}
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="space-y-4 animate-pulse">
              <div className="h-10 w-52 rounded-xl bg-gray-200 dark:bg-gray-700" />
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="rounded-xl border border-gray-200 dark:border-gray-700 p-6 bg-white dark:bg-gray-800">
                    <div className="h-4 w-28 rounded bg-gray-200 dark:bg-gray-700 mb-3" />
                    <div className="h-7 w-20 rounded bg-gray-200 dark:bg-gray-700 mb-4" />
                    <div className="h-3 w-44 rounded bg-gray-200 dark:bg-gray-700" />
                  </div>
                ))}
              </div>
              <div className="h-56 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800" />
            </div>
          ) : error ? (
            <div className="max-w-lg mx-auto mt-12">
              <EmptyState
                icon={AlertTriangle}
                title="Unable to load assistant status"
                description={error}
                action={{ label: 'Retry', onClick: () => fetchStatus(true) }}
              />
            </div>
          ) : payload?.totalCalls === 0 ? (
            <div className="max-w-lg mx-auto mt-12">
              <EmptyState
                icon={Activity}
                title="No call data yet"
                description="Assistant call metrics will appear after voice conversations are processed."
                action={{ label: 'Refresh', onClick: () => fetchStatus(true) }}
              />
            </div>
          ) : (
            <>
              {/* Overall Status */}
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
                <div className="inline-flex items-center gap-2">
                  <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold ${statusMeta.classes}`}>
                    <statusMeta.icon className="w-4 h-4" />
                    {statusMeta.label}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {payload?.totalCalls.toLocaleString()} total calls
                  </span>
                </div>
              </div>

              {/* KPI Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                {kpiCards.map((card) => (
                  <div
                    key={card.title}
                    className="rounded-xl border border-gray-200 dark:border-gray-700 p-6 bg-white dark:bg-gray-800"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{card.title}</p>
                        <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{card.value}</p>
                      </div>
                      <card.icon className="w-5 h-5 text-red-500" />
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">{card.hint}</p>
                  </div>
                ))}
              </div>

              {/* Restaurant Stats */}
              {Object.keys(restaurantStats).length > 0 && (
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Calls by Restaurant</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-900/40">
                        <tr>
                          <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Restaurant</th>
                          <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Active Calls</th>
                          <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Failed Calls</th>
                          <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {Object.entries(restaurantStats).map(([id, stats]) => (
                          <tr key={id}>
                            <td className="px-5 py-4">
                              <div className="flex items-center">
                                <Building2 className="w-4 h-4 text-gray-400 mr-2" />
                                <span className="text-sm font-medium text-gray-900 dark:text-white">{stats.name}</span>
                              </div>
                            </td>
                            <td className="px-5 py-4 text-sm text-gray-900 dark:text-white">{stats.active}</td>
                            <td className="px-5 py-4 text-sm">
                              {stats.abandoned > 0 ? (
                                <span className="text-red-600 dark:text-red-400">{stats.abandoned}</span>
                              ) : (
                                <span className="text-gray-400">0</span>
                              )}
                            </td>
                            <td className="px-5 py-4">
                              {stats.abandoned > 0 ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                                  <AlertTriangle className="w-3 h-3 mr-1" />
                                  Issues
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300">
                                  <CheckCircle2 className="w-3 h-3 mr-1" />
                                  Normal
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Recent Incidents */}
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Recent incidents & errors</h2>
                </div>

                {payload?.incidents.length ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-900/40">
                        <tr>
                          <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Source</th>
                          <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Issue</th>
                          <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Severity</th>
                          <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Timestamp</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {payload.incidents.map((incident) => (
                          <tr key={incident.id}>
                            <td className="px-5 py-4 text-sm text-gray-700 dark:text-gray-300">
                              {incident.restaurant_name && (
                                <div className="flex items-center">
                                  <Building2 className="w-4 h-4 text-gray-400 mr-2" />
                                  {incident.restaurant_name}
                                </div>
                              )}
                              {!incident.restaurant_name && incident.source}
                            </td>
                            <td className="px-5 py-4 text-sm text-gray-900 dark:text-white">{incident.message}</td>
                            <td className="px-5 py-4 text-sm">
                              <span
                                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                                  incident.severity === 'critical'
                                    ? 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300'
                                    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300'
                                }`}
                              >
                                {incident.severity}
                              </span>
                            </td>
                            <td className="px-5 py-4 text-sm text-gray-500 dark:text-gray-400">
                              {new Date(incident.timestamp).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-8">
                    <EmptyState
                      icon={CheckCircle2}
                      title="No incidents"
                      description="No recent assistant failures or abandoned conversations were found."
                    />
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </AdminLayout>
    </>
  )
}
