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
        const hasWakeWord = lowerTranscript.includes('servio') || 
                            lowerTranscript.includes('sergio') ||
                            lowerTranscript.includes('serveio');
        
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
      if (audioUrl) {
        await playAudio(audioUrl)
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
      // Cleanup media stream
      if (stream) {
        stream.getTracks().forEach(track => track.stop())
      }
    }
  }, [processRecording, mediaRecorder, getSupportedMimeType, addMessage]) // Added mediaRecorder back so it can check if it's already set

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

  return (
    <>
      <Head>
        <title>Servio Assistant - AI Staff Helper</title>
        <meta name="description" content="Talk to Servio AI Assistant for restaurant operations" />
      </Head>

      <DashboardLayout>
        <div className="max-w-7xl mx-auto">
          {/* Enhanced Header with Status Bar */}
          <div className="mb-4 sm:mb-6">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <span className="text-3xl">🤖</span>
                  Servio AI Assistant
                  {state.isProcessing && <span className="ml-2 px-2 py-1 text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 rounded-full animate-pulse">Processing...</span>}
                  {state.isSpeaking && <span className="ml-2 px-2 py-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-full animate-pulse">🔊 Speaking</span>}
                  {state.isRecording && <span className="ml-2 px-2 py-1 text-xs bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded-full animate-pulse">🎤 Recording</span>}
                </h1>
                <p className="mt-2 text-sm sm:text-base text-gray-600 dark:text-gray-400">
                  Your intelligent AI-powered restaurant operations assistant. Talk naturally to manage orders, inventory, and tasks.
                </p>
              </div>
            </div>
            
            {/* Real-time Stats Dashboard */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 p-3 rounded-lg border border-blue-200 dark:border-blue-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">Messages</p>
                    <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{state.messages.length}</p>
                  </div>
                  <span className="text-2xl">💬</span>
                </div>
              </div>
              
              <div className={`p-3 rounded-lg border ${
                state.alwaysListening
                  ? state.inConversationWindow
                    ? 'bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-300 dark:border-green-700'
                    : 'bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-800/20 border-purple-300 dark:border-purple-700'
                  : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
              }`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">
                      {state.alwaysListening 
                        ? state.inConversationWindow ? 'In Conversation' : 'Always Listening'
                        : 'Voice Mode'}
                    </p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {state.alwaysListening 
                        ? state.inConversationWindow ? 'Talking Freely' : 'Say "Servio"'
                        : 'Inactive'}
                    </p>
                  </div>
                  <span className="text-2xl">
                    {state.alwaysListening 
                      ? state.inConversationWindow ? '💬' : '🎯'
                      : '🔇'}
                  </span>
                </div>
              </div>
              
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 p-3 rounded-lg border border-purple-200 dark:border-purple-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-purple-600 dark:text-purple-400 font-medium">Status</p>
                    <p className="text-sm font-semibold text-purple-900 dark:text-purple-100">
                      {state.isProcessing ? 'Thinking' : state.isSpeaking ? 'Speaking' : state.isRecording ? 'Listening' : 'Ready'}
                    </p>
                  </div>
                  <span className="text-2xl">
                    {state.isProcessing ? '🧠' : state.isSpeaking ? '🗣️' : state.isRecording ? '🎤' : '✅'}
                  </span>
                </div>
              </div>
              
              <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 p-3 rounded-lg border border-orange-200 dark:border-orange-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-orange-600 dark:text-orange-400 font-medium">Audio Level</p>
                    <div className="flex items-center gap-1 mt-1">
                      {[...Array(5)].map((_, i) => (
                        <div 
                          key={i} 
                          className={`h-2 w-2 rounded-full ${
                            (talkIntensity * 100) > (i * 20) 
                              ? 'bg-orange-500 dark:bg-orange-400' 
                              : 'bg-gray-300 dark:bg-gray-600'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  <span className="text-2xl">🎵</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Commands - Moved to top and made horizontal */}
          <div className="mb-6 card-mobile">
            <QuickCommands
              onCommand={handleQuickCommand}
              disabled={state.isProcessing || state.isRecording}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            {/* Left Panel - Avatar & Controls */}
            <div className="lg:col-span-1">
              <div className="card-mobile space-y-4 sm:space-y-6 bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900">
                {/* AI Status Banner */}
                <div className={`p-3 rounded-lg border-2 transition-all ${
                  state.isProcessing 
                    ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700' 
                    : state.isSpeaking 
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700'
                    : state.isRecording
                    ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700'
                    : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700'
                }`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
                        {state.isProcessing ? '🧠 Analyzing...' : 
                         state.isSpeaking ? '🗣️ Speaking to you' : 
                         state.isRecording ? '🎤 Listening...' : 
                         '✨ Ready to help'}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                        {state.isProcessing ? 'Processing your request with AI' : 
                         state.isSpeaking ? 'Playing voice response' : 
                         state.isRecording ? 'Say your command now' : 
                         'Ask me anything about your restaurant'}
                      </p>
                    </div>
                    {(state.isProcessing || state.isSpeaking || state.isRecording) && (
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                      </div>
                    )}
                  </div>
                </div>
                
                <RealisticAvatar
                  isTalking={state.isSpeaking}
                  isListening={state.isRecording}
                  isThinking={state.isProcessing}
                  size="large"
                  gender="female"
                  name="Servio Assistant"
                  audioLevel={talkIntensity * 100}
                />
                
                {/* Audio Visualization */}
                {state.isSpeaking && (
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <p className="text-xs font-medium text-green-800 dark:text-green-300 mb-2">🎵 Audio Playing</p>
                    <div className="flex items-center justify-center gap-1 h-12">
                      {[...Array(20)].map((_, i) => (
                        <div
                          key={i}
                          className="w-1 bg-green-500 dark:bg-green-400 rounded-full transition-all"
                          style={{
                            height: `${Math.max(10, Math.sin((i + Date.now() / 100) * 0.5) * 30 + 30)}px`,
                            animation: 'pulse 0.5s ease-in-out infinite',
                            animationDelay: `${i * 0.05}s`
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}

                <MicrophoneButton
                  isRecording={state.isRecording}
                  isProcessing={state.isProcessing}
                  onStartRecording={startRecording}
                  onStopRecording={stopRecording}
                  disabled={!mediaRecorder}
                  toggleMode={state.micToggleMode}
                />
                
                {/* Microphone Mode Toggle */}
                <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        Microphone Mode
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                        {state.micToggleMode ? 'Click to toggle on/off' : 'Hold button to talk'}
                      </p>
                    </div>
                    <button
                      onClick={() => setState(prev => ({ ...prev, micToggleMode: !prev.micToggleMode }))}
                      disabled={state.isRecording || state.isProcessing}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        state.micToggleMode 
                          ? 'bg-blue-600' 
                          : 'bg-gray-300 dark:bg-gray-600'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          state.micToggleMode ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-xs">
                    <span className={state.micToggleMode ? 'text-gray-400 dark:text-gray-600' : 'text-blue-600 dark:text-blue-400 font-semibold'}>
                      Hold to Talk
                    </span>
                    <span className="text-gray-400">|</span>
                    <span className={state.micToggleMode ? 'text-blue-600 dark:text-blue-400 font-semibold' : 'text-gray-400 dark:text-gray-600'}>
                      Click to Toggle
                    </span>
                  </div>
                </div>

                {/* Always Listening Mode - Premium Feature */}
                <div className="mt-4 p-4 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg border-2 border-purple-300 dark:border-purple-700">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h3 className="text-sm font-bold text-purple-900 dark:text-purple-100 flex items-center gap-2">
                        <span className="text-lg">🎯</span>
                        Always Listening Mode
                        {state.alwaysListening && <span className="px-2 py-0.5 bg-purple-600 text-white text-xs rounded-full animate-pulse">ACTIVE</span>}
                      </h3>
                      <p className="text-xs text-purple-700 dark:text-purple-300 mt-1">
                        {state.alwaysListening 
                          ? '🎤 Continuously listening and processing your commands' 
                          : 'Enable for hands-free continuous operation'
                        }
                      </p>
                    </div>
                    <div className={`w-3 h-3 rounded-full ${
                      state.alwaysListening ? 'bg-purple-500 animate-pulse' : 'bg-gray-300'
                    }`} />
                  </div>

                  <button
                    onClick={() => {
                      const newAlwaysListening = !state.alwaysListening;
                      setState(prev => ({ ...prev, alwaysListening: newAlwaysListening }));
                      
                      if (newAlwaysListening) {
                        // Start recording immediately using ref
                        addMessageRef.current?.({
                          type: 'system',
                          content: '🎯 Always Listening activated! I\'ll continuously process everything you say.',
                          metadata: { action: { type: 'always_listening', status: 'completed' } }
                        });
                        
                        // Start recording after a brief moment using ref
                        setTimeout(() => {
                          if (startRecordingRef.current && !stateRef.current.isRecording && !stateRef.current.isProcessing) {
                            startRecordingRef.current();
                          }
                        }, 500);
                      } else {
                        // Stop recording if active using ref
                        if (stateRef.current.isRecording && stopRecordingRef.current) {
                          stopRecordingRef.current();
                        }
                        
                        // Clear conversation window
                        if (conversationWindowRef.current) {
                          clearTimeout(conversationWindowRef.current);
                          conversationWindowRef.current = null;
                        }
                        inConversationWindowRef.current = false;
                        setState(prev => ({ ...prev, inConversationWindow: false }));
                        
                        addMessageRef.current?.({
                          type: 'system',
                          content: '🎯 Always Listening deactivated.',
                          metadata: { action: { type: 'always_listening', status: 'completed' } }
                        });
                      }
                    }}
                    disabled={state.isProcessing}
                    className={`w-full px-4 py-2.5 text-sm font-bold rounded-lg transition-all transform hover:scale-105 ${
                      state.alwaysListening
                        ? 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-lg'
                        : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg'
                    } disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none`}
                  >
                    {state.alwaysListening ? '⏸️ Stop Always Listening' : '🎯 Start Always Listening'}
                  </button>

                  {state.alwaysListening && (
                    <div className="mt-3 p-2 bg-purple-100 dark:bg-purple-900/30 rounded text-xs text-purple-800 dark:text-purple-200">
                      <p className="font-medium flex items-center gap-2">
                        ⚡ Hands-free mode active:
                        {state.inConversationWindow && (
                          <span className="px-2 py-0.5 bg-green-500 text-white rounded-full text-xs font-bold animate-pulse">
                            IN CONVERSATION
                          </span>
                        )}
                      </p>
                      <ul className="mt-1 space-y-0.5 ml-3">
                        {state.inConversationWindow ? (
                          <>
                            <li>• <strong className="text-green-700 dark:text-green-300">Conversation active!</strong> Talk freely for 30s</li>
                            <li>• No need to say "Servio" again</li>
                            <li>• Speaks every ~5 seconds</li>
                          </>
                        ) : (
                          <>
                            <li>• Say <strong>"Servio"</strong> to start</li>
                            <li>• System listens for ~5 seconds</li>
                            <li>• Then auto-processes your command</li>
                            <li>• Ignores talk without "Servio"</li>
                          </>
                        )}
                      </ul>
                    </div>
                  )}
                </div>

              </div>
            </div>

            {/* Right Panel - Transcript & Actions */}
            <div className="lg:col-span-2 space-y-4">
              {/* Conversation History */}
              <div className="card-mobile h-[50vh] sm:h-[55vh] lg:h-[500px]">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">
                    Conversation
                  </h2>
                  <div className="flex items-center space-x-2 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                    <div className="flex items-center space-x-1">
                      <div className={`w-2 h-2 rounded-full ${
                        state.isRecording ? 'bg-red-500' :
                        state.isProcessing ? 'bg-yellow-500' :
                        state.isSpeaking ? 'bg-green-500' :
                        'bg-gray-300 dark:bg-gray-600'
                      }`} />
                      <span className="hidden sm:inline">
                        {state.isRecording && 'Recording'}
                        {state.isProcessing && 'Processing'}
                        {state.isSpeaking && 'Speaking'}
                        {!state.isRecording && !state.isProcessing && !state.isSpeaking && 'Ready'}
                      </span>
                      <span className="sm:hidden">
                        {state.isRecording && 'Rec'}
                        {state.isProcessing && 'Proc'}
                        {state.isSpeaking && 'Talk'}
                        {!state.isRecording && !state.isProcessing && !state.isSpeaking && 'Ready'}
                      </span>
                    </div>
                  </div>
                </div>

                <TranscriptFeed
                  messages={state.messages}
                  className="h-full mobile-scrolling"
                />
              </div>

              {/* Chat Input */}
              <div className="card-mobile">
                <div className="mb-3">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                    💬 Type Command
                  </h3>
                  <ChatInput
                    onSendMessage={handleQuickCommand}
                    disabled={state.isProcessing || state.isRecording}
                    placeholder="Type your command... (e.g., 'no more jerk chicken', 'check orders')"
                  />
                </div>

                {/* Smart Quick Suggestions with Categories */}
                <div className="mt-4 space-y-3">
                  <div>
                    <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">🍽️ Menu & 86 Operations</p>
                    <QuickSuggestions
                      suggestions={[
                        'no more jerk chicken',
                        'what items are 86\'d',
                        'restore chicken availability'
                      ]}
                      onSuggestionClick={handleQuickCommand}
                      disabled={state.isProcessing || state.isRecording}
                    />
                  </div>
                  
                  <div>
                    <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">📦 Orders</p>
                    <QuickSuggestions
                      suggestions={[
                        'check current orders',
                        'any urgent orders?',
                        'mark order ready'
                      ]}
                      onSuggestionClick={handleQuickCommand}
                      disabled={state.isProcessing || state.isRecording}
                    />
                  </div>
                  
                  <div>
                    <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">📊 Inventory</p>
                    <QuickSuggestions
                      suggestions={[
                        'show inventory levels',
                        'what\'s low in stock?',
                        'add 5 cases of chicken'
                      ]}
                      onSuggestionClick={handleQuickCommand}
                      disabled={state.isProcessing || state.isRecording}
                    />
                  </div>
                </div>
                
                <div className="mt-4 p-3 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
                  <p className="text-xs font-medium text-blue-900 dark:text-blue-100 mb-1">💡 Pro Tips:</p>
                  <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
                    <li>• Use natural language: "We're out of chicken" works!</li>
                    <li>• Ask questions: "What's taking longest?" or "What should I prioritize?"</li>
                    <li>• Be specific: "86 all chicken items on DoorDash only"</li>
                    {state.wakeWordSupported && <li>• Voice commands: Say "Hey Servio" then your command</li>}
                  </ul>
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