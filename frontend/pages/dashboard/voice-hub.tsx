import React, { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { motion } from 'framer-motion';
import DashboardLayout from '../../components/Layout/DashboardLayout';
import { useUser } from '../../contexts/UserContext';
import { api } from '../../lib/api';
import { 
  Phone, 
  PhoneCall, 
  Clock, 
  TrendingUp, 
  Users, 
  CheckCircle, 
  AlertTriangle, 
  Filter, 
  Calendar,
  Download,
  RefreshCw,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  MessageCircle,
  ShoppingCart,
  Search
} from 'lucide-react';

interface CallLog {
  id: string;
  type: 'inbound' | 'outbound' | 'alert';
  phone_number: string;
  customer_name?: string;
  duration?: number;
  status: 'completed' | 'missed' | 'failed' | 'in_progress';
  outcome?: 'order_placed' | 'inquiry' | 'complaint' | 'no_answer';
  call_sid?: string;
  order_total?: number;
  created_at: string;
  ended_at?: string;
  notes?: string;
}

interface CallStats {
  totalCalls: number;
  answeredCalls: number;
  missedCalls: number;
  ordersPlaced: number;
  totalRevenue: number;
  avgDuration: number;
  answerRate: number;
  conversionRate: number;
}

export default function VoiceHub() {
  const { user, hasPermission } = useUser();
  const [calls, setCalls] = useState<CallLog[]>([]);
  const [stats, setStats] = useState<CallStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState('today');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchCallData = useCallback(async () => {
    try {
      setLoading(true);
      const [callsResponse, statsResponse] = await Promise.all([
        api.get('/api/voice-hub/calls', {
          params: { dateRange, statusFilter, search: searchTerm }
        }),
        api.get('/api/voice-hub/stats', {
          params: { dateRange }
        })
      ]);

      if (callsResponse.data.success) {
        setCalls(callsResponse.data.data);
      }
      if (statsResponse.data.success) {
        setStats(statsResponse.data.data);
      }
      setError(null);
    } catch (err) {
      console.error('Failed to fetch call data:', err);
      setError('Failed to load call data');
    } finally {
      setLoading(false);
    }
  }, [dateRange, statusFilter, searchTerm]);

  useEffect(() => {
    fetchCallData();
  }, [fetchCallData]);

  const getCallIcon = (type: string, status: string) => {
    if (status === 'missed' || status === 'failed') {
      return <PhoneMissed className="h-4 w-4 text-red-500" />;
    }
    switch (type) {
      case 'inbound':
        return <PhoneIncoming className="h-4 w-4 text-green-500" />;
      case 'outbound':
        return <PhoneOutgoing className="h-4 w-4 text-blue-500" />;
      case 'alert':
        return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      default:
        return <Phone className="h-4 w-4 text-gray-500" />;
    }
  };

  type CallStatus = 'completed' | 'missed' | 'failed' | 'in_progress';
  type CallOutcome = 'order_placed' | 'inquiry' | 'complaint' | 'no_answer';

  const getStatusBadge = (status: string) => {
    const styles: Record<CallStatus, string> = {
      completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      missed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
      failed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
      in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
    };

    const key: CallStatus = (status in styles ? status : 'completed') as CallStatus;
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[key]}`}>
        {status.replace('_', ' ')}
      </span>
    );
  };

  const getOutcomeBadge = (outcome?: string) => {
    if (!outcome) return null;
    
    const styles: Record<CallOutcome, string> = {
      order_placed: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
      inquiry: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
      complaint: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
      no_answer: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300'
    };

    const key: CallOutcome = (outcome in styles ? outcome : 'inquiry') as CallOutcome;
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ml-2 ${styles[key]}`}>
        {outcome.replace('_', ' ')}
      </span>
    );
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatPhoneNumber = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
    if (match) {
      return `(${match[1]}) ${match[2]}-${match[3]}`;
    }
    return phone;
  };

  if (!hasPermission('analytics.*') && !hasPermission('platform:admin')) {
    return (
      <DashboardLayout>
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-red-900 dark:text-red-100 mb-2">Access Denied</h2>
            <p className="text-red-700 dark:text-red-300">
              You don&apos;t have permission to view the Voice Hub dashboard.
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <>
      <Head>
        <title>Voice Hub - Servio Restaurant Platform</title>
        <meta name="description" content="Call log and voice analytics dashboard" />
      </Head>

      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <motion.div
            className="flex items-center justify-between"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-surface-900 via-primary-700 to-servio-orange-600 bg-clip-text text-transparent dark:from-surface-100 dark:via-primary-300 dark:to-servio-orange-400">
                🎙️ Voice Hub
              </h1>
              <p className="text-surface-600 dark:text-surface-400 mt-1">
                Monitor calls, track conversations, and analyze voice interactions
              </p>
            </div>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={fetchCallData}
                className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Refresh</span>
              </button>
            </div>
          </motion.div>

          {/* Stats Cards */}
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <motion.div
                className="bg-white dark:bg-surface-800 rounded-xl p-6 shadow-lg border border-surface-100 dark:border-surface-700"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-surface-600 dark:text-surface-400">Total Calls</p>
                    <p className="text-2xl font-bold text-surface-900 dark:text-surface-100">
                      {stats.totalCalls.toLocaleString()}
                    </p>
                  </div>
                  <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                    <Phone className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
                <div className="mt-4 flex items-center text-sm">
                  <span className="text-green-600 dark:text-green-400">↗ {stats.answerRate.toFixed(1)}%</span>
                  <span className="text-surface-500 dark:text-surface-400 ml-2">answer rate</span>
                </div>
              </motion.div>

              <motion.div
                className="bg-white dark:bg-surface-800 rounded-xl p-6 shadow-lg border border-surface-100 dark:border-surface-700"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-surface-600 dark:text-surface-400">Orders Placed</p>
                    <p className="text-2xl font-bold text-surface-900 dark:text-surface-100">
                      {stats.ordersPlaced}
                    </p>
                  </div>
                  <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-xl">
                    <ShoppingCart className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                </div>
                <div className="mt-4 flex items-center text-sm">
                  <span className="text-green-600 dark:text-green-400">
                    {stats.conversionRate.toFixed(1)}%
                  </span>
                  <span className="text-surface-500 dark:text-surface-400 ml-2">conversion</span>
                </div>
              </motion.div>

              <motion.div
                className="bg-white dark:bg-surface-800 rounded-xl p-6 shadow-lg border border-surface-100 dark:border-surface-700"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-surface-600 dark:text-surface-400">Revenue</p>
                    <p className="text-2xl font-bold text-surface-900 dark:text-surface-100">
                      ${stats.totalRevenue.toFixed(2)}
                    </p>
                  </div>
                  <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
                    <TrendingUp className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                  </div>
                </div>
                <div className="mt-4 flex items-center text-sm">
                  <span className="text-surface-500 dark:text-surface-400">from voice orders</span>
                </div>
              </motion.div>

              <motion.div
                className="bg-white dark:bg-surface-800 rounded-xl p-6 shadow-lg border border-surface-100 dark:border-surface-700"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-surface-600 dark:text-surface-400">Avg Duration</p>
                    <p className="text-2xl font-bold text-surface-900 dark:text-surface-100">
                      {formatDuration(stats.avgDuration)}
                    </p>
                  </div>
                  <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-xl">
                    <Clock className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                  </div>
                </div>
                <div className="mt-4 flex items-center text-sm">
                  <span className="text-surface-500 dark:text-surface-400">per call</span>
                </div>
              </motion.div>
            </div>
          )}

          {/* Filters */}
          <motion.div
            className="bg-white dark:bg-surface-800 rounded-xl p-6 shadow-lg border border-surface-100 dark:border-surface-700"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center space-x-2">
                <Calendar className="h-4 w-4 text-surface-500" />
                <select
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value)}
                  className="border border-surface-200 dark:border-surface-600 rounded-lg px-3 py-2 bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100"
                >
                  <option value="today">Today</option>
                  <option value="yesterday">Yesterday</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                  <option value="all">All Time</option>
                </select>
              </div>

              <div className="flex items-center space-x-2">
                <Filter className="h-4 w-4 text-surface-500" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="border border-surface-200 dark:border-surface-600 rounded-lg px-3 py-2 bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100"
                >
                  <option value="all">All Status</option>
                  <option value="completed">Completed</option>
                  <option value="missed">Missed</option>
                  <option value="failed">Failed</option>
                </select>
              </div>

              <div className="flex items-center space-x-2 flex-1 max-w-sm">
                <Search className="h-4 w-4 text-surface-500" />
                <input
                  type="text"
                  placeholder="Search by phone number..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1 border border-surface-200 dark:border-surface-600 rounded-lg px-3 py-2 bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100 placeholder-surface-500"
                />
              </div>
            </div>
          </motion.div>

          {/* Call Log */}
          <motion.div
            className="bg-white dark:bg-surface-800 rounded-xl shadow-lg border border-surface-100 dark:border-surface-700"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <div className="p-6 border-b border-surface-200 dark:border-surface-700">
              <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-100">
                Recent Calls
              </h3>
            </div>

            {loading ? (
              <div className="p-6">
                <div className="animate-pulse space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center space-x-4">
                      <div className="h-10 w-10 bg-surface-200 dark:bg-surface-700 rounded-full"></div>
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-surface-200 dark:bg-surface-700 rounded w-1/4"></div>
                        <div className="h-3 bg-surface-200 dark:bg-surface-700 rounded w-1/2"></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : calls.length === 0 ? (
              <div className="p-12 text-center">
                <Phone className="h-12 w-12 text-surface-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-surface-900 dark:text-surface-100 mb-2">
                  No calls found
                </h3>
                <p className="text-surface-600 dark:text-surface-400">
                  Call logs will appear here as customers contact your restaurant.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-surface-200 dark:divide-surface-700">
                {calls.map((call, index) => (
                  <motion.div
                    key={call.id}
                    className="p-6 hover:bg-surface-50 dark:hover:bg-surface-700/50 transition-colors"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="flex-shrink-0">
                          {getCallIcon(call.type, call.status)}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <p className="text-sm font-medium text-surface-900 dark:text-surface-100">
                              {formatPhoneNumber(call.phone_number)}
                            </p>
                            {call.customer_name && (
                              <span className="text-sm text-surface-600 dark:text-surface-400">
                                ({call.customer_name})
                              </span>
                            )}
                          </div>
                          
                          <div className="flex items-center space-x-2 mt-1">
                            <span className="text-xs text-surface-500 dark:text-surface-400">
                              {new Date(call.created_at).toLocaleString()}
                            </span>
                            {call.duration && (
                              <>
                                <span className="text-surface-300 dark:text-surface-600">•</span>
                                <span className="text-xs text-surface-500 dark:text-surface-400">
                                  {formatDuration(call.duration)}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3">
                        {call.order_total && (
                          <span className="text-sm font-medium text-green-600 dark:text-green-400">
                            ${call.order_total.toFixed(2)}
                          </span>
                        )}
                        
                        <div className="flex items-center">
                          {getStatusBadge(call.status)}
                          {getOutcomeBadge(call.outcome)}
                        </div>
                      </div>
                    </div>

                    {call.notes && (
                      <div className="mt-3 pl-8">
                        <p className="text-sm text-surface-600 dark:text-surface-400 bg-surface-50 dark:bg-surface-700/50 rounded-lg p-3">
                          {call.notes}
                        </p>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      </DashboardLayout>
    </>
  );
}