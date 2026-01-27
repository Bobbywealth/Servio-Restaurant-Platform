import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, MicOff, Send, Lock, X } from 'lucide-react'

interface VoiceInputProps {
  onSendVoice: (audioBlob: Blob) => Promise<void>
  onCancelRecording?: () => void
  disabled?: boolean
  className?: string
}

export default function VoiceInput({
  onSendVoice,
  onCancelRecording,
  disabled = false,
  className = ''
}: VoiceInputProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const [audioLevel, setAudioLevel] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const animationRef = useRef<number | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const startTimeRef = useRef<number>(0)

  // Start recording
  const startRecording = async () => {
    if (disabled || isRecording) return

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      })

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
        ? 'audio/webm;codecs=opus' 
        : 'audio/mp4'

      const mediaRecorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      // Set up audio visualization
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 256
      const source = audioContext.createMediaStreamSource(stream)
      source.connect(analyser)
      analyserRef.current = analyser

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop())
        
        // Clean up visualization
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current)
          animationRef.current = null
        }

        // Send the recording
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType })
        if (audioBlob.size > 0) {
          await onSendVoice(audioBlob)
        }

        setIsRecording(false)
        setRecordingDuration(0)
        setAudioLevel(0)
      }

      mediaRecorder.start(100)
      setIsRecording(true)
      startTimeRef.current = Date.now()

      // Timer for duration display
      timerRef.current = setInterval(() => {
        setRecordingDuration(Math.floor((Date.now() - startTimeRef.current) / 1000))
      }, 1000)

      // Audio level animation
      const updateLevel = () => {
        if (!analyserRef.current) return
        const data = new Uint8Array(analyserRef.current.frequencyBinCount)
        analyserRef.current.getByteFrequencyData(data)
        const average = data.reduce((a, b) => a + b, 0) / data.length
        setAudioLevel(average / 255)
        animationRef.current = requestAnimationFrame(updateLevel)
      }
      updateLevel()

    } catch (error) {
      console.error('Failed to start recording:', error)
      setIsRecording(false)
    }
  }

  // Stop recording and send
  const stopRecording = async () => {
    if (!isRecording || !mediaRecorderRef.current) return

    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }

    mediaRecorderRef.current.stop()
  }

  // Cancel recording (for future swipe-to-cancel feature)
  const cancelRecording = () => {
    if (!isRecording || !mediaRecorderRef.current) return

    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }

    mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop())
    setIsRecording(false)
    setRecordingDuration(0)
    setAudioLevel(0)
    onCancelRecording?.()
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop()
      }
    }
  }, [])

  // Format duration as MM:SS
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <AnimatePresence mode="wait">
        {isRecording ? (
          <motion.div
            key="recording"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            className="flex items-center gap-3"
          >
            {/* Cancel button (X) */}
            <motion.button
              onClick={cancelRecording}
              whileTap={{ scale: 0.9 }}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30 text-red-500"
            >
              <X className="w-5 h-5" />
            </motion.button>

            {/* Lock indicator (for future swipe feature) */}
            <div className="flex items-center gap-1 px-3 py-2 bg-red-100 dark:bg-red-900/30 rounded-full">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-sm font-medium text-red-600 dark:text-red-400 min-w-[45px]">
                {formatDuration(recordingDuration)}
              </span>
            </div>

            {/* Send button */}
            <motion.button
              onClick={stopRecording}
              whileTap={{ scale: 0.9 }}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg"
            >
              <Send className="w-5 h-5" />
            </motion.button>
          </motion.div>
        ) : (
          <motion.button
            key="mic"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            onClick={startRecording}
            disabled={disabled}
            className={`
              w-12 h-12 flex items-center justify-center rounded-full transition-all
              ${disabled 
                ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                : 'bg-gradient-to-br from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white shadow-lg hover:shadow-xl'
              }
            `}
            whileTap={!disabled ? { scale: 0.95 } : {}}
          >
            <Mic className="w-6 h-6" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Audio level indicator (only when recording) */}
      <AnimatePresence>
        {isRecording && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 60, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="flex items-center gap-0.5 h-8 overflow-hidden"
          >
            {[...Array(5)].map((_, i) => (
              <motion.div
                key={i}
                className="w-1 bg-red-500 rounded-full"
                animate={{
                  height: audioLevel > i * 0.2 ? Math.random() * 16 + 8 : 4
                }}
                transition={{ duration: 0.1 }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
