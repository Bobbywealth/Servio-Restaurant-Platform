// Servio AI Kitchen Assistant Landing Page
// Voice-powered cooking assistant for restaurant kitchens

import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Mic,
  ChefHat,
  Clock,
  Users,
  Flame,
  Scale,
  Tablet,
  CheckCircle2,
  ArrowRight,
  PlayCircle,
  Sparkles,
  Volume2,
  Timer,
  BookOpen,
  GraduationCap,
  Phone,
  Mail,
  Menu,
  X
} from 'lucide-react';

export default function AIKitchenAssistantPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSmallScreen, setIsSmallScreen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const smallScreenMedia = window.matchMedia('(max-width: 767px)');
    const updateScreenSize = () => setIsSmallScreen(smallScreenMedia.matches);
    updateScreenSize();
    smallScreenMedia.addEventListener('change', updateScreenSize);
    return () => smallScreenMedia.removeEventListener('change', updateScreenSize);
  }, []);

  const features = [
    {
      icon: Mic,
      title: 'Voice-Controlled Cooking',
      description: 'Hands-free operation lets cooks focus on the food. Start recipes, navigate steps, and get instant help using natural voice commands.'
    },
    {
      icon: Timer,
      title: 'Smart Cooking Timers',
      description: 'AI automatically sets timers for each cooking step, sends halfway reminders, and announces completion. No more overcooked meals.'
    },
    {
      icon: ChefHat,
      title: 'Multi-Dish Management',
      description: 'Run multiple recipes simultaneously. The AI tracks timers and steps for all dishes, keeping your kitchen organized.'
    },
    {
      icon: Scale,
      title: 'Recipe Scaling',
      description: 'Instantly scale any recipe to different portion sizes. "Scale jerk chicken to 40 servings" - the AI recalculates all ingredients.'
    },
    {
      icon: GraduationCap,
      title: 'Kitchen Training Mode',
      description: 'New employees get detailed explanations of each step. Perfect for training and maintaining consistent food quality.'
    },
    {
      icon: Tablet,
      title: 'Works on Tablets & Displays',
      description: 'Optimized for iPad, Android tablets, and smart displays. Touch and voice control for any kitchen setup.'
    }
  ];

  const steps = [
    {
      step: 1,
      title: 'Start a Recipe with Voice',
      description: 'Simply say "Start jerk chicken" and the AI loads the recipe instantly.',
      icon: Mic
    },
    {
      step: 2,
      title: 'AI Guides Through Each Step',
      description: 'Get clear, step-by-step instructions spoken aloud. The AI knows exactly where you are in the recipe.',
      icon: ChefHat
    },
    {
      step: 3,
      title: 'Timers Run Automatically',
      description: 'No need to set timers manually. The AI starts timers for cooking steps and reminds you at the halfway point.',
      icon: Clock
    },
    {
      step: 4,
      title: 'Multiple Dishes at Once',
      description: 'Start rice, vegetables, and protein all at once. The AI tracks everything and keeps your kitchen running smoothly.',
      icon: Flame
    }
  ];

  const benefits = [
    'Reduce kitchen mistakes by 50%',
    'Train new staff 3x faster',
    'Maintain consistent recipe quality',
    'Reduce food waste from overcooking',
    'Improve kitchen efficiency',
    'Lower training costs'
  ];

  return (
    <div className="min-h-screen bg-white">
      <Head>
        <title>Servio AI Kitchen Assistant | Voice-Powered Cooking</title>
        <meta name="description" content="Turn your kitchen into an AI-powered cooking system. Voice-controlled recipe assistant for restaurants." />
      </Head>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-emerald-600 rounded-xl flex items-center justify-center">
                <Utensils className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900">Servio</span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-8">
              <Link href="/#features" className="text-gray-600 hover:text-gray-900 transition-colors">Features</Link>
              <Link href="/#how-it-works" className="text-gray-600 hover:text-gray-900 transition-colors">How It Works</Link>
              <Link href="/#pricing" className="text-gray-600 hover:text-gray-900 transition-colors">Pricing</Link>
              <Link href="/book-demo" className="px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors">
                Request Demo
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <button
              className="md:hidden p-2"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t">
            <div className="px-4 py-4 space-y-3">
              <Link href="/#features" className="block py-2 text-gray-600" onClick={() => setMobileMenuOpen(false)}>Features</Link>
              <Link href="/#how-it-works" className="block py-2 text-gray-600" onClick={() => setMobileMenuOpen(false)}>How It Works</Link>
              <Link href="/#pricing" className="block py-2 text-gray-600" onClick={() => setMobileMenuOpen(false)}>Pricing</Link>
              <Link href="/book-demo" className="block py-2 text-green-600 font-medium">Request Demo</Link>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-20 left-10 w-72 h-72 bg-green-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob" />
          <div className="absolute top-20 right-10 w-72 h-72 bg-emerald-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000" />
          <div className="absolute -bottom-8 left-20 w-72 h-72 bg-teal-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <span className="inline-flex items-center px-4 py-2 bg-green-100 text-green-800 rounded-full text-sm font-medium mb-6">
                <Sparkles className="w-4 h-4 mr-2" />
                AI-Powered Kitchen Assistant
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-5xl md:text-6xl lg:text-7xl font-bold text-gray-900 mb-6"
            >
              Cook Smarter with{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-600 to-emerald-600">
                AI
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto"
            >
              Servio AI Kitchen Assistant guides your kitchen staff through recipes step-by-step using voice commands, timers, and smart instructions. Perfect for training staff and maintaining consistent food quality.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-col sm:flex-row gap-4 justify-center"
            >
              <Link
                href="/book-demo"
                className="inline-flex items-center justify-center px-8 py-4 bg-green-600 hover:bg-green-700 text-white text-lg font-semibold rounded-xl transition-all hover:scale-105"
              >
                Request Demo
                <ArrowRight className="ml-2 w-5 h-5" />
              </Link>
              <button className="inline-flex items-center justify-center px-8 py-4 bg-gray-100 hover:bg-gray-200 text-gray-900 text-lg font-semibold rounded-xl transition-colors">
                <PlayCircle className="mr-2 w-5 h-5" />
                Watch Demo
              </button>
            </motion.div>
          </div>

          {/* Hero Image/Demo */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="mt-16 relative"
          >
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl p-1 shadow-2xl">
              <div className="bg-gray-900 rounded-2xl overflow-hidden">
                <div className="p-6 border-b border-gray-800 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-3 h-3 bg-red-500 rounded-full" />
                    <div className="w-3 h-3 bg-yellow-500 rounded-full" />
                    <div className="w-3 h-3 bg-green-500 rounded-full" />
                  </div>
                  <div className="text-gray-400 text-sm">Servio AI Kitchen Assistant</div>
                </div>
                <div className="p-8 bg-gray-900 min-h-[400px] flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-green-400 to-emerald-600 rounded-full flex items-center justify-center animate-pulse">
                      <Volume2 className="w-10 h-10 text-white" />
                    </div>
                    <div className="text-white text-2xl font-semibold mb-2">"Start jerk chicken recipe"</div>
                    <div className="text-green-400 text-lg">"Starting jerk chicken. Batch size: 20 servings. Step 1: Wash and clean the chicken..."</div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Everything Your Kitchen Needs
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              A complete voice-powered cooking solution designed for busy restaurant kitchens
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow"
              >
                <div className="w-14 h-14 bg-green-100 rounded-xl flex items-center justify-center mb-6">
                  <feature.icon className="w-7 h-7 text-green-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              How It Works
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Get your kitchen up and running with AI in minutes
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((step, index) => (
              <motion.div
                key={step.step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.15 }}
                viewport={{ once: true }}
                className="relative"
              >
                <div className="bg-white rounded-2xl p-8 border-2 border-gray-100 hover:border-green-200 transition-colors h-full">
                  <div className="w-12 h-12 bg-green-600 text-white rounded-full flex items-center justify-center text-xl font-bold mb-6">
                    {step.step}
                  </div>
                  <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mb-4">
                    <step.icon className="w-6 h-6 text-green-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">{step.title}</h3>
                  <p className="text-gray-600">{step.description}</p>
                </div>
                {index < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-1/2 -right-4 transform -translate-y-1/2">
                    <ArrowRight className="w-8 h-8 text-green-300" />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-24 bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-4xl font-bold mb-6">
                Transform Your Kitchen Operations
              </h2>
              <p className="text-xl text-gray-300 mb-8">
                Join restaurants that have already revolutionized their kitchen with Servio AI
              </p>
              <div className="space-y-4">
                {benefits.map((benefit) => (
                  <div key={benefit} className="flex items-center">
                    <CheckCircle2 className="w-6 h-6 text-green-400 mr-3 flex-shrink-0" />
                    <span className="text-lg">{benefit}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative">
              <div className="bg-gradient-to-br from-green-600 to-emerald-600 rounded-3xl p-1">
                <div className="bg-gray-800 rounded-2xl p-8">
                  <div className="text-center">
                    <div className="inline-flex items-center justify-center w-24 h-24 bg-green-100 rounded-full mb-6">
                      <ChefHat className="w-12 h-12 text-green-600" />
                    </div>
                    <div className="text-5xl font-bold text-white mb-2">50%</div>
                    <div className="text-green-300 text-lg mb-4">Fewer Kitchen Mistakes</div>
                    <div className="text-5xl font-bold text-white mb-2">3x</div>
                    <div className="text-green-300 text-lg">Faster Staff Training</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-gradient-to-br from-green-50 to-emerald-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold text-gray-900 mb-6">
            Turn Your Kitchen Into an AI-Powered Cooking System
          </h2>
          <p className="text-xl text-gray-600 mb-10">
            Get started with the most advanced voice-controlled kitchen assistant on the market
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/book-demo"
              className="inline-flex items-center justify-center px-8 py-4 bg-green-600 hover:bg-green-700 text-white text-lg font-semibold rounded-xl transition-all hover:scale-105"
            >
              Book Demo
              <ArrowRight className="ml-2 w-5 h-5" />
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center px-8 py-4 bg-white hover:bg-gray-50 text-gray-900 text-lg font-semibold rounded-xl transition-colors border border-gray-200"
            >
              Contact Sales
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-emerald-600 rounded-xl flex items-center justify-center">
                  <Utensils className="w-6 h-6 text-white" />
                </div>
                <span className="text-xl font-bold">Servio</span>
              </div>
              <p className="text-gray-400">
                The complete restaurant management platform powered by AI
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="/#features" className="hover:text-white">Features</Link></li>
                <li><Link href="/#pricing" className="hover:text-white">Pricing</Link></li>
                <li><Link href="/book-demo" className="hover:text-white">Demo</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="/about" className="hover:text-white">About</Link></li>
                <li><Link href="/contact" className="hover:text-white">Contact</Link></li>
                <li><Link href="/careers" className="hover:text-white">Careers</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Contact</h4>
              <ul className="space-y-2 text-gray-400">
                <li className="flex items-center">
                  <Phone className="w-4 h-4 mr-2" />
                  1-800-SERVIO
                </li>
                <li className="flex items-center">
                  <Mail className="w-4 h-4 mr-2" />
                  hello@servio.solutions
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-12 pt-8 text-center text-gray-400">
            © 2024 Servio. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}

// Helper component for the icon
function Utensils({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
    </svg>
  );
}
