'use client';

import React from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { Lock, Store, Loader2, AlertCircle, ArrowRight } from 'lucide-react'
import { api } from '../../lib/api'
import { useUser } from '../../contexts/UserContext'

export default function TabletLoginPage() {
  const router = useRouter()
  const { user, isLoading, updateUser } = useUser()

  const [mounted, setMounted] = React.useState(false)
  const [restaurantSlug, setRestaurantSlug] = React.useState('')
  const [pin, setPin] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)

  React.useEffect(() => setMounted(true), [])

  React.useEffect(() => {
    if (!mounted || isLoading) return
    if (user) router.replace('/tablet/orders')
  }, [mounted, isLoading, user, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
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
      setSubmitting(false)
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

      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white/5 border border-white/10 rounded-2xl p-6">
          <div className="mb-6">
            <div className="text-white/60 text-sm">Servio Tablet</div>
            <h1 className="text-2xl font-bold">Kitchen / Orders Login</h1>
            <p className="text-white/60 mt-1">
              Enter your restaurant slug and staff PIN to view and print online orders.
            </p>
          </div>

          {error && (
            <div className="mb-4 bg-red-500/15 border border-red-500/30 text-red-200 rounded-xl p-3 flex gap-2">
              <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
              <div className="text-sm font-medium">{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
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
                  placeholder="e.g. demo-restaurant"
                  autoCapitalize="none"
                  autoCorrect="off"
                  inputMode="text"
                  required
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
                  required
                />
              </div>
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl py-3 font-bold bg-gradient-to-r from-teal-600 to-orange-500 hover:from-teal-700 hover:to-orange-600 disabled:opacity-60 transition-all flex items-center justify-center gap-2"
            >
              {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
              <span>{submitting ? 'Signing in…' : 'Open Orders'}</span>
            </button>
          </form>

          <div className="mt-6 text-xs text-white/50">
            Tip: Demo restaurant slug is <span className="text-white/80 font-semibold">demo-restaurant</span>. Demo PINs are{' '}
            <span className="text-white/80 font-semibold">1111</span> (staff) /{' '}
            <span className="text-white/80 font-semibold">2222</span> (manager).
          </div>
        </div>
      </div>
    </>
  )
}

