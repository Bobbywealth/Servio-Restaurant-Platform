import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AxiosError } from 'axios'
import { useSocket } from '../lib/socket'
import { teamCommunicationApi, TeamChannel, TeamMessage } from '../lib/teamCommunication'

interface UseTeamCommunicationState {
  channels: TeamChannel[]
  messages: TeamMessage[]
  activeChannelId: string | null
  isChannelsLoading: boolean
  isMessagesLoading: boolean
  isLoadingMore: boolean
  isOffline: boolean
  error: string | null
  hasMore: boolean
}

const RETRYABLE_CODES = new Set([408, 409, 425, 429, 500, 502, 503, 504])

export function useTeamCommunication(initialChannelId?: string | null) {
  const socket = useSocket()
  const [state, setState] = useState<UseTeamCommunicationState>({
    channels: [],
    messages: [],
    activeChannelId: initialChannelId ?? null,
    isChannelsLoading: true,
    isMessagesLoading: false,
    isLoadingMore: false,
    isOffline: false,
    error: null,
    hasMore: false
  })

  const cursorRef = useRef<string | null>(null)
  const inFlightRef = useRef(false)
  const inFlightMessagesRef = useRef(false)

  const upsertMessage = useCallback((message: TeamMessage) => {
    setState((prev) => {
      const index = prev.messages.findIndex((item) => item.id === message.id || (message.clientId && item.clientId === message.clientId))
      if (index === -1) {
        return {
          ...prev,
          messages: [...prev.messages, message].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        }
      }

      const current = prev.messages[index]
      const currentRevision = current.revision ?? 0
      const incomingRevision = message.revision ?? currentRevision
      if (incomingRevision < currentRevision) {
        return prev
      }

      const messages = [...prev.messages]
      messages[index] = { ...current, ...message }
      return { ...prev, messages }
    })
  }, [])

  const markMessageDeleted = useCallback((messageId: string, revision?: number) => {
    setState((prev) => {
      const index = prev.messages.findIndex((item) => item.id === messageId)
      if (index === -1) return prev

      const current = prev.messages[index]
      const currentRevision = current.revision ?? 0
      const incomingRevision = revision ?? currentRevision
      if (incomingRevision < currentRevision) {
        return prev
      }

      const messages = [...prev.messages]
      messages[index] = {
        ...current,
        status: 'deleted',
        body: 'Message removed',
        revision: incomingRevision
      }
      return { ...prev, messages }
    })
  }, [])

  const loadChannels = useCallback(async () => {
    setState((prev) => ({ ...prev, isChannelsLoading: true, error: null }))
    try {
      const channels = await teamCommunicationApi.getChannels()
      const selectedId = initialChannelId && channels.some((c) => c.id === initialChannelId)
        ? initialChannelId
        : channels[0]?.id || null

      setState((prev) => ({
        ...prev,
        channels,
        activeChannelId: prev.activeChannelId ?? selectedId,
        isChannelsLoading: false
      }))
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isChannelsLoading: false,
        error: 'Unable to load channels'
      }))
    }
  }, [initialChannelId])

  const loadMessages = useCallback(async (channelId: string, reset = true) => {
    if (inFlightMessagesRef.current) return
    inFlightMessagesRef.current = true

    setState((prev) => ({
      ...prev,
      isMessagesLoading: reset,
      isLoadingMore: !reset,
      error: null
    }))

    try {
      const nextCursor = reset ? null : cursorRef.current
      const page = await teamCommunicationApi.getMessages(channelId, nextCursor)
      cursorRef.current = page.nextCursor

      setState((prev) => ({
        ...prev,
        messages: reset
          ? page.messages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
          : [...page.messages, ...prev.messages].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
        hasMore: Boolean(page.nextCursor),
        isMessagesLoading: false,
        isLoadingMore: false
      }))
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isMessagesLoading: false,
        isLoadingMore: false,
        error: 'Unable to load messages'
      }))
    } finally {
      inFlightMessagesRef.current = false
    }
  }, [])

  const selectChannel = useCallback((channelId: string) => {
    cursorRef.current = null
    setState((prev) => ({ ...prev, activeChannelId: channelId, messages: [], hasMore: false }))
  }, [])

  const loadMore = useCallback(async () => {
    if (!state.activeChannelId || !state.hasMore) return
    await loadMessages(state.activeChannelId, false)
  }, [state.activeChannelId, state.hasMore, loadMessages])

  const withRetry = useCallback(async <T,>(action: () => Promise<T>, maxRetries = 2): Promise<T> => {
    let lastError: unknown
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      try {
        return await action()
      } catch (error) {
        lastError = error
        const axiosError = error as AxiosError
        const status = axiosError.response?.status
        if (status && !RETRYABLE_CODES.has(status)) {
          throw error
        }
        if (attempt === maxRetries) {
          throw error
        }
        await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)))
      }
    }
    throw lastError
  }, [])

  const sendMessage = useCallback(async (body: string) => {
    if (!state.activeChannelId || inFlightRef.current) return
    const trimmed = body.trim()
    if (!trimmed) return

    inFlightRef.current = true
    const clientId = `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const optimistic: TeamMessage = {
      id: clientId,
      channelId: state.activeChannelId,
      authorId: 'me',
      authorName: 'You',
      body: trimmed,
      createdAt: new Date().toISOString(),
      status: 'sending',
      clientId,
      revision: 0
    }

    upsertMessage(optimistic)

    try {
      const saved = await withRetry(() => teamCommunicationApi.sendMessage(state.activeChannelId!, trimmed, clientId))
      upsertMessage({ ...saved, status: saved.status ?? 'sent' })
    } catch (error) {
      setState((prev) => ({
        ...prev,
        messages: prev.messages.map((message) => message.clientId === clientId ? { ...message, status: 'failed' } : message),
        error: 'Unable to send message. Tap retry.'
      }))
    } finally {
      inFlightRef.current = false
    }
  }, [state.activeChannelId, upsertMessage, withRetry])

  const retryMessage = useCallback(async (messageId: string) => {
    const target = state.messages.find((message) => message.id === messageId)
    if (!target || !state.activeChannelId) return

    setState((prev) => ({
      ...prev,
      messages: prev.messages.map((message) => message.id === messageId ? { ...message, status: 'sending' } : message)
    }))

    try {
      const saved = await withRetry(() => teamCommunicationApi.sendMessage(state.activeChannelId!, target.body, target.clientId || messageId))
      upsertMessage(saved)
    } catch {
      setState((prev) => ({
        ...prev,
        messages: prev.messages.map((message) => message.id === messageId ? { ...message, status: 'failed' } : message)
      }))
    }
  }, [state.messages, state.activeChannelId, upsertMessage, withRetry])

  const editMessage = useCallback(async (messageId: string, body: string) => {
    if (!state.activeChannelId) return

    const existing = state.messages.find((message) => message.id === messageId)
    if (!existing) return

    const previous = existing.body
    upsertMessage({ ...existing, body, status: 'edited' })

    try {
      const saved = await withRetry(() => teamCommunicationApi.editMessage(
        state.activeChannelId!,
        messageId,
        body,
        existing.revision
      ))
      upsertMessage(saved)
    } catch (error) {
      const axiosError = error as AxiosError
      if (axiosError.response?.status === 409) {
        await loadMessages(state.activeChannelId, true)
        setState((prev) => ({ ...prev, error: 'This message changed on another device. Latest version loaded.' }))
        return
      }

      upsertMessage({ ...existing, body: previous })
      setState((prev) => ({ ...prev, error: 'Unable to edit message' }))
    }
  }, [state.activeChannelId, state.messages, upsertMessage, withRetry, loadMessages])

  const deleteMessage = useCallback(async (messageId: string) => {
    if (!state.activeChannelId) return
    const existing = state.messages.find((message) => message.id === messageId)
    if (!existing) return

    markMessageDeleted(messageId, existing.revision)

    try {
      const response = await withRetry(() => teamCommunicationApi.deleteMessage(
        state.activeChannelId!,
        messageId,
        existing.revision
      ))
      markMessageDeleted(response.messageId, response.revision)
    } catch (error) {
      const axiosError = error as AxiosError
      if (axiosError.response?.status === 409) {
        await loadMessages(state.activeChannelId, true)
        setState((prev) => ({ ...prev, error: 'This message was already updated. Thread re-synced.' }))
        return
      }

      upsertMessage(existing)
      setState((prev) => ({ ...prev, error: 'Unable to delete message' }))
    }
  }, [state.activeChannelId, state.messages, markMessageDeleted, upsertMessage, withRetry, loadMessages])

  const refresh = useCallback(async () => {
    await loadChannels()
    if (state.activeChannelId) {
      cursorRef.current = null
      await loadMessages(state.activeChannelId, true)
    }
  }, [loadChannels, loadMessages, state.activeChannelId])

  useEffect(() => {
    void loadChannels()
  }, [loadChannels])

  useEffect(() => {
    if (!state.activeChannelId) return
    cursorRef.current = null
    void loadMessages(state.activeChannelId, true)
  }, [state.activeChannelId, loadMessages])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const handleOnline = () => setState((prev) => ({ ...prev, isOffline: false }))
    const handleOffline = () => setState((prev) => ({ ...prev, isOffline: true }))

    setState((prev) => ({ ...prev, isOffline: navigator.onLine === false }))
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  useEffect(() => {
    if (!state.activeChannelId) return
    const activeChannelId = state.activeChannelId

    const handleCreated = (payload: { channelId: string; message: TeamMessage }) => {
      if (payload.channelId !== activeChannelId) return
      upsertMessage(payload.message)
    }

    const handleUpdated = (payload: { channelId: string; message: TeamMessage }) => {
      if (payload.channelId !== activeChannelId) return
      upsertMessage(payload.message)
    }

    const handleDeleted = (payload: { channelId: string; messageId: string; revision?: number }) => {
      if (payload.channelId !== activeChannelId) return
      markMessageDeleted(payload.messageId, payload.revision)
    }

    socket.subscribeToTeamChannel(activeChannelId)
    socket.on('team:message:created', handleCreated)
    socket.on('team:message:updated', handleUpdated)
    socket.on('team:message:deleted', handleDeleted)

    return () => {
      socket.unsubscribeFromTeamChannel(activeChannelId)
      socket.off('team:message:created', handleCreated)
      socket.off('team:message:updated', handleUpdated)
      socket.off('team:message:deleted', handleDeleted)
    }
  }, [socket, state.activeChannelId, markMessageDeleted, upsertMessage])

  const unreadCount = useMemo(
    () => state.channels.reduce((total, channel) => total + (channel.unreadCount || 0), 0),
    [state.channels]
  )

  return {
    ...state,
    unreadCount,
    selectChannel,
    loadMore,
    sendMessage,
    retryMessage,
    editMessage,
    deleteMessage,
    refresh,
    clearError: () => setState((prev) => ({ ...prev, error: null }))
  }
}

export function useTeamUnreadSummary() {
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const socket = useSocket()

  useEffect(() => {
    let mounted = true

    const fetchUnread = async () => {
      try {
        const response = await teamCommunicationApi.getUnreadSummary()
        if (mounted) setUnreadCount(response.unreadCount || 0)
      } catch {
        if (mounted) setUnreadCount(0)
      } finally {
        if (mounted) setIsLoading(false)
      }
    }

    void fetchUnread()

    const handleUnreadUpdated = (payload: { unreadCount: number }) => {
      setUnreadCount(Math.max(0, payload.unreadCount || 0))
    }

    socket.on('team:unread:updated', handleUnreadUpdated)
    return () => {
      mounted = false
      socket.off('team:unread:updated', handleUnreadUpdated)
    }
  }, [socket])

  return { unreadCount, isLoading }
}
