import React, { useEffect, useMemo, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { motion } from 'framer-motion'
import { 
  LayoutDashboard, 
  Building2, 
  Settings, 
  LogOut,
  Menu,
  X,
  ClipboardList,
  Megaphone,
  Activity,
  Shield,
  Search,
  Bell,
  User,
  CalendarDays
} from 'lucide-react'
import { useUser } from '../../contexts/UserContext'

interface AdminLayoutProps {
  children: React.ReactNode
  title?: string
  description?: string
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ 
  children, 
  title = 'Admin Dashboard',
  description = 'Servio Platform Administration'
}) => {
  const router = useRouter()
  const { logout } = useUser()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [currentUser, setCurrentUser] = useState<any | null>(null)
  const [mounted, setMounted] = useState(false)

  const navigation = [
    { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
    { name: 'Restaurants', href: '/admin/restaurants', icon: Building2 },
    { name: 'Campaigns', href: '/admin/campaigns', icon: Megaphone },
    { name: 'Orders', href: '/admin/orders', icon: ClipboardList },
    { name: 'System Health', href: '/admin/system-health', icon: Activity },
    { name: 'Audit Logs', href: '/admin/audit', icon: Shield },
  ]

  // Remove demo-only admin pages in production.
  const navItems = useMemo(() => {
    if (process.env.NODE_ENV === 'production') return navigation
    return [...navigation.slice(0, 4), { name: 'Demo Bookings', href: '/admin/demo-bookings', icon: CalendarDays }, ...navigation.slice(4)]
  }, [navigation])

  const handleLogout = () => {
    logout()
    router.push('/login')
  }

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted || typeof window === 'undefined') return
    
    const readUser = () => {
      try {
        const raw = localStorage.getItem('servio_user')
        const parsed = raw ? JSON.parse(raw) : null
        setCurrentUser(parsed)
      } catch {
        setCurrentUser(null)
      }
    }

    readUser()
    window.addEventListener('storage', readUser)
    return () => window.removeEventListener('storage', readUser)
  }, [mounted])

  const displayName = useMemo(() => {
    const name = typeof currentUser?.name === 'string' ? currentUser.name.trim() : ''
    if (name) return name
    const email = typeof currentUser?.email === 'string' ? currentUser.email.trim() : ''
    return email || 'Platform Admin'
  }, [currentUser])

  const displayEmail = useMemo(() => {
    const email = typeof currentUser?.email === 'string' ? currentUser.email.trim() : ''
    return email || 'admin@servio.com'
  }, [currentUser])

  const initials = useMemo(() => {
    const base = displayName || displayEmail || 'PA'
    const parts = base
      .replace(/[@._-]+/g, ' ')
      .split(' ')
      .map((p: string) => p.trim())
      .filter(Boolean)
    const first = (parts[0]?.[0] || 'P').toUpperCase()
    const second = (parts[1]?.[0] || parts[0]?.[1] || 'A').toUpperCase()
    return `${first}${second}`
  }, [displayName, displayEmail])

  return (
    <>
      <Head>
        <title>{title} | Servio Platform Admin</title>
        <meta name="description" content={description} />
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <div className="min-h-screen bg-[#F9FAFB] dark:bg-gray-900">
        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <div className={`fixed inset-y-0 left-0 z-50 w-64 transform bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}>
          <div className="flex h-full flex-col">
            {/* Logo */}
            <div className="flex h-16 items-center justify-between px-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-3">
                <img
                  src="/images/servio_logo_transparent_tight.png"
                  alt="Servio Logo"
                  className="h-8 w-auto"
                />
                <div>
                  <h1 className="text-xl font-bold text-gray-900 dark:text-white">Servio Admin</h1>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Platform Control</p>
                </div>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden text-gray-500 hover:text-gray-700"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-4 py-6 space-y-2">
              {navItems.map((item) => {
                const isActive = router.pathname === item.href || 
                  (item.href === '/admin' && router.pathname === '/admin') ||
                  (item.href !== '/admin' && router.pathname.startsWith(item.href))
                
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                      isActive
                        ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300'
                        : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700'
                    }`}
                  >
                    <item.icon className={`mr-3 h-5 w-5 ${
                      isActive ? 'text-red-500' : 'text-gray-400 group-hover:text-gray-500'
                    }`} />
                    {item.name}
                  </Link>
                )
              })}
            </nav>

            {/* Admin info & logout */}
            <div className="border-t border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0">
                    <div className="h-8 w-8 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center text-xs font-semibold text-red-700 dark:text-red-200">
                      {initials}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{displayName}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{displayEmail}</p>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                  title="Logout"
                >
                  <LogOut className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="lg:ml-64">
          {/* Top bar */}
          <div className="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 pt-safe-top">
            <div className="flex h-16 items-center justify-between px-4 sm:px-6">
              <div className="flex items-center">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 lg:hidden"
                >
                  <Menu className="h-6 w-6" />
                </button>
                <div className="ml-4 lg:ml-0">
                  <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{title}</h1>
                  {description && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4">
                {/* Search */}
                <div className="hidden md:flex items-center">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search..."
                      className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                </div>
                {/* Alerts */}
                <button className="relative p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300">
                  <Bell className="h-5 w-5" />
                  <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full"></span>
                </button>
                {/* Profile */}
                <button
                  className="flex items-center gap-2 p-2 rounded-lg text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700/50"
                  title={displayEmail}
                >
                  <div className="h-8 w-8 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center text-xs font-semibold text-red-700 dark:text-red-200">
                    {initials}
                  </div>
                  <div className="hidden sm:block text-left leading-tight">
                    <div className="text-sm font-semibold truncate max-w-[180px]">{displayName}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[180px]">{displayEmail}</div>
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* Page content */}
          <main className="flex-1 pb-24 lg:pb-6">
            <div className="py-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                {children}
              </motion.div>
            </div>
          </main>
        </div>

        {/* Mobile bottom navigation */}
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 border-t border-gray-200 backdrop-blur-md lg:hidden pb-safe-bottom">
          <div className="grid grid-cols-2 px-2 py-2">
            {navItems.map((item) => {
              const isActive = router.pathname === item.href || router.pathname.startsWith(item.href)
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex flex-col items-center justify-center py-2 rounded-lg text-xs font-medium ${
                    isActive ? 'text-red-600' : 'text-gray-500'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="mt-1">{item.name}</span>
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </>
  )
}

export default AdminLayout