'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { ArrowRight, Loader2, Lock, Mail } from 'lucide-react';
import { useUser } from '../../contexts/UserContext';
import { TabletShell } from '../../components/Layout/TabletShell';

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
      <TabletShell title="Sign in" hideNav leftHref="/tablet/login" disableContainer>
        <div className="px-4 py-10 flex items-center justify-center min-h-[calc(100dvh-64px)]">
          <div className="rounded-3xl bg-white border border-slate-200 shadow-sm px-6 py-5 text-slate-700">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
              <span className="text-sm font-medium">Checking session…</span>
            </div>
          </div>
        </div>
      </TabletShell>
    );
  }

  return (
    <TabletShell title="Sign in" hideNav leftHref="/tablet/login" disableContainer>
      <div className="px-4 py-10 flex items-center justify-center min-h-[calc(100dvh-64px)]">
        <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-11 w-11 rounded-2xl bg-slate-100 flex items-center justify-center ring-1 ring-slate-200">
              <img src="/images/servio_icon_tight.png" alt="Servio" className="h-7 w-7" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Tablet</p>
              <h1 className="text-2xl font-semibold text-slate-900">Sign in</h1>
            </div>
          </div>

          {error && (
            <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm font-medium">
              {error}
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-slate-700">Email</span>
              <div className="relative">
                <Mail className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field pl-11 py-3 rounded-2xl"
                  placeholder="name@restaurant.com"
                  autoComplete="email"
                />
              </div>
            </label>

            <label className="block space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-700">Password</span>
                <span className="text-xs text-slate-500">Keep device secure</span>
              </div>
              <div className="relative">
                <Lock className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field pl-11 py-3 rounded-2xl"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
              </div>
            </label>

            <button type="submit" disabled={submitting} className="w-full btn-primary py-3 rounded-2xl flex items-center justify-center gap-2 disabled:opacity-60">
              {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-slate-500">
            You’ll be redirected to the tablet orders view after signing in.
          </p>
        </div>
      </div>
    </TabletShell>
  );
}
