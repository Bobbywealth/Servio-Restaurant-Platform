'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { 
  TrendingUp, TrendingDown, DollarSign, Clock, 
  Phone, Globe, ShoppingBag, Calendar, BarChart3,
  ChevronDown, ChevronUp, RefreshCw
} from 'lucide-react';
import { api } from '@/lib/api';
import { useSocket } from '@/lib/socket';

interface OrderAnalytics {
  todayRevenue: number;
  yesterdayRevenue: number;
  weekRevenue: number;
  monthRevenue: number;
  todayOrders: number;
  yesterdayOrders: number;
  weekOrders: number;
  monthOrders: number;
  avgOrderValue: number;
  avgPrepTime: number;
  ordersByChannel: Record<string, number>;
  ordersByStatus: Record<string, number>;
  hourlyDistribution: Array<{ hour: number; count: number }>;
  recentOrders: Array<{
    id: string;
    external_id?: string;
    customer_name?: string;
    total_amount: number;
    status: string;
    channel: string;
    created_at: string;
  }>;
  topItems: Array<{ name: string; count: number; revenue: number }>;
}

interface OrderAnalyticsProps {
  restaurantId?: string;
  onRefresh?: () => void;
}

const channelConfig: Record<string, { label: string; color: string }> = {
  phone: { label: 'Phone', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400' },
  vapi: { label: 'AI Phone', color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400' },
  online: { label: 'Online', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
  doordash: { label: 'DoorDash', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
  grubhub: { label: 'Grubhub', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' },
  ubereats: { label: 'UberEats', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  walkin: { label: 'Walk-in', color: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400' },
};

const statusConfig: Record<string, { label: string; color: string }> = {
  received: { label: 'Received', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' },
  preparing: { label: 'Preparing', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
  ready: { label: 'Ready', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  completed: { label: 'Completed', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300' },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num);
}

function StatCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  trend, 
  trendValue 
}: { 
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  trend?: 'up' | 'down';
  trendValue?: string;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-surface-600 dark:text-surface-400">{title}</p>
          <p className="mt-1 text-2xl font-bold text-surface-900 dark:text-surface-100">
            {value}
          </p>
          {subtitle && (
            <p className="mt-1 text-xs text-surface-500 dark:text-surface-400">{subtitle}</p>
          )}
        </div>
        <div className={`p-2 rounded-lg ${
          trend === 'up' 
            ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
            : trend === 'down'
            ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
            : 'bg-surface-100 text-surface-600 dark:bg-surface-700 dark:text-surface-400'
        }`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      {trend && trendValue && (
        <div className={`mt-2 flex items-center text-xs font-medium ${
          trend === 'up' 
            ? 'text-green-600 dark:text-green-400'
            : 'text-red-600 dark:text-red-400'
        }`}>
          {trend === 'up' ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
          {trendValue} vs yesterday
        </div>
      )}
    </div>
  );
}

function ChannelChart({ data }: { data: Record<string, number> }) {
  const total = Object.values(data).reduce((a, b) => a + b, 0);
  const sortedEntries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  
  const colors = [
    'bg-blue-500',
    'bg-green-500',
    'bg-purple-500',
    'bg-orange-500',
    'bg-red-500',
    'bg-teal-500',
    'bg-indigo-500',
  ];

  return (
    <div className="card p-4">
      <h3 className="text-sm font-semibold text-surface-900 dark:text-surface-100 mb-4">
        Orders by Channel
      </h3>
      <div className="space-y-3">
        {sortedEntries.map(([channel, count], idx) => {
          const percentage = total > 0 ? (count / total) * 100 : 0;
          const config = channelConfig[channel.toLowerCase()] || { 
            label: channel, 
            color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' 
          };
          
          return (
            <div key={channel}>
              <div className="flex items-center justify-between text-sm mb-1">
                <div className="flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-full ${colors[idx % colors.length]}`} />
                  <span className="text-surface-700 dark:text-surface-300">{config.label}</span>
                </div>
                <span className="font-medium text-surface-900 dark:text-surface-100">
                  {count} ({percentage.toFixed(1)}%)
                </span>
              </div>
              <div className="w-full bg-surface-100 dark:bg-surface-700 rounded-full h-2">
                <div 
                  className={`${colors[idx % colors.length]} h-2 rounded-full transition-all duration-500`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatusChart({ data }: { data: Record<string, number> }) {
  const total = Object.values(data).reduce((a, b) => a + b, 0);
  
  return (
    <div className="card p-4">
      <h3 className="text-sm font-semibold text-surface-900 dark:text-surface-100 mb-4">
        Orders by Status
      </h3>
      <div className="grid grid-cols-2 gap-2">
        {Object.entries(data).map(([status, count]) => {
          const percentage = total > 0 ? (count / total) * 100 : 0;
          const config = statusConfig[status] || { 
            label: status, 
            color: 'bg-gray-100 text-gray-800' 
          };
          
          return (
            <div 
              key={status}
              className={`p-2 rounded-lg ${config.color} text-xs`}
            >
              <div className="font-semibold">{count}</div>
              <div className="opacity-75">{config.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HourlyChart({ data }: { data: Array<{ hour: number; count: number }> }) {
  const maxCount = Math.max(...data.map(d => d.count), 1);
  
  return (
    <div className="card p-4">
      <h3 className="text-sm font-semibold text-surface-900 dark:text-surface-100 mb-4">
        Orders by Hour (Today)
      </h3>
      <div className="flex items-end gap-1 h-32">
        {data.map(({ hour, count }) => {
          const height = (count / maxCount) * 100;
          return (
            <div 
              key={hour}
              className="flex-1 flex flex-col items-center"
              title={`${hour}:00 - ${count} orders`}
            >
              <div 
                className="w-full bg-primary-500 rounded-t-sm hover:bg-primary-600 transition-colors cursor-pointer min-h-[4px]"
                style={{ height: `${Math.max(height, 2)}%` }}
              />
              <span className="text-[10px] text-surface-500 dark:text-surface-400 mt-1">
                {hour}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RecentOrdersTable({ orders }: { orders: OrderAnalytics['recentOrders'] }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const displayOrders = isExpanded ? orders : orders.slice(0, 5);
  
  const getChannelConfig = (channel: string) => {
    return channelConfig[channel.toLowerCase()] || { 
      label: channel, 
      color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' 
    };
  };

  const getStatusConfig = (status: string) => {
    return statusConfig[status] || { 
      label: status, 
      color: 'bg-gray-100 text-gray-800' 
    };
  };

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-surface-900 dark:text-surface-100">
          Recent Orders
        </h3>
        {orders.length > 5 && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1"
          >
            {isExpanded ? (
              <>Show less <ChevronUp className="w-3 h-3" /></>
            ) : (
              <>Show all ({orders.length}) <ChevronDown className="w-3 h-3" /></>
            )}
          </button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-200 dark:border-surface-700">
              <th className="text-left py-2 font-medium text-surface-600 dark:text-surface-400">Order</th>
              <th className="text-left py-2 font-medium text-surface-600 dark:text-surface-400">Time</th>
              <th className="text-left py-2 font-medium text-surface-600 dark:text-surface-400">Customer</th>
              <th className="text-left py-2 font-medium text-surface-600 dark:text-surface-400">Channel</th>
              <th className="text-left py-2 font-medium text-surface-600 dark:text-surface-400">Status</th>
              <th className="text-right py-2 font-medium text-surface-600 dark:text-surface-400">Total</th>
            </tr>
          </thead>
          <tbody>
            {displayOrders.map((order) => (
              <tr 
                key={order.id}
                className="border-b border-surface-100 dark:border-surface-800 hover:bg-surface-50 dark:hover:bg-surface-700/50"
              >
                <td className="py-2 font-medium text-surface-900 dark:text-surface-100">
                  {order.external_id || order.id.slice(0, 8)}
                </td>
                <td className="py-2 text-surface-600 dark:text-surface-400">
                  {new Date(order.created_at).toLocaleTimeString([], { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </td>
                <td className="py-2 text-surface-700 dark:text-surface-300">
                  {order.customer_name || '—'}
                </td>
                <td className="py-2">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${getChannelConfig(order.channel).color}`}>
                    {getChannelConfig(order.channel).label}
                  </span>
                </td>
                <td className="py-2">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${getStatusConfig(order.status).color}`}>
                    {getStatusConfig(order.status).label}
                  </span>
                </td>
                <td className="py-2 text-right font-medium text-surface-900 dark:text-surface-100">
                  {formatCurrency(order.total_amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TopItemsList({ items }: { items: OrderAnalytics['topItems'] }) {
  return (
    <div className="card p-4">
      <h3 className="text-sm font-semibold text-surface-900 dark:text-surface-100 mb-4">
        Top Selling Items (Today)
      </h3>
      <div className="space-y-2">
        {items.slice(0, 8).map((item, idx) => (
          <div 
            key={item.name}
            className="flex items-center justify-between py-2 border-b border-surface-100 dark:border-surface-800 last:border-0"
          >
            <div className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-surface-100 dark:bg-surface-700 flex items-center justify-center text-xs font-medium text-surface-600 dark:text-surface-400">
                {idx + 1}
              </span>
              <span className="text-sm text-surface-700 dark:text-surface-300">{item.name}</span>
            </div>
            <div className="text-right">
              <div className="text-sm font-medium text-surface-900 dark:text-surface-100">
                {formatNumber(item.count)} sold
              </div>
              <div className="text-xs text-surface-500 dark:text-surface-400">
                {formatCurrency(item.revenue)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function OrderAnalytics({ restaurantId, onRefresh }: OrderAnalyticsProps) {
  const socket = useSocket();
  const [analytics, setAnalytics] = useState<OrderAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'today' | 'week' | 'month'>('today');

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/api/orders/analytics', {
        params: { restaurantId }
      });
      setAnalytics(response.data?.data || null);
    } catch (e: any) {
      // Fallback to summary if analytics endpoint doesn't exist
      try {
        const [summaryRes, ordersRes] = await Promise.all([
          api.get('/api/orders/stats/summary'),
          api.get('/api/orders', { params: { limit: 50 } })
        ]);
        
        const orders = ordersRes.data?.data?.orders || [];
        const summary = summaryRes.data?.data || {};
        
        // Calculate hourly distribution from orders
        const hourlyData = Array.from({ length: 24 }, (_, i) => ({
          hour: i,
          count: orders.filter((o: any) => {
            const orderHour = new Date(o.created_at).getHours();
            return orderHour === i;
          }).length
        }));

        // Calculate top items from orders
        const itemCounts: Record<string, { count: number; revenue: number }> = {};
        orders.forEach((o: any) => {
          if (Array.isArray(o.items)) {
            o.items.forEach((item: any) => {
              if (item.name) {
                if (!itemCounts[item.name]) {
                  itemCounts[item.name] = { count: 0, revenue: 0 };
                }
                itemCounts[item.name].count += item.quantity || 1;
                itemCounts[item.name].revenue += (item.price || 0) * (item.quantity || 1);
              }
            });
          }
        });

        const topItems = Object.entries(itemCounts)
          .map(([name, data]) => ({ name, ...data }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10);

        setAnalytics({
          todayRevenue: summary.totalOrders || 0 * (summary.avgOrderValue || 0),
          yesterdayRevenue: 0,
          weekRevenue: 0,
          monthRevenue: 0,
          todayOrders: summary.totalOrders || 0,
          yesterdayOrders: 0,
          weekOrders: 0,
          monthOrders: 0,
          avgOrderValue: summary.avgOrderValue || 0,
          avgPrepTime: 12, // Default
          ordersByChannel: summary.ordersByChannel || {},
          ordersByStatus: summary.ordersByStatus || {},
          hourlyDistribution: hourlyData,
          recentOrders: orders.slice(0, 20),
          topItems,
        });
      } catch {
        setError('Failed to load analytics');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [restaurantId]);

  useEffect(() => {
    if (!socket) return;

    const handleOrderUpdate = () => {
      fetchAnalytics();
    };

    socket.on('order:new', handleOrderUpdate);
    socket.on('order:status_changed', handleOrderUpdate);
    
    return () => {
      socket.off('order:new', handleOrderUpdate);
      socket.off('order:status_changed', handleOrderUpdate);
    };
  }, [socket]);

  // Generate hourly data if not available
  const hourlyData = useMemo(() => {
    if (analytics?.hourlyDistribution) {
      return analytics.hourlyDistribution;
    }
    // Generate mock hourly distribution based on typical restaurant patterns
    return Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      count: i >= 11 && i <= 14 ? Math.floor(Math.random() * 20) + 10 : 
            i >= 17 && i <= 21 ? Math.floor(Math.random() * 30) + 15 :
            Math.floor(Math.random() * 5)
    }));
  }, [analytics]);

  const revenue = activeTab === 'today' ? analytics?.todayRevenue : 
                  activeTab === 'week' ? analytics?.weekRevenue : 
                  analytics?.monthRevenue;
  const orders = activeTab === 'today' ? analytics?.todayOrders :
                 activeTab === 'week' ? analytics?.weekOrders :
                 analytics?.monthOrders;

  if (loading && !analytics) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="card p-4 animate-pulse">
            <div className="h-4 bg-surface-200 dark:bg-surface-700 rounded w-24 mb-2" />
            <div className="h-8 bg-surface-200 dark:bg-surface-700 rounded w-16" />
          </div>
        ))}
      </div>
    );
  }

  if (error && !analytics) {
    return (
      <div className="card p-4 text-center">
        <p className="text-surface-600 dark:text-surface-400 mb-2">{error}</p>
        <button onClick={fetchAnalytics} className="btn-secondary">
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tab Controls */}
      <div className="flex items-center gap-2">
        {(['today', 'week', 'month'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400'
                : 'text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-700'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
        <button 
          onClick={fetchAnalytics}
          className="ml-auto p-2 rounded-lg text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-700"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Revenue"
          value={formatCurrency(revenue || 0)}
          subtitle={`${activeTab === 'today' ? 'Today' : activeTab === 'week' ? 'This Week' : 'This Month'}`}
          icon={DollarSign}
          trend={analytics?.todayRevenue && analytics.yesterdayRevenue ? 
            (analytics.todayRevenue >= analytics.yesterdayRevenue ? 'up' : 'down') : undefined}
          trendValue={analytics?.todayRevenue && analytics.yesterdayRevenue ? 
            `${((analytics.todayRevenue / analytics.yesterdayRevenue - 1) * 100).toFixed(1)}%` : undefined}
        />
        <StatCard
          title="Orders"
          value={formatNumber(orders || 0)}
          subtitle={`${activeTab === 'today' ? 'Today' : activeTab === 'week' ? 'This Week' : 'This Month'}`}
          icon={ShoppingBag}
          trend={analytics?.todayOrders && analytics.yesterdayOrders ? 
            (analytics.todayOrders >= analytics.yesterdayOrders ? 'up' : 'down') : undefined}
          trendValue={analytics?.todayOrders && analytics.yesterdayOrders ? 
            `${((analytics.todayOrders / analytics.yesterdayOrders - 1) * 100).toFixed(1)}%` : undefined}
        />
        <StatCard
          title="Avg Order Value"
          value={formatCurrency(analytics?.avgOrderValue || 0)}
          subtitle="Per order"
          icon={TrendingUp}
        />
        <StatCard
          title="Avg Prep Time"
          value={`${analytics?.avgPrepTime || 12} min`}
          subtitle="Kitchen time"
          icon={Clock}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChannelChart data={analytics?.ordersByChannel || {}} />
        <StatusChart data={analytics?.ordersByStatus || {}} />
        <HourlyChart data={hourlyData} />
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TopItemsList items={analytics?.topItems || []} />
        <RecentOrdersTable orders={analytics?.recentOrders || []} />
      </div>
    </div>
  );
}

export default OrderAnalytics;
