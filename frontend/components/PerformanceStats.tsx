'use client';

import React from 'react';
import { Activity, Zap, Cpu, Network, Database, DatabaseBackup } from 'lucide-react';

export function PerformanceStats() {
  const [metrics, setMetrics] = useState({
    firstContentfulPaint: 0,
    largestContentfulPaint: 0,
    timeToInteractive: 0,
    layoutShift: 0,
    cumulativeLayoutShift: 0,
  });

  useEffect(() => {
    if ('PerformanceObserver' in window) {
      // Measure First Contentful Paint
      const fcpObserver = new PerformanceObserver((entries) => {
        const entry = entries[0] as PerformanceMetricEntry;
        setMetrics((prev) => ({ ...prev, firstContentfulPaint: entry.startTime }));
      });
      fcpObserver.observe({ entryTypes: ['paint'] });

      // Measure Largest Contentful Paint
      const lcpObserver = new PerformanceObserver((entries) => {
        const entry = entries[0] as PerformanceMetricEntry;
        setMetrics((prev) => ({ ...prev, largestContentfulPaint: entry.startTime }));
      });
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

      // Measure Layout Shift
      let clsScore = 0;
      const clsObserver = new PerformanceObserver((entries) => {
        entries.forEach((entry) => {
          clsScore += entry.value;
        });
        setMetrics((prev) => ({ ...prev, cumulativeLayoutShift: clsScore }));
      });
      clsObserver.observe({ entryTypes: ['layout-shift'] });

      return () => {
        fcpObserver.disconnect();
        lcpObserver.disconnect();
        clsObserver.disconnect();
      };
    }
  }, []);

  const performanceScore = useMemo(() => {
    const weightedScore =
      metrics.firstContentfulPaint * 2 +
      metrics.largestContentfulPaint * 3 +
      metrics.cumulativeLayoutShift * 5;
    return Math.max(0, Math.min(100, 100 - weightedScore / 1000));
  }, [metrics]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Activity className="h-5 w-5 text-[var(--tablet-accent)]" />
        <h3 className="text-lg font-semibold">Performance Stats</h3>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <StatCard
          icon={<Zap className="h-4 w-4" />}
          label="FCP"
          value={`${metrics.firstContentfulPaint.toFixed(0)}ms`}
          good={metrics.firstContentfulPaint < 1000}
        />
        <StatCard
          icon={<Cpu className="h-4 w-4" />}
          label="LCP"
          value={`${metrics.largestContentfulPaint.toFixed(0)}ms`}
          good={metrics.largestContentfulPaint < 2500}
        />
        <StatCard
          icon={<Network className="h-4 w-4" />}
          label="CLS"
          value={metrics.cumulativeLayoutShift.toFixed(3)}
          good={metrics.cumulativeLayoutShift < 0.1}
        />
        <StatCard
          icon={<DatabaseBackup className="h-4 w-4" />}
          label="Layout Shift"
          value={metrics.layoutShift.toFixed(3)}
          good={metrics.layoutShift < 0.1}
        />
      </div>

      <div className="bg-[var(--tablet-surface)] border border-[var(--tablet-border)] rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold">Performance Score</span>
          <span className={`text-lg font-bold ${performanceScore >= 70 ? 'text-green-500' : 'text-red-500'}`}>
            {performanceScore.toFixed(0)}/100
          </span>
        </div>
        <div className="h-3 bg-[var(--tablet-border)] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              performanceScore >= 70 ? 'bg-green-500' : performanceScore >= 50 ? 'bg-yellow-500' : 'bg-red-500'
            }`}
            style={{ width: `${performanceScore}%` }}
          />
        </div>
      </div>
    </div>
  );
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  good: boolean;
}

function StatCard({ icon, label, value, good }: StatCardProps) {
  return (
    <div
      className={`p-3 rounded-xl border ${
        good ? 'bg-[var(--tablet-surface)]' : 'bg-[var(--tablet-border-strong)]'
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-xs font-semibold text-[var(--tablet-muted)]">{label}</span>
      </div>
      <div
        className={`text-lg font-bold ${
          good ? 'text-[var(--tablet-text)]' : 'text-red-500'
        }`}
      >
        {value}
      </div>
    </div>
  );
}
