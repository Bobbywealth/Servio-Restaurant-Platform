import React, { useState, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { MessageCircle, X, Send, Minimize2, Maximize2, Bot, User } from 'lucide-react'

export interface LiveChatProps {
  title?: string
  subtitle?: string
  placeholder?: string
  welcomeMessage?: string
  onSendMessage?: (message: string) => Promise<string | void>
  className?: string
}

interface Message {
  id: string
  content: string
  sender: 'user' | 'bot'
  timestamp: Date
}

/**
 * LiveChat Component
 * 
 * A floating chat widget for customer support:
 * - Expandable/collapsible interface
 * - Auto-responses for common questions
 * - Typing indicators
 * - Message history
 * 
 * Best practices:
 * - Respond quickly to inquiries
 * - Use friendly, helpful tone
 * - Offer human handoff option
 * - Store chat history
 */
export function LiveChat({
  title = 'Chat with us',
  subtitle = 'We typically reply in a few minutes',
  placeholder = 'Type your message...',
  welcomeMessage = "Hi! 👋 How can we help you today? I'm here to answer questions about Servio and help you get started.",
  onSendMessage,
  className = '',
}: LiveChatProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: welcomeMessage,
      sender: 'bot',
      timestamp: new Date(),
    },
  ])
  const [inputValue, setInputValue] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [hasUnread, setHasUnread] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const shouldReduceMotion = useReducedMotion()

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input when opened
  useEffect(() => {
    if (isOpen && !isMinimized) {
      inputRef.current?.focus()
    }
  }, [isOpen, isMinimized])

  // Mark as unread when closed and new message arrives
  useEffect(() => {
    if (!isOpen && messages.length > 1) {
      setHasUnread(true)
    }
  }, [messages, isOpen])

  const getAutoResponse = useCallback((message: string): string => {
    const lowerMessage = message.toLowerCase()
    
    if (lowerMessage.includes('price') || lowerMessage.includes('cost') || lowerMessage.includes('pricing')) {
      return "Our pricing starts at $49/month for the Starter plan. We also offer a Pro plan at $99/month for multi-location restaurants. Would you like me to tell you more about what's included?"
    }
    
    if (lowerMessage.includes('demo') || lowerMessage.includes('trial')) {
      return "You can start a free 14-day trial right now! No credit card required. Would you like me to help you get started, or would you prefer to book a personalized demo with our team?"
    }
    
    if (lowerMessage.includes('feature') || lowerMessage.includes('what can')) {
      return "Servio offers voice-activated commands, order management, staff scheduling, inventory tracking, analytics, and much more! What specific feature are you most interested in learning about?"
    }
    
    if (lowerMessage.includes('integrat') || lowerMessage.includes('pos') || lowerMessage.includes('doordash') || lowerMessage.includes('ubereats')) {
      return "We integrate with major POS systems and delivery platforms including Toast, Square, DoorDash, UberEats, and Grubhub. We also have an API for custom integrations!"
    }
    
    if (lowerMessage.includes('support') || lowerMessage.includes('help')) {
      return "Our support team is available 24/7 via email and chat. Pro and Enterprise plans also include phone support and a dedicated account manager. How can I help you right now?"
    }
    
    if (lowerMessage.includes('thank')) {
      return "You're welcome! 😊 Is there anything else I can help you with?"
    }
    
    return "Thanks for your message! A member of our team will get back to you shortly. In the meantime, feel free to ask me about pricing, features, or integrations!"
  }, [])

  const handleSend = async () => {
    if (!inputValue.trim()) return

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputValue,
      sender: 'user',
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInputValue('')
    setIsTyping(true)

    try {
      if (onSendMessage) {
        const response = await onSendMessage(inputValue)
        if (response) {
          setMessages((prev) => [
            ...prev,
            {
              id: (Date.now() + 1).toString(),
              content: response,
              sender: 'bot',
              timestamp: new Date(),
            },
          ])
        }
      } else {
        // Simulate typing delay
        await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 1000))
        const autoResponse = getAutoResponse(userMessage.content)
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            content: autoResponse,
            sender: 'bot',
            timestamp: new Date(),
          },
        ])
      }
    } catch (error) {
      console.error('Chat error:', error)
    } finally {
      setIsTyping(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className={`fixed bottom-4 right-4 z-50 ${className}`}>
      <AnimatePresence>
        {isOpen && !isMinimized && (
          <motion.div
            initial={shouldReduceMotion ? undefined : { opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={shouldReduceMotion ? undefined : { opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="absolute bottom-16 right-0 w-[350px] max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-2xl overflow-hidden"
            role="dialog"
            aria-label="Chat window"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-primary-500 to-primary-600 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-white font-semibold">{title}</h3>
                  <p className="text-white/80 text-xs">{subtitle}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsMinimized(true)}
                  className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
                  aria-label="Minimize chat"
                >
                  <Minimize2 className="w-4 h-4 text-white" />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
                  aria-label="Close chat"
                >
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="h-80 overflow-y-auto p-4 space-y-4 bg-gray-50">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`flex items-start gap-2 max-w-[80%] ${
                      message.sender === 'user' ? 'flex-row-reverse' : ''
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        message.sender === 'user'
                          ? 'bg-primary-500'
                          : 'bg-gray-200'
                      }`}
                    >
                      {message.sender === 'user' ? (
                        <User className="w-4 h-4 text-white" />
                      ) : (
                        <Bot className="w-4 h-4 text-gray-600" />
                      )}
                    </div>
                    <div
                      className={`px-4 py-2 rounded-2xl ${
                        message.sender === 'user'
                          ? 'bg-primary-500 text-white rounded-br-md'
                          : 'bg-white text-gray-800 rounded-bl-md shadow-sm'
                      }`}
                    >
                      <p className="text-sm">{message.content}</p>
                    </div>
                  </div>
                </div>
              ))}
              
              {isTyping && (
                <div className="flex items-start gap-2">
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                    <Bot className="w-4 h-4 text-gray-600" />
                  </div>
                  <div className="bg-white px-4 py-2 rounded-2xl rounded-bl-md shadow-sm">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-gray-200 bg-white">
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={placeholder}
                  className="flex-1 px-4 py-2.5 bg-gray-100 rounded-xl text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <button
                  onClick={handleSend}
                  disabled={!inputValue.trim()}
                  className="p-2.5 bg-primary-500 hover:bg-primary-600 disabled:bg-gray-300 text-white rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                  aria-label="Send message"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Minimized bar */}
      <AnimatePresence>
        {isOpen && isMinimized && (
          <motion.div
            initial={shouldReduceMotion ? undefined : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={shouldReduceMotion ? undefined : { opacity: 0, y: 20 }}
            onClick={() => setIsMinimized(false)}
            className="absolute bottom-16 right-0 bg-gradient-to-r from-primary-500 to-primary-600 px-4 py-3 rounded-full shadow-lg cursor-pointer flex items-center gap-3"
          >
            <Bot className="w-5 h-5 text-white" />
            <span className="text-white font-medium text-sm">{title}</span>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setIsOpen(false)
              }}
              className="p-1 rounded-full hover:bg-white/20"
              aria-label="Close chat"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating button */}
      <motion.button
        onClick={() => {
          setIsOpen(true)
          setIsMinimized(false)
          setHasUnread(false)
        }}
        className="w-14 h-14 bg-gradient-to-r from-primary-500 to-primary-600 rounded-full shadow-lg flex items-center justify-center hover:shadow-xl transition-shadow focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
        whileHover={shouldReduceMotion ? undefined : { scale: 1.05 }}
        whileTap={shouldReduceMotion ? undefined : { scale: 0.95 }}
        aria-label={isOpen ? 'Close chat' : 'Open chat'}
        aria-expanded={isOpen}
      >
        {isOpen ? (
          <X className="w-6 h-6 text-white" />
        ) : (
          <>
            <MessageCircle className="w-6 h-6 text-white" />
            {hasUnread && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white" />
            )}
          </>
        )}
      </motion.button>
    </div>
  )
}

export default LiveChat
