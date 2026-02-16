/**
 * A/B Testing Infrastructure
 * Provides utilities for running experiments and tracking results
 * 
 * A/B testing can improve conversion rates by 25-60% when properly implemented
 */

import { useState, useEffect, useCallback, useMemo } from 'react'

// ============================================================================
// Types
// ============================================================================

type ExperimentId = string
type VariantId = string

interface Experiment {
  id: ExperimentId
  name: string
  variants: Variant[]
  active: boolean
  startDate?: Date
  endDate?: Date
  targeting?: TargetingRule[]
}

interface Variant {
  id: VariantId
  name: string
  weight: number // Percentage weight for traffic allocation
  data?: Record<string, any>
}

interface TargetingRule {
  type: 'device' | 'browser' | 'country' | 'userType' | 'custom'
  value: string | string[]
  operator: 'equals' | 'contains' | 'startsWith' | 'endsWith'
}

interface ExperimentResult {
  experimentId: ExperimentId
  variantId: VariantId
  timestamp: number
  event: 'exposure' | 'conversion' | 'custom'
  data?: Record<string, any>
}

// ============================================================================
// Storage Keys
// ============================================================================

const STORAGE_PREFIX = 'servio_exp_'
const getStorageKey = (experimentId: ExperimentId) => `${STORAGE_PREFIX}${experimentId}`

// ============================================================================
// Experiment Definitions
// ============================================================================

export const EXPERIMENTS: Record<string, Experiment> = {
  homepage_cta_color: {
    id: 'homepage_cta_color',
    name: 'Homepage CTA Button Color',
    active: true,
    variants: [
      { id: 'primary', name: 'Primary Teal', weight: 50 },
      { id: 'orange', name: 'Orange', weight: 50 }
    ]
  },
  
  pricing_display: {
    id: 'pricing_display',
    name: 'Pricing Display Format',
    active: true,
    variants: [
      { id: 'monthly', name: 'Monthly Price First', weight: 50 },
      { id: 'annual', name: 'Annual Price First', weight: 50 }
    ]
  },
  
  hero_copy: {
    id: 'hero_copy',
    name: 'Hero Section Copy',
    active: true,
    variants: [
      { id: 'benefit', name: 'Benefit-Focused', weight: 50, data: {
        headline: 'Cut Staff Training Time in Half',
        subheadline: 'While boosting orders by 30%'
      }},
      { id: 'feature', name: 'Feature-Focused', weight: 50, data: {
        headline: 'Restaurant Operating System',
        subheadline: 'Voice-first operations for modern restaurants'
      }}
    ]
  },
  
  checkout_flow: {
    id: 'checkout_flow',
    name: 'Checkout Flow Steps',
    active: true,
    variants: [
      { id: 'single_page', name: 'Single Page Checkout', weight: 50 },
      { id: 'multi_step', name: 'Multi-Step Checkout', weight: 50 }
    ]
  },
  
  trial_length: {
    id: 'trial_length',
    name: 'Free Trial Length Messaging',
    active: true,
    variants: [
      { id: '14_day', name: '14-Day Trial', weight: 50, data: { days: 14 } },
      { id: '21_day', name: '21-Day Trial', weight: 50, data: { days: 21 } }
    ]
  }
}

// ============================================================================
// Assignment Logic
// ============================================================================

/**
 * Get a deterministic variant assignment based on experiment and user ID
 * Uses a simple hash function to ensure consistent assignment
 */
function getVariantAssignment(
  experimentId: ExperimentId,
  variants: Variant[],
  userId?: string
): VariantId {
  // Check for stored assignment first
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(getStorageKey(experimentId))
    if (stored && variants.some(v => v.id === stored)) {
      return stored
    }
  }
  
  // Generate assignment based on weights
  const identifier = userId || getSessionId()
  const hash = hashString(`${experimentId}:${identifier}`)
  const percentage = (hash % 100) / 100
  
  let cumulative = 0
  for (const variant of variants) {
    cumulative += variant.weight / 100
    if (percentage <= cumulative) {
      // Store assignment
      if (typeof window !== 'undefined') {
        localStorage.setItem(getStorageKey(experimentId), variant.id)
      }
      return variant.id
    }
  }
  
  // Fallback to first variant
  return variants[0].id
}

/**
 * Simple string hash function
 */
function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash)
}

/**
 * Get or create a session ID for anonymous users
 */
function getSessionId(): string {
  if (typeof window === 'undefined') return 'server'
  
  const key = 'servio_session_id'
  let sessionId = sessionStorage.getItem(key)
  
  if (!sessionId) {
    sessionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    sessionStorage.setItem(key, sessionId)
  }
  
  return sessionId
}

// ============================================================================
// Tracking
// ============================================================================

interface TrackingEvent {
  event: string
  experimentId: ExperimentId
  variantId: VariantId
  timestamp: number
  [key: string]: any
}

/**
 * Track an experiment event
 */
function trackExperimentEvent(
  event: TrackingEvent
): void {
  if (typeof window === 'undefined') return
  
  // Send to analytics
  if ((window as any).dataLayer) {
    (window as any).dataLayer.push({
      ...event,
      event: 'experiment_event'
    })
  }
  
  // Send to backend
  fetch('/api/analytics/experiment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(event),
    keepalive: true
  }).catch(() => {
    // Silent fail - don't impact user experience
  })
  
  // Log in development
  if (process.env.NODE_ENV === 'development') {
    console.log('[A/B Test]', event)
  }
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Main hook for using experiments
 */
export function useExperiment(
  experimentId: ExperimentId
): {
  variant: VariantId
  data: Record<string, any> | undefined
  trackExposure: () => void
  trackConversion: (value?: number) => void
  trackEvent: (eventName: string, data?: Record<string, any>) => void
  isVariant: (variantId: VariantId) => boolean
} {
  const [variant, setVariant] = useState<VariantId>('')
  const [data, setData] = useState<Record<string, any> | undefined>()
  
  // Get experiment config
  const experiment = EXPERIMENTS[experimentId]
  
  useEffect(() => {
    if (!experiment || !experiment.active) {
      setVariant('control')
      return
    }
    
    const assignedVariant = getVariantAssignment(
      experimentId,
      experiment.variants
    )
    
    setVariant(assignedVariant)
    
    // Get variant data
    const variantConfig = experiment.variants.find(v => v.id === assignedVariant)
    setData(variantConfig?.data)
  }, [experimentId, experiment])
  
  // Track exposure
  const trackExposure = useCallback(() => {
    if (!variant) return
    
    trackExperimentEvent({
      event: 'experiment_exposure',
      experimentId,
      variantId: variant,
      timestamp: Date.now()
    })
  }, [experimentId, variant])
  
  // Track conversion
  const trackConversion = useCallback((value?: number) => {
    if (!variant) return
    
    trackExperimentEvent({
      event: 'experiment_conversion',
      experimentId,
      variantId: variant,
      timestamp: Date.now(),
      value
    })
  }, [experimentId, variant])
  
  // Track custom event
  const trackEvent = useCallback((eventName: string, eventData?: Record<string, any>) => {
    if (!variant) return
    
    trackExperimentEvent({
      event: eventName,
      experimentId,
      variantId: variant,
      timestamp: Date.now(),
      ...eventData
    })
  }, [experimentId, variant])
  
  // Check if current variant matches
  const isVariant = useCallback((variantId: VariantId) => {
    return variant === variantId
  }, [variant])
  
  return {
    variant,
    data,
    trackExposure,
    trackConversion,
    trackEvent,
    isVariant
  }
}

/**
 * Hook for running multiple experiments at once
 */
export function useExperiments(
  experimentIds: ExperimentId[]
): Record<ExperimentId, {
  variant: VariantId
  data: Record<string, any> | undefined
  isVariant: (variantId: VariantId) => boolean
}> {
  const results = useMemo(() => {
    const acc: Record<string, any> = {}
    
    for (const id of experimentIds) {
      const experiment = EXPERIMENTS[id]
      if (!experiment || !experiment.active) {
        acc[id] = { variant: 'control', data: undefined, isVariant: () => false }
        continue
      }
      
      const variantId = getVariantAssignment(id, experiment.variants)
      const variantConfig = experiment.variants.find(v => v.id === variantId)
      
      acc[id] = {
        variant: variantId,
        data: variantConfig?.data,
        isVariant: (v: VariantId) => variantId === v
      }
    }
    
    return acc
  }, [experimentIds.join(',')])
  
  return results
}

/**
 * Hook for feature flags (simple on/off experiments)
 */
export function useFeatureFlag(
  flagName: string,
  defaultValue: boolean = false
): boolean {
  const [enabled, setEnabled] = useState(defaultValue)
  
  useEffect(() => {
    const experiment = EXPERIMENTS[flagName]
    
    if (!experiment || !experiment.active) {
      setEnabled(defaultValue)
      return
    }
    
    const variant = getVariantAssignment(flagName, experiment.variants)
    setEnabled(variant === 'enabled')
  }, [flagName, defaultValue])
  
  return enabled
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get all active experiments
 */
export function getActiveExperiments(): Experiment[] {
  return Object.values(EXPERIMENTS).filter(e => e.active)
}

/**
 * Check if user is in a specific variant
 */
export function isInVariant(
  experimentId: ExperimentId,
  variantId: VariantId
): boolean {
  const experiment = EXPERIMENTS[experimentId]
  if (!experiment || !experiment.active) return false
  
  const assigned = getVariantAssignment(experimentId, experiment.variants)
  return assigned === variantId
}

/**
 * Force a specific variant (for testing)
 */
export function forceVariant(
  experimentId: ExperimentId,
  variantId: VariantId
): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(getStorageKey(experimentId), variantId)
}

/**
 * Clear all experiment assignments
 */
export function clearAllExperiments(): void {
  if (typeof window === 'undefined') return
  
  Object.keys(localStorage).forEach(key => {
    if (key.startsWith(STORAGE_PREFIX)) {
      localStorage.removeItem(key)
    }
  })
}

// ============================================================================
// Debug Panel Component (Development Only)
// ============================================================================

export function ExperimentDebugPanel() {
  const [isOpen, setIsOpen] = useState(false)
  const [assignments, setAssignments] = useState<Record<string, string>>({})
  
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return
    
    const acc: Record<string, string> = {}
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith(STORAGE_PREFIX)) {
        acc[key.replace(STORAGE_PREFIX, '')] = localStorage.getItem(key) || ''
      }
    })
    setAssignments(acc)
  }, [isOpen])
  
  if (process.env.NODE_ENV !== 'development') return null
  
  return (
    <div className="fixed bottom-4 right-4 z-50">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-purple-600 text-white p-2 rounded-full shadow-lg"
      >
        🧪
      </button>
      
      {isOpen && (
        <div className="absolute bottom-12 right-0 bg-white rounded-lg shadow-xl p-4 w-80">
          <h3 className="font-bold mb-2">Active Experiments</h3>
          <div className="space-y-2 text-sm">
            {Object.entries(assignments).map(([exp, variant]) => (
              <div key={exp} className="flex justify-between">
                <span className="text-gray-600">{exp}:</span>
                <span className="font-mono bg-gray-100 px-2 rounded">{variant}</span>
              </div>
            ))}
            {Object.keys(assignments).length === 0 && (
              <p className="text-gray-500">No active experiments</p>
            )}
          </div>
          <button
            onClick={() => {
              clearAllExperiments()
              setAssignments({})
            }}
            className="mt-4 w-full bg-red-100 text-red-700 py-1 rounded text-sm"
          >
            Clear All
          </button>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Export
// ============================================================================

export default {
  useExperiment,
  useExperiments,
  useFeatureFlag,
  getActiveExperiments,
  isInVariant,
  forceVariant,
  clearAllExperiments,
  EXPERIMENTS
}
