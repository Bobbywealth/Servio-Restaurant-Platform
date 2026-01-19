import React, { ReactNode } from 'react'
import Link from 'next/link'
import { useUser } from '../../contexts/UserContext'
import { 
  Bot, 
  Home, 
  Mic, 
  ClipboardList, 
  Package, 
  Users, 
  Settings, 
  LogOut,
  Bell,
  Clock,
  User
} from 'lucide-react'

interface DashboardLayoutProps {
  children: ReactNode
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, logout } = useUser()

  const navigation = [
    { name: 'Home', href: '/', icon: Home },
    { name: 'Assistant', href: '/dashboard/assistant', icon: Mic },
    { name: 'Orders', href: '/dashboard/orders', icon: ClipboardList },
    { name: 'Inventory', href: '/dashboard/inventory', icon: Package },
    { name: 'Staff', href: '/dashboard/staff', icon: Users },
    { name: 'Settings', href: '/dashboard/settings', icon: Settings },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg">
        {/* Logo */}
        <div className="flex items-center justify-center h-16 px-4 border-b border-gray-200">
          <Bot className="w-8 h-8 text-blue-600" />
          <span className="ml-2 text-xl font-bold text-gray-900">Servio</span>
        </div>

        {/* Navigation */}
        <nav className="mt-5 px-2">
          <div className="space-y-1">
            {navigation.map((item) => {
              const isActive = typeof window !== 'undefined' && window.location.pathname === item.href
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`${
                    isActive
                      ? 'bg-blue-50 border-blue-500 text-blue-700'
                      : 'border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  } group flex items-center px-2 py-2 text-sm font-medium rounded-md border-l-4 transition-colors duration-200`}
                >
                  <item.icon
                    className={`${
                      isActive ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'
                    } mr-3 h-5 w-5`}
                  />
                  {item.name}
                </Link>
              )
            })}
          </div>
        </nav>

        {/* User Info */}
        <div className="absolute bottom-0 w-full p-4 border-t border-gray-200">
          {user && (
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-white" />
                </div>
              </div>
              <div className="ml-3 flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user?.name || 'Loading...'}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {user?.role || 'User'} • {user?.restaurant?.name || 'Restaurant'}
                </p>
              </div>
              <button
                onClick={logout}
                className="ml-2 p-1 rounded-md text-gray-400 hover:text-gray-600 transition-colors duration-200"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="pl-64">
        {/* Top Bar */}
        <div className="bg-white shadow-sm border-b border-gray-200">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              {/* Breadcrumb or title can go here */}
              <div className="flex-1">
                {user?.shift?.isActive && (
                  <div className="flex items-center text-sm text-green-600">
                    <Clock className="w-4 h-4 mr-1" />
                    On Shift
                    {user?.shift?.startTime && (
                      <span className="ml-1 text-gray-500">
                        since {new Date(user.shift.startTime).toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Notifications */}
              <div className="flex items-center space-x-4">
                <button className="p-2 text-gray-400 hover:text-gray-600 relative">
                  <Bell className="w-5 h-5" />
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Page Content */}
        <main className="py-6 px-4 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  )
}