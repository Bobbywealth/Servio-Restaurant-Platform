import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Mic, MicOff, Loader2 } from 'lucide-react'

interface MicrophoneButtonProps {
  isRecording: boolean
  isProcessing: boolean
  onStartRecording: () => void
  onStopRecording: () => void
  disabled?: boolean
  className?: string
  toggleMode?: boolean // If true, click to toggle on/off. If false, hold to talk
}

export default function MicrophoneButton({
  isRecording,
  isProcessing,
  onStartRecording,
  onStopRecording,
  disabled = false,
  className = '',
  toggleMode = true // Default to toggle mode for easier testing
}: MicrophoneButtonProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [pressStartTime, setPressStartTime] = useState<number | null>(null)

  const handleTouchStart = () => {
    if (disabled || isProcessing) return
    setPressStartTime(Date.now())
    onStartRecording()
  }

  const handleTouchEnd = () => {
    if (!isRecording) return
    setPressStartTime(null)
    onStopRecording()
  }

  const handleMouseDown = () => {
    if (disabled || isProcessing) return
    setPressStartTime(Date.now())
    onStartRecording()
  }

  const handleMouseUp = () => {
    if (!isRecording) return
    setPressStartTime(null)
    onStopRecording()
  }

  const handleClick = () => {
    if (disabled || isProcessing) return

    if (isRecording) {
      onStopRecording()
    } else {
      onStartRecording()
    }
  }

  // Handle keyboard accessibility
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault()
      if (!isRecording) {
        handleMouseDown()
      }
    }
  }

  const handleKeyUp = (e: React.KeyboardEvent) => {
    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault()
      if (isRecording) {
        handleMouseUp()
      }
    }
  }

  const getButtonState = () => {
    if (disabled) {
      return {
        bgColor: 'bg-gray-300',
        hoverColor: 'hover:bg-gray-300',
        textColor: 'text-gray-500',
        iconColor: 'text-gray-400',
        shadowColor: 'shadow-gray-200',
        label: 'Microphone unavailable'
      }
    } else if (isProcessing) {
      return {
        bgColor: 'bg-yellow-500',
        hoverColor: 'hover:bg-yellow-600',
        textColor: 'text-white',
        iconColor: 'text-white',
        shadowColor: 'shadow-yellow-300',
        label: 'Processing...'
      }
    } else if (isRecording) {
      return {
        bgColor: 'bg-red-500',
        hoverColor: 'hover:bg-red-600',
        textColor: 'text-white',
        iconColor: 'text-white',
        shadowColor: 'shadow-red-300',
        label: toggleMode ? 'Recording... (Click to stop)' : 'Recording... (Release to stop)'
      }
    } else {
      return {
        bgColor: 'bg-blue-600',
        hoverColor: 'hover:bg-blue-700',
        textColor: 'text-white',
        iconColor: 'text-white',
        shadowColor: 'shadow-blue-300',
        label: toggleMode ? 'Click to start recording' : 'Hold to talk or click to toggle'
      }
    }
  }

  const state = getButtonState()

  return (
    <div className={`flex flex-col items-center ${className}`}>
      {/* Main Button */}
      <motion.button
        className={`
          relative w-20 h-20 sm:w-16 sm:h-16 rounded-full ${state.bgColor} ${state.hoverColor} ${state.textColor}
          flex items-center justify-center transition-all duration-200 focus:outline-none
          focus:ring-4 focus:ring-blue-300 shadow-lg ${state.shadowColor}
          ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}
          touch-manipulation mobile-tap-highlight
        `}
        onClick={handleClick}
        onMouseDown={toggleMode ? undefined : handleMouseDown}
        onMouseUp={toggleMode ? undefined : handleMouseUp}
        onMouseLeave={toggleMode ? () => setIsHovered(false) : () => {
          handleMouseUp(); // Stop recording if mouse leaves button
          setIsHovered(false);
        }}
        onMouseEnter={() => setIsHovered(true)}
        onTouchStart={toggleMode ? undefined : handleTouchStart}
        onTouchEnd={toggleMode ? undefined : handleTouchEnd}
        onTouchCancel={toggleMode ? undefined : handleTouchEnd}
        onKeyDown={toggleMode ? undefined : handleKeyDown}
        onKeyUp={toggleMode ? undefined : handleKeyUp}
        disabled={disabled}
        whileHover={{ scale: disabled ? 1 : 1.05 }}
        whileTap={{ scale: disabled ? 1 : 0.95 }}
        animate={{
          scale: isRecording ? [1, 1.1, 1] : 1,
        }}
        transition={{
          duration: 1,
          repeat: isRecording ? Infinity : 0,
        }}
      >
        {/* Pulse effect for recording */}
        {isRecording && (
          <>
            <motion.div
              className="absolute inset-0 rounded-full bg-red-400"
              animate={{
                scale: [1, 1.5],
                opacity: [0.3, 0],
              }}
              transition={{
                duration: 1,
                repeat: Infinity,
              }}
            />
            <motion.div
              className="absolute inset-0 rounded-full bg-red-400"
              animate={{
                scale: [1, 1.3],
                opacity: [0.5, 0],
              }}
              transition={{
                duration: 1,
                repeat: Infinity,
                delay: 0.5,
              }}
            />
          </>
        )}

        {/* Icon */}
        <div className="relative z-10">
          {isProcessing ? (
            <Loader2 className="w-7 h-7 sm:w-6 sm:h-6 animate-spin" />
          ) : disabled ? (
            <MicOff className="w-7 h-7 sm:w-6 sm:h-6" />
          ) : (
            <motion.div
              animate={{
                scale: isRecording ? [1, 1.2, 1] : 1,
              }}
              transition={{
                duration: 0.5,
                repeat: isRecording ? Infinity : 0,
              }}
            >
              <Mic className="w-7 h-7 sm:w-6 sm:h-6" />
            </motion.div>
          )}
        </div>
      </motion.button>

      {/* Status Text */}
      <motion.p
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-3 text-sm sm:text-sm md:text-base text-center text-gray-600 dark:text-gray-400 max-w-xs px-2"
      >
        {state.label}
      </motion.p>

      {/* Recording timer */}
      {isRecording && pressStartTime && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-2"
        >
          <RecordingTimer startTime={pressStartTime} />
        </motion.div>
      )}

      {/* Keyboard shortcuts hint */}
      {!isRecording && !isProcessing && !disabled && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: isHovered ? 1 : 0 }}
          className="mt-2 text-xs text-gray-500 text-center"
        >
          <p>{toggleMode ? 'Click to toggle recording' : 'Press Space or Enter to record'}</p>
        </motion.div>
      )}
    </div>
  )
}

// Recording Timer Component
function RecordingTimer({ startTime }: { startTime: number }) {
  const [duration, setDuration] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setDuration(Math.floor((Date.now() - startTime) / 1000))
    }, 1000)

    return () => clearInterval(interval)
  }, [startTime])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="flex items-center space-x-2">
      <motion.div
        className="w-2 h-2 bg-red-500 rounded-full"
        animate={{ opacity: [1, 0, 1] }}
        transition={{ duration: 1, repeat: Infinity }}
      />
      <span className="text-sm font-mono text-red-600">
        {formatTime(duration)}
      </span>
    </div>
  )
}