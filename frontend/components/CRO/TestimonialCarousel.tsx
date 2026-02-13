import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { Star, ChevronLeft, ChevronRight, Quote } from 'lucide-react'

export interface Testimonial {
  id: string
  name: string
  role: string
  restaurant: string
  content: string
  rating: number
  image?: string
  location?: string
}

export interface TestimonialCarouselProps {
  testimonials?: Testimonial[]
  variant?: 'cards' | 'carousel' | 'featured'
  autoPlay?: boolean
  autoPlayInterval?: number
  showNavigation?: boolean
  showDots?: boolean
  className?: string
}

const defaultTestimonials: Testimonial[] = [
  {
    id: '1',
    name: 'Maria Chen',
    role: 'Owner',
    restaurant: 'Golden Dragon Bistro',
    content: 'Servio has transformed how we run our restaurant. The voice assistant is incredible - I can update menus and check inventory while cooking. Game changer!',
    rating: 5,
    location: 'San Francisco, CA',
  },
  {
    id: '2',
    name: 'James Rodriguez',
    role: 'General Manager',
    restaurant: 'Taco Fiesta',
    content: 'We used to miss 20+ calls during dinner rush. Now Servio answers every call and takes orders flawlessly. Our revenue is up 15% in just 3 months.',
    rating: 5,
    location: 'Austin, TX',
  },
  {
    id: '3',
    name: 'Sarah Thompson',
    role: 'Operations Director',
    restaurant: 'The Hungry Fork',
    content: 'The staff scheduling alone is worth the price. Combined with inventory tracking and the AI assistant, Servio is essential for any modern restaurant.',
    rating: 5,
    location: 'New York, NY',
  },
  {
    id: '4',
    name: 'Michael Park',
    role: 'Executive Chef',
    restaurant: 'Seoul Kitchen',
    content: 'As a chef, I love that I can just say "86 the special" and it updates everywhere instantly. No more running between POS systems.',
    rating: 5,
    location: 'Seattle, WA',
  },
  {
    id: '5',
    name: 'Emily Watson',
    role: 'Owner',
    restaurant: 'Sweet & Savory Café',
    content: 'The analytics helped us identify our best-selling items and optimize our menu. We increased profits by 23% in the first quarter.',
    rating: 5,
    location: 'Portland, OR',
  },
]

/**
 * TestimonialCarousel Component
 * 
 * Displays customer testimonials with multiple layouts:
 * - Cards: Grid of testimonial cards
 * - Carousel: Sliding carousel with navigation
 * - Featured: Large featured testimonial
 * 
 * Best practices:
 * - Use real testimonials with photos
 * - Include specific results/numbers
 * - Show recognizable restaurant names
 * - Keep content concise
 */
export function TestimonialCarousel({
  testimonials = defaultTestimonials,
  variant = 'cards',
  autoPlay = true,
  autoPlayInterval = 5000,
  showNavigation = true,
  showDots = true,
  className = '',
}: TestimonialCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const shouldReduceMotion = useReducedMotion()

  const nextSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % testimonials.length)
  }, [testimonials.length])

  const prevSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length)
  }, [testimonials.length])

  const goToSlide = useCallback((index: number) => {
    setCurrentIndex(index)
  }, [])

  // Auto-play
  useEffect(() => {
    if (!autoPlay || isPaused || variant === 'cards') return

    const interval = setInterval(nextSlide, autoPlayInterval)
    return () => clearInterval(interval)
  }, [autoPlay, autoPlayInterval, isPaused, nextSlide, variant])

  const renderStars = (rating: number) => (
    <div className="flex items-center gap-1" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`w-5 h-5 ${
            star <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600'
          }`}
          aria-hidden="true"
        />
      ))}
    </div>
  )

  // Cards variant
  if (variant === 'cards') {
    return (
      <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 ${className}`}>
        {testimonials.slice(0, 6).map((testimonial, index) => (
          <motion.div
            key={testimonial.id}
            initial={shouldReduceMotion ? undefined : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.1 }}
            className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-colors"
          >
            <div className="flex items-start justify-between mb-4">
              {renderStars(testimonial.rating)}
              <Quote className="w-8 h-8 text-primary-500/30" aria-hidden="true" />
            </div>
            <p className="text-gray-300 mb-6 line-clamp-4">{testimonial.content}</p>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-servio-purple-500 flex items-center justify-center text-white font-semibold">
                {testimonial.name.charAt(0)}
              </div>
              <div>
                <p className="text-white font-medium">{testimonial.name}</p>
                <p className="text-sm text-gray-400">
                  {testimonial.role}, {testimonial.restaurant}
                </p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    )
  }

  // Featured variant
  if (variant === 'featured') {
    const featured = testimonials[currentIndex]
    return (
      <div
        className={`relative bg-gradient-to-br from-primary-500/10 to-servio-purple-500/10 rounded-3xl p-8 md:p-12 ${className}`}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        <Quote className="absolute top-8 left-8 w-16 h-16 text-primary-500/20" aria-hidden="true" />

        <AnimatePresence mode="wait">
          <motion.div
            key={featured.id}
            initial={shouldReduceMotion ? undefined : { opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={shouldReduceMotion ? undefined : { opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="text-center max-w-3xl mx-auto"
          >
            <div className="flex justify-center mb-6">
              {renderStars(featured.rating)}
            </div>
            <blockquote className="text-xl md:text-2xl text-white font-medium mb-8 leading-relaxed">
              "{featured.content}"
            </blockquote>
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary-500 to-servio-purple-500 flex items-center justify-center text-white text-xl font-bold mb-3">
                {featured.name.charAt(0)}
              </div>
              <p className="text-white font-semibold text-lg">{featured.name}</p>
              <p className="text-gray-400">
                {featured.role} at {featured.restaurant}
              </p>
              {featured.location && (
                <p className="text-gray-500 text-sm mt-1">{featured.location}</p>
              )}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        {showNavigation && (
          <div className="absolute top-1/2 -translate-y-1/2 left-4 right-4 flex justify-between pointer-events-none">
            <button
              onClick={prevSlide}
              className="p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors pointer-events-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              aria-label="Previous testimonial"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              onClick={nextSlide}
              className="p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors pointer-events-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              aria-label="Next testimonial"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>
        )}

        {/* Dots */}
        {showDots && (
          <div className="flex justify-center gap-2 mt-8">
            {testimonials.map((_, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                className={`w-2 h-2 rounded-full transition-all ${
                  index === currentIndex
                    ? 'bg-primary-500 w-6'
                    : 'bg-white/30 hover:bg-white/50'
                }`}
                aria-label={`Go to testimonial ${index + 1}`}
                aria-current={index === currentIndex ? 'true' : undefined}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  // Carousel variant
  return (
    <div
      className={`relative overflow-hidden ${className}`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={testimonials[currentIndex].id}
          initial={shouldReduceMotion ? undefined : { opacity: 0, x: 100 }}
          animate={{ opacity: 1, x: 0 }}
          exit={shouldReduceMotion ? undefined : { opacity: 0, x: -100 }}
          transition={{ duration: 0.3 }}
          className="bg-white/5 border border-white/10 rounded-2xl p-6 md:p-8"
        >
          <div className="flex flex-col md:flex-row gap-6 items-start">
            <div className="flex-shrink-0">
              <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-gradient-to-br from-primary-500 to-servio-purple-500 flex items-center justify-center text-white text-2xl font-bold">
                {testimonials[currentIndex].name.charAt(0)}
              </div>
            </div>
            <div className="flex-1">
              <div className="mb-4">{renderStars(testimonials[currentIndex].rating)}</div>
              <blockquote className="text-lg text-gray-300 mb-4">
                "{testimonials[currentIndex].content}"
              </blockquote>
              <div>
                <p className="text-white font-semibold">{testimonials[currentIndex].name}</p>
                <p className="text-gray-400 text-sm">
                  {testimonials[currentIndex].role} at {testimonials[currentIndex].restaurant}
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <div className="flex items-center justify-center gap-4 mt-6">
        {showNavigation && (
          <>
            <button
              onClick={prevSlide}
              className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              aria-label="Previous testimonial"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          </>
        )}

        {showDots && (
          <div className="flex gap-2">
            {testimonials.map((_, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                className={`w-2 h-2 rounded-full transition-all ${
                  index === currentIndex ? 'bg-primary-500 w-4' : 'bg-white/30'
                }`}
                aria-label={`Go to testimonial ${index + 1}`}
              />
            ))}
          </div>
        )}

        {showNavigation && (
          <button
            onClick={nextSlide}
            className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            aria-label="Next testimonial"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  )
}

export default TestimonialCarousel
