// LIGHTNING FAST PERFORMANCE MONITORING AND WEB VITALS
export interface PerformanceMetrics {
  lcp?: number;     // Largest Contentful Paint
  fid?: number;     // First Input Delay  
  cls?: number;     // Cumulative Layout Shift
  fcp?: number;     // First Contentful Paint
  ttfb?: number;    // Time to First Byte
}

export interface CustomMetrics {
  [key: string]: number;
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics = {};
  private customMetrics: CustomMetrics = {};
  private observers: PerformanceObserver[] = [];

  constructor() {
    if (typeof window === 'undefined') return;
    
    this.initializeObservers();
    this.trackNavigationTiming();
  }

  private initializeObservers() {
    // LARGEST CONTENTFUL PAINT (LCP)
    if ('PerformanceObserver' in window) {
      try {
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          this.metrics.lcp = lastEntry.startTime;
          this.reportMetric('LCP', lastEntry.startTime);
        });
        lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
        this.observers.push(lcpObserver);
      } catch (e) {
        console.warn('LCP observer not supported');
      }

      // FIRST INPUT DELAY (FID)
      try {
        const fidObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const fidEntry = entry as any; // PerformanceEventTiming
            if (fidEntry.processingStart && fidEntry.startTime) {
              this.metrics.fid = fidEntry.processingStart - fidEntry.startTime;
              this.reportMetric('FID', this.metrics.fid);
            }
          }
        });
        fidObserver.observe({ type: 'first-input', buffered: true });
        this.observers.push(fidObserver);
      } catch (e) {
        console.warn('FID observer not supported');
      }

      // CUMULATIVE LAYOUT SHIFT (CLS)
      try {
        let clsValue = 0;
        let clsEntries: PerformanceEntry[] = [];
        
        const clsObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!(entry as any).hadRecentInput) {
              const firstSessionEntry = clsEntries[0];
              const lastSessionEntry = clsEntries[clsEntries.length - 1];
              
              if (!firstSessionEntry || 
                  entry.startTime - lastSessionEntry.startTime < 1000 &&
                  entry.startTime - firstSessionEntry.startTime < 5000) {
                clsEntries.push(entry);
                clsValue += (entry as any).value;
              } else {
                clsEntries = [entry];
                clsValue = (entry as any).value;
              }
            }
          }
          this.metrics.cls = clsValue;
          this.reportMetric('CLS', clsValue);
        });
        clsObserver.observe({ type: 'layout-shift', buffered: true });
        this.observers.push(clsObserver);
      } catch (e) {
        console.warn('CLS observer not supported');
      }
    }
  }

  private trackNavigationTiming() {
    if (typeof window === 'undefined') return;

    // Wait for load event to ensure navigation timing is complete
    window.addEventListener('load', () => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      
      if (navigation) {
        // Time to First Byte
        this.metrics.ttfb = navigation.responseStart - navigation.requestStart;
        this.reportMetric('TTFB', this.metrics.ttfb);

        // First Contentful Paint
        const paintEntries = performance.getEntriesByType('paint');
        const fcpEntry = paintEntries.find(entry => entry.name === 'first-contentful-paint');
        if (fcpEntry) {
          this.metrics.fcp = fcpEntry.startTime;
          this.reportMetric('FCP', fcpEntry.startTime);
        }

        // Additional timing metrics
        this.customMetrics['domContentLoaded'] = navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart;
        this.customMetrics['loadComplete'] = navigation.loadEventEnd - navigation.loadEventStart;
        this.customMetrics['totalLoadTime'] = navigation.loadEventEnd - navigation.fetchStart;
        
        this.reportAllMetrics();
      }
    });
  }

  // CUSTOM PERFORMANCE MARKS
  public mark(name: string): void {
    if (typeof performance !== 'undefined' && performance.mark) {
      performance.mark(name);
    }
  }

  public measure(name: string, startMark?: string, endMark?: string): number | undefined {
    if (typeof performance !== 'undefined' && performance.measure && performance.getEntriesByName) {
      try {
        performance.measure(name, startMark, endMark);
        const measures = performance.getEntriesByName(name, 'measure');
        const duration = measures[measures.length - 1]?.duration;
        
        if (duration !== undefined) {
          this.customMetrics[name] = duration;
          this.reportMetric(name, duration);
        }
        
        return duration;
      } catch (e) {
        console.warn(`Failed to measure ${name}:`, e);
      }
    }
    return undefined;
  }

  // ASYNC OPERATION TIMING
  public async timeAsync<T>(name: string, operation: () => Promise<T>): Promise<T> {
    const startTime = performance.now();
    try {
      const result = await operation();
      const duration = performance.now() - startTime;
      this.customMetrics[name] = duration;
      this.reportMetric(name, duration);
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      this.customMetrics[`${name}_error`] = duration;
      this.reportMetric(`${name}_error`, duration);
      throw error;
    }
  }

  // FUNCTION TIMING
  public time<T>(name: string, operation: () => T): T {
    const startTime = performance.now();
    try {
      const result = operation();
      const duration = performance.now() - startTime;
      this.customMetrics[name] = duration;
      this.reportMetric(name, duration);
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      this.customMetrics[`${name}_error`] = duration;
      this.reportMetric(`${name}_error`, duration);
      throw error;
    }
  }

  // RESOURCE TIMING
  public getResourceTiming(): PerformanceResourceTiming[] {
    if (typeof performance !== 'undefined' && performance.getEntriesByType) {
      return performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    }
    return [];
  }

  // SLOW RESOURCE DETECTION
  public getSlowResources(threshold: number = 1000): PerformanceResourceTiming[] {
    return this.getResourceTiming().filter(resource => resource.duration > threshold);
  }

  private reportMetric(name: string, value: number): void {
    const score = this.getScore(name, value);
    const emoji = score === 'good' ? '🟢' : score === 'needs-improvement' ? '🟡' : '🔴';
    
    console.log(`⚡ ${emoji} ${name}: ${Math.round(value * 100) / 100}ms (${score})`);

    // Send to analytics if available
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'performance_metric', {
        metric_name: name,
        metric_value: Math.round(value),
        metric_score: score
      });
    }

    // Send to service worker for monitoring
    if (typeof navigator !== 'undefined' && navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'PERFORMANCE_MARK',
        payload: { name, value, score }
      });
    }
  }

  private getScore(metric: string, value: number): 'good' | 'needs-improvement' | 'poor' {
    const thresholds = {
      'LCP': { good: 2500, poor: 4000 },
      'FID': { good: 100, poor: 300 },
      'CLS': { good: 0.1, poor: 0.25 },
      'FCP': { good: 1800, poor: 3000 },
      'TTFB': { good: 800, poor: 1800 }
    };

    const threshold = thresholds[metric as keyof typeof thresholds];
    if (!threshold) return 'good';

    if (value <= threshold.good) return 'good';
    if (value <= threshold.poor) return 'needs-improvement';
    return 'poor';
  }

  private reportAllMetrics(): void {
    console.log('📊 PERFORMANCE SUMMARY:');
    console.log('Core Web Vitals:', this.metrics);
    console.log('Custom Metrics:', this.customMetrics);

    // Calculate performance score
    const scores = Object.entries(this.metrics).map(([key, value]) => {
      const score = this.getScore(key.toUpperCase(), value);
      return score === 'good' ? 100 : score === 'needs-improvement' ? 50 : 0;
    });
    const avgScore = scores.length > 0 ? scores.reduce((a: number, b: number) => a + b, 0 as number) / scores.length : 0;
    
    console.log(`🎯 Overall Performance Score: ${Math.round(avgScore)}/100`);
  }

  public getMetrics(): PerformanceMetrics & CustomMetrics {
    return { ...this.metrics, ...this.customMetrics };
  }

  public cleanup(): void {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
  }
}

// SINGLETON INSTANCE
let performanceMonitor: PerformanceMonitor | null = null;

export const getPerformanceMonitor = (): PerformanceMonitor => {
  if (!performanceMonitor) {
    performanceMonitor = new PerformanceMonitor();
  }
  return performanceMonitor;
};

// CONVENIENCE FUNCTIONS
export const mark = (name: string): void => getPerformanceMonitor().mark(name);
export const measure = (name: string, startMark?: string, endMark?: string): number | undefined => 
  getPerformanceMonitor().measure(name, startMark, endMark);
export const timeAsync = <T>(name: string, operation: () => Promise<T>): Promise<T> => 
  getPerformanceMonitor().timeAsync(name, operation);
export const time = <T>(name: string, operation: () => T): T => 
  getPerformanceMonitor().time(name, operation);

// AUTO-INITIALIZE ON IMPORT
if (typeof window !== 'undefined') {
  getPerformanceMonitor();
}

export default PerformanceMonitor;