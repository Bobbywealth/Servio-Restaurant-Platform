import React from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useUser } from '../../contexts/UserContext'
import { LogOut, RefreshCw } from 'lucide-react'

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

      <div className="min-h-screen bg-gray-950 text-white">
        <div className="sticky top-0 z-20 bg-gray-950/90 backdrop-blur border-b border-white/10">
          <div className="px-4 py-3 flex items-center justify-between">
            <div>
              <div className="text-sm text-white/60">Servio Tablet</div>
              <div className="text-lg font-semibold leading-tight">{title}</div>
            </div>
            <div className="flex items-center gap-2">
              {onRefresh && (
                <button
                  onClick={onRefresh}
                  className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 active:bg-white/20 transition-colors inline-flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span className="text-sm font-semibold">Refresh</span>
                </button>
              )}
              <button
                onClick={() => {
                  logout()
                  router.replace('/tablet/login')
                }}
                className="px-3 py-2 rounded-xl bg-red-500/15 hover:bg-red-500/25 active:bg-red-500/30 transition-colors inline-flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                <span className="text-sm font-semibold">Logout</span>
              </button>
            </div>
          </div>
        </div>

        <main className="px-4 py-4">{children}</main>
      </div>
    </>
  )
}

