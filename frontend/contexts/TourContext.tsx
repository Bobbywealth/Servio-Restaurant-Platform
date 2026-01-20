import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useUser } from './UserContext';

interface TourStep {
  id: string;
  title: string;
  description: string;
  target: string;
  position: 'top' | 'bottom' | 'left' | 'right';
  action?: 'click' | 'hover' | 'none';
  highlight?: boolean;
  nextText?: string;
  skipable?: boolean;
}

interface TourContextType {
  isActive: boolean;
  currentStep: number;
  steps: TourStep[];
  startTour: () => void;
  nextStep: () => void;
  previousStep: () => void;
  skipTour: () => void;
  endTour: () => void;
  resetTour: () => void;
}

const TourContext = createContext<TourContextType | undefined>(undefined);

export const useTour = () => {
  const context = useContext(TourContext);
  if (!context) {
    throw new Error('useTour must be used within a TourProvider');
  }
  return context;
};

const DASHBOARD_TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: '🎉 Welcome to Servio!',
    description: 'Your all-in-one restaurant operating system! Let\'s take a quick tour to get you started.',
    target: '.welcome-header',
    position: 'bottom',
    nextText: 'Let\'s start!',
    skipable: true
  },
  {
    id: 'assistant-hero',
    title: '🤖 Meet Servio Assistant',
    description: 'Your AI-powered voice assistant. Click here to start talking to Servio about orders, inventory, tasks, and more!',
    target: '.assistant-hero',
    position: 'bottom',
    highlight: true,
    nextText: 'Amazing!'
  },
  {
    id: 'stats-overview',
    title: '📊 Live Dashboard Stats',
    description: 'Get real-time insights into your restaurant\'s performance - active orders, sales, tasks, and inventory status.',
    target: '.stats-grid',
    position: 'top',
    nextText: 'Show me more'
  },
  {
    id: 'sidebar-navigation',
    title: '🧭 Navigation Menu',
    description: 'Access all your restaurant management tools from this sidebar. Everything you need is organized by function.',
    target: '.sidebar-nav',
    position: 'right',
    nextText: 'Got it'
  },
  {
    id: 'orders-nav',
    title: '🍽️ Orders Management',
    description: 'Track and manage all your orders in real-time. Update status, view details, and keep customers informed.',
    target: '[href="/dashboard/orders"]',
    position: 'right',
    action: 'hover',
    nextText: 'Next feature'
  },
  {
    id: 'assistant-nav',
    title: '🎤 Voice Assistant',
    description: 'The heart of Servio! Talk naturally to manage orders, check inventory, assign tasks, and get insights.',
    target: '[href="/dashboard/assistant"]',
    position: 'right',
    action: 'hover',
    highlight: true,
    nextText: 'Keep going'
  },
  {
    id: 'inventory-nav',
    title: '📦 Inventory Control',
    description: 'Track stock levels, receive deliveries, and get automated alerts when items are running low.',
    target: '[href="/dashboard/inventory"]',
    position: 'right',
    action: 'hover',
    nextText: 'More features'
  },
  {
    id: 'menu-nav',
    title: '📋 Menu Management',
    description: 'Customize your menu, update prices, manage categories, and control what\'s available to customers.',
    target: '[href="/dashboard/menu-management"]',
    position: 'right',
    action: 'hover',
    nextText: 'Almost done'
  },
  {
    id: 'staff-nav',
    title: '👥 Staff & Team',
    description: 'Manage your team, schedules, roles, and track time clock entries for all staff members.',
    target: '[href="/dashboard/staff"]',
    position: 'right',
    action: 'hover',
    nextText: 'Final step'
  },
  {
    id: 'account-switcher',
    title: '👤 Your Account',
    description: 'Access account settings, switch between locations, and manage your profile from here.',
    target: '.account-switcher',
    position: 'left',
    nextText: 'Finish tour'
  },
  {
    id: 'complete',
    title: '🚀 You\'re All Set!',
    description: 'You\'re ready to revolutionize your restaurant operations! Start by talking to Servio or exploring any section.',
    target: '.assistant-hero',
    position: 'bottom',
    highlight: true,
    nextText: 'Start using Servio!'
  }
];

interface TourProviderProps {
  children: ReactNode;
}

export function TourProvider({ children }: TourProviderProps) {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [hasSeenTour, setHasSeenTour] = useState(false);
  const { user } = useUser();

  const steps = DASHBOARD_TOUR_STEPS;

  useEffect(() => {
    // Check if user has seen the tour
    const tourCompleted = localStorage.getItem(`servio_tour_completed_${user?.id}`);
    setHasSeenTour(!!tourCompleted);
  }, [user?.id]);

  useEffect(() => {
    // Auto-start tour for new users who haven't seen it or just signed up
    if (user && !isActive) {
      const isNewSignup = localStorage.getItem('servio_new_signup');
      
      if (isNewSignup || !hasSeenTour) {
        // Clear the new signup flag
        if (isNewSignup) {
          localStorage.removeItem('servio_new_signup');
        }
        
        // Small delay to let the dashboard load
        const timer = setTimeout(() => {
          if (window.location.pathname === '/dashboard') {
            startTour();
          }
        }, 2000); // Slightly longer delay for better UX
        
        return () => clearTimeout(timer);
      }
    }
  }, [user, hasSeenTour, isActive]);

  const startTour = () => {
    setIsActive(true);
    setCurrentStep(0);
  };

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      endTour();
    }
  };

  const previousStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const skipTour = () => {
    endTour();
  };

  const endTour = () => {
    setIsActive(false);
    setCurrentStep(0);
    if (user?.id) {
      localStorage.setItem(`servio_tour_completed_${user.id}`, 'true');
      setHasSeenTour(true);
    }
  };

  const resetTour = () => {
    if (user?.id) {
      localStorage.removeItem(`servio_tour_completed_${user.id}`);
      setHasSeenTour(false);
    }
    startTour();
  };

  const value: TourContextType = {
    isActive,
    currentStep,
    steps,
    startTour,
    nextStep,
    previousStep,
    skipTour,
    endTour,
    resetTour
  };

  return (
    <TourContext.Provider value={value}>
      {children}
    </TourContext.Provider>
  );
}