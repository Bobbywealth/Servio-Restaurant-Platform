'use client';

import React, { useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Lock, Mail, AlertCircle, Loader2, ArrowRight, Sparkles } from 'lucide-react';
import { useUser } from '../contexts/UserContext';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { login } = useUser();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Failed to login. Please check your credentials.');
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
        <div className="absolute top-[-10%] right-[-10%] w-[60%] h-[60%] bg-primary-50 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-surface-100 rounded-full blur-[100px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md z-10"
      >
        <div className="bg-white rounded-2xl shadow-sm border border-surface-200 p-8 md:p-10">
          <div className="flex flex-col items-center mb-10">
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="mb-6 relative"
            >
              <div className="bg-primary-600 p-4 rounded-2xl">
                <Bot className="w-10 h-10 text-white" />
              </div>
              <motion.div
                animate={{ scale: [1, 1.2, 1], opacity: [1, 0.5, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute -top-1 -right-1"
              >
                <Sparkles className="w-5 h-5 text-primary-500" />
              </motion.div>
            </motion.div>
            
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
              Welcome back
            </h1>
            <p className="mt-2 text-gray-500 font-medium">
              Restaurant OS v2.0
            </p>
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
                className="w-full bg-primary-600 hover:bg-primary-700 text-white rounded-xl py-3 font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50 group"
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
                onClick={() => { setEmail('manager@demo.servio'); setPassword('password'); }}
                className="bg-surface-50 hover:bg-surface-100 p-3 rounded-xl text-left transition-colors group border border-surface-200"
              >
                <p className="text-[10px] font-bold text-gray-400 uppercase mb-1 group-hover:text-primary-600 transition-colors">Manager</p>
                <p className="text-xs font-bold text-gray-700 italic">One-tap fill</p>
              </button>
              <button 
                onClick={() => { setEmail('staff@demo.servio'); setPassword('password'); }}
                className="bg-surface-50 hover:bg-surface-100 p-3 rounded-xl text-left transition-colors group border border-surface-200"
              >
                <p className="text-[10px] font-bold text-gray-400 uppercase mb-1 group-hover:text-primary-600 transition-colors">Staff</p>
                <p className="text-xs font-bold text-gray-700 italic">One-tap fill</p>
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
