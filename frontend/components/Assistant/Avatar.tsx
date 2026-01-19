import React from 'react'
import { motion } from 'framer-motion'
import { Bot } from 'lucide-react'

interface AvatarProps {
  isTalking?: boolean
  isListening?: boolean
  size?: 'small' | 'medium' | 'large'
  className?: string
}

export default function Avatar({ 
  isTalking = false, 
  isListening = false, 
  size = 'large',
  className = ''
}: AvatarProps) {
  const sizeClasses = {
    small: 'w-16 h-16',
    medium: 'w-24 h-24', 
    large: 'w-32 h-32'
  }

  const iconSizes = {
    small: 'w-6 h-6',
    medium: 'w-8 h-8',
    large: 'w-12 h-12'
  }

  const getAvatarState = () => {
    if (isListening) {
      return {
        bgColor: 'bg-blue-500',
        pulseColor: 'bg-blue-300',
        iconColor: 'text-white',
        label: 'Listening...'
      }
    } else if (isTalking) {
      return {
        bgColor: 'bg-green-500',
        pulseColor: 'bg-green-300',
        iconColor: 'text-white',
        label: 'Speaking...'
      }
    } else {
      return {
        bgColor: 'bg-gray-100',
        pulseColor: 'bg-gray-200',
        iconColor: 'text-gray-600',
        label: 'Ready'
      }
    }
  }

  const state = getAvatarState()

  return (
    <div className={`flex flex-col items-center ${className}`}>
      {/* Avatar Container */}
      <div className="relative">
        {/* Outer pulse ring - only show when active */}
        {(isTalking || isListening) && (
          <motion.div
            className={`absolute inset-0 ${sizeClasses[size]} rounded-full ${state.pulseColor}`}
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.7, 0, 0.7]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
        )}

        {/* Middle pulse ring - only show when talking */}
        {isTalking && (
          <motion.div
            className={`absolute inset-0 ${sizeClasses[size]} rounded-full ${state.pulseColor}`}
            animate={{
              scale: [1, 1.1, 1],
              opacity: [0.5, 0, 0.5]
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 0.2
            }}
          />
        )}

        {/* Avatar Circle */}
        <motion.div
          className={`${sizeClasses[size]} rounded-full ${state.bgColor} flex items-center justify-center shadow-lg relative z-10`}
          animate={{
            scale: isListening || isTalking ? [1, 1.05, 1] : 1
          }}
          transition={{
            duration: 1,
            repeat: isListening || isTalking ? Infinity : 0,
            ease: "easeInOut"
          }}
        >
          <motion.div
            animate={{
              rotate: isTalking ? 360 : 0
            }}
            transition={{
              duration: 3,
              repeat: isTalking ? Infinity : 0,
              ease: "linear"
            }}
          >
            <Bot className={`${iconSizes[size]} ${state.iconColor}`} />
          </motion.div>
        </motion.div>

        {/* Sound waves for talking */}
        {isTalking && (
          <div className="absolute inset-0 flex items-center justify-center">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-1 bg-green-400 rounded-full mx-1"
                animate={{
                  height: [8, 24, 8],
                  opacity: [0.3, 1, 0.3]
                }}
                transition={{
                  duration: 0.6,
                  repeat: Infinity,
                  delay: i * 0.1
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Status Label */}
      <motion.div
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-4 text-center"
      >
        <p className={`text-sm font-medium ${
          isListening ? 'text-blue-600' : 
          isTalking ? 'text-green-600' : 
          'text-gray-600'
        }`}>
          {state.label}
        </p>
        
        {/* Activity indicator */}
        <div className="flex items-center justify-center mt-2">
          <motion.div
            className={`w-2 h-2 rounded-full ${
              isListening ? 'bg-blue-500' : 
              isTalking ? 'bg-green-500' : 
              'bg-gray-400'
            }`}
            animate={{
              scale: isListening || isTalking ? [1, 1.5, 1] : 1,
              opacity: isListening || isTalking ? [1, 0.3, 1] : 0.5
            }}
            transition={{
              duration: 1,
              repeat: isListening || isTalking ? Infinity : 0
            }}
          />
        </div>
      </motion.div>

      {/* Microphone permission hint */}
      {!isListening && !isTalking && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-xs text-gray-500 text-center mt-2 max-w-xs"
        >
          Click the microphone button or say "Hey Servio" to start
        </motion.p>
      )}
    </div>
  )
}