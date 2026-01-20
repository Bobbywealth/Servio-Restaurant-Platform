'use client';

import React, { useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Mail, AlertCircle, Loader2, ArrowRight } from 'lucide-react';
import { useUser } from '../contexts/UserContext';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { login } = useUser();

  const handleDemoLogin = async (demoEmail: string, demoPassword: string) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
    setError('');
    setLoading(true);

    try {
      await login(demoEmail, demoPassword);
      router.push('/dashboard');
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
      await login(email, password);
      router.push('/dashboard');
    } catch (err: any) {
      const message = err.response?.data?.error?.message || err.message || 'Failed to login. Please check your credentials.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] text-gray-900 flex items-center justify-center p-4 relative overflow-hidden">
      <Head>
        <title>Login | Servio</title>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
      </Head>

      {/* Dynamic Background */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[60%] h-[60%] bg-primary-100 rounded-full blur-[140px] opacity-70" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-emerald-100 rounded-full blur-[120px] opacity-70" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(20,184,166,0.08),_transparent_55%)]" />
      </div>

      {/* Subtle grid texture */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-[0.08] bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:22px_22px]" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md z-10"
      >
        <div className="bg-white/95 rounded-2xl shadow-[0_25px_60px_-35px_rgba(15,23,42,0.55)] border border-surface-200 p-8 md:p-10 backdrop-blur">
          <div className="flex flex-col items-center mb-10">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="mb-8"
            >
              <div className="relative group">
                <div className="absolute -inset-4 bg-gradient-to-r from-primary-500/20 to-emerald-500/20 rounded-full blur-2xl group-hover:opacity-100 opacity-0 transition-opacity duration-500" />
                <img 
                  src="/images/servio_logo_transparent_tight.png" 
                  alt="Servio Logo" 
                  className="h-16 w-auto relative z-10" 
                />
              </div>
            </motion.div>
            
            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">
              Welcome back
            </h1>
            <p className="mt-2 text-gray-500 font-medium">
              Enterprise Restaurant OS
            </p>
            <div className="mt-5 flex items-center gap-2 text-[11px] text-gray-500 bg-surface-50 border border-surface-200 px-3 py-1.5 rounded-full">
              <span className="inline-flex w-2 h-2 rounded-full bg-emerald-500" />
              Intelligence, Voice, Operations
            </div>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <AnimatePresence mode="wait">
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-red-50 text-red-600 p-4 rounded-2xl flex items-start gap-3 border border-red-100"
                >
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <p className="text-sm font-medium">{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700 ml-1">Email</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="w-5 h-5 text-gray-400 group-focus-within:text-primary-600 transition-colors" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-surface-50 border border-surface-200 focus:bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 rounded-xl pl-12 pr-4 py-3 text-gray-900 font-medium transition-all outline-none"
                  placeholder="name@restaurant.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center ml-1">
                <label className="text-sm font-bold text-gray-700">Password</label>
                <button type="button" className="text-xs font-bold text-primary-600 hover:text-primary-700 transition-colors">
                  Forgot?
                </button>
              </div>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="w-5 h-5 text-gray-400 group-focus-within:text-primary-600 transition-colors" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-surface-50 border border-surface-200 focus:bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 rounded-xl pl-12 pr-4 py-3 text-gray-900 font-medium transition-all outline-none"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="pt-2">
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-primary-600 to-emerald-500 hover:from-primary-700 hover:to-emerald-600 text-white rounded-xl py-3 font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50 group shadow-[0_12px_30px_-16px_rgba(20,184,166,0.7)]"
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

          <div className="mt-10">
            <div className="flex items-center gap-4 mb-6">
              <div className="h-px flex-1 bg-surface-200" />
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-2">Demo Access</span>
              <div className="h-px flex-1 bg-surface-200" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button 
                type="button"
                onClick={() => handleDemoLogin('admin@servio.com', 'password')}
                className="bg-surface-50 hover:bg-white p-3 rounded-xl text-left transition-all group border border-surface-200 hover:shadow-[0_10px_24px_-18px_rgba(15,23,42,0.5)]"
              >
                <p className="text-[10px] font-bold text-gray-400 uppercase mb-1 group-hover:text-primary-600 transition-colors">Admin</p>
                <p className="text-xs font-bold text-gray-700 italic">One-tap login</p>
              </button>
              <button 
                type="button"
                onClick={() => handleDemoLogin('owner@demo.servio', 'password')}
                className="bg-surface-50 hover:bg-white p-3 rounded-xl text-left transition-all group border border-surface-200 hover:shadow-[0_10px_24px_-18px_rgba(15,23,42,0.5)]"
              >
                <p className="text-[10px] font-bold text-gray-400 uppercase mb-1 group-hover:text-primary-600 transition-colors">Owner</p>
                <p className="text-xs font-bold text-gray-700 italic">One-tap login</p>
              </button>
              <button 
                type="button"
                onClick={() => handleDemoLogin('manager@demo.servio', 'password')}
                className="bg-surface-50 hover:bg-white p-3 rounded-xl text-left transition-all group border border-surface-200 hover:shadow-[0_10px_24px_-18px_rgba(15,23,42,0.5)]"
              >
                <p className="text-[10px] font-bold text-gray-400 uppercase mb-1 group-hover:text-primary-600 transition-colors">Manager</p>
                <p className="text-xs font-bold text-gray-700 italic">One-tap login</p>
              </button>
              <button 
                type="button"
                onClick={() => handleDemoLogin('staff@demo.servio', 'password')}
                className="bg-surface-50 hover:bg-white p-3 rounded-xl text-left transition-all group border border-surface-200 hover:shadow-[0_10px_24px_-18px_rgba(15,23,42,0.5)]"
              >
                <p className="text-[10px] font-bold text-gray-400 uppercase mb-1 group-hover:text-primary-600 transition-colors">Staff</p>
                <p className="text-xs font-bold text-gray-700 italic">One-tap login</p>
              </button>
            </div>
          </div>
        </div>
        
        <p className="mt-8 text-center text-gray-400 text-sm font-medium">
          Powered by <span className="text-gray-600">Servio Intelligence</span>
        </p>
      </motion.div>
    </div>
  );
}
