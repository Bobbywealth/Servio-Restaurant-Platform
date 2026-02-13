/**
 * Optimized Image Component
 * Provides lazy loading with blur placeholder and responsive sizing
 * 
 * Image optimization can reduce page weight by 70%
 */

import React, { useState, useEffect, useMemo } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'

// ============================================================================
// Types
// ============================================================================

interface OptimizedImageProps {
  /** Image source */
  src: string
  /** Alt text (required for accessibility) */
  alt: string
  /** Width in pixels */
  width: number
  /** Height in pixels */
  height: number
  /** Priority loading (above the fold) */
  priority?: boolean
  /** Object fit style */
  objectFit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down'
  /** Object position */
  objectPosition?: string
  /** Additional className */
  className?: string
  /** Container className */
  containerClassName?: string
  /** Blur placeholder (base64 or shimmer) */
  placeholder?: 'blur' | 'empty'
  /** Blur data URL */
  blurDataURL?: string
  /** Sizes attribute for responsive images */
  sizes?: string
  /** Quality (1-100) */
  quality?: number
  /** On load callback */
  onLoad?: () => void
  /** Fallback image src */
  fallbackSrc?: string
  /** Aspect ratio for placeholder (width/height) */
  aspectRatio?: number
}

// ============================================================================
// Shimmer Placeholder Generator
// ============================================================================

function generateShimmer(width: number, height: number): string {
  const shimmer = `
    <svg width="${width}" height="${height}" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
      <defs>
        <linearGradient id="shimmer-gradient">
          <stop offset="0%" stop-color="#1f2937">
            <animate attributeName="offset" values="-1; 1" dur="1.5s" repeatCount="indefinite" />
          </stop>
          <stop offset="50%" stop-color="#374151">
            <animate attributeName="offset" values="-0.5; 1.5" dur="1.5s" repeatCount="indefinite" />
          </stop>
          <stop offset="100%" stop-color="#1f2937">
            <animate attributeName="offset" values="0; 2" dur="1.5s" repeatCount="indefinite" />
          </stop>
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#shimmer-gradient)" />
    </svg>
  `
  
  return `data:image/svg+xml;base64,${Buffer.from(shimmer).toString('base64')}`
}

// ============================================================================
// Blur Placeholders
// ============================================================================

const BLUR_PLACEHOLDERS = {
  // Simple gray placeholder
  simple: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  
  // Gradient placeholder
  gradient: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxkZWZzPjxsaW5lYXJHcmFkaWVudCBpZD0iZ3JhZCIgeDE9IjAlIiB5MT0iMCUiIHgyPSIxMDAlIiB5Mj0iMTAwJSI+PHN0b3Agb2Zmc2V0PSIwJSIgc3RvcC1jb2xvcj0iIzFmMjkzNyIvPjxzdG9wIG9mZnNldD0iMTAwJSIgc3RvcC1jb2xvcj0iIzM3NDE1MSIvPjwvbGluZWFyR3JhZGllbnQ+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JhZCkiLz48L3N2Zz4=',
  
  // Shimmer effect (animated)
  shimmer: (width: number = 10, height: number = 10) => 
    `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${width} ${height}'%3E%3Crect width='100%25' height='100%25' fill='%231f2937'/%3E%3C/svg%3E`
}

// ============================================================================
// Component
// ============================================================================

export function OptimizedImage({
  src,
  alt,
  width,
  height,
  priority = false,
  objectFit = 'cover',
  objectPosition = 'center',
  className = '',
  containerClassName = '',
  placeholder = 'blur',
  blurDataURL,
  sizes,
  quality = 85,
  onLoad,
  fallbackSrc = '/images/placeholder.png',
  aspectRatio
}: OptimizedImageProps) {
  const [isLoading, setIsLoading] = useState(!priority)
  const [hasError, setHasError] = useState(false)
  const [currentSrc, setCurrentSrc] = useState(src)

  // Generate blur placeholder if not provided
  const placeholderData = useMemo(() => {
    if (blurDataURL) return blurDataURL
    if (placeholder === 'empty') return undefined
    return BLUR_PLACEHOLDERS.simple
  }, [blurDataURL, placeholder])

  // Calculate aspect ratio
  const calculatedAspectRatio = aspectRatio || width / height

  // Handle image load
  const handleLoad = () => {
    setIsLoading(false)
    onLoad?.()
  }

  // Handle image error
  const handleError = () => {
    setHasError(true)
    setIsLoading(false)
    if (currentSrc !== fallbackSrc) {
      setCurrentSrc(fallbackSrc)
      setHasError(false)
    }
  }

  // Reset state when src changes
  useEffect(() => {
    setIsLoading(!priority)
    setHasError(false)
    setCurrentSrc(src)
  }, [src, priority])

  // Object fit mapping
  const objectFitClasses = {
    contain: 'object-contain',
    cover: 'object-cover',
    fill: 'object-fill',
    none: 'object-none',
    'scale-down': 'object-scale-down'
  }

  return (
    <div 
      className={`relative overflow-hidden ${containerClassName}`}
      style={{ aspectRatio: `${calculatedAspectRatio}` }}
    >
      {/* Loading placeholder */}
      {isLoading && (
        <div 
          className="absolute inset-0 bg-gray-800 animate-pulse"
          aria-hidden="true"
        >
          <div className="w-full h-full bg-gradient-to-r from-gray-800 via-gray-700 to-gray-800 bg-[length:200%_100%] animate-[shimmer_1.5s_infinite]" />
        </div>
      )}

      {/* Main image */}
      <Image
        src={hasError ? fallbackSrc : currentSrc}
        alt={alt}
        width={width}
        height={height}
        priority={priority}
        quality={quality}
        placeholder={placeholder}
        blurDataURL={placeholderData}
        sizes={sizes}
        onLoad={handleLoad}
        onError={handleError}
        className={`
          transition-opacity duration-300
          ${isLoading ? 'opacity-0' : 'opacity-100'}
          ${objectFitClasses[objectFit]}
          ${className}
        `}
        style={{ objectPosition }}
      />
    </div>
  )
}

// ============================================================================
// Background Image Component
// ============================================================================

interface BackgroundImageProps {
  src: string
  children?: React.ReactNode
  className?: string
  overlay?: boolean
  overlayOpacity?: number
  priority?: boolean
  blur?: boolean
  blurAmount?: number
}

export function BackgroundImage({
  src,
  children,
  className = '',
  overlay = true,
  overlayOpacity = 0.5,
  priority = false,
  blur = false,
  blurAmount = 8
}: BackgroundImageProps) {
  const [isLoaded, setIsLoaded] = useState(false)

  return (
    <div className={`relative ${className}`}>
      {/* Background image layer */}
      <div 
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: `url(${src})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: blur ? `blur(${blurAmount}px)` : undefined,
          transform: blur ? 'scale(1.1)' : undefined, // Prevent blur edges
          opacity: isLoaded ? 1 : 0,
          transition: 'opacity 0.5s ease-in-out'
        }}
        onLoad={() => setIsLoaded(true)}
      />

      {/* Overlay */}
      {overlay && (
        <div 
          className="absolute inset-0 z-10 bg-black"
          style={{ opacity: overlayOpacity }}
        />
      )}

      {/* Content */}
      <div className="relative z-20">
        {children}
      </div>
    </div>
  )
}

// ============================================================================
// Responsive Image Component
// ============================================================================

interface ResponsiveImageProps {
  sources: {
    mobile?: string
    tablet?: string
    desktop?: string
    default: string
  }
  alt: string
  width: number
  height: number
  className?: string
  priority?: boolean
}

export function ResponsiveImage({
  sources,
  alt,
  width,
  height,
  className = '',
  priority = false
}: ResponsiveImageProps) {
  return (
    <picture>
      {sources.desktop && (
        <source 
          media="(min-width: 1024px)" 
          srcSet={sources.desktop} 
        />
      )}
      {sources.tablet && (
        <source 
          media="(min-width: 768px)" 
          srcSet={sources.tablet} 
        />
      )}
      {sources.mobile && (
        <source 
          media="(max-width: 767px)" 
          srcSet={sources.mobile} 
        />
      )}
      <OptimizedImage
        src={sources.default}
        alt={alt}
        width={width}
        height={height}
        className={className}
        priority={priority}
      />
    </picture>
  )
}

// ============================================================================
// Avatar Image Component
// ============================================================================

interface AvatarImageProps {
  src?: string
  alt: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  fallbackText?: string
}

const AVATAR_SIZES = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 48,
  xl: 64
}

export function AvatarImage({
  src,
  alt,
  size = 'md',
  className = '',
  fallbackText
}: AvatarImageProps) {
  const [hasError, setHasError] = useState(false)
  const dimension = AVATAR_SIZES[size]

  // Generate initials for fallback
  const initials = fallbackText || alt
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  if (!src || hasError) {
    return (
      <div 
        className={`
          flex items-center justify-center rounded-full 
          bg-gradient-to-br from-primary-400 to-primary-600 
          text-white font-medium
          ${className}
        `}
        style={{ width: dimension, height: dimension }}
        role="img"
        aria-label={alt}
      >
        <span className="text-xs">{initials}</span>
      </div>
    )
  }

  return (
    <OptimizedImage
      src={src}
      alt={alt}
      width={dimension}
      height={dimension}
      className={`rounded-full ${className}`}
      containerClassName="rounded-full overflow-hidden"
    />
  )
}

// ============================================================================
// Export
// ============================================================================

export default OptimizedImage
