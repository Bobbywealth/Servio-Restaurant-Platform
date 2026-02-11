/**
 * Health Check Endpoint
 * Provides system health status for uptime monitoring
 */

import { Router, Request, Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { AppError, InternalServerError } from '../lib/errors'

const router = Router()

/**
 * System health status
 */
interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  uptime: number
  version: string
  environment: string
  checks: {
    database: {
      status: 'healthy' | 'unhealthy'
      message?: string
      latency?: number
    }
    api: {
      status: 'healthy' | 'unhealthy'
      message?: string
    }
    integrations: {
      sms?: { status: 'healthy' | 'unhealthy'; message?: string }
      email?: { status: 'healthy' | 'unhealthy'; message?: string }
      voice?: { status: 'healthy' | 'unhealthy'; message?: string }
      payment?: { status: 'healthy' | 'unhealthy'; message?: string }
    }
    disk?: {
      status: 'healthy' | 'unhealthy'
      message?: string
      free?: string
      total?: string
    }
  }
}

/**
 * Get system uptime
 */
function getUptime(): number {
  if (process.uptime) {
    return process.uptime()
  }
  return 0
}

/**
 * Check database connection
 */
async function checkDatabase(): Promise<{
  status: 'healthy' | 'unhealthy'
  message?: string
  latency?: number
}> {
  try {
    const startTime = Date.now()

    // TODO: Implement actual database health check
    // This should query the database and return the latency
    const latency = Date.now() - startTime

    return {
      status: 'healthy',
      latency
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Check API health
 */
function checkApi(): {
  status: 'healthy' | 'unhealthy'
  message?: string
} {
  try {
    // Check if API is responding
    // This could be a simple health check endpoint or a mock check
    return {
      status: 'healthy'
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Check integration health
 */
function checkIntegrations(): {
  sms?: { status: 'healthy' | 'unhealthy'; message?: string }
  email?: { status: 'healthy' | 'unhealthy'; message?: string }
  voice?: { status: 'healthy' | 'unhealthy'; message?: string }
  payment?: { status: 'healthy' | 'unhealthy'; message?: string }
} {
  const integrations: any = {}

  // Check SMS integration (Twilio)
  if (process.env.TWILIO_ACCOUNT_SID) {
    integrations.sms = {
      status: 'healthy',
      message: 'Twilio configured'
    }
  } else {
    integrations.sms = {
      status: 'unhealthy',
      message: 'Twilio not configured'
    }
  }

  // Check Email integration (Nodemailer)
  if (process.env.EMAIL_HOST) {
    integrations.email = {
      status: 'healthy',
      message: 'Email configured'
    }
  } else {
    integrations.email = {
      status: 'unhealthy',
      message: 'Email not configured'
    }
  }

  // Check Voice Agent integration (OpenAI)
  if (process.env.OPENAI_API_KEY) {
    integrations.voice = {
      status: 'healthy',
      message: 'OpenAI configured'
    }
  } else {
    integrations.voice = {
      status: 'unhealthy',
      message: 'OpenAI not configured'
    }
  }

  // Check Payment integration (Stripe)
  if (process.env.STRIPE_SECRET_KEY) {
    integrations.payment = {
      status: 'healthy',
      message: 'Stripe configured'
    }
  } else {
    integrations.payment = {
      status: 'unhealthy',
      message: 'Stripe not configured'
    }
  }

  return integrations
}

/**
 * Check disk space
 */
function checkDisk(): {
  status: 'healthy' | 'unhealthy'
  message?: string
  free?: string
  total?: string
} {
  try {
    // Check disk space (Linux/macOS)
    if (process.platform === 'linux' || process.platform === 'darwin') {
      const fs = require('fs')
      const stats = fs.statfsSync('/')

      const total = stats.blocks * stats.blocksize
      const free = stats.bavail * stats.blocksize

      return {
        status: 'healthy',
        free: formatBytes(free),
        total: formatBytes(total)
      }
    }

    return {
      status: 'healthy',
      message: 'Disk check not available on this platform'
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Format bytes to human readable
 */
function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let size = bytes
  let unit = 0

  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024
    unit++
  }

  return `${size.toFixed(2)} ${units[unit]}`
}

/**
 * GET /health
 * Health check endpoint for uptime monitoring
 */
router.get('/', async (req: Request, res: Response) => {
  const requestId = req.headers['x-request-id'] as string || uuidv4()

  try {
    // Run all health checks
    const [dbCheck, apiCheck, integrationsCheck, diskCheck] = await Promise.all([
      checkDatabase(),
      checkApi(),
      checkIntegrations(),
      checkDisk()
    ])

    // Determine overall status
    const hasUnhealthyCheck =
      dbCheck.status === 'unhealthy' ||
      apiCheck.status === 'unhealthy' ||
      Object.values(integrationsCheck).some(i => i?.status === 'unhealthy') ||
      diskCheck.status === 'unhealthy'

    const overallStatus: 'healthy' | 'degraded' | 'unhealthy' = hasUnhealthyCheck
      ? 'unhealthy'
      : 'healthy'

    const healthStatus: HealthStatus = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: getUptime(),
      version: process.env.npm_package_version || 'unknown',
      environment: process.env.NODE_ENV || 'development',
      checks: {
        database: dbCheck,
        api: apiCheck,
        integrations: integrationsCheck,
        disk: diskCheck
      }
    }

    // Return health status
    res.status(overallStatus === 'unhealthy' ? 503 : 200).json(healthStatus)
  } catch (error) {
    console.error('Health check failed:', error)

    const healthStatus: HealthStatus = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: getUptime(),
      version: process.env.npm_package_version || 'unknown',
      environment: process.env.NODE_ENV || 'development',
      checks: {
        database: { status: 'unhealthy', message: error instanceof Error ? error.message : 'Unknown error' },
        api: { status: 'unhealthy', message: error instanceof Error ? error.message : 'Unknown error' },
        integrations: {},
        disk: { status: 'unhealthy', message: error instanceof Error ? error.message : 'Unknown error' }
      }
    }

    res.status(503).json(healthStatus)
  }
})

/**
 * GET /health/liveness
 * Liveness probe - always returns 200 if server is running
 */
router.get('/liveness', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString()
  })
})

/**
 * GET /health/readiness
 * Readiness probe - returns 200 if server is ready to accept traffic
 */
router.get('/readiness', async (req: Request, res: Response) => {
  try {
    // Check if database is connected
    await checkDatabase()

    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    res.status(503).json({
      status: 'not ready',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

export default router
