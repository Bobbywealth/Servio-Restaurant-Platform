'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  BarChart3, TrendingUp, TrendingDown, DollarSign, Clock, 
  ShoppingBag, CheckCircle, XCircle, AlertCircle, RefreshCw
} from 'lucide-react';
import { api } from '@/lib/api';
import { useUser } from '@/contexts/UserContext';

interface OrderStats {
  todayRevenue: number;
  yesterdayRevenue: number;
  weekRevenue: number;
  monthRevenue: number;
  todayOrders: number;
  yesterdayOrders: number;
  weekOrders: number;
  monthOrders: number;
  avgOrderValue: number;
  ordersByStatus: Record<string, number>;
  ordersByChannel: Record<string, number>;
  hourlyDistribution: Array<{ hour: number; count: number }>;
  recentOrders: Array<{
    id: string;
    external_id?: string;
    channel?: string;
    status: string;
    total_amount?: number;
    customer_name?: string;
    created_at: string;
  }>;
  topItems: Array<{ name: string; count: number; revenue: number }>;
}

type Period = 'today' | 'yesterday' | 'week' | 'month';

const getDayRange = (dateStr: string) => {
  const dayStart = new Date(`${dateStr}T00:00:00`);
  const dayEnd = new Date(`${dateStr}T23:59:59.999`);
  return {
    dateFrom: dayStart.toISOString(),
    dateTo: dayEnd.toISOString()
  };
};

const isOrderInSelectedDay = (createdAt: string, dateStr: string) => {
  if (!createdAt || !dateStr) return false;
  try {
    const orderDate = new Date(createdAt);
    const targetDate = new Date(`${dateStr}T00:00:00`);
    return (
      orderDate.getFullYear() === targetDate.getFullYear() &&
      orderDate.getMonth() === targetDate.getMonth() &&
      orderDate.getDate() === targetDate.getDate()
    );
  } catch {
    return false;
  }
};

const mergeCustomDayAnalytics = (
  baseStats: OrderStats,
  customRevenue: number,
  customOrders: number,
  dateStr: string
): OrderStats => {
  const selectedOrders = (baseStats.recentOrders || []).filter((order) =>
    isOrderInSelectedDay(order.created_at, dateStr)
  );

  const ordersByStatus = selectedOrders.reduce<Record<string, number>>((acc, order) => {
    const key = order.status || 'unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const ordersByChannel = selectedOrders.reduce<Record<string, number>>((acc, order) => {
    const key = String(order.channel || 'unknown').toLowerCase();
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const hourlyMap = selectedOrders.reduce<Record<number, number>>((acc, order) => {
    const hour = new Date(order.created_at).getHours();
    acc[hour] = (acc[hour] || 0) + 1;
    return acc;
  }, {});

  const hourlyDistribution = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    count: hourlyMap[hour] || 0
  }));

  return {
    ...baseStats,
    todayRevenue: customRevenue,
    todayOrders: customOrders,
    avgOrderValue: customOrders > 0 ? customRevenue / customOrders : 0,
    ordersByStatus,
    ordersByChannel,
    hourlyDistribution,
    recentOrders: selectedOrders
  };
};

export function OrderAnalytics({ onRefresh }: { onRefresh?: () => void }) {
  const { user } = useUser();
  const [stats, setStats] = useState<OrderStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period | 'custom'>('today');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTimezone, setSelectedTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  );

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const analyticsParams: Record<string, string> = {
        period,
        tz: selectedTimezone
      };
      if (selectedDate) analyticsParams.date = selectedDate;

      const response = await api.get('/api/orders/analytics', { params: analyticsParams });
      let analyticsData = response.data?.data || null;

      if (analyticsData && selectedDate) {
        const { dateFrom, dateTo } = getDayRange(selectedDate);
        const historyStatsResponse = await api.get('/api/orders/history/stats', {
          params: { dateFrom, dateTo, tz: selectedTimezone }
        });
        const historyStats = historyStatsResponse.data?.data;

        analyticsData = mergeCustomDayAnalytics(
          analyticsData,
          Number(historyStats?.totalRevenue || 0),
          Number(historyStats?.totalOrders || 0),
          selectedDate
        );
      }

      setStats(analyticsData);
    } catch (err) {
      console.error('Failed to fetch order stats:', err);
      setError('Failed to load analytics');
      // Set zeroed data so UI shows real state, not fake numbers
      setStats({
        todayRevenue: 0,
        yesterdayRevenue: 0,
        weekRevenue: 0,
        monthRevenue: 0,
        todayOrders: 0,
        yesterdayOrders: 0,
        weekOrders: 0,
        monthOrders: 0,
        avgOrderValue: 0,
        ordersByStatus: {},
        ordersByChannel: {},
        hourlyDistribution: [],
        recentOrders: [],
        topItems: []
      });
    } finally {
      setLoading(false);
    }
  }, [period, selectedDate, selectedTimezone]);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 60000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  // Get data based on selected period
  const getPeriodData = () => {
    if (!stats) return { revenue: 0, orders: 0 };
    switch (period) {
      case 'today': return { revenue: stats.todayRevenue, orders: stats.todayOrders };
      case 'yesterday': return { revenue: stats.yesterdayRevenue, orders: stats.yesterdayOrders };
      case 'week': return { revenue: stats.weekRevenue, orders: stats.weekOrders };
      case 'month': return { revenue: stats.monthRevenue, orders: stats.monthOrders };
      case 'custom': return { revenue: stats.todayRevenue, orders: stats.todayOrders };
      default: return { revenue: stats.todayRevenue, orders: stats.todayOrders };
    }
  };

  const formatDateForLabel = (dateStr?: string) => {
    if (!dateStr) return '';
    const parsed = new Date(`${dateStr}T00:00:00`);
    return parsed.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: selectedTimezone
    });
  };

  const metricSubLabel = period === 'custom' && selectedDate
    ? `${formatDateForLabel(selectedDate)} (${selectedTimezone})`
    : period === 'today'
      ? 'Today'
      : period === 'week'
        ? 'This week'
        : period === 'month'
          ? 'This month'
          : 'Yesterday';

  const { revenue, orders } = getPeriodData();
  const completedOrders = stats?.ordersByStatus?.completed || 0;
  const cancelledOrders = stats?.ordersByStatus?.cancelled || 0;
  const totalOrdersAll = Object.values(stats?.ordersByStatus || {}).reduce((a, b) => a + b, 0);

  const statusConfig: Record<string, { label: string; color: string }> = {
    received: { label: 'Received', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' },
    preparing: { label: 'Preparing', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
    ready: { label: 'Ready', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
    completed: { label: 'Completed', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300' },
    cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' }
  };

  const channelConfig: Record<string, { label: string; color: string }> = {
    phone: { label: 'Phone', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400' },
    vapi: { label: 'AI Phone', color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400' },
    online: { label: 'Online', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
    doordash: { label: 'DoorDash', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
    grubhub: { label: 'Grubhub', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' },
    ubereats: { label: 'UberEats', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' }
  };

  const maxHourOrders = Math.max(...(stats?.hourlyDistribution?.map(h => h.count) || [1]));
  const maxChannelOrders = Math.max(...Object.values(stats?.ordersByChannel || {}));

  if (loading && !stats) {
    return (
      <div className="card p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card p-6 space-y-6">
      {/* Header with period selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary-600 dark:text-primary-400" />
          <h2 className="text-lg font-semibold text-surface-900 dark:text-white">
            Order Analytics
          </h2>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            {(['today', 'yesterday', 'week', 'month'] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => {
                  setPeriod(p);
                  setSelectedDate('');
                }}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  period === p 
                    ? 'bg-white dark:bg-gray-700 text-primary-600 dark:text-primary-400 shadow-sm' 
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>

          <input
            type="date"
            value={selectedDate}
            onChange={(e) => {
              const nextDate = e.target.value;
              setSelectedDate(nextDate);
              setPeriod(nextDate ? 'custom' : 'today');
            }}
            className="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-surface-900 dark:text-surface-100"
            aria-label="Filter analytics by date"
          />
          
          <button
            onClick={() => { fetchStats(); onRefresh?.(); }}
            className="btn-secondary py-2 px-3"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          icon={<DollarSign className="w-5 h-5" />}
          label="Revenue"
          value={`$${revenue.toLocaleString()}`}
          subValue={metricSubLabel}
          color="green"
        />
        <MetricCard
          icon={<ShoppingBag className="w-5 h-5" />}
          label="Orders"
          value={orders}
          subValue={`${stats?.avgOrderValue ? '$' + stats.avgOrderValue.toFixed(2) : '$0'} avg · ${metricSubLabel}`}
          color="blue"
        />
        <MetricCard
          icon={<CheckCircle className="w-5 h-5" />}
          label="Completion Rate"
          value={`${totalOrdersAll ? ((completedOrders / totalOrdersAll) * 100).toFixed(1) : 0}%`}
          subValue={`${completedOrders} completed`}
          color="green"
        />
        <MetricCard
          icon={<XCircle className="w-5 h-5" />}
          label="Cancelled"
          value={cancelledOrders}
          subValue={`${totalOrdersAll ? ((cancelledOrders / totalOrdersAll) * 100).toFixed(1) : 0}% of total`}
          color="red"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Orders by Status */}
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-surface-700 dark:text-surface-300 mb-4">
            Orders by Status
          </h3>
          <div className="space-y-3">
            {Object.entries(stats?.ordersByStatus || {}).map(([status, count]) => {
              const config = statusConfig[status] || { label: status, color: 'bg-gray-100 text-gray-800' };
              const percentage = totalOrdersAll ? ((count / totalOrdersAll) * 100).toFixed(1) : 0;
              
              return (
                <div key={status} className="flex items-center gap-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${config.color}`}>
                    {config.label}
                  </span>
                  <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        status === 'completed' ? 'bg-green-500' :
                        status === 'cancelled' ? 'bg-red-500' :
                        status === 'preparing' ? 'bg-blue-500' :
                        status === 'ready' ? 'bg-green-400' :
                        'bg-amber-500'
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-surface-700 dark:text-surface-300 w-12 text-right">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Orders by Channel */}
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-surface-700 dark:text-surface-300 mb-4">
            Orders by Channel
          </h3>
          <div className="space-y-3">
            {Object.entries(stats?.ordersByChannel || {}).map(([channel, count]) => {
              const config = channelConfig[channel.toLowerCase()] || { label: channel, color: 'bg-gray-100 text-gray-800' };
              const percentage = maxChannelOrders ? ((count / maxChannelOrders) * 100).toFixed(0) : 0;
              
              return (
                <div key={channel} className="flex items-center gap-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${config.color}`}>
                    {config.label}
                  </span>
                  <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary-500 rounded-full transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-surface-700 dark:text-surface-300 w-12 text-right">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Hourly Distribution */}
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-surface-700 dark:text-surface-300 mb-4">
          Orders by Hour ({period === 'custom' && selectedDate ? `${formatDateForLabel(selectedDate)} · ${selectedTimezone}` : 'Today'})
        </h3>
        <div className="flex items-end gap-1 h-32">
          {(stats?.hourlyDistribution || []).map(({ hour, count }) => {
            const height = maxHourOrders > 0 ? (count / maxHourOrders) * 100 : 0;
            const isPeak = height > 70;
            
            return (
              <div key={hour} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className={`w-full rounded-t transition-all duration-300 ${
                    isPeak 
                      ? 'bg-primary-500 dark:bg-primary-400' 
                      : 'bg-primary-300 dark:bg-primary-600'
                  }`}
                  style={{ height: `${Math.max(height, 5)}%` }}
                  title={`${hour}:00 - ${count} orders`}
                />
                {hour % 3 === 0 && (
                  <span className="text-[10px] text-surface-500 dark:text-surface-400">
                    {hour}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Top Items & Recent Orders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Items */}
        {(stats?.topItems?.length || 0) > 0 && (
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-surface-700 dark:text-surface-300 mb-4">
              Top Selling Items
            </h3>
            <div className="space-y-3">
              {stats?.topItems?.slice(0, 5).map((item, index) => (
                <div key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-primary-600 dark:text-primary-400">
                      #{index + 1}
                    </span>
                    <div>
                      <div className="text-sm font-medium text-surface-900 dark:text-white">
                        {item.name}
                      </div>
                      <div className="text-xs text-surface-500 dark:text-surface-400">
                        {item.count} sold
                      </div>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-surface-700 dark:text-surface-300">
                    ${item.revenue.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Orders Table */}
        <div className="overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-surface-700 dark:text-surface-300">
              Recent Orders
            </h3>
            <button className="text-sm text-primary-600 dark:text-primary-400 hover:underline">
              View All →
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 px-2 font-medium text-surface-500 dark:text-surface-400">Order</th>
                  <th className="text-left py-2 px-2 font-medium text-surface-500 dark:text-surface-400">Status</th>
                  <th className="text-right py-2 px-2 font-medium text-surface-500 dark:text-surface-400">Total</th>
                </tr>
              </thead>
              <tbody>
                {(stats?.recentOrders || []).slice(0, 5).map((order) => {
                  const statusConf = statusConfig[order.status] || { label: order.status, color: 'bg-gray-100 text-gray-800' };
                  
                  return (
                    <tr key={order.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="py-2 px-2 font-medium text-surface-900 dark:text-white">
                        #{order.external_id || order.id.slice(0, 8)}
                      </td>
                      <td className="py-2 px-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${statusConf.color}`}>
                          {order.status === 'completed' && <CheckCircle className="w-3 h-3" />}
                          {order.status === 'cancelled' && <XCircle className="w-3 h-3" />}
                          {statusConf.label}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-right font-medium text-surface-900 dark:text-white">
                        ${Number(order.total_amount || 0).toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subValue?: string;
  color: 'green' | 'blue' | 'red' | 'amber';
}

function MetricCard({ icon, label, value, subValue, color }: MetricCardProps) {
  const colorClasses = {
    green: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400',
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
    red: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400',
    amber: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'
  };

  return (
    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
          {icon}
        </div>
      </div>
      <div className="text-2xl font-bold text-surface-900 dark:text-white">
        {value}
      </div>
      <div className="text-sm text-surface-600 dark:text-surface-400">
        {label}
      </div>
      {subValue && (
        <div className="text-xs text-surface-500 dark:text-surface-500 mt-1">
          {subValue}
        </div>
      )}
    </div>
  );
}
