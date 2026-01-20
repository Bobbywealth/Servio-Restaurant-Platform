'use client';

import React, { useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Mail, AlertCircle, Loader2, ArrowRight } from 'lucide-react';
import { useUser } from '../contexts/UserContext';

export default function LoginPage() {
  const [isSignUpMode, setIsSignUpMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [restaurantName, setRestaurantName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = React.useState(false);
  const router = useRouter();
  const { login, signup, user, isLoading } = useUser();

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

  // Show loading state while checking auth
  if (!mounted || isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white">Loading...</div>
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

  const handleDemoLogin = async (demoEmail: string, demoPassword: string) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
    setError('');
    setLoading(true);

    try {
      await login(demoEmail, demoPassword);
      router.push(routeAfterLogin());
    } catch (err: any) {
      const message = err.response?.data?.error?.message || err.message || 'Failed to login with demo credentials.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isSignUpMode) {
        // Validate signup form
        if (!name.trim()) {
          throw new Error('Name is required');
        }
        if (!restaurantName.trim()) {
          throw new Error('Restaurant name is required');
        }
        if (password !== confirmPassword) {
          throw new Error('Passwords do not match');
        }
        if (password.length < 6) {
          throw new Error('Password must be at least 6 characters long');
        }
        
        await signup(name, email, password, restaurantName);
      } else {
        await login(email, password);
      }
      router.push(routeAfterLogin());
    } catch (err: any) {
      const message = err.response?.data?.error?.message || err.message || 
        (isSignUpMode ? 'Failed to create account. Please try again.' : 'Failed to login. Please check your credentials.');
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4 relative overflow-hidden">
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
            <div className="flex items-center space-x-3">
              <img
                src="/images/servio_icon_tight.png"
                alt="Servio"
                className="h-10 w-auto"
              />
              <span className="text-xl font-bold text-white">Servio</span>
            </div>
            <div className="hidden md:flex items-center space-x-8">
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
          <div className="flex flex-col items-center mb-10">
            <h1 className="text-3xl font-extrabold tracking-tight text-white">
              {isSignUpMode ? 'Join Servio' : 'Welcome back'}
            </h1>
            <p className="mt-2 text-gray-300 font-medium">
              Restaurant Operating System
            </p>
            <div className="mt-5 flex items-center gap-2 text-[11px] text-gray-300 bg-teal-500/20 border border-teal-500/30 px-3 py-1.5 rounded-full backdrop-blur-sm">
              <span className="inline-flex w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
              Voice-First Operations
            </div>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <AnimatePresence mode="wait">
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-red-500/20 text-red-300 p-4 rounded-2xl flex items-start gap-3 border border-red-500/30 backdrop-blur-sm"
                >
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <p className="text-sm font-medium">{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {isSignUpMode && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-300 ml-1">Full Name</label>
                  <div className="relative group">
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-gray-700/50 border border-gray-600 focus:bg-gray-700 focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400 rounded-xl px-4 py-3 text-white font-medium transition-all outline-none placeholder-gray-400"
                      placeholder="John Doe"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-300 ml-1">Restaurant Name</label>
                  <div className="relative group">
                    <input
                      type="text"
                      required
                      value={restaurantName}
                      onChange={(e) => setRestaurantName(e.target.value)}
                      className="w-full bg-gray-700/50 border border-gray-600 focus:bg-gray-700 focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400 rounded-xl px-4 py-3 text-white font-medium transition-all outline-none placeholder-gray-400"
                      placeholder="Your Restaurant Name"
                    />
                  </div>
                </div>
              </>
            )}

            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-300 ml-1">Email</label>
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
                {!isSignUpMode && (
                  <button type="button" className="text-xs font-bold text-teal-400 hover:text-teal-300 transition-colors">
                    Forgot?
                  </button>
                )}
              </div>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="w-5 h-5 text-gray-400 group-focus-within:text-teal-400 transition-colors" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-gray-700/50 border border-gray-600 focus:bg-gray-700 focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400 rounded-xl pl-12 pr-4 py-3 text-white font-medium transition-all outline-none placeholder-gray-400"
                  placeholder="••••••••"
                  minLength={isSignUpMode ? 6 : undefined}
                />
              </div>
            </div>

            {isSignUpMode && (
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-300 ml-1">Confirm Password</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="w-5 h-5 text-gray-400 group-focus-within:text-teal-400 transition-colors" />
                  </div>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-gray-700/50 border border-gray-600 focus:bg-gray-700 focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400 rounded-xl pl-12 pr-4 py-3 text-white font-medium transition-all outline-none placeholder-gray-400"
                    placeholder="••••••••"
                    minLength={6}
                  />
                </div>
              </div>
            )}

            <div className="pt-2">
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-teal-600 to-orange-500 hover:from-teal-700 hover:to-orange-600 text-white rounded-xl py-3 font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50 group shadow-[0_12px_30px_-16px_rgba(20,184,166,0.7)]"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    {isSignUpMode ? 'Create Account' : 'Continue to Dashboard'}
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </motion.button>
            </div>
          </form>

          {/* Toggle between Login and Sign Up */}
          <div className="mt-8 text-center">
            <p className="text-sm text-gray-400">
              {isSignUpMode ? 'Already have an account?' : "Don't have an account?"}{' '}
              <button
                type="button"
                onClick={() => {
                  setIsSignUpMode(!isSignUpMode);
                  setError('');
                  // Clear form when switching modes
                  setName('');
                  setRestaurantName('');
                  setConfirmPassword('');
                }}
                className="text-teal-400 hover:text-teal-300 font-medium transition-colors"
              >
                {isSignUpMode ? 'Sign in' : 'Sign up'}
              </button>
            </p>
          </div>

          {!isSignUpMode && (
            <div className="mt-10">
            <div className="flex items-center gap-4 mb-6">
              <div className="h-px flex-1 bg-gray-600" />
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-2">Demo Access</span>
              <div className="h-px flex-1 bg-gray-600" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button 
                type="button"
                onClick={() => handleDemoLogin('admin@servio.com', 'admin123')}
                className="bg-gray-700/50 hover:bg-gray-700 p-3 rounded-xl text-left transition-all group border border-gray-600 hover:border-teal-500/50 hover:shadow-[0_10px_24px_-18px_rgba(20,184,166,0.3)]"
              >
                <p className="text-[10px] font-bold text-gray-400 uppercase mb-1 group-hover:text-teal-400 transition-colors">Admin</p>
                <p className="text-xs font-bold text-gray-300 italic">One-tap login</p>
              </button>
              <button 
                type="button"
                onClick={() => handleDemoLogin('owner@demo.servio', 'password')}
                className="bg-gray-700/50 hover:bg-gray-700 p-3 rounded-xl text-left transition-all group border border-gray-600 hover:border-teal-500/50 hover:shadow-[0_10px_24px_-18px_rgba(20,184,166,0.3)]"
              >
                <p className="text-[10px] font-bold text-gray-400 uppercase mb-1 group-hover:text-teal-400 transition-colors">Owner</p>
                <p className="text-xs font-bold text-gray-300 italic">One-tap login</p>
              </button>
              <button 
                type="button"
                onClick={() => handleDemoLogin('manager@demo.servio', 'password')}
                className="bg-gray-700/50 hover:bg-gray-700 p-3 rounded-xl text-left transition-all group border border-gray-600 hover:border-teal-500/50 hover:shadow-[0_10px_24px_-18px_rgba(20,184,166,0.3)]"
              >
                <p className="text-[10px] font-bold text-gray-400 uppercase mb-1 group-hover:text-teal-400 transition-colors">Manager</p>
                <p className="text-xs font-bold text-gray-300 italic">One-tap login</p>
              </button>
              <button 
                type="button"
                onClick={() => handleDemoLogin('staff@demo.servio', 'password')}
                className="bg-gray-700/50 hover:bg-gray-700 p-3 rounded-xl text-left transition-all group border border-gray-600 hover:border-teal-500/50 hover:shadow-[0_10px_24px_-18px_rgba(20,184,166,0.3)]"
              >
                <p className="text-[10px] font-bold text-gray-400 uppercase mb-1 group-hover:text-teal-400 transition-colors">Staff</p>
                <p className="text-xs font-bold text-gray-300 italic">One-tap login</p>
              </button>
            </div>
          </div>
          )}
        </div>
        
        <p className="mt-8 text-center text-gray-400 text-sm font-medium">
          Powered by <span className="text-teal-400">Servio Intelligence</span>
        </p>
      </motion.div>
    </div>
  );
}
