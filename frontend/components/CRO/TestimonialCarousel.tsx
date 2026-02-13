/**
 * Testimonial Carousel Component
 * Displays customer testimonials with auto-play and navigation
 * 
 * Testimonials can increase conversions by 34%
 */

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, Quote, Star, Play, Pause } from 'lucide-react'

// ============================================================================
// Types
// ============================================================================

interface Testimonial {
  id: string
  quote: string
  author: string
  role: string
  company: string
  image?: string
  rating?: number
  videoUrl?: string
  result?: string // e.g., "30% more orders"
}

interface TestimonialCarouselProps {
  testimonials: Testimonial[]
  /** Auto-play interval in ms */
  autoPlayInterval?: number
  /** Show navigation arrows */
  showArrows?: boolean
  /** Show dot indicators */
  showDots?: boolean
  /** Show play/pause button */
  showPlayPause?: boolean
  /** Variant style */
  variant?: 'cards' | 'quotes' | 'minimal'
  /** Number of items to show at once */
  itemsPerView?: 1 | 2 | 3
  /** Additional className */
  className?: string
}

// ============================================================================
// Default Testimonials Data
// ============================================================================

export const DEFAULT_TESTIMONIALS: Testimonial[] = [
  {
    id: '1',
    quote: "Servio cut our order processing time by 60%. It's been a game changer for our busy Friday nights.",
    author: "Maria Chen",
    role: "Owner",
    company: "Golden Dragon Restaurant",
    rating: 5,
    result: "60% faster orders"
  },
  {
    id: '2',
    quote: "The AI assistant is like having an extra staff member who never calls in sick. Our customers love the voice ordering.",
    author: "James Wilson",
    role: "General Manager",
    company: "Bella Italia",
    rating: 5,
    result: "40% more orders"
  },
  {
    id: '3',
    quote: "We used to spend hours on inventory management. Now it's automated. I actually have time to focus on growing the business.",
    author: "Sarah Johnson",
    role: "Owner",
    company: "The Burger Joint",
    rating: 5,
    result: "15 hours saved/week"
  },
  {
    id: '4',
    quote: "The staff scheduling feature alone is worth the subscription. No more scheduling conflicts or missed shifts.",
    author: "David Park",
    role: "Operations Director",
    company: "Seoul Kitchen",
    rating: 5,
    result: "Zero scheduling errors"
  },
  {
    id: '5',
    quote: "Implementation was seamless. The team had us up and running in less than a day. Outstanding support.",
    author: "Emily Rodriguez",
    role: "Owner",
    company: "Casa Mexicana",
    rating: 5,
    result: "Live in 1 day"
  }
]

// ============================================================================
// Animation Variants
// ============================================================================

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 1000 : -1000,
    opacity: 0
  }),
  center: {
    x: 0,
    opacity: 1
  },
  exit: (direction: number) => ({
    x: direction < 0 ? 1000 : -1000,
    opacity: 0
  })
}

const swipeConfidenceThreshold = 10000
const swipePower = (offset: number, velocity: number) => {
  return Math.abs(offset) * velocity
}

// ============================================================================
// Rating Stars Component
// ============================================================================

function RatingStars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[...Array(5)].map((_, i) => (
        <Star
          key={i}
          className={`w-4 h-4 ${
            i < rating
              ? 'text-yellow-400 fill-current'
              : 'text-gray-400'
          }`}
        />
      ))}
    </div>
  )
}

// ============================================================================
// Cards Variant
// ============================================================================

function TestimonialCards({ 
  testimonial,
  isActive 
}: { 
  testimonial: Testimonial
  isActive: boolean 
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: isActive ? 1 : 0.7, scale: isActive ? 1 : 0.95 }}
      transition={{ duration: 0.3 }}
      className={`bg-white rounded-2xl p-6 md:p-8 shadow-lg border border-gray-100 ${
        isActive ? '' : 'blur-[1px]'
      }`}
    >
      {/* Result badge */}
      {testimonial.result && (
        <div className="inline-flex items-center gap-1 bg-green-100 text-green-700 text-sm font-medium px-3 py-1 rounded-full mb-4">
          <span>📈</span>
          <span>{testimonial.result}</span>
        </div>
      )}

      {/* Rating */}
      {testimonial.rating && (
        <div className="mb-4">
          <RatingStars rating={testimonial.rating} />
        </div>
      )}

      {/* Quote */}
      <blockquote className="text-gray-700 text-lg md:text-xl leading-relaxed mb-6">
        "{testimonial.quote}"
      </blockquote>

      {/* Author */}
      <div className="flex items-center gap-4">
        {testimonial.image ? (
          <img
            src={testimonial.image}
            alt={testimonial.author}
            className="w-12 h-12 rounded-full object-cover"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-bold text-lg">
            {testimonial.author.charAt(0)}
          </div>
        )}
        <div>
          <p className="font-semibold text-gray-900">{testimonial.author}</p>
          <p className="text-sm text-gray-500">
            {testimonial.role} at {testimonial.company}
          </p>
        </div>
      </div>
    </motion.div>
  )
}

// ============================================================================
// Quotes Variant
// ============================================================================

function TestimonialQuote({ 
  testimonial 
}: { 
  testimonial: Testimonial 
}) {
  return (
    <div className="text-center max-w-3xl mx-auto">
      <Quote className="w-12 h-12 text-primary-500/20 mx-auto mb-6" />
      
      <blockquote className="text-2xl md:text-3xl font-medium text-white leading-relaxed mb-8">
        "{testimonial.quote}"
      </blockquote>

      {testimonial.rating && (
        <div className="flex justify-center mb-6">
          <RatingStars rating={testimonial.rating} />
        </div>
      )}

      <div className="flex items-center justify-center gap-4">
        {testimonial.image ? (
          <img
            src={testimonial.image}
            alt={testimonial.author}
            className="w-14 h-14 rounded-full object-cover"
          />
        ) : (
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-bold text-xl">
            {testimonial.author.charAt(0)}
          </div>
        )}
        <div className="text-left">
          <p className="font-semibold text-white">{testimonial.author}</p>
          <p className="text-sm text-gray-400">
            {testimonial.role}, {testimonial.company}
          </p>
        </div>
      </div>

      {testimonial.result && (
        <div className="mt-6 inline-flex items-center gap-2 bg-primary-500/10 text-primary-400 text-sm font-medium px-4 py-2 rounded-full">
          <span>✨</span>
          <span>{testimonial.result}</span>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Minimal Variant
// ============================================================================

function TestimonialMinimal({ 
  testimonial 
}: { 
  testimonial: Testimonial 
}) {
  return (
    <div className="flex items-center gap-6">
      {testimonial.image ? (
        <img
          src={testimonial.image}
          alt={testimonial.author}
          className="w-16 h-16 rounded-full object-cover flex-shrink-0"
        />
      ) : (
        <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-bold text-xl flex-shrink-0">
          {testimonial.author.charAt(0)}
        </div>
      )}
      
      <div>
        <blockquote className="text-gray-700 italic mb-2">
          "{testimonial.quote}"
        </blockquote>
        <p className="text-sm text-gray-500">
          — {testimonial.author}, {testimonial.company}
        </p>
      </div>
    </div>
  )
}

// ============================================================================
// Main Carousel Component
// ============================================================================

export function TestimonialCarousel({
  testimonials = DEFAULT_TESTIMONIALS,
  autoPlayInterval = 5000,
  showArrows = true,
  showDots = true,
  showPlayPause = true,
  variant = 'cards',
  itemsPerView = 1,
  className = ''
}: TestimonialCarouselProps) {
  const [[page, direction], setPage] = useState([0, 0])
  const [isPlaying, setIsPlaying] = useState(true)

  const testimonialIndex = ((page % testimonials.length) + testimonials.length) % testimonials.length
  const currentTestimonial = testimonials[testimonialIndex]

  const paginate = useCallback((newDirection: number) => {
    setPage([page + newDirection, newDirection])
  }, [page])

  // Auto-play
  useEffect(() => {
    if (!isPlaying) return

    const interval = setInterval(() => {
      paginate(1)
    }, autoPlayInterval)

    return () => clearInterval(interval)
  }, [isPlaying, autoPlayInterval, paginate])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') paginate(-1)
      if (e.key === 'ArrowRight') paginate(1)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [paginate])

  const renderTestimonial = () => {
    switch (variant) {
      case 'quotes':
        return <TestimonialQuote testimonial={currentTestimonial} />
      case 'minimal':
        return <TestimonialMinimal testimonial={currentTestimonial} />
      case 'cards':
      default:
        return (
          <TestimonialCards 
            testimonial={currentTestimonial} 
            isActive={true} 
          />
        )
    }
  }

  return (
    <section 
      className={`relative ${className}`}
      aria-label="Customer testimonials"
      aria-roledescription="carousel"
    >
      {/* Main content */}
      <div className="relative overflow-hidden">
        <AnimatePresence initial={false} custom={direction} mode="wait">
          <motion.div
            key={page}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              x: { type: 'spring', stiffness: 300, damping: 30 },
              opacity: { duration: 0.2 }
            }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={1}
            onDragEnd={(e, { offset, velocity }) => {
              const swipe = swipePower(offset.x, velocity.x)
              if (swipe < -swipeConfidenceThreshold) {
                paginate(1)
              } else if (swipe > swipeConfidenceThreshold) {
                paginate(-1)
              }
            }}
            className="px-4"
          >
            {renderTestimonial()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-center gap-4 mt-8">
        {/* Previous button */}
        {showArrows && (
          <button
            onClick={() => paginate(-1)}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            aria-label="Previous testimonial"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}

        {/* Dots */}
        {showDots && (
          <div className="flex items-center gap-2">
            {testimonials.map((_, index) => (
              <button
                key={index}
                onClick={() => setPage([index, index > testimonialIndex ? 1 : -1])}
                className={`w-2 h-2 rounded-full transition-all ${
                  index === testimonialIndex
                    ? 'bg-primary-500 w-4'
                    : 'bg-gray-400 hover:bg-gray-300'
                }`}
                aria-label={`Go to testimonial ${index + 1}`}
                aria-current={index === testimonialIndex ? 'true' : 'false'}
              />
            ))}
          </div>
        )}

        {/* Next button */}
        {showArrows && (
          <button
            onClick={() => paginate(1)}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            aria-label="Next testimonial"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}

        {/* Play/Pause */}
        {showPlayPause && (
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors ml-2"
            aria-label={isPlaying ? 'Pause auto-play' : 'Resume auto-play'}
          >
            {isPlaying ? (
              <Pause className="w-4 h-4" />
            ) : (
              <Play className="w-4 h-4" />
            )}
          </button>
        )}
      </div>
    </section>
  )
}

// ============================================================================
// Grid Display (Non-carousel alternative)
// ============================================================================

interface TestimonialGridProps {
  testimonials?: Testimonial[]
  columns?: 2 | 3
  className?: string
}

export function TestimonialGrid({
  testimonials = DEFAULT_TESTIMONIALS.slice(0, 3),
  columns = 3,
  className = ''
}: TestimonialGridProps) {
  return (
    <div className={`grid md:grid-cols-${columns} gap-6 ${className}`}>
      {testimonials.map((testimonial) => (
        <TestimonialCards
          key={testimonial.id}
          testimonial={testimonial}
          isActive={true}
        />
      ))}
    </div>
  )
}

// ============================================================================
// Export
// ============================================================================

export default TestimonialCarousel
