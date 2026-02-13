import React, { useState, useEffect, useRef, useCallback } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import Image from 'next/image'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import {
  Mic, Bot, Shield, Zap, Clock, Users,
  Phone, Smartphone, RefreshCw, BarChart3,
  CheckCircle2, MessageSquare, Headphones,
  Utensils, ShoppingCart, Package,
  Calendar, DollarSign, TrendingUp,
  ArrowRight, PlayCircle, Star, Menu, X, Sparkles
} from 'lucide-react'

// Import new CRO and SEO components
import { 
  TrustSignals, 
  TestimonialCarousel, 
  FAQSection, 
  StickyCTA, 
  ExitIntentPopup 
} from '../components/CRO'
import { HomepageSchemas, EnhancedSEO } from '../components/SEO'

// ============================================================================
// Animation Variants (with reduced motion support)
// ============================================================================

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 }
}

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
}

// ============================================================================
// Homepage Component
// ============================================================================

export default function HomePage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [activeSection, setActiveSection] = useState('top')
  const shouldReduceMotion = useReducedMotion()
  const menuRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  // Handle escape key for mobile menu
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileMenuOpen) {
        setMobileMenuOpen(false)
      }
    }
    
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [mobileMenuOpen])

  // Focus trap for mobile menu
  useEffect(() => {
    if (mobileMenuOpen && closeButtonRef.current) {
      closeButtonRef.current.focus()
    }
  }, [mobileMenuOpen])

  // Track active section for navigation
  useEffect(() => {
    const handleScroll = () => {
      const sections = ['top', 'services', 'features', 'pricing', 'faq']
      const scrollPosition = window.scrollY + 100

      for (const section of sections) {
        const element = document.getElementById(section)
        if (element) {
          const offsetTop = element.offsetTop
          const offsetHeight = element.offsetHeight
          if (scrollPosition >= offsetTop && scrollPosition < offsetTop + offsetHeight) {
            setActiveSection(section)
            break
          }
        }
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Handle email capture from exit intent
  const handleEmailCapture = useCallback(async (email: string) => {
    try {
      // TODO: Implement email capture API
      console.log('Email captured:', email)
    } catch (error) {
      console.error('Failed to capture email:', error)
    }
  }, [])

  return (
    <>
      {/* SEO */}
      <HomepageSchemas />
      <EnhancedSEO
        title="Restaurant Operating System | Voice-First Operations"
        description="Servio is a restaurant operating system that unifies orders, menu updates, marketing, inventory, staff operations, and integrations in one dashboard—with an AI assistant for fast, hands-free execution."
        keywords={[
          'restaurant management software',
          'restaurant POS',
          'voice assistant for restaurants',
          'restaurant operations',
          'AI restaurant assistant',
          'restaurant inventory management',
          'staff scheduling software',
          'restaurant marketing'
        ]}
      />

      <div className="min-h-screen bg-gray-900 text-white overflow-x-hidden">
        {/* Animated Background Blobs - with reduced motion support */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
          {shouldReduceMotion ? (
            // Static version for reduced motion preference
            <>
              <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-primary-500/20 rounded-full blur-[100px]" />
              <div className="absolute top-1/3 right-1/4 w-[400px] h-[400px] bg-servio-orange-500/15 rounded-full blur-[100px]" />
              <div className="absolute bottom-0 left-1/3 w-[600px] h-[600px] bg-servio-purple-500/10 rounded-full blur-[120px]" />
            </>
          ) : (
            // Animated version
            <>
              <motion.div
                className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-primary-500/20 rounded-full blur-[100px]"
                animate={{
                  x: [0, 50, 0],
                  y: [0, 30, 0],
                  scale: [1, 1.2, 1],
                }}
                transition={{ duration: 10, repeat: Infinity }}
              />
              <motion.div
                className="absolute top-1/3 right-1/4 w-[400px] h-[400px] bg-servio-orange-500/15 rounded-full blur-[100px]"
                animate={{
                  x: [0, -40, 0],
                  y: [0, 40, 0],
                  scale: [1, 1.3, 1],
                }}
                transition={{ duration: 8, repeat: Infinity }}
              />
              <motion.div
                className="absolute bottom-0 left-1/3 w-[600px] h-[600px] bg-servio-purple-500/10 rounded-full blur-[120px]"
                animate={{
                  x: [0, 60, 0],
                  y: [0, -30, 0],
                  scale: [1, 1.1, 1],
                }}
                transition={{ duration: 12, repeat: Infinity }}
              />
            </>
          )}
        </div>

        {/* Skip Navigation Links */}
        <a 
          href="#main-content" 
          className="skip-link"
          onClick={(e) => {
            e.preventDefault()
            document.getElementById('main-content')?.focus()
          }}
        >
          Skip to main content
        </a>

        {/* Navigation */}
        <nav 
          id="main-navigation"
          role="navigation"
          aria-label="Main navigation"
          className="fixed top-0 left-0 right-0 bg-gray-900/80 backdrop-blur-xl border-b border-white/10 z-50"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16" id="top">
              <div className="flex items-center">
                <Link 
                  href="/"
                  className="flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 rounded-lg"
                  aria-label="Servio - Home"
                >
                  <motion.div
                    whileHover={shouldReduceMotion ? undefined : { scale: 1.05 }}
                    transition={{ type: "spring", stiffness: 400 }}
                  >
                    <Image
                      src="/images/servio_icon_tight.png"
                      alt=""
                      width={36}
                      height={36}
                      className="h-9 w-auto"
                      priority
                    />
                  </motion.div>
                  <span className="ml-3 text-xl font-bold text-white">Servio</span>
                </Link>
              </div>

              {/* Desktop Navigation */}
              <div className="hidden md:flex items-center space-x-8" role="menubar">
                {[
                  { href: '#top', label: 'Home' },
                  { href: '#services', label: 'Services' },
                  { href: '#features', label: 'Features' },
                  { href: '#pricing', label: 'Pricing' },
                  { href: '#faq', label: 'FAQ' },
                ].map((item) => (
                  <a 
                    key={item.href}
                    href={item.href}
                    role="menuitem"
                    aria-current={activeSection === item.href.slice(1) ? 'page' : undefined}
                    className={`font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 rounded-md px-2 py-1 ${
                      activeSection === item.href.slice(1) 
                        ? 'text-white' 
                        : 'text-gray-300 hover:text-white'
                    }`}
                  >
                    {item.label}
                  </a>
                ))}
                <Link 
                  href="/login" 
                  role="menuitem"
                  className="text-gray-300 hover:text-white font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 rounded-md px-2 py-1"
                >
                  Login
                </Link>
                <Link
                  href="/dashboard/assistant"
                  role="menuitem"
                  className="bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white px-5 py-2 rounded-xl font-semibold transition-all duration-300 shadow-lg shadow-primary-500/25 hover:shadow-primary-500/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
                >
                  Get Started
                </Link>
              </div>

              {/* Mobile Menu Button */}
              <button
                ref={closeButtonRef}
                onClick={() => setMobileMenuOpen(true)}
                className="md:hidden p-2 rounded-lg text-gray-300 hover:text-white hover:bg-white/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                aria-label="Open navigation menu"
                aria-expanded={mobileMenuOpen}
                aria-controls="mobile-menu"
              >
                <Menu className="w-6 h-6" aria-hidden="true" />
              </button>
            </div>
          </div>
        </nav>

        {/* Mobile Menu Overlay */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setMobileMenuOpen(false)}
                className="fixed inset-0 bg-black/60 z-50 md:hidden backdrop-blur-sm"
                aria-hidden="true"
              />
              
              {/* Drawer */}
              <motion.div
                id="mobile-menu"
                ref={menuRef}
                role="dialog"
                aria-modal="true"
                aria-label="Navigation menu"
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className="fixed top-0 right-0 bottom-0 w-3/4 max-w-sm bg-gray-900 border-l border-white/10 z-50 md:hidden"
              >
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                  <span className="text-lg font-bold text-white">Menu</span>
                  <button
                    ref={closeButtonRef}
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-2 rounded-lg text-gray-300 hover:text-white hover:bg-white/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                    aria-label="Close navigation menu"
                  >
                    <X className="w-6 h-6" aria-hidden="true" />
                  </button>
                </div>
                
                <nav className="flex flex-col p-4 space-y-1" role="menu">
                  {[
                    { href: '#top', label: 'Home' },
                    { href: '#services', label: 'Services' },
                    { href: '#features', label: 'Features' },
                    { href: '#pricing', label: 'Pricing' },
                    { href: '#faq', label: 'FAQ' },
                  ].map((item) => (
                    <a
                      key={item.href}
                      href={item.href}
                      role="menuitem"
                      onClick={() => setMobileMenuOpen(false)}
                      className="px-4 py-3 rounded-xl text-gray-300 hover:text-white hover:bg-white/10 font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                    >
                      {item.label}
                    </a>
                  ))}
                  <Link
                    href="/dashboard/assistant"
                    role="menuitem"
                    className="px-4 py-3 rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 text-white font-semibold text-center transition-colors mt-4 shadow-lg shadow-primary-500/25"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Get Started
                  </Link>
                </nav>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Main Content */}
        <main id="main-content" tabIndex={-1}>
          {/* Hero Section */}
          <section 
            id="hero" 
            className="relative min-h-screen flex items-center justify-center overflow-x-hidden py-24 md:py-0 pt-20"
            aria-labelledby="hero-heading"
          >
            {/* Background Image with Overlay - Using CSS gradient as fallback for performance */}
            <div className="absolute inset-0" aria-hidden="true">
              <div 
                className="w-full h-full bg-cover bg-center"
                style={{
                  backgroundImage: 'url(/images/hero_background.png)',
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-b from-gray-900/80 via-gray-900/60 to-gray-900/90" />
            </div>

            <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
              <motion.div
                initial={shouldReduceMotion ? undefined : { opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
                className="space-y-10 md:space-y-12"
              >
                {/* Premium Badge */}
                <motion.div
                  initial={shouldReduceMotion ? undefined : { opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-primary-500/20 to-servio-purple-500/20 border border-primary-500/30 text-primary-300 text-sm font-medium backdrop-blur-sm"
                >
                  <Sparkles className="w-4 h-4 text-primary-400" aria-hidden="true" />
                  Restaurant Operating System
                </motion.div>

                <h1 
                  id="hero-heading"
                  className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black mb-6 leading-tight"
                >
                  The premium, <span className="text-gradient">voice-first</span><br className="hidden sm:block" />
                  platform for restaurant teams.
                </h1>

                <motion.p
                  className="text-lg sm:text-xl md:text-2xl text-gray-300 max-w-4xl mx-auto leading-relaxed"
                  initial={shouldReduceMotion ? undefined : { opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  Servio unifies orders, inventory, staff operations, and communications into a single, beautiful app-like system.
                </motion.p>

                <motion.div
                  className="flex flex-col sm:flex-row gap-4 sm:gap-6 justify-center items-center"
                  initial={shouldReduceMotion ? undefined : { opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                >
                  <Link
                    href="/dashboard/assistant"
                    className="group relative inline-flex items-center gap-3 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white px-8 py-4 rounded-2xl font-bold text-lg transition-all duration-300 shadow-2xl shadow-primary-500/30 hover:shadow-primary-500/50 hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
                  >
                    {!shouldReduceMotion && (
                      <motion.div
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      >
                        <Mic className="w-6 h-6" aria-hidden="true" />
                      </motion.div>
                    )}
                    {shouldReduceMotion && <Mic className="w-6 h-6" aria-hidden="true" />}
                    <span>Get Started Free</span>
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
                  </Link>

                  <Link
                    href="/book-demo"
                    className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl font-bold text-lg text-white border-2 border-white/20 hover:border-white/40 hover:bg-white/10 transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
                  >
                    <PlayCircle className="w-6 h-6" aria-hidden="true" />
                    Book Demo
                  </Link>
                </motion.div>

                {/* Social Proof */}
                <motion.div
                  className="flex flex-col items-center pt-8"
                  initial={shouldReduceMotion ? undefined : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 }}
                >
                  <div className="flex items-center gap-1 mb-3" aria-label="5 star rating">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star 
                        key={star} 
                        className="w-6 h-6 text-yellow-400 fill-yellow-400" 
                        aria-hidden="true" 
                      />
                    ))}
                  </div>
                  <p className="text-gray-400">
                    4.9/5 from <span className="text-white font-semibold">200+ restaurants</span> nationwide
                  </p>
                </motion.div>

                {/* Hero Dashboard Preview */}
                <motion.div
                  initial={shouldReduceMotion ? undefined : { opacity: 0, y: 40 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.4 }}
                  className="relative mx-auto max-w-6xl mt-12"
                >
                  {/* Glow effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-primary-500/20 via-servio-purple-500/10 to-servio-orange-500/20 rounded-3xl blur-2xl" aria-hidden="true" />

                  <div className="relative bg-white rounded-3xl shadow-2xl p-2 border border-white/20">
                    <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-5 sm:p-8">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-6">
                        {/* Voice Interface */}
                        <motion.div
                          className="bg-white p-4 sm:p-6 rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl transition-shadow"
                          whileHover={shouldReduceMotion ? undefined : { y: -2 }}
                        >
                          <div className="flex items-center mb-4">
                            <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse mr-2 shadow-glow" aria-hidden="true" />
                            <span className="text-sm font-semibold text-gray-700">Voice Active</span>
                          </div>
                          <div className="text-center">
                            <div className="w-16 h-16 bg-gradient-to-br from-primary-100 to-primary-200 rounded-2xl flex items-center justify-center mx-auto mb-3">
                              <Mic className="w-8 h-8 text-primary-600" aria-hidden="true" />
                            </div>
                            <p className="text-sm text-gray-600 font-medium">"86 the jerk chicken on all platforms"</p>
                          </div>
                        </motion.div>

                        {/* Order Queue */}
                        <motion.div
                          className="bg-white p-4 sm:p-6 rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl transition-shadow"
                          whileHover={shouldReduceMotion ? undefined : { y: -2 }}
                        >
                          <h3 className="font-semibold text-gray-900 mb-4">Live Orders</h3>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between p-3 bg-servio-orange-50 rounded-xl">
                              <span className="text-sm font-medium text-gray-700">Order #214</span>
                              <span className="text-xs font-medium text-servio-orange-600 bg-servio-orange-100 px-2 py-1 rounded-full">Preparing</span>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-servio-green-50 rounded-xl">
                              <span className="text-sm font-medium text-gray-700">Order #215</span>
                              <span className="text-xs font-medium text-servio-green-600 bg-servio-green-100 px-2 py-1 rounded-full">Ready</span>
                            </div>
                          </div>
                        </motion.div>

                        {/* Staff Status */}
                        <motion.div
                          className="bg-white p-4 sm:p-6 rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl transition-shadow"
                          whileHover={shouldReduceMotion ? undefined : { y: -2 }}
                        >
                          <h3 className="font-semibold text-gray-900 mb-4">Staff Status</h3>
                          <div className="flex items-center space-x-2 p-3 bg-primary-50 rounded-xl">
                            <Users className="w-5 h-5 text-primary-600" aria-hidden="true" />
                            <span className="text-sm font-medium text-gray-700">5 working • 1 on break</span>
                          </div>
                          <div className="mt-3 flex items-center space-x-2 p-3 bg-surface-50 rounded-xl">
                            <Clock className="w-5 h-5 text-servio-green-600" aria-hidden="true" />
                            <span className="text-sm font-medium text-gray-700">32.5 hours today</span>
                          </div>
                        </motion.div>
                      </div>

                      <div className="text-center">
                        <p className="text-gray-500 text-sm font-medium">Real-time restaurant operations dashboard</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            </div>
          </section>

          {/* Trust Signals Section */}
          <TrustSignals variant="full" />

          {/* Phone Orders Section */}
          <section id="services" className="py-20 md:py-32 bg-gradient-to-b from-gray-900 to-gray-850" aria-labelledby="services-heading">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 md:gap-20 items-center">
                <div className="space-y-8">
                  <motion.div
                    initial={shouldReduceMotion ? undefined : { opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                  >
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border border-blue-500/30 text-blue-200 text-sm font-medium mb-6">
                      <Phone className="w-4 h-4" aria-hidden="true" />
                      AI Phone Answering
                    </div>
                    <h2 id="services-heading" className="text-4xl sm:text-5xl md:text-5xl font-bold text-white leading-tight">
                      We answer every call<br />
                      <span className="text-gradient">and take the order for you.</span>
                    </h2>
                  </motion.div>

                  <motion.p
                    className="text-lg text-gray-300 leading-relaxed"
                    initial={shouldReduceMotion ? undefined : { opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.2 }}
                  >
                    Servio's AI voice agent picks up in two rings, speaks naturally, captures the order, respects your hours, syncs availability, and pushes tickets into your POS and delivery platforms—so no call or revenue is missed.
                  </motion.p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[
                      { icon: Phone, label: '2-ring auto-answer', color: 'text-blue-400', bg: 'bg-blue-500/20' },
                      { icon: ShoppingCart, label: 'Full menu ordering', color: 'text-primary-400', bg: 'bg-primary-500/20' },
                      { icon: RefreshCw, label: 'POS + delivery sync', color: 'text-servio-orange-400', bg: 'bg-servio-orange-500/20' },
                      { icon: MessageSquare, label: 'SMS confirm + handoff', color: 'text-servio-green-400', bg: 'bg-servio-green-500/20' }
                    ].map((item, idx) => (
                      <motion.div
                        key={idx}
                        className="flex items-center space-x-3 bg-white/5 border border-white/10 rounded-2xl px-5 py-4 hover:bg-white/10 transition-colors"
                        initial={shouldReduceMotion ? undefined : { opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.1 * idx }}
                      >
                        <div className={`p-2 rounded-lg ${item.bg}`}>
                          <item.icon className={`w-5 h-5 ${item.color}`} aria-hidden="true" />
                        </div>
                        <span className="text-sm font-medium text-gray-300">{item.label}</span>
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* Phone Mockup */}
                <motion.div
                  initial={shouldReduceMotion ? undefined : { opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  className="relative"
                >
                  <div className="relative mx-auto w-72 h-[580px]">
                    {/* Phone frame */}
                    <div className="absolute inset-0 bg-gray-800 rounded-[3rem] shadow-2xl border-4 border-gray-700">
                      {/* Notch */}
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-7 bg-gray-900 rounded-b-2xl" />
                      
                      {/* Screen */}
                      <div className="absolute inset-4 bg-gray-900 rounded-[2.5rem] overflow-hidden">
                        <div className="h-full flex flex-col">
                          {/* Status bar */}
                          <div className="flex items-center justify-between px-6 py-2 text-xs text-gray-400">
                            <span>9:41</span>
                            <div className="flex items-center gap-1">
                              <div className="w-4 h-2 border border-gray-400 rounded-sm">
                                <div className="h-full w-3/4 bg-gray-400 rounded-sm" />
                              </div>
                            </div>
                          </div>
                          
                          {/* Call UI */}
                          <div className="flex-1 flex flex-col items-center justify-center p-6">
                            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center mb-4">
                              <Phone className="w-10 h-10 text-white" aria-hidden="true" />
                            </div>
                            <p className="text-white font-semibold text-lg mb-1">Incoming Order</p>
                            <p className="text-gray-400 text-sm mb-6">(555) 123-4567</p>
                            
                            <div className="flex items-center gap-8">
                              <button className="w-14 h-14 rounded-full bg-red-500 flex items-center justify-center" aria-label="Decline call">
                                <X className="w-6 h-6 text-white" />
                              </button>
                              <button className="w-14 h-14 rounded-full bg-green-500 flex items-center justify-center animate-pulse" aria-label="Accept call">
                                <Phone className="w-6 h-6 text-white" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>
          </section>

          {/* Features Section */}
          <section id="features" className="py-20 md:py-32 bg-gray-900" aria-labelledby="features-heading">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center mb-16">
                <motion.div
                  initial={shouldReduceMotion ? undefined : { opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                >
                  <h2 id="features-heading" className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4">
                    Everything you need to run your restaurant
                  </h2>
                  <p className="text-lg text-gray-400 max-w-2xl mx-auto">
                    From voice-activated commands to real-time analytics, Servio has all the tools you need.
                  </p>
                </motion.div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[
                  { icon: Mic, title: 'Voice Assistant', description: 'Control your entire restaurant with natural voice commands.', color: 'from-primary-500 to-primary-600' },
                  { icon: ShoppingCart, title: 'Order Management', description: 'Handle all orders from one unified dashboard.', color: 'from-servio-orange-500 to-servio-orange-600' },
                  { icon: Users, title: 'Staff Scheduling', description: 'Create and manage shifts with ease.', color: 'from-blue-500 to-blue-600' },
                  { icon: Package, title: 'Inventory Tracking', description: 'Real-time stock levels and automated reordering.', color: 'from-servio-green-500 to-servio-green-600' },
                  { icon: BarChart3, title: 'Analytics', description: 'Deep insights into your restaurant\'s performance.', color: 'from-servio-purple-500 to-servio-purple-600' },
                  { icon: Shield, title: 'Secure & Reliable', description: '99.9% uptime with enterprise-grade security.', color: 'from-gray-500 to-gray-600' },
                ].map((feature, idx) => (
                  <motion.div
                    key={idx}
                    className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-colors"
                    initial={shouldReduceMotion ? undefined : { opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: idx * 0.1 }}
                  >
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4`}>
                      <feature.icon className="w-6 h-6 text-white" aria-hidden="true" />
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                    <p className="text-gray-400">{feature.description}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>

          {/* Testimonials Section */}
          <section className="py-20 md:py-32 bg-gradient-to-b from-gray-900 to-gray-800" aria-labelledby="testimonials-heading">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center mb-12">
                <h2 id="testimonials-heading" className="text-3xl sm:text-4xl font-bold text-white mb-4">
                  Loved by restaurants everywhere
                </h2>
                <p className="text-gray-400">See what our customers have to say</p>
              </div>
              <TestimonialCarousel variant="cards" />
            </div>
          </section>

          {/* Pricing Section */}
          <section id="pricing" className="py-20 md:py-32 bg-gray-900" aria-labelledby="pricing-heading">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center mb-16">
                <h2 id="pricing-heading" className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4">
                  Simple, transparent pricing
                </h2>
                <p className="text-lg text-gray-400 max-w-2xl mx-auto">
                  Start free, upgrade when you're ready. No hidden fees.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {[
                  {
                    name: 'Starter',
                    price: '$49',
                    period: '/month',
                    description: 'Perfect for single location restaurants',
                    features: ['Voice assistant', 'Order management', 'Basic analytics', 'Email support'],
                    cta: 'Start Free Trial',
                    popular: false
                  },
                  {
                    name: 'Pro',
                    price: '$99',
                    period: '/month',
                    description: 'For growing restaurants with multiple locations',
                    features: ['Everything in Starter', 'Multi-location support', 'Advanced analytics', 'Priority support', 'Custom integrations'],
                    cta: 'Start Free Trial',
                    popular: true
                  },
                  {
                    name: 'Enterprise',
                    price: 'Custom',
                    period: '',
                    description: 'For large restaurant groups and chains',
                    features: ['Everything in Pro', 'Unlimited locations', 'Dedicated account manager', 'Custom development', 'SLA guarantee'],
                    cta: 'Contact Sales',
                    popular: false
                  }
                ].map((plan, idx) => (
                  <motion.div
                    key={idx}
                    className={`relative rounded-2xl p-8 ${
                      plan.popular 
                        ? 'bg-gradient-to-b from-primary-500/20 to-primary-600/10 border-2 border-primary-500' 
                        : 'bg-white/5 border border-white/10'
                    }`}
                    initial={shouldReduceMotion ? undefined : { opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: idx * 0.1 }}
                  >
                    {plan.popular && (
                      <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-primary-500 text-white text-sm font-semibold rounded-full">
                        Most Popular
                      </div>
                    )}
                    <h3 className="text-xl font-semibold text-white mb-2">{plan.name}</h3>
                    <div className="flex items-baseline mb-4">
                      <span className="text-4xl font-bold text-white">{plan.price}</span>
                      <span className="text-gray-400 ml-1">{plan.period}</span>
                    </div>
                    <p className="text-gray-400 mb-6">{plan.description}</p>
                    <ul className="space-y-3 mb-8">
                      {plan.features.map((feature, fidx) => (
                        <li key={fidx} className="flex items-center gap-2 text-gray-300">
                          <CheckCircle2 className="w-5 h-5 text-primary-500 flex-shrink-0" aria-hidden="true" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                    <Link
                      href={plan.name === 'Enterprise' ? '/book-demo' : '/dashboard/assistant'}
                      className={`block w-full text-center py-3 rounded-xl font-semibold transition-all ${
                        plan.popular
                          ? 'bg-primary-500 hover:bg-primary-600 text-white'
                          : 'bg-white/10 hover:bg-white/20 text-white'
                      }`}
                    >
                      {plan.cta}
                    </Link>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>

          {/* FAQ Section */}
          <FAQSection showSearch={true} groupByCategory={true} showContactCTA={true} />
        </main>

        {/* Footer */}
        <footer className="bg-gray-900 border-t border-white/10 py-12" role="contentinfo">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              <div>
                <div className="flex items-center mb-4">
                  <Image
                    src="/images/servio_icon_tight.png"
                    alt=""
                    width={32}
                    height={32}
                    className="h-8 w-auto"
                  />
                  <span className="ml-2 text-lg font-bold text-white">Servio</span>
                </div>
                <p className="text-gray-400 text-sm">
                  The premium, voice-first platform for restaurant teams.
                </p>
              </div>
              
              <div>
                <h4 className="text-white font-semibold mb-4">Product</h4>
                <ul className="space-y-2">
                  <li><a href="#features" className="text-gray-400 hover:text-white transition-colors">Features</a></li>
                  <li><a href="#pricing" className="text-gray-400 hover:text-white transition-colors">Pricing</a></li>
                  <li><a href="#faq" className="text-gray-400 hover:text-white transition-colors">FAQ</a></li>
                </ul>
              </div>
              
              <div>
                <h4 className="text-white font-semibold mb-4">Company</h4>
                <ul className="space-y-2">
                  <li><a href="/book-demo" className="text-gray-400 hover:text-white transition-colors">Book Demo</a></li>
                  <li><a href="/login" className="text-gray-400 hover:text-white transition-colors">Login</a></li>
                </ul>
              </div>
              
              <div>
                <h4 className="text-white font-semibold mb-4">Legal</h4>
                <ul className="space-y-2">
                  <li><a href="/privacy-policy" className="text-gray-400 hover:text-white transition-colors">Privacy Policy</a></li>
                  <li><a href="/terms-and-conditions" className="text-gray-400 hover:text-white transition-colors">Terms of Service</a></li>
                </ul>
              </div>
            </div>
            
            <div className="mt-12 pt-8 border-t border-white/10 text-center text-gray-400 text-sm">
              <p>&copy; {new Date().getFullYear()} Servio. All rights reserved.</p>
            </div>
          </div>
        </footer>

        {/* Sticky CTA */}
        <StickyCTA
          text="Start Free Trial"
          href="/dashboard/assistant"
          scrollThreshold={400}
          variant="gradient"
          dismissible
        />

        {/* Exit Intent Popup */}
        <ExitIntentPopup
          title="Wait! Get 20% Off"
          subtitle="Join 500+ restaurants already using Servio to streamline operations and boost revenue."
          offer="20%"
          onSubmit={handleEmailCapture}
        />
      </div>
    </>
  )
}
