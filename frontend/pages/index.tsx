import React, { useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  Headphones,
  Mic,
  Package,
  Shield,
  ShoppingCart,
  Users,
  Menu,
  X
} from 'lucide-react'

const fadeIn = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 }
}

export default function HomePage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-white overflow-x-hidden relative">
      <Head>
        <title>Servio — Restaurant Operating System</title>
        <meta name="description" content="Servio unifies orders, voice, staff, and inventory into one premium restaurant operating system." />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
      </Head>

      {/* Background Image with Overlay */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&q=80&w=2070"
          alt="Kitchen Background"
          className="w-full h-full object-cover scale-105 blur-sm"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-teal-900/50 via-teal-800/70 to-[#0A0A0B]/95" />
      </div>

      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Navigation */}
        <nav className="w-full pt-6 sm:pt-10 px-4 sm:px-6 lg:px-10">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-[#14b8a6] flex items-center justify-center">
                <span className="text-white font-bold text-lg sm:text-xl">S</span>
              </div>
              <span className="text-xl sm:text-2xl font-semibold tracking-tight text-white">Servio</span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-6 text-sm font-medium text-white">
              <a href="#services" className="hover:text-[#2dd4bf] transition-colors">Services</a>
              <a href="#features" className="hover:text-[#2dd4bf] transition-colors">Features</a>
              <a href="#pricing" className="hover:text-[#2dd4bf] transition-colors">Pricing</a>
              <a href="#faq" className="hover:text-[#2dd4bf] transition-colors">FAQ</a>
              <Link href="/login" className="hover:text-[#2dd4bf] transition-colors">Login</Link>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-white hover:text-[#2dd4bf] transition-colors"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

          {/* Mobile Menu */}
          <AnimatePresence>
            {mobileMenuOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="md:hidden mt-4 pb-4 border-t border-white/10"
              >
                <div className="flex flex-col gap-4 pt-4">
                  <a
                    href="#services"
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-white hover:text-[#2dd4bf] transition-colors py-2"
                  >
                    Services
                  </a>
                  <a
                    href="#features"
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-white hover:text-[#2dd4bf] transition-colors py-2"
                  >
                    Features
                  </a>
                  <a
                    href="#pricing"
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-white hover:text-[#2dd4bf] transition-colors py-2"
                  >
                    Pricing
                  </a>
                  <a
                    href="#faq"
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-white hover:text-[#2dd4bf] transition-colors py-2"
                  >
                    FAQ
                  </a>
                  <Link
                    href="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-white hover:text-[#2dd4bf] transition-colors py-2"
                  >
                    Login
                  </Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </nav>

        {/* Hero Content */}
        <main className="flex-grow flex items-center justify-center px-6 py-20 min-h-[calc(100vh-200px)]">
          <div className="max-w-3xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <div className="mb-10">
                <span className="inline-flex items-center px-4 py-1.5 rounded-full text-xs font-medium bg-[#0A0A0B]/60 backdrop-blur-sm text-white border border-[#14b8a6]">
                  Restaurant Operating System
                </span>
              </div>

              <h1 className="text-5xl sm:text-6xl font-bold tracking-tight mb-8 leading-[1.1] text-white">
                The premium, voice-first platform for restaurant teams.
              </h1>

              <p className="text-lg sm:text-xl text-white max-w-lg mx-auto mb-12 leading-relaxed">
                Servio unifies orders, inventory, staff operations, and communications into a single, app-like system.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <Link
                  href="/dashboard/assistant"
                  className="w-full sm:w-auto px-8 py-4 rounded-xl bg-[#14b8a6] hover:bg-[#0d9488] text-white font-semibold transition-all shadow-lg"
                >
                  Get Started
                </Link>
                <Link
                  href="/login"
                  className="w-full sm:w-auto px-8 py-4 rounded-xl bg-[#0A0A0B]/60 backdrop-blur-sm border border-[#14b8a6] text-white font-semibold hover:bg-[#14b8a6]/10 transition-all"
                >
                  Book Demo
                </Link>
              </div>
            </motion.div>
          </div>
        </main>
      </div>

      {/* Content Sections (Transition to Dark) */}
      <div className="relative z-10 bg-[#0A0A0B]">
        {/* Dashboard Preview */}
        <section className="py-24 border-t border-white/5">
          <div className="max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <span className="inline-flex items-center gap-2 text-xs font-medium text-white/50 bg-white/5 px-3 py-1 rounded-full border border-white/10">
                Dashboard Experience
              </span>
              <h2 className="mt-6 text-3xl lg:text-4xl font-semibold text-white">
                Clean, focused dashboards that teams love.
              </h2>
              <p className="mt-4 text-lg text-white/60">
                We’re refining the dashboards to stay simple, fast, and glanceable—so staff can act instantly without digging.
              </p>
              <div className="mt-8 flex flex-wrap gap-3 text-xs">
                {['Revenue + Orders', 'Live Status', 'Inventory Signals', 'Staff Ops'].map((item) => (
                  <span key={item} className="px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-white/70">
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="absolute -inset-4 bg-[#14b8a6]/10 blur-3xl rounded-full" />
              <div className="relative rounded-3xl border border-white/10 bg-[#111111] p-6 shadow-2xl">
                <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-white/40">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#14b8a6] animate-pulse" />
                    <span>Servio Kitchen • Live</span>
                  </div>
                  <div className="bg-white/5 px-2 py-1 rounded-md">Jan 20, 2026</div>
                </div>

                <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { label: 'Revenue', value: '$11,256', trend: '+12%', color: 'text-[#2dd4bf]' },
                    { label: 'Orders', value: '245', trend: '+5%', color: 'text-violet-400' },
                    { label: 'Avg Ticket', value: '$42', trend: '-2%', color: 'text-blue-400' },
                    { label: 'Labor', value: '18%', trend: 'Optimum', color: 'text-orange-400' }
                  ].map((card) => (
                    <div key={card.label} className="rounded-2xl border border-white/5 p-4 bg-white/[0.02]">
                      <div className="text-[10px] text-white/40 mb-1">{card.label}</div>
                      <div className={`text-lg font-bold ${card.color}`}>{card.value}</div>
                      <div className="text-[9px] text-white/30 mt-1">{card.trend}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 grid grid-cols-3 gap-6">
                  <div className="col-span-3 lg:col-span-1 rounded-2xl border border-white/5 bg-white/[0.02] p-5">
                    <div className="text-[10px] text-white/40 mb-4 uppercase tracking-widest">Sales Mix</div>
                    <div className="relative h-24 w-24 mx-auto mb-4">
                      <div className="absolute inset-0 rounded-full border-[8px] border-white/5" />
                      <div className="absolute inset-0 rounded-full border-[8px] border-[#14b8a6] border-t-transparent border-r-transparent rotate-45" />
                    </div>
                    <div className="space-y-2 text-[10px]">
                      <div className="flex items-center justify-between text-white/60">
                        <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-[#14b8a6]" /> Online</span>
                        <span>46%</span>
                      </div>
                      <div className="flex items-center justify-between text-white/40">
                        <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-white/20" /> In-house</span>
                        <span>34%</span>
                      </div>
                    </div>
                  </div>

                  <div className="col-span-3 lg:col-span-2 rounded-2xl border border-white/5 bg-white/[0.02] p-5">
                    <div className="flex items-center justify-between text-[10px] text-white/40 uppercase tracking-widest mb-6">
                      <span>Order Volume</span>
                      <span>Weekly</span>
                    </div>
                    <div className="flex items-end justify-between h-20 gap-2">
                      {[36, 52, 44, 68, 58, 40, 50].map((h, i) => (
                        <div key={i} className="flex-grow group relative">
                          <div 
                            className={`w-full rounded-t-md transition-all duration-500 ${i === 3 ? 'bg-[#14b8a6]' : 'bg-white/10'}`} 
                            style={{ height: `${h}%` }} 
                          />
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 text-[10px] text-white/30">
                      Peak traffic detected. AI suggested staffing adjustments.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

        {/* Services */}
        <section id="services" className="py-24 border-t border-white/5">
          <div className="max-w-6xl mx-auto px-6">
            <h2 className="text-2xl font-semibold text-white mb-12">Services</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { icon: ShoppingCart, title: 'Orders', description: 'Unified order stream with real-time status updates.', color: 'text-[#2dd4bf]' },
                { icon: Mic, title: 'Voice', description: 'Hands-free commands for day-to-day kitchen operations.', color: 'text-blue-400' },
                { icon: Users, title: 'Staff & Ops', description: 'Scheduling, timeclock, tasks, and shift visibility.', color: 'text-violet-400' },
                { icon: Package, title: 'Inventory', description: 'Live counts, auto-86 items, and smart reorder signals.', color: 'text-orange-400' }
              ].map((service) => (
                <div key={service.title} className="bg-white/[0.02] border border-white/5 rounded-3xl p-8 hover:bg-white/[0.04] transition-all group">
                  <div className={`w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                    <service.icon className={`w-6 h-6 ${service.color}`} />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-3">{service.title}</h3>
                  <p className="text-sm text-white/50 leading-relaxed">{service.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Feature Grid */}
        <section id="features" className="py-24 border-t border-white/5">
          <div className="max-w-6xl mx-auto px-6">
            <h2 className="text-2xl font-semibold text-white mb-12">Feature Grid</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { icon: BarChart3, title: 'Revenue Analytics', description: 'Monitor sales trends and peak periods instantly.' },
                { icon: Clock, title: 'Shift Management', description: 'Live clock-in status and break tracking.' },
                { icon: FileText, title: 'Receipt Tracking', description: 'Upload, audit, and reconcile invoices with ease.' },
                { icon: Headphones, title: '24/7 Support', description: 'Dedicated restaurant support, any time.' },
                { icon: Shield, title: 'Secure & Compliant', description: 'Role-based access and audit trails.' },
                { icon: CheckCircle2, title: 'Reliable & Fast', description: 'Low-latency performance across devices.' }
              ].map((feature) => (
                <div key={feature.title} className="bg-white/[0.02] border border-white/5 rounded-3xl p-8 hover:bg-white/[0.04] transition-all">
                  <feature.icon className="w-5 h-5 text-[#2dd4bf] mb-6" />
                  <h3 className="text-lg font-semibold text-white mb-3">{feature.title}</h3>
                  <p className="text-sm text-white/50 leading-relaxed">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="py-24 border-t border-white/5">
          <div className="max-w-6xl mx-auto px-6">
            <h2 className="text-2xl font-semibold text-white mb-12">Pricing</h2>
            <div className="grid lg:grid-cols-3 gap-8">
              {[
                { name: 'Starter', price: '$49', description: 'Core operations for small teams.', highlighted: false },
                { name: 'Operations', price: '$129', description: 'Full staff, inventory, and order suite.', highlighted: true },
                { name: 'Voice', price: '$179', description: 'Voice-first workflows and AI support.', highlighted: false }
              ].map((plan) => (
                <div 
                  key={plan.name} 
                  className={`relative border rounded-3xl p-10 transition-all ${
                    plan.highlighted 
                      ? 'bg-white/[0.04] border-[#14b8a6]/30 shadow-2xl shadow-[#14b8a6]/5' 
                      : 'bg-white/[0.02] border-white/5'
                  }`}
                >
                  {plan.highlighted && (
                    <div className="absolute -top-4 left-10 px-3 py-1 bg-[#14b8a6] text-white text-[10px] font-bold rounded-full uppercase tracking-widest">
                      Most Popular
                    </div>
                  )}
                  <h3 className="text-xl font-semibold text-white mb-2">{plan.name}</h3>
                  <div className="flex items-baseline gap-1 mb-4">
                    <span className="text-4xl font-bold text-white">{plan.price}</span>
                    <span className="text-sm text-white/40">/mo</span>
                  </div>
                  <p className="text-sm text-white/50 mb-8 leading-relaxed">{plan.description}</p>
                  <Link 
                    href="/dashboard/assistant" 
                    className={`flex items-center justify-center w-full py-4 rounded-2xl font-semibold transition-all ${
                      plan.highlighted 
                        ? 'bg-[#14b8a6] text-white hover:bg-[#0d9488]' 
                        : 'bg-white/5 text-white hover:bg-white/10'
                    }`}
                  >
                    Select Plan <ChevronRight className="w-4 h-4 ml-2" />
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="py-24 border-t border-white/5">
          <div className="max-w-4xl mx-auto px-6">
            <h2 className="text-2xl font-semibold text-white mb-12 text-center">Frequently Asked Questions</h2>
            <div className="space-y-4">
              {[
                { q: 'Is Servio app-ready?', a: 'Yes. Servio is PWA-installable and optimized for mobile, tablet, and desktop.' },
                { q: 'Does Servio support delivery platforms?', a: 'We support multi-channel integrations with unified menu management.' },
                { q: 'Can staff clock in and out from mobile?', a: 'Yes, staff clock-ins, breaks, and shifts are fully mobile-friendly.' }
              ].map((item) => (
                <div key={item.q} className="bg-white/[0.02] border border-white/5 rounded-3xl p-8 hover:bg-white/[0.04] transition-all">
                  <h3 className="text-lg font-semibold text-white mb-3">{item.q}</h3>
                  <p className="text-sm text-white/50 leading-relaxed">{item.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-16 border-t border-white/5">
          <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-8">
            <div className="flex items-center gap-3">
              <img src="/images/servio_logo_transparent_tight.png" alt="Servio" className="h-6 w-auto brightness-0 invert" />
              <span className="text-sm text-white/40 font-medium">© 2026 Servio Restaurant Platform</span>
            </div>
            <div className="flex items-center gap-8 text-sm font-medium text-white/40">
              <Link href="/login" className="hover:text-white transition-colors">Login</Link>
              <Link href="/dashboard/assistant" className="hover:text-white transition-colors">Get Started</Link>
              <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}
