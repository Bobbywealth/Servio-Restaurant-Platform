import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Volume2, Brain, Sparkles } from 'lucide-react';

interface RealisticAvatarProps {
  isListening?: boolean;
  isTalking?: boolean;
  isThinking?: boolean;
  size?: 'small' | 'medium' | 'large';
  className?: string;
  gender?: 'female' | 'male';
  name?: string;
  audioLevel?: number; // 0-100 for speech visualization
}

export default function RealisticAvatar({
  isListening = false,
  isTalking = false,
  isThinking = false,
  size = 'large',
  className = '',
  gender = 'female',
  name = 'Servio Assistant',
  audioLevel = 0
}: RealisticAvatarProps) {
  const [currentExpression, setCurrentExpression] = useState<'neutral' | 'listening' | 'speaking' | 'thinking'>('neutral');
  const [speechWaveHeight, setSpeechWaveHeight] = useState<number[]>([4, 8, 12, 16, 12, 8, 4]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Size configurations
  const sizeConfig = {
    small: { container: 120, avatar: 100, canvas: 80 },
    medium: { container: 180, avatar: 150, canvas: 120 },
    large: { container: 240, avatar: 200, canvas: 160 }
  };

  const currentSize = sizeConfig[size];

  // Update expression based on state
  useEffect(() => {
    if (isThinking) {
      setCurrentExpression('thinking');
    } else if (isTalking) {
      setCurrentExpression('speaking');
    } else if (isListening) {
      setCurrentExpression('listening');
    } else {
      setCurrentExpression('neutral');
    }
  }, [isListening, isTalking, isThinking]);

  // Animate speech waves
  useEffect(() => {
    if (!isTalking) return;

    const interval = setInterval(() => {
      setSpeechWaveHeight(prev => 
        prev.map(() => Math.max(4, Math.floor(Math.random() * (audioLevel || 20))))
      );
    }, 150);

    return () => clearInterval(interval);
  }, [isTalking, audioLevel]);

  // Avatar images - using AI-generated professional headshots
  const avatarImages = {
    female: {
      neutral: '/api/placeholder/female-avatar-neutral.jpg',
      listening: '/api/placeholder/female-avatar-listening.jpg',
      speaking: '/api/placeholder/female-avatar-speaking.jpg',
      thinking: '/api/placeholder/female-avatar-thinking.jpg',
    },
    male: {
      neutral: '/api/placeholder/male-avatar-neutral.jpg',
      listening: '/api/placeholder/male-avatar-listening.jpg',
      speaking: '/api/placeholder/male-avatar-speaking.jpg',
      thinking: '/api/placeholder/male-avatar-thinking.jpg',
    }
  };

  // For demo purposes, we'll use CSS gradients to simulate realistic avatars
  const getAvatarGradient = () => {
    const baseGradient = gender === 'female' 
      ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      : 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)';
    
    const stateOverlay = currentExpression === 'listening' 
      ? ', radial-gradient(circle at 30% 30%, rgba(59, 130, 246, 0.3) 0%, transparent 50%)'
      : currentExpression === 'speaking'
      ? ', radial-gradient(circle at 30% 30%, rgba(16, 185, 129, 0.3) 0%, transparent 50%)'
      : currentExpression === 'thinking'
      ? ', radial-gradient(circle at 30% 30%, rgba(139, 92, 246, 0.3) 0%, transparent 50%)'
      : '';

    return baseGradient + stateOverlay;
  };

  // Get status color
  const getStatusColor = () => {
    switch (currentExpression) {
      case 'listening': return '#3B82F6'; // Blue
      case 'speaking': return '#10B981';  // Green
      case 'thinking': return '#8B5CF6';  // Purple
      default: return '#6B7280';         // Gray
    }
  };

  // Get status text
  const getStatusText = () => {
    switch (currentExpression) {
      case 'listening': return 'Listening...';
      case 'speaking': return 'Speaking...';
      case 'thinking': return 'Thinking...';
      default: return 'Ready to help';
    }
  };

  return (
    <div className={`flex flex-col items-center ${className}`}>
      {/* Main Avatar Container */}
      <div 
        className="relative"
        style={{ width: currentSize.container, height: currentSize.container }}
      >
        {/* Background Glow Effect */}
        <motion.div
          className="absolute inset-0 rounded-full blur-xl opacity-30"
          style={{ 
            background: getStatusColor(),
            transform: 'scale(1.2)'
          }}
          animate={{
            opacity: isListening || isTalking || isThinking ? [0.2, 0.4, 0.2] : 0.1,
            scale: isListening || isTalking || isThinking ? [1.1, 1.3, 1.1] : 1.0
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />

        {/* Outer Ring */}
        <motion.div
          className="absolute inset-2 rounded-full border-2"
          style={{ borderColor: getStatusColor() }}
          animate={{
            rotate: isListening || isTalking ? 360 : 0,
            borderWidth: isListening || isTalking ? [2, 4, 2] : 2,
            opacity: [0.5, 1, 0.5]
          }}
          transition={{
            rotate: { duration: 20, repeat: Infinity, ease: "linear" },
            borderWidth: { duration: 1.5, repeat: Infinity },
            opacity: { duration: 2, repeat: Infinity }
          }}
        />

        {/* Avatar Image Container */}
        <motion.div
          className="absolute inset-4 rounded-full overflow-hidden bg-gradient-to-br from-gray-100 to-gray-300 shadow-2xl"
          style={{ 
            background: getAvatarGradient(),
            boxShadow: `0 0 30px ${getStatusColor()}40`
          }}
          animate={{
            scale: isListening || isTalking ? [1, 1.05, 1] : 1,
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        >
          {/* Professional Avatar Face Overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-orange-100 via-orange-200 to-orange-300 opacity-80" />
          
          {/* Facial Features Simulation */}
          <div className="absolute inset-0 flex items-center justify-center">
            {/* Eyes */}
            <div className="absolute" style={{ top: '35%', left: '35%' }}>
              <motion.div 
                className="w-2 h-2 bg-gray-700 rounded-full"
                animate={{
                  scaleY: isListening ? [1, 0.3, 1] : 1,
                }}
                transition={{ duration: 0.15, repeat: isListening ? Infinity : 0 }}
              />
            </div>
            <div className="absolute" style={{ top: '35%', right: '35%' }}>
              <motion.div 
                className="w-2 h-2 bg-gray-700 rounded-full"
                animate={{
                  scaleY: isListening ? [1, 0.3, 1] : 1,
                }}
                transition={{ duration: 0.15, repeat: isListening ? Infinity : 0, delay: 0.1 }}
              />
            </div>
            
            {/* Mouth */}
            <motion.div 
              className="absolute bg-red-400 rounded-full"
              style={{ bottom: '35%', left: '50%', transform: 'translateX(-50%)' }}
              animate={{
                width: isTalking ? [12, 20, 12] : 12,
                height: isTalking ? [4, 8, 4] : 4,
              }}
              transition={{ duration: 0.3, repeat: isTalking ? Infinity : 0 }}
            />
          </div>

          {/* State-specific overlays */}
          <AnimatePresence>
            {isThinking && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-purple-200 opacity-20"
              />
            )}
          </AnimatePresence>
        </motion.div>

        {/* Speech Visualization */}
        <AnimatePresence>
          {isTalking && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="absolute -right-8 top-1/2 transform -translate-y-1/2 flex items-end space-x-1"
            >
              {speechWaveHeight.map((height, index) => (
                <motion.div
                  key={index}
                  className="bg-green-400 rounded-full w-1"
                  style={{ height: height * 2 }}
                  animate={{
                    height: [height * 2, height * 4, height * 2],
                    opacity: [0.6, 1, 0.6]
                  }}
                  transition={{
                    duration: 0.3,
                    repeat: Infinity,
                    delay: index * 0.05
                  }}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Listening Visualization */}
        <AnimatePresence>
          {isListening && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="absolute -left-8 top-1/2 transform -translate-y-1/2"
            >
              <motion.div
                animate={{
                  scale: [1, 1.3, 1],
                  rotate: [0, 10, -10, 0]
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              >
                <Mic className="w-6 h-6 text-blue-400" />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Thinking Visualization */}
        <AnimatePresence>
          {isThinking && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: -30 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute left-1/2 top-0 transform -translate-x-1/2 flex space-x-1"
            >
              {[0, 1, 2].map((index) => (
                <motion.div
                  key={index}
                  className="w-2 h-2 bg-purple-400 rounded-full"
                  animate={{
                    y: [0, -8, 0],
                    opacity: [0.4, 1, 0.4]
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    delay: index * 0.2
                  }}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Status Indicator */}
        <motion.div
          className="absolute -bottom-2 left-1/2 transform -translate-x-1/2"
          animate={{
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
          }}
        >
          <div 
            className="w-4 h-4 rounded-full shadow-lg"
            style={{ backgroundColor: getStatusColor() }}
          />
        </motion.div>
      </div>

      {/* Assistant Info Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-6 bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-4 min-w-[200px] text-center border border-gray-200 dark:border-gray-700"
      >
        {/* Name and Title */}
        <div className="mb-3">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center justify-center space-x-2">
            <span>{name}</span>
            <Sparkles className="w-4 h-4 text-orange-400" />
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">AI Restaurant Assistant</p>
        </div>

        {/* Status Display */}
        <div className="flex items-center justify-center space-x-2 mb-3">
          <motion.div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: getStatusColor() }}
            animate={{
              scale: [1, 1.5, 1],
              opacity: [0.5, 1, 0.5]
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity
            }}
          />
          <span 
            className="text-sm font-medium"
            style={{ color: getStatusColor() }}
          >
            {getStatusText()}
          </span>
        </div>

        {/* Action Hint */}
        <AnimatePresence mode="wait">
          {currentExpression === 'neutral' && (
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="text-xs text-gray-400 dark:text-gray-500"
            >
              Say "Hey Servio" or click mic to start
            </motion.p>
          )}
          {currentExpression === 'listening' && (
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="text-xs text-blue-500"
            >
              I'm listening... go ahead!
            </motion.p>
          )}
          {currentExpression === 'speaking' && (
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="text-xs text-green-500"
            >
              Let me help you with that...
            </motion.p>
          )}
          {currentExpression === 'thinking' && (
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="text-xs text-purple-500"
            >
              Just a moment, processing...
            </motion.p>
          )}
        </AnimatePresence>

        {/* Audio Level Meter (when talking) */}
        <AnimatePresence>
          {isTalking && audioLevel > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600"
            >
              <div className="flex items-center justify-center space-x-1">
                <Volume2 className="w-3 h-3 text-green-400" />
                <div className="flex space-x-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={i}
                      className={`w-1 h-3 rounded-full transition-all ${
                        (audioLevel / 20) > i ? 'bg-green-400' : 'bg-gray-200 dark:bg-gray-600'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}