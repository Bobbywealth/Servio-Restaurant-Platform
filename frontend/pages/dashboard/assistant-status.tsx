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
  XCircle
} from 'lucide-react'
import DashboardLayout from '../../components/Layout/DashboardLayout'
import { EmptyState } from '../../components/ui/EmptyState'
import { Button } from '../../components/ui/Button'
import { api } from '../../lib/api'
import { useUser } from '../../contexts/UserContext'

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
}

const getStatusMeta = (status: AssistantStatus) => {
  if (status === 'operational') {
    return {
      label: 'Operational',
      icon: CheckCircle2,
      classes: 'bg-servio-green-100 text-servio-green-800 dark:bg-servio-green-900/20 dark:text-servio-green-300'
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
    classes: 'bg-servio-red-100 text-servio-red-800 dark:bg-servio-red-900/20 dark:text-servio-red-300'
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

export default function AssistantStatusPage() {
  const { user } = useUser()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [payload, setPayload] = useState<AssistantStatusPayload | null>(null)
  const [lastRefreshAt, setLastRefreshAt] = useState<Date | null>(null)

  const hasAccess = user?.role === 'manager' || user?.role === 'owner'

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
          params: { limit: '10', offset: '0' }
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

      const status = computeTopLevelStatus(stats, healthData)

      const incidents: AssistantIncident[] = conversations
        .filter((conversation) => conversation.status === 'abandoned')
        .slice(0, 5)
        .map((conversation) => ({
          id: conversation.id,
          source: 'Voice Conversation',
          message: 'Call ended before completion',
          severity: 'warning' as const,
          timestamp: conversation.lastActivityAt || conversation.startedAt
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
    if (hasAccess) {
      fetchStatus()
    }
  }, [fetchStatus, hasAccess])

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
        <title>Assistant Status - Servio Restaurant Platform</title>
        <meta name="description" content="Operational status and incidents for the assistant" />
      </Head>

      <DashboardLayout>
        {!hasAccess ? (
          <div className="max-w-lg mx-auto mt-12">
            <EmptyState
              icon={ShieldAlert}
              title="Access Restricted"
              description="Assistant status is available to manager and owner roles only."
            />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-surface-900 dark:text-surface-100">Assistant Status</h1>
                <p className="text-surface-600 dark:text-surface-400 mt-1">
                  Real-time status, call health indicators, and recent assistant incidents
                </p>
              </div>
              <div className="flex items-center gap-3">
                {lastRefreshAt && (
                  <p className="text-sm text-surface-500 dark:text-surface-400">
                    Last refresh: {lastRefreshAt.toLocaleString()}
                  </p>
                )}
                <Button
                  variant="secondary"
                  icon={RefreshCw}
                  onClick={() => fetchStatus(true)}
                  disabled={refreshing}
                  className="min-h-[44px] min-w-[44px]"
                >
                  {refreshing ? 'Refreshing...' : 'Refresh'}
                </Button>
              </div>
            </div>

            {loading ? (
              <div className="space-y-4 animate-pulse">
                <div className="h-10 w-52 rounded-xl bg-surface-200 dark:bg-surface-700" />
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="rounded-2xl border border-surface-200 dark:border-surface-700 p-6 bg-white dark:bg-surface-800">
                      <div className="h-4 w-28 rounded bg-surface-200 dark:bg-surface-700 mb-3" />
                      <div className="h-7 w-20 rounded bg-surface-200 dark:bg-surface-700 mb-4" />
                      <div className="h-3 w-44 rounded bg-surface-200 dark:bg-surface-700" />
                    </div>
                  ))}
                </div>
                <div className="h-56 rounded-2xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800" />
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
                  description="Assistant call metrics will appear after your first voice conversations are processed."
                  action={{ label: 'Refresh', onClick: () => fetchStatus(true) }}
                />
              </div>
            ) : (
              <>
                <div className="rounded-2xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 p-5">
                  <div className="inline-flex items-center gap-2">
                    <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold ${statusMeta.classes}`}>
                      <statusMeta.icon className="w-4 h-4" />
                      {statusMeta.label}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                  {kpiCards.map((card) => (
                    <div
                      key={card.title}
                      className="rounded-2xl border border-surface-200 dark:border-surface-700 p-6 bg-white dark:bg-surface-800"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm text-surface-600 dark:text-surface-400">{card.title}</p>
                          <p className="text-3xl font-bold text-surface-900 dark:text-surface-100 mt-2">{card.value}</p>
                        </div>
                        <card.icon className="w-5 h-5 text-primary-500" />
                      </div>
                      <p className="text-xs text-surface-500 dark:text-surface-400 mt-3">{card.hint}</p>
                    </div>
                  ))}
                </div>

                <div className="rounded-2xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 overflow-hidden">
                  <div className="px-5 py-4 border-b border-surface-200 dark:border-surface-700">
                    <h2 className="text-lg font-semibold text-surface-900 dark:text-surface-100">Recent incidents & errors</h2>
                  </div>

                  {payload?.incidents.length ? (
                    <>
                    <div className="hidden md:block overflow-x-auto">
                      <table className="min-w-full divide-y divide-surface-200 dark:divide-surface-700">
                        <thead className="bg-surface-50 dark:bg-surface-900/40">
                          <tr>
                            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-surface-500">Source</th>
                            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-surface-500">Issue</th>
                            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-surface-500">Severity</th>
                            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-surface-500">Timestamp</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-200 dark:divide-surface-700">
                          {payload.incidents.map((incident) => (
                            <tr key={incident.id}>
                              <td className="px-5 py-4 text-sm text-surface-700 dark:text-surface-300">{incident.source}</td>
                              <td className="px-5 py-4 text-sm text-surface-900 dark:text-surface-100">{incident.message}</td>
                              <td className="px-5 py-4 text-sm">
                                <span
                                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                                    incident.severity === 'critical'
                                      ? 'bg-servio-red-100 text-servio-red-700 dark:bg-servio-red-900/20 dark:text-servio-red-300'
                                      : 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300'
                                  }`}
                                >
                                  {incident.severity}
                                </span>
                              </td>
                              <td className="px-5 py-4 text-sm text-surface-500 dark:text-surface-400">
                                {new Date(incident.timestamp).toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="md:hidden divide-y divide-surface-200 dark:divide-surface-700">
                      {payload.incidents.map((incident) => (
                        <div key={incident.id} className="p-4 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-medium text-surface-900 dark:text-surface-100">{incident.source}</p>
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                                incident.severity === 'critical'
                                  ? 'bg-servio-red-100 text-servio-red-700 dark:bg-servio-red-900/20 dark:text-servio-red-300'
                                  : 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300'
                              }`}
                            >
                              {incident.severity}
                            </span>
                          </div>
                          <p className="text-sm text-surface-700 dark:text-surface-300">{incident.message}</p>
                          <p className="text-xs text-surface-500 dark:text-surface-400">{new Date(incident.timestamp).toLocaleString()}</p>
                        </div>
                      ))}
                    </div>
                    </>
                  ) : (
                    <div className="p-8">
                      <EmptyState
                        icon={CheckCircle2}
                        title="No incidents in the selected window"
                        description="No recent assistant failures or abandoned conversations were found."
                      />
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </DashboardLayout>
    </>
  )
}
