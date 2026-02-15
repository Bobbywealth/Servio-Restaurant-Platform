/**
 * Live Region Announcer for Screen Readers
 * Provides real-time announcements for dynamic content changes
 * 
 * @see https://www.w3.org/WAI/WCAG21/Understanding/status-messages.html
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'

// ============================================================================
// Types
// ============================================================================

type AnnouncementPriority = 'polite' | 'assertive' | 'off'

interface Announcement {
  id: string
  message: string
  priority: AnnouncementPriority
  timestamp: number
}

interface LiveAnnouncerContextValue {
  announce: (message: string, priority?: AnnouncementPriority) => void
  clearAnnouncements: () => void
}

// ============================================================================
// Context
// ============================================================================

const LiveAnnouncerContext = createContext<LiveAnnouncerContextValue | null>(null)

// ============================================================================
// Provider Component
// ============================================================================

interface LiveAnnouncerProviderProps {
  children: React.ReactNode
  /** Debounce time in ms to prevent announcement spam */
  debounceMs?: number
}

export function LiveAnnouncerProvider({ 
  children, 
  debounceMs = 150 
}: LiveAnnouncerProviderProps) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [lastAnnouncementTime, setLastAnnouncementTime] = useState(0)

  const announce = useCallback((message: string, priority: AnnouncementPriority = 'polite') => {
    const now = Date.now()
    
    // Debounce to prevent spam
    if (now - lastAnnouncementTime < debounceMs) {
      return
    }

    setLastAnnouncementTime(now)
    setAnnouncements(prev => [
      ...prev,
      {
        id: `announcement-${now}`,
        message,
        priority,
        timestamp: now
      }
    ])

    // Clear after announcement (screen readers will have read it)
    setTimeout(() => {
      setAnnouncements(prev => prev.filter(a => a.timestamp !== now))
    }, 5000)
  }, [debounceMs, lastAnnouncementTime])

  const clearAnnouncements = useCallback(() => {
    setAnnouncements([])
  }, [])

  return (
    <LiveAnnouncerContext.Provider value={{ announce, clearAnnouncements }}>
      {children}
      {typeof window !== 'undefined' && createPortal(
        <LiveRegion announcements={announcements} />,
        document.body
      )}
    </LiveAnnouncerContext.Provider>
  )
}

// ============================================================================
// Live Region Component
// ============================================================================

interface LiveRegionProps {
  announcements: Announcement[]
}

function LiveRegion({ announcements }: LiveRegionProps) {
  const politeAnnouncements = announcements.filter(a => a.priority === 'polite')
  const assertiveAnnouncements = announcements.filter(a => a.priority === 'assertive')

  return (
    <>
      {/* Polite announcements - wait for user idle */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        style={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          padding: 0,
          margin: '-1px',
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          borderWidth: 0,
        }}
      >
        {politeAnnouncements.map(a => (
          <span key={a.id}>{a.message}</span>
        ))}
      </div>

      {/* Assertive announcements - interrupt immediately */}
      <div
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
        style={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          padding: 0,
          margin: '-1px',
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          borderWidth: 0,
        }}
      >
        {assertiveAnnouncements.map(a => (
          <span key={a.id}>{a.message}</span>
        ))}
      </div>
    </>
  )
}

// ============================================================================
// Hook
// ============================================================================

export function useAnnouncer() {
  const context = useContext(LiveAnnouncerContext)
  
  if (!context) {
    throw new Error('useAnnouncer must be used within a LiveAnnouncerProvider')
  }
  
  return context
}

// ============================================================================
// Convenience Hook for Common Announcements
// ============================================================================

export function useAnnounceState() {
  const { announce } = useAnnouncer()
  
  return {
    announceLoading: (item = 'content') => 
      announce(`Loading ${item}, please wait...`, 'polite'),
    
    announceLoaded: (item = 'content', count?: number) => 
      announce(count !== undefined 
        ? `${count} ${item} loaded` 
        : `${item} loaded successfully`, 'polite'),
    
    announceError: (message: string) => 
      announce(`Error: ${message}`, 'assertive'),
    
    announceSuccess: (message: string) => 
      announce(message, 'polite'),
    
    announceNavigation: (location: string) => 
      announce(`Navigated to ${location}`, 'polite'),
    
    announceAction: (action: string, result: string = 'completed') => 
      announce(`${action} ${result}`, 'polite'),
    
    announceCount: (count: number, itemType: string) => 
      announce(`${count} ${itemType} selected`, 'polite'),
    
    announceProgress: (current: number, total: number, item: string) => 
      announce(`${current} of ${total} ${item} processed`, 'polite'),
    
    announceDismissed: (item: string) => 
      announce(`${item} dismissed`, 'polite'),
    
    announceExpanded: (item: string) => 
      announce(`${item} expanded`, 'polite'),
    
    announceCollapsed: (item: string) => 
      announce(`${item} collapsed`, 'polite'),
  }
}

// ============================================================================
// Status Message Component
// ============================================================================

interface StatusMessageProps {
  message: string
  type?: 'success' | 'error' | 'warning' | 'info'
  announce?: boolean
  children?: React.ReactNode
}

export function StatusMessage({
  message,
  type = 'info',
  announce = true,
  children
}: StatusMessageProps) {
  const { announce: doAnnounce } = useAnnouncer()
  
  useEffect(() => {
    if (announce) {
      doAnnounce(message, type === 'error' ? 'assertive' : 'polite')
    }
  }, [message, announce, type, doAnnounce])
  
  if (children) {
    return <>{children}</>
  }
  
  return null
}

// ============================================================================
// Export
// ============================================================================

export default LiveAnnouncerProvider
