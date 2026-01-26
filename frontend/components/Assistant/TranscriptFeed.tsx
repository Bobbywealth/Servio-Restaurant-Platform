import React, { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { User, Bot, Zap, AlertCircle, CheckCircle, Clock, Copy, RotateCw } from 'lucide-react'

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
  onCopyMessage?: (content: string) => void
  onRetryMessage?: (content: string) => void
}

export default function TranscriptFeed({
  messages,
  className = '',
  isProcessing = false,
  onCopyMessage,
  onRetryMessage
}: TranscriptFeedProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null)

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
          containerBg: 'bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30',
          iconBg: 'bg-gradient-to-br from-blue-600 to-indigo-600',
          iconColor: 'text-white',
          textColor: 'text-gray-900 dark:text-gray-100',
          borderColor: 'border-blue-200/50 dark:border-blue-800/50'
        }
      case 'assistant':
        return {
          containerBg: 'bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30',
          iconBg: 'bg-gradient-to-br from-emerald-600 to-teal-600',
          iconColor: 'text-white',
          textColor: 'text-gray-900 dark:text-gray-100',
          borderColor: 'border-emerald-200/50 dark:border-emerald-800/50'
        }
      case 'action':
        const status = message.metadata?.action?.status
        return {
          containerBg: status === 'completed' ? 'bg-gradient-to-br from-purple-50 to-fuchsia-50 dark:from-purple-950/30 dark:to-fuchsia-950/30' : status === 'error' ? 'bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/30' : 'bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-950/30 dark:to-amber-950/30',
          iconBg: status === 'completed' ? 'bg-gradient-to-br from-purple-600 to-fuchsia-600' : status === 'error' ? 'bg-gradient-to-br from-red-600 to-rose-600' : 'bg-gradient-to-br from-yellow-600 to-amber-600',
          iconColor: 'text-white',
          textColor: 'text-gray-900 dark:text-gray-100',
          borderColor: status === 'completed' ? 'border-purple-200/50 dark:border-purple-800/50' : status === 'error' ? 'border-red-200/50 dark:border-red-800/50' : 'border-yellow-200/50 dark:border-yellow-800/50'
        }
      case 'system':
        return {
          containerBg: 'bg-gradient-to-br from-gray-50 to-slate-50 dark:from-gray-900/30 dark:to-slate-900/30',
          iconBg: 'bg-gradient-to-br from-gray-600 to-slate-600',
          iconColor: 'text-white',
          textColor: 'text-gray-700 dark:text-gray-300',
          borderColor: 'border-gray-200/50 dark:border-gray-800/50'
        }
      default:
        return {
          containerBg: 'bg-gray-50 dark:bg-gray-900/30',
          iconBg: 'bg-gray-600',
          iconColor: 'text-white',
          textColor: 'text-gray-900 dark:text-gray-100',
          borderColor: 'border-gray-200/50 dark:border-gray-800/50'
        }
    }
  }

  const formatTime = (date: Date | string) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date
    return dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto py-4 space-y-3 px-1">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-gradient-to-r from-violet-400 to-fuchsia-400 blur-2xl opacity-20 rounded-full"></div>
              <Bot className="w-16 h-16 text-violet-600 dark:text-violet-400 relative z-10" />
            </div>
            <h4 className="text-xl font-bold bg-gradient-to-r from-violet-600 to-fuchsia-600 bg-clip-text text-transparent mb-3">
              Hi! I'm Servio
            </h4>
            <p className="text-surface-600 dark:text-surface-400 max-w-md leading-relaxed">
              I'm your intelligent restaurant assistant. I can help you manage orders, inventory, menu items, and tasks.
              <br /><br />
              <span className="font-semibold">Try saying:</span>
              <br />
              "Check current orders" or "What's 86'd?"
            </p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((message, index) => {
              const styles = getMessageStyles(message)
              const isHovered = hoveredMessageId === message.id
              const showActions = (message.type === 'user' || message.type === 'assistant') && (onCopyMessage || onRetryMessage)

              return (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -20, scale: 0.95 }}
                  transition={{ duration: 0.3, delay: Math.min(index * 0.05, 0.3) }}
                  onMouseEnter={() => setHoveredMessageId(message.id)}
                  onMouseLeave={() => setHoveredMessageId(null)}
                  className={`group relative flex space-x-3 ${styles.containerBg} ${styles.borderColor} border rounded-2xl p-4 shadow-sm hover:shadow-md transition-all duration-200`}
                >
                  {/* Icon */}
                  <div className={`flex-shrink-0 ${styles.iconBg} ${styles.iconColor} w-10 h-10 rounded-xl flex items-center justify-center shadow-sm`}>
                    {getMessageIcon(message)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 capitalize">
                        {message.type === 'assistant' ? 'Servio AI' : message.type}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {formatTime(message.timestamp)}
                      </span>
                      {message.metadata?.confidence && message.metadata.confidence < 0.95 && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300">
                          {Math.round(message.metadata.confidence * 100)}%
                        </span>
                      )}
                    </div>

                    <p className={`text-sm leading-relaxed ${styles.textColor} whitespace-pre-wrap break-words`}>
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
                      <div className="mt-2">
                        <span className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                          ⚡ {message.metadata.duration}ms
                        </span>
                      </div>
                    )}

                    {/* Message Actions */}
                    {showActions && (
                      <div className={`mt-3 flex items-center gap-2 transition-opacity duration-200 ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
                        {onCopyMessage && (
                          <button
                            onClick={() => onCopyMessage(message.content)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 shadow-sm transition-colors"
                            title="Copy message"
                          >
                            <Copy className="w-3 h-3" />
                            Copy
                          </button>
                        )}
                        {onRetryMessage && message.type === 'user' && (
                          <button
                            onClick={() => onRetryMessage(message.content)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 shadow-sm transition-colors"
                            title="Retry command"
                          >
                            <RotateCw className="w-3 h-3" />
                            Retry
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        )}

        {/* Processing Indicator - ChatGPT style */}
        {isProcessing && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="flex space-x-3 bg-gradient-to-br from-violet-50 to-fuchsia-50 dark:from-violet-950/30 dark:to-fuchsia-950/30 border border-violet-200/50 dark:border-violet-800/50 rounded-2xl p-4 shadow-sm"
          >
            <div className="bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white w-10 h-10 rounded-xl flex items-center justify-center shadow-sm">
              <Bot className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-2">
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">Servio AI</span>
                <span className="text-xs text-violet-600 dark:text-violet-400 font-medium">thinking...</span>
              </div>
              <div className="flex items-center space-x-1.5 px-3 py-2 bg-white/50 dark:bg-gray-900/50 rounded-lg">
                <motion.div
                  className="w-2.5 h-2.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 rounded-full"
                  animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut", delay: 0 }}
                />
                <motion.div
                  className="w-2.5 h-2.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 rounded-full"
                  animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
                />
                <motion.div
                  className="w-2.5 h-2.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 rounded-full"
                  animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
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