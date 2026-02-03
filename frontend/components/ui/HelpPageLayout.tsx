import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { motion, AnimatePresence } from 'framer-motion';
import { useUser } from '../../contexts/UserContext';
import ThemeToggle from '../ui/ThemeToggle';
import NotificationCenter from '../ui/NotificationCenter';
import AccountSwitcher from '../ui/AccountSwitcher';
import {
  Home,
  Menu,
  X,
  ChevronRight,
  HelpCircle,
  Book,
  Search,
  ArrowLeft
} from 'lucide-react';

interface HelpPageLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  categories: {
    id: string;
    name: string;
    icon: React.ElementType;
    href?: string;
  }[];
  currentCategory?: string;
  onCategoryChange?: (categoryId: string) => void;
  showBackButton?: boolean;
}

export default function HelpPageLayout({
  children,
  title,
  subtitle,
  categories,
  currentCategory,
  onCategoryChange,
  showBackButton = true
}: HelpPageLayoutProps) {
  const { user, isLoading } = useUser();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setMounted(true);
    const checkIsDesktop = () => setIsDesktop(window.innerWidth >= 1024);
    checkIsDesktop();
    window.addEventListener('resize', checkIsDesktop);
    return () => window.removeEventListener('resize', checkIsDesktop);
  }, []);

  if (!mounted || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}>
          <img src="/images/servio_logo_transparent_tight.png" alt="Servio Logo" className="h-16 w-auto" />
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const isHelpPage = router.pathname.includes('/help/');
  const helpType = isHelpPage && router.pathname.includes('/staff') ? 'staff' : 'restaurant';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-surface-900/60 backdrop-blur-md lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.div
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 shadow-2xl shadow-black/20 gpu-accelerated will-change-transform ${
          isDesktop ? '' : (sidebarOpen ? 'translate-x-0' : '-translate-x-full')
        }`}
        animate={isDesktop ? undefined : sidebarOpen ? { x: 0 } : { x: '-100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            {helpType === 'staff' ? (
              <div className="p-2 rounded-xl bg-purple-100 dark:bg-purple-900/50">
                <HelpCircle className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
            ) : (
              <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/50">
                <Book className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
            )}
            <div>
              <span className="font-bold text-surface-900 dark:text-white">
                {helpType === 'staff' ? 'Staff Help' : 'Restaurant Help'}
              </span>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden btn-icon">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
            <input
              type="text"
              placeholder="Search help..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-surface-100 dark:bg-surface-700 border-0 rounded-xl focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-2 space-y-1 overflow-y-auto">
          {showBackButton && (
            <Link
              href="/dashboard"
              className="flex items-center px-4 py-3 text-sm font-medium rounded-xl text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 mr-3" />
              Back to Dashboard
            </Link>
          )}

          <div className="pt-4 pb-2">
            <p className="px-4 text-xs font-semibold text-surface-400 uppercase tracking-wider">
              Categories
            </p>
          </div>

          {categories.map((category) => {
            const isActive = currentCategory === category.id;
            return (
              <button
                key={category.id}
                onClick={() => {
                  if (onCategoryChange) {
                    onCategoryChange(category.id);
                  } else if (category.href) {
                    router.push(category.href);
                  }
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 ${
                  isActive
                    ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                    : 'text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-700'
                }`}
              >
                <category.icon className={`w-5 h-5 mr-3 ${isActive ? 'text-primary-500' : ''}`} />
                <span className="flex-1 text-left">{category.name}</span>
                {isActive && (
                  <ChevronRight className="w-4 h-4 text-primary-500" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-4 py-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <span className="text-xs text-surface-500">Help Center</span>
            <span className="text-xs text-surface-400">v1.0</span>
          </div>
        </div>
      </motion.div>

      {/* Main content */}
      <div className="pl-0 lg:pl-72 transition-all duration-300">
        {/* Header */}
        <div className="bg-white/95 dark:bg-gray-900/95 sticky top-0 z-30 border-b border-gray-200 dark:border-gray-700 backdrop-blur-md safe-area-inset-top">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="lg:hidden btn-icon"
                  aria-label="Open menu"
                >
                  <Menu className="w-5 h-5" />
                </button>
                <div>
                  <h1 className="text-lg font-bold text-surface-900 dark:text-white">{title}</h1>
                  {subtitle && (
                    <p className="text-xs text-surface-500">{subtitle}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <NotificationCenter />
                <ThemeToggle />
                <AccountSwitcher />
              </div>
            </div>
          </div>
        </div>

        {/* Page content */}
        <motion.main
          className="px-4 sm:px-6 lg:px-8 py-6 pb-28 sm:pb-8"
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
