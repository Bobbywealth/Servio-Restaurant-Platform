'use client';

import React from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { Lock, Store, Mail, Loader2, AlertCircle, ArrowRight, ShieldCheck, Eye, EyeOff } from 'lucide-react'
import { api } from '../../lib/api'
import { useUser } from '../../contexts/UserContext'

export default function TabletLoginPage() {
  const router = useRouter()
  const { user, isLoading, updateUser } = useUser()

  const [mounted, setMounted] = React.useState(false)
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [restaurantSlug, setRestaurantSlug] = React.useState('')
  const [pin, setPin] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)
  const [submittingPin, setSubmittingPin] = React.useState(false)
  const [showPassword, setShowPassword] = React.useState(false)

  React.useEffect(() => setMounted(true), [])

  React.useEffect(() => {
    if (!mounted || isLoading) return
    if (user) router.replace('/tablet/orders')
  }, [mounted, isLoading, user, router])

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const resp = await api.post('/api/auth/login', {
        email: email.trim().toLowerCase(),
        password
      })

      const userData = resp.data?.data?.user
      const accessToken = resp.data?.data?.accessToken
      const refreshToken = resp.data?.data?.refreshToken

      if (typeof window !== 'undefined') {
        if (accessToken) localStorage.setItem('servio_access_token', accessToken)
        if (refreshToken) localStorage.setItem('servio_refresh_token', refreshToken)
        if (userData) localStorage.setItem('servio_user', JSON.stringify(userData))
      }

      if (userData) updateUser(userData)
      router.replace('/tablet/orders')
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.message || 'Failed to login')
    } finally {
      setSubmitting(false)
    }
  }

  const handlePinLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmittingPin(true)
    try {
      const resp = await api.post('/api/auth/pin-login', {
        restaurantSlug: restaurantSlug.trim(),
        pin: pin.trim()
      })

      const userData = resp.data?.data?.user
      const accessToken = resp.data?.data?.accessToken
      const refreshToken = resp.data?.data?.refreshToken

      if (typeof window !== 'undefined') {
        if (accessToken) localStorage.setItem('servio_access_token', accessToken)
        if (refreshToken) localStorage.setItem('servio_refresh_token', refreshToken)
        if (userData) localStorage.setItem('servio_user', JSON.stringify(userData))
        localStorage.setItem('servio_tablet_restaurant_slug', restaurantSlug.trim().toLowerCase())
      }

      if (userData) updateUser(userData)
      router.replace('/tablet/orders')
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.message || 'Failed to login')
    } finally {
      setSubmittingPin(false)
    }
  }

  if (!mounted || isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        Loading…
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>Tablet Login - Servio</title>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
      </Head>

      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(20,184,166,0.18),transparent_40%),radial-gradient(circle_at_80%_20%,rgba(249,115,22,0.14),transparent_40%),radial-gradient(circle_at_50%_80%,rgba(59,130,246,0.12),transparent_40%)]" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/0 via-black/30 to-black/70" />
        </div>

        <div className="w-full max-w-md z-10">
          <div className="flex items-center justify-center mb-6">
            <div className="flex items-center gap-3">
              <img src="/images/servio_icon_tight.png" alt="Servio" className="h-10 w-10" />
              <div>
                <div className="text-xs text-white/60 font-semibold tracking-widest uppercase">Servio</div>
                <div className="text-xl font-extrabold leading-tight">Tablet Orders</div>
              </div>
            </div>
          </div>

          {error && (
            <div className="mb-4 bg-red-500/15 border border-red-500/30 text-red-200 rounded-xl p-3 flex gap-2">
              <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
              <div className="text-sm font-medium">{error}</div>
            </div>
          )}

          {/* Primary login: email + password */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <div className="mb-5">
              <div className="text-white/60 text-sm">Secure sign-in</div>
              <h1 className="text-2xl font-bold">Login</h1>
              <p className="text-white/60 mt-1">Use the same username (email) and password as your dashboard.</p>
            </div>

            <form onSubmit={handleEmailLogin} className="space-y-4">
              <label className="block">
                <div className="text-sm font-semibold text-white/80 mb-2">Email</div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="w-5 h-5 text-white/40" />
                  </div>
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-gray-900 border border-white/10 rounded-xl pl-11 pr-3 py-3 text-white text-lg outline-none focus:ring-2 focus:ring-teal-500/40"
                    placeholder="name@restaurant.com"
                    autoCapitalize="none"
                    autoCorrect="off"
                    inputMode="email"
                    required
                  />
                </div>
              </label>

              <label className="block">
                <div className="text-sm font-semibold text-white/80 mb-2">Password</div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="w-5 h-5 text-white/40" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-gray-900 border border-white/10 rounded-xl pl-11 pr-11 py-3 text-white text-lg outline-none focus:ring-2 focus:ring-teal-500/40"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-white/40 hover:text-teal-400 transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </label>

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl py-3 font-extrabold bg-gradient-to-r from-teal-600 to-orange-500 hover:from-teal-700 hover:to-orange-600 disabled:opacity-60 transition-all flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
                <span>{submitting ? 'Signing in…' : 'Open Orders'}</span>
              </button>
            </form>
          </div>

          {/* Optional fast login: PIN */}
          <div className="mt-4 bg-white/5 border border-white/10 rounded-2xl p-6">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <div className="text-white/60 text-sm">Optional</div>
                <div className="text-lg font-bold">Quick PIN Login</div>
                <div className="text-white/60 text-sm mt-1">For kitchen tablets (slug + staff PIN).</div>
              </div>
              <div className="shrink-0 px-2.5 py-1.5 rounded-full bg-white/10 border border-white/10 text-xs font-bold text-white/80 inline-flex items-center gap-1">
                <ShieldCheck className="w-4 h-4" />
                Fast
              </div>
            </div>

            <form onSubmit={handlePinLogin} className="space-y-4">
            <label className="block">
              <div className="text-sm font-semibold text-white/80 mb-2">Restaurant Slug</div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Store className="w-5 h-5 text-white/40" />
                </div>
                <input
                  value={restaurantSlug}
                  onChange={(e) => setRestaurantSlug(e.target.value)}
                  className="w-full bg-gray-900 border border-white/10 rounded-xl pl-11 pr-3 py-3 text-white text-lg outline-none focus:ring-2 focus:ring-teal-500/40"
                  placeholder="e.g. sasheyskitchen"
                  autoCapitalize="none"
                  autoCorrect="off"
                  inputMode="text"
                />
              </div>
            </label>

            <label className="block">
              <div className="text-sm font-semibold text-white/80 mb-2">PIN</div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="w-5 h-5 text-white/40" />
                </div>
                <input
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className="w-full bg-gray-900 border border-white/10 rounded-xl pl-11 pr-3 py-3 text-white text-lg tracking-widest outline-none focus:ring-2 focus:ring-teal-500/40"
                  placeholder="••••"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                />
              </div>
            </label>

            <button
              type="submit"
              disabled={submittingPin}
              className="w-full rounded-xl py-3 font-extrabold bg-white/10 hover:bg-white/15 active:bg-white/20 border border-white/10 disabled:opacity-60 transition-all flex items-center justify-center gap-2"
            >
              {submittingPin ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
              <span>{submittingPin ? 'Signing in…' : 'Use PIN Login'}</span>
            </button>
            </form>

            <div className="mt-4 text-xs text-white/50">
            Tip: Use your restaurant’s slug (ask your manager/admin) and your staff PIN.
          </div>
        </div>

          <div className="mt-6 text-center text-xs text-white/40">
            Powered by <span className="text-teal-300 font-semibold">Servio Intelligence</span>
          </div>
        </div>
      </div>
    </>
  )
}

