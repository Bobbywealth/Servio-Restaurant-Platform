import { api } from './api'

export type TeamMessageStatus = 'sent' | 'edited' | 'deleted' | 'failed' | 'sending'

export interface TeamChannel {
  id: string
  name: string
  description?: string
  memberCount?: number
  unreadCount: number
  lastMessageAt?: string
  lastMessagePreview?: string
}

export interface TeamMessage {
  id: string
  channelId: string
  authorId: string
  authorName: string
  body: string
  createdAt: string
  updatedAt?: string
  status: TeamMessageStatus
  clientId?: string
  revision?: number
}

export interface TeamMessagesPage {
  messages: TeamMessage[]
  nextCursor: string | null
}

interface ApiResponse<T> {
  success: boolean
  data: T
}

export const teamCommunicationApi = {
  async getChannels(): Promise<TeamChannel[]> {
    const response = await api.get<ApiResponse<{ channels: TeamChannel[] }>>('/api/team/channels')
    return response.data.data.channels
  },

  async getUnreadSummary(): Promise<{ unreadCount: number }> {
    const response = await api.get<ApiResponse<{ unreadCount: number }>>('/api/team/unread-summary')
    return response.data.data
  },

  async getMessages(channelId: string, cursor?: string | null, limit = 30): Promise<TeamMessagesPage> {
    const params = new URLSearchParams()
    params.append('limit', String(limit))
    if (cursor) params.append('cursor', cursor)

    const response = await api.get<ApiResponse<TeamMessagesPage>>(
      `/api/team/channels/${encodeURIComponent(channelId)}/messages?${params.toString()}`
    )
    return response.data.data
  },

  async sendMessage(channelId: string, body: string, clientId: string): Promise<TeamMessage> {
    const response = await api.post<ApiResponse<TeamMessage>>(
      `/api/team/channels/${encodeURIComponent(channelId)}/messages`,
      { body, clientId }
    )
    return response.data.data
  },

  async editMessage(channelId: string, messageId: string, body: string, revision?: number): Promise<TeamMessage> {
    const response = await api.patch<ApiResponse<TeamMessage>>(
      `/api/team/channels/${encodeURIComponent(channelId)}/messages/${encodeURIComponent(messageId)}`,
      { body, revision }
    )
    return response.data.data
  },

  async deleteMessage(channelId: string, messageId: string, revision?: number): Promise<{ messageId: string; revision?: number }> {
    const response = await api.delete<ApiResponse<{ messageId: string; revision?: number }>>(
      `/api/team/channels/${encodeURIComponent(channelId)}/messages/${encodeURIComponent(messageId)}`,
      { data: { revision } }
    )
    return response.data.data
  }
}
