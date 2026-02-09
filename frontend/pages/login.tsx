'use client';

import React, { useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Mail, AlertCircle, Loader2, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { useUser } from '../contexts/UserContext';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [stayLoggedIn, setStayLoggedIn] = useState(false);
  const [mounted, setMounted] = React.useState(false);
  const router = useRouter();
  const { login, user, isLoading } = useUser();

  // Mark component as mounted to prevent SSR issues
  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Redirect if already logged in
  React.useEffect(() => {
    if (mounted && !isLoading && user) {
      const role = user.role;
      const targetRoute = (role === 'admin') 
        ? '/admin/demo-bookings' 
        : '/dashboard';
      
      // Only redirect if we're still on the login page
      if (router.pathname === '/login') {
        router.replace(targetRoute);
      }
    }
  }, [user, isLoading, router, mounted]);

  // Show loading state while checking auth - Animated skeleton
  if (!mounted || isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4 relative overflow-x-hidden">
        {/* Animated background */}
        <div className="absolute inset-0 overflow-hidden">
          <motion.div
            className="absolute top-1/4 left-1/4 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl"
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.5, 0.3],
            }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"
            animate={{
              scale: [1.2, 1, 1.2],
              opacity: [0.3, 0.5, 0.3],
            }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
          />
        </div>

        <motion.div
          className="w-full max-w-sm bg-gray-800/80 rounded-2xl shadow-xl p-8 border border-gray-700 backdrop-blur relative z-10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {/* Logo skeleton */}
          <div className="flex items-center justify-center mb-8">
            <motion.div
              className="h-8 w-8 bg-gray-700/80 rounded-lg"
              animate={{ opacity: [0.5, 0.8, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
          </div>

          {/* Title skeleton */}
          <div className="space-y-3 mb-6">
            <motion.div
              className="h-8 w-48 bg-gray-700/80 rounded-lg mx-auto"
              animate={{ opacity: [0.5, 0.8, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }}
            />
            <motion.div
              className="h-4 w-32 bg-gray-700/60 rounded mx-auto"
              animate={{ opacity: [0.5, 0.7, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: 0.4 }}
            />
          </div>

          {/* Form skeletons */}
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <motion.div
                key={i}
                className="space-y-2"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.15 }}
              >
                <motion.div
                  className="h-4 w-20 bg-gray-700/80 rounded"
                  animate={{ opacity: [0.5, 0.7, 0.5] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.3 }}
                />
                <motion.div
                  className="h-12 w-full bg-gray-700/60 rounded-xl"
                  animate={{ opacity: [0.5, 0.7, 0.5] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.3 + 0.1 }}
                />
              </motion.div>
            ))}
          </div>

          {/* Loading indicator */}
          <motion.div
            className="mt-8 flex items-center justify-center gap-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="w-2 h-2 bg-teal-500 rounded-full"
                animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
              />
            ))}
          </motion.div>
        </motion.div>
      </div>
    );
  }

  const routeAfterLogin = (userRole?: string) => {
    const role = userRole || user?.role;
    if (role === 'admin' || role === 'platform-admin') {
      return '/admin/demo-bookings';
    }
    return '/dashboard';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // For "stay logged in", we'll handle this via extended session
      // The backend will use the stayLoggedIn flag to set appropriate TTL
      await login(email, password, stayLoggedIn);
      router.push(routeAfterLogin());
    } catch (err: any) {
      const message = err.response?.data?.error?.message || err.message || 'Failed to login. Please check your credentials.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4 relative overflow-x-hidden">
      <Head>
        <title>Login | Servio - Restaurant Operating System</title>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
      </Head>

      {/* Restaurant Background Image */}
      <div className="absolute inset-0">
        <img 
          src="/images/hero_background.png" 
          alt="Restaurant Kitchen" 
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gray-900/75"></div>
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 bg-gray-900/95 backdrop-blur-md border-b border-gray-800 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <img
                src="/images/servio_icon_tight.png"
                alt="Servio Logo"
                className="h-8 w-auto"
              />
              <span className="ml-2 text-xl font-bold text-white">Servio</span>
            </div>
            <div className="hidden md:flex items-center space-x-8">
              <a
                href="/"
                className="text-teal-100 hover:text-white font-semibold transition-colors border border-teal-500/40 bg-teal-500/10 px-3 py-1.5 rounded-full"
              >
                Home
              </a>
              <a href="/#services" className="text-gray-300 hover:text-white font-medium transition-colors">Services</a>
              <a href="/#features" className="text-gray-300 hover:text-white font-medium transition-colors">Features</a>
              <a href="/#pricing" className="text-gray-300 hover:text-white font-medium transition-colors">Pricing</a>
              <a href="/#faq" className="text-gray-300 hover:text-white font-medium transition-colors">FAQ</a>
            </div>
          </div>
        </div>
      </nav>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md z-10"
      >
        <div className="bg-gray-800/95 rounded-2xl shadow-[0_25px_60px_-35px_rgba(0,0,0,0.8)] border border-gray-700 p-8 md:p-10 backdrop-blur">
          <div className="flex flex-col items-center mb-8">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white text-center">
              Welcome back
            </h1>
            <p className="mt-2 text-sm sm:text-base text-gray-300 font-medium text-center">
              Restaurant Operating System
            </p>
            <div className="mt-4 flex items-center gap-2 text-[10px] sm:text-xs text-gray-300 bg-teal-500/20 border border-teal-500/30 px-3 py-1.5 rounded-full backdrop-blur-sm">
              <span className="inline-flex w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
              Voice-First Operations
            </div>
          </div>

          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-6 flex items-center gap-2 text-sm bg-red-500/20 border border-red-500/30 text-red-300 px-4 py-3 rounded-xl"
              >
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <div className="flex justify-between items-center ml-1">
                <label className="text-sm font-bold text-gray-300">Email</label>
              </div>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="w-5 h-5 text-gray-400 group-focus-within:text-teal-400 transition-colors" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-gray-700/50 border border-gray-600 focus:bg-gray-700 focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400 rounded-xl pl-12 pr-4 py-3 text-white font-medium transition-all outline-none placeholder-gray-400"
                  placeholder="name@restaurant.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center ml-1">
                <label className="text-sm font-bold text-gray-300">Password</label>
              </div>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="w-5 h-5 text-gray-400 group-focus-within:text-teal-400 transition-colors" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-gray-700/50 border border-gray-600 focus:bg-gray-700 focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400 rounded-xl pl-12 pr-12 py-3 text-white font-medium transition-all outline-none placeholder-gray-400"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-white transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Stay logged in option */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="stayLoggedIn"
                checked={stayLoggedIn}
                onChange={(e) => setStayLoggedIn(e.target.checked)}
                className="w-5 h-5 rounded border-gray-600 bg-gray-700 text-teal-500 focus:ring-teal-500/30 focus:ring-offset-0 cursor-pointer"
              />
              <label
                htmlFor="stayLoggedIn"
                className="ml-3 text-sm text-gray-300 cursor-pointer select-none"
              >
                Stay logged in for 24 hours
              </label>
            </div>

            <div className="pt-2">
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-teal-600 to-orange-500 hover:from-teal-700 hover:to-orange-600 text-white rounded-xl py-3 font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50 group shadow-[0_12px_30px_-16px_rgba(20,184,166,0.7)] hover:shadow-[0_16px_36px_-16px_rgba(249,115,22,0.6)] active:shadow-[0_10px_24px_-16px_rgba(20,184,166,0.5)]"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    Continue to Dashboard
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </motion.button>
            </div>
          </form>
        </div>
        
        <p className="mt-8 text-center text-gray-400 text-sm font-medium">
          Powered by <span className="text-teal-400">Servio Intelligence</span>
        </p>
      </motion.div>
    </div>
  );
}
