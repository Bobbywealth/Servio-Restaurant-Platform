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
    <div className="min-h-screen bg-[#F9FAFB] text-gray-900 overflow-x-hidden">
      <Head>
        <title>Servio — Restaurant Operating System</title>
        <meta name="description" content="Servio unifies orders, voice, staff, and inventory into one premium restaurant operating system." />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
      </Head>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-[100] bg-white/90 backdrop-blur-md border-b border-surface-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center gap-2">
              <img src="/images/servio_icon_tight.png" alt="Servio" className="h-8 w-auto" />
              <span className="text-lg font-semibold">Servio</span>
            </Link>
            <div className="hidden lg:flex items-center gap-8 text-sm font-medium text-gray-700">
              <a href="#services" className="text-gray-700 hover:text-gray-900">Services</a>
              <a href="#features" className="text-gray-700 hover:text-gray-900">Features</a>
              <a href="#pricing" className="text-gray-700 hover:text-gray-900">Pricing</a>
              <a href="#faq" className="text-gray-700 hover:text-gray-900">FAQ</a>
              <Link href="/login" className="text-gray-700 hover:text-gray-900">Login</Link>
              <Link
                href="/dashboard/assistant"
                className="bg-primary-600 hover:bg-primary-700 text-white px-5 py-2 rounded-full"
              >
                Get Started
              </Link>
            </div>
            <div className="lg:hidden">
              <Link
                href="/login"
                className="bg-primary-600 text-white px-4 py-2 rounded-full text-xs font-medium"
              >
                Login
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-28 pb-16 lg:pt-40 lg:pb-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeIn}>
            <span className="inline-flex items-center gap-2 text-xs font-medium text-primary-700 bg-primary-50 px-3 py-1 rounded-full border border-primary-100">
              Restaurant Operating System
            </span>
            <h1 className="mt-6 text-4xl lg:text-6xl font-semibold text-gray-900">
              The premium, voice-first platform for restaurant teams.
            </h1>
            <p className="mt-4 text-lg text-gray-700 max-w-2xl mx-auto">
              Servio unifies orders, inventory, staff operations, and communications into a single, app-like system.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/dashboard/assistant"
                className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-xl font-medium"
              >
                Get Started
              </Link>
              <Link
                href="/login"
                className="bg-white border border-surface-200 text-gray-900 px-6 py-3 rounded-xl font-medium"
              >
                Book Demo
              </Link>
            </div>
          </motion.div>
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
