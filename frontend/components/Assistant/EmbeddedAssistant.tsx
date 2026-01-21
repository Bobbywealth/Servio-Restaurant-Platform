import React, { useCallback, useEffect, useRef, useState } from 'react'
import RealisticAvatar from './RealisticAvatar'
import MicrophoneButton from './MicrophoneButton'
import TranscriptFeed, { TranscriptMessage } from './TranscriptFeed'
import ChatInput from './ChatInput'
import QuickCommands from './QuickCommands'
import { api } from '../../lib/api'
import { useUser } from '../../contexts/UserContext'

interface AssistantState {
  isRecording: boolean
  isProcessing: boolean
  isSpeaking: boolean
  messages: TranscriptMessage[]
  currentAudioUrl: string | null
  micToggleMode: boolean
  alwaysListening: boolean
  inConversationWindow: boolean
}

const CONVERSATION_WINDOW_DURATION = 30000

export default function EmbeddedAssistant() {
  const { user } = useUser()

  // Match tablet assistant access rules (manager/owner/admin).
  const allowed = user?.role && ['manager', 'owner', 'admin'].includes(user.role)

  const [state, setState] = useState<AssistantState>({
    isRecording: false,
    isProcessing: false,
    isSpeaking: false,
    messages: [],
    currentAudioUrl: null,
    micToggleMode: true,
    alwaysListening: false,
    inConversationWindow: false
  })

  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [talkIntensity, setTalkIntensity] = useState(0)

  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  }, [state])

  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const conversationWindowRef = useRef<NodeJS.Timeout | null>(null)
  const inConversationWindowRef = useRef(false)
  const startRecordingRef = useRef<(() => void) | null>(null)
  const stopRecordingRef = useRef<(() => void) | null>(null)

  const addMessage = useCallback((message: Omit<TranscriptMessage, 'id' | 'timestamp'>) => {
    const newMessage: TranscriptMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      timestamp: new Date(),
      ...message
    }
    setState((prev) => ({ ...prev, messages: [...prev.messages, newMessage] }))
  }, [])

  const getApiErrorMessage = useCallback((error: unknown) => {
    const anyErr = error as any
    const status = anyErr?.response?.status as number | undefined
    const backendMsg =
      anyErr?.response?.data?.error?.message ||
      anyErr?.response?.data?.message ||
      anyErr?.response?.data?.error ||
      anyErr?.response?.data

    if (status) {
      if (typeof backendMsg === 'string') return `HTTP ${status}: ${backendMsg}`
      if (backendMsg) return `HTTP ${status}: ${JSON.stringify(backendMsg)}`
      return `HTTP ${status}`
    }
    const msg = anyErr?.message
    return typeof msg === 'string' && msg.length > 0 ? msg : 'Unknown error'
  }, [])

  const resolveAudioUrl = useCallback((audioUrl: string) => {
    if (!audioUrl) return audioUrl
    if (/^https?:\/\//i.test(audioUrl)) return audioUrl
    const base = String((api as any)?.defaults?.baseURL || '').replace(/\/+$/, '')
    if (!base) return audioUrl
    return `${base}${audioUrl.startsWith('/') ? '' : '/'}${audioUrl}`
  }, [])

  const stopAudio = useCallback(() => {
    const a = audioRef.current
    if (a) {
      try {
        a.pause()
        a.src = ''
      } catch {}
    }
    audioRef.current = null
    setState((prev) => ({ ...prev, isSpeaking: false, currentAudioUrl: null }))
  }, [])

  const playAudio = useCallback(
    async (url: string) => {
      const resolved = resolveAudioUrl(url)
      stopAudio()
      const audio = new Audio(resolved)
      audioRef.current = audio
      setState((prev) => ({ ...prev, currentAudioUrl: resolved, isSpeaking: true }))
      audio.onended = () => {
        setState((prev) => ({ ...prev, isSpeaking: false, currentAudioUrl: null }))
      }
      try {
        await audio.play()
      } catch (e) {
        // Some browsers block autoplay; still keep transcript.
        setState((prev) => ({ ...prev, isSpeaking: false, currentAudioUrl: null }))
        throw e
      }
    },
    [resolveAudioUrl, stopAudio]
  )

  const processRecording = useCallback(async () => {
    if (audioChunksRef.current.length === 0) {
      setState((prev) => ({ ...prev, isProcessing: false }))
      if (stateRef.current.alwaysListening) {
        setTimeout(() => startRecordingRef.current?.(), 500)
      }
      return
    }

    try {
      const mimeType = mediaRecorder?.mimeType || 'audio/webm;codecs=opus'
      const extension = mimeType.includes('mp4') ? 'mp4' : 'webm'
      const audioBlob = new Blob(audioChunksRef.current, { type: mimeType })
      const formData = new FormData()
      formData.append('audio', audioBlob, `recording.${extension}`)
      formData.append('userId', user?.id || 'anonymous')

      const response = await api.post(`/api/assistant/process-audio`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      const payload = response.data?.data || response.data
      const { transcript, response: assistantResponse, actions, audioUrl } = payload || {}

      // Always listening: only respond after wake word, or within a conversation window.
      if (stateRef.current.alwaysListening && transcript) {
        const lowerTranscript = String(transcript).toLowerCase().trim()
        const hasWakeWord =
          lowerTranscript.includes('servio') ||
          lowerTranscript.includes('sergio') ||
          lowerTranscript.includes('serveio')

        const inWindow = inConversationWindowRef.current

        if (!hasWakeWord && !inWindow) {
          addMessage({
            type: 'system',
            content: `🔇 Ignored: "${String(transcript).slice(0, 60)}${String(transcript).length > 60 ? '…' : ''}" (say "Servio" to start)`,
            metadata: { action: { type: 'ignored', status: 'completed' } }
          })
          setState((prev) => ({ ...prev, isProcessing: false }))
          audioChunksRef.current = []
          setTimeout(() => startRecordingRef.current?.(), 500)
          return
        }

        if (hasWakeWord) {
          if (conversationWindowRef.current) clearTimeout(conversationWindowRef.current)
          inConversationWindowRef.current = true
          setState((prev) => ({ ...prev, inConversationWindow: true }))
          conversationWindowRef.current = setTimeout(() => {
            inConversationWindowRef.current = false
            setState((prev) => ({ ...prev, inConversationWindow: false }))
            addMessage({
              type: 'system',
              content: '⏱️ Conversation paused. Say "Servio" to continue.',
              metadata: { action: { type: 'conversation_window', status: 'completed' } }
            })
          }, CONVERSATION_WINDOW_DURATION)
        } else if (inWindow) {
          if (conversationWindowRef.current) clearTimeout(conversationWindowRef.current)
          conversationWindowRef.current = setTimeout(() => {
            inConversationWindowRef.current = false
            setState((prev) => ({ ...prev, inConversationWindow: false }))
            addMessage({
              type: 'system',
              content: '⏱️ Conversation paused. Say "Servio" to continue.',
              metadata: { action: { type: 'conversation_window', status: 'completed' } }
            })
          }, CONVERSATION_WINDOW_DURATION)
        }
      }

      if (transcript) {
        addMessage({
          type: 'user',
          content: transcript,
          metadata: { confidence: payload?.confidence || 0.9 }
        })
      }

      if (assistantResponse) {
        addMessage({
          type: 'assistant',
          content: assistantResponse,
          metadata: { duration: payload?.processingTime }
        })
      }

      if (actions && Array.isArray(actions) && actions.length > 0) {
        actions.forEach((action: any) => {
          addMessage({
            type: 'action',
            content: action.description,
            metadata: {
              action: {
                type: action.type,
                status: action.status,
                details: action.details
              }
            }
          })
        })
      }

      if (audioUrl) {
        try {
          await playAudio(audioUrl)
        } catch {
          // Ignore autoplay failures.
        }
      }
    } catch (error) {
      const errorMessage = getApiErrorMessage(error)
      addMessage({
        type: 'system',
        content: `🎤 Failed to process audio: ${errorMessage}. Try speaking again or use text.`,
        metadata: { action: { type: 'error', status: 'error', details: errorMessage } }
      })
    } finally {
      setState((prev) => ({ ...prev, isProcessing: false }))
      audioChunksRef.current = []

      if (stateRef.current.alwaysListening) {
        setTimeout(() => {
          if (
            stateRef.current.alwaysListening &&
            !stateRef.current.isRecording &&
            !stateRef.current.isProcessing &&
            !stateRef.current.isSpeaking
          ) {
            startRecordingRef.current?.()
          }
        }, 800)
      }
    }
  }, [addMessage, getApiErrorMessage, playAudio, mediaRecorder?.mimeType, user?.id])

  const getSupportedMimeType = useCallback(() => {
    const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
    for (const c of candidates) {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c)) return c
    }
    return null
  }, [])

  useEffect(() => {
    let stream: MediaStream | null = null
    let cancelled = false

    const init = async () => {
      if (mediaRecorder) return
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 44100 }
        })
        if (cancelled) return
        const supportedMimeType = getSupportedMimeType()
        const recorder = supportedMimeType ? new MediaRecorder(stream, { mimeType: supportedMimeType }) : new MediaRecorder(stream)

        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) audioChunksRef.current.push(event.data)
        }
        recorder.onstop = async () => {
          await processRecording()
        }
        setMediaRecorder(recorder)
      } catch (e) {
        addMessage({
          type: 'system',
          content: 'Microphone unavailable. Check browser permissions.',
          metadata: { action: { type: 'error', status: 'error' } }
        })
      }
    }

    init()
    return () => {
      cancelled = true
      if (stream) stream.getTracks().forEach((t) => t.stop())
    }
  }, [addMessage, getSupportedMimeType, processRecording, mediaRecorder])

  useEffect(() => {
    return () => {
      stopAudio()
      if (conversationWindowRef.current) clearTimeout(conversationWindowRef.current)
      if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current)
    }
  }, [stopAudio])

  const startRecording = useCallback(() => {
    if (!mediaRecorder || stateRef.current.isProcessing) return
    if (mediaRecorder.state !== 'inactive') return
    audioChunksRef.current = []
    mediaRecorder.start(100)
    setState((prev) => ({ ...prev, isRecording: true }))

    if (stateRef.current.alwaysListening) {
      if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current)
      silenceTimeoutRef.current = setTimeout(() => {
        if (stateRef.current.isRecording && stopRecordingRef.current) {
          stopRecordingRef.current()
        }
      }, 5000)
    }
  }, [mediaRecorder])

  const stopRecording = useCallback(() => {
    if (!mediaRecorder || !stateRef.current.isRecording) return
    if (mediaRecorder.state !== 'recording') return
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current)
      silenceTimeoutRef.current = null
    }
    mediaRecorder.stop()
    setState((prev) => ({ ...prev, isRecording: false, isProcessing: true }))
  }, [mediaRecorder])

  useEffect(() => {
    startRecordingRef.current = startRecording
  }, [startRecording])

  useEffect(() => {
    stopRecordingRef.current = stopRecording
  }, [stopRecording])

  const handleCommand = useCallback(
    async (command: string) => {
      addMessage({ type: 'user', content: command })
      setState((prev) => ({ ...prev, isProcessing: true }))
      try {
        const response = await api.post(`/api/assistant/process-text`, {
          text: command,
          userId: user?.id || 'anonymous'
        })
        const payload = response.data?.data || response.data
        const { response: assistantResponse, actions, audioUrl } = payload || {}

        if (assistantResponse) {
          addMessage({
            type: 'assistant',
            content: assistantResponse,
            metadata: { duration: payload?.processingTime }
          })
        }

        if (actions && Array.isArray(actions) && actions.length > 0) {
          actions.forEach((action: any) => {
            addMessage({
              type: 'action',
              content: action.description,
              metadata: {
                action: { type: action.type, status: action.status, details: action.details }
              }
            })
          })
        }

        if (audioUrl) {
          try {
            await playAudio(audioUrl)
          } catch {
            // ignore autoplay errors
          }
        }
      } catch (error) {
        const errorMessage = getApiErrorMessage(error)
        addMessage({
          type: 'system',
          content: `❌ Error: ${errorMessage}. Try again.`,
          metadata: { action: { type: 'error', status: 'error', details: errorMessage } }
        })
      } finally {
        setState((prev) => ({ ...prev, isProcessing: false }))
        if (stateRef.current.alwaysListening) {
          setTimeout(() => {
            if (
              stateRef.current.alwaysListening &&
              !stateRef.current.isRecording &&
              !stateRef.current.isProcessing &&
              !stateRef.current.isSpeaking
            ) {
              startRecordingRef.current?.()
            }
          }, 800)
        }
      }
    },
    [addMessage, getApiErrorMessage, playAudio, user?.id]
  )

  // Lightweight “talk intensity” for avatar animation while speaking.
  useEffect(() => {
    if (!state.isSpeaking) {
      setTalkIntensity(0)
      return
    }
    const id = window.setInterval(() => {
      setTalkIntensity((Math.random() * 0.6 + 0.2) as any)
    }, 140)
    return () => window.clearInterval(id)
  }, [state.isSpeaking])

  if (!allowed) {
    return (
      <div className="bg-red-500/15 border border-red-500/30 text-red-200 rounded-2xl p-4">
        Your role (<span className="font-bold">{user?.role || 'unknown'}</span>) can’t access the AI assistant. Log in as a manager/owner/admin.
      </div>
    )
  }

  return (
    <div className="dark grid grid-cols-1 xl:grid-cols-[260px_minmax(0,1fr)] gap-3">
      <div className="space-y-3">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
          <RealisticAvatar
            isTalking={state.isSpeaking}
            isListening={state.isRecording}
            isThinking={state.isProcessing}
            size="medium"
            gender="female"
            name="Servio"
            audioLevel={talkIntensity * 100}
          />

          <div className="mt-3">
            <MicrophoneButton
              isRecording={state.isRecording}
              isProcessing={state.isProcessing}
              onStartRecording={startRecording}
              onStopRecording={stopRecording}
              disabled={!mediaRecorder}
              toggleMode={state.micToggleMode}
            />
          </div>

          <div className="mt-3 bg-white/5 border border-white/10 rounded-xl p-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-extrabold text-white">Always Listening</div>
              <div className={['w-2.5 h-2.5 rounded-full', state.alwaysListening ? 'bg-teal-400' : 'bg-white/25'].join(' ')} />
            </div>
            <div className="mt-1 text-xs text-white/60">
              {state.alwaysListening
                ? state.inConversationWindow
                  ? 'Conversation active (30s)'
                  : 'Say “Servio” to start'
                : 'Enable hands-free mode'}
            </div>
            <button
              onClick={() => {
                const next = !stateRef.current.alwaysListening
                setState((prev) => ({ ...prev, alwaysListening: next }))

                if (next) {
                  addMessage({
                    type: 'system',
                    content: '🎯 Always Listening activated. Say “Servio” to start a 30s conversation window.',
                    metadata: { action: { type: 'always_listening', status: 'completed' } }
                  })
                  setTimeout(() => {
                    if (!stateRef.current.isRecording && !stateRef.current.isProcessing) {
                      startRecordingRef.current?.()
                    }
                  }, 500)
                } else {
                  if (stateRef.current.isRecording) stopRecordingRef.current?.()
                  if (conversationWindowRef.current) clearTimeout(conversationWindowRef.current)
                  inConversationWindowRef.current = false
                  setState((prev) => ({ ...prev, inConversationWindow: false }))
                  addMessage({
                    type: 'system',
                    content: '🎯 Always Listening deactivated.',
                    metadata: { action: { type: 'always_listening', status: 'completed' } }
                  })
                }
              }}
              disabled={state.isProcessing}
              className={[
                'mt-3 w-full px-4 py-2.5 rounded-xl font-extrabold transition-colors',
                state.alwaysListening ? 'bg-red-500 hover:bg-red-600 text-gray-950' : 'bg-teal-500 hover:bg-teal-600 text-gray-950',
                'disabled:opacity-60 disabled:cursor-not-allowed'
              ].join(' ')}
            >
              {state.alwaysListening ? 'Stop Always Listening' : 'Start Always Listening'}
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-3 min-w-0">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-extrabold text-white">Conversation</div>
            <div className="text-xs text-white/60">
              {state.isRecording ? 'Recording' : state.isProcessing ? 'Thinking' : state.isSpeaking ? 'Speaking' : 'Ready'}
            </div>
          </div>
          <TranscriptFeed messages={state.messages} className="h-[260px] overflow-y-auto" isProcessing={state.isProcessing} />
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
          <div className="text-xs text-white/60 font-semibold mb-2">Type a command</div>
          <ChatInput onSendMessage={handleCommand} disabled={state.isProcessing || state.isRecording} placeholder="Type your command…" />
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-3 hidden 2xl:block">
          <QuickCommands onCommand={handleCommand} disabled={state.isProcessing || state.isRecording} />
        </div>
      </div>
    </div>
  )
}

