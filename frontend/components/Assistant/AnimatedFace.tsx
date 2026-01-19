import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface AnimatedFaceProps {
  isListening?: boolean
  isTalking?: boolean
  emotion?: 'happy' | 'focused' | 'thinking' | 'neutral'
  size?: 'small' | 'medium' | 'large'
  talkIntensity?: number // 0..1, optional audio-driven mouth movement
}

export default function AnimatedFace({ 
  isListening = false, 
  isTalking = false, 
  emotion = 'neutral',
  size = 'large',
  talkIntensity
}: AnimatedFaceProps) {
  const [isBlinking, setIsBlinking] = useState(false)
  const [eyePosition, setEyePosition] = useState({ x: 0, y: 0 })

  // Face size mapping
  const faceSize = {
    small: { width: 80, height: 80, scale: 0.6 },
    medium: { width: 120, height: 120, scale: 0.8 },
    large: { width: 160, height: 160, scale: 1 }
  }

  const currentSize = faceSize[size]

  // Random blinking
  useEffect(() => {
    const blinkInterval = setInterval(() => {
      setIsBlinking(true)
      setTimeout(() => setIsBlinking(false), 200)
    }, 2000 + Math.random() * 3000) // Random blink every 2-5 seconds

    return () => clearInterval(blinkInterval)
  }, [])

  // Eye movement for listening
  useEffect(() => {
    if (isListening) {
      const moveInterval = setInterval(() => {
        setEyePosition({
          x: (Math.random() - 0.5) * 6,
          y: (Math.random() - 0.5) * 4
        })
      }, 1500)
      return () => clearInterval(moveInterval)
    } else {
      setEyePosition({ x: 0, y: 0 })
    }
  }, [isListening])

  // Get facial expression config
  const getExpression = () => {
    if (isTalking) {
      return {
        eyebrowY: -2,
        eyeScale: 1.1,
        mouthHeight: 8,
        mouthWidth: 24,
        mouthY: 45,
        color: '#10B981' // green
      }
    } else if (isListening) {
      return {
        eyebrowY: -1,
        eyeScale: 1.2,
        mouthHeight: 4,
        mouthWidth: 16,
        mouthY: 48,
        color: '#3B82F6' // blue
      }
    } else {
      switch (emotion) {
        case 'happy':
          return {
            eyebrowY: -1,
            eyeScale: 1.1,
            mouthHeight: 6,
            mouthWidth: 20,
            mouthY: 46,
            color: '#F59E0B' // amber
          }
        case 'focused':
          return {
            eyebrowY: -3,
            eyeScale: 0.9,
            mouthHeight: 3,
            mouthWidth: 12,
            mouthY: 50,
            color: '#8B5CF6' // purple
          }
        case 'thinking':
          return {
            eyebrowY: -2,
            eyeScale: 1.0,
            mouthHeight: 3,
            mouthWidth: 14,
            mouthY: 49,
            color: '#EF4444' // red
          }
        default:
          return {
            eyebrowY: 0,
            eyeScale: 1.0,
            mouthHeight: 4,
            mouthWidth: 16,
            mouthY: 48,
            color: '#6B7280' // gray
          }
      }
    }
  }

  const expression = getExpression()
  const hasAudioDrive = typeof talkIntensity === 'number'
  const clampedIntensity = Math.max(0, Math.min(1, talkIntensity ?? 0))
  const baseMouthRy = expression.mouthHeight / 2
  const baseMouthRx = expression.mouthWidth / 2

  return (
    <div 
      className="relative flex items-center justify-center"
      style={{ width: currentSize.width, height: currentSize.height }}
    >
      <svg
        width={currentSize.width}
        height={currentSize.height}
        viewBox="0 0 160 160"
        className="overflow-visible"
      >
        {/* Face outline with gradient */}
        <defs>
          <radialGradient id="faceGradient" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#FEF3C7" />
            <stop offset="100%" stopColor="#F59E0B" />
          </radialGradient>
          <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="2" dy="4" stdDeviation="3" floodOpacity="0.3"/>
          </filter>
        </defs>

        {/* Face circle */}
        <motion.circle
          cx={80}
          cy={80}
          r={70}
          fill="url(#faceGradient)"
          filter="url(#shadow)"
          animate={{
            scale: isTalking || isListening ? [1, 1.02, 1] : 1
          }}
          transition={{
            duration: 0.8,
            repeat: isTalking || isListening ? Infinity : 0,
            ease: "easeInOut"
          }}
        />

        {/* Left eyebrow */}
        <motion.path
          d="M 45 40 Q 55 35 65 40"
          stroke="#8B4513"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
          animate={{
            y: expression.eyebrowY,
            rotate: isListening ? [-1, 1, -1] : 0
          }}
          transition={{
            duration: isListening ? 2 : 0.3,
            repeat: isListening ? Infinity : 0
          }}
        />

        {/* Right eyebrow */}
        <motion.path
          d="M 95 40 Q 105 35 115 40"
          stroke="#8B4513"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
          animate={{
            y: expression.eyebrowY,
            rotate: isListening ? [1, -1, 1] : 0
          }}
          transition={{
            duration: isListening ? 2 : 0.3,
            repeat: isListening ? Infinity : 0
          }}
        />

        {/* Left eye container */}
        <motion.g
          animate={{
            scale: expression.eyeScale,
            x: eyePosition.x,
            y: eyePosition.y
          }}
          transition={{ duration: 0.3 }}
        >
          {/* Left eye white */}
          <ellipse cx={55} cy={55} rx={12} ry={10} fill="white" />
          
          {/* Left eye iris */}
          <motion.circle
            cx={55}
            cy={55}
            r={6}
            fill={expression.color}
            animate={{
              scale: isBlinking ? [1, 1, 0.1] : 1
            }}
            transition={{
              duration: isBlinking ? 0.2 : 0
            }}
          />
          
          {/* Left eye pupil */}
          <motion.circle
            cx={55}
            cy={55}
            r={3}
            fill="#1F2937"
            animate={{
              scale: isBlinking ? [1, 1, 0.1] : 1
            }}
            transition={{
              duration: isBlinking ? 0.2 : 0
            }}
          />

          {/* Left eye highlight */}
          <motion.circle
            cx={57}
            cy={53}
            r={1.5}
            fill="white"
            animate={{
              opacity: isBlinking ? [1, 1, 0] : 1
            }}
            transition={{
              duration: isBlinking ? 0.2 : 0
            }}
          />
        </motion.g>

        {/* Right eye container */}
        <motion.g
          animate={{
            scale: expression.eyeScale,
            x: eyePosition.x,
            y: eyePosition.y
          }}
          transition={{ duration: 0.3 }}
        >
          {/* Right eye white */}
          <ellipse cx={105} cy={55} rx={12} ry={10} fill="white" />
          
          {/* Right eye iris */}
          <motion.circle
            cx={105}
            cy={55}
            r={6}
            fill={expression.color}
            animate={{
              scale: isBlinking ? [1, 1, 0.1] : 1
            }}
            transition={{
              duration: isBlinking ? 0.2 : 0
            }}
          />
          
          {/* Right eye pupil */}
          <motion.circle
            cx={105}
            cy={55}
            r={3}
            fill="#1F2937"
            animate={{
              scale: isBlinking ? [1, 1, 0.1] : 1
            }}
            transition={{
              duration: isBlinking ? 0.2 : 0
            }}
          />

          {/* Right eye highlight */}
          <motion.circle
            cx={107}
            cy={53}
            r={1.5}
            fill="white"
            animate={{
              opacity: isBlinking ? [1, 1, 0] : 1
            }}
            transition={{
              duration: isBlinking ? 0.2 : 0
            }}
          />
        </motion.g>

        {/* Nose */}
        <motion.path
          d="M 80 70 Q 82 75 80 78"
          stroke="#D97706"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          animate={{
            scale: isTalking ? [1, 1.1, 1] : 1
          }}
          transition={{
            duration: 0.5,
            repeat: isTalking ? Infinity : 0
          }}
        />

        {/* Mouth */}
        <motion.ellipse
          cx={80}
          cy={expression.mouthY}
          rx={baseMouthRx}
          ry={baseMouthRy}
          fill="#DC2626"
          animate={
            hasAudioDrive
              ? {
                  ry: baseMouthRy + (isTalking ? clampedIntensity * 8 : 0),
                  rx: baseMouthRx + (isTalking ? clampedIntensity * 3 : 0)
                }
              : {
                  ry: isTalking
                    ? [baseMouthRy, baseMouthRy + 3, baseMouthRy]
                    : baseMouthRy,
                  rx: isTalking
                    ? [baseMouthRx, baseMouthRx + 2, baseMouthRx]
                    : baseMouthRx
                }
          }
          transition={
            hasAudioDrive
              ? { duration: 0.06, ease: 'linear' }
              : {
                  duration: isTalking ? 0.4 : 0.3,
                  repeat: isTalking ? Infinity : 0,
                  ease: 'easeInOut'
                }
          }
        />

        {/* Talking animation - sound waves */}
        <AnimatePresence>
          {isTalking && (
            <g>
              {[0, 1, 2].map((i) => (
                <motion.circle
                  key={`wave-${i}`}
                  cx={130 + i * 8}
                  cy={80}
                  r={2}
                  fill={expression.color}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{
                    scale: [0, 1.5, 0],
                    opacity: [0, 1, 0]
                  }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{
                    duration: 1,
                    repeat: Infinity,
                    delay: i * 0.2,
                    ease: "easeInOut"
                  }}
                />
              ))}
            </g>
          )}
        </AnimatePresence>

        {/* Listening animation - attention lines */}
        <AnimatePresence>
          {isListening && (
            <g>
              {[-1, 1].map((direction, i) => (
                <motion.path
                  key={`attention-${i}`}
                  d={`M ${40 + direction * 50} 30 L ${45 + direction * 45} 35`}
                  stroke={expression.color}
                  strokeWidth="2"
                  strokeLinecap="round"
                  initial={{ opacity: 0, pathLength: 0 }}
                  animate={{
                    opacity: [0, 1, 0],
                    pathLength: [0, 1, 0]
                  }}
                  exit={{ opacity: 0 }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    delay: i * 0.3
                  }}
                />
              ))}
            </g>
          )}
        </AnimatePresence>
      </svg>

      {/* Status glow effect */}
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{
          background: `radial-gradient(circle, ${expression.color}20 0%, transparent 70%)`,
        }}
        animate={{
          scale: isTalking || isListening ? [1, 1.2, 1] : 1,
          opacity: isTalking || isListening ? [0.3, 0.6, 0.3] : 0
        }}
        transition={{
          duration: 1.5,
          repeat: isTalking || isListening ? Infinity : 0,
          ease: "easeInOut"
        }}
      />
    </div>
  )
}