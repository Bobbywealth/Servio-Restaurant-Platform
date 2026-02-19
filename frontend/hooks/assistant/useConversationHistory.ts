import { useCallback, useState } from 'react'
import { api } from '../../lib/api'
import { TranscriptMessage } from '../../components/Assistant/TranscriptFeed'

interface ConversationSummary {
  id: string
  sessionId: string
  status: string
  startedAt: string
  lastActivityAt: string
  messageCount: number
}

export function useConversationHistory() {
  const [showHistory, setShowHistory] = useState(false)
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null)
  const [loadingHistory, setLoadingHistory] = useState(false)

  const toggleHistory = useCallback(() => setShowHistory((prev) => !prev), [])

  const loadConversationHistory = useCallback(async () => {
    if (!showHistory) return
    setLoadingHistory(true)
    try {
      const response = await api.get('/api/voice-conversations')
      const { conversations: loaded } = response.data?.data || { conversations: [] }
      setConversations(loaded)
    } finally {
      setLoadingHistory(false)
    }
  }, [showHistory])

  const loadConversationDetails = useCallback(async (conversationId: string) => {
    const response = await api.get(`/api/voice-conversations/${conversationId}`)
    const { messages } = response.data?.data || { messages: [] }
    const historicalMessages: TranscriptMessage[] = messages.map((msg: any, index: number) => ({
      id: `hist_${msg.id}_${index}`,
      timestamp: new Date(msg.createdAt),
      type: msg.role === 'user' ? 'user' : msg.role === 'assistant' ? 'assistant' : 'system',
      content: msg.content,
      metadata: msg.audioUrl ? { audioUrl: msg.audioUrl } : {}
    }))
    setSelectedConversation(conversationId)
    return historicalMessages
  }, [])

  return {
    showHistory,
    conversations,
    selectedConversation,
    loadingHistory,
    toggleHistory,
    loadConversationHistory,
    loadConversationDetails
  }
}
