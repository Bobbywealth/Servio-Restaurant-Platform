/**
 * Form Input Component with Validation
 * Provides accessible, validated form inputs with inline error display
 * 
 * Single-column layouts with inline validation increase completion by 27%
 */

import React, { forwardRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertCircle, CheckCircle, Eye, EyeOff, X } from 'lucide-react'

// ============================================================================
// Types
// ============================================================================

type InputType = 'text' | 'email' | 'password' | 'tel' | 'number' | 'url' | 'search'

interface ValidationRule {
  rule: (value: string) => boolean
  message: string
}

interface FormInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /** Input label */
  label: string
  /** Error message */
  error?: string
  /** Whether the field has been touched */
  touched?: boolean
  /** Success state */
  success?: boolean
  /** Helper text shown below input */
  helperText?: string
  /** Validation rules */
  validationRules?: ValidationRule[]
  /** Size variant */
  size?: 'sm' | 'md' | 'lg'
  /** Variant style */
  variant?: 'default' | 'filled' | 'underline'
  /** Left icon */
  leftIcon?: React.ReactNode
  /** Right icon */
  rightIcon?: React.ReactNode
  /** Show password toggle for type='password' */
  showPasswordToggle?: boolean
  /** Clear button */
  showClearButton?: boolean
  /** onClear callback */
  onClear?: () => void
  /** Additional container className */
  containerClassName?: string
}

// ============================================================================
// Validation Rules
// ============================================================================

export const validationRules = {
  required: (message = 'This field is required'): ValidationRule => ({
    rule: (value) => value.trim().length > 0,
    message
  }),
  
  email: (message = 'Please enter a valid email'): ValidationRule => ({
    rule: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    message
  }),
  
  minLength: (length: number, message?: string): ValidationRule => ({
    rule: (value) => value.length >= length,
    message: message || `Must be at least ${length} characters`
  }),
  
  maxLength: (length: number, message?: string): ValidationRule => ({
    rule: (value) => value.length <= length,
    message: message || `Must be no more than ${length} characters`
  }),
  
  pattern: (regex: RegExp, message: string): ValidationRule => ({
    rule: (value) => regex.test(value),
    message
  }),
  
  phone: (message = 'Please enter a valid phone number'): ValidationRule => ({
    rule: (value) => /^[\d\s\-+()]{10,}$/.test(value),
    message
  }),
  
  url: (message = 'Please enter a valid URL'): ValidationRule => ({
    rule: (value) => {
      try {
        new URL(value)
        return true
      } catch {
        return false
      }
    },
    message
  }),
  
  match: (otherValue: string, message = 'Values do not match'): ValidationRule => ({
    rule: (value) => value === otherValue,
    message
  })
}

// ============================================================================
// Component
// ============================================================================

export const FormInput = forwardRef<HTMLInputElement, FormInputProps>(({
  label,
  error,
  touched,
  success,
  helperText,
  validationRules: rules,
  size = 'md',
  variant = 'default',
  leftIcon,
  rightIcon,
  showPasswordToggle = true,
  showClearButton = false,
  onClear,
  containerClassName = '',
  className = '',
  type: initialType,
  id,
  disabled,
  ...props
}, ref) => {
  const [isFocused, setIsFocused] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [internalError, setInternalError] = useState<string | undefined>()
  
  const inputId = id || `input-${label.toLowerCase().replace(/\s+/g, '-')}`
  const errorId = `${inputId}-error`
  const helperId = `${inputId}-helper`
  
  const type = initialType === 'password' && showPassword ? 'text' : initialType
  
  // Validate on change if rules provided
  const validate = useCallback((value: string) => {
    if (!rules) return undefined
    for (const { rule, message } of rules) {
      if (!rule(value)) {
        return message
      }
    }
    return undefined
  }, [rules])
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (rules) {
      setInternalError(validate(e.target.value))
    }
    props.onChange?.(e)
  }
  
  const displayError = error || internalError
  const showError = touched && displayError
  const showSuccess = success || (touched && !displayError && props.value)
  
  // Size classes
  const sizeClasses = {
    sm: 'py-2 px-3 text-sm',
    md: 'py-2.5 px-4 text-base',
    lg: 'py-3 px-5 text-lg'
  }
  
  // Variant classes
  const variantClasses = {
    default: `bg-gray-800 border ${
      showError ? 'border-red-500' : showSuccess ? 'border-green-500' : isFocused ? 'border-primary-500' : 'border-gray-700'
    } rounded-xl`,
    filled: `bg-gray-800 border-0 rounded-xl ${isFocused ? 'ring-2 ring-primary-500' : ''}`,
    underline: `bg-transparent border-0 border-b-2 ${
      showError ? 'border-red-500' : showSuccess ? 'border-green-500' : isFocused ? 'border-primary-500' : 'border-gray-700'
    } rounded-none px-0`
  }
  
  return (
    <div className={`space-y-1.5 ${containerClassName}`}>
      {/* Label */}
      <label
        htmlFor={inputId}
        className={`block text-sm font-medium ${
          disabled ? 'text-gray-500' : 'text-gray-300'
        }`}
      >
        {label}
        {props.required && <span className="text-red-500 ml-1">*</span>}
      </label>
      
      {/* Input wrapper */}
      <div className="relative">
        {/* Left icon */}
        {leftIcon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
            {leftIcon}
          </div>
        )}
        
        {/* Input */}
        <input
          ref={ref}
          id={inputId}
          type={type}
          disabled={disabled}
          className={`
            w-full text-white placeholder-gray-500
            focus:outline-none focus:ring-0
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-colors duration-200
            ${sizeClasses[size]}
            ${variantClasses[variant]}
            ${leftIcon ? 'pl-10' : ''}
            ${rightIcon || (initialType === 'password' && showPasswordToggle) || showClearButton ? 'pr-10' : ''}
            ${className}
          `}
          aria-invalid={showError}
          aria-describedby={`${showError ? errorId : ''} ${helperText ? helperId : ''}`}
          onFocus={(e) => {
            setIsFocused(true)
            props.onFocus?.(e)
          }}
          onBlur={(e) => {
            setIsFocused(false)
            props.onBlur?.(e)
          }}
          onChange={handleChange}
          {...props}
        />
        
        {/* Right icons container */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {/* Success indicator */}
          {showSuccess && !showError && (
            <CheckCircle className="w-5 h-5 text-green-500" />
          )}
          
          {/* Error indicator */}
          {showError && (
            <AlertCircle className="w-5 h-5 text-red-500" />
          )}
          
          {/* Password toggle */}
          {initialType === 'password' && showPasswordToggle && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="text-gray-500 hover:text-gray-300 transition-colors p-1"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <EyeOff className="w-5 h-5" />
              ) : (
                <Eye className="w-5 h-5" />
              )}
            </button>
          )}
          
          {/* Clear button */}
          {showClearButton && props.value && !disabled && (
            <button
              type="button"
              onClick={() => {
                onClear?.()
              }}
              className="text-gray-500 hover:text-gray-300 transition-colors p-1"
              aria-label="Clear input"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          
          {/* Custom right icon */}
          {rightIcon && (
            <span className="text-gray-500">{rightIcon}</span>
          )}
        </div>
      </div>
      
      {/* Error message */}
      <AnimatePresence mode="wait">
        {showError && displayError && (
          <motion.p
            key="error"
            initial={{ opacity: 0, y: -10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -10, height: 0 }}
            transition={{ duration: 0.2 }}
            id={errorId}
            className="text-red-500 text-sm flex items-center gap-1"
            role="alert"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{displayError}</span>
          </motion.p>
        )}
      </AnimatePresence>
      
      {/* Helper text */}
      {helperText && !showError && (
        <p
          id={helperId}
          className="text-gray-500 text-sm"
        >
          {helperText}
        </p>
      )}
    </div>
  )
})

FormInput.displayName = 'FormInput'

// ============================================================================
// Textarea Variant
// ============================================================================

interface FormTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string
  error?: string
  touched?: boolean
  success?: boolean
  helperText?: string
  containerClassName?: string
}

export const FormTextarea = forwardRef<HTMLTextAreaElement, FormTextareaProps>(({
  label,
  error,
  touched,
  success,
  helperText,
  containerClassName = '',
  className = '',
  id,
  disabled,
  ...props
}, ref) => {
  const [isFocused, setIsFocused] = useState(false)
  
  const inputId = id || `textarea-${label.toLowerCase().replace(/\s+/g, '-')}`
  const errorId = `${inputId}-error`
  const helperId = `${inputId}-helper`
  
  const showError = touched && error
  const showSuccess = success || (touched && !error && props.value)
  
  return (
    <div className={`space-y-1.5 ${containerClassName}`}>
      <label
        htmlFor={inputId}
        className={`block text-sm font-medium ${
          disabled ? 'text-gray-500' : 'text-gray-300'
        }`}
      >
        {label}
        {props.required && <span className="text-red-500 ml-1">*</span>}
      </label>
      
      <div className="relative">
        <textarea
          ref={ref}
          id={inputId}
          disabled={disabled}
          className={`
            w-full py-2.5 px-4 text-base text-white placeholder-gray-500
            bg-gray-800 border rounded-xl
            focus:outline-none focus:ring-0
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-colors duration-200
            ${showError ? 'border-red-500' : showSuccess ? 'border-green-500' : isFocused ? 'border-primary-500' : 'border-gray-700'}
            ${className}
          `}
          aria-invalid={showError}
          aria-describedby={`${showError ? errorId : ''} ${helperText ? helperId : ''}`}
          onFocus={(e) => {
            setIsFocused(true)
            props.onFocus?.(e)
          }}
          onBlur={(e) => {
            setIsFocused(false)
            props.onBlur?.(e)
          }}
          {...props}
        />
        
        {/* Character count */}
        {props.maxLength && (
          <div className="absolute bottom-2 right-3 text-xs text-gray-500">
            {String(props.value || '').length}/{props.maxLength}
          </div>
        )}
      </div>
      
      <AnimatePresence mode="wait">
        {showError && error && (
          <motion.p
            key="error"
            initial={{ opacity: 0, y: -10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -10, height: 0 }}
            transition={{ duration: 0.2 }}
            id={errorId}
            className="text-red-500 text-sm flex items-center gap-1"
            role="alert"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </motion.p>
        )}
      </AnimatePresence>
      
      {helperText && !showError && (
        <p id={helperId} className="text-gray-500 text-sm">
          {helperText}
        </p>
      )}
    </div>
  )
})

FormTextarea.displayName = 'FormTextarea'

// ============================================================================
// Select Variant
// ============================================================================

interface FormSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  options: { value: string; label: string; disabled?: boolean }[]
  error?: string
  touched?: boolean
  success?: boolean
  helperText?: string
  containerClassName?: string
  placeholder?: string
}

export const FormSelect = forwardRef<HTMLSelectElement, FormSelectProps>(({
  label,
  options,
  error,
  touched,
  success,
  helperText,
  containerClassName = '',
  className = '',
  id,
  disabled,
  placeholder,
  ...props
}, ref) => {
  const [isFocused, setIsFocused] = useState(false)
  
  const inputId = id || `select-${label.toLowerCase().replace(/\s+/g, '-')}`
  const errorId = `${inputId}-error`
  const helperId = `${inputId}-helper`
  
  const showError = touched && error
  const showSuccess = success || (touched && !error && props.value)
  
  return (
    <div className={`space-y-1.5 ${containerClassName}`}>
      <label
        htmlFor={inputId}
        className={`block text-sm font-medium ${
          disabled ? 'text-gray-500' : 'text-gray-300'
        }`}
      >
        {label}
        {props.required && <span className="text-red-500 ml-1">*</span>}
      </label>
      
      <select
        ref={ref}
        id={inputId}
        disabled={disabled}
        className={`
          w-full py-2.5 px-4 text-base text-white
          bg-gray-800 border rounded-xl
          focus:outline-none focus:ring-0
          disabled:opacity-50 disabled:cursor-not-allowed
          transition-colors duration-200
          appearance-none cursor-pointer
          ${showError ? 'border-red-500' : showSuccess ? 'border-green-500' : isFocused ? 'border-primary-500' : 'border-gray-700'}
          ${className}
        `}
        aria-invalid={showError}
        aria-describedby={`${showError ? errorId : ''} ${helperText ? helperId : ''}`}
        onFocus={(e) => {
          setIsFocused(true)
          props.onFocus?.(e)
        }}
        onBlur={(e) => {
          setIsFocused(false)
          props.onBlur?.(e)
        }}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
      
      <AnimatePresence mode="wait">
        {showError && error && (
          <motion.p
            key="error"
            initial={{ opacity: 0, y: -10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -10, height: 0 }}
            transition={{ duration: 0.2 }}
            id={errorId}
            className="text-red-500 text-sm flex items-center gap-1"
            role="alert"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </motion.p>
        )}
      </AnimatePresence>
      
      {helperText && !showError && (
        <p id={helperId} className="text-gray-500 text-sm">
          {helperText}
        </p>
      )}
    </div>
  )
})

FormSelect.displayName = 'FormSelect'

// ============================================================================
// Export
// ============================================================================

export default FormInput
