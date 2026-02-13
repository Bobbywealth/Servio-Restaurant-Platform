/**
 * Live Chat Widget Integration
 * Provides customer support through live chat
 * 
 * Live chat can increase high-value conversions by 40%
 */

import React, { useState, useEffect, useCallback } from 'react'
import Script from 'next/script'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageCircle, X, Send, Minimize2 } from 'lucide-react'

// ============================================================================
// Types
// ============================================================================

interface LiveChatProps {
  /** Chat provider: 'tawk' | 'intercom' | 'crisp' | 'custom' */
  provider?: 'tawk' | 'intercom' | 'crisp' | 'custom'
  /** Property ID from chat provider */
  propertyId?: string
  /** Show after delay (ms) */
  showAfterDelay?: number
  /** Show on exit intent */
  showOnExitIntent?: boolean
  /** Custom widget for 'custom' provider */
  customWidget?: React.ReactNode
  /** Position on screen */
  position?: 'bottom-right' | 'bottom-left'
  /** Z-index */
  zIndex?: number
  /** Auto-open */
  autoOpen?: boolean
  /** Auto-open delay */
  autoOpenDelay?: number
}

// ============================================================================
// Tawk.to Integration
// ============================================================================

interface TawkChatProps {
  propertyId: string
  widgetId?: string
}

export function TawkChat({ propertyId, widgetId = 'default' }: TawkChatProps) {
  return (
    <>
      <Script
        src={`https://embed.tawk.to/${propertyId}/${widgetId}`}
        strategy="lazyOnload"
        onLoad={() => {
          if (typeof window !== 'undefined' && (window as any).Tawk_API) {
            (window as any).Tawk_API.onLoad = function() {
              console.log('[Tawk] Chat loaded')
            }
          }
        }}
      />
    </>
  )
}

// ============================================================================
// Intercom Integration
// ============================================================================

interface IntercomChatProps {
  appId: string
  userId?: string
  userName?: string
  userEmail?: string
}

export function IntercomChat({ 
  appId, 
  userId, 
  userName, 
  userEmail 
}: IntercomChatProps) {
  useEffect(() => {
    if (typeof window === 'undefined') return

    // Initialize Intercom
    (window as any).intercomSettings = {
      app_id: appId,
      user_id: userId,
      name: userName,
      email: userEmail
    }

    // Load Intercom script
    const script = document.createElement('script')
    script.src = `https://widget.intercom.io/widget/${appId}`
    script.async = true
    document.body.appendChild(script)

    return () => {
      // Cleanup
      const intercomWidget = document.querySelector('.intercom-lightweight-app')
      if (intercomWidget) {
        intercomWidget.remove()
      }
    }
  }, [appId, userId, userName, userEmail])

  return null
}

// ============================================================================
// Crisp Integration
// ============================================================================

interface CrispChatProps {
  websiteId: string
  userEmail?: string
  userName?: string
}

export function CrispChat({ websiteId, userEmail, userName }: CrispChatProps) {
  useEffect(() => {
    if (typeof window === 'undefined') return

    // Initialize Crisp
    (window as any).CRISP_WEBSITE_ID = websiteId
    
    // Set user info
    if (userEmail) {
      (window as any).$crisp = (window as any).$crisp || []
      ;(window as any).$crisp.push(['set', 'user:email', userEmail])
      if (userName) {
        ;(window as any).$crisp.push(['set', 'user:nickname', userName])
      }
    }

    // Load Crisp script
    const script = document.createElement('script')
    script.src = 'https://client.crisp.chat/l.js'
    script.async = true
    document.head.appendChild(script)

    return () => {
      const crispWidget = document.querySelector('#crisp-chatbox')
      if (crispWidget) {
        crispWidget.remove()
      }
    }
  }, [websiteId, userEmail, userName])

  return null
}

// ============================================================================
// Custom Chat Widget
// ============================================================================

interface CustomChatWidgetProps {
  position?: 'bottom-right' | 'bottom-left'
  zIndex?: number
  showAfterDelay?: number
  showOnExitIntent?: boolean
  autoOpen?: boolean
  autoOpenDelay?: number
  onSendMessage?: (message: string) => void | Promise<void>
}

export function CustomChatWidget({
  position = 'bottom-right',
  zIndex = 50,
  showAfterDelay = 3000,
  showOnExitIntent = true,
  autoOpen = false,
  autoOpenDelay = 10000,
  onSendMessage
}: CustomChatWidgetProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [message, setMessage] = useState('')
  const [messages, setMessages] = useState<{ text: string; isUser: boolean; time: Date }[]>([
    {
      text: "Hi! 👋 How can we help you today?",
      isUser: false,
      time: new Date()
    }
  ])
  const [isTyping, setIsTyping] = useState(false)

  // Show after delay
  useEffect(() => {
    const timeout = setTimeout(() => {
      setIsVisible(true)
    }, showAfterDelay)

    return () => clearTimeout(timeout)
  }, [showAfterDelay])

  // Show on exit intent
  useEffect(() => {
    if (!showOnExitIntent) return

    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 0 && isVisible && !isOpen) {
        setIsOpen(true)
      }
    }

    document.addEventListener('mouseleave', handleMouseLeave)
    return () => document.removeEventListener('mouseleave', handleMouseLeave)
  }, [showOnExitIntent, isVisible, isOpen])

  // Auto-open
  useEffect(() => {
    if (!autoOpen || !isVisible) return

    const timeout = setTimeout(() => {
      setIsOpen(true)
    }, autoOpenDelay)

    return () => clearTimeout(timeout)
  }, [autoOpen, autoOpenDelay, isVisible])

  // Handle send message
  const handleSend = async () => {
    if (!message.trim()) return

    const userMessage = message.trim()
    setMessage('')
    setMessages(prev => [...prev, { text: userMessage, isUser: true, time: new Date() }])

    // Simulate response
    setIsTyping(true)
    setTimeout(() => {
      setMessages(prev => [...prev, {
        text: "Thanks for your message! Our team will respond shortly. In the meantime, check out our documentation at docs.servio.com",
        isUser: false,
        time: new Date()
      }])
      setIsTyping(false)
    }, 1500)

    onSendMessage?.(userMessage)
  }

  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const positionClasses = {
    'bottom-right': 'right-4 md:right-6',
    'bottom-left': 'left-4 md:left-6'
  }

  if (!isVisible) return null

  return (
    <div 
      className={`fixed bottom-4 md:bottom-6 ${positionClasses[position]}`}
      style={{ zIndex }}
    >
      <AnimatePresence>
        {isOpen && !isMinimized && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="mb-4 w-[350px] max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-primary-500 to-primary-600 text-white p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                    <MessageCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Servio Support</h3>
                    <p className="text-xs text-white/80">We typically reply in minutes</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setIsMinimized(true)}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    aria-label="Minimize"
                  >
                    <Minimize2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    aria-label="Close"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="h-80 overflow-y-auto p-4 space-y-4 bg-gray-50">
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex ${msg.isUser ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] p-3 rounded-2xl ${
                      msg.isUser
                        ? 'bg-primary-500 text-white rounded-br-md'
                        : 'bg-white text-gray-800 rounded-bl-md shadow'
                    }`}
                  >
                    <p className="text-sm">{msg.text}</p>
                    <p className={`text-xs mt-1 ${msg.isUser ? 'text-white/70' : 'text-gray-400'}`}>
                      {msg.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
              
              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-white text-gray-800 p-3 rounded-2xl rounded-bl-md shadow">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="p-4 border-t border-gray-200 bg-white">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type a message..."
                  className="flex-1 px-4 py-2 bg-gray-100 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <button
                  onClick={handleSend}
                  disabled={!message.trim()}
                  className="p-2 bg-primary-500 text-white rounded-full hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Send message"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat button */}
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => {
          if (isMinimized) {
            setIsMinimized(false)
            setIsOpen(true)
          } else {
            setIsOpen(!isOpen)
          }
        }}
        className="w-14 h-14 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-full shadow-lg flex items-center justify-center hover:shadow-xl transition-shadow"
        aria-label={isOpen ? 'Close chat' : 'Open chat'}
      >
        {isOpen && !isMinimized ? (
          <X className="w-6 h-6" />
        ) : (
          <MessageCircle className="w-6 h-6" />
        )}
      </motion.button>

      {/* Unread indicator */}
      {!isOpen && (
        <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 rounded-full border-2 border-white" />
      )}
    </div>
  )
}

// ============================================================================
// Main Export Component
// ============================================================================

export function LiveChat({
  provider = 'custom',
  propertyId,
  showAfterDelay = 3000,
  showOnExitIntent = true,
  position = 'bottom-right',
  zIndex = 50,
  autoOpen = false,
  autoOpenDelay = 10000,
  customWidget
}: LiveChatProps) {
  // Render provider-specific widget
  switch (provider) {
    case 'tawk':
      return propertyId ? <TawkChat propertyId={propertyId} /> : null
    
    case 'intercom':
      return propertyId ? <IntercomChat appId={propertyId} /> : null
    
    case 'crisp':
      return propertyId ? <CrispChat websiteId={propertyId} /> : null
    
    case 'custom':
    default:
      if (customWidget) {
        return <>{customWidget}</>
      }
      return (
        <CustomChatWidget
          position={position}
          zIndex={zIndex}
          showAfterDelay={showAfterDelay}
          showOnExitIntent={showOnExitIntent}
          autoOpen={autoOpen}
          autoOpenDelay={autoOpenDelay}
        />
      )
  }
}

// ============================================================================
// Export
// ============================================================================

export default LiveChat
