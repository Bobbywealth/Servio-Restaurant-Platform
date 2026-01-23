'use client';

import Head from 'next/head';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { ArrowRight, Loader2, Lock, Mail } from 'lucide-react';
import { useUser } from '../../contexts/UserContext';

export default function TabletLoginPage() {
  const router = useRouter();
  const { login, user, isLoading } = useUser();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const nextPath =
    typeof router.query?.next === 'string' && router.query.next.startsWith('/')
      ? router.query.next
      : '/tablet/orders';

  useEffect(() => {
    if (!isLoading && user) {
      router.replace(nextPath);
    }
  }, [isLoading, user, nextPath, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email, password);
      router.replace(nextPath);
    } catch (err: any) {
      const message = err?.response?.data?.error?.message || err?.message || 'Failed to login. Please try again.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading || user) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <p className="text-sm text-gray-300">Checking session…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-6 relative overflow-hidden">
      <Head>
        <title>Tablet Login | Servio</title>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
      </Head>

      <div className="absolute inset-0">
        <img
          src="/images/hero_background.png"
          alt="Restaurant background"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gray-900/80" />
      </div>

      <div className="w-full max-w-md bg-gray-800/90 rounded-2xl border border-gray-700 p-8 shadow-xl backdrop-blur relative z-10">
        <div className="flex items-center gap-3 mb-8">
          <img src="/images/servio_icon_tight.png" alt="Servio" className="h-9 w-auto" />
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-teal-300">Tablet Mode</p>
            <h1 className="text-2xl font-bold text-white">Sign in</h1>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-500/40 bg-red-500/15 text-red-200 px-4 py-3 text-sm font-medium">
            {error}
          </div>
        )}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block space-y-1">
            <span className="text-sm font-semibold text-gray-200">Email</span>
            <div className="relative">
              <Mail className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-gray-700/60 border border-gray-600 focus:border-teal-400 focus:ring-2 focus:ring-teal-500/30 rounded-xl py-3 pl-11 pr-4 text-white placeholder-gray-400 outline-none transition"
                placeholder="name@restaurant.com"
                autoComplete="email"
              />
            </div>
          </label>

          <label className="block space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-200">Password</span>
              <span className="text-xs text-gray-400">Keep device secure</span>
            </div>
            <div className="relative">
              <Lock className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-gray-700/60 border border-gray-600 focus:border-teal-400 focus:ring-2 focus:ring-teal-500/30 rounded-xl py-3 pl-11 pr-4 text-white placeholder-gray-400 outline-none transition"
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-gradient-to-r from-teal-600 to-orange-500 hover:from-teal-700 hover:to-orange-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold rounded-xl py-3 flex items-center justify-center gap-2 shadow-[0_12px_30px_-16px_rgba(20,184,166,0.7)] transition"
          >
            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-gray-400">
          You will be redirected to the tablet orders view after signing in.
        </p>
      </div>
    </div>
  );
}
