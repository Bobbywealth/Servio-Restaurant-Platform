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
  const router = useRouter();

  React.useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  const normalizePath = (p: string) => (p || '/').split('?')[0].replace(/\/+$/, '') || '/';
  const currentPath = normalizePath(router.asPath);

  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <Bot className="h-10 w-10 text-primary-600" />
        </motion.div>
      </div>
    );
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

  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="min-h-screen gradient-surface">
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
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-white/95 dark:bg-surface-900/95 backdrop-blur-xl shadow-2xl transform transition-transform duration-300 ease-out lg:translate-x-0 border-r border-surface-200 dark:border-surface-800 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        initial={false}
      >
        <div className="flex items-center justify-between h-16 px-6 border-b border-surface-200 dark:border-surface-800">
          <motion.div className="flex items-center" whileHover={{ scale: 1.02 }}>
            <div className="relative">
              <Bot className="w-8 h-8 text-primary-600 dark:text-primary-400" />
              <motion.div
                className="absolute -top-1 -right-1 w-3 h-3 bg-servio-orange-500 rounded-full"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </div>
            <span className="ml-3 text-xl font-bold text-surface-900 dark:text-surface-100">Servio</span>
            <motion.div
              className="ml-2 px-2 py-1 bg-servio-orange-100 dark:bg-servio-orange-900/30 text-servio-orange-700 dark:text-servio-orange-300 text-2xs font-medium rounded-full"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2 }}
            >
              AI
            </motion.div>
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
                    <p className="text-2xs text-surface-500 dark:text-surface-400 truncate">{item.description}</p>
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
        <div className="bg-white/80 dark:bg-surface-900/80 backdrop-blur-xl shadow-sm border-b border-surface-200/50 dark:border-surface-800/50 sticky top-0 z-30">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center space-x-4">
                <button onClick={() => setSidebarOpen(true)} className="lg:hidden btn-icon">
                  <Menu className="w-6 h-6" />
                </button>
              </div>
              <div className="flex items-center space-x-3">
                <ThemeToggle />
                <NotificationCenter />
                <AccountSwitcher />
              </div>
            </div>
          </div>
        </div>
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
  );
}
