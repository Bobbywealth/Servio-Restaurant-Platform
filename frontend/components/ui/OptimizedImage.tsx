import React, { useState, useCallback, useRef, useEffect } from 'react'
import Image from 'next/image'
import { motion, useReducedMotion } from 'framer-motion'

export interface OptimizedImageProps {
  src: string
  alt: string
  width?: number
  height?: number
  fill?: boolean
  priority?: boolean
  quality?: number
  placeholder?: 'blur' | 'empty'
  blurDataURL?: string
  sizes?: string
  className?: string
  containerClassName?: string
  objectFit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down'
  objectPosition?: string
  lazy?: boolean
  fadeIn?: boolean
  fallbackSrc?: string
  onLoad?: () => void
  onError?: () => void
}

/**
 * OptimizedImage Component
 * 
 * A wrapper around Next.js Image with:
 * - Lazy loading by default
 * - Fade-in animation on load
 * - Blur placeholder support
 * - Error fallback
 * - Reduced motion support
 * - Responsive sizing
 * 
 * Best practices:
 * - Always provide alt text
 * - Use priority for above-fold images
 * - Set appropriate sizes attribute
 * - Use blur placeholders for LCP optimization
 */
export function OptimizedImage({
  src,
  alt,
  width,
  height,
  fill = false,
  priority = false,
  quality = 75,
  placeholder = 'empty',
  blurDataURL,
  sizes,
  className = '',
  containerClassName = '',
  objectFit = 'cover',
  objectPosition = 'center',
  lazy = true,
  fadeIn = true,
  fallbackSrc = '/images/placeholder.png',
  onLoad,
  onError,
}: OptimizedImageProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [currentSrc, setCurrentSrc] = useState(src)
  const imgRef = useRef<HTMLDivElement>(null)
  const shouldReduceMotion = useReducedMotion()

  // Generate simple blur placeholder
  const generateBlurDataURL = useCallback((w: number = 10, h: number = 10): string => {
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.fillStyle = '#1f2937' // gray-800
      ctx.fillRect(0, 0, w, h)
    }
    return canvas.toDataURL('image/jpeg', 0.1)
  }, [])

  // Handle image load
  const handleLoad = useCallback(() => {
    setIsLoading(false)
    onLoad?.()
  }, [onLoad])

  // Handle image error
  const handleError = useCallback(() => {
    setIsLoading(false)
    setHasError(true)
    setCurrentSrc(fallbackSrc)
    onError?.()
  }, [fallbackSrc, onError])

  // Reset state when src changes
  useEffect(() => {
    setIsLoading(true)
    setHasError(false)
    setCurrentSrc(src)
  }, [src])

  const objectFitClasses = {
    contain: 'object-contain',
    cover: 'object-cover',
    fill: 'object-fill',
    none: 'object-none',
    'scale-down': 'object-scale-down',
  }

  const showFadeIn = fadeIn && !shouldReduceMotion && !priority

  return (
    <div
      ref={imgRef}
      className={`relative overflow-hidden ${containerClassName}`}
      style={fill ? { position: 'absolute', inset: 0 } : undefined}
    >
      {/* Loading placeholder */}
      {isLoading && (
        <div
          className={`absolute inset-0 bg-gray-800 animate-pulse ${className}`}
          aria-hidden="true"
        />
      )}

      {/* Image */}
      <motion.div
        initial={showFadeIn ? { opacity: 0 } : undefined}
        animate={{ opacity: isLoading && showFadeIn ? 0 : 1 }}
        transition={{ duration: 0.3 }}
        className={`${fill ? 'absolute inset-0' : 'relative'} ${isLoading ? 'opacity-0' : ''}`}
      >
        <Image
          src={hasError ? fallbackSrc : currentSrc}
          alt={alt}
          width={fill ? undefined : width}
          height={fill ? undefined : height}
          fill={fill}
          priority={priority}
          quality={quality}
          placeholder={placeholder}
          blurDataURL={blurDataURL || (placeholder === 'blur' ? generateBlurDataURL() : undefined)}
          sizes={sizes}
          onLoad={handleLoad}
          onError={handleError}
          loading={lazy && !priority ? 'lazy' : undefined}
          className={`${objectFitClasses[objectFit]} ${className}`}
          style={{ objectPosition }}
        />
      </motion.div>
    </div>
  )
}

/**
 * Predefined image size presets for common use cases
 */
export const ImagePresets = {
  hero: {
    sizes: '100vw',
    quality: 90,
    priority: true,
  },
  card: {
    sizes: '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw',
    quality: 75,
  },
  thumbnail: {
    sizes: '(max-width: 768px) 50vw, 25vw',
    quality: 65,
  },
  avatar: {
    sizes: '48px',
    quality: 75,
  },
  logo: {
    sizes: '(max-width: 768px) 100px, 150px',
    quality: 90,
  },
} as const

/**
 * HeroImage - Optimized for above-the-fold hero images
 */
export function HeroImage({
  src,
  alt,
  className = '',
  containerClassName = '',
}: Omit<OptimizedImageProps, 'priority' | 'lazy' | 'fadeIn'>) {
  return (
    <OptimizedImage
      src={src}
      alt={alt}
      fill
      priority
      lazy={false}
      fadeIn={false}
      quality={90}
      sizes="100vw"
      className={className}
      containerClassName={containerClassName}
    />
  )
}

/**
 * CardImage - Optimized for card thumbnails
 */
export function CardImage({
  src,
  alt,
  aspectRatio = '16/9',
  className = '',
  containerClassName = '',
}: Omit<OptimizedImageProps, 'fill' | 'width' | 'height'> & { aspectRatio?: string }) {
  return (
    <div className={`relative overflow-hidden ${containerClassName}`} style={{ aspectRatio }}>
      <OptimizedImage
        src={src}
        alt={alt}
        fill
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        quality={75}
        className={className}
      />
    </div>
  )
}

/**
 * AvatarImage - Optimized for user avatars
 */
export function AvatarImage({
  src,
  alt,
  size = 48,
  className = '',
}: Omit<OptimizedImageProps, 'fill' | 'width' | 'height' | 'sizes'> & { size?: number }) {
  return (
    <div
      className={`relative overflow-hidden rounded-full ${className}`}
      style={{ width: size, height: size }}
    >
      <OptimizedImage
        src={src}
        alt={alt}
        fill
        sizes={`${size}px`}
        quality={75}
        className="rounded-full"
      />
    </div>
  )
}

export default OptimizedImage
