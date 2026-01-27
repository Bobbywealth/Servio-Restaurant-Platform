import React from 'react'
import { LucideIcon } from 'lucide-react'
import { motion, type HTMLMotionProps } from 'framer-motion'

export interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'ref' | 'children'> {
  variant?: 'primary' | 'secondary' | 'destructive' | 'ghost' | 'outline' | 'success' | 'orange'
  size?: 'sm' | 'md' | 'lg' | 'xl'
  icon?: LucideIcon
  iconPosition?: 'left' | 'right'
  fullWidth?: boolean
  children?: React.ReactNode
  glow?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      icon: Icon,
      iconPosition = 'left',
      fullWidth = false,
      children,
      disabled,
      className = '',
      glow = false,
      type = 'button',
      ...props
    },
    ref
  ) => {
    const baseClasses = 'inline-flex items-center justify-center font-semibold rounded-2xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-transparent'

    const variants = {
      primary: 'bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white shadow-lg hover:shadow-xl focus:ring-primary-500 disabled:hover:from-primary-500 disabled:hover:to-primary-600',
      secondary: 'bg-gradient-to-r from-surface-100 to-surface-200 hover:from-surface-200 hover:to-surface-300 dark:from-surface-700 dark:to-surface-800 dark:hover:from-surface-600 dark:hover:to-surface-700 text-surface-900 dark:text-surface-100 shadow-sm hover:shadow-md focus:ring-surface-500',
      destructive: 'bg-gradient-to-r from-servio-red-500 to-servio-red-600 hover:from-servio-red-600 hover:to-servio-red-700 text-white shadow-lg hover:shadow-xl focus:ring-servio-red-500 disabled:hover:from-servio-red-500 disabled:hover:to-servio-red-600',
      ghost: 'bg-transparent hover:bg-surface-100 dark:hover:bg-surface-800 text-surface-700 dark:text-surface-300 focus:ring-surface-500',
      outline: 'border-2 border-surface-300 dark:border-surface-600 hover:bg-surface-50 dark:hover:bg-surface-800 text-surface-700 dark:text-surface-300 focus:ring-surface-500',
      success: 'bg-gradient-to-r from-servio-green-500 to-servio-green-600 hover:from-servio-green-600 hover:to-servio-green-700 text-white shadow-lg hover:shadow-xl focus:ring-servio-green-500 disabled:hover:from-servio-green-500 disabled:hover:to-servio-green-600',
      orange: 'bg-gradient-to-r from-servio-orange-500 to-servio-orange-600 hover:from-servio-orange-400 hover:to-servio-orange-500 text-white shadow-lg hover:shadow-xl focus:ring-servio-orange-500 disabled:hover:from-servio-orange-500 disabled:hover:to-servio-orange-600',
    }

    const sizes = {
      sm: 'px-4 py-2 text-sm gap-2',
      md: 'px-5 py-2.5 text-sm gap-2.5',
      lg: 'px-6 py-3 text-base gap-3',
      xl: 'px-8 py-4 text-lg gap-3'
    }

    const iconSizes = {
      sm: 'w-4 h-4',
      md: 'w-5 h-5',
      lg: 'w-5 h-5',
      xl: 'w-6 h-6'
    }

    return (
      <motion.button
        ref={ref}
        whileHover={{ scale: disabled ? 1 : 1.02 }}
        whileTap={{ scale: disabled ? 1 : 0.98 }}
        className={`
          ${baseClasses}
          ${variants[variant]}
          ${sizes[size]}
          ${fullWidth ? 'w-full' : ''}
          ${glow ? 'shadow-glow' : ''}
          ${className}
        `}
        disabled={disabled}
        type={type}
        {...props}
      >
        {Icon && iconPosition === 'left' && <Icon className={iconSizes[size]} />}
        {children}
        {Icon && iconPosition === 'right' && <Icon className={iconSizes[size]} />}
      </motion.button>
    )
  }
)

Button.displayName = 'Button'

export default Button
