import React from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { 
  Mic, Bot, Shield, Zap, Clock, Users, 
  Phone, Smartphone, RefreshCw, BarChart3, 
  CheckCircle2, MessageSquare, HeadphonesIcon,
  Utensils, ShoppingCart, Inventory,
  Calendar, DollarSign, TrendingUp,
  ArrowRight, PlayCircle, Star
} from 'lucide-react'

export default function HomePage() {
  return (
    <>
      <Head>
        <title>Servio - Restaurant Operating System | Voice-First Operations</title>
        <meta name="description" content="Servio is a comprehensive restaurant operating system that unifies orders, voice interactions, availability, inventory, staff operations, and time tracking into a single source of truth." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta property="og:title" content="Servio - Restaurant Operating System" />
        <meta property="og:description" content="Voice-first restaurant operations platform. Unify orders, inventory, staff, and delivery platforms." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://servio.com" />
      </Head>

      <div className="min-h-screen bg-white">
        {/* Navigation */}
        <nav className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-md shadow-sm z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center">
                <Bot className="h-8 w-8 text-blue-600" />
                <span className="ml-2 text-xl font-bold text-gray-900">Servio</span>
              </div>
              <div className="hidden md:flex items-center space-x-8">
                <a href="#features" className="text-gray-600 hover:text-gray-900 font-medium">Features</a>
                <a href="#how-it-works" className="text-gray-600 hover:text-gray-900 font-medium">How It Works</a>
                <a href="#pricing" className="text-gray-600 hover:text-gray-900 font-medium">Pricing</a>
                <a href="#demo" className="text-gray-600 hover:text-gray-900 font-medium">Demo</a>
              </div>
              <div className="flex items-center space-x-4">
                <Link 
                  href="/dashboard/assistant" 
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-all duration-200 transform hover:scale-105"
                >
                  Try Servio Free
                </Link>
              </div>
            </div>
          </div>
        </nav>

        {/* Hero Section */}
        <div className="relative overflow-hidden pt-16">
          {/* Background Elements */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-indigo-50" />
          <div className="absolute top-0 left-0 w-full h-full">
            <div className="absolute top-20 left-10 w-72 h-72 bg-blue-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-pulse" />
            <div className="absolute top-40 right-10 w-72 h-72 bg-purple-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-pulse" style={{ animationDelay: '2s' }} />
            <div className="absolute bottom-20 left-20 w-72 h-72 bg-indigo-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-pulse" style={{ animationDelay: '4s' }} />
          </div>

          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-32">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-center"
            >
              {/* Badge */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="inline-flex items-center px-4 py-2 rounded-full bg-blue-100 text-blue-800 text-sm font-medium mb-8"
              >
                <Bot className="w-4 h-4 mr-2" />
                Restaurant Operating System
              </motion.div>

              <h1 className="text-5xl md:text-7xl font-extrabold text-gray-900 mb-8 leading-tight">
                The <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Voice-First</span>
                <br />
                Restaurant Platform
              </h1>
              
              <p className="text-xl md:text-2xl text-gray-600 mb-12 max-w-4xl mx-auto leading-relaxed">
                Servio unifies <strong>orders, voice interactions, inventory, staff operations,</strong> and <strong>delivery platforms</strong> into one intelligent command center. Built for real restaurant conditions.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-6 justify-center items-center mb-16">
                <Link 
                  href="/dashboard/assistant"
                  className="group bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-8 py-4 rounded-xl font-semibold text-lg transition-all duration-200 transform hover:scale-105 shadow-xl"
                >
                  <div className="flex items-center">
                    <Mic className="w-5 h-5 mr-2 group-hover:animate-pulse" />
                    Try Servio Assistant Free
                  </div>
                </Link>
                
                <button className="group bg-white border-2 border-gray-200 hover:border-gray-300 text-gray-700 px-8 py-4 rounded-xl font-semibold text-lg transition-all duration-200 shadow-lg">
                  <div className="flex items-center">
                    <PlayCircle className="w-5 h-5 mr-2 group-hover:text-blue-600" />
                    Watch Demo (2 min)
                  </div>
                </button>
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

        {/* Core Problem Section */}
        <div className="py-24 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-gray-900 mb-6">
                The Restaurant Chaos Problem
              </h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                Modern restaurants juggle multiple disconnected systems that don&apos;t talk to each other, leading to chaos during rush hours.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                className="bg-white p-6 rounded-xl shadow-sm border border-gray-200"
              >
                <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mb-4">
                  <Smartphone className="w-6 h-6 text-red-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Multiple Tablets</h3>
                <p className="text-gray-600">
                  DoorDash, Uber Eats, GrubHub tablets cluttering your counter. Each with different interfaces and workflows.
                </p>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white p-6 rounded-xl shadow-sm border border-gray-200"
              >
                <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mb-4">
                  <Phone className="w-6 h-6 text-red-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Missed Phone Orders</h3>
                <p className="text-gray-600">
                  Staff too busy to answer phones. Lost revenue from customers who hang up and order elsewhere.
                </p>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white p-6 rounded-xl shadow-sm border border-gray-200"
              >
                <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mb-4">
                  <RefreshCw className="w-6 h-6 text-red-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Manual 86ing</h3>
                <p className="text-gray-600">
                  When you run out of an item, you have to manually update 5+ different platforms. Time-consuming and error-prone.
                </p>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-white p-6 rounded-xl shadow-sm border border-gray-200"
              >
                <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mb-4">
                  <Users className="w-6 h-6 text-red-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Staff Confusion</h3>
                <p className="text-gray-600">
                  Different systems, different workflows. New staff need extensive training on multiple platforms.
                </p>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="bg-white p-6 rounded-xl shadow-sm border border-gray-200"
              >
                <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mb-4">
                  <Inventory className="w-6 h-6 text-red-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Inventory Waste</h3>
                <p className="text-gray-600">
                  No real-time tracking. Over-ordering, spoilage, and running out of popular items during peak hours.
                </p>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="bg-white p-6 rounded-xl shadow-sm border border-gray-200"
              >
                <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mb-4">
                  <BarChart3 className="w-6 h-6 text-red-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Flying Blind</h3>
                <p className="text-gray-600">
                  Scattered data across platforms. No unified view of performance, staff efficiency, or operational metrics.
                </p>
              </motion.div>
            </div>

            <div className="text-center">
              <div className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold text-lg">
                <ArrowRight className="w-5 h-5 mr-2" />
                Servio Solves All of This
              </div>
            </div>
          </div>
        </div>

        {/* Core Features Section */}
        <div id="features" className="py-24 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-20">
              <h2 className="text-4xl font-bold text-gray-900 mb-6">
                One Platform. Complete Control.
              </h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                Servio replaces the chaos with a single source of truth for your entire restaurant operation.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center mb-20">
              {/* Feature 1: Voice-First Operations */}
              <motion.div
                initial={{ opacity: 0, x: -50 }}
                whileInView={{ opacity: 1, x: 0 }}
                className="order-2 lg:order-1"
              >
                <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mb-6">
                  <Mic className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="text-3xl font-bold text-gray-900 mb-6">Voice-First Operations</h3>
                <p className="text-lg text-gray-600 mb-8">
                  Talk to Servio like a team member. No clicking through menus during rush hour. Just speak naturally and get instant results.
                </p>
                <div className="space-y-4">
                  <div className="flex items-start">
                    <CheckCircle2 className="w-6 h-6 text-green-600 mr-3 mt-0.5" />
                    <div>
                      <p className="font-semibold text-gray-900">&quot;86 the jerk chicken on all platforms&quot;</p>
                      <p className="text-gray-600">Instant availability sync across DoorDash, Uber Eats, GrubHub</p>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <CheckCircle2 className="w-6 h-6 text-green-600 mr-3 mt-0.5" />
                    <div>
                      <p className="font-semibold text-gray-900">&quot;Show me orders over 20 minutes&quot;</p>
                      <p className="text-gray-600">Real-time order queue analysis and alerts</p>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <CheckCircle2 className="w-6 h-6 text-green-600 mr-3 mt-0.5" />
                    <div>
                      <p className="font-semibold text-gray-900">&quot;Add 2 cases of chicken to inventory&quot;</p>
                      <p className="text-gray-600">Voice-powered inventory management</p>
                    </div>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                className="order-1 lg:order-2"
              >
                <div className="bg-gradient-to-br from-blue-50 to-indigo-100 rounded-2xl p-8">
                  <div className="bg-white rounded-xl p-6 shadow-lg">
                    <div className="flex items-center mb-4">
                      <div className="w-4 h-4 bg-green-400 rounded-full animate-pulse mr-3"></div>
                      <span className="text-sm font-medium text-gray-700">Listening...</span>
                    </div>
                    <div className="space-y-4">
                      <div className="bg-blue-50 p-3 rounded-lg">
                        <p className="text-sm text-gray-800">&quot;Show me today&apos;s low stock items&quot;</p>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <p className="text-sm text-gray-600">Found 3 items below reorder threshold:</p>
                        <div className="mt-2 space-y-1">
                          <div className="text-xs text-red-600">• Rice (2 bags left, reorder at 5)</div>
                          <div className="text-xs text-red-600">• Chicken (4 pieces left, reorder at 10)</div>
                          <div className="text-xs text-red-600">• Plantains (1 box left, reorder at 3)</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Feature 2: AI Phone Agent */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center mb-20">
              <motion.div
                initial={{ opacity: 0, x: -50 }}
                whileInView={{ opacity: 1, x: 0 }}
              >
                <div className="bg-gradient-to-br from-green-50 to-emerald-100 rounded-2xl p-8">
                  <div className="bg-white rounded-xl p-6 shadow-lg">
                    <div className="flex items-center mb-4">
                      <Phone className="w-6 h-6 text-green-600 mr-3" />
                      <span className="text-sm font-medium text-gray-700">Incoming Call</span>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-start">
                        <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3 mt-1">
                          <HeadphonesIcon className="w-4 h-4 text-green-600" />
                        </div>
                        <div>
                          <p className="text-sm text-gray-800">&quot;Hi, I&apos;d like to place an order for pickup...&quot;</p>
                        </div>
                      </div>
                      <div className="flex items-start">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3 mt-1">
                          <Bot className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">&quot;Great! I can help you with that. What would you like to order today?&quot;</p>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <p className="text-xs text-gray-500">✓ Order captured • ✓ Payment processed • ✓ Kitchen notified</p>
                    </div>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 50 }}
                whileInView={{ opacity: 1, x: 0 }}
              >
                <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mb-6">
                  <Phone className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-3xl font-bold text-gray-900 mb-6">AI Phone Agent</h3>
                <p className="text-lg text-gray-600 mb-8">
                  Never miss another phone order. Servio&apos;s AI answers every call, takes orders, answers menu questions, and processes payments automatically.
                </p>
                <div className="space-y-4">
                  <div className="flex items-start">
                    <CheckCircle2 className="w-6 h-6 text-green-600 mr-3 mt-0.5" />
                    <div>
                      <p className="font-semibold text-gray-900">24/7 Phone Availability</p>
                      <p className="text-gray-600">AI handles calls even during peak hours or when staff is busy</p>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <CheckCircle2 className="w-6 h-6 text-green-600 mr-3 mt-0.5" />
                    <div>
                      <p className="font-semibold text-gray-900">Natural Conversation</p>
                      <p className="text-gray-600">Customers don&apos;t even realize they&apos;re talking to AI</p>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <CheckCircle2 className="w-6 h-6 text-green-600 mr-3 mt-0.5" />
                    <div>
                      <p className="font-semibold text-gray-900">Instant Order Processing</p>
                      <p className="text-gray-600">Orders go straight to kitchen with payment confirmation</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Feature 3: Unified Order Management */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center mb-20">
              <motion.div
                initial={{ opacity: 0, x: -50 }}
                whileInView={{ opacity: 1, x: 0 }}
                className="order-2 lg:order-1"
              >
                <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mb-6">
                  <ShoppingCart className="w-8 h-8 text-orange-600" />
                </div>
                <h3 className="text-3xl font-bold text-gray-900 mb-6">Unified Order Management</h3>
                <p className="text-lg text-gray-600 mb-8">
                  All orders from every channel in one place. Website, phone, DoorDash, Uber Eats, GrubHub - see everything in a single queue.
                </p>
                <div className="space-y-4">
                  <div className="flex items-start">
                    <CheckCircle2 className="w-6 h-6 text-green-600 mr-3 mt-0.5" />
                    <div>
                      <p className="font-semibold text-gray-900">Single Kitchen Display</p>
                      <p className="text-gray-600">All orders prioritized by pickup/delivery time</p>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <CheckCircle2 className="w-6 h-6 text-green-600 mr-3 mt-0.5" />
                    <div>
                      <p className="font-semibold text-gray-900">Real-time Status Updates</p>
                      <p className="text-gray-600">Customers get automatic notifications across all platforms</p>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <CheckCircle2 className="w-6 h-6 text-green-600 mr-3 mt-0.5" />
                    <div>
                      <p className="font-semibold text-gray-900">Smart Queue Management</p>
                      <p className="text-gray-600">AI optimizes order sequence for efficiency</p>
                    </div>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                className="order-1 lg:order-2"
              >
                <div className="bg-gradient-to-br from-orange-50 to-red-100 rounded-2xl p-8">
                  <div className="bg-white rounded-xl p-6 shadow-lg">
                    <h4 className="font-semibold text-gray-900 mb-4">Kitchen Queue</h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                        <div>
                          <p className="text-sm font-medium text-gray-900">Order #214 - DoorDash</p>
                          <p className="text-xs text-gray-600">2x Jerk Chicken • Ready in 8 min</p>
                        </div>
                        <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded-full">Preparing</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                        <div>
                          <p className="text-sm font-medium text-gray-900">Order #215 - Phone</p>
                          <p className="text-xs text-gray-600">1x Curry Goat • Ready now</p>
                        </div>
                        <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">Ready</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                        <div>
                          <p className="text-sm font-medium text-gray-900">Order #216 - Uber Eats</p>
                          <p className="text-xs text-gray-600">3x Oxtail • Just received</p>
                        </div>
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">New</span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Feature 4: Smart Sync Engine */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              <motion.div
                initial={{ opacity: 0, x: -50 }}
                whileInView={{ opacity: 1, x: 0 }}
              >
                <div className="bg-gradient-to-br from-purple-50 to-indigo-100 rounded-2xl p-8">
                  <div className="bg-white rounded-xl p-6 shadow-lg">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-semibold text-gray-900">Sync Status</h4>
                      <div className="flex items-center">
                        <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
                        <span className="text-xs text-green-600">All Connected</span>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className="w-6 h-6 bg-red-100 rounded mr-3 flex items-center justify-center">
                            <span className="text-xs font-bold text-red-600">DD</span>
                          </div>
                          <span className="text-sm text-gray-700">DoorDash</span>
                        </div>
                        <span className="text-xs text-green-600">Synced 2s ago</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className="w-6 h-6 bg-black rounded mr-3 flex items-center justify-center">
                            <span className="text-xs font-bold text-white">UE</span>
                          </div>
                          <span className="text-sm text-gray-700">Uber Eats</span>
                        </div>
                        <span className="text-xs text-green-600">Synced 1s ago</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className="w-6 h-6 bg-orange-100 rounded mr-3 flex items-center justify-center">
                            <span className="text-xs font-bold text-orange-600">GH</span>
                          </div>
                          <span className="text-sm text-gray-700">GrubHub</span>
                        </div>
                        <span className="text-xs text-green-600">Synced 3s ago</span>
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <p className="text-xs text-gray-500">✓ Jerk Chicken marked unavailable on all platforms</p>
                    </div>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 50 }}
                whileInView={{ opacity: 1, x: 0 }}
              >
                <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mb-6">
                  <Sync className="w-8 h-8 text-purple-600" />
                </div>
                <h3 className="text-3xl font-bold text-gray-900 mb-6">Smart Sync Engine</h3>
                <p className="text-lg text-gray-600 mb-8">
                  Update once, sync everywhere. When you 86 an item or change availability, Servio automatically updates all delivery platforms in real-time.
                </p>
                <div className="space-y-4">
                  <div className="flex items-start">
                    <CheckCircle2 className="w-6 h-6 text-green-600 mr-3 mt-0.5" />
                    <div>
                      <p className="font-semibold text-gray-900">Instant Platform Updates</p>
                      <p className="text-gray-600">Changes push to DoorDash, Uber Eats, GrubHub in under 30 seconds</p>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <CheckCircle2 className="w-6 h-6 text-green-600 mr-3 mt-0.5" />
                    <div>
                      <p className="font-semibold text-gray-900">Conflict Resolution</p>
                      <p className="text-gray-600">Smart handling of API failures and sync conflicts</p>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <CheckCircle2 className="w-6 h-6 text-green-600 mr-3 mt-0.5" />
                    <div>
                      <p className="font-semibold text-gray-900">Audit Trail</p>
                      <p className="text-gray-600">Complete history of all availability changes and syncs</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>

        {/* How It Works Section */}
        <div id="how-it-works" className="py-24 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-gray-900 mb-6">
                How Servio Works
              </h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                Simple setup, immediate impact. Get your restaurant running on Servio in under an hour.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                className="text-center"
              >
                <div className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-6">
                  1
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-4">Connect Your Platforms</h3>
                <p className="text-gray-600 mb-6">
                  Link your DoorDash, Uber Eats, GrubHub, and POS accounts. Our setup wizard guides you through each step.
                </p>
                <div className="bg-white p-4 rounded-lg">
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-8 h-8 bg-red-100 rounded flex items-center justify-center">
                      <span className="text-xs font-bold text-red-600">DD</span>
                    </div>
                    <div className="w-8 h-8 bg-black rounded flex items-center justify-center">
                      <span className="text-xs font-bold text-white">UE</span>
                    </div>
                    <div className="w-8 h-8 bg-orange-100 rounded flex items-center justify-center">
                      <span className="text-xs font-bold text-orange-600">GH</span>
                    </div>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-center"
              >
                <div className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-6">
                  2
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-4">Train Your Staff</h3>
                <p className="text-gray-600 mb-6">
                  5-minute voice training session. Staff learn basic commands and start using Servio immediately.
                </p>
                <div className="bg-white p-4 rounded-lg">
                  <div className="flex items-center justify-center">
                    <Mic className="w-8 h-8 text-blue-600" />
                  </div>
                  <p className="text-sm text-gray-600 mt-2">&quot;Show me today&apos;s orders&quot;</p>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-center"
              >
                <div className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-6">
                  3
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-4">Start Operating</h3>
                <p className="text-gray-600 mb-6">
                  Everything flows through Servio now. Voice commands, unified orders, automatic sync - it just works.
                </p>
                <div className="bg-white p-4 rounded-lg">
                  <div className="flex items-center justify-center">
                    <CheckCircle2 className="w-8 h-8 text-green-600" />
                  </div>
                  <p className="text-sm text-gray-600 mt-2">Fully operational</p>
                </div>
              </motion.div>
            </div>
          </div>
        </div>

        {/* Pricing Section */}
        <div id="pricing" className="py-24 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-gray-900 mb-6">
                Simple, Transparent Pricing
              </h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                Start free, then pay as you grow. No setup fees, no long-term contracts.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              {/* Starter Plan */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                className="bg-white border-2 border-gray-200 rounded-2xl p-8"
              >
                <h3 className="text-2xl font-bold text-gray-900 mb-4">Starter</h3>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-gray-900">Free</span>
                  <span className="text-gray-600 ml-2">for 30 days</span>
                </div>
                <ul className="space-y-4 mb-8">
                  <li className="flex items-start">
                    <CheckCircle2 className="w-5 h-5 text-green-600 mr-3 mt-0.5" />
                    <span className="text-gray-600">Voice assistant</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="w-5 h-5 text-green-600 mr-3 mt-0.5" />
                    <span className="text-gray-600">Order management</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="w-5 h-5 text-green-600 mr-3 mt-0.5" />
                    <span className="text-gray-600">Basic inventory</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="w-5 h-5 text-green-600 mr-3 mt-0.5" />
                    <span className="text-gray-600">Up to 2 platforms</span>
                  </li>
                </ul>
                <Link
                  href="/dashboard/assistant"
                  className="w-full bg-gray-100 hover:bg-gray-200 text-gray-900 py-3 px-6 rounded-lg font-semibold text-center block transition-colors"
                >
                  Start Free Trial
                </Link>
              </motion.div>

              {/* Professional Plan */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-gradient-to-b from-blue-50 to-white border-2 border-blue-200 rounded-2xl p-8 relative"
              >
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <div className="bg-blue-600 text-white px-4 py-2 rounded-full text-sm font-medium">
                    Most Popular
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">Professional</h3>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-gray-900">$99</span>
                  <span className="text-gray-600 ml-2">/month</span>
                </div>
                <ul className="space-y-4 mb-8">
                  <li className="flex items-start">
                    <CheckCircle2 className="w-5 h-5 text-green-600 mr-3 mt-0.5" />
                    <span className="text-gray-600">Everything in Starter</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="w-5 h-5 text-green-600 mr-3 mt-0.5" />
                    <span className="text-gray-600">AI phone agent</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="w-5 h-5 text-green-600 mr-3 mt-0.5" />
                    <span className="text-gray-600">All delivery platforms</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="w-5 h-5 text-green-600 mr-3 mt-0.5" />
                    <span className="text-gray-600">Staff time tracking</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="w-5 h-5 text-green-600 mr-3 mt-0.5" />
                    <span className="text-gray-600">Analytics dashboard</span>
                  </li>
                </ul>
                <Link
                  href="/dashboard/assistant"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-6 rounded-lg font-semibold text-center block transition-colors"
                >
                  Start Free Trial
                </Link>
              </motion.div>

              {/* Enterprise Plan */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white border-2 border-gray-200 rounded-2xl p-8"
              >
                <h3 className="text-2xl font-bold text-gray-900 mb-4">Enterprise</h3>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-gray-900">$299</span>
                  <span className="text-gray-600 ml-2">/month</span>
                </div>
                <ul className="space-y-4 mb-8">
                  <li className="flex items-start">
                    <CheckCircle2 className="w-5 h-5 text-green-600 mr-3 mt-0.5" />
                    <span className="text-gray-600">Everything in Professional</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="w-5 h-5 text-green-600 mr-3 mt-0.5" />
                    <span className="text-gray-600">Multi-location support</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="w-5 h-5 text-green-600 mr-3 mt-0.5" />
                    <span className="text-gray-600">Custom integrations</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="w-5 h-5 text-green-600 mr-3 mt-0.5" />
                    <span className="text-gray-600">Priority support</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="w-5 h-5 text-green-600 mr-3 mt-0.5" />
                    <span className="text-gray-600">Dedicated success manager</span>
                  </li>
                </ul>
                <a
                  href="mailto:sales@servio.com"
                  className="w-full bg-gray-100 hover:bg-gray-200 text-gray-900 py-3 px-6 rounded-lg font-semibold text-center block transition-colors"
                >
                  Contact Sales
                </a>
              </motion.div>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="py-24 bg-gradient-to-r from-blue-600 to-purple-600">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
            >
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-8">
                Ready to Revolutionize Your Restaurant?
              </h2>
              <p className="text-xl text-blue-100 mb-12 max-w-3xl mx-auto">
                Join hundreds of restaurants already using Servio to streamline operations, increase efficiency, and delight customers.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
                <Link 
                  href="/dashboard/assistant"
                  className="group bg-white hover:bg-gray-50 text-blue-600 px-8 py-4 rounded-xl font-semibold text-lg transition-all duration-200 transform hover:scale-105 shadow-lg"
                >
                  <div className="flex items-center">
                    <Mic className="w-5 h-5 mr-2 group-hover:animate-pulse" />
                    Start Your Free Trial
                  </div>
                </Link>
                
                <button className="group bg-transparent border-2 border-white hover:bg-white hover:text-blue-600 text-white px-8 py-4 rounded-xl font-semibold text-lg transition-all duration-200">
                  <div className="flex items-center">
                    <MessageSquare className="w-5 h-5 mr-2" />
                    Schedule a Demo
                  </div>
                </button>
              </div>

              <p className="text-blue-100 mt-8 text-sm">
                No credit card required • Free 30-day trial • Cancel anytime
              </p>
            </motion.div>
          </div>
        </div>

        {/* Footer */}
        <footer className="bg-gray-900 py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
              <div>
                <div className="flex items-center mb-4">
                  <Bot className="h-8 w-8 text-blue-400" />
                  <span className="ml-2 text-xl font-bold text-white">Servio</span>
                </div>
                <p className="text-gray-400 mb-4">
                  The voice-first restaurant operating system that unifies your entire operation.
                </p>
                <div className="flex items-center space-x-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star key={star} className="w-4 h-4 text-yellow-400 fill-current" />
                  ))}
                  <span className="ml-2 text-sm text-gray-400">4.9/5 from 200+ restaurants</span>
                </div>
              </div>
              
              <div>
                <h3 className="text-white font-semibold mb-4">Product</h3>
                <ul className="space-y-2">
                  <li><a href="#features" className="text-gray-400 hover:text-white">Features</a></li>
                  <li><a href="#how-it-works" className="text-gray-400 hover:text-white">How It Works</a></li>
                  <li><a href="#pricing" className="text-gray-400 hover:text-white">Pricing</a></li>
                  <li><Link href="/dashboard/assistant" className="text-gray-400 hover:text-white">Try Demo</Link></li>
                </ul>
              </div>
              
              <div>
                <h3 className="text-white font-semibold mb-4">Company</h3>
                <ul className="space-y-2">
                  <li><a href="#" className="text-gray-400 hover:text-white">About</a></li>
                  <li><a href="#" className="text-gray-400 hover:text-white">Blog</a></li>
                  <li><a href="#" className="text-gray-400 hover:text-white">Careers</a></li>
                  <li><a href="#" className="text-gray-400 hover:text-white">Contact</a></li>
                </ul>
              </div>
              
              <div>
                <h3 className="text-white font-semibold mb-4">Support</h3>
                <ul className="space-y-2">
                  <li><a href="#" className="text-gray-400 hover:text-white">Help Center</a></li>
                  <li><a href="#" className="text-gray-400 hover:text-white">Documentation</a></li>
                  <li><a href="#" className="text-gray-400 hover:text-white">API Reference</a></li>
                  <li><a href="mailto:support@servio.com" className="text-gray-400 hover:text-white">Email Support</a></li>
                </ul>
              </div>
            </div>
            
            <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row justify-between items-center">
              <p className="text-gray-400">© 2026 Servio. All rights reserved.</p>
              <div className="flex space-x-6 mt-4 md:mt-0">
                <a href="#" className="text-gray-400 hover:text-white">Privacy Policy</a>
                <a href="#" className="text-gray-400 hover:text-white">Terms of Service</a>
                <a href="#" className="text-gray-400 hover:text-white">Security</a>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  )
}