/**
 * Trust Signals Component
 * Displays social proof elements to increase conversion rates
 * 
 * Research shows trust signals can increase conversions by 34%
 */

import React from 'react'
import { motion } from 'framer-motion'
import { 
  Users, Star, Shield, Clock, Award, 
  CheckCircle, TrendingUp, Globe 
} from 'lucide-react'

// ============================================================================
// Types
// ============================================================================

interface TrustSignal {
  icon: React.ReactNode
  value: string
  label: string
  sublabel?: string
}

interface TrustSignalsProps {
  variant?: 'full' | 'compact' | 'inline'
  className?: string
}

// ============================================================================
// Animation Variants
// ============================================================================

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 24
    }
  }
}

// ============================================================================
// Default Trust Signals Data
// ============================================================================

const DEFAULT_SIGNALS: TrustSignal[] = [
  {
    icon: <Users className="w-5 h-5" />,
    value: '500+',
    label: 'Restaurants',
    sublabel: 'Trust Servio daily'
  },
  {
    icon: <Star className="w-5 h-5" />,
    value: '4.9/5',
    label: 'Average Rating',
    sublabel: 'From 150+ reviews'
  },
  {
    icon: <Shield className="w-5 h-5" />,
    value: '99.9%',
    label: 'Uptime',
    sublabel: 'Enterprise-grade reliability'
  },
  {
    icon: <Clock className="w-5 h-5" />,
    value: '24/7',
    label: 'Support',
    sublabel: 'Always here to help'
  },
  {
    icon: <TrendingUp className="w-5 h-5" />,
    value: '30%',
    label: 'More Orders',
    sublabel: 'Average increase'
  },
  {
    icon: <Globe className="w-5 h-5" />,
    value: '15+',
    label: 'Countries',
    sublabel: 'Worldwide presence'
  }
]

// ============================================================================
// Full Variant Component
// ============================================================================

export function TrustSignalsFull({ 
  signals = DEFAULT_SIGNALS,
  className = '' 
}: { signals?: TrustSignal[]; className?: string }) {
  return (
    <motion.section
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-100px' }}
      variants={containerVariants}
      className={`py-12 ${className}`}
      aria-label="Trust signals"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div 
          variants={itemVariants}
          className="text-center mb-8"
        >
          <h2 className="text-lg font-medium text-gray-400 mb-2">
            Trusted by restaurants worldwide
          </h2>
        </motion.div>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
          {signals.map((signal, index) => (
            <motion.div
              key={index}
              variants={itemVariants}
              className="flex flex-col items-center text-center p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
            >
              <div className="w-12 h-12 rounded-full bg-primary-500/10 flex items-center justify-center text-primary-500 mb-3">
                {signal.icon}
              </div>
              <div className="text-2xl font-bold text-white mb-1">
                {signal.value}
              </div>
              <div className="text-sm font-medium text-gray-300">
                {signal.label}
              </div>
              {signal.sublabel && (
                <div className="text-xs text-gray-500 mt-1">
                  {signal.sublabel}
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </motion.section>
  )
}

// ============================================================================
// Compact Variant Component
// ============================================================================

export function TrustSignalsCompact({ 
  className = '' 
}: TrustSignalsProps) {
  return (
    <div 
      className={`flex flex-wrap items-center justify-center gap-6 md:gap-8 py-6 ${className}`}
      role="group"
      aria-label="Trust signals"
    >
      <div className="flex items-center gap-2">
        <Users className="w-5 h-5 text-primary-500" />
        <span className="font-semibold text-white">500+ Restaurants</span>
      </div>
      
      <div className="flex items-center gap-2">
        <div className="flex" aria-label="5 star rating">
          {[...Array(5)].map((_, i) => (
            <Star 
              key={i} 
              className="w-4 h-4 text-yellow-400 fill-current" 
            />
          ))}
        </div>
        <span className="font-semibold text-white">4.9/5</span>
      </div>
      
      <div className="flex items-center gap-2">
        <Shield className="w-5 h-5 text-green-500" />
        <span className="font-semibold text-white">99.9% Uptime</span>
      </div>
      
      <div className="flex items-center gap-2">
        <Award className="w-5 h-5 text-servio-orange-500" />
        <span className="font-semibold text-white">SOC 2 Compliant</span>
      </div>
    </div>
  )
}

// ============================================================================
// Inline Variant Component
// ============================================================================

export function TrustSignalsInline({ 
  className = '' 
}: TrustSignalsProps) {
  return (
    <div 
      className={`flex items-center gap-4 text-sm text-gray-400 ${className}`}
      role="group"
      aria-label="Trust signals"
    >
      <span className="flex items-center gap-1">
        <CheckCircle className="w-4 h-4 text-green-500" />
        Free 14-day trial
      </span>
      <span className="hidden sm:inline">•</span>
      <span className="hidden sm:flex items-center gap-1">
        <CheckCircle className="w-4 h-4 text-green-500" />
        No credit card required
      </span>
      <span className="hidden md:inline">•</span>
      <span className="hidden md:flex items-center gap-1">
        <CheckCircle className="w-4 h-4 text-green-500" />
        Cancel anytime
      </span>
    </div>
  )
}

// ============================================================================
// Client Logos Component
// ============================================================================

interface ClientLogosProps {
  className?: string
}

export function ClientLogos({ className = '' }: ClientLogosProps) {
  // Placeholder logos - replace with actual client logos
  const logos = [
    { name: 'Restaurant 1', src: '/images/clients/client1.svg' },
    { name: 'Restaurant 2', src: '/images/clients/client2.svg' },
    { name: 'Restaurant 3', src: '/images/clients/client3.svg' },
    { name: 'Restaurant 4', src: '/images/clients/client4.svg' },
    { name: 'Restaurant 5', src: '/images/clients/client5.svg' },
  ]

  return (
    <div className={`py-8 ${className}`}>
      <p className="text-center text-sm text-gray-500 mb-6">
        Trusted by leading restaurants
      </p>
      <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12 opacity-60">
        {logos.map((logo, index) => (
          <div 
            key={index}
            className="h-8 w-24 bg-gray-400 rounded flex items-center justify-center text-gray-600 text-xs"
          >
            {logo.name}
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================================================
// Rating Stars Component
// ============================================================================

interface RatingStarsProps {
  rating: number
  maxRating?: number
  showValue?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function RatingStars({ 
  rating, 
  maxRating = 5, 
  showValue = true,
  size = 'md',
  className = '' 
}: RatingStarsProps) {
  const sizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  }

  return (
    <div 
      className={`flex items-center gap-1 ${className}`}
      role="img"
      aria-label={`${rating} out of ${maxRating} stars`}
    >
      {[...Array(maxRating)].map((_, i) => (
        <Star
          key={i}
          className={`${sizeClasses[size]} ${
            i < Math.floor(rating)
              ? 'text-yellow-400 fill-current'
              : i < rating
                ? 'text-yellow-400 fill-current opacity-50'
                : 'text-gray-400'
          }`}
        />
      ))}
      {showValue && (
        <span className="ml-1 text-sm font-medium text-gray-300">
          {rating.toFixed(1)}
        </span>
      )}
    </div>
  )
}

// ============================================================================
// Main Export Component
// ============================================================================

export function TrustSignals({ 
  variant = 'full', 
  className = '' 
}: TrustSignalsProps) {
  switch (variant) {
    case 'compact':
      return <TrustSignalsCompact className={className} />
    case 'inline':
      return <TrustSignalsInline className={className} />
    case 'full':
    default:
      return <TrustSignalsFull className={className} />
  }
}

// ============================================================================
// Export
// ============================================================================

export default TrustSignals
