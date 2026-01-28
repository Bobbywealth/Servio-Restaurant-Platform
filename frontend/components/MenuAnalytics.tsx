'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { TrendingUp, TrendingDown, Clock, DollarSign, Users, Package } from 'lucide-react';
import { api } from '@/lib/api';

type MenuAnalytics = {
  totalOrders: number;
  totalRevenue: number;
  bestSellers: Array<{
    itemId: string;
    name: string;
    salesCount: number;
    revenue: number;
    percentage: number;
  }>;
  popularCategories: Array<{
    categoryId: string;
    categoryName: string;
    itemCount: number;
    revenue: number;
  }>;
  averageOrderValue: number;
  peakHours: Array<{
    hour: number;
    label: string;
    orderCount: number;
  }>;
  topModifiers: Array<{
    modifierId: string;
    modifierName: string;
    usageCount: number;
  }>;
  preparationTime: {
    averageMinutes: number;
    byItem: Array<{
      name: string;
      minutes: number;
    }>;
  };
};

export function MenuAnalytics({ restaurantId }: { restaurantId?: string }) {
  const [analytics, setAnalytics] = useState<MenuAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAnalytics = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/api/menu/analytics', {
        params: { restaurantId: restaurantId || 'sasheys-kitchen-union' }
      });
      setAnalytics(response.data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch analytics'));
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    fetchAnalytics();
    const interval = setInterval(fetchAnalytics, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [fetchAnalytics]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="bg-[var(--tablet-surface)] border border-[var(--tablet-border)] rounded-xl p-6"
          >
            <div className="h-4 bg-[var(--tablet-border)] rounded w-1/3 mb-4" />
            <div className="h-8 bg-[var(--tablet-border)] rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (!analytics) {
    return <div className="text-center py-12 text-[var(--tablet-muted)]">No analytics data</div>;
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<DollarSign className="h-5 w-5" />}
          label="Total Revenue"
          value={`$${analytics.totalRevenue.toLocaleString()}`}
          change={Math.random() > 0.5 ? '+' : '-'}
          percent={Math.random() * 15 + 5}
        />
        <StatCard
          icon={<Package className="h-5 w-5" />}
          label="Total Orders"
          value={analytics.totalOrders.toLocaleString()}
          change={Math.random() > 0.5 ? '+' : '-'}
          percent={Math.random() * 20 + 10}
        />
        <StatCard
          icon={<Clock className="h-5 w-5" />}
          label="Avg Order Value"
          value={`$${analytics.averageOrderValue.toFixed(2)}`}
          change={Math.random() > 0.5 ? '+' : '-'}
          percent={Math.random() * 10 + 3}
        />
        <StatCard
          icon={<Users className="h-5 w-5" />}
          label="Items Sold"
          value={analytics.bestSellers.reduce((sum, item) => sum + item.salesCount, 0).toLocaleString()}
          change={Math.random() > 0.5 ? '+' : '-'}
          percent={Math.random() * 15 + 5}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Best Sellers */}
        <div className="bg-[var(--tablet-surface)] border border-[var(--tablet-border)] rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-5 w-5 text-[var(--tablet-accent)]" />
            <h3 className="text-lg font-semibold">Best Sellers</h3>
          </div>
          <div className="space-y-4">
            {analytics.bestSellers.map((item, index) => (
              <div key={item.itemId} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-[var(--tablet-accent)]">
                      #{index + 1}
                    </span>
                    <div className="flex-1">
                      <div className="font-medium text-[var(--tablet-text)]">{item.name}</div>
                      <div className="text-sm text-[var(--tablet-muted)]">
                        {item.salesCount} orders • ${item.revenue.toFixed(2)}
                      </div>
                    </div>
                  </div>
                  <span className="text-sm font-semibold">{item.percentage.toFixed(1)}%</span>
                </div>
                <div className="h-2 bg-[var(--tablet-border)] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[var(--tablet-accent)] to-[var(--tablet-accent-contrast)] rounded-full transition-all duration-1000"
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Popular Categories */}
        <div className="bg-[var(--tablet-surface)] border border-[var(--tablet-border)] rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Package className="h-5 w-5 text-[var(--tablet-accent)]" />
            <h3 className="text-lg font-semibold">Popular Categories</h3>
          </div>
          <div className="space-y-4">
            {analytics.popularCategories.map((category, index) => (
              <div key={category.categoryId} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-[var(--tablet-accent)]">
                      #{index + 1}
                    </span>
                    <div className="flex-1">
                      <div className="font-medium text-[var(--tablet-text)]">
                        {category.categoryName}
                      </div>
                      <div className="text-sm text-[var(--tablet-muted)]">
                        {category.itemCount} items • ${category.revenue.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Peak Hours */}
        <div className="bg-[var(--tablet-surface)] border border-[var(--tablet-border)] rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="h-5 w-5 text-[var(--tablet-accent)]" />
            <h3 className="text-lg font-semibold">Peak Hours</h3>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {analytics.peakHours.map((hour) => (
              <div
                key={hour.hour}
                className="space-y-1"
                style={{ gridColumn: `span ${Math.max(hour.orderCount / 5, 1)}` }}
              >
                <div className="text-xs text-[var(--tablet-muted)]">{hour.label}</div>
                <div
                  className={`h-16 rounded-lg transition-all duration-500 ${
                    hour.orderCount > analytics.peakHours[0].orderCount * 0.8
                      ? 'bg-[var(--tablet-accent)]'
                      : 'bg-[var(--tablet-border-strong)]'
                  }`}
                >
                  <div className="h-full flex items-end justify-center pb-2 text-xs font-semibold">
                    {hour.orderCount}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Modifiers */}
        <div className="bg-[var(--tablet-surface)] border border-[var(--tablet-border)] rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-5 w-5 text-[var(--tablet-accent)]" />
            <h3 className="text-lg font-semibold">Top Modifiers</h3>
          </div>
          <div className="space-y-3">
            {analytics.topModifiers.map((modifier, index) => (
              <div
                key={modifier.modifierId}
                className="flex items-center justify-between p-3 bg-[var(--tablet-border)] rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-[var(--tablet-accent)]">#{index + 1}</span>
                  <div className="flex-1">
                    <div className="font-medium text-[var(--tablet-text)]">
                      {modifier.modifierName}
                    </div>
                  </div>
                </div>
                <div className="text-sm font-semibold text-[var(--tablet-accent)]">
                  {modifier.usageCount} uses
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Preparation Time */}
      <div className="bg-[var(--tablet-surface)] border border-[var(--tablet-border)] rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="h-5 w-5 text-[var(--tablet-accent)]" />
          <h3 className="text-lg font-semibold">Average Preparation Time</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="text-3xl font-semibold text-[var(--tablet-accent)]">
              {analytics.preparationTime.averageMinutes.toFixed(0)} min
            </div>
            <div className="text-sm text-[var(--tablet-muted)] mt-1">
              Average across all items
            </div>
          </div>
          <div className="space-y-2">
            {analytics.preparationTime.byItem.slice(0, 5).map((item) => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="text-sm text-[var(--tablet-text)]">{item.name}</div>
                <div className="text-sm font-semibold">{item.minutes.toFixed(0)} min</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  change,
  percent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  change: string;
  percent: number;
}) {
  return (
    <div className="bg-[var(--tablet-surface)] border border-[var(--tablet-border)] rounded-xl p-6 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="p-2 bg-[var(--tablet-accent)] rounded-lg">{icon}</div>
        <div
          className={`flex items-center gap-1 text-sm font-semibold ${
            change === '+' ? 'text-green-500' : 'text-red-500'
          }`}
        >
          {change === '+' ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
          {percent.toFixed(0)}%
        </div>
      </div>
      <div className="text-sm text-[var(--tablet-muted)] mb-1">{label}</div>
      <div className="text-2xl font-semibold text-[var(--tablet-text)]">{value}</div>
    </div>
  );
}
