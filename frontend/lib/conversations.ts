import { api } from './api'

export interface ConversationSession {
  id: string
  startedAt: string
  endedAt?: string
  durationSeconds?: number
  direction: 'inbound' | 'outbound'
  fromNumber: string | null
  toNumber?: string
  status: string
  audioUrl?: string
  insights?: {
    summary?: string
    intentPrimary?: string
    outcome?: string
    sentiment?: string
    qualityScore?: number
  }
  review?: {
    id: string
    reviewedAt: string
  }
}

export interface ConversationDetails {
  session: {
    id: string
    provider: string
    providerCallId: string
    direction: 'inbound' | 'outbound'
    fromNumber: string | null
    toNumber?: string
    startedAt: string
    endedAt?: string
    durationSeconds?: number
    status: string
    audioUrl?: string
    metadata?: Record<string, any>
  }
  transcript: {
    id: string
    transcriptText: string
    transcriptJson: {
      turns: Array<{
        speaker: string
        start: number
        end: number
        text: string
      }>
    }
    language: string
    sttProvider: string
    sttConfidence?: number
  } | null
  insights: {
    id: string
    summary?: string
    intentPrimary?: string
    intentsSecondary?: string[]
    outcome?: string
    sentiment?: string
    frictionPoints?: Array<{
      type: string
      detail: string
      timestamp: number
    }>
    improvementSuggestions?: Array<{
      type: string
      title: string
      proposed_change?: string
      item?: string
    }>
    extractedEntities?: {
      items_mentioned?: string[]
      modifiers_mentioned?: string[]
      prices_discussed?: string[]
      names_captured?: string[]
    }
    qualityScore?: number
  } | null
  review: {
    id: string
    reviewedBy: string
    reviewedAt: string
    internalNotes?: string
    tags?: string[]
    followUpAction?: string
  } | null
}

export interface ConversationFilters {
  from?: string
  to?: string
  intent?: string
  outcome?: string
  sentiment?: string
  durationMin?: number
  durationMax?: number
  reviewed?: boolean
  search?: string
  limit?: number
  offset?: number
}

export interface ReviewRequest {
  internalNotes?: string
  tags?: string[]
  followUpAction?: string
}

export interface ConversationListResponse {
  sessions: ConversationSession[]
  total: number
  limit: number
  offset: number
}

export interface AnalyticsSummary {
  totalCalls: number
  completedCalls: number
  abandonedCalls: number
  averageDuration: number
  intentBreakdown: Record<string, number>
  outcomeBreakdown: Record<string, number>
  sentimentBreakdown: Record<string, number>
  averageQualityScore: number
}

export const conversationsApi = {
  /**
   * List conversations with filtering
   */
  async list(filters: ConversationFilters = {}): Promise<ConversationListResponse> {
    const params = new URLSearchParams()
    if (filters.from) params.append('from', filters.from)
    if (filters.to) params.append('to', filters.to)
    if (filters.intent) params.append('intent', filters.intent)
    if (filters.outcome) params.append('outcome', filters.outcome)
    if (filters.sentiment) params.append('sentiment', filters.sentiment)
    if (filters.durationMin !== undefined) params.append('durationMin', String(filters.durationMin))
    if (filters.durationMax !== undefined) params.append('durationMax', String(filters.durationMax))
    if (filters.reviewed !== undefined) params.append('reviewed', String(filters.reviewed))
    if (filters.search) params.append('search', filters.search)
    if (filters.limit) params.append('limit', String(filters.limit))
    if (filters.offset) params.append('offset', String(filters.offset))

    const response = await api.get<{ success: boolean; data: ConversationListResponse }>(
      `/api/conversations?${params.toString()}`
    )
    return response.data.data
  },

  /**
   * Get conversation details
   */
  async getById(id: string): Promise<ConversationDetails> {
    const response = await api.get<{ success: boolean; data: ConversationDetails }>(
      `/api/conversations/${id}`
    )
    return response.data.data
  },

  /**
   * Add or update a review
   */
  async submitReview(id: string, review: ReviewRequest): Promise<{
    id: string
    reviewedAt: string
    internalNotes?: string
    tags?: string[]
    followUpAction?: string
  }> {
    const response = await api.post<{ success: boolean; data: any }>(
      `/api/conversations/${id}/review`,
      review
    )
    return response.data.data
  },

  /**
   * Get analytics summary
   */
  async getAnalytics(from?: string, to?: string): Promise<AnalyticsSummary> {
    const params = new URLSearchParams()
    if (from) params.append('from', from)
    if (to) params.append('to', to)

    const response = await api.get<{ success: boolean; data: AnalyticsSummary }>(
      `/api/conversations/analytics/summary?${params.toString()}`
    )
    return response.data.data
  }
}
