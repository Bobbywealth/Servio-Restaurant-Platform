"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const DatabaseService_1 = require("../services/DatabaseService");
const errorHandler_1 = require("../middleware/errorHandler");
const router = (0, express_1.Router)();
/**
 * GET /api/sync/jobs/:id
 * Get sync job status by ID
 */
router.get('/jobs/:id', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const db = DatabaseService_1.DatabaseService.getInstance().getDatabase();
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
router.get('/status', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const db = DatabaseService_1.DatabaseService.getInstance().getDatabase();
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
    const formattedJobs = recentJobs.map((job) => ({
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
router.post('/manual', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { channels = ['all'], type = 'full_sync', userId } = req.body;
    const targetChannels = channels.includes('all')
        ? ['doordash', 'ubereats', 'grubhub']
        : channels;
    const db = DatabaseService_1.DatabaseService.getInstance().getDatabase();
    const jobs = [];
    for (const channel of targetChannels) {
        const jobId = `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await db.run(`
      INSERT INTO sync_jobs (id, type, status, channels, details)
      VALUES (?, ?, ?, ?, ?)
    `, [
            jobId,
            type,
            'pending',
            JSON.stringify([channel]),
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
    await DatabaseService_1.DatabaseService.getInstance().logAudit(userId || 'system', 'trigger_manual_sync', 'sync', 'multiple', { channels: targetChannels, type });
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
router.get('/history', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { limit = 50, status, type } = req.query;
    const db = DatabaseService_1.DatabaseService.getInstance().getDatabase();
    let query = 'SELECT * FROM sync_jobs';
    const params = [];
    const conditions = [];
    if (status) {
        conditions.push('status = ?');
        params.push(status);
    }
    if (type) {
        conditions.push('type = ?');
        params.push(type);
    }
    if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(Number(limit));
    const jobs = await db.all(query, params);
    const formattedJobs = jobs.map((job) => ({
        ...job,
        channels: JSON.parse(job.channels || '[]'),
        details: JSON.parse(job.details || '{}')
    }));
    res.json({
        success: true,
        data: formattedJobs
    });
}));
exports.default = router;
//# sourceMappingURL=sync.js.map