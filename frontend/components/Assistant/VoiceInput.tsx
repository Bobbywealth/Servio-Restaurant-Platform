import React, { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, MicOff, Lock, X, Waveform, Loader2 } from 'lucide-react'

interface VoiceInputProps {
  onSendVoice: (audioBlob: Blob) => Promise<void>
  disabled?: boolean
  className?: string
}

export default function VoiceInput({
  onSendVoice,
  disabled = false,
  className = ''
}: VoiceInputProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const [audioLevel, setAudioLevel] = useState(0)
  const [showLockMessage, setShowLockMessage] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [permissionGranted, setPermissionGranted] = useState(false)
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationRef = useRef<number | null>(null)
  const startTimeRef = useRef<number>(0)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [])

  // Get microphone permission and initialize recorder
  const initializeRecorder = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      })
      
      streamRef.current = stream
      setPermissionGranted(true)

      // Set up audio analyzer for visualization
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const source = audioContext.createMediaStreamSource(stream)
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      analyserRef.current = analyser

      // Determine the best mime type
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/mp4'

      const recorder = new MediaRecorder(stream, { mimeType })
      
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType })
        
        if (audioBlob.size > 0) {
          setIsSending(true)
          try {
            await onSendVoice(audioBlob)
          } finally {
            setIsSending(false)
          }
        }
        
        audioChunksRef.current = []
        setRecordingDuration(0)
        setAudioLevel(0)
      }

      mediaRecorderRef.current = recorder
      return true
    } catch (error) {
      console.error('Failed to get microphone permission:', error)
      return false
    }
  }, [onSendVoice])

  // Start recording
  const startRecording = useCallback(async () => {
    if (disabled || isRecording || isSending) return

    const initialized = mediaRecorderRef.current || await initializeRecorder()
    if (!initialized || !mediaRecorderRef.current) return

    audioChunksRef.current = []
    startTimeRef.current = Date.now()
    
    try {
      mediaRecorderRef.current.start(100) // Collect data every 100ms
      setIsRecording(true)

      // Start duration timer
      timerRef.current = setInterval(() => {
        setRecordingDuration(Math.floor((Date.now() - startTimeRef.current) / 1000))
      }, 100)

      // Start audio visualization
      const updateAudioLevel = () => {
        if (!analyserRef.current || !isRecording) return
        
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)
        analyserRef.current.getByteFrequencyData(dataArray)
        
        // Calculate average level
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length
        setAudioLevel(average / 255)
        
        animationRef.current = requestAnimationFrame(updateAudioLevel)
      }
      
      updateAudioLevel()
    } catch (error) {
      console.error('Failed to start recording:', error)
    }
  }, [disabled, isRecording, isSending, initializeRecorder])

  // Stop recording
  const stopRecording = useCallback(() => {
    if (!isRecording || !mediaRecorderRef.current) return

    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }

    try {
      mediaRecorderRef.current.stop()
    } catch (error) {
      console.error('Error stopping recorder:', error)
    }

    setIsRecording(false)
    setShowLockMessage(false)
  }, [isRecording])

  // Handle mouse/touch events
  const handleMouseDown = () => {
    if (!permissionGranted) {
      initializeRecorder().then((success) => {
        if (success) {
          startRecording()
        }
      })
    } else {
      startRecording()
    }
  }

  const handleMouseUp = () => {
    if (isRecording) {
      stopRecording()
    }
  }

  const handleMouseLeave = () => {
    if (isRecording) {
      stopRecording()
    }
  }

  // Format duration as MM:SS
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className={`relative ${className}`}>
      <AnimatePresence>
        {isRecording ? (
          // Recording mode - show stop button with waveform
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            className="flex items-center gap-2"
          >
            {/* Recording indicator */}
            <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-red-500 to-red-600 rounded-full shadow-lg">
              {/* Stop button */}
              <motion.button
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseLeave}
                onTouchEnd={handleMouseUp}
                className="w-10 h-10 flex items-center justify-center bg-white/20 rounded-full hover:bg-white/30 transition-colors"
                whileTap={{ scale: 0.9 }}
              >
                <div className="w-4 h-4 bg-white rounded-sm" />
              </motion.button>

              {/* Duration */}
              <span className="text-white font-mono text-sm font-medium min-w-[50px]">
                {formatDuration(recordingDuration)}
              </span>

              {/* Waveform visualization */}
              <div className="flex items-center gap-0.5 h-6">
                {[...Array(8)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="w-1 bg-white rounded-full"
                    animate={{
                      height: isRecording 
                        ? Math.max(4, Math.sin(audioLevel * Math.PI * 2 + i * 0.5) * 16 + 8)
                        : 4
                    }}
                    transition={{
                      duration: 0.1,
                      repeat: Infinity,
                      repeatType: 'reverse'
                    }}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        ) : (
          // Idle mode - show microphone button
          <motion.button
            onMouseDown={handleMouseDown}
            onTouchStart={(e) => {
              e.preventDefault() // Prevent text selection
              handleMouseDown()
            }}
            onTouchEnd={(e) => {
              e.preventDefault()
              handleMouseUp()
            }}
            disabled={disabled || isSending}
            className={`
              w-12 h-12 flex items-center justify-center rounded-full
              transition-all duration-200
              ${disabled || isSending
                ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                : 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 hover:scale-105 active:scale-95'
              }
            `}
            whileHover={!disabled && !isSending ? { scale: 1.05 } : {}}
            whileTap={!disabled && !isSending ? { scale: 0.95 } : {}}
          >
            {isSending ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              >
                <Loader2 className="w-5 h-5" />
              </motion.div>
            ) : (
              <Mic className="w-5 h-5" />
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Lock message tooltip */}
      <AnimatePresence>
        {showLockMessage && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg whitespace-nowrap flex items-center gap-2"
          >
            <Lock className="w-3 h-3" />
            Slide up to lock
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowLockMessage(false)
              }}
              className="ml-1 p-0.5 hover:bg-gray-700 rounded"
            >
              <X className="w-3 h-3" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
