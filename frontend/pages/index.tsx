import React, { useEffect, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Mic, Bot, Shield, Zap, Clock, Users,
  Phone, Smartphone, RefreshCw, BarChart3,
  CheckCircle2, MessageSquare, Headphones,
  Utensils, ShoppingCart, Package,
  Calendar, DollarSign, TrendingUp,
  ArrowRight, PlayCircle, Star, Menu, X, Sparkles
} from 'lucide-react'


interface PublicPricingPlan {
  id: string
  name: string
  slug: string
  description?: string
  price_monthly: number
  is_featured?: boolean
  features?: string[]
}

export default function HomePage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [pricingPlans, setPricingPlans] = useState<PublicPricingPlan[]>([])
  const [isSmallScreen, setIsSmallScreen] = useState(false)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return

    const reducedMotionMedia = window.matchMedia('(prefers-reduced-motion: reduce)')
    const smallScreenMedia = window.matchMedia('(max-width: 767px)')

    const updateAnimationPreferences = () => {
      setPrefersReducedMotion(reducedMotionMedia.matches)
      setIsSmallScreen(smallScreenMedia.matches)
    }

    updateAnimationPreferences()

    reducedMotionMedia.addEventListener('change', updateAnimationPreferences)
    smallScreenMedia.addEventListener('change', updateAnimationPreferences)

    return () => {
      reducedMotionMedia.removeEventListener('change', updateAnimationPreferences)
      smallScreenMedia.removeEventListener('change', updateAnimationPreferences)
    }
  }, [])

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL
    if (!base) return
    const normalized = base.startsWith('http') ? base : `https://${base}`

    fetch(`${normalized}/api/public/pricing-structures`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data?.plans) && data.plans.length > 0) {
          setPricingPlans(data.plans)
        }
      })
      .catch(() => undefined)
  }, [])

  const renderAnimatedBlob = (
    positionClasses: string,
    colorClasses: string,
    desktopSize: number,
    desktopBlur: number,
    motionConfig: { x: number[]; y: number[]; scale?: number[] },
    duration: number,
    mobileVisible = true,
  ) => {
    if (isSmallScreen && !mobileVisible) {
      return null
    }

    const size = isSmallScreen ? Math.round(desktopSize * 0.55) : desktopSize
    const blur = isSmallScreen ? Math.round(desktopBlur * 0.5) : desktopBlur

    const baseClasses = `absolute ${positionClasses} ${colorClasses} rounded-full`
    const blobStyle = { width: size, height: size, filter: `blur(${blur}px)` }

    if (prefersReducedMotion) {
      return <div className={baseClasses} style={blobStyle} />
    }

    const mobileMotion = {
      x: motionConfig.x.map((value) => Math.round(value * 0.4)),
      y: motionConfig.y.map((value) => Math.round(value * 0.4)),
      ...(motionConfig.scale ? { scale: [1, 1.05, 1] } : {}),
    }

    return (
      <motion.div
        className={baseClasses}
        style={blobStyle}
        animate={isSmallScreen ? mobileMotion : motionConfig}
        transition={{ duration: isSmallScreen ? duration * 1.6 : duration, repeat: Infinity }}
      />
    )
  }

  return (
    <>
      <Head>
        <title>Servio - Restaurant Operating System | Voice-First Operations</title>
        <meta name="description" content="Servio is a restaurant operating system that unifies orders, menu updates, marketing, inventory + receipts, staff operations, and integrations in one dashboard—with an AI assistant for fast, hands-free execution." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta property="og:title" content="Servio - Restaurant Operating System" />
        <meta property="og:description" content="Restaurant operating system with an AI assistant. Run orders, menu, marketing, inventory + receipts, staff ops, and integrations from one dashboard." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://servio.com" />
      </Head>

        <div className="min-h-screen bg-gray-900 text-white overflow-x-hidden">
          {/* Animated Background Blobs */}
          <div className="fixed inset-0 pointer-events-none overflow-hidden">
            {renderAnimatedBlob('top-0 left-1/4', 'bg-primary-500/20', 500, 100, {
              x: [0, 50, 0],
              y: [0, 30, 0],
              scale: [1, 1.2, 1],
            }, 10)}
            {renderAnimatedBlob('top-1/3 right-1/4', 'bg-servio-orange-500/15', 400, 100, {
              x: [0, -40, 0],
              y: [0, 40, 0],
              scale: [1, 1.3, 1],
            }, 8, false)}
            {renderAnimatedBlob('bottom-0 left-1/3', 'bg-servio-purple-500/10', 600, 120, {
              x: [0, 60, 0],
              y: [0, -30, 0],
              scale: [1, 1.1, 1],
            }, 12)}
          </div>

          {/* Navigation */}
          <nav className="fixed top-0 left-0 right-0 bg-gray-900/80 backdrop-blur-xl border-b border-white/10 z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center h-16" id="top">
                <div className="flex items-center">
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    transition={{ type: "spring", stiffness: 400 }}
                  >
                    <img
                      src="/images/servio_icon_tight.png"
                      alt="Servio Logo"
                      className="h-9 w-auto"
                    />
                  </motion.div>
                  <span className="ml-3 text-xl font-bold text-white">Servio</span>
                </div>

                {/* Desktop Navigation */}
                <div className="hidden md:flex items-center space-x-8">
                  <a href="#top" className="text-gray-300 hover:text-white font-medium transition-colors">Home</a>
                  <a href="#services" className="text-gray-300 hover:text-white font-medium transition-colors">Services</a>
                  <a href="#features" className="text-gray-300 hover:text-white font-medium transition-colors">Features</a>
                  <a href="#pricing" className="text-gray-300 hover:text-white font-medium transition-colors">Pricing</a>
                  <a href="#faq" className="text-gray-300 hover:text-white font-medium transition-colors">FAQ</a>
                  <Link href="/login" className="text-gray-300 hover:text-white font-medium transition-colors">Login</Link>
                  <Link
                    href="/dashboard/assistant"
                    className="bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white px-5 py-2 rounded-xl font-semibold transition-all duration-300 shadow-lg shadow-primary-500/25 hover:shadow-primary-500/40"
                  >
                    Get Started
                  </Link>
                </div>

                {/* Mobile Menu Button */}
                <button
                  onClick={() => setMobileMenuOpen(true)}
                  className="md:hidden p-2 rounded-lg text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
                  aria-label="Open menu"
                >
                  <Menu className="w-6 h-6" />
                </button>
              </div>
            </div>
          </nav>

        {/* Mobile Menu Overlay */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setMobileMenuOpen(false)}
                className="fixed inset-0 bg-black/60 z-50 md:hidden backdrop-blur-sm"
              />
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'tween', duration: 0.3 }}
                className="fixed top-0 right-0 bottom-0 w-3/4 max-w-sm bg-gray-900 border-l border-white/10 z-50 md:hidden"
              >
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                  <span className="text-lg font-bold text-white">Menu</span>
                  <button
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-2 rounded-lg text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
                    aria-label="Close menu"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
                <nav className="flex flex-col p-4 space-y-1">
                  <a
                    href="#top"
                    onClick={() => setMobileMenuOpen(false)}
                    className="px-4 py-3 rounded-xl text-gray-300 hover:text-white hover:bg-white/10 font-medium transition-colors"
                  >
                    Home
                  </a>
                  <a
                    href="#services"
                    onClick={() => setMobileMenuOpen(false)}
                    className="px-4 py-3 rounded-xl text-gray-300 hover:text-white hover:bg-white/10 font-medium transition-colors"
                  >
                    Services
                  </a>
                  <a
                    href="#features"
                    onClick={() => setMobileMenuOpen(false)}
                    className="px-4 py-3 rounded-xl text-gray-300 hover:text-white hover:bg-white/10 font-medium transition-colors"
                  >
                    Features
                  </a>
                  <a
                    href="#pricing"
                    onClick={() => setMobileMenuOpen(false)}
                    className="px-4 py-3 rounded-xl text-gray-300 hover:text-white hover:bg-white/10 font-medium transition-colors"
                  >
                    Pricing
                  </a>
                  <a
                    href="#faq"
                    onClick={() => setMobileMenuOpen(false)}
                    className="px-4 py-3 rounded-xl text-gray-300 hover:text-white hover:bg-white/10 font-medium transition-colors"
                  >
                    FAQ
                  </a>
                  <Link
                    href="/dashboard/assistant"
                    className="px-4 py-3 rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 text-white font-semibold text-center transition-colors mt-4 shadow-lg shadow-primary-500/25"
                  >
                    Get Started
                  </Link>
                </nav>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Hero Section */}
        <div className="relative min-h-screen flex items-center justify-center overflow-x-hidden py-24 md:py-0 pt-20">
          {/* Background Image with Overlay */}
          <div className="absolute inset-0">
            <img
              src="/images/hero_background.png"
              alt="Restaurant Kitchen"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-gray-900/80 via-gray-900/60 to-gray-900/90" />
          </div>

          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="space-y-10 md:space-y-12"
            >
              {/* Premium Badge */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-primary-500/20 to-servio-purple-500/20 border border-primary-500/30 text-primary-300 text-sm font-medium backdrop-blur-sm"
              >
                <Sparkles className="w-4 h-4 text-primary-400" />
                Restaurant Operating System
              </motion.div>

              <motion.h1
                className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black mb-6 leading-tight"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                The premium, <span className="text-gradient">voice-first</span><br className="hidden sm:block" />
                platform for restaurant teams.
              </motion.h1>

              <motion.p
                className="text-lg sm:text-xl md:text-2xl text-gray-300 max-w-4xl mx-auto leading-relaxed"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                Servio unifies orders, inventory, staff operations, and communications into a single, beautiful app-like system.
              </motion.p>

              <motion.div
                className="flex flex-col sm:flex-row gap-4 sm:gap-6 justify-center items-center"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <Link
                  href="/dashboard/assistant"
                  className="group relative inline-flex items-center gap-3 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white px-8 py-4 rounded-2xl font-bold text-lg transition-all duration-300 shadow-2xl shadow-primary-500/30 hover:shadow-primary-500/50 hover:scale-105"
                >
                  <motion.div
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <Mic className="w-6 h-6" />
                  </motion.div>
                  <span>Get Started Free</span>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Link>

                <Link
                  href="/book-demo"
                  className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl font-bold text-lg text-white border-2 border-white/20 hover:border-white/40 hover:bg-white/10 transition-all duration-300"
                >
                  <PlayCircle className="w-6 h-6" />
                  Book Demo
                </Link>
              </motion.div>

              {/* Social Proof */}
              <motion.div
                className="flex flex-col items-center pt-8"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
              >
                <div className="flex items-center gap-1 mb-3">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <motion.div
                      key={star}
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.7 + star * 0.1 }}
                    >
                      <Star className="w-6 h-6 text-yellow-400 fill-yellow-400" />
                    </motion.div>
                  ))}
                </div>
                <p className="text-gray-400">4.9/5 from <span className="text-white font-semibold">200+ restaurants</span> nationwide</p>
              </motion.div>

              {/* Hero Dashboard Preview */}
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.4 }}
                className="relative mx-auto max-w-6xl mt-12"
              >
                {/* Glow effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-primary-500/20 via-servio-purple-500/10 to-servio-orange-500/20 rounded-3xl blur-2xl" />

                <div className="relative bg-white rounded-3xl shadow-2xl p-2 border border-white/20">
                  <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-5 sm:p-8">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-6">
                      {/* Voice Interface */}
                      <motion.div
                        className="bg-white p-4 sm:p-6 rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl transition-shadow"
                        whileHover={{ y: -2 }}
                      >
                        <div className="flex items-center mb-4">
                          <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse mr-2 shadow-glow" />
                          <span className="text-sm font-semibold text-gray-700">Voice Active</span>
                        </div>
                        <div className="text-center">
                          <div className="w-16 h-16 bg-gradient-to-br from-primary-100 to-primary-200 rounded-2xl flex items-center justify-center mx-auto mb-3">
                            <Mic className="w-8 h-8 text-primary-600" />
                          </div>
                          <p className="text-sm text-gray-600 font-medium">"86 the jerk chicken on all platforms"</p>
                        </div>
                      </motion.div>

                      {/* Order Queue */}
                      <motion.div
                        className="bg-white p-4 sm:p-6 rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl transition-shadow"
                        whileHover={{ y: -2 }}
                      >
                        <h3 className="font-semibold text-gray-900 mb-4">Live Orders</h3>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between p-3 bg-servio-orange-50 rounded-xl">
                            <span className="text-sm font-medium text-gray-700">Order #214</span>
                            <span className="status-warning">Preparing</span>
                          </div>
                          <div className="flex items-center justify-between p-3 bg-servio-green-50 rounded-xl">
                            <span className="text-sm font-medium text-gray-700">Order #215</span>
                            <span className="status-success">Ready</span>
                          </div>
                        </div>
                      </motion.div>

                      {/* Staff Status */}
                      <motion.div
                        className="bg-white p-4 sm:p-6 rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl transition-shadow"
                        whileHover={{ y: -2 }}
                      >
                        <h3 className="font-semibold text-gray-900 mb-4">Staff Status</h3>
                        <div className="flex items-center space-x-2 p-3 bg-primary-50 rounded-xl">
                          <Users className="w-5 h-5 text-primary-600" />
                          <span className="text-sm font-medium text-gray-700">5 working • 1 on break</span>
                        </div>
                        <div className="mt-3 flex items-center space-x-2 p-3 bg-surface-50 rounded-xl">
                          <Clock className="w-5 h-5 text-servio-green-600" />
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
        </div>

        {/* Phone Orders Section */}
        <section id="phone-orders" className="py-20 md:py-32 bg-gradient-to-b from-gray-900 to-gray-850">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 md:gap-20 items-center">
              <div className="space-y-8">
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6 }}
                >
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border border-blue-500/30 text-blue-200 text-sm font-medium mb-6">
                    <Phone className="w-4 h-4" />
                    AI Phone Answering
                  </div>
                  <h2 className="text-4xl sm:text-5xl md:text-5xl font-bold text-white leading-tight">
                    We answer every call<br />
                    <span className="text-gradient">and take the order for you.</span>
                  </h2>
                </motion.div>

                <motion.p
                  className="text-lg text-gray-300 leading-relaxed"
                  initial={{ opacity: 0, y: 20 }}
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
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.3 + idx * 0.1 }}
                    >
                      <div className={`p-2.5 rounded-xl ${item.bg}`}>
                        <item.icon className={`w-5 h-5 ${item.color}`} />
                      </div>
                      <span className="text-gray-200 font-medium">{item.label}</span>
                    </motion.div>
                  ))}
                </div>

                <motion.div
                  className="flex flex-col sm:flex-row gap-4"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.5 }}
                >
                  <Link
                    href="/book-demo"
                    className="btn-primary inline-flex items-center justify-center gap-2"
                  >
                    Book a phone demo
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                  <Link
                    href="/dashboard/assistant"
                    className="btn-ghost inline-flex items-center justify-center gap-2 border border-white/20 hover:bg-white/10"
                  >
                    Try the voice agent
                  </Link>
                </motion.div>

                <div className="flex items-center space-x-6 text-sm text-gray-400">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-primary-400 rounded-full animate-pulse" />
                    <span>Live coverage 7a-11p</span>
                  </div>
                  <span className="text-gray-600">•</span>
                  <span>English + Spanish supported</span>
                </div>
              </div>

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
              >
                <div className="relative">
                  {/* Glow effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-primary-500/20 to-servio-orange-500/20 rounded-3xl blur-xl" />

                  <div className="relative bg-gray-800/80 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl">
                    <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/10">
                      <div className="flex items-center space-x-3">
                        <div className="w-3 h-3 bg-primary-400 rounded-full animate-pulse" />
                        <span className="text-sm text-gray-300 font-medium">LIVE CALL • SERVIO</span>
                      </div>
                      <span className="text-xs text-gray-500 px-3 py-1 bg-white/5 rounded-full">AI Agent</span>
                    </div>

                    <div className="space-y-4">
                      {[
                        { icon: Phone, color: 'text-blue-400', label: 'Agent', text: '"Thanks for calling, what can I get started for you?"' },
                        { icon: Utensils, color: 'text-primary-400', label: 'System', text: 'Captures items, modifiers, pickup vs delivery, and payment prefs.' },
                        { icon: RefreshCw, color: 'text-amber-400', label: 'Validation', text: 'Checks hours, 86\'d items, and syncs to POS + delivery partners.' },
                        { icon: MessageSquare, color: 'text-servio-green-400', label: 'Complete', text: 'Texts confirmation to guest and hands off to your kitchen queue.' }
                      ].map((step, idx) => (
                        <motion.div
                          key={idx}
                          className="flex items-start space-x-4 p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors"
                          initial={{ opacity: 0, x: 10 }}
                          whileInView={{ opacity: 1, x: 0 }}
                          viewport={{ once: true }}
                          transition={{ delay: 0.2 + idx * 0.1 }}
                        >
                          <div className={`p-2 rounded-lg bg-white/10 ${step.color}`}>
                            <step.icon className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">{step.label}</p>
                            <p className="text-sm text-gray-300">{step.text}</p>
                          </div>
                        </motion.div>
                      ))}
                    </div>

                    <div className="mt-6 grid grid-cols-2 gap-4">
                      <div className="bg-gradient-to-br from-gray-900/80 to-gray-800/80 border border-white/10 rounded-xl p-4">
                        <p className="text-xs text-gray-500 mb-1">Answer speed</p>
                        <p className="text-3xl font-bold text-white">~2 rings</p>
                        <p className="text-xs text-primary-400 mt-1">No missed revenue</p>
                      </div>
                      <div className="bg-gradient-to-br from-gray-900/80 to-gray-800/80 border border-white/10 rounded-xl p-4">
                        <p className="text-xs text-gray-500 mb-1">Call capture</p>
                        <p className="text-3xl font-bold text-white">98%</p>
                        <p className="text-xs text-servio-green-400 mt-1">with live human handoff</p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Services Section */}
        <section id="services" className="py-20 md:py-32 bg-gray-900 relative">
          {/* Background glow */}
          <div className="absolute top-1/2 left-0 w-[400px] h-[400px] bg-primary-500/10 rounded-full blur-[100px]" />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
            <motion.div
              className="text-center mb-16"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-4xl sm:text-5xl md:text-5xl font-bold text-white mb-6">What Servio runs</h2>
              <p className="text-xl text-gray-400 max-w-3xl mx-auto">
                One beautiful operating system for the work that costs you time, labor, and mistakes.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { icon: Phone, title: 'Assistant & Phone', desc: 'AI voice for calls and in-app commands—answers in two rings and executes across your menus, orders, and ops.', color: 'from-blue-500 to-indigo-600', hoverColor: 'hover:border-blue-500/50' },
                { icon: ShoppingCart, title: 'Orders', desc: 'A single view of what\'s cooking now—status, throughput, and issues.', color: 'from-primary-500 to-primary-600', hoverColor: 'hover:border-primary-500/50' },
                { icon: Utensils, title: 'Menu', desc: 'Keep categories clean and updates consistent—no more "which menu is right?"', color: 'from-amber-500 to-orange-600', hoverColor: 'hover:border-amber-500/50' },
                { icon: MessageSquare, title: 'Marketing', desc: 'Launch SMS and email campaigns that bring guests back—without extra tools.', color: 'from-pink-500 to-rose-600', hoverColor: 'hover:border-pink-500/50' },
                { icon: Users, title: 'Staff & Ops', desc: 'Run the shift: team visibility, schedules, and day-to-day operations.', color: 'from-purple-500 to-violet-600', hoverColor: 'hover:border-purple-500/50' },
                { icon: Package, title: 'Inventory', desc: 'Know what you have, what you\'re burning, and what will run out next.', color: 'from-orange-500 to-amber-600', hoverColor: 'hover:border-orange-500/50' },
                { icon: CheckCircle2, title: 'Receipts', desc: 'Upload and track invoices so costs don\'t disappear into a folder.', color: 'from-servio-green-500 to-emerald-600', hoverColor: 'hover:border-servio-green-500/50' },
                { icon: RefreshCw, title: 'Integrations', desc: 'Connect the systems you already use so data stays in sync.', color: 'from-cyan-500 to-blue-600', hoverColor: 'hover:border-cyan-500/50' },
              ].map((service, idx) => (
                <motion.div
                  key={idx}
                  className={`group relative bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 ${service.hoverColor} rounded-2xl p-8 transition-all duration-300 hover:shadow-xl hover:shadow-primary-500/10 hover:-translate-y-1`}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.1 }}
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${service.color} opacity-0 group-hover:opacity-10 rounded-2xl transition-opacity duration-300`} />

                  <div className={`w-14 h-14 bg-gradient-to-br ${service.color} rounded-2xl flex items-center justify-center mb-6 shadow-lg group-hover:shadow-xl group-hover:scale-110 transition-all duration-300`}>
                    <service.icon className="w-7 h-7 text-white" />
                  </div>

                  <h3 className="text-xl font-semibold text-white mb-3">{service.title}</h3>
                  <p className="text-gray-400 leading-relaxed group-hover:text-gray-300 transition-colors">
                    {service.desc}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Dashboard Experience Section */}
        <section className="py-20 md:py-32 bg-gradient-to-b from-gray-850 to-gray-900">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 md:gap-20 items-center">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
              >
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-primary-500/20 to-servio-orange-500/20 border border-primary-500/30 text-primary-300 text-sm font-medium mb-6">
                  <Zap className="w-4 h-4" />
                  Dashboard Experience
                </div>
                <h2 className="text-4xl sm:text-5xl font-bold text-white mb-6 leading-tight">
                  See the whole shift in one glance.<br />
                  <span className="text-gradient">Decide in seconds.</span>
                </h2>
                <p className="text-xl text-gray-400 mb-8 leading-relaxed">
                  Clear numbers, clear actions. The dashboards stay simple and fast so managers and staff can execute without digging through tabs.
                </p>

                <div className="flex flex-wrap gap-3">
                  {['Orders + Revenue', 'Menu + Updates', 'Inventory + Receipts', 'Staff Ops'].map((tag, idx) => (
                    <span key={idx} className="px-4 py-2 bg-gray-800/80 border border-gray-700 rounded-lg text-sm text-gray-300 hover:border-primary-500/50 transition-colors">
                      {tag}
                    </span>
                  ))}
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="relative"
              >
                {/* Glow effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-primary-500/20 to-servio-orange-500/20 rounded-3xl blur-xl" />

                <div className="relative bg-gray-800/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl">
                  {/* Dashboard Header */}
                  <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/10">
                    <div className="flex items-center space-x-3">
                      <div className="w-3 h-3 bg-primary-400 rounded-full animate-pulse" />
                      <span className="text-sm text-gray-300 font-medium">SERVIO KITCHEN • LIVE</span>
                    </div>
                    <span className="text-sm text-gray-500">JAN 20, 2026</span>
                  </div>

                  {/* Metrics Grid */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    {[
                      { label: 'Revenue', value: '$11,256', change: '+12%', color: 'text-primary-400' },
                      { label: 'Orders', value: '245', change: '+5%', color: 'text-blue-400' },
                      { label: 'Avg Ticket', value: '$42', change: '-2%', color: 'text-white' },
                      { label: 'Labor', value: '18%', change: 'Optimum', color: 'text-servio-orange-400' }
                    ].map((metric, idx) => (
                      <div key={idx} className="bg-gray-900/50 rounded-xl p-4 border border-white/5">
                        <p className="text-xs text-gray-500 mb-1">{metric.label}</p>
                        <p className={`text-2xl font-bold ${metric.color}`}>{metric.value}</p>
                        <p className={`text-xs ${metric.change === 'Optimum' ? 'text-gray-500' : metric.change.startsWith('+') ? 'text-servio-green-400' : 'text-servio-red-400'}`}>
                          {metric.change}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Charts Section */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-gray-900/50 rounded-xl p-4 border border-white/5">
                      <p className="text-xs text-gray-500 mb-3">SALES MIX</p>
                      <div className="w-16 h-16 border-4 border-primary-400 border-t-transparent rounded-full mx-auto mb-3 animate-spin-slow" />
                      <div className="text-xs text-gray-400 space-y-2">
                        <div className="flex justify-between">
                          <span>Online</span>
                          <span className="text-primary-400">46%</span>
                        </div>
                        <div className="flex justify-between">
                          <span>In-house</span>
                          <span className="text-gray-300">34%</span>
                        </div>
                      </div>
                    </div>
                    <div className="bg-gray-900/50 rounded-xl p-4 border border-white/5">
                      <p className="text-xs text-gray-500 mb-3">ORDER VOLUME</p>
                      <div className="flex items-end justify-between h-12 gap-1">
                        {[40, 65, 45, 80, 55, 70, 90, 60, 75, 85, 50, 95].map((height, i) => (
                          <motion.div
                            key={i}
                            className="flex-1 bg-gradient-to-t from-primary-500 to-primary-400 rounded-t"
                            initial={{ height: 0 }}
                            whileInView={{ height: `${height}%` }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.05, duration: 0.3 }}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="bg-gray-900/50 rounded-xl p-4 border border-white/5">
                      <p className="text-xs text-gray-500 mb-2">WEEKLY</p>
                      <p className="text-xs text-gray-400">Peak traffic detected. AI suggested staffing adjustments.</p>
                      <div className="mt-3 px-3 py-2 bg-primary-500/20 border border-primary-500/30 rounded-lg">
                        <p className="text-xs text-primary-300 font-medium">Action needed</p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Testimonials Section */}
        <section className="py-20 md:py-32 bg-gray-900/50 relative">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              className="text-center mb-16"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-4xl sm:text-5xl font-bold text-white mb-6">Trusted by restaurants</h2>
              <p className="text-xl text-gray-400 max-w-3xl mx-auto">
                See what restaurant owners and managers are saying about Servio
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  quote: "Servio's voice assistant has transformed how we handle phone orders. We've never missed a call during rush hour.",
                  author: "Maria Rodriguez",
                  role: "Owner, Taco Loco",
                  rating: 5,
                  location: "Austin, TX"
                },
                {
                  quote: "The AI actually understands modifiers and dietary restrictions. It's like having a trained manager on the phone 24/7.",
                  author: "James Chen",
                  role: "General Manager, Dragon Palace",
                  rating: 5,
                  location: "San Francisco, CA"
                },
                {
                  quote: "Finally, a system that works as fast as we do. Menu updates, inventory alerts, staff scheduling - all in one place.",
                  author: "Sarah Williams",
                  role: "Owner, The Burger Joint",
                  rating: 5,
                  location: "Denver, CO"
                }
              ].map((testimonial, idx) => (
                <motion.div
                  key={idx}
                  className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-2xl p-8"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.1 }}
                >
                  <div className="flex items-center gap-1 mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                    ))}
                  </div>
                  <p className="text-gray-300 text-lg mb-6 leading-relaxed">"{testimonial.quote}"</p>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white font-semibold">{testimonial.author}</p>
                      <p className="text-gray-500 text-sm">{testimonial.role}</p>
                      <p className="text-gray-600 text-xs">{testimonial.location}</p>
                    </div>
                    <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-servio-orange-500 rounded-full flex items-center justify-center">
                      <span className="text-white font-bold text-lg">{testimonial.author.charAt(0)}</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Integration Partners Section */}
        <section className="py-16 md:py-24 bg-gray-900 relative">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              className="text-center mb-12"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">Integrations coming soon</h2>
              <p className="text-gray-400">We&apos;re actively building platform integrations and will announce each one as it goes live.</p>
            </motion.div>

            <div className="max-w-3xl mx-auto text-center">
              <p className="text-gray-300">
                Want a specific integration prioritized? Reach out and we&apos;ll add your preferred platform to the roadmap.
              </p>
            </div>

            <motion.div
              className="mt-12 text-center"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <p className="text-gray-500 text-sm mb-4">SOC 2 Compliant • HIPAA Ready • GDPR Compliant</p>
              <div className="flex justify-center items-center gap-4">
                <div className="flex items-center gap-2 px-3 py-1 bg-gray-800 rounded-lg border border-gray-700">
                  <Shield className="w-4 h-4 text-green-400" />
                  <span className="text-gray-400 text-sm">Enterprise Security</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1 bg-gray-800 rounded-lg border border-gray-700">
                  <Zap className="w-4 h-4 text-amber-400" />
                  <span className="text-gray-400 text-sm">99.9% Uptime</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1 bg-gray-800 rounded-lg border border-gray-700">
                  <RefreshCw className="w-4 h-4 text-blue-400" />
                  <span className="text-gray-400 text-sm">Real-time Sync</span>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Features Grid Section */}
        <section id="features" className="py-20 md:py-32 bg-gray-900 relative">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              className="text-center mb-16"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-4xl sm:text-5xl font-bold text-white mb-6">Built for speed on shift</h2>
              <p className="text-xl text-gray-400 max-w-3xl mx-auto">
                Less busywork. Fewer missed details. More control.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { icon: BarChart3, title: 'Performance Analytics', desc: 'Track revenue and order volume so you can react before problems compound.', color: 'from-primary-500 to-primary-600', borderColor: 'hover:border-primary-500/50' },
                { icon: Clock, title: 'Staff Management', desc: 'Keep schedules and staffing visibility tight—so labor doesn\'t drift.', color: 'from-blue-500 to-indigo-600', borderColor: 'hover:border-blue-500/50' },
                { icon: CheckCircle2, title: 'Receipts & Costs', desc: 'Centralize invoices to keep purchasing accountable and costs visible.', color: 'from-servio-green-500 to-emerald-600', borderColor: 'hover:border-servio-green-500/50' },
                { icon: Headphones, title: 'Real Support', desc: 'Get help from people who understand restaurant ops, not generic scripts.', color: 'from-purple-500 to-violet-600', borderColor: 'hover:border-purple-500/50' },
                { icon: Shield, title: 'Secure & Controlled', desc: 'Role-based access so the right people can change the right things.', color: 'from-amber-500 to-orange-600', borderColor: 'hover:border-amber-500/50' },
                { icon: Zap, title: 'Fast & Reliable', desc: 'Built to stay responsive on mobile, tablet, and desktop—during the rush.', color: 'from-servio-red-500 to-rose-600', borderColor: 'hover:border-servio-red-500/50' },
              ].map((feature, idx) => (
                <motion.div
                  key={idx}
                  className={`group bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 ${feature.borderColor} rounded-2xl p-8 transition-all duration-300 hover:shadow-xl hover:shadow-primary-500/10 hover:-translate-y-1`}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.1 }}
                >
                  <div className={`w-14 h-14 bg-gradient-to-br ${feature.color} rounded-2xl flex items-center justify-center mb-6 shadow-lg group-hover:shadow-xl group-hover:scale-110 transition-all duration-300`}>
                    <feature.icon className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-3">{feature.title}</h3>
                  <p className="text-gray-400 leading-relaxed group-hover:text-gray-300 transition-colors">
                    {feature.desc}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="py-20 md:py-32 bg-gradient-to-b from-gray-850 to-gray-900 relative">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              className="text-center mb-16"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-4xl sm:text-5xl font-bold text-white mb-6">Pricing</h2>
              <p className="text-xl text-gray-400 max-w-3xl mx-auto">
                Pick the plan that matches your operation. Scale up as you add locations and workflows.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
              {(pricingPlans.length > 0 ? pricingPlans : [
                { id: 'starter', name: 'Starter', slug: 'starter', description: 'Get control of the basics: orders, visibility, and daily execution.', price_monthly: 49, is_featured: false },
                { id: 'operations', name: 'Operations', slug: 'operations', description: 'The full dashboard: orders, menu, marketing, inventory + receipts, staff, and integrations.', price_monthly: 129, is_featured: true },
                { id: 'voice', name: 'Voice', slug: 'voice', description: 'Hands-free workflows and the AI assistant that helps your team execute faster.', price_monthly: 179, is_featured: false }
              ]).map((plan, idx) => (
                <motion.div
                  key={plan.id}
                  className={`relative rounded-3xl p-8 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${plan.is_featured
                    ? 'bg-gradient-to-b from-gray-800/80 to-gray-800/40 backdrop-blur-xl border-2 border-primary-500/50 md:transform md:scale-105 shadow-2xl shadow-primary-500/20'
                    : 'bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 hover:border-gray-600'
                  }`}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.1 }}
                >
                  {plan.is_featured && (
                    <div className="absolute -top-5 left-1/2 transform -translate-x-1/2">
                      <span className="bg-gradient-to-r from-primary-500 to-primary-600 text-white px-6 py-2 rounded-full text-sm font-semibold shadow-lg">MOST POPULAR</span>
                    </div>
                  )}
                  <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
                  <div className="flex items-baseline mb-6">
                    <span className="text-5xl font-bold text-white">${Number(plan.price_monthly).toFixed(0)}</span>
                    <span className="text-gray-400 ml-3">/mo</span>
                  </div>
                  <p className="text-gray-400 mb-8">{plan.description}</p>
                  <button className={`w-full text-white py-4 px-6 rounded-2xl font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${plan.is_featured
                    ? 'bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 shadow-lg shadow-primary-500/30'
                    : 'bg-gray-700 hover:bg-gray-600'
                  }`}>
                    Select Plan
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section id="faq" className="py-20 md:py-32 bg-gray-900">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              className="text-center mb-16"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-4xl sm:text-5xl font-bold text-white mb-6">Frequently Asked Questions</h2>
            </motion.div>

            <div className="space-y-6">
              {[
                { q: 'Is Servio app-ready?', a: 'Yes. Servio is PWA-installable and optimized for mobile, tablet, and desktop.' },
                { q: 'Does Servio support delivery platforms?', a: 'Servio supports integrations via the dashboard\'s Integrations area. Availability depends on your stack—tell us what you run and we\'ll map the path.' },
                { q: 'Can staff clock in and out from mobile?', a: 'Yes—Servio is built to run from mobile, tablet, and desktop so the team can work where the work happens.' },
                { q: 'What integrations are available?', a: 'Start with what matters most (POS, ordering channels, accounting, etc.). We\'ll confirm what\'s supported and set up a clean data sync.' },
                { q: 'How does voice ordering work?', a: 'The Assistant understands natural language commands for orders, inventory, and operations. You tell it what to do—Servio handles the clicks.' },
              ].map((faq, idx) => (
                <motion.div
                  key={idx}
                  className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-2xl p-6 hover:border-primary-500/30 transition-all duration-300"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.1 }}
                >
                  <h3 className="text-lg font-semibold text-white mb-3">{faq.q}</h3>
                  <p className="text-gray-400 leading-relaxed">{faq.a}</p>
                </motion.div>
              ))}
            </div>

            <motion.div
              className="text-center mt-12"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <Link
                href="/dashboard/assistant"
                className="btn-primary inline-flex items-center gap-3 px-8 py-4 text-lg"
              >
                <Sparkles className="w-5 h-5" />
                Try the Assistant
                <ArrowRight className="w-5 h-5" />
              </Link>
            </motion.div>
          </div>
        </section>

        {/* Footer */}
        <footer className="bg-gray-900 py-16 border-t border-white/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
              <div>
                <div className="flex items-center mb-4">
                  <img src="/images/servio_icon_tight.png" alt="Servio Logo" className="h-9 w-auto" />
                  <span className="ml-3 text-xl font-bold text-white">Servio</span>
                </div>
                <p className="text-gray-400 mb-4">
                  One beautiful dashboard to run orders, menu, marketing, inventory + receipts, staff ops, and integrations.
                </p>
                <div className="flex space-x-4">
                  {/* Social icons placeholder */}
                </div>
              </div>

              <div>
                <h3 className="text-white font-semibold mb-4">Services</h3>
                <ul className="space-y-3">
                  <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Assistant</a></li>
                  <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Orders</a></li>
                  <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Inventory</a></li>
                  <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Staff</a></li>
                </ul>
              </div>

              <div>
                <h3 className="text-white font-semibold mb-4">Features</h3>
                <ul className="space-y-3">
                  <li><a href="#" className="text-gray-400 hover:text-white transition-colors">AI Assistant</a></li>
                  <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Analytics</a></li>
                  <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Receipts</a></li>
                  <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Integrations</a></li>
                </ul>
              </div>

              <div>
                <h3 className="text-white font-semibold mb-4">Company</h3>
                <ul className="space-y-3">
                  <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Pricing</a></li>
                  <li><a href="#" className="text-gray-400 hover:text-white transition-colors">FAQ</a></li>
                  <li><Link href="/login" className="text-gray-400 hover:text-white transition-colors">Login</Link></li>
                  <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Support</a></li>
                </ul>
              </div>
            </div>

            <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center">
              <p className="text-gray-400">© 2026 Servio. All rights reserved.</p>
              <div className="flex space-x-6 mt-4 md:mt-0">
                <a href="#" className="text-gray-400 hover:text-white transition-colors">Privacy Policy</a>
                <a href="#" className="text-gray-400 hover:text-white transition-colors">Terms of Service</a>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  )
}
