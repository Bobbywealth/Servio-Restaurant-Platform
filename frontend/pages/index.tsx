import React from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Mic, Bot, Shield, Zap, Clock, Users } from 'lucide-react'

export default function HomePage() {
  return (
    <>
      <Head>
        <title>Servio - AI Staff Assistant for Restaurants</title>
        <meta name="description" content="Servio AI Assistant helps restaurant staff with voice commands, order management, and operational tasks." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        {/* Navigation */}
        <nav className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center">
                <Bot className="h-8 w-8 text-blue-600" />
                <span className="ml-2 text-xl font-bold text-gray-900">Servio</span>
              </div>
              <div className="flex items-center space-x-4">
                <Link 
                  href="/dashboard/assistant" 
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200"
                >
                  Launch Assistant
                </Link>
              </div>
            </div>
          </div>
        </nav>

        {/* Hero Section */}
        <div className="relative overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-20">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-center"
            >
              <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
                Meet <span className="text-blue-600">Servio</span>
              </h1>
              <p className="text-xl md:text-2xl text-gray-600 mb-8 max-w-3xl mx-auto">
                Your AI-powered restaurant assistant that understands voice commands and helps with operations
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
                <Link 
                  href="/dashboard/assistant"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-xl font-semibold text-lg transition-all duration-200 transform hover:scale-105 shadow-lg"
                >
                  <div className="flex items-center">
                    <Mic className="w-5 h-5 mr-2" />
                    Start Talking to Servio
                  </div>
                </Link>
              </div>

              {/* Demo Video/Screenshot Placeholder */}
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="relative mx-auto max-w-4xl"
              >
                <div className="bg-white rounded-2xl shadow-2xl p-8">
                  <div className="aspect-video bg-gradient-to-br from-blue-100 to-indigo-200 rounded-xl flex items-center justify-center">
                    <div className="text-center">
                      <Bot className="w-16 h-16 text-blue-600 mx-auto mb-4" />
                      <p className="text-gray-600 text-lg">Servio Assistant Interface</p>
                      <p className="text-gray-500">Voice-activated restaurant operations</p>
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
                  Servio gets smarter over time, learning your restaurant's unique needs and preferences.
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