import React, { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import DashboardLayout from '../../components/Layout/DashboardLayout';
import { useUser } from '../../contexts/UserContext';
import { api } from '../../lib/api';

interface DashboardData {
  kpis: {
    totalRequests: number;
    errorRate: string;
    avgResponseTime: string;
    uptime: string;
    activeConversations: number;
  };
  processing: {
    audioRequests: number;
    textRequests: number;
    avgAudioTime: string;
    avgTextTime: string;
  };
  health: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: Record<string, { status: string; message?: string }>;
  };
  errors: {
    total: number;
    rateLimitHits: number;
    byType: Array<{ type: string; count: number; percentage: string }>;
  };
  openaiUsage: {
    totalCalls: number;
    callsPerRequest: string;
  };
  alerts: string[];
  recommendations: string[];
  lastUpdated: string;
}

export default function AssistantMonitoringPage() {
  const { user, hasPermission } = useUser();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchDashboardData = useCallback(async () => {
    try {
      const response = await api.get('/api/assistant-monitoring/dashboard-data');
      if (response.data.success) {
        setDashboardData(response.data.data);
        setError(null);
      }
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
      setError('Failed to load monitoring data');
    } finally {
      setLoading(false);
    }
  }, []);

  const resetMetrics = async () => {
    if (!confirm('Are you sure you want to reset all metrics? This action cannot be undone.')) {
      return;
    }

    try {
      await api.post('/api/assistant-monitoring/reset');
      await fetchDashboardData(); // Refresh data
      alert('Metrics have been reset successfully');
    } catch (err) {
      console.error('Failed to reset metrics:', err);
      alert('Failed to reset metrics. You may not have the required permissions.');
    }
  };

  useEffect(() => {
    fetchDashboardData();

    // Auto-refresh every 30 seconds if enabled
    let interval: NodeJS.Timeout | null = null;
    if (autoRefresh) {
      interval = setInterval(fetchDashboardData, 30000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [fetchDashboardData, autoRefresh]);

  if (!hasPermission('assistant:read') && !hasPermission('platform:admin')) {
    return (
      <DashboardLayout>
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-red-900 dark:text-red-100 mb-2">Access Denied</h2>
            <p className="text-red-700 dark:text-red-300">
              You don&apos;t have permission to view the AI Assistant monitoring dashboard.
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600 dark:text-green-400';
      case 'degraded': return 'text-yellow-600 dark:text-yellow-400';
      case 'unhealthy': return 'text-red-600 dark:text-red-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return '✅';
      case 'degraded': return '⚠️';
      case 'unhealthy': return '❌';
      default: return '❓';
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-6"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-gray-200 dark:bg-gray-700 rounded-lg h-32"></div>
              ))}
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-red-900 dark:text-red-100 mb-2">Error Loading Dashboard</h2>
            <p className="text-red-700 dark:text-red-300 mb-4">{error}</p>
            <button
              onClick={fetchDashboardData}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!dashboardData) {
    return <DashboardLayout><div>No data available</div></DashboardLayout>;
  }

  return (
    <>
      <Head>
        <title>AI Assistant Monitoring - Servio</title>
        <meta name="description" content="Real-time AI assistant performance monitoring" />
      </Head>

      <DashboardLayout>
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                🤖 AI Assistant Monitoring
                <span className={`text-sm px-2 py-1 rounded-full font-medium ${
                  dashboardData.health.status === 'healthy' 
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                    : dashboardData.health.status === 'degraded'
                    ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                    : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                }`}>
                  {getStatusIcon(dashboardData.health.status)} {dashboardData.health.status}
                </span>
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Last updated: {new Date(dashboardData.lastUpdated).toLocaleString()}
              </p>
            </div>
            
            <div className="flex items-center space-x-3">
              <label className="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span>Auto-refresh (30s)</span>
              </label>
              
              <button
                onClick={fetchDashboardData}
                className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
              >
                🔄 Refresh
              </button>
              
              {hasPermission('platform:admin') && (
                <button
                  onClick={resetMetrics}
                  className="px-3 py-1.5 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
                >
                  Reset Metrics
                </button>
              )}
            </div>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Requests</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{dashboardData.kpis.totalRequests.toLocaleString()}</p>
                </div>
                <div className="text-2xl">📊</div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Error Rate</p>
                  <p className={`text-2xl font-bold ${parseFloat(dashboardData.kpis.errorRate) > 5 ? 'text-red-600' : 'text-green-600'}`}>
                    {dashboardData.kpis.errorRate}%
                  </p>
                </div>
                <div className="text-2xl">{parseFloat(dashboardData.kpis.errorRate) > 5 ? '❌' : '✅'}</div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Avg Response</p>
                  <p className={`text-2xl font-bold ${parseInt(dashboardData.kpis.avgResponseTime) > 5000 ? 'text-red-600' : 'text-green-600'}`}>
                    {dashboardData.kpis.avgResponseTime}ms
                  </p>
                </div>
                <div className="text-2xl">⚡</div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Uptime</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{dashboardData.kpis.uptime}</p>
                </div>
                <div className="text-2xl">🕒</div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Active Chats</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{dashboardData.kpis.activeConversations}</p>
                </div>
                <div className="text-2xl">💬</div>
              </div>
            </div>
          </div>

          {/* Processing & Health Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Processing Breakdown */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">🎙️ Processing Breakdown</h3>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-400">Audio Requests:</span>
                  <span className="font-semibold">{dashboardData.processing.audioRequests.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-400">Text Requests:</span>
                  <span className="font-semibold">{dashboardData.processing.textRequests.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-400">Avg Audio Time:</span>
                  <span className="font-semibold">{dashboardData.processing.avgAudioTime}ms</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-400">Avg Text Time:</span>
                  <span className="font-semibold">{dashboardData.processing.avgTextTime}ms</span>
                </div>
              </div>
            </div>

            {/* System Health */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">🏥 System Health Checks</h3>
              </div>
              <div className="p-6 space-y-3">
                {Object.entries(dashboardData.health.checks).map(([check, details]) => (
                  <div key={check} className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-400 capitalize">{check}:</span>
                    <span className={`font-semibold ${getStatusColor(details.status)}`}>
                      {getStatusIcon(details.status)} {details.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Errors & OpenAI Usage */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Error Analysis */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  ❌ Error Analysis ({dashboardData.errors.total} total)
                </h3>
              </div>
              <div className="p-6 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-400">Rate Limit Hits:</span>
                  <span className="font-semibold">{dashboardData.errors.rateLimitHits}</span>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium text-gray-900 dark:text-gray-100">Top Error Types:</h4>
                  {dashboardData.errors.byType.slice(0, 5).map((error, idx) => (
                    <div key={idx} className="flex justify-between items-center text-sm">
                      <span className="text-gray-600 dark:text-gray-400">{error.type}:</span>
                      <span className="font-semibold">{error.count} ({error.percentage}%)</span>
                    </div>
                  ))}
                  {dashboardData.errors.byType.length === 0 && (
                    <p className="text-sm text-green-600 dark:text-green-400">No errors detected! 🎉</p>
                  )}
                </div>
              </div>
            </div>

            {/* OpenAI Usage */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">🧠 OpenAI API Usage</h3>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-400">Total API Calls:</span>
                  <span className="font-semibold">{dashboardData.openaiUsage.totalCalls.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-400">Calls per Request:</span>
                  <span className="font-semibold">{dashboardData.openaiUsage.callsPerRequest}</span>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Includes STT, LLM, and TTS API calls
                </div>
              </div>
            </div>
          </div>

          {/* Alerts & Recommendations */}
          {(dashboardData.alerts.length > 0 || dashboardData.recommendations.length > 0) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Alerts */}
              {dashboardData.alerts.length > 0 && (
                <div className="bg-red-50 dark:bg-red-900/30 rounded-lg shadow border border-red-200 dark:border-red-800">
                  <div className="p-6 border-b border-red-200 dark:border-red-800">
                    <h3 className="text-lg font-semibold text-red-900 dark:text-red-100">🚨 Critical Alerts</h3>
                  </div>
                  <div className="p-6">
                    <ul className="space-y-2">
                      {dashboardData.alerts.map((alert, idx) => (
                        <li key={idx} className="text-red-800 dark:text-red-300 text-sm">• {alert}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Recommendations */}
              {dashboardData.recommendations.length > 0 && (
                <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg shadow border border-blue-200 dark:border-blue-800">
                  <div className="p-6 border-b border-blue-200 dark:border-blue-800">
                    <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100">💡 Recommendations</h3>
                  </div>
                  <div className="p-6">
                    <ul className="space-y-2">
                      {dashboardData.recommendations.map((rec, idx) => (
                        <li key={idx} className="text-blue-800 dark:text-blue-300 text-sm">• {rec}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </DashboardLayout>
    </>
  );
}