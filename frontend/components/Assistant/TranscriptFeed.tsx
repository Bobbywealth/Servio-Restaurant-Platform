import React, { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { User, Bot, Zap, AlertCircle, CheckCircle, Clock } from 'lucide-react'

export interface TranscriptMessage {
  id: string
  type: 'user' | 'assistant' | 'system' | 'action'
  content: string
  timestamp: Date
  metadata?: {
    confidence?: number
    duration?: number
    action?: {
      type: string
      status: 'pending' | 'completed' | 'error'
      details?: any
    }
  }
}

interface TranscriptFeedProps {
  messages: TranscriptMessage[]
  className?: string
  isProcessing?: boolean
}

export default function TranscriptFeed({
  messages,
  className = '',
  isProcessing = false
}: TranscriptFeedProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const getMessageIcon = (message: TranscriptMessage) => {
    switch (message.type) {
      case 'user':
        return <User className="w-4 h-4" />
      case 'assistant':
        return <Bot className="w-4 h-4" />
      case 'action':
        return <Zap className="w-4 h-4" />
      case 'system':
        return <AlertCircle className="w-4 h-4" />
      default:
        return <User className="w-4 h-4" />
    }
  }

  const getMessageStyles = (message: TranscriptMessage) => {
    switch (message.type) {
      case 'user':
        return {
          containerBg: 'bg-blue-50',
          iconBg: 'bg-blue-600',
          iconColor: 'text-white',
          textColor: 'text-gray-900',
          borderColor: 'border-blue-200'
        }
      case 'assistant':
        return {
          containerBg: 'bg-green-50',
          iconBg: 'bg-green-600',
          iconColor: 'text-white',
          textColor: 'text-gray-900',
          borderColor: 'border-green-200'
        }
      case 'action':
        const status = message.metadata?.action?.status
        return {
          containerBg: status === 'completed' ? 'bg-purple-50' : status === 'error' ? 'bg-red-50' : 'bg-yellow-50',
          iconBg: status === 'completed' ? 'bg-purple-600' : status === 'error' ? 'bg-red-600' : 'bg-yellow-600',
          iconColor: 'text-white',
          textColor: 'text-gray-900',
          borderColor: status === 'completed' ? 'border-purple-200' : status === 'error' ? 'border-red-200' : 'border-yellow-200'
        }
      case 'system':
        return {
          containerBg: 'bg-gray-50',
          iconBg: 'bg-gray-600',
          iconColor: 'text-white',
          textColor: 'text-gray-700',
          borderColor: 'border-gray-200'
        }
      default:
        return {
          containerBg: 'bg-gray-50',
          iconBg: 'bg-gray-600',
          iconColor: 'text-white',
          textColor: 'text-gray-900',
          borderColor: 'border-gray-200'
        }
    }
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Header */}
      <div className="flex-shrink-0 pb-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Conversation Log</h3>
          <span className="text-sm text-gray-500">{messages.length} messages</span>
        </div>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto py-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Bot className="w-12 h-12 text-gray-400 mb-4" />
            <h4 className="text-lg font-medium text-gray-600 mb-2">Ready to help!</h4>
            <p className="text-gray-500 max-w-sm">
              Start a conversation with Servio by clicking the microphone or using a quick command.
            </p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((message, index) => {
              const styles = getMessageStyles(message)
              return (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -20, scale: 0.95 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className={`flex space-x-3 ${styles.containerBg} ${styles.borderColor} border rounded-lg p-4`}
                >
                  {/* Icon */}
                  <div className={`flex-shrink-0 ${styles.iconBg} ${styles.iconColor} w-8 h-8 rounded-full flex items-center justify-center`}>
                    {getMessageIcon(message)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-sm font-medium text-gray-900 capitalize">
                        {message.type === 'assistant' ? 'Servio' : message.type}
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatTime(message.timestamp)}
                      </span>
                      {message.metadata?.confidence && (
                        <span className="text-xs text-gray-500">
                          ({Math.round(message.metadata.confidence * 100)}% confidence)
                        </span>
                      )}
                    </div>

                    <p className={`text-sm ${styles.textColor} whitespace-pre-wrap break-words`}>
                      {message.content}
                    </p>

                    {/* Action Status */}
                    {message.type === 'action' && message.metadata?.action && (
                      <div className="mt-2 flex items-center space-x-2">
                        {message.metadata.action.status === 'pending' && (
                          <>
                            <Clock className="w-3 h-3 text-yellow-600" />
                            <span className="text-xs text-yellow-600">Processing...</span>
                          </>
                        )}
                        {message.metadata.action.status === 'completed' && (
                          <>
                            <CheckCircle className="w-3 h-3 text-green-600" />
                            <span className="text-xs text-green-600">Completed</span>
                          </>
                        )}
                        {message.metadata.action.status === 'error' && (
                          <>
                            <AlertCircle className="w-3 h-3 text-red-600" />
                            <span className="text-xs text-red-600">Error</span>
                          </>
                        )}
                      </div>
                    )}

                    {/* Processing Duration */}
                    {message.metadata?.duration && (
                      <div className="mt-1">
                        <span className="text-xs text-gray-500">
                          Processed in {message.metadata.duration}ms
                        </span>
                      </div>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        )}

        {/* Processing Indicator */}
        {isProcessing && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex space-x-3 bg-blue-50 border border-blue-200 rounded-lg p-4"
          >
            <div className="bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center">
              <Bot className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-1">
                <span className="text-sm font-medium text-gray-900">Servio</span>
                <span className="text-xs text-gray-500">thinking...</span>
              </div>
              <div className="flex items-center space-x-1">
                <motion.div
                  className="w-2 h-2 bg-blue-600 rounded-full"
                  animate={{ scale: [1, 1.2, 1], opacity: [1, 0.5, 1] }}
                  transition={{ duration: 1, repeat: Infinity, delay: 0 }}
                />
                <motion.div
                  className="w-2 h-2 bg-blue-600 rounded-full"
                  animate={{ scale: [1, 1.2, 1], opacity: [1, 0.5, 1] }}
                  transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
                />
                <motion.div
                  className="w-2 h-2 bg-blue-600 rounded-full"
                  animate={{ scale: [1, 1.2, 1], opacity: [1, 0.5, 1] }}
                  transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
                />
              </div>
            </div>
          </motion.div>
        )}

        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </div>
    </div>
  )
}