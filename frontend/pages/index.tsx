import React from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Mic, Bot, Shield, Zap, Clock, Users,
  Phone, Smartphone, BarChart3,
  CheckCircle2, MessageSquare, HeadphonesIcon,
  Utensils, ShoppingCart,
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

      <div className="min-h-screen gradient-surface">
        {/* Navigation */}
        <nav className="fixed top-0 left-0 right-0 bg-white/80 dark:bg-surface-900/80 backdrop-blur-xl shadow-sm z-50 border-b border-surface-200/50 dark:border-surface-800/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <motion.div
                className="flex items-center"
                whileHover={{ scale: 1.02 }}
              >
                <div className="relative">
                  <Bot className="h-8 w-8 text-primary-600 dark:text-primary-400" />
                  <motion.div
                    className="absolute -top-1 -right-1 w-3 h-3 bg-servio-orange-500 rounded-full"
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                </div>
                <span className="ml-2 text-xl font-bold text-surface-900 dark:text-surface-100">Servio</span>
                <motion.div
                  className="ml-2 px-2 py-1 bg-servio-orange-100 dark:bg-servio-orange-900/30 text-servio-orange-700 dark:text-servio-orange-300 text-2xs font-medium rounded-full"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  AI
                </motion.div>
              </motion.div>

              <div className="hidden md:flex items-center space-x-8">
                <a href="#features" className="text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-100 font-medium transition-colors">Features</a>
                <a href="#how-it-works" className="text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-100 font-medium transition-colors">How It Works</a>
                <a href="#pricing" className="text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-100 font-medium transition-colors">Pricing</a>
                <a href="#demo" className="text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-100 font-medium transition-colors">Demo</a>
              </div>

              <div className="flex items-center space-x-4">
                <Link
                  href="/dashboard/assistant"
                  className="btn-primary"
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

        {/* Features Section */}
        <div className="py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                Why Restaurant Staff Love Servio
              </h2>
              <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                Hands-free assistance that understands restaurant operations
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="bg-blue-50 p-6 rounded-xl"
              >
                <Mic className="w-12 h-12 text-blue-600 mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Voice Commands</h3>
                <p className="text-gray-600">
                  Talk naturally to Servio - no need to learn complex commands. Just speak and get instant help.
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="bg-green-50 p-6 rounded-xl"
              >
                <Zap className="w-12 h-12 text-green-600 mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Instant Actions</h3>
                <p className="text-gray-600">
                  Get immediate responses and actions. From checking inventory to managing orders.
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="bg-purple-50 p-6 rounded-xl"
              >
                <Shield className="w-12 h-12 text-purple-600 mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Smart & Secure</h3>
                <p className="text-gray-600">
                  AI-powered understanding of restaurant context with enterprise-grade security.
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
                className="bg-orange-50 p-6 rounded-xl"
              >
                <Clock className="w-12 h-12 text-orange-600 mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Save Time</h3>
                <p className="text-gray-600">
                  Reduce time spent on routine tasks and focus on what matters most - your customers.
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.5 }}
                className="bg-red-50 p-6 rounded-xl"
              >
                <Users className="w-12 h-12 text-red-600 mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Team Coordination</h3>
                <p className="text-gray-600">
                  Keep your entire team informed with real-time updates and notifications.
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.6 }}
                className="bg-indigo-50 p-6 rounded-xl"
              >
                <Bot className="w-12 h-12 text-indigo-600 mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Always Learning</h3>
                <p className="text-gray-600">
                  Servio gets smarter over time, learning your restaurant&apos;s unique needs and preferences.
                </p>
              </motion.div>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="py-16 bg-gray-900">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
                Ready to Transform Your Restaurant Operations?
              </h2>
              <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
                Start using Servio today and see how AI can make your restaurant staff more efficient.
              </p>

              <Link
                href="/dashboard/assistant"
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-xl font-semibold text-lg transition-all duration-200 transform hover:scale-105 shadow-lg inline-flex items-center"
              >
                <Mic className="w-5 h-5 mr-2" />
                Try Servio Assistant Now
              </Link>
            </motion.div>
          </div>
        </div>

        {/* Footer */}
        <footer className="bg-white py-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Bot className="h-6 w-6 text-blue-600" />
                <span className="ml-2 text-lg font-semibold text-gray-900">Servio</span>
              </div>
              <p className="text-gray-500">© 2026 Servio. All rights reserved.</p>
            </div>
          </div>
        </footer>
      </div>
    </>
  )
}