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
    wakeWordSupported: isWakeWordSupported()
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
  
  // Create refs for callbacks to avoid re-initializing services when they change
  const handleQuickCommandRef = useRef<((command: string) => Promise<void>) | null>(null)
  const startRecordingRef = useRef<(() => void) | null>(null)
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
      addMessage({
        type: 'system',
        content: 'Failed to process your request. Please try again.',
        metadata: {
          action: {
            type: 'error',
            status: 'error'
          }
        }
      })
    } finally {
      setState(prev => ({
        ...prev,
        isProcessing: false
      }))
      audioChunksRef.current = []
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
    mediaRecorder.start(100) // Collect data every 100ms

    setState(prev => ({
      ...prev,
      isRecording: true
    }))
  }, [mediaRecorder, state.isProcessing])

  // Update startRecordingRef
  useEffect(() => {
    startRecordingRef.current = startRecording
  }, [startRecording])

  const stopRecording = useCallback(() => {
    if (!mediaRecorder || !state.isRecording) return
    if (mediaRecorder.state !== 'recording') return

    mediaRecorder.stop()

    setState(prev => ({
      ...prev,
      isRecording: false,
      isProcessing: true
    }))
  }, [mediaRecorder, state.isRecording])

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
      addMessage({
        type: 'system',
        content: 'Failed to process your command. Please try again.',
        metadata: {
          action: {
            type: 'error',
            status: 'error'
          }
        }
      })
    } finally {
      setState(prev => ({ ...prev, isProcessing: false }))
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
        onWakeWordDetected: (detectedPhrase: string) => {
          console.log(`Wake word detected callback: "${detectedPhrase}"`);
          
          // Use refs to get latest callbacks
          if (addMessageRef.current) {
            addMessageRef.current({
              type: 'system',
              content: `👂 Wake word detected: "${detectedPhrase}"`,
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

  // Auto-initialize wake word service on component mount
  useEffect(() => {
    if (isWakeWordSupported()) {
      initializeWakeWordService();
    }
  }, [initializeWakeWordService]);

  return (
    <>
      <Head>
        <title>Servio Assistant - AI Staff Helper</title>
        <meta name="description" content="Talk to Servio AI Assistant for restaurant operations" />
      </Head>

      <DashboardLayout>
        <div className="max-w-7xl mx-auto">
          <div className="mb-4 sm:mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
              Servio Assistant
            </h1>
            <p className="mt-2 text-sm sm:text-base text-gray-600 dark:text-gray-400">
              Your AI-powered restaurant operations assistant. Talk to Servio to manage orders, inventory, and tasks.
            </p>
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
              <div className="card-mobile space-y-4 sm:space-y-6">
                <RealisticAvatar
                  isTalking={state.isSpeaking}
                  isListening={state.isRecording}
                  isThinking={state.isProcessing}
                  size="large"
                  gender="female"
                  name="Servio Assistant"
                  audioLevel={talkIntensity * 100}
                />

                <MicrophoneButton
                  isRecording={state.isRecording}
                  isProcessing={state.isProcessing}
                  onStartRecording={startRecording}
                  onStopRecording={stopRecording}
                  disabled={!mediaRecorder}
                />

                {/* Wake Word Controls */}
                {state.wakeWordSupported && (
                  <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-medium text-blue-900 dark:text-blue-100">
                        Hey Servio Wake Word
                      </h3>
                      <div className={`w-2 h-2 rounded-full ${
                        state.isListeningForWakeWord ? 'bg-green-500 animate-pulse' : 'bg-gray-300'
                      }`} />
                    </div>
                    
                    <p className="text-xs text-blue-700 dark:text-blue-300 mb-3">
                      {state.isListeningForWakeWord 
                        ? 'Listening for &ldquo;Hey Servio&rdquo;...' 
                        : 'Click to enable wake word detection'
                      }
                    </p>

                    <button
                      onClick={toggleWakeWordListening}
                      disabled={state.isRecording || state.isProcessing}
                      className={`w-full px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                        state.isListeningForWakeWord
                          ? 'bg-red-500 hover:bg-red-600 text-white'
                          : 'bg-blue-500 hover:bg-blue-600 text-white'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {state.isListeningForWakeWord ? 'Stop Wake Word' : 'Start Wake Word'}
                    </button>

                    {state.isListeningForWakeWord && (
                      <div className="mt-2 text-xs text-blue-600 dark:text-blue-400">
                        💡 Try saying: &ldquo;Hey Servio, no more jerk chicken&rdquo;
                      </div>
                    )}
                  </div>
                )}
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

                {/* Quick Suggestions */}
                <QuickSuggestions
                  suggestions={[
                    'no more jerk chicken',
                    'check current orders', 
                    'what items are 86\'d',
                    'show inventory levels',
                    'mark order ready'
                  ]}
                  onSuggestionClick={handleQuickCommand}
                  disabled={state.isProcessing || state.isRecording}
                  className="mt-3"
                />
                
                <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                  💡 Tip: You can use voice (microphone button) or type commands here. 
                  {state.wakeWordSupported && ' Enable wake word to say "Hey Servio" followed by your command.'}
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