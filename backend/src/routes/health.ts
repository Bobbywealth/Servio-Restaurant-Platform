import express, { Request, Response } from 'express';
import { DatabaseService } from '../services/DatabaseService';
import { getCacheService } from '../services/CacheService';
import { logger } from '../utils/logger';
import { getPoolStats } from '../config/database';

const router = express.Router();

/**
 * Basic health check - fast response for load balancers
 */
router.get('/', async (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

/**
 * Detailed health check - includes all service checks
 */
router.get('/detailed', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const checks: any = {
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
    services: {}
  };

  let overallHealthy = true;

  // Database check
  try {
    const dbStart = Date.now();
    const db = DatabaseService.getInstance().getDatabase();
    await db.get('SELECT 1 as health');
    const dbLatency = Date.now() - dbStart;

    checks.services.database = {
      healthy: true,
      latency: dbLatency,
      stats: getPoolStats()
    };

    if (dbLatency > 500) {
      checks.services.database.warning = 'High latency detected';
    }
  } catch (error: any) {
    overallHealthy = false;
    checks.services.database = {
      healthy: false,
      error: error.message
    };
  }

  // Cache check (Redis)
  try {
    const cacheService = getCacheService();
    const cacheHealth = await cacheService.healthCheck();
    const cacheStats = await cacheService.getStats();

    checks.services.cache = {
      healthy: cacheHealth.healthy,
      latency: cacheHealth.latency,
      stats: cacheStats
    };

    if (!cacheHealth.healthy) {
      overallHealthy = false;
    }

    if (cacheHealth.latency > 100) {
      checks.services.cache.warning = 'High latency detected';
    }
  } catch (error: any) {
    // Cache is not critical - don't fail overall health
    checks.services.cache = {
      healthy: false,
      error: error.message,
      note: 'Cache is optional - system can operate without it'
    };
  }

  // Memory check
  const memUsage = process.memoryUsage();
  const memoryHealthy = memUsage.heapUsed < memUsage.heapTotal * 0.9; // 90% threshold
  
  checks.services.memory = {
    healthy: memoryHealthy,
    usage: {
      rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
      external: `${Math.round(memUsage.external / 1024 / 1024)}MB`,
      usagePercent: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100)
    }
  };

  if (!memoryHealthy) {
    overallHealthy = false;
    checks.services.memory.warning = 'High memory usage detected';
  }

  // CPU check (basic)
  const cpuUsage = process.cpuUsage();
  checks.services.cpu = {
    healthy: true,
    usage: {
      user: cpuUsage.user,
      system: cpuUsage.system
    }
  };

  // OpenAI API check (optional - just check if configured)
  checks.services.openai = {
    healthy: true,
    configured: Boolean(process.env.OPENAI_API_KEY),
    note: 'API key presence check only - not testing actual connection'
  };

  // Twilio check (optional)
  checks.services.twilio = {
    healthy: true,
    configured: Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN),
    note: 'Configuration check only'
  };

  // Overall health
  checks.healthy = overallHealthy;
  checks.responseTime = Date.now() - startTime;

  // Set appropriate status code
  const statusCode = overallHealthy ? 200 : 503;

  res.status(statusCode).json(checks);
});

/**
 * Liveness probe - checks if application is running
 */
router.get('/live', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString()
  });
});

/**
 * Readiness probe - checks if application is ready to serve traffic
 */
router.get('/ready', async (req: Request, res: Response) => {
  try {
    // Check critical dependencies
    const db = DatabaseService.getInstance().getDatabase();
    await db.get('SELECT 1');

    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    logger.error('Readiness check failed', { error: error.message });
    res.status(503).json({
      status: 'not_ready',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Metrics endpoint - Prometheus-compatible
 */
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const memUsage = process.memoryUsage();
    const uptime = process.uptime();
    const poolStats = getPoolStats();

    // Generate Prometheus-style metrics
    const metrics = [
      '# HELP servio_uptime_seconds Application uptime in seconds',
      '# TYPE servio_uptime_seconds gauge',
      `servio_uptime_seconds ${uptime}`,
      '',
      '# HELP servio_memory_usage_bytes Memory usage in bytes',
      '# TYPE servio_memory_usage_bytes gauge',
      `servio_memory_usage_bytes{type="rss"} ${memUsage.rss}`,
      `servio_memory_usage_bytes{type="heap_used"} ${memUsage.heapUsed}`,
      `servio_memory_usage_bytes{type="heap_total"} ${memUsage.heapTotal}`,
      `servio_memory_usage_bytes{type="external"} ${memUsage.external}`,
      '',
      '# HELP servio_db_pool_connections Database pool connections',
      '# TYPE servio_db_pool_connections gauge',
      `servio_db_pool_connections{state="total"} ${poolStats?.totalCount || 0}`,
      `servio_db_pool_connections{state="idle"} ${poolStats?.idleCount || 0}`,
      `servio_db_pool_connections{state="waiting"} ${poolStats?.waitingCount || 0}`,
      ''
    ].join('\n');

    res.set('Content-Type', 'text/plain; version=0.0.4');
    res.send(metrics);
  } catch (error: any) {
    logger.error('Failed to generate metrics', { error: error.message });
    res.status(500).send('Error generating metrics');
  }
});

/**
 * Database stats endpoint
 */
router.get('/database/stats', async (req: Request, res: Response) => {
  try {
    const db = DatabaseService.getInstance().getDatabase();
    
    // Get table counts
    const tables = [
      'restaurants',
      'users',
      'orders',
      'menu_items',
      'inventory_items',
      'tasks'
    ];

    const stats: any = {
      timestamp: new Date().toISOString(),
      tables: {}
    };

    for (const table of tables) {
      try {
        const result = await db.get(`SELECT COUNT(*) as count FROM ${table}`);
        stats.tables[table] = result.count;
      } catch (error) {
        stats.tables[table] = 'error';
      }
    }

    // Get pool stats
    stats.pool = getPoolStats();

    res.json(stats);
  } catch (error: any) {
    logger.error('Failed to get database stats', { error: error.message });
    res.status(500).json({
      error: 'Failed to get database stats',
      message: error.message
    });
  }
});

/**
 * Cache stats endpoint
 */
router.get('/cache/stats', async (req: Request, res: Response) => {
  try {
    const cacheService = getCacheService();
    const stats = await cacheService.getStats();

    res.json({
      timestamp: new Date().toISOString(),
      cache: stats
    });
  } catch (error: any) {
    logger.error('Failed to get cache stats', { error: error.message });
    res.status(500).json({
      error: 'Failed to get cache stats',
      message: error.message
    });
  }
});

/**
 * System info endpoint
 */
router.get('/system', (req: Request, res: Response) => {
  const memUsage = process.memoryUsage();
  const cpuUsage = process.cpuUsage();

  res.json({
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: {
      rss: memUsage.rss,
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      arrayBuffers: memUsage.arrayBuffers
    },
    cpu: {
      user: cpuUsage.user,
      system: cpuUsage.system
    },
    process: {
      pid: process.pid,
      version: process.version,
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.versions.node,
      v8Version: process.versions.v8
    },
    environment: process.env.NODE_ENV || 'development'
  });
});

export default router;
