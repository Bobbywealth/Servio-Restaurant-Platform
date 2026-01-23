import React from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Mic, Bot, Shield, Zap, Clock, Users,
  Phone, Smartphone, RefreshCw, BarChart3,
  CheckCircle2, MessageSquare, Headphones,
  Utensils, ShoppingCart, Package,
  Calendar, DollarSign, TrendingUp,
  ArrowRight, PlayCircle, Star
} from 'lucide-react'

export default function HomePage() {
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

      <div className="min-h-screen bg-gray-900 text-white">
        {/* Navigation */}
        <nav className="fixed top-0 left-0 right-0 bg-gray-900/95 backdrop-blur-md border-b border-gray-800 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16" id="top">
              <div className="flex items-center">
                <img
                  src="/images/servio_logo_transparent_tight.png"
                  alt="Servio Logo"
                  className="h-8 w-auto brightness-0 invert"
                />
              </div>
              <div className="hidden md:flex items-center space-x-8">
                <a href="#top" className="text-gray-300 hover:text-white font-medium transition-colors">Home</a>
                <a href="#services" className="text-gray-300 hover:text-white font-medium transition-colors">Services</a>
                <a href="#features" className="text-gray-300 hover:text-white font-medium transition-colors">Features</a>
                <a href="#pricing" className="text-gray-300 hover:text-white font-medium transition-colors">Pricing</a>
                <a href="#faq" className="text-gray-300 hover:text-white font-medium transition-colors">FAQ</a>
                <Link href="/login" className="text-gray-300 hover:text-white font-medium transition-colors">Login</Link>
              </div>
            </div>
          </div>
        </nav>

        {/* Hero Section */}
        <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
          {/* Background Image */}
          <div className="absolute inset-0">
            <img 
              src="/images/hero_background.png" 
              alt="Restaurant Kitchen" 
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gray-900/60"></div>
          </div>

          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="space-y-8"
            >
              {/* Badge */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="inline-flex items-center px-4 py-2 rounded-full bg-teal-500/20 border border-teal-500/30 text-teal-300 text-sm font-medium backdrop-blur-sm"
              >
                Restaurant Operating System
              </motion.div>

              <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-8 leading-tight">
                The premium, voice-first platform for restaurant teams.
              </h1>

              <p className="text-xl md:text-2xl text-gray-300 mb-12 max-w-4xl mx-auto leading-relaxed">
                Servio unifies orders, inventory, staff operations, and communications into a single, app-like system.
              </p>

              <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
                <Link
                  href="/dashboard/assistant"
                  className="bg-teal-600 hover:bg-teal-700 text-white px-8 py-4 rounded-lg font-semibold text-lg transition-all duration-200 transform hover:scale-105 shadow-xl"
                >
                  Get Started
                </Link>

                <Link
                  href="/book-demo"
                  className="bg-white hover:bg-gray-100 text-gray-900 px-8 py-4 rounded-lg font-semibold text-lg transition-all duration-200"
                >
                  Book Demo
                </Link>
              </div>

              {/* Social Proof */}
              <div className="flex flex-col items-center mb-16">
                <p className="text-sm text-gray-500 mb-4">Trusted by restaurants nationwide</p>
                <div className="flex items-center space-x-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star key={star} className="w-5 h-5 text-yellow-400 fill-current" />
                  ))}
                  <span className="ml-2 text-sm text-gray-600">4.9/5 from 200+ restaurants</span>
                </div>
              </div>

              {/* Hero Dashboard Preview */}
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.4 }}
                className="relative mx-auto max-w-6xl"
              >
                <div className="bg-white rounded-3xl shadow-2xl p-2 border border-gray-200">
                  <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-8">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                      {/* Voice Interface */}
                      <div className="bg-white p-6 rounded-xl shadow-sm">
                        <div className="flex items-center mb-4">
                          <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse mr-2"></div>
                          <span className="text-sm font-medium text-gray-700">Voice Active</span>
                        </div>
                        <div className="text-center">
                          <Mic className="w-12 h-12 text-blue-600 mx-auto mb-3" />
                          <p className="text-sm text-gray-600">&quot;86 the jerk chicken on all platforms&quot;</p>
                        </div>
                      </div>

                      {/* Order Queue */}
                      <div className="bg-white p-6 rounded-xl shadow-sm">
                        <h3 className="font-semibold text-gray-900 mb-4">Live Orders</h3>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm">Order #214</span>
                            <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded-full">Preparing</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm">Order #215</span>
                            <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">Ready</span>
                          </div>
                        </div>
                      </div>

                      {/* Staff Status */}
                      <div className="bg-white p-6 rounded-xl shadow-sm">
                        <h3 className="font-semibold text-gray-900 mb-4">Staff Status</h3>
                        <div className="flex items-center space-x-2">
                          <Users className="w-4 h-4 text-blue-600" />
                          <span className="text-sm text-gray-600">5 working • 1 on break</span>
                        </div>
                        <div className="mt-3 flex items-center space-x-2">
                          <Clock className="w-4 h-4 text-green-600" />
                          <span className="text-sm text-gray-600">32.5 hours today</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-center">
                      <p className="text-gray-500 text-sm">Real-time restaurant operations dashboard</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>

        {/* Phone Orders Section */}
        <section id="phone-orders" className="py-24 bg-gray-850 border-t border-b border-gray-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              <div className="space-y-6">
                <div className="inline-flex items-center px-4 py-2 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-200 text-sm font-medium">
                  Vapi-Powered Phone Answering
                </div>
                <h2 className="text-4xl md:text-5xl font-bold text-white leading-tight">
                  We answer every call<br />
                  <span className="text-teal-400">and take the order for you.</span>
                </h2>
                <p className="text-lg text-gray-300 leading-relaxed">
                  Servio&apos;s Vapi voice agent picks up in two rings, speaks naturally, captures the order, respects your hours, syncs availability, and pushes tickets into your POS and delivery platforms—so no call or revenue is missed.
                </p>
                <p className="text-base text-gray-400 leading-relaxed">
                  Admins can tune call rules, hours, menus, and escalation from the dashboard, while each restaurant sees the agent inside their back office with your POS and delivery integrations already connected.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { icon: Phone, label: '2-ring auto-answer' },
                    { icon: ShoppingCart, label: 'Full menu ordering' },
                    { icon: RefreshCw, label: 'POS + delivery sync' },
                    { icon: MessageSquare, label: 'SMS confirm + handoff' }
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-center space-x-3 bg-gray-800/60 border border-gray-700 rounded-xl px-4 py-3">
                      <item.icon className="w-4 h-4 text-teal-400" />
                      <span className="text-gray-200 text-sm">{item.label}</span>
                    </div>
                  ))}
                </div>
                <div className="flex flex-col sm:flex-row gap-4">
                  <Link
                    href="/book-demo"
                    className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-3 rounded-lg font-semibold transition-all duration-200 inline-flex items-center justify-center"
                  >
                    Book a phone demo
                    <ArrowRight className="ml-2 w-4 h-4" />
                  </Link>
                  <Link
                    href="/dashboard/assistant"
                    className="border border-gray-700 hover:border-gray-500 text-gray-200 hover:text-white px-6 py-3 rounded-lg font-semibold transition-all duration-200 inline-flex items-center justify-center"
                  >
                    Try the voice agent
                  </Link>
                </div>
                <div className="flex items-center space-x-4 text-sm text-gray-400">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-teal-400 rounded-full animate-pulse" />
                    <span>Live coverage 7a–11p</span>
                  </div>
                  <span className="hidden sm:inline text-gray-700">•</span>
                  <span>English + Spanish supported</span>
                </div>
              </div>

              <div>
                <div className="bg-gray-800 border border-gray-700 rounded-2xl p-8 shadow-2xl">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center space-x-3">
                      <div className="w-2 h-2 bg-teal-400 rounded-full"></div>
                      <span className="text-sm text-gray-300">LIVE CALL • SERVIO</span>
                    </div>
                    <span className="text-xs text-gray-500">Vapi Agent</span>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-start space-x-3">
                      <Phone className="w-5 h-5 text-blue-400 mt-0.5" />
                      <div>
                        <p className="text-sm text-gray-400">Agent picks up: “Thanks for calling, what can I get started for you?”</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <Utensils className="w-5 h-5 text-teal-400 mt-0.5" />
                      <div>
                        <p className="text-sm text-gray-400">Captures items, modifiers, pickup vs delivery, and payment prefs.</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <RefreshCw className="w-5 h-5 text-yellow-400 mt-0.5" />
                      <div>
                        <p className="text-sm text-gray-400">Checks hours, 86&apos;d items, and syncs to POS + delivery partners.</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <MessageSquare className="w-5 h-5 text-green-400 mt-0.5" />
                      <div>
                        <p className="text-sm text-gray-400">Texts confirmation to guest and hands off to your kitchen queue.</p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-6 grid grid-cols-2 gap-4">
                    <div className="bg-gray-900/70 border border-gray-700 rounded-xl p-4">
                      <p className="text-xs text-gray-500 mb-1">Answer speed</p>
                      <p className="text-2xl font-bold text-white">~2 rings</p>
                      <p className="text-xs text-teal-400">No missed revenue</p>
                    </div>
                    <div className="bg-gray-900/70 border border-gray-700 rounded-xl p-4">
                      <p className="text-xs text-gray-500 mb-1">Call capture</p>
                      <p className="text-2xl font-bold text-white">98%</p>
                      <p className="text-xs text-teal-400">with live human handoff safety</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Services Section */}
        <section id="services" className="py-24 bg-gray-900">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">What Servio runs</h2>
              <p className="text-xl text-gray-300 max-w-3xl mx-auto">
                One operating system for the work that costs you time, labor, and mistakes.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {/* Assistant & Phone */}
              <div className="bg-gray-800 border border-gray-700 rounded-2xl p-8 hover:border-blue-500/50 transition-all duration-300">
                <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center mb-6">
                  <Phone className="w-6 h-6 text-blue-400" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-4">Assistant & Phone</h3>
                <p className="text-gray-400 leading-relaxed">
                  Vapi-powered voice for calls and in-app commands—answers in two rings and executes across your menus, orders, and ops.
                </p>
              </div>

              {/* Orders */}
              <div className="bg-gray-800 border border-gray-700 rounded-2xl p-8 hover:border-teal-500/50 transition-all duration-300">
                <div className="w-12 h-12 bg-teal-500/20 rounded-lg flex items-center justify-center mb-6">
                  <ShoppingCart className="w-6 h-6 text-teal-400" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-4">Orders</h3>
                <p className="text-gray-400 leading-relaxed">
                  A single view of what’s cooking now—status, throughput, and issues.
                </p>
              </div>

              {/* Menu */}
              <div className="bg-gray-800 border border-gray-700 rounded-2xl p-8 hover:border-amber-500/50 transition-all duration-300">
                <div className="w-12 h-12 bg-amber-500/20 rounded-lg flex items-center justify-center mb-6">
                  <Utensils className="w-6 h-6 text-amber-400" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-4">Menu</h3>
                <p className="text-gray-400 leading-relaxed">
                  Keep categories clean and updates consistent—no more “which menu is right?”
                </p>
              </div>

              {/* Marketing */}
              <div className="bg-gray-800 border border-gray-700 rounded-2xl p-8 hover:border-pink-500/50 transition-all duration-300">
                <div className="w-12 h-12 bg-pink-500/20 rounded-lg flex items-center justify-center mb-6">
                  <MessageSquare className="w-6 h-6 text-pink-400" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-4">Marketing</h3>
                <p className="text-gray-400 leading-relaxed">
                  Launch SMS and email campaigns that bring guests back—without extra tools.
                </p>
              </div>

              {/* Staff & Ops */}
              <div className="bg-gray-800 border border-gray-700 rounded-2xl p-8 hover:border-purple-500/50 transition-all duration-300">
                <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center mb-6">
                  <Users className="w-6 h-6 text-purple-400" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-4">Staff & Ops</h3>
                <p className="text-gray-400 leading-relaxed">
                  Run the shift: team visibility, schedules, and day-to-day operations.
                </p>
              </div>

              {/* Inventory */}
              <div className="bg-gray-800 border border-gray-700 rounded-2xl p-8 hover:border-orange-500/50 transition-all duration-300">
                <div className="w-12 h-12 bg-orange-500/20 rounded-lg flex items-center justify-center mb-6">
                  <Package className="w-6 h-6 text-orange-400" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-4">Inventory</h3>
                <p className="text-gray-400 leading-relaxed">
                  Know what you have, what you’re burning, and what will run out next.
                </p>
              </div>

              {/* Receipts */}
              <div className="bg-gray-800 border border-gray-700 rounded-2xl p-8 hover:border-green-500/50 transition-all duration-300">
                <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center mb-6">
                  <CheckCircle2 className="w-6 h-6 text-green-400" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-4">Receipts</h3>
                <p className="text-gray-400 leading-relaxed">
                  Upload and track invoices so costs don’t disappear into a folder.
                </p>
              </div>

              {/* Integrations */}
              <div className="bg-gray-800 border border-gray-700 rounded-2xl p-8 hover:border-cyan-500/50 transition-all duration-300">
                <div className="w-12 h-12 bg-cyan-500/20 rounded-lg flex items-center justify-center mb-6">
                  <RefreshCw className="w-6 h-6 text-cyan-400" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-4">Integrations</h3>
                <p className="text-gray-400 leading-relaxed">
                  Connect the systems you already use so data stays in sync.
                </p>
              </div>

              {/* Profile */}
              <div className="bg-gray-800 border border-gray-700 rounded-2xl p-8 hover:border-indigo-500/50 transition-all duration-300">
                <div className="w-12 h-12 bg-indigo-500/20 rounded-lg flex items-center justify-center mb-6">
                  <Smartphone className="w-6 h-6 text-indigo-400" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-4">Restaurant Profile</h3>
                <p className="text-gray-400 leading-relaxed">
                  Keep your brand details and restaurant info consistent across the team.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Dashboard Experience Section */}
        <section className="py-24 bg-gray-850">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              <div>
                <div className="inline-flex items-center px-4 py-2 rounded-full bg-teal-500/20 border border-teal-500/30 text-teal-300 text-sm font-medium mb-6">
                  Dashboard Experience
                </div>
                <h2 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
                  See the whole shift in one glance.<br />
                  <span className="text-teal-400">Decide in seconds.</span>
                </h2>
                <p className="text-xl text-gray-300 mb-8 leading-relaxed">
                  Clear numbers, clear actions. The dashboards stay simple and fast so managers and staff can execute without digging through tabs.
                </p>
                
                <div className="flex flex-wrap gap-3 mb-8">
                  <span className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300">Orders + Revenue</span>
                  <span className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300">Menu + Updates</span>
                  <span className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300">Inventory + Receipts</span>
                  <span className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300">Staff Ops</span>
                </div>
              </div>

              <div className="relative">
                <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 shadow-2xl">
                  {/* Dashboard Header */}
                  <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-700">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-teal-400 rounded-full"></div>
                      <span className="text-sm text-gray-300">SERVIO KITCHEN • LIVE</span>
                    </div>
                    <span className="text-sm text-gray-500">JAN 20, 2026</span>
                  </div>

                  {/* Metrics Grid */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Revenue</p>
                      <p className="text-2xl font-bold text-teal-400">$11,256</p>
                      <p className="text-xs text-teal-400">+12%</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Orders</p>
                      <p className="text-2xl font-bold text-blue-400">245</p>
                      <p className="text-xs text-green-400">+5%</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Avg Ticket</p>
                      <p className="text-2xl font-bold text-white">$42</p>
                      <p className="text-xs text-red-400">-2%</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Labor</p>
                      <p className="text-2xl font-bold text-orange-400">18%</p>
                      <p className="text-xs text-gray-500">Optimum</p>
                    </div>
                  </div>

                  {/* Charts Section */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-gray-900 rounded-lg p-4">
                      <p className="text-xs text-gray-500 mb-2">SALES MIX</p>
                      <div className="w-12 h-12 border-4 border-teal-400 border-t-transparent rounded-full mx-auto mb-2"></div>
                      <div className="text-xs text-gray-400">
                        <div className="flex justify-between">
                          <span>Online</span>
                          <span>46%</span>
                        </div>
                        <div className="flex justify-between">
                          <span>In-house</span>
                          <span>34%</span>
                        </div>
                      </div>
                    </div>
                    <div className="bg-gray-900 rounded-lg p-4">
                      <p className="text-xs text-gray-500 mb-2">ORDER VOLUME</p>
                      <div className="h-8 bg-gradient-to-r from-teal-400 to-blue-400 rounded opacity-60"></div>
                    </div>
                    <div className="bg-gray-900 rounded-lg p-4">
                      <p className="text-xs text-gray-500 mb-2">WEEKLY</p>
                      <p className="text-xs text-gray-400">Peak traffic detected. AI suggested staffing adjustments.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Grid Section */}
        <section id="features" className="py-24 bg-gray-900">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">Built for speed on shift</h2>
              <p className="text-xl text-gray-300 max-w-3xl mx-auto">
                Less busywork. Fewer missed details. More control.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {/* Performance Analytics */}
              <div className="bg-gray-800 border border-gray-700 rounded-2xl p-8 hover:border-teal-500/50 transition-all duration-300">
                <div className="w-12 h-12 bg-teal-500/20 rounded-lg flex items-center justify-center mb-6">
                  <BarChart3 className="w-6 h-6 text-teal-400" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-4">Performance Analytics</h3>
                <p className="text-gray-400 leading-relaxed">
                  Track revenue and order volume so you can react before problems compound.
                </p>
              </div>

              {/* Staff Management */}
              <div className="bg-gray-800 border border-gray-700 rounded-2xl p-8 hover:border-blue-500/50 transition-all duration-300">
                <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center mb-6">
                  <Clock className="w-6 h-6 text-blue-400" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-4">Staff Management</h3>
                <p className="text-gray-400 leading-relaxed">
                  Keep schedules and staffing visibility tight—so labor doesn’t drift.
                </p>
              </div>

              {/* Receipt + Cost Tracking */}
              <div className="bg-gray-800 border border-gray-700 rounded-2xl p-8 hover:border-green-500/50 transition-all duration-300">
                <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center mb-6">
                  <CheckCircle2 className="w-6 h-6 text-green-400" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-4">Receipts & Costs</h3>
                <p className="text-gray-400 leading-relaxed">
                  Centralize invoices to keep purchasing accountable and costs visible.
                </p>
              </div>

              {/* Always-on Support */}
              <div className="bg-gray-800 border border-gray-700 rounded-2xl p-8 hover:border-purple-500/50 transition-all duration-300">
                <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center mb-6">
                  <Headphones className="w-6 h-6 text-purple-400" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-4">Real Support</h3>
                <p className="text-gray-400 leading-relaxed">
                  Get help from people who understand restaurant ops, not generic scripts.
                </p>
              </div>

              {/* Secure by Design */}
              <div className="bg-gray-800 border border-gray-700 rounded-2xl p-8 hover:border-yellow-500/50 transition-all duration-300">
                <div className="w-12 h-12 bg-yellow-500/20 rounded-lg flex items-center justify-center mb-6">
                  <Shield className="w-6 h-6 text-yellow-400" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-4">Secure & Controlled</h3>
                <p className="text-gray-400 leading-relaxed">
                  Role-based access so the right people can change the right things.
                </p>
              </div>

              {/* Reliable & Fast */}
              <div className="bg-gray-800 border border-gray-700 rounded-2xl p-8 hover:border-red-500/50 transition-all duration-300">
                <div className="w-12 h-12 bg-red-500/20 rounded-lg flex items-center justify-center mb-6">
                  <Zap className="w-6 h-6 text-red-400" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-4">Fast & Reliable</h3>
                <p className="text-gray-400 leading-relaxed">
                  Built to stay responsive on mobile, tablet, and desktop—during the rush.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="py-24 bg-gray-850">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">Pricing</h2>
              <p className="text-xl text-gray-300 max-w-3xl mx-auto">
                Pick the plan that matches your operation. Scale up as you add locations and workflows.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              {/* Starter Plan */}
              <div className="bg-gray-800 border border-gray-700 rounded-2xl p-8 hover:border-gray-600 transition-all duration-300">
                <h3 className="text-2xl font-bold text-white mb-2">Starter</h3>
                <div className="flex items-baseline mb-6">
                  <span className="text-4xl font-bold text-white">$49</span>
                  <span className="text-gray-400 ml-2">/mo</span>
                </div>
                <p className="text-gray-400 mb-8">Get control of the basics: orders, visibility, and daily execution.</p>
                <button className="w-full bg-gray-700 hover:bg-gray-600 text-white py-3 px-6 rounded-lg font-semibold transition-colors duration-200 flex items-center justify-center">
                  Select Plan
                  <ArrowRight className="ml-2 w-4 h-4" />
                </button>
              </div>

              {/* Operations Plan - Most Popular */}
              <div className="bg-gray-800 border-2 border-teal-500 rounded-2xl p-8 relative transform scale-105">
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="bg-teal-500 text-white px-4 py-1 rounded-full text-sm font-medium">
                    MOST POPULAR
                  </span>
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">Operations</h3>
                <div className="flex items-baseline mb-6">
                  <span className="text-4xl font-bold text-white">$129</span>
                  <span className="text-gray-400 ml-2">/mo</span>
                </div>
                <p className="text-gray-400 mb-8">The full dashboard: orders, menu, marketing, inventory + receipts, staff, and integrations.</p>
                <button className="w-full bg-teal-600 hover:bg-teal-700 text-white py-3 px-6 rounded-lg font-semibold transition-colors duration-200 flex items-center justify-center">
                  Select Plan
                  <ArrowRight className="ml-2 w-4 h-4" />
                </button>
              </div>

              {/* Voice Plan */}
              <div className="bg-gray-800 border border-gray-700 rounded-2xl p-8 hover:border-gray-600 transition-all duration-300">
                <h3 className="text-2xl font-bold text-white mb-2">Voice</h3>
                <div className="flex items-baseline mb-6">
                  <span className="text-4xl font-bold text-white">$179</span>
                  <span className="text-gray-400 ml-2">/mo</span>
                </div>
                <p className="text-gray-400 mb-8">Hands-free workflows and the AI assistant that helps your team execute faster.</p>
                <button className="w-full bg-gray-700 hover:bg-gray-600 text-white py-3 px-6 rounded-lg font-semibold transition-colors duration-200 flex items-center justify-center">
                  Select Plan
                  <ArrowRight className="ml-2 w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section id="faq" className="py-24 bg-gray-900">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">Frequently Asked Questions</h2>
            </div>
            
            <div className="space-y-6">
              {/* FAQ Item 1 */}
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
                <h3 className="text-xl font-semibold text-white mb-4">Is Servio app-ready?</h3>
                <p className="text-gray-400 leading-relaxed">
                  Yes. Servio is PWA-installable and optimized for mobile, tablet, and desktop.
                </p>
              </div>

              {/* FAQ Item 2 */}
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
                <h3 className="text-xl font-semibold text-white mb-4">Does Servio support delivery platforms?</h3>
                <p className="text-gray-400 leading-relaxed">
                  Servio supports integrations via the dashboard’s Integrations area. Availability depends on your stack—tell us what you run and we’ll map the path.
                </p>
              </div>

              {/* FAQ Item 3 */}
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
                <h3 className="text-xl font-semibold text-white mb-4">Can staff clock in and out from mobile?</h3>
                <p className="text-gray-400 leading-relaxed">
                  Yes—Servio is built to run from mobile, tablet, and desktop so the team can work where the work happens.
                </p>
              </div>

              {/* FAQ Item 4 */}
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
                <h3 className="text-xl font-semibold text-white mb-4">What integrations are available?</h3>
                <p className="text-gray-400 leading-relaxed">
                  Start with what matters most (POS, ordering channels, accounting, etc.). We’ll confirm what’s supported and set up a clean data sync.
                </p>
              </div>

              {/* FAQ Item 5 */}
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
                <h3 className="text-xl font-semibold text-white mb-4">How does voice ordering work?</h3>
                <p className="text-gray-400 leading-relaxed">
                  The Assistant understands natural language commands for orders, inventory, and operations. You tell it what to do—Servio handles the clicks.
                </p>
              </div>
            </div>

            <div className="text-center mt-12">
              <Link
                href="/dashboard/assistant"
                className="inline-flex items-center bg-teal-600 hover:bg-teal-700 text-white px-8 py-4 rounded-lg font-semibold text-lg transition-all duration-200 transform hover:scale-105"
              >
                Try the Assistant
                <ArrowRight className="ml-2 w-5 h-5" />
              </Link>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="bg-gray-900 py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
              <div>
                <div className="flex items-center mb-4">
                  <img src="/images/servio_logo_transparent_tight.png" alt="Servio Logo" className="h-8 w-auto brightness-0 invert" />
                  <span className="ml-2 text-xl font-bold text-white">Servio</span>
                </div>
                <p className="text-gray-400 mb-4">
                  One dashboard to run orders, menu, marketing, inventory + receipts, staff ops, and integrations.
                </p>
              </div>

              <div>
                <h3 className="text-white font-semibold mb-4">Services</h3>
                <ul className="space-y-2">
                  <li><a href="#" className="text-gray-400 hover:text-white">Assistant</a></li>
                  <li><a href="#" className="text-gray-400 hover:text-white">Orders</a></li>
                  <li><a href="#" className="text-gray-400 hover:text-white">Inventory</a></li>
                  <li><a href="#" className="text-gray-400 hover:text-white">Staff</a></li>
                </ul>
              </div>

              <div>
                <h3 className="text-white font-semibold mb-4">Features</h3>
                <ul className="space-y-2">
                  <li><a href="#" className="text-gray-400 hover:text-white">AI Assistant</a></li>
                  <li><a href="#" className="text-gray-400 hover:text-white">Analytics</a></li>
                  <li><a href="#" className="text-gray-400 hover:text-white">Receipts</a></li>
                  <li><a href="#" className="text-gray-400 hover:text-white">Integrations</a></li>
                </ul>
              </div>

              <div>
                <h3 className="text-white font-semibold mb-4">Company</h3>
                <ul className="space-y-2">
                  <li><a href="#" className="text-gray-400 hover:text-white">Pricing</a></li>
                  <li><a href="#" className="text-gray-400 hover:text-white">FAQ</a></li>
                  <li><Link href="/login" className="text-gray-400 hover:text-white">Login</Link></li>
                  <li><a href="#" className="text-gray-400 hover:text-white">Support</a></li>
                </ul>
              </div>
            </div>

            <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row justify-between items-center">
              <p className="text-gray-400">© 2026 Servio. All rights reserved.</p>
              <div className="flex space-x-6 mt-4 md:mt-0">
                <a href="#" className="text-gray-400 hover:text-white">Privacy Policy</a>
                <a href="#" className="text-gray-400 hover:text-white">Terms of Service</a>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  )
}
