'use client';

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
  CreditCard,
  DollarSign,
  Users,
  Server,
  Key,
  CalendarDays,
  BarChart3,
  Store,
  ListTodo
} from 'lucide-react'
import { useUser } from '../../contexts/UserContext'

interface AdminLayoutProps {
  children: React.ReactNode
  title?: string
  description?: string
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ 
  children, 
  title = 'Platform Dashboard',
  description = 'Servio Platform Administration'
}) => {
  const router = useRouter()
  const { user, logout } = useUser()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  const navigation = [
    // PLATFORM OVERVIEW
    { name: 'Dashboard', href: '/admin', icon: LayoutDashboard, section: 'overview' },
    
    // RESTAURANT MANAGEMENT  
    { name: 'Restaurants', href: '/admin/restaurants', icon: Store, section: 'restaurants' },
    { name: 'All Orders', href: '/admin/orders', icon: ClipboardList, section: 'restaurants' },
    { name: 'Tasks', href: '/admin/tasks', icon: ListTodo, section: 'restaurants' },
    
    // MARKETING & ENGAGEMENT
    { name: 'Campaigns', href: '/admin/campaigns', icon: Megaphone, section: 'marketing' },
    { name: 'Marketing Hub', href: '/admin/marketing', icon: Users, section: 'marketing' },
    { name: 'Demo Bookings', href: '/admin/demo-bookings', icon: CalendarDays, section: 'marketing' },

    // BILLING & PRICING
    { name: 'Billing', href: '/admin/billing', icon: CreditCard, section: 'commercial' },
    { name: 'Pricing', href: '/admin/pricing', icon: DollarSign, section: 'commercial' },
    
    // PLATFORM OPERATIONS
    { name: 'System Health', href: '/admin/system-health', icon: Activity, section: 'system' },
    { name: 'Audit Logs', href: '/admin/audit', icon: Shield, section: 'system' },
    { name: 'Settings', href: '/admin/settings', icon: Settings, section: 'system' },
  ]

  const sections = [
    { id: 'overview', label: 'Overview' },
    { id: 'restaurants', label: 'Restaurants' },
    { id: 'marketing', label: 'Marketing' },
    { id: 'commercial', label: 'Commercial' },
    { id: 'system', label: 'System' },
  ]

  const handleLogout = () => {
    logout()
    router.push('/login')
  }

  useEffect(() => {
    setMounted(true)
  }, [])

  // Redirect non-platform-admin users
  useEffect(() => {
    if (mounted && user && user.role !== 'platform-admin' && user.role !== 'admin') {
      router.replace('/dashboard')
    }
  }, [mounted, user, router])

  const displayName = useMemo(() => {
    if (user?.name) return user.name
    return user?.email || 'Platform Admin'
  }, [user])

  const displayEmail = useMemo(() => {
    return user?.email || 'admin@servio.com'
  }, [user])

  const initials = useMemo(() => {
    const base = displayName || 'PA'
    const parts = base.replace(/[@._-]+/g, ' ').split(' ').filter(Boolean)
    const first = (parts[0]?.[0] || 'P').toUpperCase()
    const second = (parts[1]?.[0] || parts[0]?.[1] || 'A').toUpperCase()
    return `${first}${second}`
  }, [displayName])

  if (!mounted) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-pulse">
          <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-700"></div>
        </div>
      </div>
    )
  }

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
              <div className="flex items-center">
                <img
                  src="/images/servio_logo_transparent_tight.png"
                  alt="Servio Logo"
                  className="h-8 w-auto"
                />
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden text-gray-500 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Navigation with sections */}
            <nav className="flex-1 px-4 py-4 space-y-6 overflow-y-auto">
              {sections.map((section) => {
                const sectionItems = navigation.filter(item => item.section === section.id)
                if (sectionItems.length === 0) return null
                
                return (
                  <div key={section.id}>
                    <h3 className="px-3 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
                      {section.label}
                    </h3>
                    <div className="space-y-1">
                      {sectionItems.map((item) => {
                        const isActive = router.pathname === item.href || 
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
                    </div>
                  </div>
                )
              })}
            </nav>

            {/* Admin info & logout */}
            <div className="border-t border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0">
                    <div className="h-9 w-9 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center text-xs font-semibold text-red-700 dark:text-red-200">
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
                  className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 p-2"
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
          <div className="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <div className="flex h-16 items-center justify-between px-4 sm:px-6">
              <div className="flex items-center">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 lg:hidden mr-4"
                >
                  <Menu className="h-6 w-6" />
                </button>
                <div>
                  <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{title}</h1>
                  {description && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4">
                {/* Quick Actions */}
                <button className="hidden sm:flex items-center gap-2 px-3 py-1.5 text-sm bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors">
                  <Activity className="h-4 w-4" />
                  System Status: OK
                </button>
                
                {/* Notifications */}
                <button className="relative p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300">
                  <Bell className="h-5 w-5" />
                  <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full"></span>
                </button>
                
                {/* Profile */}
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center text-xs font-semibold text-red-700 dark:text-red-200">
                    {initials}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Page content */}
          <main className="flex-1 pb-24 sm:pb-6">
            <div className="py-6 px-4 sm:px-6">
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
        <div className="fixed bottom-0 left-0 right-0 z-40 w-full bg-white/95 border-t border-gray-200 backdrop-blur-md lg:hidden safe-area-inset-bottom">
          <div className="grid grid-cols-4 px-2 py-2">
            {navigation.slice(0, 4).map((item) => {
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
                  <span className="mt-1 truncate max-w-full">{item.name}</span>
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
