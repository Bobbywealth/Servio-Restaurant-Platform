import React from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { motion } from 'framer-motion'
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
  Users
} from 'lucide-react'

const fadeIn = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 }
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#0A0A0B] text-white overflow-x-hidden relative">
      <Head>
        <title>Servio — Restaurant Operating System</title>
        <meta name="description" content="Servio unifies orders, voice, staff, and inventory into one premium restaurant operating system." />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
      </Head>

      {/* Background Image with Overlay */}
      <div className="absolute inset-0 z-0">
        <img
          src="https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&q=80&w=2070"
          alt="Kitchen Background"
          className="w-full h-full object-cover opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0A0A0B]/80 via-[#0A0A0B]/40 to-[#0A0A0B]" />
      </div>

      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Navigation */}
        <nav className="w-full pt-10 px-6 sm:px-10">
          <div className="max-w-4xl mx-auto flex flex-col items-center gap-8">
            <Link href="/" className="flex items-center gap-2">
              <img
                src="/images/servio_logo_transparent_tight.png"
                alt="Servio Logo"
                className="h-8 w-auto brightness-0 invert"
              />
              <span className="text-2xl font-semibold tracking-tight">servio</span>
            </Link>

            <div className="flex items-center gap-6 text-sm font-medium text-white/80">
              <a href="#services" className="hover:text-white transition-colors">Services</a>
              <a href="#features" className="hover:text-white transition-colors">Features</a>
              <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
              <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
              <Link href="/login" className="hover:text-white transition-colors">Login</Link>
            </div>
          </div>
        </nav>

        {/* Hero Content */}
        <main className="flex-grow flex items-center justify-center px-6 py-20">
          <div className="max-w-2xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <div className="mb-10">
                <span className="inline-flex items-center px-4 py-1.5 rounded-full text-xs font-medium bg-[#14b8a6]/20 text-[#2dd4bf] border border-[#14b8a6]/30">
                  Restaurant Operating System
                </span>
              </div>

              <h1 className="text-5xl sm:text-6xl font-bold tracking-tight mb-8 leading-[1.1]">
                The premium, voice-first platform for restaurant teams.
              </h1>

              <p className="text-lg sm:text-xl text-white/70 max-w-lg mx-auto mb-12 leading-relaxed">
                Servio unifies orders, inventory, staff operations, and communications into a single, app-like system.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <Link
                  href="/dashboard/assistant"
                  className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-[#14b8a6] hover:bg-[#0d9488] text-white font-semibold transition-all shadow-lg shadow-[#14b8a6]/20"
                >
                  Get Started
                </Link>
                <Link
                  href="/login"
                  className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-white text-black font-semibold hover:bg-gray-100 transition-all"
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
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            <div>
              <span className="inline-flex items-center gap-2 text-xs font-medium text-gray-700 bg-white px-3 py-1 rounded-full border border-surface-200">
                Dashboard Experience
              </span>
              <h2 className="mt-4 text-3xl lg:text-4xl font-semibold text-gray-900">
                Clean, focused dashboards that teams love.
              </h2>
              <p className="mt-4 text-base text-gray-700">
                We’re refining the dashboards to stay simple, fast, and glanceable—so staff can act instantly without digging.
              </p>
              <div className="mt-6 flex flex-wrap gap-3 text-xs text-gray-600">
                {['Revenue + Orders', 'Live Status', 'Inventory Signals', 'Staff Ops'].map((item) => (
                  <span key={item} className="px-3 py-1 rounded-full border border-surface-200 bg-white">
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-r from-primary-100 via-white to-primary-100 blur-2xl opacity-70" />
              <div className="relative rounded-3xl border border-surface-200 bg-[#111111] text-white p-5 shadow-2xl">
                <div className="flex items-center justify-between text-xs text-white/70">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-400" />
                    <span>Servio Kitchen</span>
                  </div>
                  <div className="bg-white/10 px-3 py-1 rounded-full">Today</div>
                </div>

                <div className="mt-4 grid grid-cols-4 gap-3 text-[10px]">
                  {[
                    { label: 'Revenue', value: '$11,256', tone: 'bg-emerald-500/20 text-emerald-200' },
                    { label: 'Orders', value: '245', tone: 'bg-violet-500/20 text-violet-200' },
                    { label: 'Avg. Ticket', value: '$42', tone: 'bg-blue-500/20 text-blue-200' },
                    { label: 'Labor', value: '18%', tone: 'bg-orange-500/20 text-orange-200' }
                  ].map((card) => (
                    <div key={card.label} className="rounded-xl border border-white/10 p-3 bg-white/5">
                      <div className="text-white/60">{card.label}</div>
                      <div className={`mt-2 text-sm font-semibold ${card.tone}`}>{card.value}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 grid grid-cols-3 gap-4">
                  <div className="col-span-1 rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="text-xs text-white/60">Sales Mix</div>
                    <div className="mt-4 h-20 rounded-full border border-white/10 bg-gradient-to-br from-emerald-400/40 via-violet-400/40 to-orange-400/40" />
                    <div className="mt-3 space-y-2 text-[10px] text-white/60">
                      <div className="flex items-center justify-between">
                        <span>Online</span>
                        <span>46%</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>In-house</span>
                        <span>34%</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Pickup</span>
                        <span>20%</span>
                      </div>
                    </div>
                  </div>

                  <div className="col-span-2 rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center justify-between text-xs text-white/60">
                      <span>Order Volume</span>
                      <span>Weekly</span>
                    </div>
                    <div className="mt-4 grid grid-cols-7 gap-2 items-end h-24">
                      {[36, 52, 44, 68, 58, 40, 50].map((value, idx) => (
                        <div
                          key={`${value}-${idx}`}
                          className="w-full rounded-md bg-white/10"
                          style={{ height: `${value}%` }}
                        />
                      ))}
                    </div>
                    <div className="mt-3 text-[10px] text-white/50">
                      Peak traffic highlighted for staffing adjustments.
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between text-xs text-white/60">
                    <span>Trending Items</span>
                    <span>Live</span>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-3 text-[10px]">
                    {['Jerk Chicken', 'Citrus Salad', 'Rice Bowl'].map((item) => (
                      <div key={item} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                        <div className="text-white/80">{item}</div>
                        <div className="text-white/50">+18% today</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Services */}
      <section id="services" className="py-16 bg-white border-t border-surface-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-semibold text-gray-900">Services</h2>
          <div className="mt-8 grid md:grid-cols-2 gap-6">
            {[
              { icon: ShoppingCart, title: 'Orders', description: 'Unified order stream with real-time status updates.' },
              { icon: Mic, title: 'Voice', description: 'Hands-free commands for day-to-day kitchen operations.' },
              { icon: Users, title: 'Staff & Ops', description: 'Scheduling, timeclock, tasks, and shift visibility.' },
              { icon: Package, title: 'Inventory', description: 'Live counts, auto-86 items, and smart reorder signals.' }
            ].map((service) => (
              <div key={service.title} className="bg-[#F9FAFB] border border-surface-200 rounded-2xl p-6">
                <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center">
                  <service.icon className="w-5 h-5 text-primary-600" />
                </div>
                <h3 className="mt-4 text-lg font-semibold">{service.title}</h3>
                <p className="mt-2 text-sm text-gray-700">{service.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section id="features" className="py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-semibold text-gray-900">Feature Grid</h2>
          <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: BarChart3, title: 'Revenue Analytics', description: 'Monitor sales trends and peak periods instantly.' },
              { icon: Clock, title: 'Shift Management', description: 'Live clock-in status and break tracking.' },
              { icon: FileText, title: 'Receipt Tracking', description: 'Upload, audit, and reconcile invoices with ease.' },
              { icon: Headphones, title: '24/7 Support', description: 'Dedicated restaurant support, any time.' },
              { icon: Shield, title: 'Secure & Compliant', description: 'Role-based access and audit trails.' },
              { icon: CheckCircle2, title: 'Reliable & Fast', description: 'Low-latency performance across devices.' }
            ].map((feature) => (
              <div key={feature.title} className="bg-white border border-surface-200 rounded-2xl p-6">
                <feature.icon className="w-5 h-5 text-primary-600" />
                <h3 className="mt-4 font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm text-gray-700">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-16 bg-white border-t border-surface-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-semibold text-gray-900">Pricing</h2>
          <div className="mt-8 grid lg:grid-cols-3 gap-6">
            {[
              { name: 'Starter', price: '$49', description: 'Core operations for small teams.' },
              { name: 'Operations', price: '$129', description: 'Full staff, inventory, and order suite.' },
              { name: 'Voice', price: '$179', description: 'Voice-first workflows and AI support.' }
            ].map((plan) => (
              <div key={plan.name} className="border border-surface-200 rounded-2xl p-6 bg-[#F9FAFB]">
                <h3 className="text-lg font-semibold">{plan.name}</h3>
                <div className="mt-3 text-3xl font-semibold text-gray-900">{plan.price}<span className="text-sm font-normal text-gray-700">/mo</span></div>
                <p className="mt-2 text-sm text-gray-700">{plan.description}</p>
                <Link href="/dashboard/assistant" className="mt-6 inline-flex items-center text-sm font-medium text-primary-700">
                  Select Plan <ChevronRight className="w-4 h-4 ml-1" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-semibold text-gray-900">FAQ</h2>
          <div className="mt-8 space-y-4">
            {[
              { q: 'Is Servio app-ready?', a: 'Yes. Servio is PWA-installable and optimized for mobile, tablet, and desktop.' },
              { q: 'Does Servio support delivery platforms?', a: 'We support multi-channel integrations with unified menu management.' },
              { q: 'Can staff clock in and out from mobile?', a: 'Yes, staff clock-ins, breaks, and shifts are fully mobile-friendly.' }
            ].map((item) => (
              <div key={item.q} className="bg-white border border-surface-200 rounded-2xl p-6">
                <h3 className="font-semibold">{item.q}</h3>
                <p className="mt-2 text-sm text-gray-700">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-surface-200 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src="/images/servio_logo_transparent_tight.png" alt="Servio" className="h-6 w-auto" />
            <span className="text-sm text-gray-600">© 2026 Servio</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-gray-600">
            <Link href="/login">Login</Link>
            <Link href="/dashboard/assistant">Get Started</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
