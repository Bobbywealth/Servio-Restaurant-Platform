import { Router, Request, Response } from 'express';
import { DatabaseService } from '../services/DatabaseService';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

/**
 * GET /api/sync/jobs/:id
 * Get sync job status by ID
 */
router.get('/jobs/:id', asyncHandler(async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const db = DatabaseService.getInstance().getDatabase();

  const job = await db.get('SELECT * FROM sync_jobs WHERE id = ?', [id]);

  if (!job) {
    return res.status(404).json({
      success: false,
      error: { message: 'Sync job not found' }
    });
  }

  const formattedJob = {
    ...job,
    channels: JSON.parse(job.channels || '[]'),
    details: JSON.parse(job.details || '{}')
  };

  res.json({
    success: true,
    data: formattedJob
  });
}));

/**
 * GET /api/sync/status
 * Get overall sync status for all channels
 */
router.get('/status', asyncHandler(async (req: Request, res: Response) => {
  const db = DatabaseService.getInstance().getDatabase();

  // Simulate channel connection status
  const channelStatus = [
    {
      channel: 'doordash',
      status: 'connected',
      lastSync: new Date(Date.now() - 5 * 60000).toISOString(), // 5 min ago
      itemCount: 15,
      pendingJobs: 0
    },
    {
      channel: 'ubereats',
      status: 'connected',
      lastSync: new Date(Date.now() - 3 * 60000).toISOString(), // 3 min ago
      itemCount: 15,
      pendingJobs: 0
    },
    {
      channel: 'grubhub',
      status: 'connected',
      lastSync: new Date(Date.now() - 8 * 60000).toISOString(), // 8 min ago
      itemCount: 12, // Fewer items on GrubHub
      pendingJobs: 0
    }
  ];

  const recentJobs = await db.all(`
    SELECT * FROM sync_jobs
    ORDER BY created_at DESC
    LIMIT 10
  `);

  const formattedJobs = recentJobs.map((job: any) => ({
    ...job,
    channels: JSON.parse(job.channels || '[]'),
    details: JSON.parse(job.details || '{}')
  }));

  res.json({
    success: true,
    data: {
      channels: channelStatus,
      recentJobs: formattedJobs,
      overallStatus: channelStatus.every(c => c.status === 'connected') ? 'healthy' : 'issues'
    }
  });
}));

/**
 * POST /api/sync/manual
 * Trigger manual sync for specific channels
 */
router.post('/manual', asyncHandler(async (req: Request, res: Response) => {
  const { channels = ['all'], type = 'full_sync', userId } = req.body;

  const targetChannels = channels.includes('all')
    ? ['doordash', 'ubereats', 'grubhub']
    : channels;

  const db = DatabaseService.getInstance().getDatabase();
  const jobs = [];

  for (const channel of targetChannels) {
    const jobId = `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    await db.run(`
      INSERT INTO sync_jobs (id, restaurant_id, job_type, status, payload, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      jobId,
      req.user?.restaurantId || null,
      type,
      'pending',
      JSON.stringify({ channels: [channel] }),
      JSON.stringify({ triggeredBy: userId || 'manual', triggerTime: new Date().toISOString() })
    ]);

    // Simulate immediate completion for demo
    setTimeout(async () => {
      await db.run(`
        UPDATE sync_jobs
        SET status = 'completed', completed_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [jobId]);
    }, Math.random() * 2000 + 1000); // Complete after 1-3 seconds

    jobs.push({ jobId, channel, status: 'pending' });
  }

  await DatabaseService.getInstance().logAudit(
    req.user?.restaurantId || 'system',
    userId || null,
    'trigger_manual_sync',
    'sync',
    'multiple',
    { channels: targetChannels, type }
  );

  res.json({
    success: true,
    data: {
      message: `Manual sync triggered for ${targetChannels.length} channel(s)`,
      jobs,
      estimatedCompletion: '2-3 seconds'
    }
  });
}));

/**
 * GET /api/sync/history
 * Get sync job history
 */
router.get('/history', asyncHandler(async (req: Request, res: Response) => {
  const { limit = 50, status, type } = req.query;
  const db = DatabaseService.getInstance().getDatabase();

  let query = 'SELECT * FROM sync_jobs';
  const params: any[] = [];
  const conditions: string[] = [];

  if (status) {
    conditions.push('status = ?');
    params.push(status);
  }

  if (type) {
    conditions.push('job_type = ?');
    params.push(type);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY created_at DESC LIMIT ?';
  params.push(Number(limit));

  const jobs = await db.all(query, params);

  const formattedJobs = jobs.map((job: any) => {
    const payload = (() => {
      try {
        return JSON.parse(job.payload || '{}');
      } catch {
        return {};
      }
    })();
    const metadata = (() => {
      try {
        return JSON.parse(job.metadata || '{}');
      } catch {
        return {};
      }
    })();
    return {
      ...job,
      payload,
      metadata,
      channels: Array.isArray(payload.channels) ? payload.channels : [],
      details: payload
    };
  });

  res.json({
    success: true,
    data: formattedJobs
  });
}));

export default router;