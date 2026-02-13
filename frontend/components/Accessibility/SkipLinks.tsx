/**
 * Skip Navigation Links Component
 * Provides keyboard navigation shortcuts for accessibility (WCAG 2.1 AA)
 * 
 * @see https://www.w3.org/WAI/WCAG21/Understanding/bypass-blocks.html
 */

import React from 'react'
import { motion } from 'framer-motion'

// ============================================================================
// Type Definitions
// ============================================================================

interface SkipLink {
  targetId: string
  label: string
}

interface SkipLinksProps {
  /** Custom skip links to render */
  links?: SkipLink[]
  /** Additional CSS classes */
  className?: string
}

// ============================================================================
// Default Skip Links
// ============================================================================

const DEFAULT_LINKS: SkipLink[] = [
  { targetId: 'main-content', label: 'Skip to main content' },
  { targetId: 'main-navigation', label: 'Skip to navigation' },
  { targetId: 'search', label: 'Skip to search' },
]

// ============================================================================
// Component
// ============================================================================

export function SkipLinks({ 
  links = DEFAULT_LINKS,
  className = ''
}: SkipLinksProps) {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, targetId: string) => {
    e.preventDefault()
    const target = document.getElementById(targetId)
    if (target) {
      target.focus()
      target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <nav 
      aria-label="Skip links" 
      className={`skip-links-container ${className}`}
    >
      <ul className="skip-links-list">
        {links.map((link, index) => (
          <li key={link.targetId}>
            <a
              href={`#${link.targetId}`}
              onClick={(e) => handleClick(e, link.targetId)}
              className="skip-link"
              style={{
                animationDelay: `${index * 50}ms`
              }}
            >
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}

// ============================================================================
// Skip Link Target Component
// ============================================================================

interface SkipTargetProps {
  id: string
  children: React.ReactNode
  /** Tab index for focusability (-1 for programmatic focus only) */
  tabIndex?: number
  /** Element type to render */
  as?: keyof JSX.IntrinsicElements
  /** Additional CSS classes */
  className?: string
  /** ARIA label for the target */
  ariaLabel?: string
}

export function SkipTarget({
  id,
  children,
  tabIndex = -1,
  as: Component = 'div',
  className = '',
  ariaLabel
}: SkipTargetProps) {
  return (
    <Component
      id={id}
      tabIndex={tabIndex}
      className={`skip-target ${className}`}
      aria-label={ariaLabel}
      // Add outline when focused via skip link
      style={{ outline: 'none' }}
      onFocus={(e) => {
        e.currentTarget.style.outline = '3px solid var(--primary-500, #14b8a6)'
        e.currentTarget.style.outlineOffset = '2px'
      }}
      onBlur={(e) => {
        e.currentTarget.style.outline = 'none'
      }}
    >
      {children}
    </Component>
  )
}

// ============================================================================
// Main Content Wrapper
// ============================================================================

interface MainContentProps {
  children: React.ReactNode
  className?: string
}

export function MainContent({ children, className = '' }: MainContentProps) {
  return (
    <SkipTarget
      id="main-content"
      as="main"
      className={className}
      ariaLabel="Main content"
    >
      {children}
    </SkipTarget>
  )
}

// ============================================================================
// Navigation Wrapper
// ============================================================================

interface NavigationWrapperProps {
  children: React.ReactNode
  className?: string
  ariaLabel?: string
}

export function NavigationWrapper({ 
  children, 
  className = '',
  ariaLabel = 'Main navigation'
}: NavigationWrapperProps) {
  return (
    <SkipTarget
      id="main-navigation"
      as="nav"
      className={className}
      ariaLabel={ariaLabel}
    >
      {children}
    </SkipTarget>
  )
}

// ============================================================================
// Search Wrapper
// ============================================================================

interface SearchWrapperProps {
  children: React.ReactNode
  className?: string
}

export function SearchWrapper({ children, className = '' }: SearchWrapperProps) {
  return (
    <SkipTarget
      id="search"
      as="search"
      className={className}
      ariaLabel="Search"
    >
      {children}
    </SkipTarget>
  )
}

// ============================================================================
// Export
// ============================================================================

export default SkipLinks
