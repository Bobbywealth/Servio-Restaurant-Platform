'use client';

import React, { useState } from 'react';
import { 
  CreditCard, DollarSign, Calendar, CheckCircle, AlertTriangle,
  Download, RefreshCw, TrendingUp, TrendingDown,
  Building, Package, ChevronRight, Loader2
} from 'lucide-react';

// Types
interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  interval: 'month' | 'year';
  features: string[];
  restaurant_limit?: number;
}

interface BillingHistory {
  id: string;
  date: string;
  amount: number;
  status: 'paid' | 'pending' | 'failed';
  description: string;
  invoice_url?: string;
}

interface CompanyBillingProps {
  onClose?: () => void;
}

// Plans
const plans: SubscriptionPlan[] = [
  {
    id: 'starter',
    name: 'Starter',
    price: 49,
    interval: 'month',
    features: [
      'Up to 2 restaurants',
      'Basic analytics',
      'Order management',
      'Staff scheduling',
      'Email support'
    ],
    restaurant_limit: 2
  },
  {
    id: 'professional',
    name: 'Professional',
    price: 149,
    interval: 'month',
    features: [
      'Up to 10 restaurants',
      'Advanced analytics',
      'Multi-location management',
      'API access',
      'Priority support',
      'Custom branding'
    ],
    restaurant_limit: 10
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 399,
    interval: 'month',
    features: [
      'Unlimited restaurants',
      'Custom integrations',
      'Dedicated account manager',
      '24/7 phone support',
      'SLA guarantee',
      'Custom reporting'
    ],
    restaurant_limit: undefined
  }
];

// Mock billing history
const mockBillingHistory: BillingHistory[] = [
  { id: '1', date: '2024-03-01', amount: 149, status: 'paid', description: 'Professional Plan - March 2024', invoice_url: '#' },
  { id: '2', date: '2024-02-01', amount: 149, status: 'paid', description: 'Professional Plan - February 2024', invoice_url: '#' },
  { id: '3', date: '2024-01-01', amount: 149, status: 'paid', description: 'Professional Plan - January 2024', invoice_url: '#' },
  { id: '4', date: '2023-12-01', amount: 49, status: 'paid', description: 'Starter Plan - December 2023', invoice_url: '#' },
];

// Current subscription (mock)
const currentSubscription = {
  plan: 'professional',
  status: 'active',
  current_period_start: '2024-03-01',
  current_period_end: '2024-04-01',
  cancel_at_period_end: false,
  payment_method: {
    brand: 'visa',
    last4: '4242',
    exp_month: 12,
    exp_year: 2025
  }
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

export function CompanyBilling({ onClose }: CompanyBillingProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'plans' | 'history'>('overview');
  const [isProcessing, setIsProcessing] = useState(false);
  const [billingHistory] = useState<BillingHistory[]>(mockBillingHistory);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  // Calculate yearly savings
  const yearlySavings = plans.reduce((acc, plan) => {
    const monthly = plan.price * 12;
    const yearly = plan.price * 10; // 2 months free
    acc[plan.id] = monthly - yearly;
    return acc;
  }, {} as Record<string, number>);

  // Handle plan change
  const handlePlanChange = async (planId: string) => {
    setIsProcessing(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      setSelectedPlan(planId);
    } catch (error) {
      console.error('Failed to change plan:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Billing & Subscription
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Manage your subscription and billing information
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-gray-500 rotate-90" />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex gap-2">
            {(['overview', 'plans', 'history'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {tab === 'overview' && 'Overview'}
                {tab === 'plans' && 'Plans'}
                {tab === 'history' && 'History'}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Current Plan */}
              <div className="card p-6">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                      Current Plan
                    </h3>
                    <p className="text-sm text-gray-500">
                      Your subscription renews on {formatDate(currentSubscription.current_period_end)}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    currentSubscription.status === 'active'
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                  }`}>
                    {currentSubscription.status === 'active' ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                    <Package className="w-8 h-8 text-primary-600 dark:text-primary-400" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                      {plans.find(p => p.id === currentSubscription.plan)?.name} Plan
                    </div>
                    <div className="text-gray-500">
                      {formatCurrency(plans.find(p => p.id === currentSubscription.plan)?.price || 0)}/month
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setActiveTab('plans')}
                    className="btn-primary"
                  >
                    Change Plan
                  </button>
                  <button className="btn-secondary">
                    Cancel Subscription
                  </button>
                </div>
              </div>

              {/* Payment Method */}
              <div className="card p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Payment Method
                </h3>
                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-8 rounded bg-gradient-to-r from-blue-600 to-blue-400 flex items-center justify-center text-white text-xs font-bold">
                      VISA
                    </div>
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">
                        •••• {currentSubscription.payment_method.last4}
                      </div>
                      <div className="text-sm text-gray-500">
                        Expires {currentSubscription.payment_method.exp_month}/{currentSubscription.payment_method.exp_year}
                      </div>
                    </div>
                  </div>
                  <button className="btn-secondary text-sm">
                    Update
                  </button>
                </div>
              </div>

              {/* Usage This Month */}
              <div className="card p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Usage This Month
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <div className="text-3xl font-bold text-gray-900 dark:text-white">
                      3
                    </div>
                    <div className="text-sm text-gray-500">
                      Active Restaurants
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      of 10 allowed
                    </div>
                  </div>
                  <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <div className="text-3xl font-bold text-gray-900 dark:text-white">
                      1,247
                    </div>
                    <div className="text-sm text-gray-500">
                      Orders Processed
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      this month
                    </div>
                  </div>
                  <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <div className="text-3xl font-bold text-gray-900 dark:text-white">
                      12
                    </div>
                    <div className="text-sm text-gray-500">
                      Team Members
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      unlimited
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'plans' && (
            <div className="space-y-6">
              {/* Billing Toggle */}
              <div className="flex justify-center mb-6">
                <div className="inline-flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                  <button className="px-4 py-2 rounded-lg text-sm font-medium bg-white dark:bg-gray-600 shadow-sm">
                    Monthly
                  </button>
                  <button className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400">
                    Yearly <span className="text-green-600 text-xs ml-1">(Save ~17%)</span>
                  </button>
                </div>
              </div>

              {/* Plans Grid */}
              <div className="grid md:grid-cols-3 gap-4">
                {plans.map(plan => {
                  const isCurrent = currentSubscription.plan === plan.id;
                  const isSelected = selectedPlan === plan.id;
                  
                  return (
                    <div 
                      key={plan.id}
                      className={`card p-6 relative ${
                        isCurrent 
                          ? 'border-2 border-primary-500 ring-2 ring-primary-500/20' 
                          : 'border border-gray-200 dark:border-gray-700'
                      }`}
                    >
                      {isCurrent && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-primary-500 text-white text-xs font-medium rounded-full">
                          Current Plan
                        </div>
                      )}
                      
                      <div className="text-center mb-6">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                          {plan.name}
                        </h3>
                        <div className="flex items-baseline justify-center gap-1">
                          <span className="text-4xl font-bold text-gray-900 dark:text-white">
                            ${plan.price}
                          </span>
                          <span className="text-gray-500">/month</span>
                        </div>
                        {plan.restaurant_limit && (
                          <div className="text-sm text-gray-500 mt-1">
                            Up to {plan.restaurant_limit} restaurants
                          </div>
                        )}
                      </div>

                      <ul className="space-y-3 mb-6">
                        {plan.features.map((feature, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm">
                            <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                            <span className="text-gray-600 dark:text-gray-300">{feature}</span>
                          </li>
                        ))}
                      </ul>

                      <button
                        onClick={() => !isCurrent && handlePlanChange(plan.id)}
                        disabled={isCurrent || isProcessing}
                        className={`w-full py-3 rounded-lg font-medium transition-colors ${
                          isCurrent
                            ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                            : isProcessing
                            ? 'bg-primary-500 text-white'
                            : 'bg-primary-500 hover:bg-primary-600 text-white'
                        }`}
                      >
                        {isProcessing ? (
                          <span className="flex items-center justify-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Processing...
                          </span>
                        ) : isCurrent ? (
                          'Current Plan'
                        ) : (
                          `Upgrade to ${plan.name}`
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Billing History
                </h3>
                <button className="btn-secondary flex items-center gap-2 text-sm">
                  <Download className="w-4 h-4" />
                  Export
                </button>
              </div>

              <div className="space-y-2">
                {billingHistory.map(item => (
                  <div 
                    key={item.id}
                    className="card p-4 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        item.status === 'paid'
                          ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                          : item.status === 'pending'
                          ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
                          : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                      }`}>
                        {item.status === 'paid' ? (
                          <CheckCircle className="w-5 h-5" />
                        ) : item.status === 'pending' ? (
                          <Clock className="w-5 h-5" />
                        ) : (
                          <AlertTriangle className="w-5 h-5" />
                        )}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">
                          {item.description}
                        </div>
                        <div className="text-sm text-gray-500">
                          {formatDate(item.date)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="font-semibold text-gray-900 dark:text-white">
                          {formatCurrency(item.amount)}
                        </div>
                        <span className={`text-xs font-medium ${
                          item.status === 'paid'
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-amber-600 dark:text-amber-400'
                        }`}>
                          {item.status === 'paid' ? 'Paid' : 'Pending'}
                        </span>
                      </div>
                      {item.invoice_url && (
                        <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                          <Download className="w-4 h-4 text-gray-500" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default CompanyBilling;
