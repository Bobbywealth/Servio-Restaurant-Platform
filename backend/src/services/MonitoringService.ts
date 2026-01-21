import { logger } from '../utils/logger';

interface ServiceMetrics {
  requests: number;
  errors: number;
  averageResponseTime: number;
  lastHealthCheck: Date;
  uptime: number;
}

interface AssistantMetrics extends ServiceMetrics {
  audioProcessingCount: number;
  textProcessingCount: number;
  averageAudioProcessingTime: number;
  averageTextProcessingTime: number;
  openaiApiCalls: number;
  conversationsActive: number;
  rateLimitHits: number;
  errorsByType: Record<string, number>;
}

export class MonitoringService {
  private static instance: MonitoringService;
  private metrics: AssistantMetrics;
  private startTime: Date;

  private constructor() {
    this.startTime = new Date();
    this.metrics = {
      requests: 0,
      errors: 0,
      averageResponseTime: 0,
      lastHealthCheck: new Date(),
      uptime: 0,
      audioProcessingCount: 0,
      textProcessingCount: 0,
      averageAudioProcessingTime: 0,
      averageTextProcessingTime: 0,
      openaiApiCalls: 0,
      conversationsActive: 0,
      rateLimitHits: 0,
      errorsByType: {}
    };

    // Update uptime every minute
    setInterval(() => {
      this.metrics.uptime = Date.now() - this.startTime.getTime();
    }, 60000);
  }

  static getInstance(): MonitoringService {
    if (!MonitoringService.instance) {
      MonitoringService.instance = new MonitoringService();
    }
    return MonitoringService.instance;
  }

  // Record metrics for different types of operations
  recordRequest(type: 'audio' | 'text', responseTime: number, success: boolean = true): void {
    this.metrics.requests++;
    
    if (type === 'audio') {
      this.metrics.audioProcessingCount++;
      this.updateAverage('averageAudioProcessingTime', responseTime, this.metrics.audioProcessingCount);
    } else {
      this.metrics.textProcessingCount++;
      this.updateAverage('averageTextProcessingTime', responseTime, this.metrics.textProcessingCount);
    }

    this.updateAverage('averageResponseTime', responseTime, this.metrics.requests);

    if (!success) {
      this.metrics.errors++;
    }

    // Log significant metrics
    if (this.metrics.requests % 100 === 0) {
      logger.info('Assistant metrics update', {
        requests: this.metrics.requests,
        errors: this.metrics.errors,
        errorRate: (this.metrics.errors / this.metrics.requests * 100).toFixed(2) + '%',
        avgResponseTime: this.metrics.averageResponseTime.toFixed(0) + 'ms'
      });
    }
  }

  recordError(type: string, details?: any): void {
    this.metrics.errors++;
    this.metrics.errorsByType[type] = (this.metrics.errorsByType[type] || 0) + 1;

    logger.error('Assistant error recorded', {
      type,
      totalErrors: this.metrics.errors,
      errorsByType: this.metrics.errorsByType,
      details
    });
  }

  recordOpenAICall(): void {
    this.metrics.openaiApiCalls++;
  }

  recordRateLimitHit(): void {
    this.metrics.rateLimitHits++;
    logger.warn('Rate limit hit recorded', {
      totalHits: this.metrics.rateLimitHits,
      timestamp: new Date().toISOString()
    });
  }

  updateActiveConversations(count: number): void {
    this.metrics.conversationsActive = count;
  }

  // Health check endpoint data
  getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    metrics: AssistantMetrics;
    checks: Record<string, { status: string; message?: string }>;
  } {
    const errorRate = this.metrics.requests > 0 ? (this.metrics.errors / this.metrics.requests) : 0;
    const avgResponseTime = this.metrics.averageResponseTime;

    // Determine health status
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (errorRate > 0.1 || avgResponseTime > 10000) { // >10% error rate or >10s response time
      status = 'unhealthy';
    } else if (errorRate > 0.05 || avgResponseTime > 5000) { // >5% error rate or >5s response time
      status = 'degraded';
    }

    // Perform health checks
    const checks = {
      openai: {
        status: process.env.OPENAI_API_KEY ? 'available' : 'unavailable',
        message: process.env.OPENAI_API_KEY ? undefined : 'OpenAI API key not configured'
      },
      database: {
        status: 'available', // Would check actual DB connection in real implementation
      },
      memory: {
        status: this.getMemoryStatus(),
        message: this.getMemoryUsage()
      },
      errorRate: {
        status: errorRate < 0.05 ? 'good' : errorRate < 0.1 ? 'warning' : 'critical',
        message: `Error rate: ${(errorRate * 100).toFixed(2)}%`
      },
      responseTime: {
        status: avgResponseTime < 3000 ? 'good' : avgResponseTime < 6000 ? 'warning' : 'critical',
        message: `Average response time: ${avgResponseTime.toFixed(0)}ms`
      }
    };

    this.metrics.lastHealthCheck = new Date();

    return {
      status,
      metrics: { ...this.metrics },
      checks
    };
  }

  // Get current metrics
  getMetrics(): AssistantMetrics {
    return { ...this.metrics };
  }

  // Reset metrics (useful for testing or periodic resets)
  resetMetrics(): void {
    const uptime = this.metrics.uptime;
    this.metrics = {
      requests: 0,
      errors: 0,
      averageResponseTime: 0,
      lastHealthCheck: new Date(),
      uptime,
      audioProcessingCount: 0,
      textProcessingCount: 0,
      averageAudioProcessingTime: 0,
      averageTextProcessingTime: 0,
      openaiApiCalls: 0,
      conversationsActive: 0,
      rateLimitHits: 0,
      errorsByType: {}
    };

    logger.info('Monitoring metrics reset');
  }

  // Generate periodic reports
  generateReport(): {
    summary: string;
    recommendations: string[];
    alerts: string[];
  } {
    const errorRate = this.metrics.requests > 0 ? (this.metrics.errors / this.metrics.requests * 100) : 0;
    const recommendations: string[] = [];
    const alerts: string[] = [];

    // Generate summary
    const summary = `Assistant processed ${this.metrics.requests} requests with ${errorRate.toFixed(1)}% error rate. Average response time: ${this.metrics.averageResponseTime.toFixed(0)}ms.`;

    // Generate recommendations
    if (errorRate > 5) {
      recommendations.push('High error rate detected. Review error logs and check OpenAI API status.');
    }

    if (this.metrics.averageResponseTime > 5000) {
      recommendations.push('Slow response times detected. Consider optimizing conversation history or upgrading infrastructure.');
    }

    if (this.metrics.rateLimitHits > 10) {
      recommendations.push('Frequent rate limiting detected. Consider increasing rate limits or implementing request queuing.');
    }

    // Generate alerts
    if (errorRate > 10) {
      alerts.push('CRITICAL: Error rate above 10%');
    }

    if (this.metrics.averageResponseTime > 10000) {
      alerts.push('CRITICAL: Average response time above 10 seconds');
    }

    if (!process.env.OPENAI_API_KEY) {
      alerts.push('CRITICAL: OpenAI API key not configured');
    }

    return {
      summary,
      recommendations,
      alerts
    };
  }

  private updateAverage(field: keyof AssistantMetrics, newValue: number, count: number): void {
    const currentAverage = this.metrics[field] as number;
    (this.metrics[field] as any) = (currentAverage * (count - 1) + newValue) / count;
  }

  private getMemoryStatus(): string {
    const usage = process.memoryUsage();
    const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
    
    if (heapUsedMB > 500) return 'high';
    if (heapUsedMB > 250) return 'medium';
    return 'normal';
  }

  private getMemoryUsage(): string {
    const usage = process.memoryUsage();
    return `Heap: ${Math.round(usage.heapUsed / 1024 / 1024)}MB / ${Math.round(usage.heapTotal / 1024 / 1024)}MB`;
  }
}

export default MonitoringService;