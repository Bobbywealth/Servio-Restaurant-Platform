import React from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Shield, Clock, Award, Users, CheckCircle2, Star, TrendingUp, Zap } from 'lucide-react'

export interface TrustSignalsProps {
  variant?: 'compact' | 'full' | 'minimal'
  className?: string
}

interface TrustItem {
  icon: React.ElementType
  label: string
  value: string
  color: string
}

const trustItems: TrustItem[] = [
  {
    icon: Users,
    label: 'Active Restaurants',
    value: '200+',
    color: 'text-primary-400',
  },
  {
    icon: Star,
    label: 'Average Rating',
    value: '4.9/5',
    color: 'text-yellow-400',
  },
  {
    icon: Clock,
    label: 'Time Saved Weekly',
    value: '15+ hrs',
    color: 'text-servio-green-400',
  },
  {
    icon: TrendingUp,
    label: 'Revenue Increase',
    value: '23%',
    color: 'text-servio-orange-400',
  },
]

const certifications = [
  { name: 'SOC 2 Type II', icon: Shield },
  { name: 'GDPR Compliant', icon: CheckCircle2 },
  { name: '99.9% Uptime', icon: Zap },
  { name: '24/7 Support', icon: Award },
]

/**
 * TrustSignals Component
 * 
 * Displays trust indicators to improve conversion rates:
 * - User statistics
 * - Ratings and reviews
 * - Certifications and compliance
 * - Performance metrics
 * 
 * Best practices:
 * - Use real, verifiable numbers
 * - Keep metrics up-to-date
 * - Include recognizable certifications
 * - Show social proof prominently
 */
export function TrustSignals({ variant = 'full', className = '' }: TrustSignalsProps) {
  const shouldReduceMotion = useReducedMotion()

  if (variant === 'minimal') {
    return (
      <div className={`flex items-center justify-center gap-6 py-4 ${className}`}>
        {trustItems.slice(0, 3).map((item, index) => (
          <div key={index} className="flex items-center gap-2">
            <item.icon className={`w-5 h-5 ${item.color}`} aria-hidden="true" />
            <span className="text-white font-semibold">{item.value}</span>
            <span className="text-gray-400 text-sm hidden sm:inline">{item.label}</span>
          </div>
        ))}
      </div>
    )
  }

  if (variant === 'compact') {
    return (
      <div className={`bg-gray-800/50 border border-white/10 rounded-2xl p-6 ${className}`}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {trustItems.map((item, index) => (
            <motion.div
              key={index}
              className="text-center"
              initial={shouldReduceMotion ? undefined : { opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
            >
              <item.icon className={`w-8 h-8 ${item.color} mx-auto mb-2`} aria-hidden="true" />
              <div className="text-2xl font-bold text-white">{item.value}</div>
              <div className="text-sm text-gray-400">{item.label}</div>
            </motion.div>
          ))}
        </div>
      </div>
    )
  }

  // Full variant
  return (
    <section className={`py-16 bg-gray-800/30 ${className}`} aria-label="Trust indicators">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          {trustItems.map((item, index) => (
            <motion.div
              key={index}
              className="text-center"
              initial={shouldReduceMotion ? undefined : { opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
            >
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/5 border border-white/10 mb-4">
                <item.icon className={`w-7 h-7 ${item.color}`} aria-hidden="true" />
              </div>
              <div className="text-3xl md:text-4xl font-bold text-white mb-1">{item.value}</div>
              <div className="text-gray-400">{item.label}</div>
            </motion.div>
          ))}
        </div>

        {/* Certifications Bar */}
        <div className="flex flex-wrap items-center justify-center gap-6 md:gap-12 pt-8 border-t border-white/10">
          {certifications.map((cert, index) => (
            <motion.div
              key={index}
              className="flex items-center gap-2 text-gray-300"
              initial={shouldReduceMotion ? undefined : { opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4 + index * 0.1 }}
            >
              <cert.icon className="w-5 h-5 text-primary-400" aria-hidden="true" />
              <span className="text-sm font-medium">{cert.name}</span>
            </motion.div>
          ))}
        </div>

        {/* Customer Logos (placeholder) */}
        <div className="mt-12 text-center">
          <p className="text-gray-500 text-sm mb-6">Trusted by leading restaurants nationwide</p>
          <div className="flex flex-wrap items-center justify-center gap-8 opacity-50">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="w-24 h-8 bg-white/10 rounded-lg flex items-center justify-center"
                aria-hidden="true"
              >
                <span className="text-xs text-gray-400">Logo {i}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

export default TrustSignals
