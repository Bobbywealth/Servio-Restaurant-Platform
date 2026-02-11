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
  FileText,
  CheckCircle
} from 'lucide-react';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, logout, isLoading } = useUser();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mounted, setMounted] = React.useState(false);
  const [edgeSwipeActive, setEdgeSwipeActive] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const router = useRouter();

  // Detect desktop screen size (lg breakpoint = 1024px)
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const checkIsDesktop = () => setIsDesktop(window.innerWidth >= 1024);
    checkIsDesktop();
    window.addEventListener('resize', checkIsDesktop);
    return () => window.removeEventListener('resize', checkIsDesktop);
  }, []);

  // Haptic feedback function for native feel
  const triggerHaptic = React.useCallback(() => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(35);
    }
  }, []);

  // Drawer animation variants with spring physics
  const drawerVariants = {
    open: { x: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 30 } },
    closed: { x: '-100%', transition: { type: 'spring' as const, stiffness: 300, damping: 30 } }
  };

  // Drag constraints (w-72 = 288px)
  const dragConstraints = { left: 0, right: 288 };
  const dragElastic = 0.1;

  // Handle drag end for snap-to-open/close
  const handleDragEnd = (_: Event, info: { offset: { x: number }; velocity: { x: number } }) => {
    const { offset, velocity } = info;
    const threshold = 100;

    // Determine if we should open or close based on drag direction and velocity
    if (offset.x > threshold || velocity.x > 500) {
      setSidebarOpen(true);
      triggerHaptic();
    } else {
      setSidebarOpen(false);
      triggerHaptic();
    }
  };

  // Handle edge swipe touch start
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!sidebarOpen && e.touches[0].clientX <= 20) {
      setEdgeSwipeActive(true);
    }
  };

  // Reset edge swipe when drawer opens
  React.useEffect(() => {
    if (sidebarOpen) {
      setEdgeSwipeActive(false);
    }
  }, [sidebarOpen]);

  React.useEffect(() => {
    setMounted(true);
    // eslint-disable-next-line no-console
    console.info('[layout-init] mounted');
  }, []);

  React.useEffect(() => {
    // eslint-disable-next-line no-console
    console.info('[layout-init] state', {
      mounted,
      isLoading,
      hasUser: Boolean(user),
      path: router.asPath
    });
  }, [mounted, isLoading, user, router.asPath]);

  React.useEffect(() => {
    if (mounted && !isLoading && !user) {
      // eslint-disable-next-line no-console
      console.warn('[layout-init] redirecting to /login (no user)');
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
          className="mt-4 text-surface-500 font-medium flex items-center justify-center space-x-1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <span>Loading</span>
          <motion.span
            animate={{ opacity: [0, 1, 0] }}
            transition={{ duration: 1, repeat: Infinity, delay: 0 }}
          >
            .
          </motion.span>
          <motion.span
            animate={{ opacity: [0, 1, 0] }}
            transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
          >
            .
          </motion.span>
          <motion.span
            animate={{ opacity: [0, 1, 0] }}
            transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
          >
            .
          </motion.span>
        </motion.p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const allNavigation = [
    // OPERATIONS SECTION
    {
      name: 'Dashboard',
      href: '/dashboard',
      icon: Home,
      description: 'Overview & quick actions',
      color: 'text-servio-blue-500',
      roles: ['staff', 'manager', 'owner', 'admin'],
      section: 'operations'
    },
    {
      name: 'Orders',
      href: '/dashboard/orders',
      icon: ClipboardList,
      description: 'Manage all orders',
      color: 'text-primary-500',
      roles: ['staff', 'manager', 'owner', 'admin'],
      section: 'operations'
    },
    {
      name: 'Menu',
      href: '/dashboard/menu-management',
      icon: UtensilsCrossed,
      description: 'Menu & categories',
      color: 'text-amber-500',
      roles: ['manager', 'owner', 'admin'],
      section: 'operations'
    },
    {
      name: 'Inventory',
      href: '/dashboard/inventory',
      icon: Package,
      description: 'Stock management',
      color: 'text-servio-green-500',
      roles: ['manager', 'owner', 'admin'],
      section: 'operations'
    },
    
    // TEAM SECTION
    {
      name: 'Staff',
      href: '/dashboard/staff',
      icon: Users,
      description: 'Team & schedules',
      color: 'text-purple-500',
      roles: ['manager', 'owner', 'admin'],
      section: 'team'
    },
    {
      name: 'Tasks',
      href: '/dashboard/tasks',
      icon: CheckCircle,
      description: 'Team task manager',
      color: 'text-servio-green-500',
      roles: ['manager', 'owner', 'admin'],
      section: 'team'
    },
    
    // AI & COMMUNICATION SECTION
    {
      name: 'Assistant',
      href: '/dashboard/assistant',
      icon: Mic,
      description: 'AI voice assistant',
      color: 'text-servio-orange-500',
      highlight: true,
      roles: ['manager', 'owner', 'admin'],
      section: 'ai'
    },
    {
      name: 'Conversations',
      href: '/dashboard/conversations',
      icon: FileText,
      description: 'Call transcripts & insights',
      color: 'text-indigo-500',
      roles: ['manager', 'owner', 'admin'],
      section: 'ai'
    },
    {
      name: 'Marketing',
      href: '/dashboard/marketing',
      icon: Mail,
      description: 'SMS & email campaigns',
      color: 'text-pink-500',
      roles: ['manager', 'owner', 'admin'],
      section: 'ai'
    },
    
    // ADMIN SECTION
    {
      name: 'Integrations',
      href: '/dashboard/integrations',
      icon: Wifi,
      description: 'API connections',
      color: 'text-cyan-500',
      roles: ['owner', 'admin'],
      section: 'admin'
    },
    {
      name: 'Invoices',
      href: '/dashboard/inventory/receipts',
      icon: FileText,
      description: 'Upload & track invoices',
      color: 'text-blue-500',
      roles: ['manager', 'owner', 'admin'],
      section: 'admin'
    },
    {
      name: 'Settings',
      href: '/dashboard/settings',
      icon: Settings,
      description: 'System settings',
      color: 'text-surface-500',
      roles: ['staff', 'manager', 'owner', 'admin'],
      section: 'admin'
    },
  ];

  // Filter navigation based on user role
  const navigation = allNavigation.filter(item => 
    item.roles.includes(user.role)
  );
  const currentItem = navigation.find((item) => currentPath === normalizePath(item.href));
  const pageTitle = currentItem?.name || 'Dashboard';

  // Mobile navigation - always show these 5 items at bottom
  const mobileNav = [
    { name: 'Home', href: '/dashboard', icon: Home },
    { name: 'Orders', href: '/dashboard/orders', icon: ClipboardList },
    { name: 'Menu', href: '/dashboard/menu-management', icon: UtensilsCrossed },
    { name: 'Assistant', href: '/dashboard/assistant', icon: Mic },
    { name: 'More', href: '#', icon: Menu, isMenuButton: true }
  ];

  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white" onTouchStart={handleTouchStart}>
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-surface-900/60 backdrop-blur-md lg:hidden"
            onClick={closeSidebar}
          />
        )}
      </AnimatePresence>

      <motion.div
        className={`fixed inset-y-0 left-0 z-50 w-72 flex flex-col bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 shadow-2xl shadow-black/20 gpu-accelerated will-change-transform ${
          isDesktop ? '' : (sidebarOpen ? 'translate-x-0' : '-translate-x-full')
        }`}
        initial={false}
        animate={isDesktop ? undefined : (sidebarOpen ? 'open' : 'closed')}
        variants={isDesktop ? undefined : drawerVariants}
        drag={!isDesktop && (edgeSwipeActive || sidebarOpen) ? 'x' : false}
        dragConstraints={dragConstraints}
        dragElastic={dragElastic}
        dragSnapToOrigin={true}
        onDragEnd={handleDragEnd}
        whileDrag={!isDesktop ? { scale: 0.98 } : undefined}
      >
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200 dark:border-gray-700">
          <motion.div className="flex items-center" whileHover={{ scale: 1.02 }}>
            <Link href="/dashboard" className="flex items-center">
              <img src="/images/servio_logo_transparent_tight.png" alt="Servio Logo" className="h-8 w-auto" />
            </Link>
          </motion.div>
          <button onClick={closeSidebar} className="lg:hidden btn-icon">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {/* Group navigation items by section */}
          {(() => {
            const sections: Record<string, typeof navigation> = {};
            const sectionsOrder = ['operations', 'team', 'ai', 'admin'];
            
            // Group items by section
            navigation.forEach((item) => {
              const section = item.section || 'other';
              if (!sections[section]) {
                sections[section] = [];
              }
              sections[section].push(item);
            });
            
            // Render sections in order
            return sectionsOrder.map((sectionName) => {
              const sectionItems = sections[sectionName];
              if (!sectionItems || sectionItems.length === 0) return null;
              
              return (
                <React.Fragment key={sectionName}>
                  {/* Section Header */}
                  <div className="px-4 py-2 mt-2">
                    <p className="text-xs font-semibold text-gray-400 dark:text-surface-500 uppercase tracking-wider">
                      {sectionName.charAt(0).toUpperCase() + sectionName.slice(1)}
                    </p>
                  </div>
                  
                  {/* Section Items */}
                  {sectionItems.map((item, index) => {
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
                </React.Fragment>
              );
            });
          })()}
        </nav>
        
        {/* Logout Button - Always visible at bottom of sidebar */}
        <div className="px-4 py-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="w-full flex items-center px-4 py-3 text-sm font-medium rounded-xl text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-200"
          >
            <div className="flex items-center justify-center w-10 h-10 rounded-lg mr-3 bg-red-50 dark:bg-red-900/30">
              <LogOut className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div className="flex-1 min-w-0 text-left">
              <span className="font-medium">Log Out</span>
              <p className="text-2xs text-red-500 dark:text-red-400 truncate">Sign out of your account</p>
            </div>
          </button>
        </div>
      </motion.div>

      {/* Logout Confirmation Modal */}
      <AnimatePresence>
        {showLogoutConfirm && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-surface-900/60 backdrop-blur-sm"
              onClick={() => setShowLogoutConfirm(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-center w-16 h-16 mx-auto bg-red-100 dark:bg-red-900/30 rounded-full mb-4">
                  <LogOut className="w-8 h-8 text-red-600 dark:text-red-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white text-center mb-2">
                  Sign Out?
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-6">
                  Are you sure you want to sign out of your account? You'll need to log in again to access your dashboard.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowLogoutConfirm(false)}
                    className="flex-1 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    disabled={isLoggingOut}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      setIsLoggingOut(true);
                      await logout();
                      router.push('/login');
                    }}
                    className="flex-1 px-4 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-medium transition-colors flex items-center justify-center gap-2"
                    disabled={isLoggingOut}
                  >
                    {isLoggingOut ? (
                      <>
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                          className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                        />
                        Signing out...
                      </>
                    ) : (
                      'Sign Out'
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="pl-0 lg:pl-72 transition-all duration-300">
        <div className="bg-white/95 dark:bg-gray-900/95 sticky top-0 z-30 border-b border-gray-200 dark:border-gray-700 backdrop-blur-md safe-area-inset-top">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => {
                    setSidebarOpen(true);
                    triggerHaptic();
                  }}
                  className="lg:hidden btn-icon"
                  aria-label="Open menu"
                >
                  <Menu className="w-5 h-5" />
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
          className="px-4 sm:px-6 lg:px-8 py-6 pb-28 sm:pb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {children}
        </motion.main>
      </div>

      {/* Mobile bottom navigation */}
      <div className="fixed bottom-0 left-0 right-0 z-40 w-full bg-white/95 dark:bg-gray-900/95 border-t border-gray-200 dark:border-gray-700 backdrop-blur-md lg:hidden safe-area-inset-bottom gpu-accelerated will-change-transform">
        <div className="grid grid-cols-5 px-2 py-2">
          {mobileNav.map((item) => {
            const isActive = !item.isMenuButton && currentPath === normalizePath(item.href);
            if (item.isMenuButton) {
              return (
                <button
                  key={item.name}
                  onClick={() => {
                    setSidebarOpen(true);
                    triggerHaptic();
                  }}
                  className={`flex flex-col items-center justify-center py-2 rounded-lg text-xs font-medium ${
                    isActive ? 'text-primary-700 dark:text-primary-300' : 'text-gray-500 dark:text-surface-400'
                  } hover:text-primary-700 dark:hover:text-primary-300 transition-colors`}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="mt-1">{item.name}</span>
                </button>
              );
            }
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
