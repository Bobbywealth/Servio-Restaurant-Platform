"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JobRunnerService = exports.JobStatus = void 0;
const DatabaseService_1 = require("./DatabaseService");
const logger_1 = require("../utils/logger");
var JobStatus;
(function (JobStatus) {
    JobStatus["PENDING"] = "pending";
    JobStatus["PROCESSING"] = "processing";
    JobStatus["COMPLETED"] = "completed";
    JobStatus["FAILED"] = "failed";
    JobStatus["CANCELLED"] = "cancelled";
})(JobStatus || (exports.JobStatus = JobStatus = {}));
class JobRunnerService {
    constructor() {
        this.handlers = new Map();
        this.isRunning = false;
        this.pollInterval = null;
    }
    static getInstance() {
        if (!JobRunnerService.instance) {
            JobRunnerService.instance = new JobRunnerService();
        }
        return JobRunnerService.instance;
    }
    /**
     * Register a handler for a specific job type
     */
    registerHandler(jobType, handler) {
        this.handlers.set(jobType, handler);
        logger_1.logger.info(`Registered handler for job type: ${jobType}`);
    }
    /**
     * Start the job runner
     */
    start(intervalMs = 5000) {
        if (this.isRunning)
            return;
        this.isRunning = true;
        logger_1.logger.info(`Job Runner started with ${intervalMs}ms polling interval`);
        this.pollInterval = setInterval(() => this.pollAndProcess(), intervalMs);
    }
    /**
     * Stop the job runner
     */
    stop() {
        this.isRunning = false;
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
        logger_1.logger.info('Job Runner stopped');
    }
    /**
     * Poll for pending jobs and process them
     */
    async pollAndProcess() {
        try {
            const db = DatabaseService_1.DatabaseService.getInstance().getDatabase();
            // Find jobs that are ready to run
            // We look for 'pending' or 'failed' jobs that have next_run_at in the past
            const jobs = await db.all(`SELECT * FROM sync_jobs 
         WHERE status IN (?, ?) 
         AND next_run_at <= CURRENT_TIMESTAMP 
         AND retry_count < max_retries 
         ORDER BY priority DESC, next_run_at ASC 
         LIMIT 5`, [JobStatus.PENDING, JobStatus.FAILED]);
            if (jobs.length > 0) {
                logger_1.logger.info(`Found ${jobs.length} jobs to process`);
                for (const job of jobs) {
                    // Parse JSON fields if they are strings (SQLite)
                    if (typeof job.payload === 'string')
                        job.payload = JSON.parse(job.payload);
                    if (typeof job.metadata === 'string')
                        job.metadata = JSON.parse(job.metadata);
                    await this.processJob(job);
                }
            }
        }
        catch (error) {
            logger_1.logger.error('Error polling for jobs:', error);
        }
    }
    /**
     * Process a single job
     */
    async processJob(job) {
        const db = DatabaseService_1.DatabaseService.getInstance().getDatabase();
        const dbService = DatabaseService_1.DatabaseService.getInstance();
        try {
            // 1. Mark as processing
            await db.run('UPDATE sync_jobs SET status = ?, started_at = CURRENT_TIMESTAMP WHERE id = ?', [JobStatus.PROCESSING, job.id]);
            await dbService.logAudit(job.restaurant_id || 'system', null, 'job_started', 'sync_job', job.id, { type: job.job_type, attempt: (job.retry_count || 0) + 1 });
            // 2. Find handler
            const handler = this.handlers.get(job.job_type);
            if (!handler) {
                throw new Error(`No handler registered for job type: ${job.job_type}`);
            }
            // 3. Execute handler
            const result = await handler(job);
            // 4. Mark as completed
            await db.run('UPDATE sync_jobs SET status = ?, result = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?', [JobStatus.COMPLETED, JSON.stringify(result), job.id]);
            await dbService.logAudit(job.restaurant_id || 'system', null, 'job_completed', 'sync_job', job.id, { type: job.job_type, result });
            logger_1.logger.info(`Job ${job.id} (${job.job_type}) completed successfully`);
        }
        catch (error) {
            logger_1.logger.error(`Job ${job.id} (${job.job_type}) failed:`, error.message);
            const nextRetryCount = job.retry_count + 1;
            const isFinalFailure = nextRetryCount >= job.max_retries;
            // Calculate exponential backoff: 30s, 2m, 10m, 30m...
            const backoffMinutes = Math.pow(4, nextRetryCount);
            const nextRunAt = new Date();
            nextRunAt.setMinutes(nextRunAt.getMinutes() + backoffMinutes);
            // Update job status
            await db.run(`UPDATE sync_jobs SET 
          status = ?, 
          error_message = ?, 
          retry_count = ?, 
          next_run_at = ? 
         WHERE id = ?`, [
                isFinalFailure ? JobStatus.FAILED : JobStatus.FAILED, // Keep it as FAILED but worker will check retry_count
                error.message,
                nextRetryCount,
                nextRunAt.toISOString(),
                job.id
            ]);
            await dbService.logAudit(job.restaurant_id || 'system', null, 'job_failed', 'sync_job', job.id, {
                type: job.job_type,
                error: error.message,
                attempt: nextRetryCount,
                next_run_at: nextRunAt,
                is_final: isFinalFailure
            });
        }
    }
    /**
     * Add a new job to the queue
     */
    async addJob(params) {
        const db = DatabaseService_1.DatabaseService.getInstance().getDatabase();
        const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const scheduledAt = params.scheduled_at || new Date();
        await db.run(`INSERT INTO sync_jobs (
        id, restaurant_id, integration_id, job_type, entity_type, entity_id, 
        status, payload, retry_count, max_retries, scheduled_at, next_run_at, priority
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
            jobId,
            params.restaurant_id,
            params.integration_id || null,
            params.job_type,
            params.entity_type || null,
            params.entity_id || null,
            JobStatus.PENDING,
            JSON.stringify(params.payload),
            0,
            params.max_retries || 3,
            scheduledAt.toISOString(),
            scheduledAt.toISOString(),
            params.priority || 10
        ]);
        return jobId;
    }
}
exports.JobRunnerService = JobRunnerService;
//# sourceMappingURL=JobRunnerService.js.map