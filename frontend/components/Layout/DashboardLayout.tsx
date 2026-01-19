import React, { ReactNode, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { motion, AnimatePresence } from 'framer-motion'
import { useUser } from '../../contexts/UserContext'
import ThemeToggle from '../ui/ThemeToggle'
import NotificationCenter from '../ui/NotificationCenter'
import { 
  Bot, 
  Home, 
  Mic, 
  ClipboardList, 
  Package, 
  Users, 
  Settings, 
  LogOut,
  Clock,
  User,
  Menu,
  X,
  Sparkles,
  ChevronRight
} from 'lucide-react'

interface DashboardLayoutProps {
  children: ReactNode
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, logout } = useUser()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const router = useRouter()

  const normalizePath = (p: string) => (p || '/').split('?')[0].replace(/\/+$/, '') || '/'
  const currentPath = normalizePath(router.asPath)

  const navigation = [
    { 
      name: 'Dashboard', 
      href: '/dashboard', 
      icon: Home, 
      description: 'Overview & quick actions',
      color: 'text-servio-blue-500'
    },
    { 
      name: 'Assistant', 
      href: '/dashboard/assistant', 
      icon: Mic, 
      description: 'AI voice assistant',
      color: 'text-servio-orange-500',
      highlight: true
    },
    { 
      name: 'Orders', 
      href: '/dashboard/orders', 
      icon: ClipboardList, 
      description: 'Manage all orders',
      color: 'text-primary-500'
    },
    { 
      name: 'Inventory', 
      href: '/dashboard/inventory', 
      icon: Package, 
      description: 'Stock management',
      color: 'text-servio-green-500'
    },
    { 
      name: 'Staff', 
      href: '/dashboard/staff', 
      icon: Users, 
      description: 'Team & schedules',
      color: 'text-purple-500'
    },
    { 
      name: 'Settings', 
      href: '/dashboard/settings', 
      icon: Settings, 
      description: 'System settings',
      color: 'text-surface-500'
    },
  ]

  const closeSidebar = () => setSidebarOpen(false)

  return (
    <div className="min-h-screen gradient-surface">
      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-surface-900/50 backdrop-blur-sm lg:hidden"
            onClick={closeSidebar}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.div 
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-white/95 dark:bg-surface-900/95 backdrop-blur-xl shadow-2xl transform transition-transform duration-300 ease-out lg:translate-x-0 border-r border-surface-200 dark:border-surface-800 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        initial={false}
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-6 border-b border-surface-200 dark:border-surface-800">
          <motion.div 
            className="flex items-center"
            whileHover={{ scale: 1.02 }}
          >
            <div className="relative">
              <Bot className="w-8 h-8 text-primary-600 dark:text-primary-400" />
              <motion.div
                className="absolute -top-1 -right-1 w-3 h-3 bg-servio-orange-500 rounded-full"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </div>
            <span className="ml-3 text-xl font-bold text-surface-900 dark:text-surface-100">
              Servio
            </span>
            <motion.div
              className="ml-2 px-2 py-1 bg-servio-orange-100 dark:bg-servio-orange-900/30 text-servio-orange-700 dark:text-servio-orange-300 text-2xs font-medium rounded-full"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2 }}
            >
              AI
            </motion.div>
          </motion.div>
          <button
            onClick={closeSidebar}
            className="lg:hidden btn-icon"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {navigation.map((item, index) => {
            const isActive = currentPath === normalizePath(item.href)
            
            return (
              <motion.div
                key={item.name}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Link
                  href={item.href}
                  onClick={closeSidebar}
                  className={`
                    group relative flex items-center px-4 py-3 text-sm font-medium rounded-xl 
                    transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]
                    ${isActive
                      ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 shadow-sm' 
                      : 'text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800 hover:text-surface-900 dark:hover:text-surface-200'
                    }
                  `}
                >
                  <div className={`
                    flex items-center justify-center w-10 h-10 rounded-lg mr-3 transition-colors
                    ${isActive 
                      ? 'bg-primary-200 dark:bg-primary-800/50' 
                      : 'bg-surface-100 dark:bg-surface-800 group-hover:bg-surface-200 dark:group-hover:bg-surface-700'
                    }
                  `}>
                    <item.icon className={`w-5 h-5 ${isActive ? item.color : 'text-surface-500 dark:text-surface-400'}`} />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{item.name}</span>
                      {item.highlight && (
                        <motion.div
                          className="ml-2"
                          animate={{ rotate: 360 }}
                          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                        >
                          <Sparkles className="w-4 h-4 text-servio-orange-500" />
                        </motion.div>
                      )}
                    </div>
                    <p className="text-2xs text-surface-500 dark:text-surface-400 truncate">
                      {item.description}
                    </p>
                  </div>

                  {isActive && (
                    <motion.div
                      className="absolute right-2"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", bounce: 0.3 }}
                    >
                      <ChevronRight className="w-4 h-4 text-primary-500" />
                    </motion.div>
                  )}
                </Link>
              </motion.div>
            )
          })}
        </nav>

        {/* User Info */}
        <div className="p-4 border-t border-surface-200 dark:border-surface-800">
          {user && (
            <motion.div 
              className="flex items-center p-3 rounded-xl bg-surface-50 dark:bg-surface-800/50"
              whileHover={{ scale: 1.02 }}
            >
              <div className="relative">
                <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center shadow-lg">
                  <User className="w-5 h-5 text-white" />
                </div>
              </div>
              
              <div className="ml-3 flex-1 min-w-0">
                <p className="text-sm font-semibold text-surface-900 dark:text-surface-100 truncate">
                  {user?.name || 'Loading...'}
                </p>
                <div className="flex items-center space-x-2">
                  <span className="text-2xs text-surface-500 dark:text-surface-400 truncate">
                    {user?.role || 'User'}
                  </span>
                </div>
              </div>
              
              <button
                onClick={logout}
                className="btn-icon ml-2 text-surface-400 hover:text-servio-red-500"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* Main Content */}
      <div className="pl-0 lg:pl-72 transition-all duration-300">
        {/* Top Bar */}
        <div className="bg-white/80 dark:bg-surface-900/80 backdrop-blur-xl shadow-sm border-b border-surface-200/50 dark:border-surface-800/50 sticky top-0 z-30">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="lg:hidden btn-icon"
                >
                  <Menu className="w-6 h-6" />
                </button>
                
                {false && (
                  <motion.div 
                    className="hidden sm:flex items-center px-3 py-2 bg-servio-green-100 dark:bg-servio-green-900/30 text-servio-green-700 dark:text-servio-green-300 text-sm font-medium rounded-lg"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                  >
                    <Clock className="w-4 h-4 mr-2" />
                    <span>On Shift</span>
                    {user?.shift?.startTime && (
                      <span className="ml-2 text-servio-green-600 dark:text-servio-green-400 text-xs">
                        since {new Date(user.shift.startTime).toLocaleTimeString()}
                      </span>
                    )}
                  </motion.div>
                )}
              </div>

              {/* Right side actions */}
              <div className="flex items-center space-x-3">
                <ThemeToggle />
                <NotificationCenter />
              </div>
            </div>
          </div>
        </div>

        {/* Page Content */}
        <motion.main 
          className="p-4 sm:p-6 lg:p-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {children}
        </motion.main>
      </div>
    </div>
  )
}