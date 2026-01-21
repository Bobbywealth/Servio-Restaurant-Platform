import React from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useUser } from '../../contexts/UserContext'
import { LogOut, RefreshCw, Sparkles, Mic, Settings, History } from 'lucide-react'

export default function TabletLayout({
  title,
  onRefresh,
  children
}: {
  title: string
  onRefresh?: () => void
  children: React.ReactNode
}) {
  const router = useRouter()
  const { user, logout, isLoading } = useUser()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => setMounted(true), [])

  React.useEffect(() => {
    if (!mounted || isLoading) return
    if (!user) router.replace('/tablet/login')
  }, [mounted, isLoading, user, router])

  if (!mounted || isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        Loading…
      </div>
    )
  }

  if (!user) return null

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
      </Head>

      <div className="min-h-screen bg-gray-950 text-white relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(20,184,166,0.18),transparent_40%),radial-gradient(circle_at_80%_10%,rgba(249,115,22,0.14),transparent_40%)]" />
        </div>

        <div className="sticky top-0 z-20 bg-gray-950/85 backdrop-blur border-b border-white/10">
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <img src="/images/servio_icon_tight.png" alt="Servio" className="h-9 w-9" />
              <div className="min-w-0">
                <div className="text-[11px] text-white/60 font-semibold tracking-widest uppercase flex items-center gap-2">
                  <span>Servio Tablet</span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/10 border border-white/10 text-white/70">
                    <Sparkles className="w-3.5 h-3.5 text-orange-300" />
                    Live
                  </span>
                </div>
                <div className="text-lg font-extrabold leading-tight truncate">{title}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {onRefresh && (
                <button
                  onClick={onRefresh}
                  className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 active:bg-white/20 transition-colors inline-flex items-center gap-2 border border-white/10"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span className="text-sm font-semibold">Refresh</span>
                </button>
              )}
              <button
                onClick={() => router.push('/tablet/assistant')}
                className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 active:bg-white/20 transition-colors inline-flex items-center gap-2 border border-white/10"
                title="Assistant"
              >
                <Mic className="w-4 h-4" />
                <span className="text-sm font-semibold hidden sm:inline">Assistant</span>
              </button>
              <button
                onClick={() => router.push('/tablet/history')}
                className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 active:bg-white/20 transition-colors inline-flex items-center gap-2 border border-white/10"
                title="Order History"
              >
                <History className="w-4 h-4" />
                <span className="text-sm font-semibold hidden sm:inline">History</span>
              </button>
              <button
                onClick={() => router.push('/tablet/settings')}
                className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 active:bg-white/20 transition-colors inline-flex items-center gap-2 border border-white/10"
                title="Settings"
              >
                <Settings className="w-4 h-4" />
                <span className="text-sm font-semibold hidden sm:inline">Settings</span>
              </button>
              <button
                onClick={() => {
                  logout()
                  router.replace('/tablet/login')
                }}
                className="px-3 py-2 rounded-xl bg-red-500/15 hover:bg-red-500/25 active:bg-red-500/30 transition-colors inline-flex items-center gap-2 border border-red-500/20"
              >
                <LogOut className="w-4 h-4" />
                <span className="text-sm font-semibold">Logout</span>
              </button>
            </div>
          </div>
        </div>

        <main className="px-4 py-4 relative z-10">{children}</main>
      </div>
    </>
  )
}

