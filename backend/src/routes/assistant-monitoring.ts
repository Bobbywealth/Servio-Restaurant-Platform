import { Router, Request, Response } from 'express';
import { MonitoringService } from '../services/MonitoringService';
import { logger } from '../utils/logger';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();
// Initialize monitoring service lazily
const getMonitoringService = () => MonitoringService.getInstance();

/**
 * GET /api/assistant-monitoring/metrics
 * Get current AI assistant performance metrics
 */
router.get('/metrics', asyncHandler(async (req: Request, res: Response) => {
  const metrics = getMonitoringService().getMetrics();
  
  res.json({
    success: true,
    data: {
      ...metrics,
      // Add computed metrics for dashboard
      errorRate: metrics.requests > 0 ? (metrics.errors / metrics.requests * 100).toFixed(2) : '0.00',
      successRate: metrics.requests > 0 ? ((metrics.requests - metrics.errors) / metrics.requests * 100).toFixed(2) : '100.00',
      avgResponseTimeFormatted: `${metrics.averageResponseTime.toFixed(0)}ms`,
      uptimeFormatted: formatUptime(metrics.uptime)
    }
  });
}));

/**
 * GET /api/assistant-monitoring/health
 * Get detailed health status with checks
 */
router.get('/health', asyncHandler(async (req: Request, res: Response) => {
  const healthStatus = getMonitoringService().getHealthStatus();
  
  res.json({
    success: true,
    data: healthStatus
  });
}));

/**
 * GET /api/assistant-monitoring/report
 * Get performance analysis report
 */
router.get('/report', asyncHandler(async (req: Request, res: Response) => {
  const report = getMonitoringService().generateReport();
  const metrics = getMonitoringService().getMetrics();
  
  // Add additional insights
  const insights = {
    busyHours: [], // Could be calculated from historical data
    commonErrorTypes: Object.entries(metrics.errorsByType)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([type, count]) => ({ type, count })),
    performanceTrend: metrics.averageResponseTime < 3000 ? 'good' : 
                     metrics.averageResponseTime < 6000 ? 'warning' : 'critical',
    utilizationStatus: metrics.conversationsActive > 10 ? 'high' : 
                      metrics.conversationsActive > 5 ? 'medium' : 'low'
  };
  
  res.json({
    success: true,
    data: {
      ...report,
      insights,
      generatedAt: new Date().toISOString()
    }
  });
}));

/**
 * POST /api/assistant-monitoring/reset
 * Reset metrics (for testing or maintenance)
 */
router.post('/reset', asyncHandler(async (req: Request, res: Response) => {
  // Only allow in development or with proper admin permissions
  if (process.env.NODE_ENV === 'production' && !req.user?.permissions?.includes('platform:admin')) {
    return res.status(403).json({
      success: false,
      error: { message: 'Reset only allowed for platform administrators' }
    });
  }
  
  getMonitoringService().resetMetrics();
  logger.info('Assistant monitoring metrics reset', { userId: req.user?.id });
  
  res.json({
    success: true,
    message: 'Metrics have been reset'
  });
}));

/**
 * GET /api/assistant-monitoring/dashboard-data
 * Get formatted data for dashboard display
 */
router.get('/dashboard-data', asyncHandler(async (req: Request, res: Response) => {
  const metrics = getMonitoringService().getMetrics();
  const health = getMonitoringService().getHealthStatus();
  const report = getMonitoringService().generateReport();
  
  // Format data for dashboard consumption
  const dashboardData = {
    // Key Performance Indicators
    kpis: {
      totalRequests: metrics.requests,
      errorRate: metrics.requests > 0 ? ((metrics.errors / metrics.requests) * 100).toFixed(1) : '0',
      avgResponseTime: metrics.averageResponseTime.toFixed(0),
      uptime: formatUptime(metrics.uptime),
      activeConversations: metrics.conversationsActive
    },
    
    // Processing breakdown
    processing: {
      audioRequests: metrics.audioProcessingCount,
      textRequests: metrics.textProcessingCount,
      avgAudioTime: metrics.averageAudioProcessingTime.toFixed(0),
      avgTextTime: metrics.averageTextProcessingTime.toFixed(0)
    },
    
    // System health
    health: {
      status: health.status,
      checks: health.checks
    },
    
    // Error analysis
    errors: {
      total: metrics.errors,
      rateLimitHits: metrics.rateLimitHits,
      byType: Object.entries(metrics.errorsByType)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([type, count]) => ({ type, count, percentage: ((count / metrics.errors) * 100).toFixed(1) }))
    },
    
    // OpenAI API usage
    openaiUsage: {
      totalCalls: metrics.openaiApiCalls,
      callsPerRequest: metrics.requests > 0 ? (metrics.openaiApiCalls / metrics.requests).toFixed(1) : '0'
    },
    
    // Alerts and recommendations
    alerts: report.alerts,
    recommendations: report.recommendations,
    
    // Timestamp
    lastUpdated: new Date().toISOString()
  };
  
  res.json({
    success: true,
    data: dashboardData
  });
}));

// Helper function to format uptime
function formatUptime(uptimeMs: number): string {
  const seconds = Math.floor(uptimeMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) {
    return `${days}d ${hours % 24}h ${minutes % 60}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else {
    return `${minutes}m ${seconds % 60}s`;
  }
}

export default router;