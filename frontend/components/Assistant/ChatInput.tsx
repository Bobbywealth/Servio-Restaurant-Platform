import React, { useState, useRef, KeyboardEvent } from 'react'
import { motion } from 'framer-motion'
import { Send, Loader2 } from 'lucide-react'

interface ChatInputProps {
  onSendMessage: (message: string) => void
  disabled?: boolean
  placeholder?: string
  className?: string
}

export default function ChatInput({
  onSendMessage,
  disabled = false,
  placeholder = "Type your command here... (e.g., 'no more jerk chicken')",
  className = ''
}: ChatInputProps) {
  const [message, setMessage] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSend = () => {
    const trimmedMessage = message.trim()
    if (trimmedMessage && !disabled) {
      onSendMessage(trimmedMessage)
      setMessage('')
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value)
    
    // Auto-resize textarea
    const textarea = e.target
    textarea.style.height = 'auto'
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px'
  }

  return (
    <div className={`flex items-end space-x-2 ${className}`}>
      <div className="flex-1 relative">
        <textarea
          ref={textareaRef}
          value={message}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full px-4 py-3 pr-12 text-sm border border-gray-300 dark:border-gray-600 
                   rounded-lg resize-none bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                   placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 
                   focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed
                   min-h-[48px] max-h-[120px] leading-5"
          rows={1}
        />
        
        {/* Character count (optional) */}
        {message.length > 200 && (
          <div className="absolute bottom-1 left-2 text-xs text-gray-400">
            {message.length}/500
          </div>
        )}
      </div>

      <motion.button
        onClick={handleSend}
        disabled={disabled || !message.trim()}
        className={`
          flex items-center justify-center w-12 h-12 rounded-lg font-medium
          transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-300
          ${!disabled && message.trim()
            ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg'
            : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
          }
        `}
        whileHover={!disabled && message.trim() ? { scale: 1.05 } : {}}
        whileTap={!disabled && message.trim() ? { scale: 0.95 } : {}}
      >
        {disabled ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <Send className="w-5 h-5" />
        )}
      </motion.button>
    </div>
  )
}

// Quick suggestion buttons component
interface QuickSuggestionsProps {
  suggestions: string[]
  onSuggestionClick: (suggestion: string) => void
  disabled?: boolean
  className?: string
}

export function QuickSuggestions({
  suggestions,
  onSuggestionClick,
  disabled = false,
  className = ''
}: QuickSuggestionsProps) {
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {suggestions.map((suggestion, index) => (
        <motion.button
          key={index}
          onClick={() => onSuggestionClick(suggestion)}
          disabled={disabled}
          className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300
                   rounded-full border border-gray-200 dark:border-gray-600 hover:bg-gray-200 
                   dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          whileHover={!disabled ? { scale: 1.02 } : {}}
          whileTap={!disabled ? { scale: 0.98 } : {}}
        >
          {suggestion}
        </motion.button>
      ))}
    </div>
  )
}