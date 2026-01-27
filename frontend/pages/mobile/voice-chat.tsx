import React, { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, Square, Send, X } from 'lucide-react'
import Head from 'next/head'
import { api } from '../../lib/api'
import { useUser } from '../../contexts/UserContext'

interface Message {
  id: string
  type: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  audioUrl?: string
}

export default function MobileVoiceChat() {
  const { user } = useUser()
  const [messages, setMessages] = useState<Message[]>([])
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [showWaveform, setShowWaveform] = useState(false)
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null)
  const waveformAnimationRef = useRef<number | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Initialize recording on mount
  useEffect(() => {
    const initMediaRecorder = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        const mediaRecorder = new MediaRecorder(stream)
        mediaRecorderRef.current = mediaRecorder

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data)
          }
        }

        mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
          await processVoiceMessage(audioBlob)
          audioChunksRef.current = []
        }
      } catch (error) {
        console.error('Failed to initialize microphone:', error)
        addMessage('system', 'Failed to access microphone. Please check permissions.')
      }
    }

    initMediaRecorder()

    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current)
      }
      if (waveformAnimationRef.current) {
        cancelAnimationFrame(waveformAnimationRef.current)
      }
      mediaRecorderRef.current?.stream?.getTracks().forEach(track => track.stop())
    }
  }, [])

  const addMessage = useCallback((type: Message['type'], content: string, audioUrl?: string) => {
    const newMessage: Message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      content,
      timestamp: new Date(),
      audioUrl
    }
    setMessages(prev => [...prev, newMessage])
  }, [])

  const processVoiceMessage = async (audioBlob: Blob) => {
    setIsProcessing(true)
    
    try {
      const formData = new FormData()
      formData.append('audio', audioBlob, 'recording.webm')
      formData.append('userId', user?.id || 'anonymous')

      const response = await api.post('/api/assistant/process-audio', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      const payload = response.data?.data || response.data
      const { transcript, response: assistantResponse, audioUrl } = payload

      if (transcript) {
        addMessage('user', transcript)
      }

      if (assistantResponse) {
        addMessage('assistant', assistantResponse, audioUrl)
      }
    } catch (error) {
      console.error('Failed to process voice:', error)
      addMessage('system', 'Failed to process voice message. Please try again.')
    } finally {
      setIsProcessing(false)
    }
  }

  // Waveform animation
  const waveformBars = Array.from({ length: 20 }, (_, i) => {
    const randomHeight = isRecording ? Math.random() * 60 + 20 : 20
    return randomHeight
  })

  const startRecording = useCallback(() => {
    if (!mediaRecorderRef.current || isProcessing) return
    
    audioChunksRef.current = []
    setIsRecording(true)
    setShowWaveform(true)
    setRecordingTime(0)

    mediaRecorderRef.current.start(100)

    recordingTimerRef.current = setInterval(() => {
      setRecordingTime(prev => prev + 1)
    }, 1000)
  }, [isProcessing])

  const stopRecording = useCallback(() => {
    if (!mediaRecorderRef.current || !isRecording) return

    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current)
    }

    mediaRecorderRef.current.stop()
    setIsRecording(false)
    setShowWaveform(false)
    setRecordingTime(0)
  }, [isRecording])

  const handleMouseDown = () => {
    startRecording()
  }

  const handleMouseUp = () => {
    stopRecording()
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault()
    startRecording()
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault()
    stopRecording()
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <>
      <Head>
        <title>Voice Chat • Servio</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
      </Head>

      {/* Lock scrolling on mobile */}
      <style jsx global>{`
        @media (max-width: 768px) {
          html, body {
            overflow: hidden !important;
            height: 100% !important;
          }
        }
      `}</style>

      <div className="min-h-screen bg-gradient-to-b from-violet-50 to-fuchsia-50 dark:from-violet-950 dark:to-fuchsia-950">
        {/* Fixed Header with Servio Face */}
        <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-violet-950/80 backdrop-blur-xl border-b border-violet-200/50 dark:border-violet-800/50">
          <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
            {/* Servio Face Avatar */}
            <div className="flex items-center gap-3">
              <div className="relative">
                {/* Animated glow when recording/speaking */}
                {(isRecording || isProcessing) && (
                  <motion.div
                    initial={{ scale: 1, opacity: 0.75 }}
                    animate={{ scale: 1.5, opacity: 0 }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                    className="absolute inset-0 bg-red-500 rounded-full"
                  />
                )}
                
                {/* Simple face icon */}
                <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-full flex items-center justify-center shadow-lg">
                  <svg viewBox="0 0 100 100" className="w-6 h-6 text-white">
                    {/* Face */}
                    <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="3" />
                    {/* Left eye */}
                    <circle cx="35" cy="42" r="6" fill="currentColor" />
                    {/* Right eye */}
                    <circle cx="65" cy="42" r="6" fill="currentColor" />
                    {/* Smile */}
                    <path
                      d="M 30 65 Q 50 80 70 65"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="4"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
              </div>

              <div>
                <h1 className="text-lg font-bold bg-gradient-to-r from-violet-600 to-fuchsia-600 bg-clip-text text-transparent">
                  Servio
                </h1>
                <p className="text-xs text-violet-500 dark:text-violet-400">
                  {isRecording ? 'Recording...' : isProcessing ? 'Thinking...' : 'Tap to talk'}
                </p>
              </div>
            </div>

            {/* Status indicator */}
            {isProcessing && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-2 px-3 py-1.5 bg-amber-100 dark:bg-amber-900/30 rounded-full"
              >
                <motion.span
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ repeat: Infinity, duration: 0.5 }}
                  className="w-2 h-2 bg-amber-500 rounded-full"
                />
                <span className="text-xs font-medium text-amber-700 dark:text-amber-300">Processing</span>
              </motion.div>
            )}
          </div>
        </header>

        {/* Messages Area */}
        <main className="pt-20 pb-32 px-4 max-w-md mx-auto h-screen overflow-hidden">
          <div className="h-full overflow-y-auto space-y-4 pb-4">
            {/* Welcome message */}
            {messages.length === 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center py-12"
              >
                <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-2xl flex items-center justify-center shadow-xl">
                  <Mic className="w-10 h-10 text-white" />
                </div>
                <h2 className="text-xl font-bold text-violet-900 dark:text-violet-100 mb-2">
                  Voice Assistant
                </h2>
                <p className="text-violet-600 dark:text-violet-400 text-sm">
                  Hold the button below and speak your command
                </p>
              </motion.div>
            )}

            {/* Messages */}
            <AnimatePresence>
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                      message.type === 'user'
                        ? 'bg-violet-600 text-white rounded-br-md'
                        : message.type === 'system'
                        ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 text-sm'
                        : 'bg-white dark:bg-violet-900 text-violet-900 dark:text-violet-100 rounded-bl-md shadow-lg'
                    }`}
                  >
                    <p className="text-sm leading-relaxed">{message.content}</p>
                    <span className={`text-xs mt-1 block opacity-60`}>
                      {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Processing indicator */}
            {isProcessing && messages[messages.length - 1]?.type === 'user' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex justify-start"
              >
                <div className="bg-white dark:bg-violet-900 rounded-2xl rounded-bl-md px-4 py-3 shadow-lg">
                  <div className="flex items-center gap-2">
                    <motion.span
                      animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                      transition={{ repeat: Infinity, duration: 0.8 }}
                      className="w-2 h-2 bg-violet-500 rounded-full"
                    />
                    <motion.span
                      animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                      transition={{ repeat: Infinity, duration: 0.8, delay: 0.2 }}
                      className="w-2 h-2 bg-violet-500 rounded-full"
                    />
                    <motion.span
                      animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                      transition={{ repeat: Infinity, duration: 0.8, delay: 0.4 }}
                      className="w-2 h-2 bg-violet-500 rounded-full"
                    />
                  </div>
                </div>
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </main>

        {/* Fixed Bottom Recording Area */}
        <footer className="fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-violet-950/90 backdrop-blur-xl border-t border-violet-200/50 dark:border-violet-800/50">
          <div className="max-w-md mx-auto px-4 py-4">
            {/* Waveform display */}
            <AnimatePresence>
              {showWaveform && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-4"
                >
                  <div className="flex items-center justify-center gap-1 h-12 bg-violet-100 dark:bg-violet-900/50 rounded-xl px-4">
                    {waveformBars.map((height, i) => (
                      <motion.div
                        key={i}
                        animate={{
                          height: isRecording ? height : 8,
                          opacity: isRecording ? 1 : 0.5
                        }}
                        transition={{
                          duration: 0.1,
                          delay: i * 0.02
                        }}
                        className="w-1 bg-gradient-to-t from-violet-500 to-fuchsia-500 rounded-full"
                      />
                    ))}
                  </div>
                  <div className="flex items-center justify-between mt-2 px-2">
                    <span className="text-xs text-violet-500 font-medium">
                      {isRecording ? 'Release to send' : 'Recording...'}
                    </span>
                    <span className="text-sm font-mono text-violet-700 dark:text-violet-300">
                      {formatTime(recordingTime)}
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Recording Button */}
            <div className="flex items-center justify-center">
              <motion.button
                className={`
                  relative flex items-center justify-center gap-2 px-8 py-4 rounded-full font-semibold text-white shadow-xl
                  ${isRecording
                    ? 'bg-gradient-to-r from-red-500 to-rose-600 shadow-red-500/30'
                    : 'bg-gradient-to-r from-violet-500 to-fuchsia-600 shadow-violet-500/30'
                  }
                `}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onMouseDown={handleMouseDown}
                onMouseUp={handleMouseUp}
                onMouseLeave={() => isRecording && stopRecording()}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                disabled={isProcessing}
              >
                {/* Recording pulse effect */}
                {isRecording && (
                  <>
                    <motion.span
                      initial={{ scale: 1, opacity: 0.5 }}
                      animate={{ scale: 1.8, opacity: 0 }}
                      transition={{ repeat: Infinity, duration: 1 }}
                      className="absolute inset-0 rounded-full bg-red-500"
                    />
                    <motion.span
                      initial={{ scale: 1, opacity: 0.5 }}
                      animate={{ scale: 1.4, opacity: 0 }}
                      transition={{ repeat: Infinity, duration: 1, delay: 0.3 }}
                      className="absolute inset-0 rounded-full bg-red-500"
                    />
                  </>
                )}

                {isRecording ? (
                  <>
                    <Square className="w-5 h-5 fill-current" />
                    <span>Release to Send</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-5 h-5" />
                    <span>Hold to Speak</span>
                  </>
                )}
              </motion.button>
            </div>

            {/* Hint text */}
            {!showWaveform && !isRecording && (
              <p className="text-center text-xs text-violet-500 dark:text-violet-400 mt-3">
                Powered by Servio AI
              </p>
            )}
          </div>
        </footer>
      </div>
    </>
  )
}
