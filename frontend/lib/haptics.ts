/**
 * Haptic Feedback Utilities
 * Provides visual and device haptic feedback for native app feel
 */

// Check if device supports vibration
export const supportsVibration = (): boolean => {
  return typeof window !== 'undefined' && 'vibrate' in navigator
}

// Haptic patterns (in milliseconds)
export const HapticPattern = {
  light: [10],
  medium: [20],
  heavy: [30],
  success: [10, 50, 10],
  error: [20, 50, 20, 50, 20],
  selection: [5],
  impact: [15]
} as const

export type HapticType = keyof typeof HapticPattern

/**
 * Trigger haptic feedback
 * Falls back gracefully on devices without vibration support
 */
export const triggerHaptic = (type: HapticType = 'light'): void => {
  if (supportsVibration()) {
    navigator.vibrate(HapticPattern[type])
  }
}

/**
 * Visual feedback helper
 * Adds a scale animation to an element
 */
export const addVisualFeedback = (element: HTMLElement, scale = 0.95): void => {
  element.style.transform = `scale(${scale})`
  element.style.transition = 'transform 100ms ease-out'

  setTimeout(() => {
    element.style.transform = 'scale(1)'
  }, 100)
}

/**
 * React hook for haptic feedback
 */
export const useHaptic = () => {
  const haptic = (type: HapticType = 'light') => {
    triggerHaptic(type)
  }

  const hapticWithVisual = (event: React.MouseEvent | React.TouchEvent, type: HapticType = 'light') => {
    const target = event.currentTarget as HTMLElement
    triggerHaptic(type)
    addVisualFeedback(target)
  }

  return { haptic, hapticWithVisual, supportsVibration: supportsVibration() }
}

/**
 * Button press haptic helper for common use
 */
export const buttonPressHaptic = (event: React.MouseEvent | React.TouchEvent) => {
  const target = event.currentTarget as HTMLElement
  triggerHaptic('light')
  addVisualFeedback(target, 0.96)
}

/**
 * Success action haptic
 */
export const successHaptic = () => {
  triggerHaptic('success')
}

/**
 * Error action haptic
 */
export const errorHaptic = () => {
  triggerHaptic('error')
}

/**
 * Selection change haptic (for switches, checkboxes, etc.)
 */
export const selectionHaptic = () => {
  triggerHaptic('selection')
}
