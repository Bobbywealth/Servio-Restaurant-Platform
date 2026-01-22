import React, { useState, useCallback, useEffect, useRef } from 'react'
import Head from 'next/head'
import DashboardLayout from '../../components/Layout/DashboardLayout'
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
}

export default function AssistantPage() {
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
    inConversationWindow: false // Active conversation window
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
  
  // Timeout refs for cleanup
  const autoRestartTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const processAudioTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const textCommandTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const retryRestartTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const autoStopTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Max retries for auto-restart
  const restartRetryCountRef = useRef(0)
  const MAX_RESTART_RETRIES = 3

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
    audio.volume = 1.0 // Max volume for clarity
    audio.preload = 'auto'
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

    // Add gain node for volume boost and compression for clarity
    const gainNode = audioContext.createGain()
    gainNode.gain.value = 1.5 // 50% volume boost for better audibility

    // Add dynamics compressor for consistent volume
    const compressor = audioContext.createDynamicsCompressor()
    compressor.threshold.value = -24
    compressor.knee.value = 30
    compressor.ratio.value = 12
    compressor.attack.value = 0.003
    compressor.release.value = 0.25

    source.connect(compressor)
    compressor.connect(gainNode)
    gainNode.connect(analyser)
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
      // Boost and clamp for more visible mouth movement (increased for better animation)
      const boosted = Math.min(1, rms * 8)
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
        console.log('?? Audio ended - scheduling restart...');
        if (autoRestartTimeoutRef.current) clearTimeout(autoRestartTimeoutRef.current)
        autoRestartTimeoutRef.current = setTimeout(() => {
          console.log(`?? Audio end restart check: alwaysListening=${stateRef.current.alwaysListening}, isRecording=${stateRef.current.isRecording}, isProcessing=${stateRef.current.isProcessing}`);
          if (stateRef.current.alwaysListening && !stateRef.current.isRecording && !stateRef.current.isProcessing) {
            console.log('? Auto-restarting recording after audio playback (Always Listening mode)');
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
        if (autoRestartTimeoutRef.current) clearTimeout(autoRestartTimeoutRef.current)
        autoRestartTimeoutRef.current = setTimeout(() => startRecordingRef.current?.(), 500);
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
        const hasWakeWord = lowerTranscript.includes('servio') || 
                            lowerTranscript.includes('sergio') ||
                            lowerTranscript.includes('serveio');
        
        // Check if we're in an active conversation window
        const inConversationWindow = inConversationWindowRef.current;
        
        console.log(`?? Transcript: "${transcript}" | Has wake word: ${hasWakeWord} | In window: ${inConversationWindow}`);
        
        if (!hasWakeWord && !inConversationWindow) {
          console.log(`?? IGNORING - No wake word and not in conversation window`);
          addMessageRef.current?.({
            type: 'system',
            content: `?? Ignored: "${transcript.substring(0, 50)}..." (say "Servio" to start)`,
            metadata: { action: { type: 'ignored', status: 'completed' } }
          });
          // Don't process - just restart listening
          setState(prev => ({ ...prev, isProcessing: false }));
          audioChunksRef.current = [];
          if (autoRestartTimeoutRef.current) clearTimeout(autoRestartTimeoutRef.current)
          autoRestartTimeoutRef.current = setTimeout(() => {
            console.log('?? Restarting recording after ignoring...');
            startRecordingRef.current?.();
          }, 500);
          return;
        }
        
        if (hasWakeWord) {
          console.log(`? Wake word detected - starting conversation window (30s)`);
          // Start/restart conversation window
          if (conversationWindowRef.current) {
            clearTimeout(conversationWindowRef.current);
          }
          inConversationWindowRef.current = true;
          setState(prev => ({ ...prev, inConversationWindow: true }));
          
          conversationWindowRef.current = setTimeout(() => {
            console.log('?? Conversation window expired - wake word required again');
            inConversationWindowRef.current = false;
            setState(prev => ({ ...prev, inConversationWindow: false }));
            addMessageRef.current?.({
              type: 'system',
              content: '?? Conversation paused. Say "Servio" to continue.',
              metadata: { action: { type: 'conversation_window', status: 'completed' } }
            });
          }, CONVERSATION_WINDOW_DURATION);
        } else if (inConversationWindow) {
          console.log(`?? In conversation window - processing without wake word: "${transcript}"`);
          // Reset the conversation window timer (extends the window)
          if (conversationWindowRef.current) {
            clearTimeout(conversationWindowRef.current);
          }
          conversationWindowRef.current = setTimeout(() => {
            console.log('?? Conversation window expired');
            inConversationWindowRef.current = false;
            setState(prev => ({ ...prev, inConversationWindow: false }));
            addMessageRef.current?.({
              type: 'system',
              content: '?? Conversation paused. Say "Servio" to continue.',
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
      if (audioUrl) {
        await playAudio(audioUrl)
      }

    } catch (error) {
      console.error('Failed to process recording:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      addMessage({
        type: 'system',
        content: `?? Failed to process audio: ${errorMessage}. Try speaking more clearly or use text input instead.`,
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
        console.log('?? Scheduling auto-restart after audio processing...');
        if (autoRestartTimeoutRef.current) clearTimeout(autoRestartTimeoutRef.current)
        autoRestartTimeoutRef.current = setTimeout(() => {
          console.log(`?? Checking restart conditions: alwaysListening=${stateRef.current.alwaysListening}, isRecording=${stateRef.current.isRecording}, isProcessing=${stateRef.current.isProcessing}, isSpeaking=${stateRef.current.isSpeaking}`);
          if (stateRef.current.alwaysListening && !stateRef.current.isRecording && !stateRef.current.isProcessing && !stateRef.current.isSpeaking) {
            console.log('? Auto-restarting recording after audio processing (Always Listening mode)');
            startRecordingRef.current?.();
          } else {
            console.log('?? Cannot restart yet, scheduling retry...');
            // Retry after audio finishes
            if (retryRestartTimeoutRef.current) clearTimeout(retryRestartTimeoutRef.current)
            retryRestartTimeoutRef.current = setTimeout(() => {
              if (stateRef.current.alwaysListening && !stateRef.current.isRecording && !stateRef.current.isProcessing) {
                console.log('? Retry: Auto-restarting recording (Always Listening mode)');
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
            autoGainControl: true, // Automatically adjust mic volume
            sampleRate: 48000, // Higher sample rate for better quality
            channelCount: 1, // Mono is sufficient and smaller file size
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
      // Cleanup all timeouts
      if (autoRestartTimeoutRef.current) clearTimeout(autoRestartTimeoutRef.current)
      if (processAudioTimeoutRef.current) clearTimeout(processAudioTimeoutRef.current)
      if (textCommandTimeoutRef.current) clearTimeout(textCommandTimeoutRef.current)
      if (retryRestartTimeoutRef.current) clearTimeout(retryRestartTimeoutRef.current)
      if (autoStopTimeoutRef.current) clearTimeout(autoStopTimeoutRef.current)
      if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current)
      if (conversationWindowRef.current) clearTimeout(conversationWindowRef.current)
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
      console.log('?? Starting 5-second auto-stop timer for Always Listening');
      if (autoStopTimeoutRef.current) clearTimeout(autoStopTimeoutRef.current)
      autoStopTimeoutRef.current = setTimeout(() => {
        console.log('?? 5 seconds elapsed - auto-stopping recording');
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

    // Process the text command
    setState(prev => ({ ...prev, isProcessing: true }))

    try {
      console.log('Sending text command to backend...');
      const response = await api.post(`/api/assistant/process-text`, {
        text: command,
        userId: user?.id || 'anonymous'
      })

      const payload = response.data?.data || response.data
      console.log('Backend response received:', payload);
      const { response: assistantResponse, actions, audioUrl } = payload

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

      // Play response audio
      if (audioUrl) {
        await playAudio(audioUrl)
      }

    } catch (error) {
      console.error('Failed to process command:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      const isNetworkError = errorMessage.includes('network') || errorMessage.includes('fetch')
      const isTimeoutError = errorMessage.includes('timeout')
      
      addMessage({
        type: 'system',
        content: isNetworkError 
          ? '?? Network error. Please check your connection and try again.' 
          : isTimeoutError
          ? '?? Request timed out. The server might be busy. Please try again.'
          : `? Error: ${errorMessage}. Please try rephrasing your command.`,
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
        console.log('?? Scheduling auto-restart after text command...');
        setTimeout(() => {
          console.log(`?? Text command restart check: alwaysListening=${stateRef.current.alwaysListening}, isRecording=${stateRef.current.isRecording}, isSpeaking=${stateRef.current.isSpeaking}`);
          if (stateRef.current.alwaysListening && !stateRef.current.isRecording && !stateRef.current.isProcessing && !stateRef.current.isSpeaking) {
            console.log('? Auto-restarting recording after text command (Always Listening mode)');
            startRecordingRef.current?.();
          } else {
            setTimeout(() => {
              if (stateRef.current.alwaysListening && !stateRef.current.isRecording && !stateRef.current.isProcessing) {
                console.log('? Retry: Auto-restarting after text command (Always Listening mode)');
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
          beep.volume = 0.8; // Increased from 0.3 to 0.8 for more noticeable beep
          try {
            await beep.play();
          } catch (e) {
            console.log('Could not play beep');
          }
          
          // Use refs to get latest callbacks
          if (addMessageRef.current) {
            addMessageRef.current({
              type: 'assistant',
              content: `? Yes? I'm listening...`,
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
          content: '?? Wake word listening started. Say "Hey Servio" to activate!',
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

  return (
    <>
      <Head>
        <title>AI Assistant - Servio</title>
        <meta name="description" content="Voice-powered AI assistant for restaurant operations" />
      </Head>

      <DashboardLayout>
        <div className="max-w-6xl mx-auto px-2 sm:px-4">
          {/* Minimalist Header */}
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div 
                data-testid="status-indicator"
                className={`w-2 h-2 rounded-full ${
                state.isRecording ? 'bg-red-500 animate-pulse' :
                state.isProcessing ? 'bg-yellow-500 animate-pulse' :
                state.isSpeaking ? 'bg-green-500 animate-pulse' :
                'bg-gray-400'
              }`} />
              <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100">
                AI Assistant
              </h1>
              {state.alwaysListening && (
                <span className="px-2 py-0.5 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full font-medium">
                  Always On
                </span>
              )}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {state.messages.length} messages
            </div>
          </div>

          {/* Main Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {/* Left Sidebar - Controls */}
            <div className="lg:col-span-1 space-y-3">
              {/* Avatar Card */}
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
                <div data-testid="assistant-avatar">
                  <RealisticAvatar
                    isTalking={state.isSpeaking}
                    isListening={state.isRecording}
                    isThinking={state.isProcessing}
                    size="medium"
                    gender="female"
                    name="Servio"
                    audioLevel={talkIntensity * 100}
                  />
                </div>
                
                {/* Audio Visualization */}
                {state.isSpeaking && (
                  <div className="flex items-center justify-center gap-1 h-12 mt-3">
                    {[...Array(5)].map((_, i) => (
                      <div
                        key={i}
                        className="w-1 bg-gradient-to-t from-green-500 to-green-400 rounded-full transition-all"
                        style={{
                          height: `${Math.max(8, talkIntensity * 48 * (1 + Math.sin(Date.now() / 100 + i)))}px`,
                          opacity: 0.6 + talkIntensity * 0.4,
                          animation: `pulse ${0.3 + i * 0.1}s ease-in-out infinite alternate`
                        }}
                      />
                    ))}
                  </div>
                )}
                
                <div className={state.isSpeaking ? 'mt-2 text-center' : 'mt-3 text-center'} data-testid="microphone-button">
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

              {/* Always Listening Toggle */}
              <div className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm border border-gray-200 dark:border-gray-700">
                <button
                  data-testid="always-listening-toggle"
                  onClick={() => {
                    const newAlwaysListening = !state.alwaysListening;
                    setState(prev => ({ ...prev, alwaysListening: newAlwaysListening }));
                    
                    if (newAlwaysListening) {
                      addMessageRef.current?.({
                        type: 'system',
                        content: '?? Always Listening activated.',
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
                        content: '?? Always Listening deactivated.',
                        metadata: { action: { type: 'always_listening', status: 'completed' } }
                      });
                    }
                  }}
                  disabled={state.isProcessing}
                  className={`w-full py-2 px-3 text-sm font-medium rounded-lg transition-colors ${
                    state.alwaysListening
                      ? 'bg-red-500 hover:bg-red-600 text-white'
                      : 'bg-purple-500 hover:bg-purple-600 text-white'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {state.alwaysListening ? '? Stop Listening' : '?? Always Listen'}
                </button>
                
                {state.alwaysListening && (
                  <p className="mt-2 text-xs text-gray-600 dark:text-gray-400 text-center">
                    {state.inConversationWindow ? '?? In conversation' : 'Say "Servio" to start'}
                  </p>
                )}
              </div>
            </div>

            {/* Right Content - Conversation */}
            <div className="lg:col-span-2 space-y-3">
              {/* Conversation Card */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 h-[50vh] lg:h-[500px] flex flex-col">
                <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Conversation</span>
                  <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-400">
                    {state.isRecording ? '?? Listening' :
                     state.isProcessing ? '?? Thinking' :
                     state.isSpeaking ? '??? Speaking' :
                     '? Ready'}
                  </span>
                </div>
                <div className="flex-1 overflow-hidden" data-testid="transcript-feed">
                  <TranscriptFeed
                    messages={state.messages}
                    className="h-full"
                  />
                </div>
              </div>

              {/* Input Card */}
              <div className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm border border-gray-200 dark:border-gray-700">
                <div data-testid="chat-input-wrapper">
                  <ChatInput
                    onSendMessage={handleQuickCommand}
                    disabled={state.isProcessing || state.isRecording}
                    placeholder="Type a command..."
                  />
                </div>
                
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <button 
                    data-testid="quick-command-check-orders"
                    onClick={() => handleQuickCommand('check current orders')} 
                    disabled={state.isProcessing || state.isRecording} 
                    className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 text-gray-700 dark:text-gray-300"
                  >
                    Check orders
                  </button>
                  <button 
                    data-testid="quick-command-whats-86d"
                    onClick={() => handleQuickCommand('what items are 86\'d')} 
                    disabled={state.isProcessing || state.isRecording} 
                    className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 text-gray-700 dark:text-gray-300"
                  >
                    What's 86'd?
                  </button>
                  <button 
                    data-testid="quick-command-inventory"
                    onClick={() => handleQuickCommand('show inventory levels')} 
                    disabled={state.isProcessing || state.isRecording} 
                    className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 text-gray-700 dark:text-gray-300"
                  >
                    Inventory
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    </>
  )
}

// Authentication will be handled client-side for static export compatibility