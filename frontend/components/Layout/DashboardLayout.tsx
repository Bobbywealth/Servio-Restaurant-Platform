 'use client';

import React, { ReactNode, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { motion, AnimatePresence } from 'framer-motion';
import { useUser } from '../../contexts/UserContext';
import ThemeToggle from '../ui/ThemeToggle';
import NotificationCenter from '../ui/NotificationCenter';
import AccountSwitcher from '../ui/AccountSwitcher';
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
  Menu,
  X,
  Sparkles,
  ChevronRight,
  UtensilsCrossed,
  Mail,
  Store,
  Wifi,
  FileText
} from 'lucide-react';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, logout, isLoading } = useUser();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mounted, setMounted] = React.useState(false);
  const router = useRouter();

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (mounted && !isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router, mounted]);

  const normalizePath = (p: string) => (p || '/').split('?')[0].replace(/\/+$/, '') || '/';
  const currentPath = normalizePath(router.asPath);

  // Show loading state only after mount to prevent hydration mismatch
  if (!mounted || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center">
        <motion.div 
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          <img src="/images/servio_logo_transparent_tight.png" alt="Servio Logo" className="h-16 w-auto" />
        </motion.div>
        <motion.p 
          className="mt-4 text-surface-500 font-medium"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          Initializing your AI Command Center...
        </motion.p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

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
      name: 'Menu',
      href: '/dashboard/menu-management',
      icon: UtensilsCrossed,
      description: 'Menu & categories',
      color: 'text-amber-500'
    },
    {
      name: 'Marketing',
      href: '/dashboard/marketing',
      icon: Mail,
      description: 'SMS & email campaigns',
      color: 'text-pink-500'
    },
    {
      name: 'Profile',
      href: '/dashboard/restaurant-profile',
      icon: Store,
      description: 'Restaurant branding',
      color: 'text-indigo-500'
    },
    {
      name: 'Inventory',
      href: '/dashboard/inventory',
      icon: Package,
      description: 'Stock management',
      color: 'text-servio-green-500'
    },
    {
      name: 'Receipts',
      href: '/dashboard/inventory/receipts',
      icon: FileText,
      description: 'Upload & track invoices',
      color: 'text-blue-500'
    },
    {
      name: 'Staff',
      href: '/dashboard/staff',
      icon: Users,
      description: 'Team & schedules',
      color: 'text-purple-500'
    },
    {
      name: 'Integrations',
      href: '/dashboard/integrations',
      icon: Wifi,
      description: 'API connections',
      color: 'text-cyan-500'
    },
    {
      name: 'Settings',
      href: '/dashboard/settings',
      icon: Settings,
      description: 'System settings',
      color: 'text-surface-500'
    },
  ];
  const currentItem = navigation.find((item) => currentPath === normalizePath(item.href));
  const pageTitle = currentItem?.name || 'Dashboard';

  const mobileNav = [
    { name: 'Home', href: '/dashboard', icon: Home },
    { name: 'Orders', href: '/dashboard/orders', icon: ClipboardList },
    { name: 'Assistant', href: '/dashboard/assistant', icon: Mic },
    { name: 'Inventory', href: '/dashboard/inventory', icon: Package },
    { name: 'Staff', href: '/dashboard/staff', icon: Users }
  ];

  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white">
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

      <motion.div
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-white dark:bg-gray-800 transform transition-transform duration-300 ease-out lg:translate-x-0 border-r border-gray-200 dark:border-gray-700 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        initial={false}
      >
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200 dark:border-gray-700">
          <motion.div className="flex items-center" whileHover={{ scale: 1.02 }}>
            <Link href="/dashboard" className="flex items-center">
              <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center">
                <span className="text-white font-bold text-xl">S</span>
              </div>
              <span className="ml-2 text-xl font-semibold tracking-tight text-gray-900 dark:text-white">servio</span>
            </Link>
          </motion.div>
          <button onClick={closeSidebar} className="lg:hidden btn-icon">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {navigation.map((item, index) => {
            const isActive = currentPath === normalizePath(item.href);
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
                    transition-all duration-200 hover:bg-gray-200 dark:hover:bg-surface-800
                    ${isActive
                      ? 'bg-white text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                      : 'text-gray-700 dark:text-surface-400 hover:text-gray-900 dark:hover:text-surface-200'
                    }
                  `}
                >
                  <div className={`
                    flex items-center justify-center w-10 h-10 rounded-lg mr-3 transition-colors
                    ${isActive
                      ? 'bg-primary-100 dark:bg-primary-800/50'
                      : 'bg-white dark:bg-surface-800 group-hover:bg-gray-200 dark:group-hover:bg-surface-700'
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
                    <p className="text-2xs text-gray-500 dark:text-surface-400 truncate">{item.description}</p>
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
            );
          })}
        </nav>
      </motion.div>

      <div className="pl-0 lg:pl-72 transition-all duration-300">
        <div className="bg-white/95 dark:bg-gray-900/95 sticky top-0 z-30 border-b border-gray-200 dark:border-gray-700 backdrop-blur-md pt-safe-top">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center space-x-3">
                <button onClick={() => setSidebarOpen(true)} className="lg:hidden btn-icon">
                  <Menu className="w-6 h-6" />
                </button>
                <div className="text-sm font-semibold text-gray-900 dark:text-white">{pageTitle}</div>
              </div>
              <div className="flex items-center space-x-3">
                <NotificationCenter />
                <ThemeToggle />
                <AccountSwitcher />
              </div>
            </div>
          </div>
        </div>
        <motion.main
          className="px-4 sm:px-6 lg:px-8 py-6 pb-24 lg:pb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {children}
        </motion.main>
      </div>

      {/* Mobile bottom navigation */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-gray-900/95 border-t border-gray-200 dark:border-gray-700 backdrop-blur-md lg:hidden pb-safe-bottom">
        <div className="grid grid-cols-5 px-2 py-2">
          {mobileNav.map((item) => {
            const isActive = currentPath === normalizePath(item.href);
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex flex-col items-center justify-center py-2 rounded-lg text-xs font-medium ${
                  isActive ? 'text-primary-700 dark:text-primary-300' : 'text-gray-500 dark:text-surface-400'
                }`}
              >
                <item.icon className="w-5 h-5" />
                <span className="mt-1">{item.name}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
