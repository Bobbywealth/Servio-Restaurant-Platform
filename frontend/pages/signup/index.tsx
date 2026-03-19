import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Eye, EyeOff, AlertCircle, Loader2, ArrowRight,
  CheckCircle2, Building2, User, Mail, Lock, X
} from 'lucide-react';
import { api } from '../../lib/api';

const PLANS = [
  {
    slug: 'starter',
    name: 'Starter',
    price: 49,
    description: 'Get control of the basics: orders, visibility, and daily execution.',
    is_featured: false,
  },
  {
    slug: 'operations',
    name: 'Operations',
    price: 129,
    description: 'The full dashboard: orders, menu, marketing, inventory + receipts, staff, and integrations.',
    is_featured: true,
  },
  {
    slug: 'voice',
    name: 'Voice',
    price: 179,
    description: 'Hands-free workflows and the AI assistant that helps your team execute faster.',
    is_featured: false,
  },
];

function getPlanBySlug(slug: string | string[] | undefined) {
  if (!slug || Array.isArray(slug)) return null;
  return PLANS.find((p) => p.slug === slug) || null;
}

export default function SignupPage() {
  const router = useRouter();
  const { plan: planParam, cancelled } = router.query;

  const [selectedPlan, setSelectedPlan] = useState<typeof PLANS[0] | null>(null);
  const [restaurantName, setRestaurantName] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Resolve plan from URL query
  useEffect(() => {
    if (router.isReady) {
      const plan = getPlanBySlug(planParam);
      setSelectedPlan(plan);
    }
  }, [router.isReady, planParam]);

  const validate = () => {
    const errors: Record<string, string> = {};
    if (!restaurantName.trim()) errors.restaurantName = 'Restaurant name is required.';
    if (!fullName.trim()) errors.fullName = 'Full name is required.';
    if (!email.trim()) {
      errors.email = 'Email is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Please enter a valid email address.';
    }
    if (!password) {
      errors.password = 'Password is required.';
    } else if (password.length < 8) {
      errors.password = 'Password must be at least 8 characters.';
    }
    if (!confirmPassword) {
      errors.confirmPassword = 'Please confirm your password.';
    } else if (password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.';
    }
    if (!selectedPlan) {
      errors.plan = 'Please select a plan to continue.';
    }
    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setLoading(true);
    try {
      const response = await api.post('/api/checkout/create-checkout-session', {
        name: fullName,
        email,
        password,
        restaurantName,
        planSlug: selectedPlan!.slug,
      });
      const data = response.data?.data;
      const checkoutUrl = data?.checkoutUrl;
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
      } else if (data?.stripeError) {
        const query = new URLSearchParams({
          deferred: 'true',
          email,
          plan: selectedPlan?.slug || '',
          restaurant: restaurantName,
          name: fullName,
        });
        router.push(`/signup/success?${query.toString()}`);
      } else {
        setError('Your account was created, but billing could not start. Please log in and retry payment from your account.');
      }
    } catch (err: any) {
      const message =
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        err.message ||
        'Something went wrong. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handlePlanSelect = (plan: typeof PLANS[0]) => {
    setSelectedPlan(plan);
    setFieldErrors((prev) => ({ ...prev, plan: '' }));
    router.replace({ pathname: '/signup', query: { plan: plan.slug } }, undefined, { shallow: true });
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white relative overflow-x-hidden">
      <Head>
        <title>
          {selectedPlan
            ? `Sign Up for ${selectedPlan.name} | Servio`
            : 'Sign Up | Servio - Restaurant Operating System'}
        </title>
        <meta
          name="description"
          content="Create your Servio account and start managing your restaurant smarter."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      {/* Ambient background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl"
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"
          animate={{ scale: [1.2, 1, 1.2], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
        />
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 bg-gray-900/95 backdrop-blur-md border-b border-gray-800 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center gap-2">
              <img
                src="/images/servio_icon_tight.png"
                alt="Servio Logo"
                className="h-8 w-auto"
              />
              <span className="text-xl font-bold text-white">Servio</span>
            </Link>
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="text-gray-300 hover:text-white text-sm font-medium transition-colors"
              >
                Back to home
              </Link>
              <Link
                href="/login"
                className="text-gray-300 hover:text-white text-sm font-semibold border border-gray-700 hover:border-gray-500 px-4 py-2 rounded-xl transition-all"
              >
                Login
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="pt-24 pb-16 px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="max-w-2xl mx-auto">

          {/* Cancelled banner */}
          <AnimatePresence>
            {cancelled === 'true' && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mb-6 flex items-center gap-3 bg-yellow-500/15 border border-yellow-500/30 text-yellow-300 px-4 py-3 rounded-2xl"
              >
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm font-medium">
                  Payment was cancelled. You can try again below.
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Header */}
          <motion.div
            className="text-center mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            {selectedPlan ? (
              <>
                <div className="inline-flex items-center gap-2 bg-primary-500/15 border border-primary-500/30 text-primary-400 px-4 py-2 rounded-full text-sm font-semibold mb-4">
                  <CheckCircle2 className="w-4 h-4" />
                  {selectedPlan.name} Plan Selected
                </div>
                <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">
                  You&apos;re signing up for the{' '}
                  <span className="bg-gradient-to-r from-primary-400 to-primary-600 bg-clip-text text-transparent">
                    {selectedPlan.name}
                  </span>{' '}
                  plan
                </h1>
                <p className="text-gray-400 text-lg">
                  <span className="text-white font-semibold">${selectedPlan.price}/mo</span>
                  &nbsp;&mdash;&nbsp;{selectedPlan.description}
                </p>
              </>
            ) : (
              <>
                <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">
                  Start your Servio journey
                </h1>
                <p className="text-gray-400 text-lg">Choose a plan to get started.</p>
              </>
            )}
          </motion.div>

          {/* Plan selector — only when no plan in URL */}
          {!selectedPlan && (
            <motion.div
              className="mb-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {PLANS.map((plan, idx) => (
                  <motion.button
                    key={plan.slug}
                    onClick={() => handlePlanSelect(plan)}
                    className={`relative text-left rounded-2xl p-5 border transition-all duration-200 focus:outline-none ${
                      plan.is_featured
                        ? 'border-primary-500/60 bg-gray-800/80 shadow-lg shadow-primary-500/10'
                        : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                    }`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.08 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {plan.is_featured && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-primary-500 to-primary-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
                        POPULAR
                      </span>
                    )}
                    <p className="text-white font-bold text-lg mb-1">{plan.name}</p>
                    <p className="text-2xl font-extrabold text-white mb-2">
                      ${plan.price}
                      <span className="text-gray-400 text-sm font-normal">/mo</span>
                    </p>
                    <p className="text-gray-400 text-xs leading-relaxed">{plan.description}</p>
                    <div className="mt-3 flex items-center gap-1 text-primary-400 text-sm font-semibold">
                      Select <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </motion.button>
                ))}
              </div>
              {fieldErrors.plan && (
                <p className="text-red-400 text-sm mt-2 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" /> {fieldErrors.plan}
                </p>
              )}
            </motion.div>
          )}

          {/* Change plan link */}
          {selectedPlan && (
            <motion.div
              className="text-center mb-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <button
                type="button"
                onClick={() => {
                  setSelectedPlan(null);
                  router.replace({ pathname: '/signup' }, undefined, { shallow: true });
                }}
                className="text-sm text-gray-400 hover:text-primary-400 transition-colors underline underline-offset-2"
              >
                Change plan
              </button>
            </motion.div>
          )}

          {/* Signup form */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
          >
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-6 sm:p-8 backdrop-blur-sm">
              <h2 className="text-lg font-semibold text-white mb-6">Create your account</h2>

              {/* API error */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-5 flex items-start gap-3 bg-red-500/15 border border-red-500/30 text-red-300 px-4 py-3 rounded-xl"
                  >
                    <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">{error}</span>
                    <button
                      type="button"
                      onClick={() => setError('')}
                      className="ml-auto text-red-400 hover:text-red-200 transition-colors flex-shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                {/* Restaurant Name */}
                <div className="space-y-1.5">
                  <label htmlFor="restaurant-name" className="text-sm font-semibold text-gray-300 flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-gray-400" />
                    Restaurant Name
                  </label>
                  <input
                    id="restaurant-name"
                    type="text"
                    value={restaurantName}
                    onChange={(e) => {
                      setRestaurantName(e.target.value);
                      if (fieldErrors.restaurantName) setFieldErrors((p) => ({ ...p, restaurantName: '' }));
                    }}
                    className={`w-full bg-gray-800 border ${
                      fieldErrors.restaurantName ? 'border-red-500' : 'border-gray-700'
                    } text-white placeholder-gray-500 rounded-xl px-4 py-3 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all`}
                    placeholder="The Golden Fork"
                  />
                  {fieldErrors.restaurantName && (
                    <p className="text-red-400 text-xs flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" /> {fieldErrors.restaurantName}
                    </p>
                  )}
                </div>

                {/* Full Name */}
                <div className="space-y-1.5">
                  <label htmlFor="full-name" className="text-sm font-semibold text-gray-300 flex items-center gap-1.5">
                    <User className="w-4 h-4 text-gray-400" />
                    Full Name
                  </label>
                  <input
                    id="full-name"
                    type="text"
                    value={fullName}
                    onChange={(e) => {
                      setFullName(e.target.value);
                      if (fieldErrors.fullName) setFieldErrors((p) => ({ ...p, fullName: '' }));
                    }}
                    className={`w-full bg-gray-800 border ${
                      fieldErrors.fullName ? 'border-red-500' : 'border-gray-700'
                    } text-white placeholder-gray-500 rounded-xl px-4 py-3 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all`}
                    placeholder="Jane Smith"
                  />
                  {fieldErrors.fullName && (
                    <p className="text-red-400 text-xs flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" /> {fieldErrors.fullName}
                    </p>
                  )}
                </div>

                {/* Email */}
                <div className="space-y-1.5">
                  <label htmlFor="signup-email" className="text-sm font-semibold text-gray-300 flex items-center gap-1.5">
                    <Mail className="w-4 h-4 text-gray-400" />
                    Email
                  </label>
                  <input
                    id="signup-email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (fieldErrors.email) setFieldErrors((p) => ({ ...p, email: '' }));
                    }}
                    className={`w-full bg-gray-800 border ${
                      fieldErrors.email ? 'border-red-500' : 'border-gray-700'
                    } text-white placeholder-gray-500 rounded-xl px-4 py-3 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all`}
                    placeholder="jane@restaurant.com"
                    autoComplete="email"
                  />
                  {fieldErrors.email && (
                    <p className="text-red-400 text-xs flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" /> {fieldErrors.email}
                    </p>
                  )}
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <label htmlFor="signup-password" className="text-sm font-semibold text-gray-300 flex items-center gap-1.5">
                    <Lock className="w-4 h-4 text-gray-400" />
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="signup-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (fieldErrors.password) setFieldErrors((p) => ({ ...p, password: '' }));
                      }}
                      className={`w-full bg-gray-800 border ${
                        fieldErrors.password ? 'border-red-500' : 'border-gray-700'
                      } text-white placeholder-gray-500 rounded-xl px-4 py-3 pr-12 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all`}
                      placeholder="Min. 8 characters"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-white transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {fieldErrors.password && (
                    <p className="text-red-400 text-xs flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" /> {fieldErrors.password}
                    </p>
                  )}
                </div>

                {/* Confirm Password */}
                <div className="space-y-1.5">
                  <label htmlFor="signup-confirm-password" className="text-sm font-semibold text-gray-300 flex items-center gap-1.5">
                    <Lock className="w-4 h-4 text-gray-400" />
                    Confirm Password
                  </label>
                  <div className="relative">
                    <input
                      id="signup-confirm-password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        if (fieldErrors.confirmPassword) setFieldErrors((p) => ({ ...p, confirmPassword: '' }));
                      }}
                      className={`w-full bg-gray-800 border ${
                        fieldErrors.confirmPassword ? 'border-red-500' : 'border-gray-700'
                      } text-white placeholder-gray-500 rounded-xl px-4 py-3 pr-12 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all`}
                      placeholder="Repeat your password"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-white transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {fieldErrors.confirmPassword && (
                    <p className="text-red-400 text-xs flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" /> {fieldErrors.confirmPassword}
                    </p>
                  )}
                </div>

                {/* Submit */}
                <div className="pt-2">
                  <motion.button
                    type="submit"
                    disabled={loading}
                    whileHover={{ scale: loading ? 1 : 1.01 }}
                    whileTap={{ scale: loading ? 1 : 0.98 }}
                    className="w-full bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white py-4 px-6 rounded-2xl font-semibold transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-primary-500/25 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Redirecting to payment&hellip;
                      </>
                    ) : (
                      <>
                        Continue to Payment
                        <ArrowRight className="w-5 h-5" />
                      </>
                    )}
                  </motion.button>
                </div>

                <p className="text-center text-xs text-gray-500 pt-1">
                  You&apos;ll review your billing in Stripe after your account is created.
                </p>
              </form>
            </div>

            {/* Footer links */}
            <motion.p
              className="text-center text-gray-400 text-sm mt-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              Already have an account?{' '}
              <Link href="/login" className="text-primary-400 hover:text-primary-300 font-semibold transition-colors">
                Log in
              </Link>
            </motion.p>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
