import React, { useState } from 'react'
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
  Shield
} from 'lucide-react'

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
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const navigation = [
    { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
    { name: 'Restaurants', href: '/admin/restaurants', icon: Building2 },
  ]

  const handleLogout = () => {
    localStorage.removeItem('servio_token')
    localStorage.removeItem('servio_user')
    router.push('/login')
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
        } lg:static lg:inset-0`}>
          <div className="flex h-full flex-col">
            {/* Logo */}
            <div className="flex h-16 items-center justify-between px-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-3">
                <Shield className="h-8 w-8 text-red-600" />
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
              {navigation.map((item) => {
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
                    <div className="h-8 w-8 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
                      <Shield className="h-4 w-4 text-red-600" />
                    </div>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">Platform Admin</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">admin@servio.com</p>
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
            {navigation.map((item) => {
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