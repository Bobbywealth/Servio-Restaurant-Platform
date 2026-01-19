import React, { useState, useCallback, useEffect } from 'react'
import Head from 'next/head'
import DashboardLayout from '../../components/Layout/DashboardLayout'
import Avatar from '../../components/Assistant/Avatar'
import MicrophoneButton from '../../components/Assistant/MicrophoneButton'
import TranscriptFeed, { TranscriptMessage } from '../../components/Assistant/TranscriptFeed'
import QuickCommands from '../../components/Assistant/QuickCommands'
import { useUser } from '../../contexts/UserContext'
import axios from 'axios'

interface AssistantState {
  isRecording: boolean
  isProcessing: boolean
  isSpeaking: boolean
  messages: TranscriptMessage[]
  currentAudioUrl: string | null
}

export default function AssistantPage() {
  const { user, hasPermission } = useUser()
  const [state, setState] = useState<AssistantState>({
    isRecording: false,
    isProcessing: false,
    isSpeaking: false,
    messages: [],
    currentAudioUrl: null
  })

  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)
  const [audioChunks, setAudioChunks] = useState<Blob[]>([])

  // Initialize media recorder
  useEffect(() => {
    const initializeMediaRecorder = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            sampleRate: 44100
          } 
        })
        
        const recorder = new MediaRecorder(stream, {
          mimeType: 'audio/webm;codecs=opus'
        })
        
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            setAudioChunks(prev => [...prev, event.data])
          }
        }
        
        recorder.onstop = async () => {
          // Process the recorded audio
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
      }
    }

    initializeMediaRecorder()

    return () => {
      // Cleanup media stream
      if (mediaRecorder?.stream) {
        mediaRecorder.stream.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

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

  const startRecording = useCallback(() => {
    if (!mediaRecorder || state.isProcessing) return
    
    setAudioChunks([])
    mediaRecorder.start(100) // Collect data every 100ms
    
    setState(prev => ({
      ...prev,
      isRecording: true
    }))
  }, [mediaRecorder, state.isProcessing])

  const stopRecording = useCallback(() => {
    if (!mediaRecorder || !state.isRecording) return
    
    mediaRecorder.stop()
    
    setState(prev => ({
      ...prev,
      isRecording: false,
      isProcessing: true
    }))
  }, [mediaRecorder, state.isRecording])

  const processRecording = useCallback(async () => {
    if (audioChunks.length === 0) {
      setState(prev => ({ ...prev, isProcessing: false }))
      return
    }

    try {
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm;codecs=opus' })
      const formData = new FormData()
      formData.append('audio', audioBlob, 'recording.webm')
      formData.append('userId', user?.id || 'anonymous')

      // Send to backend for processing
      const response = await axios.post('/api/assistant/process-audio', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })

      const { transcript, response: assistantResponse, actions, audioUrl } = response.data

      // Add user message (transcript)
      if (transcript) {
        addMessage({
          type: 'user',
          content: transcript,
          metadata: {
            confidence: response.data.confidence || 0.9
          }
        })
      }

      // Add assistant response
      if (assistantResponse) {
        addMessage({
          type: 'assistant',
          content: assistantResponse,
          metadata: {
            duration: response.data.processingTime
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
        setState(prev => ({
          ...prev,
          isSpeaking: true,
          currentAudioUrl: audioUrl
        }))
        
        const audio = new Audio(audioUrl)
        audio.onended = () => {
          setState(prev => ({
            ...prev,
            isSpeaking: false,
            currentAudioUrl: null
          }))
        }
        audio.play().catch(console.error)
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
      setAudioChunks([])
    }
  }, [audioChunks, user?.id, addMessage])

  const handleQuickCommand = useCallback(async (command: string) => {
    // Add user message immediately
    addMessage({
      type: 'user',
      content: command
    })

    // Process the text command
    setState(prev => ({ ...prev, isProcessing: true }))

    try {
      const response = await axios.post('/api/assistant/process-text', {
        text: command,
        userId: user?.id || 'anonymous'
      })

      const { response: assistantResponse, actions, audioUrl } = response.data

      // Add assistant response
      if (assistantResponse) {
        addMessage({
          type: 'assistant',
          content: assistantResponse,
          metadata: {
            duration: response.data.processingTime
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
        setState(prev => ({
          ...prev,
          isSpeaking: true,
          currentAudioUrl: audioUrl
        }))
        
        const audio = new Audio(audioUrl)
        audio.onended = () => {
          setState(prev => ({
            ...prev,
            isSpeaking: false,
            currentAudioUrl: null
          }))
        }
        audio.play().catch(console.error)
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
  }, [user?.id, addMessage])

  return (
    <>
      <Head>
        <title>Servio Assistant - AI Staff Helper</title>
        <meta name="description" content="Talk to Servio AI Assistant for restaurant operations" />
      </Head>

      <DashboardLayout>
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900">
              Servio Assistant
            </h1>
            <p className="mt-2 text-gray-600">
              Your AI-powered restaurant operations assistant. Talk to Servio to manage orders, inventory, and tasks.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Panel - Avatar & Controls */}
            <div className="lg:col-span-1">
              <div className="card space-y-6">
                <Avatar 
                  isTalking={state.isSpeaking}
                  isListening={state.isRecording}
                  useFace={true}
                  emotion={state.isProcessing ? 'thinking' : state.isRecording ? 'focused' : 'happy'}
                />
                
                <MicrophoneButton
                  isRecording={state.isRecording}
                  isProcessing={state.isProcessing}
                  onStartRecording={startRecording}
                  onStopRecording={stopRecording}
                  disabled={!mediaRecorder}
                />
              </div>

              {/* Quick Commands */}
              <div className="mt-6 card">
                <QuickCommands 
                  onCommand={handleQuickCommand}
                  disabled={state.isProcessing || state.isRecording}
                />
              </div>
            </div>

            {/* Right Panel - Transcript & Actions */}
            <div className="lg:col-span-2">
              <div className="card h-[700px]">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Conversation
                  </h2>
                  <div className="flex items-center space-x-2 text-sm text-gray-500">
                    <div className="flex items-center space-x-1">
                      <div className={`w-2 h-2 rounded-full ${
                        state.isRecording ? 'bg-red-500' : 
                        state.isProcessing ? 'bg-yellow-500' : 
                        state.isSpeaking ? 'bg-green-500' : 
                        'bg-gray-300'
                      }`} />
                      <span>
                        {state.isRecording && 'Recording'}
                        {state.isProcessing && 'Processing'}
                        {state.isSpeaking && 'Speaking'}
                        {!state.isRecording && !state.isProcessing && !state.isSpeaking && 'Ready'}
                      </span>
                    </div>
                  </div>
                </div>
                
                <TranscriptFeed 
                  messages={state.messages}
                  className="h-full"
                />
              </div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    </>
  )
}

// Authentication will be handled client-side for static export compatibility