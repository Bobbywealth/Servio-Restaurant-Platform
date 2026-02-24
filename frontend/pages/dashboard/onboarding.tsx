import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircle, 
  ChevronRight, 
  ChevronLeft,
  Store,
  Utensils,
  CreditCard,
  Printer,
  Users,
  Bell,
  Settings,
  ArrowRight,
  SkipForward
} from 'lucide-react';
import { useUser } from '../../contexts/UserContext';
import { api } from '../../lib/api';

type OnboardingStep = {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  completed?: boolean;
};

const defaultSteps: OnboardingStep[] = [
  {
    id: 'profile',
    title: 'Restaurant Profile',
    description: 'Set your restaurant name, address, and contact information',
    icon: <Store className="w-6 h-6" />,
    href: '/dashboard/restaurant-profile'
  },
  {
    id: 'menu',
    title: 'Add Menu Items',
    description: 'Create your menu categories and add items with prices',
    icon: <Utensils className="w-6 h-6" />,
    href: '/dashboard/menu-management'
  },
  {
    id: 'payments',
    title: 'Payment Settings',
    description: 'Configure Stripe and enable online payments',
    icon: <CreditCard className="w-6 h-6" />,
    href: '/dashboard/settings?tab=payments'
  },
  {
    id: 'printers',
    title: 'Printer Setup',
    description: 'Connect receipt printers for order tickets',
    icon: <Printer className="w-6 h-6" />,
    href: '/dashboard/settings?tab=printing'
  },
  {
    id: 'staff',
    title: 'Invite Staff',
    description: 'Add team members and set up their permissions',
    icon: <Users className="w-6 h-6" />,
    href: '/dashboard/staff'
  },
  {
    id: 'notifications',
    title: 'Notification Settings',
    description: 'Configure how you receive order notifications',
    icon: <Bell className="w-6 h-6" />,
    href: '/dashboard/settings?tab=notifications'
  }
];

export default function OnboardingPage() {
  const router = useRouter();
  const { user } = useUser();
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [isSkipped, setIsSkipped] = useState(false);

  const steps = defaultSteps.map(step => ({
    ...step,
    completed: completedSteps.includes(step.id)
  }));

  const progress = Math.round((completedSteps.length / steps.length) * 100);

  const handleComplete = (stepId: string) => {
    if (!completedSteps.includes(stepId)) {
      setCompletedSteps([...completedSteps, stepId]);
    }
  };

  const handleNext = () => {
    const currentStepData = steps[currentStep];
    handleComplete(currentStepData.id);
    
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    setIsSkipped(true);
  };

  const handleGoToDashboard = () => {
    router.push('/dashboard');
  };

  // Mark step as completed when user navigates to its URL
  useEffect(() => {
    if (user) {
      // Check which steps might already be completed based on existing data
      api.get('/api/restaurant/profile').then(() => {
        handleComplete('profile');
      }).catch(() => {});
    }
  }, [user]);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (isSkipped) {
    return (
      <>
        <Head>
          <title>Welcome to Servio!</title>
        </Head>
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center"
          >
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              You're All Set!
            </h1>
            <p className="text-gray-600 mb-8">
              You can always complete your setup later from the dashboard settings.
            </p>
            <button
              onClick={handleGoToDashboard}
              className="w-full bg-blue-600 text-white py-3 px-6 rounded-xl font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
            >
              Go to Dashboard
              <ArrowRight className="w-5 h-5" />
            </button>
          </motion.div>
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Setup Your Restaurant - Servio</title>
      </Head>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-4xl mx-auto px-4 py-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
                  <Settings className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Welcome to Servio!</h1>
                  <p className="text-sm text-gray-500">Let's set up your restaurant</p>
                </div>
              </div>
              <button
                onClick={handleSkip}
                className="text-gray-500 hover:text-gray-700 text-sm font-medium flex items-center gap-1"
              >
                <SkipForward className="w-4 h-4" />
                Skip for now
              </button>
            </div>
            
            {/* Progress bar */}
            <div className="w-full bg-gray-200 rounded-full h-2">
              <motion.div 
                className="bg-blue-600 h-2 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
            <p className="text-sm text-gray-500 mt-2">{progress}% complete</p>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Steps List */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
                <h3 className="font-semibold text-gray-900 mb-4">Setup Steps</h3>
                <div className="space-y-2">
                  {steps.map((step, index) => (
                    <button
                      key={step.id}
                      onClick={() => setCurrentStep(index)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors text-left ${
                        currentStep === index 
                          ? 'bg-blue-50 border border-blue-200' 
                          : step.completed
                            ? 'bg-green-50 border border-green-200'
                            : 'hover:bg-gray-50 border border-transparent'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        step.completed 
                          ? 'bg-green-500 text-white' 
                          : currentStep === index
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-500'
                      }`}>
                        {step.completed ? (
                          <CheckCircle className="w-5 h-5" />
                        ) : (
                          step.icon
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`font-medium text-sm ${
                          currentStep === index ? 'text-blue-900' : 'text-gray-900'
                        }`}>
                          {step.title}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Step Content */}
            <div className="lg:col-span-2">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStep}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6"
                >
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
                      {steps[currentStep].icon}
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">
                        {steps[currentStep].title}
                      </h2>
                      <p className="text-gray-500 text-sm">
                        Step {currentStep + 1} of {steps.length}
                      </p>
                    </div>
                  </div>

                  <p className="text-gray-600 mb-8">
                    {steps[currentStep].description}
                  </p>

                  {/* Preview/Action Area */}
                  <div className="bg-gray-50 rounded-xl p-6 mb-6">
                    <div className="text-center">
                      <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                        {steps[currentStep].icon}
                      </div>
                      <p className="text-gray-500 text-sm">
                        Click "Continue" to set up {steps[currentStep].title.toLowerCase()}
                      </p>
                    </div>
                  </div>

                  {/* Navigation */}
                  <div className="flex items-center justify-between">
                    <button
                      onClick={handlePrevious}
                      disabled={currentStep === 0}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                        currentStep === 0 
                          ? 'text-gray-300 cursor-not-allowed' 
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      <ChevronLeft className="w-5 h-5" />
                      Back
                    </button>
                    
                    <div className="flex items-center gap-3">
                      {currentStep === steps.length - 1 ? (
                        <button
                          onClick={handleGoToDashboard}
                          className="bg-green-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-green-700 transition-colors flex items-center gap-2"
                        >
                          <CheckCircle className="w-5 h-5" />
                          Complete Setup
                        </button>
                      ) : (
                        <button
                          onClick={handleNext}
                          className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center gap-2"
                        >
                          Continue
                          <ChevronRight className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
