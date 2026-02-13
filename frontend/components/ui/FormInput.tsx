import React, { forwardRef, useState, useCallback, useId } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { Eye, EyeOff, CheckCircle2, AlertCircle, X } from 'lucide-react'

export interface FormInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label: string
  error?: string
  success?: string
  hint?: string
  size?: 'sm' | 'md' | 'lg'
  variant?: 'default' | 'floating' | 'filled'
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  showPasswordToggle?: boolean
  validate?: (value: string) => string | undefined
  onClear?: () => void
  required?: boolean
}

/**
 * FormInput Component
 * 
 * A fully accessible form input with:
 * - Floating label support
 * - Validation states (error, success)
 * - Password visibility toggle
 * - Left/right icons
 * - Clear button
 * - ARIA attributes
 * - Reduced motion support
 * 
 * Best practices:
 * - Always associate labels with inputs
 * - Provide clear error messages
 * - Use appropriate input types
 * - Show validation feedback
 */
export const FormInput = forwardRef<HTMLInputElement, FormInputProps>(
  (
    {
      label,
      error,
      success,
      hint,
      size = 'md',
      variant = 'default',
      leftIcon,
      rightIcon,
      showPasswordToggle = false,
      validate,
      onClear,
      required = false,
      type = 'text',
      id: providedId,
      className = '',
      value,
      defaultValue,
      onChange,
      onBlur,
      disabled,
      ...props
    },
    ref
  ) => {
    const generatedId = useId()
    const id = providedId || generatedId
    const errorId = `${id}-error`
    const hintId = `${id}-hint`
    const successId = `${id}-success`
    
    const [internalValue, setInternalValue] = useState(defaultValue?.toString() || '')
    const [isFocused, setIsFocused] = useState(false)
    const [showPassword, setShowPassword] = useState(false)
    const [touched, setTouched] = useState(false)
    const [internalError, setInternalError] = useState<string | undefined>()
    const shouldReduceMotion = useReducedMotion()
    
    const currentValue = value !== undefined ? value.toString() : internalValue
    const hasValue = currentValue.length > 0
    const displayError = error || internalError
    const isPassword = type === 'password'
    const inputType = isPassword && showPassword ? 'text' : type

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value
        
        if (value === undefined) {
          setInternalValue(newValue)
        }
        
        // Run validation
        if (validate && touched) {
          const validationError = validate(newValue)
          setInternalError(validationError)
        }
        
        onChange?.(e)
      },
      [onChange, validate, touched, value]
    )

    const handleBlur = useCallback(
      (e: React.FocusEvent<HTMLInputElement>) => {
        setIsFocused(false)
        setTouched(true)
        
        // Run validation on blur
        if (validate) {
          const validationError = validate(currentValue)
          setInternalError(validationError)
        }
        
        onBlur?.(e)
      },
      [onBlur, validate, currentValue]
    )

    const handleFocus = useCallback(() => {
      setIsFocused(true)
    }, [])

    const handleClear = useCallback(() => {
      if (value === undefined) {
        setInternalValue('')
      }
      setInternalError(undefined)
      onClear?.()
      
      // Create a synthetic event for onChange handlers
      const event = {
        target: { value: '' },
      } as React.ChangeEvent<HTMLInputElement>
      onChange?.(event)
    }, [onClear, onChange, value])

    const handlePasswordToggle = useCallback(() => {
      setShowPassword((prev) => !prev)
    }, [])

    // Size classes
    const sizeClasses = {
      sm: 'py-2 px-3 text-sm',
      md: 'py-3 px-4 text-base',
      lg: 'py-4 px-5 text-lg',
    }

    // Input state classes
    const getStateClasses = () => {
      if (disabled) {
        return 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
      }
      if (displayError) {
        return 'bg-white border-red-500 focus:border-red-500 focus:ring-red-500/20'
      }
      if (success) {
        return 'bg-white border-green-500 focus:border-green-500 focus:ring-green-500/20'
      }
      if (isFocused) {
        return 'bg-white border-primary-500 ring-4 ring-primary-500/10'
      }
      return 'bg-white border-gray-200 hover:border-gray-300'
    }

    // Floating label variant
    if (variant === 'floating') {
      return (
        <div className={`relative ${className}`}>
          <div className="relative">
            {leftIcon && (
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                {leftIcon}
              </div>
            )}
            
            <input
              ref={ref}
              id={id}
              type={inputType}
              value={currentValue}
              onChange={handleChange}
              onFocus={handleFocus}
              onBlur={handleBlur}
              disabled={disabled}
              aria-invalid={!!displayError}
              aria-describedby={`${displayError ? errorId : ''} ${hint ? hintId : ''} ${success ? successId : ''}`.trim() || undefined}
              aria-required={required}
              className={`
                w-full rounded-xl border-2 transition-all duration-200
                ${sizeClasses[size]}
                ${leftIcon ? 'pl-12' : ''}
                ${rightIcon || showPasswordToggle || onClear ? 'pr-12' : ''}
                ${getStateClasses()}
                focus:outline-none
                peer
              `}
              placeholder=" "
              {...props}
            />
            
            <label
              htmlFor={id}
              className={`
                absolute left-4 transition-all duration-200 pointer-events-none
                ${leftIcon ? 'left-12' : ''}
                ${
                  isFocused || hasValue
                    ? '-top-2.5 text-xs bg-white px-2 text-primary-600'
                    : 'top-1/2 -translate-y-1/2 text-gray-500'
                }
                ${displayError ? 'text-red-500' : ''}
                ${success ? 'text-green-500' : ''}
                ${disabled ? 'text-gray-400' : ''}
              `}
            >
              {label}
              {required && <span className="text-red-500 ml-1">*</span>}
            </label>

            {/* Right side icons */}
            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
              {displayError && (
                <AlertCircle className="w-5 h-5 text-red-500" aria-hidden="true" />
              )}
              {success && !displayError && (
                <CheckCircle2 className="w-5 h-5 text-green-500" aria-hidden="true" />
              )}
              {isPassword && showPasswordToggle && (
                <button
                  type="button"
                  onClick={handlePasswordToggle}
                  className="p-1 text-gray-400 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              )}
              {onClear && hasValue && !disabled && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="p-1 text-gray-400 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
                  aria-label="Clear input"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              {rightIcon && !showPasswordToggle && (
                <div className="text-gray-400">{rightIcon}</div>
              )}
            </div>
          </div>

          {/* Error message */}
          <AnimatePresence mode="wait">
            {displayError && (
              <motion.p
                id={errorId}
                initial={shouldReduceMotion ? undefined : { opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduceMotion ? undefined : { opacity: 0, y: -10 }}
                className="mt-2 text-sm text-red-500 flex items-center gap-1"
                role="alert"
              >
                {displayError}
              </motion.p>
            )}
          </AnimatePresence>

          {/* Success message */}
          <AnimatePresence mode="wait">
            {success && !displayError && (
              <motion.p
                id={successId}
                initial={shouldReduceMotion ? undefined : { opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduceMotion ? undefined : { opacity: 0, y: -10 }}
                className="mt-2 text-sm text-green-500 flex items-center gap-1"
              >
                <CheckCircle2 className="w-4 h-4" />
                {success}
              </motion.p>
            )}
          </AnimatePresence>

          {/* Hint */}
          {hint && !displayError && !success && (
            <p id={hintId} className="mt-2 text-sm text-gray-500">
              {hint}
            </p>
          )}
        </div>
      )
    }

    // Default and filled variants
    return (
      <div className={`${className}`}>
        <label
          htmlFor={id}
          className={`
            block font-medium mb-2
            ${displayError ? 'text-red-500' : 'text-gray-700'}
            ${disabled ? 'text-gray-400' : ''}
            ${size === 'sm' ? 'text-sm' : size === 'lg' ? 'text-lg' : 'text-base'}
          `}
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>

        <div className="relative">
          {leftIcon && (
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
              {leftIcon}
            </div>
          )}

          <input
            ref={ref}
            id={id}
            type={inputType}
            value={currentValue}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            disabled={disabled}
            aria-invalid={!!displayError}
            aria-describedby={`${displayError ? errorId : ''} ${hint ? hintId : ''} ${success ? successId : ''}`.trim() || undefined}
            aria-required={required}
            className={`
              w-full rounded-xl border-2 transition-all duration-200
              ${sizeClasses[size]}
              ${leftIcon ? 'pl-12' : ''}
              ${rightIcon || showPasswordToggle || onClear ? 'pr-12' : ''}
              ${variant === 'filled' ? 'bg-gray-50' : ''}
              ${getStateClasses()}
              focus:outline-none
            `}
            {...props}
          />

          {/* Right side icons */}
          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
            {displayError && (
              <AlertCircle className="w-5 h-5 text-red-500" aria-hidden="true" />
            )}
            {success && !displayError && (
              <CheckCircle2 className="w-5 h-5 text-green-500" aria-hidden="true" />
            )}
            {isPassword && showPasswordToggle && (
              <button
                type="button"
                onClick={handlePasswordToggle}
                className="p-1 text-gray-400 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            )}
            {onClear && hasValue && !disabled && (
              <button
                type="button"
                onClick={handleClear}
                className="p-1 text-gray-400 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
                aria-label="Clear input"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            {rightIcon && !showPasswordToggle && (
              <div className="text-gray-400">{rightIcon}</div>
            )}
          </div>
        </div>

        {/* Error message */}
        <AnimatePresence mode="wait">
          {displayError && (
            <motion.p
              id={errorId}
              initial={shouldReduceMotion ? undefined : { opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={shouldReduceMotion ? undefined : { opacity: 0, y: -10 }}
              className="mt-2 text-sm text-red-500 flex items-center gap-1"
              role="alert"
            >
              {displayError}
            </motion.p>
          )}
        </AnimatePresence>

        {/* Success message */}
        <AnimatePresence mode="wait">
          {success && !displayError && (
            <motion.p
              id={successId}
              initial={shouldReduceMotion ? undefined : { opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={shouldReduceMotion ? undefined : { opacity: 0, y: -10 }}
              className="mt-2 text-sm text-green-500 flex items-center gap-1"
            >
              <CheckCircle2 className="w-4 h-4" />
              {success}
            </motion.p>
          )}
        </AnimatePresence>

        {/* Hint */}
        {hint && !displayError && !success && (
          <p id={hintId} className="mt-2 text-sm text-gray-500">
            {hint}
          </p>
        )}
      </div>
    )
  }
)

FormInput.displayName = 'FormInput'

export default FormInput
