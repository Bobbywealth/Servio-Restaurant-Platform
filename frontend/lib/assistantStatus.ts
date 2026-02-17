import { api } from './api'

export interface AssistantIncident {
  id: string
  type: string
  source: string
  message: string
  severity: 'info' | 'warning' | 'error'
  occurredAt: string
}

export interface AssistantServiceProbe {
  name: string
  status: 'healthy' | 'degraded' | 'down' | 'unknown'
  checkedAt: string
  details: Record<string, unknown>
}

export interface AssistantStatusSummary {
  service: string
  aiProvider: string
  voice: {
    liveCount: number
    totalCount: number
    successCount: number
    failureCount: number
    successRate: number
    failureRate: number
    averageMessagesPerConversation: number
  }
  incidents: AssistantIncident[]
  probes: AssistantServiceProbe[]
}

interface AssistantStatusApiResponse {
  success?: boolean
  data?: {
    service?: unknown
    aiProvider?: unknown
    voiceConversationMetrics?: {
      liveCount?: unknown
      totalCount?: unknown
      successCount?: unknown
      failureCount?: unknown
      successRate?: unknown
      failureRate?: unknown
      averageMessagesPerConversation?: unknown
    }
    incidents?: unknown
    probes?: unknown
  }
}

const parseNumber = (value: unknown): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
}

const parseString = (value: unknown, fallback = 'unknown'): string => {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback
}

const parseSeverity = (value: unknown): AssistantIncident['severity'] => {
  if (value === 'info' || value === 'warning' || value === 'error') {
    return value
  }
  return 'error'
}

const parseProbeStatus = (value: unknown): AssistantServiceProbe['status'] => {
  if (value === 'healthy' || value === 'degraded' || value === 'down' || value === 'unknown') {
    return value
  }
  return 'unknown'
}

const parseIncidents = (incidents: unknown): AssistantIncident[] => {
  if (!Array.isArray(incidents)) return []

  return incidents.map((incident, index) => {
    const item = incident && typeof incident === 'object' ? incident as Record<string, unknown> : {}

    return {
      id: parseString(item.id, `incident-${index}`),
      type: parseString(item.type),
      source: parseString(item.source),
      message: parseString(item.message, 'No details available'),
      severity: parseSeverity(item.severity),
      occurredAt: parseString(item.occurredAt, new Date(0).toISOString())
    }
  })
}

const parseProbes = (probes: unknown): AssistantServiceProbe[] => {
  if (!Array.isArray(probes)) return []

  return probes.map((probe, index) => {
    const item = probe && typeof probe === 'object' ? probe as Record<string, unknown> : {}

    return {
      name: parseString(item.name, `probe-${index}`),
      status: parseProbeStatus(item.status),
      checkedAt: parseString(item.checkedAt, new Date(0).toISOString()),
      details: item.details && typeof item.details === 'object' ? item.details as Record<string, unknown> : {}
    }
  })
}

export const assistantStatusApi = {
  async getOverview(): Promise<AssistantStatusSummary> {
    const response = await api.get<AssistantStatusApiResponse>('/api/assistant/status')
    const data = response.data?.data ?? {}
    const voice = data.voiceConversationMetrics ?? {}

    return {
      service: parseString(data.service),
      aiProvider: parseString(data.aiProvider),
      voice: {
        liveCount: parseNumber(voice.liveCount),
        totalCount: parseNumber(voice.totalCount),
        successCount: parseNumber(voice.successCount),
        failureCount: parseNumber(voice.failureCount),
        successRate: parseNumber(voice.successRate),
        failureRate: parseNumber(voice.failureRate),
        averageMessagesPerConversation: parseNumber(voice.averageMessagesPerConversation)
      },
      incidents: parseIncidents(data.incidents),
      probes: parseProbes(data.probes)
    }
  }
}
