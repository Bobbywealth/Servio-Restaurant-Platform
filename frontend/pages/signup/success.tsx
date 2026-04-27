import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle, Loader2, ArrowRight, Sparkles } from 'lucide-react';
import { api } from '../../lib/api';

interface SessionData {
  planName: string;
  planSlug: string;
  email: string;
  restaurantName?: string;
  customerName?: string;
  status: string;
  paymentStatus?: string | null;
  state?: 'paid' | 'pending' | 'failed' | 'expired';
}

const PLAN_NAMES: Record<string, string> = {
  starter: 'Starter',
  operations: 'Operations',
  voice: 'Voice',
};

type SignupState = 'success' | 'pending' | 'failed';

function resolveSignupState(sessionData: SessionData): SignupState {
  const normalizedState = String(sessionData.state || '').toLowerCase();
  const normalizedStatus = String(sessionData.status || '').toLowerCase();
  const normalizedPaymentStatus = String(sessionData.paymentStatus || '').toLowerCase();

  if (normalizedState === 'paid' || normalizedStatus === 'complete' || normalizedPaymentStatus === 'paid') {
    return 'success';
  }
  if (normalizedState === 'pending' || normalizedStatus === 'open') {
    return 'pending';
  }
  if (
    normalizedState === 'failed' ||
    normalizedState === 'expired' ||
    normalizedStatus === 'expired' ||
    normalizedPaymentStatus === 'unpaid'
  ) {
    return 'failed';
  }
  return 'failed';
}

export default function SignupSuccessPage() {
  const router = useRouter();
  const { session_id, deferred, email, plan, restaurant, name } = router.query;

  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!router.isReady) return;

    if (deferred === 'true') {
      setSessionData({
        planName: PLAN_NAMES[String(plan || '')] || String(plan || 'Servio'),
        planSlug: String(plan || ''),
        email: String(email || ''),
        restaurantName: restaurant ? String(restaurant) : undefined,
        customerName: name ? String(name) : undefined,
        status: 'open',
        paymentStatus: 'unpaid',
        state: 'pending',
      });
      setLoading(false);
      return;
    }

    if (!session_id || Array.isArray(session_id)) {
      setError('No session ID found. If you just completed checkout, please wait a moment and refresh.');
      setLoading(false);
      return;
    }

    const fetchSession = async () => {
      try {
        const response = await api.get(`/api/checkout/session-status/${session_id}`);
        const data = response.data?.data;
        if (data) {
          setSessionData({
            ...data,
            planName: PLAN_NAMES[data.planSlug] || data.planSlug || 'Unknown',
            email: data.customerEmail || data.email || '',
          });
        } else {
          setError('We could not find your session. If you completed payment, your account is being set up — check your email for confirmation.');
        }
      } catch (err: any) {
        const message =
          err.response?.data?.error?.message ||
          err.response?.data?.message ||
          err.message ||
          'Unable to verify your session. If payment was successful, you will receive a confirmation email.';
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    fetchSession();
  }, [router.isReady, session_id, deferred, email, plan, restaurant, name]);

  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4 relative overflow-hidden">
      <Head>
        <title>Welcome to Servio!</title>
        <meta name="description" content="Your Servio account has been created successfully." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {/* Prevent search engines from indexing the success page */}
        <meta name="robots" content="noindex" />
      </Head>

      {/* Ambient background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl"
          animate={{ scale: [1, 1.3, 1], opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl"
          animate={{ scale: [1.2, 1, 1.2], opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
        />
        {/* Confetti particles on success */}
        {!loading && !error && sessionData && (
          <>
            {[...Array(12)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-2 h-2 rounded-full"
                style={{
                  left: `${10 + i * 7}%`,
                  top: '-10px',
                  backgroundColor: i % 3 === 0 ? '#14b8a6' : i % 3 === 1 ? '#3b82f6' : '#a855f7',
                }}
                animate={{
                  y: ['0vh', '110vh'],
                  x: [0, (i % 2 === 0 ? 1 : -1) * (20 + i * 5)],
                  rotate: [0, 360 * (i % 2 === 0 ? 1 : -1)],
                  opacity: [1, 0],
                }}
                transition={{
                  duration: 3 + i * 0.3,
                  delay: i * 0.15,
                  ease: 'easeIn',
                  repeat: 1,
                  repeatDelay: 2,
                }}
              />
            ))}
          </>
        )}
      </div>

      <div className="w-full max-w-lg relative z-10">
        <AnimatePresence mode="wait">
          {/* Loading state */}
          {loading && (
            <motion.div
              key="loading"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-gray-800/80 border border-gray-700 rounded-2xl p-10 backdrop-blur-sm text-center"
            >
              <motion.div
                className="w-16 h-16 mx-auto mb-6 bg-gray-700/60 rounded-full flex items-center justify-center"
                animate={{ opacity: [0.6, 1, 0.6] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                <Loader2 className="w-8 h-8 text-primary-400 animate-spin" />
              </motion.div>
              <h1 className="text-2xl font-bold text-white mb-2">Verifying your payment&hellip;</h1>
              <p className="text-gray-400">Just a moment while we confirm your subscription.</p>
            </motion.div>
          )}

          {/* Error state */}
          {!loading && error && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-gray-800/80 border border-gray-700 rounded-2xl p-10 backdrop-blur-sm text-center"
            >
              <div className="w-16 h-16 mx-auto mb-6 bg-red-500/15 rounded-full flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-red-400" />
              </div>
              <h1 className="text-2xl font-bold text-white mb-3">Something went wrong</h1>
              <p className="text-gray-400 mb-8 leading-relaxed text-sm">{error}</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  href="/signup"
                  className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-semibold transition-colors text-sm"
                >
                  Back to Sign Up
                </Link>
                <Link
                  href="/login"
                  className="px-6 py-3 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white rounded-xl font-semibold transition-all flex items-center justify-center gap-2 text-sm shadow-lg shadow-primary-500/20"
                >
                  Try Logging In
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </motion.div>
          )}

          {/* Success state */}
          {!loading && !error && sessionData && (
            (() => {
              const signupState = resolveSignupState(sessionData);
              const isSuccess = signupState === 'success';
              const isPending = signupState === 'pending';
              const isFailed = signupState === 'failed';

              const badgeLabel = isSuccess
                ? 'Subscription Confirmed'
                : isPending
                  ? 'Payment Pending'
                  : 'Payment Incomplete';
              const statusLabel = isSuccess ? 'Active' : isPending ? 'Awaiting payment' : 'Needs recovery';
              const statusDotClass = isSuccess
                ? 'bg-green-400 animate-pulse'
                : isPending
                  ? 'bg-amber-400'
                  : 'bg-red-400';
              const statusTextClass = isSuccess
                ? 'text-green-400'
                : isPending
                  ? 'text-amber-400'
                  : 'text-red-400';
              const ctaLabel = isSuccess
                ? 'Go to Dashboard'
                : isPending
                  ? 'Retry Payment'
                  : 'Recover Subscription';
              const ctaHref = isSuccess ? '/login' : '/signup';

              return (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="bg-gray-800/80 border border-gray-700 rounded-2xl p-10 backdrop-blur-sm text-center"
            >
              {/* Checkmark animation */}
              <div className="flex justify-center mb-6">
                <div className="relative">
                  <motion.div
                    className="w-20 h-20 rounded-full bg-primary-500/15 flex items-center justify-center"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
                  >
                    <motion.div
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.3 }}
                    >
                      <CheckCircle2 className="w-10 h-10 text-primary-400" />
                    </motion.div>
                  </motion.div>
                  {/* Ping ring */}
                  <motion.div
                    className="absolute inset-0 rounded-full border-2 border-primary-400/40"
                    initial={{ scale: 1, opacity: 0.8 }}
                    animate={{ scale: 1.8, opacity: 0 }}
                    transition={{ duration: 1.2, delay: 0.4, ease: 'easeOut' }}
                  />
                </div>
              </div>

              {/* Welcome message */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <div className="inline-flex items-center gap-2 bg-primary-500/15 border border-primary-500/25 text-primary-300 px-4 py-1.5 rounded-full text-sm font-semibold mb-4">
                  <Sparkles className="w-3.5 h-3.5" />
                  {badgeLabel}
                </div>
                <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">
                  Welcome to Servio!
                </h1>
                {sessionData.customerName && (
                  <p className="text-xl text-gray-300 mb-1">Hey, {sessionData.customerName.split(' ')[0]}!</p>
                )}
                  <p className="text-gray-400 leading-relaxed">
                    {isSuccess && (
                      <>
                        You&apos;re all set. Your <span className="text-white font-semibold">{sessionData.planName}</span> plan is now active.
                      </>
                    )}
                    {isPending && (
                      <>
                        Your account is ready. Your <span className="text-white font-semibold">{sessionData.planName}</span> payment is still pending. Please retry to activate your subscription.
                      </>
                    )}
                    {isFailed && (
                      <>
                        We couldn&apos;t activate your <span className="text-white font-semibold">{sessionData.planName}</span> subscription. Please recover billing to continue.
                      </>
                    )}
                  </p>
              </motion.div>

              {/* Account details card */}
              <motion.div
                className="mt-7 bg-gray-900/60 border border-gray-700/60 rounded-xl p-5 text-left space-y-3"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55 }}
              >
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Plan</span>
                  <span className="text-white font-semibold text-sm flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-primary-400 inline-block" />
                    {sessionData.planName}
                  </span>
                </div>
                {sessionData.email && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 text-sm">Email</span>
                    <span className="text-white text-sm font-medium">{sessionData.email}</span>
                  </div>
                )}
                {sessionData.restaurantName && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 text-sm">Restaurant</span>
                    <span className="text-white text-sm font-medium">{sessionData.restaurantName}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Status</span>
                  <span className={`text-sm font-semibold flex items-center gap-1.5 ${statusTextClass}`}>
                    <span className={`w-2 h-2 rounded-full inline-block ${statusDotClass}`} />
                    {statusLabel}
                  </span>
                </div>
              </motion.div>

              {/* CTA */}
              <motion.div
                className="mt-7"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
              >
                <Link href={ctaHref}>
                  <motion.span
                    className="inline-flex items-center justify-center gap-2 w-full bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white py-4 px-6 rounded-2xl font-semibold transition-all duration-200 shadow-lg shadow-primary-500/25 cursor-pointer"
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {ctaLabel}
                    <ArrowRight className="w-5 h-5" />
                  </motion.span>
                </Link>
                <p className="text-center text-gray-500 text-xs mt-4">
                  Use the email and password you just created to log in.
                </p>
              </motion.div>
            </motion.div>
              );
            })()
          )}
        </AnimatePresence>

        {/* Footer */}
        <motion.p
          className="text-center text-gray-600 text-xs mt-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          Need help?{' '}
          <a
            href="mailto:support@getservio.com"
            className="text-gray-500 hover:text-gray-400 underline underline-offset-2 transition-colors"
          >
            Contact support
          </a>
        </motion.p>
      </div>
    </div>
  );
}
