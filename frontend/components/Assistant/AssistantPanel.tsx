import React, { useState, useCallback, useEffect, useRef } from 'react'
import { StopCircle, RotateCcw, Trash2, Minimize2, Maximize2, Volume2, VolumeX, Download, Copy, RefreshCw, Sparkles } from 'lucide-react'
import RealisticAvatar from '../../components/Assistant/RealisticAvatar'
import MicrophoneButton from '../../components/Assistant/MicrophoneButton'
import TranscriptFeed, { TranscriptMessage } from '../../components/Assistant/TranscriptFeed'
import QuickCommands from '../../components/Assistant/QuickCommands'
import ChatInput, { QuickSuggestions } from '../../components/Assistant/ChatInput'
import { useUser } from '../../contexts/UserContext'
import { api } from '../../lib/api'
import { WakeWordService, isWakeWordSupported, getDefaultWakeWordConfig } from '../../lib/WakeWordService'

interface AssistantState {
  isRecording: boolean
  isProcessing: boolean
  isSpeaking: boolean
  messages: TranscriptMessage[]
  currentAudioUrl: string | null
  wakeWordEnabled: boolean
  isListeningForWakeWord: boolean
  wakeWordSupported: boolean
  micToggleMode: boolean // Toggle mode vs hold-to-talk mode
  alwaysListening: boolean // Continuous listening mode
  inConversationWindow: boolean // Active conversation window (30s after saying "Servio")
  isMinimized: boolean // Minimize/maximize state
  audioSpeed: number // Playback speed (0.5x to 2x)
  audioVolume: number // Volume (0 to 1)
  isMuted: boolean // Mute state
}

type AssistantPanelProps = {
  showHeader?: boolean
  className?: string
}

export default function AssistantPanel({ showHeader = true, className }: AssistantPanelProps) {
  const { user, hasPermission } = useUser()
  const [state, setState] = useState<AssistantState>({
    isRecording: false,
    isProcessing: false,
    isSpeaking: false,
    messages: [],
    currentAudioUrl: null,
    wakeWordEnabled: false,
    isListeningForWakeWord: false,
    wakeWordSupported: false, // Will be updated on client-side
    micToggleMode: true, // Default to toggle mode for easier testing
    alwaysListening: false, // Continuous listening mode
    inConversationWindow: false, // Active conversation window
    isMinimized: false, // Start maximized
    audioSpeed: 1.0, // Normal speed
    audioVolume: 1.0, // Full volume
    isMuted: false // Not muted
  })

  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const [talkIntensity, setTalkIntensity] = useState(0)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const mediaSourceRef = useRef<MediaElementAudioSourceNode | null>(null)
  const rafRef = useRef<number | null>(null)
  const wakeWordServiceRef = useRef<WakeWordService | null>(null)
  const isInitializingMediaRecorderRef = useRef(false)
  const recorderMimeTypeRef = useRef<string | null>(null)
  const isInitializingWakeWordRef = useRef(false)
  
  // Voice Activity Detection for Always Listening mode
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const speechDetectedRef = useRef(false)
  const recordingAnalyserRef = useRef<AnalyserNode | null>(null)
  const recordingAnimationRef = useRef<number | null>(null)
  
  // Conversation window for Always Listening (30 seconds after saying "Servio")
  const conversationWindowRef = useRef<NodeJS.Timeout | null>(null)
  const inConversationWindowRef = useRef(false)
  const CONVERSATION_WINDOW_DURATION = 30000 // 30 seconds
  
  // Create refs for callbacks to avoid re-initializing services when they change
  const handleQuickCommandRef = useRef<((command: string) => Promise<void>) | null>(null)
  const startRecordingRef = useRef<(() => void) | null>(null)
  const stopRecordingRef = useRef<(() => void) | null>(null)
  const addMessageRef = useRef<((message: Omit<TranscriptMessage, 'id' | 'timestamp'>) => void) | null>(null)
  
  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  }, [state])

  // Load conversation history from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedMessages = localStorage.getItem('servio_conversation_history')
      if (savedMessages) {
        try {
          const messages = JSON.parse(savedMessages).map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          }))
          setState(prev => ({ ...prev, messages }))
        } catch (error) {
          console.error('Failed to load conversation history:', error)
        }
      }
    }
  }, [])

  // Save conversation history to localStorage whenever messages change
  useEffect(() => {
    if (typeof window !== 'undefined' && state.messages.length > 0) {
      try {
        localStorage.setItem('servio_conversation_history', JSON.stringify(state.messages))
      } catch (error) {
        console.error('Failed to save conversation history:', error)
      }
    }
  }, [state.messages])

  const resolveAudioUrl = useCallback((audioUrl: string) => {
    // Backend returns /uploads/...; make it absolute for the browser.
    if (audioUrl.startsWith('http://') || audioUrl.startsWith('https://')) return audioUrl
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3002'
    if (audioUrl.startsWith('/')) return `${backendUrl}${audioUrl}`
    return `${backendUrl}/${audioUrl}`
  }, [])

  const stopAudio = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    setTalkIntensity(0)
    if (mediaSourceRef.current) {
      try {
        mediaSourceRef.current.disconnect()
      } catch {}
      mediaSourceRef.current = null
    }
    if (analyserRef.current) {
      try {
        analyserRef.current.disconnect()
      } catch {}
      analyserRef.current = null
    }
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      audioRef.current = null
    }
  }, [])

  const playAudio = useCallback(async (audioUrl: string) => {
    stopAudio()

    const url = resolveAudioUrl(audioUrl)
    setState(prev => ({ ...prev, isSpeaking: true, currentAudioUrl: url }))

    const audio = new Audio(url)
    audio.crossOrigin = 'anonymous'
    audio.playbackRate = stateRef.current.audioSpeed
    audio.volume = stateRef.current.isMuted ? 0 : stateRef.current.audioVolume
    audioRef.current = audio

    // Check if we're in the browser before accessing window
    if (typeof window === 'undefined') {
      // Server-side rendering, just play audio without visualization
      audio.onended = () => {
        setState(prev => ({ ...prev, isSpeaking: false, currentAudioUrl: null }))
        setTalkIntensity(0)
      }
      await audio.play()
      return
    }

    const AudioContextImpl =
      (window as any).AudioContext || (window as any).webkitAudioContext
    if (!AudioContextImpl) {
      // Fallback: still play audio even if we can't drive mouth movement.
      audio.onended = () => {
        setState(prev => ({ ...prev, isSpeaking: false, currentAudioUrl: null }))
        setTalkIntensity(0)
      }
      await audio.play()
      return
    }

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextImpl()
    }
    const audioContext = audioContextRef.current
    if (!audioContext) return

    if (audioContext.state === 'suspended') {
      await audioContext.resume()
    }

    const source = audioContext.createMediaElementSource(audio)
    const analyser = audioContext.createAnalyser()
    analyser.fftSize = 1024
    analyserRef.current = analyser
    mediaSourceRef.current = source

    source.connect(analyser)
    analyser.connect(audioContext.destination)

    const data = new Uint8Array(analyser.fftSize)
    const tick = () => {
      if (!analyserRef.current) return
      analyserRef.current.getByteTimeDomainData(data)
      // RMS amplitude -> 0..1-ish
      let sum = 0
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128
        sum += v * v
      }
      const rms = Math.sqrt(sum / data.length)
      // Boost and clamp for more visible mouth movement
      const boosted = Math.min(1, rms * 6)
      setTalkIntensity(boosted)
      rafRef.current = requestAnimationFrame(tick)
    }

    audio.onended = () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      if (mediaSourceRef.current) {
        try {
          mediaSourceRef.current.disconnect()
        } catch {}
        mediaSourceRef.current = null
      }
      if (analyserRef.current) {
        try {
          analyserRef.current.disconnect()
        } catch {}
        analyserRef.current = null
      }
      setTalkIntensity(0)
      setState(prev => ({ ...prev, isSpeaking: false, currentAudioUrl: null }))
      
      // Auto-restart recording after audio finishes in Always Listening mode
      if (stateRef.current.alwaysListening) {
        console.log('📍 Audio ended - scheduling restart...');
        setTimeout(() => {
          console.log(`📍 Audio end restart check: alwaysListening=${stateRef.current.alwaysListening}, isRecording=${stateRef.current.isRecording}, isProcessing=${stateRef.current.isProcessing}`);
          if (stateRef.current.alwaysListening && !stateRef.current.isRecording && !stateRef.current.isProcessing) {
            console.log('✅ Auto-restarting recording after audio playback (Always Listening mode)');
            startRecordingRef.current?.();
          }
        }, 800);
      }
    }

    await audio.play()
    rafRef.current = requestAnimationFrame(tick)
  }, [resolveAudioUrl, stopAudio])

  const addMessage = useCallback((message: Omit<TranscriptMessage, 'id' | 'timestamp'>) => {
    const newMessage: TranscriptMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      ...message
    }

    setState(prev => ({
      ...prev,
      messages: [...prev.messages, newMessage]
    }))
  }, [])

  // Update addMessageRef
  useEffect(() => {
    addMessageRef.current = addMessage
  }, [addMessage])

  const processRecording = useCallback(async () => {
    console.log('Processing recording, chunks count:', audioChunksRef.current.length);
    if (audioChunksRef.current.length === 0) {
      console.warn('No audio chunks to process');
      setState(prev => ({ ...prev, isProcessing: false }))
      
      // In Always Listening mode, restart immediately if no audio
      if (stateRef.current.alwaysListening) {
        setTimeout(() => startRecordingRef.current?.(), 500);
      }
      return
    }

    try {
      const mimeType = recorderMimeTypeRef.current || 'audio/webm;codecs=opus'
      const extension = mimeType.includes('mp4') ? 'mp4' : 'webm'
      const audioBlob = new Blob(audioChunksRef.current, { type: mimeType })
      const formData = new FormData()
      formData.append('audio', audioBlob, `recording.${extension}`)
      formData.append('userId', user?.id || 'anonymous')

      console.log('Sending audio to backend...');
      // Send to backend for processing
      const response = await api.post(`/api/assistant/process-audio`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })

      const payload = response.data?.data || response.data
      console.log('Backend response received:', payload);
      const { transcript, response: assistantResponse, actions, audioUrl } = payload

      // **ALWAYS LISTENING: Check for wake word in transcript**
      if (stateRef.current.alwaysListening && transcript) {
        const lowerTranscript = transcript.toLowerCase().trim();
        // Include common phonetic misrecognitions of "Servio"
        const hasWakeWord = lowerTranscript.includes('servio') || 
                            lowerTranscript.includes('sergio') ||
                            lowerTranscript.includes('serveio') ||
                            lowerTranscript.includes('service') ||
                            lowerTranscript.includes('servile') ||
                            lowerTranscript.includes('cervio') ||
                            lowerTranscript.includes('serbio') ||
                            lowerTranscript.includes('survio') ||
                            lowerTranscript.includes('servia') ||
                            lowerTranscript.includes('serve yo') ||
                            lowerTranscript.includes('serve io');
        
        // Check if we're in an active conversation window
        const inConversationWindow = inConversationWindowRef.current;
        
        console.log(`🔍 Transcript: "${transcript}" | Has wake word: ${hasWakeWord} | In window: ${inConversationWindow}`);
        
        if (!hasWakeWord && !inConversationWindow) {
          console.log(`⏭️ IGNORING - No wake word and not in conversation window`);
          addMessageRef.current?.({
            type: 'system',
            content: `🔇 Ignored: "${transcript.substring(0, 50)}..." (say "Servio" to start)`,
            metadata: { action: { type: 'ignored', status: 'completed' } }
          });
          // Don't process - just restart listening
          setState(prev => ({ ...prev, isProcessing: false }));
          audioChunksRef.current = [];
          setTimeout(() => {
            console.log('🔄 Restarting recording after ignoring...');
            startRecordingRef.current?.();
          }, 500);
          return;
        }
        
        if (hasWakeWord) {
          console.log(`✅ Wake word detected - starting conversation window (30s)`);
          // Start/restart conversation window
          if (conversationWindowRef.current) {
            clearTimeout(conversationWindowRef.current);
          }
          inConversationWindowRef.current = true;
          setState(prev => ({ ...prev, inConversationWindow: true }));
          
          conversationWindowRef.current = setTimeout(() => {
            console.log('⏱️ Conversation window expired - wake word required again');
            inConversationWindowRef.current = false;
            setState(prev => ({ ...prev, inConversationWindow: false }));
            addMessageRef.current?.({
              type: 'system',
              content: '⏱️ Conversation paused. Say "Servio" to continue.',
              metadata: { action: { type: 'conversation_window', status: 'completed' } }
            });
          }, CONVERSATION_WINDOW_DURATION);
        } else if (inConversationWindow) {
          console.log(`💬 In conversation window - processing without wake word: "${transcript}"`);
          // Reset the conversation window timer (extends the window)
          if (conversationWindowRef.current) {
            clearTimeout(conversationWindowRef.current);
          }
          conversationWindowRef.current = setTimeout(() => {
            console.log('⏱️ Conversation window expired');
            inConversationWindowRef.current = false;
            setState(prev => ({ ...prev, inConversationWindow: false }));
            addMessageRef.current?.({
              type: 'system',
              content: '⏱️ Conversation paused. Say "Servio" to continue.',
              metadata: { action: { type: 'conversation_window', status: 'completed' } }
            });
          }, CONVERSATION_WINDOW_DURATION);
        }
      }

      // Add user message (transcript)
      if (transcript) {
        addMessage({
          type: 'user',
          content: transcript,
          metadata: {
            confidence: payload.confidence || 0.9
          }
        })
      }

      // Add assistant response
      if (assistantResponse) {
        addMessage({
          type: 'assistant',
          content: assistantResponse,
          metadata: {
            duration: payload.processingTime
          }
        })
      }

      // Add action messages
      if (actions && actions.length > 0) {
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

      // Play assistant response audio
      console.log('🔊 Audio URL from backend:', audioUrl);
      if (audioUrl) {
        console.log('🔊 Attempting to play audio:', audioUrl);
        try {
          await playAudio(audioUrl)
          console.log('✅ Audio playback started successfully');
        } catch (error) {
          console.error('❌ Failed to play audio:', error);
        }
      } else {
        console.warn('⚠️ No audioUrl in response - TTS may have failed or been skipped');
      }

    } catch (error) {
      console.error('Failed to process recording:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      addMessage({
        type: 'system',
        content: `🎤 Failed to process audio: ${errorMessage}. Try speaking more clearly or use text input instead.`,
        metadata: {
          action: {
            type: 'error',
            status: 'error',
            details: errorMessage
          }
        }
      })
    } finally {
      setState(prev => ({
        ...prev,
        isProcessing: false
      }))
      audioChunksRef.current = []
      
      // Auto-restart recording if in Always Listening mode
      if (stateRef.current.alwaysListening) {
        console.log('📍 Scheduling auto-restart after audio processing...');
        setTimeout(() => {
          console.log(`📍 Checking restart conditions: alwaysListening=${stateRef.current.alwaysListening}, isRecording=${stateRef.current.isRecording}, isProcessing=${stateRef.current.isProcessing}, isSpeaking=${stateRef.current.isSpeaking}`);
          if (stateRef.current.alwaysListening && !stateRef.current.isRecording && !stateRef.current.isProcessing && !stateRef.current.isSpeaking) {
            console.log('✅ Auto-restarting recording after audio processing (Always Listening mode)');
            startRecordingRef.current?.();
          } else {
            console.log('⚠️ Cannot restart yet, scheduling retry...');
            // Retry after audio finishes
            setTimeout(() => {
              if (stateRef.current.alwaysListening && !stateRef.current.isRecording && !stateRef.current.isProcessing) {
                console.log('✅ Retry: Auto-restarting recording (Always Listening mode)');
                startRecordingRef.current?.();
              }
            }, 1000);
          }
        }, 800); // Slightly longer delay
      }
    }
  }, [user?.id, addMessage, playAudio])

  const getSupportedMimeType = useCallback(() => {
    const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
    for (const candidate of candidates) {
      if (MediaRecorder.isTypeSupported(candidate)) {
        return candidate
      }
    }
    return null
  }, [])

  // Initialize media recorder
  useEffect(() => {
    let stream: MediaStream | null = null;
    
    const initializeMediaRecorder = async () => {
      if (mediaRecorder || isInitializingMediaRecorderRef.current) return;

      isInitializingMediaRecorderRef.current = true;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            sampleRate: 44100
          }
        })

        const supportedMimeType = getSupportedMimeType()
        const recorder = supportedMimeType
          ? new MediaRecorder(stream, { mimeType: supportedMimeType })
          : new MediaRecorder(stream)
        recorderMimeTypeRef.current = supportedMimeType ?? recorder.mimeType ?? null

        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data)
          }
        }

        recorder.onstop = async () => {
          // Process the recorded audio using current processRecording callback
          await processRecording()
        }

        setMediaRecorder(recorder)
      } catch (error) {
        console.error('Failed to initialize media recorder:', error)
        addMessage({
          type: 'system',
          content: 'Failed to access microphone. Please check permissions.',
          metadata: { action: { type: 'error', status: 'error' } }
        })
      } finally {
        isInitializingMediaRecorderRef.current = false;
      }
    }

    initializeMediaRecorder()

    return () => {
      // Cleanup media stream ONLY if we are actually unmounting
      // or if the effect is truly re-running for a good reason.
      if (stream) {
        stream.getTracks().forEach(track => track.stop())
      }
    }
  }, [processRecording, getSupportedMimeType, addMessage]) // Removed mediaRecorder from dependencies to avoid loop/premature cleanup

  useEffect(() => {
    return () => {
      stopAudio()
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {})
        audioContextRef.current = null
      }
      // Cleanup wake word service
      if (wakeWordServiceRef.current) {
        wakeWordServiceRef.current.cleanup()
        wakeWordServiceRef.current = null
      }
    }
  }, [stopAudio])

  const startRecording = useCallback(() => {
    if (!mediaRecorder || state.isProcessing) return
    if (mediaRecorder.state !== 'inactive') return

    audioChunksRef.current = []
    speechDetectedRef.current = false
    
    mediaRecorder.start(100) // Collect data every 100ms

    setState(prev => ({
      ...prev,
      isRecording: true
    }))
    
    // Simple timer-based auto-stop for Always Listening (much more performant)
    if (stateRef.current.alwaysListening) {
      console.log('⏲️ Starting 5-second auto-stop timer for Always Listening');
      silenceTimeoutRef.current = setTimeout(() => {
        console.log('⏱️ 5 seconds elapsed - auto-stopping recording');
        if (stateRef.current.isRecording && stopRecordingRef.current) {
          stopRecordingRef.current();
        }
      }, 5000); // Auto-stop after 5 seconds (simpler and more performant)
    }
  }, [mediaRecorder, state.isProcessing])

  const stopRecording = useCallback(() => {
    if (!mediaRecorder || !state.isRecording) return
    if (mediaRecorder.state !== 'recording') return

    // Clean up voice activity detection
    if (recordingAnimationRef.current) {
      cancelAnimationFrame(recordingAnimationRef.current)
      recordingAnimationRef.current = null
    }
    if (recordingAnalyserRef.current) {
      recordingAnalyserRef.current = null
    }
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current)
      silenceTimeoutRef.current = null
    }

    mediaRecorder.stop()

    setState(prev => ({
      ...prev,
      isRecording: false,
      isProcessing: true
    }))
  }, [mediaRecorder, state.isRecording])

  // Update startRecordingRef
  useEffect(() => {
    startRecordingRef.current = startRecording
  }, [startRecording])

  // Update stopRecordingRef
  useEffect(() => {
    stopRecordingRef.current = stopRecording
  }, [stopRecording])

  const handleQuickCommand = useCallback(async (command: string) => {
    console.log('Handling quick command:', command);
    // Add user message immediately
    addMessage({
      type: 'user',
      content: command
    })

    // Process the text command with streaming
    setState(prev => ({ ...prev, isProcessing: true }))

    // Variables for streaming
    let streamingMessageId: string | null = null;
    let streamingContent = '';

    try {
      console.log('Sending text command to backend with streaming...');

      // Get auth token
      const token = localStorage.getItem('token');
      const backendUrl = process.env.BACKEND_URL || 'http://localhost:3002';

      const response = await fetch(`${backendUrl}/api/assistant/process-text-stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify({
          text: command,
          userId: user?.id || 'anonymous'
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No reader available');
      }

      // Read the stream
      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);

            try {
              const parsed = JSON.parse(data);

              if (parsed.type === 'content') {
                // Stream content - update or create message
                streamingContent += parsed.content;

                if (!streamingMessageId) {
                  // Create new streaming message
                  const id = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                  streamingMessageId = id;

                  setState(prev => ({
                    ...prev,
                    messages: [...prev.messages, {
                      id,
                      type: 'assistant' as const,
                      content: streamingContent,
                      timestamp: new Date(),
                      metadata: {}
                    }]
                  }));
                } else {
                  // Update existing message
                  setState(prev => ({
                    ...prev,
                    messages: prev.messages.map(msg =>
                      msg.id === streamingMessageId
                        ? { ...msg, content: streamingContent }
                        : msg
                    )
                  }));
                }
              } else if (parsed.type === 'action') {
                // Add action message
                addMessage({
                  type: 'action',
                  content: parsed.action.description,
                  metadata: {
                    action: {
                      type: parsed.action.type,
                      status: parsed.action.status,
                      details: parsed.action.details
                    }
                  }
                });
              } else if (parsed.type === 'audio') {
                // Play audio
                console.log('🔊 Audio URL from stream:', parsed.audioUrl);
                if (parsed.audioUrl) {
                  try {
                    await playAudio(parsed.audioUrl);
                    console.log('✅ Audio playback started successfully (stream)');
                  } catch (error) {
                    console.error('❌ Failed to play audio (stream):', error);
                  }
                }
              } else if (parsed.type === 'done') {
                // Update processing time
                if (streamingMessageId && parsed.processingTime) {
                  setState(prev => ({
                    ...prev,
                    messages: prev.messages.map(msg =>
                      msg.id === streamingMessageId
                        ? { ...msg, metadata: { ...msg.metadata, duration: parsed.processingTime } }
                        : msg
                    )
                  }));
                }
              } else if (parsed.type === 'error') {
                // Handle error
                addMessage({
                  type: 'system',
                  content: `❌ Error: ${parsed.error}`,
                  metadata: {
                    action: {
                      type: 'error',
                      status: 'error',
                      details: parsed.error
                    }
                  }
                });
              }
            } catch (parseError) {
              console.warn('Failed to parse SSE data:', parseError);
            }
          }
        }
      }

    } catch (error) {
      console.error('Failed to process command:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      const isNetworkError = errorMessage.includes('network') || errorMessage.includes('fetch')
      const isTimeoutError = errorMessage.includes('timeout')
      
      addMessage({
        type: 'system',
        content: isNetworkError 
          ? '🔌 Network error. Please check your connection and try again.' 
          : isTimeoutError
          ? '⏱️ Request timed out. The server might be busy. Please try again.'
          : `❌ Error: ${errorMessage}. Please try rephrasing your command.`,
        metadata: {
          action: {
            type: 'error',
            status: 'error',
            details: errorMessage
          }
        }
      })
    } finally {
      setState(prev => ({ ...prev, isProcessing: false }))
      
      // Auto-restart if Always Listening is enabled
      if (stateRef.current.alwaysListening) {
        console.log('📍 Scheduling auto-restart after text command...');
        setTimeout(() => {
          console.log(`📍 Text command restart check: alwaysListening=${stateRef.current.alwaysListening}, isRecording=${stateRef.current.isRecording}, isSpeaking=${stateRef.current.isSpeaking}`);
          if (stateRef.current.alwaysListening && !stateRef.current.isRecording && !stateRef.current.isProcessing && !stateRef.current.isSpeaking) {
            console.log('✅ Auto-restarting recording after text command (Always Listening mode)');
            startRecordingRef.current?.();
          } else {
            setTimeout(() => {
              if (stateRef.current.alwaysListening && !stateRef.current.isRecording && !stateRef.current.isProcessing) {
                console.log('✅ Retry: Auto-restarting after text command (Always Listening mode)');
                startRecordingRef.current?.();
              }
            }, 1000);
          }
        }, 800);
      }
    }
  }, [user?.id, addMessage, playAudio])

  // Update handleQuickCommandRef
  useEffect(() => {
    handleQuickCommandRef.current = handleQuickCommand
  }, [handleQuickCommand])

  // Wake word handling functions
  const initializeWakeWordService = useCallback(async () => {
    if (!state.wakeWordSupported) {
      console.warn('Wake word detection not supported in this browser');
      return false;
    }

    // Don't re-initialize if already initialized or initializing
    if (wakeWordServiceRef.current?.getState().isInitialized || isInitializingWakeWordRef.current) {
      return true;
    }

    isInitializingWakeWordRef.current = true;
    try {
      const config = getDefaultWakeWordConfig();
      
      wakeWordServiceRef.current = new WakeWordService({
        ...config,
        onWakeWordDetected: async (detectedPhrase: string) => {
          console.log(`Wake word detected callback: "${detectedPhrase}"`);
          
          // Immediate audio acknowledgment - play a quick "beep" or say "Yes?"
          const beep = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYHGGS56+mgUBELTKXh8bllHAU7k9XvyH0pBSh+zPDakTsIF2Kz6OumVRMNS6Lf8rpnIAU3i9Pvx4EqByR8yu/ekj0JGWG16+ypVxQLTKPi8LxnIgU7lNbvyH4qBCh9zO/dkj0JGGCy6OymVBINSqDf8rtnIQU5i9Huyoau');
          beep.volume = 0.3;
          try {
            await beep.play();
          } catch (e) {
            console.log('Could not play beep');
          }
          
          // Use refs to get latest callbacks
          if (addMessageRef.current) {
            addMessageRef.current({
              type: 'assistant',
              content: `✨ Yes? I'm listening...`,
              metadata: {
                action: {
                  type: 'wake_word',
                  status: 'completed'
                }
              }
            });
          }

          // Check if there's a command after the wake word
          const colonIndex = detectedPhrase.indexOf(':');
          if (colonIndex > -1) {
            const command = detectedPhrase.substring(colonIndex + 1).trim();
            if (command && handleQuickCommandRef.current) {
              // Process the command automatically
              handleQuickCommandRef.current(command);
            }
          } else if (startRecordingRef.current) {
            // Just wake word detected, start listening for command
            startRecordingRef.current();
          }
        },
        onError: (error: Error) => {
          console.error('Wake word error callback:', error);
          if (addMessageRef.current) {
            addMessageRef.current({
              type: 'system',
              content: `Wake word error: ${error.message}`,
              metadata: {
                action: {
                  type: 'error',
                  status: 'error'
                }
              }
            });
          }
        },
        onListeningStateChange: (isListening: boolean) => {
          setState(prev => {
            if (prev.isListeningForWakeWord === isListening) return prev;
            return {
              ...prev,
              isListeningForWakeWord: isListening
            };
          });
        },
        onPartialResult: (transcript: string) => {
          // Optional: Show what's being heard (for debugging)
        }
      } as any);

      const initialized = await wakeWordServiceRef.current.initialize();
      
      if (initialized) {
        return true;
      } else {
        console.error('Failed to initialize wake word service');
        return false;
      }

    } catch (error) {
      console.error('Error initializing wake word service:', error);
      return false;
    } finally {
      isInitializingWakeWordRef.current = false;
    }
  }, [state.wakeWordSupported]); // Truly stable callback

  const toggleWakeWordListening = useCallback(async () => {
    if (!wakeWordServiceRef.current || !wakeWordServiceRef.current.getState().isInitialized) {
      const initialized = await initializeWakeWordService();
      if (!initialized) {
        return;
      }
    }

    if (stateRef.current.isListeningForWakeWord) {
      await wakeWordServiceRef.current?.stopListening();
      setState(prev => ({ ...prev, wakeWordEnabled: false }));
    } else {
      const started = await wakeWordServiceRef.current?.startListening();
      if (started) {
        setState(prev => ({ ...prev, wakeWordEnabled: true }));
        
        addMessage({
          type: 'system',
          content: '👂 Wake word listening started. Say "Hey Servio" to activate!',
          metadata: {
            action: {
              type: 'wake_word',
              status: 'completed'
            }
          }
        });
      }
    }
  }, [initializeWakeWordService, addMessage]);

  // Update wake word support status on client-side mount
  useEffect(() => {
    setState(prev => ({ ...prev, wakeWordSupported: isWakeWordSupported() }));
  }, []);

  // Auto-initialize wake word service on component mount
  useEffect(() => {
    if (state.wakeWordSupported) {
      initializeWakeWordService();
    }
  }, [state.wakeWordSupported, initializeWakeWordService]);

  // User control functions
  const handleStopSpeaking = useCallback(() => {
    stopAudio()
    addMessage({
      type: 'system',
      content: '🛑 Audio playback stopped',
      metadata: { action: { type: 'stop_audio', status: 'completed' } }
    })
  }, [stopAudio, addMessage])

  const handleReplayLast = useCallback(() => {
    const lastAssistantMessage = [...state.messages].reverse().find(m => m.type === 'assistant')
    if (lastAssistantMessage && state.currentAudioUrl) {
      playAudio(state.currentAudioUrl)
      addMessage({
        type: 'system',
        content: '🔁 Replaying last response',
        metadata: { action: { type: 'replay', status: 'completed' } }
      })
    }
  }, [state.messages, state.currentAudioUrl, playAudio, addMessage])

  const handleClearConversation = useCallback(() => {
    setState(prev => ({ ...prev, messages: [] }))
    if (typeof window !== 'undefined') {
      localStorage.removeItem('servio_conversation_history')
    }
    addMessage({
      type: 'system',
      content: '🗑️ Conversation cleared',
      metadata: { action: { type: 'clear', status: 'completed' } }
    })
  }, [addMessage])

  const toggleMinimize = useCallback(() => {
    setState(prev => ({ ...prev, isMinimized: !prev.isMinimized }))
  }, [])

  const adjustSpeed = useCallback((speed: number) => {
    setState(prev => ({ ...prev, audioSpeed: Math.max(0.5, Math.min(2, speed)) }))
    if (audioRef.current) {
      audioRef.current.playbackRate = speed
    }
  }, [])

  const adjustVolume = useCallback((volume: number) => {
    const newVolume = Math.max(0, Math.min(1, volume))
    setState(prev => ({ ...prev, audioVolume: newVolume }))
    if (audioRef.current && !stateRef.current.isMuted) {
      audioRef.current.volume = newVolume
    }
  }, [])

  const toggleMute = useCallback(() => {
    setState(prev => {
      const newMuted = !prev.isMuted
      if (audioRef.current) {
        audioRef.current.volume = newMuted ? 0 : prev.audioVolume
      }
      return { ...prev, isMuted: newMuted }
    })
  }, [])

  const copyMessageToClipboard = useCallback((content: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(content).then(() => {
        addMessage({
          type: 'system',
          content: '📋 Copied to clipboard',
          metadata: { action: { type: 'copy', status: 'completed' } }
        })
      }).catch((error) => {
        console.error('Failed to copy:', error)
      })
    }
  }, [addMessage])

  const retryMessage = useCallback((content: string) => {
    handleQuickCommand(content)
  }, [handleQuickCommand])

  const exportConversation = useCallback(() => {
    const conversationText = state.messages
      .map(m => `[${m.type.toUpperCase()}] ${m.content}`)
      .join('\n\n')

    const blob = new Blob([conversationText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `servio-conversation-${new Date().toISOString().split('T')[0]}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    addMessage({
      type: 'system',
      content: '💾 Conversation exported',
      metadata: { action: { type: 'export', status: 'completed' } }
    })
  }, [state.messages, addMessage])

  const containerClasses = ['max-w-7xl mx-auto transition-all duration-300', className].filter(Boolean).join(' ')

  // Minimized floating assistant
  if (state.isMinimized) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <div className="relative group">
          {/* Floating button with gradient */}
          <button
            onClick={toggleMinimize}
            className="relative w-16 h-16 bg-gradient-to-br from-violet-600 via-fuchsia-600 to-pink-600 rounded-full shadow-2xl hover:shadow-violet-500/50 transition-all duration-300 hover:scale-110 flex items-center justify-center overflow-hidden"
          >
            {/* Animated pulse ring */}
            {state.isRecording && (
              <span className="absolute inset-0 w-full h-full">
                <span className="absolute inset-0 w-full h-full rounded-full bg-red-500 animate-ping opacity-75"></span>
              </span>
            )}
            {state.isProcessing && (
              <span className="absolute inset-0 w-full h-full">
                <span className="absolute inset-0 w-full h-full rounded-full bg-amber-500 animate-ping opacity-75"></span>
              </span>
            )}
            {state.isSpeaking && (
              <span className="absolute inset-0 w-full h-full">
                <span className="absolute inset-0 w-full h-full rounded-full bg-emerald-500 animate-ping opacity-75"></span>
              </span>
            )}

            {/* Icon */}
            <Sparkles className="w-8 h-8 text-white relative z-10" />

            {/* Notification badge */}
            {state.messages.length > 0 && (
              <span className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center shadow-lg z-20">
                {state.messages.length > 9 ? '9+' : state.messages.length}
              </span>
            )}
          </button>

          {/* Tooltip */}
          <div className="absolute bottom-full right-0 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            <div className="bg-gray-900 text-white text-sm px-3 py-2 rounded-lg shadow-xl whitespace-nowrap">
              Open Servio Assistant
              <div className="absolute top-full right-4 -mt-1">
                <div className="w-2 h-2 bg-gray-900 transform rotate-45"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={containerClasses}>
      {showHeader && (
        <div className="mb-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <Sparkles className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                <span className="text-sm font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-widest">AI Assistant</span>
              </div>
              <h1 className="text-3xl md:text-4xl font-black bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-600 bg-clip-text text-transparent tracking-tight">
                Talk to Servio
              </h1>
              <p className="mt-2 text-surface-600 dark:text-surface-400 max-w-lg">
                Your intelligent restaurant assistant - manage orders, inventory, and tasks with voice or text.
              </p>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={exportConversation}
                disabled={state.messages.length === 0}
                className="inline-flex items-center gap-2 px-3 py-2 bg-surface-100 dark:bg-surface-800 text-surface-700 dark:text-surface-300 rounded-lg text-sm font-medium hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                title="Export conversation"
              >
                <Download className="w-4 h-4" />
              </button>
              <button
                onClick={toggleMinimize}
                className="inline-flex items-center gap-2 px-3 py-2 bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 rounded-lg text-sm font-medium hover:bg-violet-200 dark:hover:bg-violet-900/50 transition-colors shadow-sm"
                title="Minimize assistant"
              >
                <Minimize2 className="w-4 h-4" />
              </button>
            </div>
          </div>

            <div className="flex flex-wrap items-center gap-2">
              {state.isRecording && (
                <span className="inline-flex items-center gap-2 px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-full text-sm font-semibold">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                  Recording
                </span>
              )}
              {state.isProcessing && (
                <span className="inline-flex items-center gap-2 px-4 py-2 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-full text-sm font-semibold">
                  <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></span>
                  Processing
                </span>
              )}
              {state.isSpeaking && (
                <span className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-full text-sm font-semibold">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                  Speaking
                </span>
              )}
              {!state.isRecording && !state.isProcessing && !state.isSpeaking && (
                <span className="inline-flex items-center gap-2 px-4 py-2 bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 rounded-full text-sm font-semibold">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                  Ready
                </span>
              )}
              {state.alwaysListening && (
                <span className="inline-flex items-center gap-2 px-4 py-2 bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 rounded-full text-sm font-semibold">
                  <span className="w-2 h-2 bg-violet-500 rounded-full animate-pulse"></span>
                  {state.inConversationWindow ? 'Conversation Active' : 'Listening for "Servio"'}
                </span>
              )}
            </div>

            {/* Audio & Control Buttons */}
            <div className="flex flex-wrap items-center gap-2 mt-4">
              {/* Audio Controls */}
              {(state.isSpeaking || state.currentAudioUrl) && (
                <div className="flex items-center gap-2 px-4 py-2 bg-surface-100 dark:bg-surface-800 rounded-lg">
                  <button
                    onClick={toggleMute}
                    className="p-1 hover:bg-surface-200 dark:hover:bg-surface-700 rounded transition-colors"
                    title={state.isMuted ? 'Unmute' : 'Mute'}
                  >
                    {state.isMuted ? (
                      <VolumeX className="w-4 h-4 text-red-600 dark:text-red-400" />
                    ) : (
                      <Volume2 className="w-4 h-4 text-surface-700 dark:text-surface-300" />
                    )}
                  </button>

                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={state.audioVolume}
                    onChange={(e) => adjustVolume(parseFloat(e.target.value))}
                    className="w-20 h-1 bg-surface-300 dark:bg-surface-600 rounded-lg appearance-none cursor-pointer"
                    title="Volume"
                  />

                  <span className="text-xs text-surface-600 dark:text-surface-400 mx-1">|</span>

                  <select
                    value={state.audioSpeed}
                    onChange={(e) => adjustSpeed(parseFloat(e.target.value))}
                    className="text-xs bg-transparent text-surface-700 dark:text-surface-300 cursor-pointer focus:outline-none"
                    title="Speed"
                  >
                    <option value="0.5">0.5x</option>
                    <option value="0.75">0.75x</option>
                    <option value="1">1x</option>
                    <option value="1.25">1.25x</option>
                    <option value="1.5">1.5x</option>
                    <option value="2">2x</option>
                  </select>
                </div>
              )}

              {state.isSpeaking && (
                <button
                  onClick={handleStopSpeaking}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
                >
                  <StopCircle className="w-4 h-4" />
                  Stop
                </button>
              )}
              {state.currentAudioUrl && !state.isSpeaking && (
                <button
                  onClick={handleReplayLast}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
                >
                  <RotateCcw className="w-4 h-4" />
                  Replay
                </button>
              )}
              {state.messages.length > 0 && (
                <button
                  onClick={handleClearConversation}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
                >
                  <Trash2 className="w-4 h-4" />
                  Clear
                </button>
              )}
            </div>
          </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
            {/* Left Panel - Controls */}
            <div className="lg:col-span-1 space-y-4">
              {/* Avatar Card */}
              <div className="relative bg-white/80 dark:bg-surface-800/80 backdrop-blur-xl rounded-3xl p-6 shadow-xl border border-white/50 dark:border-surface-700/50 overflow-hidden">
                <div className="absolute -top-20 -right-20 w-40 h-40 rounded-full bg-gradient-to-br from-teal-400/20 to-violet-400/20 blur-2xl" />
                
                <RealisticAvatar
                  isTalking={state.isSpeaking}
                  isListening={state.isRecording}
                  isThinking={state.isProcessing}
                  size="large"
                  gender="female"
                  name="Servio Assistant"
                  audioLevel={talkIntensity * 100}
                />

                <div className="mt-4">
                  <MicrophoneButton
                    isRecording={state.isRecording}
                    isProcessing={state.isProcessing}
                    onStartRecording={startRecording}
                    onStopRecording={stopRecording}
                    disabled={!mediaRecorder}
                    toggleMode={state.micToggleMode}
                  />
                </div>
              </div>

              {/* Always Listening Card */}
              <div className="relative bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 dark:from-violet-900/30 dark:to-fuchsia-900/30 backdrop-blur-xl rounded-3xl p-5 shadow-xl border border-violet-200/50 dark:border-violet-800/50 overflow-hidden">
                <div className="absolute -bottom-10 -left-10 w-32 h-32 rounded-full bg-violet-500/20 blur-2xl" />
                
                <div className="relative">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-violet-900 dark:text-violet-100">
                      Always Listening
                    </h3>
                    <div className={`w-3 h-3 rounded-full ${
                      state.alwaysListening ? 'bg-violet-500 animate-pulse shadow-lg shadow-violet-500/50' : 'bg-surface-300 dark:bg-surface-600'
                    }`} />
                  </div>
                  
                  <p className="text-xs text-violet-700 dark:text-violet-300 mb-4">
                    {state.alwaysListening 
                      ? 'Continuously listening for commands' 
                      : 'Enable hands-free voice control'
                    }
                  </p>

                  <button
                    onClick={() => {
                      const newAlwaysListening = !state.alwaysListening;
                      setState(prev => ({ ...prev, alwaysListening: newAlwaysListening }));
                      
                      if (newAlwaysListening) {
                        addMessageRef.current?.({
                          type: 'system',
                          content: 'Always Listening activated! Say "Servio" to start a command.',
                          metadata: { action: { type: 'always_listening', status: 'completed' } }
                        });
                        
                        setTimeout(() => {
                          if (startRecordingRef.current && !stateRef.current.isRecording && !stateRef.current.isProcessing) {
                            startRecordingRef.current();
                          }
                        }, 500);
                      } else {
                        if (stateRef.current.isRecording && stopRecordingRef.current) {
                          stopRecordingRef.current();
                        }
                        
                        if (conversationWindowRef.current) {
                          clearTimeout(conversationWindowRef.current);
                          conversationWindowRef.current = null;
                        }
                        inConversationWindowRef.current = false;
                        setState(prev => ({ ...prev, inConversationWindow: false }));
                        
                        addMessageRef.current?.({
                          type: 'system',
                          content: 'Always Listening deactivated.',
                          metadata: { action: { type: 'always_listening', status: 'completed' } }
                        });
                      }
                    }}
                    disabled={state.isProcessing}
                    className={`w-full py-3 text-sm font-bold rounded-xl transition-all ${
                      state.alwaysListening
                        ? 'bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white shadow-lg shadow-rose-500/30'
                        : 'bg-gradient-to-r from-violet-500 to-fuchsia-600 hover:from-violet-600 hover:to-fuchsia-700 text-white shadow-lg shadow-violet-500/30'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {state.alwaysListening ? 'Stop Listening' : 'Start Listening'}
                  </button>

                  {state.alwaysListening && state.inConversationWindow && (
                    <div className="mt-3 p-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl">
                      <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                        Conversation active - speak freely
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Panel - Conversation */}
            <div className="lg:col-span-3 space-y-4">
              {/* Conversation History */}
              <div className="relative bg-white/80 dark:bg-surface-800/80 backdrop-blur-xl rounded-3xl p-6 shadow-xl border border-white/50 dark:border-surface-700/50 h-[50vh] lg:h-[420px] flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-surface-900 dark:text-white">
                    Conversation
                  </h2>
                  <span className="text-sm text-surface-500 dark:text-surface-400">
                    {state.messages.length} messages
                  </span>
                </div>

                <TranscriptFeed
                  messages={state.messages}
                  className="flex-1 overflow-y-auto"
                  isProcessing={state.isProcessing}
                  onCopyMessage={copyMessageToClipboard}
                  onRetryMessage={retryMessage}
                />
              </div>

              {/* Chat Input */}
              <div className="relative bg-white/80 dark:bg-surface-800/80 backdrop-blur-xl rounded-3xl p-5 shadow-xl border border-white/50 dark:border-surface-700/50">
                <ChatInput
                  onSendMessage={handleQuickCommand}
                  disabled={state.isProcessing || state.isRecording}
                  placeholder="Type a command... (e.g., '86 the chicken', 'check orders')"
                />

                {/* Quick Commands */}
                <div className="mt-4 pt-4 border-t border-surface-200/50 dark:border-surface-700/50">
                  <p className="text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider mb-3">Quick Commands</p>
                  <div className="flex flex-wrap gap-2">
                    <button 
                      onClick={() => handleQuickCommand('check current orders')} 
                      disabled={state.isProcessing || state.isRecording} 
                      className="px-4 py-2 text-sm font-medium bg-surface-100 dark:bg-surface-700 text-surface-700 dark:text-surface-300 rounded-xl hover:bg-surface-200 dark:hover:bg-surface-600 transition-colors disabled:opacity-50"
                    >
                      Check orders
                    </button>
                    <button 
                      onClick={() => handleQuickCommand("what items are 86'd")} 
                      disabled={state.isProcessing || state.isRecording} 
                      className="px-4 py-2 text-sm font-medium bg-surface-100 dark:bg-surface-700 text-surface-700 dark:text-surface-300 rounded-xl hover:bg-surface-200 dark:hover:bg-surface-600 transition-colors disabled:opacity-50"
                    >
                      What's 86'd?
                    </button>
                    <button 
                      onClick={() => handleQuickCommand('show inventory levels')} 
                      disabled={state.isProcessing || state.isRecording} 
                      className="px-4 py-2 text-sm font-medium bg-surface-100 dark:bg-surface-700 text-surface-700 dark:text-surface-300 rounded-xl hover:bg-surface-200 dark:hover:bg-surface-600 transition-colors disabled:opacity-50"
                    >
                      Inventory
                    </button>
                    <button 
                      onClick={() => handleQuickCommand('show pending tasks')} 
                      disabled={state.isProcessing || state.isRecording} 
                      className="px-4 py-2 text-sm font-medium bg-surface-100 dark:bg-surface-700 text-surface-700 dark:text-surface-300 rounded-xl hover:bg-surface-200 dark:hover:bg-surface-600 transition-colors disabled:opacity-50"
                    >
                      Tasks
                    </button>
                  </div>
                </div>
              </div>
            </div>
      </div>
    </div>
  )
}

// Authentication will be handled client-side for static export compatibility
