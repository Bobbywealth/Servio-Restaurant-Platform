import { logger } from '../utils/logger';
import { getMetricsService } from '../services/MetricsService';

/**
 * Alert configuration and thresholds
 */

export interface AlertThreshold {
  metric: string;
  threshold: number;
  comparison: 'gt' | 'lt' | 'eq';
  severity: 'critical' | 'warning' | 'info';
  message: string;
}

export interface Alert {
  id: string;
  metric: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  value: number;
  threshold: number;
  timestamp: Date;
  acknowledged: boolean;
}

// Alert thresholds configuration
export const alertThresholds: AlertThreshold[] = [
  // Performance thresholds
  {
    metric: 'response_time_p95',
    threshold: 500,
    comparison: 'gt',
    severity: 'warning',
    message: 'API response time (p95) exceeds 500ms'
  },
  {
    metric: 'response_time_p95',
    threshold: 1000,
    comparison: 'gt',
    severity: 'critical',
    message: 'API response time (p95) exceeds 1000ms'
  },
  {
    metric: 'database_query_time',
    threshold: 500,
    comparison: 'gt',
    severity: 'warning',
    message: 'Database query time exceeds 500ms'
  },
  {
    metric: 'database_query_time',
    threshold: 1000,
    comparison: 'gt',
    severity: 'critical',
    message: 'Database query time exceeds 1000ms'
  },

  // Error rate thresholds
  {
    metric: 'error_rate',
    threshold: 0.01,
    comparison: 'gt',
    severity: 'warning',
    message: 'Error rate exceeds 1%'
  },
  {
    metric: 'error_rate',
    threshold: 0.05,
    comparison: 'gt',
    severity: 'critical',
    message: 'Error rate exceeds 5%'
  },

  // System resource thresholds
  {
    metric: 'memory_usage_percent',
    threshold: 85,
    comparison: 'gt',
    severity: 'warning',
    message: 'Memory usage exceeds 85%'
  },
  {
    metric: 'memory_usage_percent',
    threshold: 95,
    comparison: 'gt',
    severity: 'critical',
    message: 'Memory usage exceeds 95%'
  },
  {
    metric: 'cpu_usage_percent',
    threshold: 80,
    comparison: 'gt',
    severity: 'warning',
    message: 'CPU usage exceeds 80%'
  },
  {
    metric: 'cpu_usage_percent',
    threshold: 95,
    comparison: 'gt',
    severity: 'critical',
    message: 'CPU usage exceeds 95%'
  },

  // Database connection pool
  {
    metric: 'db_pool_exhausted',
    threshold: 1,
    comparison: 'eq',
    severity: 'critical',
    message: 'Database connection pool exhausted'
  },
  {
    metric: 'db_pool_usage_percent',
    threshold: 90,
    comparison: 'gt',
    severity: 'warning',
    message: 'Database pool usage exceeds 90%'
  },

  // Cache health
  {
    metric: 'cache_hit_rate',
    threshold: 50,
    comparison: 'lt',
    severity: 'warning',
    message: 'Cache hit rate below 50%'
  },

  // OpenAI API
  {
    metric: 'openai_error_rate',
    threshold: 0.05,
    comparison: 'gt',
    severity: 'warning',
    message: 'OpenAI API error rate exceeds 5%'
  },
  {
    metric: 'openai_response_time',
    threshold: 5000,
    comparison: 'gt',
    severity: 'warning',
    message: 'OpenAI API response time exceeds 5 seconds'
  },

  // Business metrics
  {
    metric: 'failed_orders_per_hour',
    threshold: 10,
    comparison: 'gt',
    severity: 'critical',
    message: 'More than 10 failed orders per hour'
  },
  {
    metric: 'voice_call_failure_rate',
    threshold: 0.1,
    comparison: 'gt',
    severity: 'warning',
    message: 'Voice call failure rate exceeds 10%'
  }
];

/**
 * Alert manager class
 */
export class AlertManager {
  private alerts: Map<string, Alert> = new Map();
  private readonly maxAlerts: number = 1000;
  private alertCallbacks: Array<(alert: Alert) => void> = [];

  /**
   * Check if metric violates threshold
   */
  checkThreshold(metric: string, value: number): Alert | null {
    const threshold = alertThresholds.find((t) => t.metric === metric);
    
    if (!threshold) return null;

    let violated = false;
    switch (threshold.comparison) {
      case 'gt':
        violated = value > threshold.threshold;
        break;
      case 'lt':
        violated = value < threshold.threshold;
        break;
      case 'eq':
        violated = value === threshold.threshold;
        break;
    }

    if (!violated) return null;

    // Create alert
    const alertId = `${metric}-${Date.now()}`;
    const alert: Alert = {
      id: alertId,
      metric,
      severity: threshold.severity,
      message: threshold.message,
      value,
      threshold: threshold.threshold,
      timestamp: new Date(),
      acknowledged: false
    };

    // Store alert
    this.addAlert(alert);

    // Log alert
    this.logAlert(alert);

    // Notify callbacks
    this.notifyCallbacks(alert);

    // Send metrics
    this.recordAlertMetric(alert);

    return alert;
  }

  /**
   * Add alert to store
   */
  private addAlert(alert: Alert): void {
    this.alerts.set(alert.id, alert);

    // Limit alert history
    if (this.alerts.size > this.maxAlerts) {
      const iterator = this.alerts.keys().next();
      const oldestKey = iterator.done ? undefined : iterator.value;
      if (oldestKey) this.alerts.delete(oldestKey);
    }
  }

  /**
   * Log alert
   */
  private logAlert(alert: Alert): void {
    const logLevel = alert.severity === 'critical' ? 'error' : 
                     alert.severity === 'warning' ? 'warn' : 'info';
    
    logger[logLevel](`🚨 ALERT: ${alert.message}`, {
      alertId: alert.id,
      metric: alert.metric,
      value: alert.value,
      threshold: alert.threshold,
      severity: alert.severity
    });
  }

  /**
   * Record alert metric
   */
  private recordAlertMetric(alert: Alert): void {
    const metrics = getMetricsService();
    metrics.increment('alerts.triggered', 1, {
      metric: alert.metric,
      severity: alert.severity
    });
  }

  /**
   * Notify callbacks
   */
  private notifyCallbacks(alert: Alert): void {
    for (const callback of this.alertCallbacks) {
      try {
        callback(alert);
      } catch (error) {
        logger.error('Alert callback failed', { error });
      }
    }
  }

  /**
   * Register alert callback
   */
  onAlert(callback: (alert: Alert) => void): void {
    this.alertCallbacks.push(callback);
  }

  /**
   * Get all alerts
   */
  getAlerts(severity?: 'critical' | 'warning' | 'info'): Alert[] {
    const alerts = Array.from(this.alerts.values());
    
    if (severity) {
      return alerts.filter((a) => a.severity === severity);
    }
    
    return alerts;
  }

  /**
   * Get unacknowledged alerts
   */
  getUnacknowledgedAlerts(): Alert[] {
    return Array.from(this.alerts.values()).filter((a) => !a.acknowledged);
  }

  /**
   * Acknowledge alert
   */
  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId);
    
    if (!alert) return false;
    
    alert.acknowledged = true;
    this.alerts.set(alertId, alert);
    
    logger.info('Alert acknowledged', { alertId });
    
    return true;
  }

  /**
   * Clear all alerts
   */
  clearAlerts(): void {
    this.alerts.clear();
    logger.info('All alerts cleared');
  }

  /**
   * Get alert statistics
   */
  getStats(): {
    total: number;
    critical: number;
    warning: number;
    info: number;
    unacknowledged: number;
  } {
    const alerts = Array.from(this.alerts.values());
    
    return {
      total: alerts.length,
      critical: alerts.filter((a) => a.severity === 'critical').length,
      warning: alerts.filter((a) => a.severity === 'warning').length,
      info: alerts.filter((a) => a.severity === 'info').length,
      unacknowledged: alerts.filter((a) => !a.acknowledged).length
    };
  }
}

// Singleton instance
let alertManagerInstance: AlertManager | null = null;

export const getAlertManager = (): AlertManager => {
  if (!alertManagerInstance) {
    alertManagerInstance = new AlertManager();
  }
  return alertManagerInstance;
};

/**
 * Setup alert handlers
 */
export const setupAlertHandlers = (): void => {
  const alertManager = getAlertManager();

  // Example: Send critical alerts to external service
  alertManager.onAlert((alert) => {
    if (alert.severity === 'critical') {
      // TODO: Integrate with PagerDuty, Slack, email, etc.
      logger.error('CRITICAL ALERT - External notification would be sent here', {
        alert
      });
    }
  });

  logger.info('Alert handlers configured');
};

export default {
  alertThresholds,
  AlertManager,
  getAlertManager,
  setupAlertHandlers
};
