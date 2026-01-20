import { DatabaseService } from './DatabaseService';
import { logger } from '../utils/logger';

export enum JobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export interface SyncJob {
  id: string;
  restaurant_id: string;
  integration_id?: string;
  job_type: string;
  entity_type?: string;
  entity_id?: string;
  status: JobStatus;
  payload: any;
  result?: any;
  error_message?: string;
  retry_count: number;
  max_retries: number;
  scheduled_at: Date;
  next_run_at: Date;
  started_at?: Date;
  completed_at?: Date;
  priority: number;
  metadata: any;
}

export type JobHandler = (job: SyncJob) => Promise<any>;

export class JobRunnerService {
  private static instance: JobRunnerService;
  private handlers: Map<string, JobHandler> = new Map();
  private isRunning: boolean = false;
  private pollInterval: NodeJS.Timeout | null = null;

  private constructor() {}

  public static getInstance(): JobRunnerService {
    if (!JobRunnerService.instance) {
      JobRunnerService.instance = new JobRunnerService();
    }
    return JobRunnerService.instance;
  }

  /**
   * Register a handler for a specific job type
   */
  public registerHandler(jobType: string, handler: JobHandler): void {
    this.handlers.set(jobType, handler);
    logger.info(`Registered handler for job type: ${jobType}`);
  }

  /**
   * Start the job runner
   */
  public start(intervalMs: number = 5000): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    logger.info(`Job Runner started with ${intervalMs}ms polling interval`);
    
    this.pollInterval = setInterval(() => this.pollAndProcess(), intervalMs);
  }

  /**
   * Stop the job runner
   */
  public stop(): void {
    this.isRunning = false;
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    logger.info('Job Runner stopped');
  }

  /**
   * Poll for pending jobs and process them
   */
  private async pollAndProcess(): Promise<void> {
    try {
      const db = DatabaseService.getInstance().getDatabase();
      
      // Find jobs that are ready to run
      // We look for 'pending' or 'failed' jobs that have next_run_at in the past
      const jobs = await db.all<SyncJob>(
        `SELECT * FROM sync_jobs 
         WHERE status IN (?, ?) 
         AND next_run_at <= CURRENT_TIMESTAMP 
         AND retry_count < max_retries 
         ORDER BY priority DESC, next_run_at ASC 
         LIMIT 5`,
        [JobStatus.PENDING, JobStatus.FAILED]
      );

      if (jobs.length > 0) {
        logger.info(`Found ${jobs.length} jobs to process`);
        for (const job of jobs) {
          // Parse JSON fields if they are strings (SQLite)
          if (typeof job.payload === 'string') job.payload = JSON.parse(job.payload);
          if (typeof job.metadata === 'string') job.metadata = JSON.parse(job.metadata);
          
          await this.processJob(job);
        }
      }
    } catch (error) {
      logger.error('Error polling for jobs:', error);
    }
  }

  /**
   * Process a single job
   */
  private async processJob(job: SyncJob): Promise<void> {
    const db = DatabaseService.getInstance().getDatabase();
    const dbService = DatabaseService.getInstance();
    
    try {
      // 1. Mark as processing
      await db.run(
        'UPDATE sync_jobs SET status = ?, started_at = CURRENT_TIMESTAMP WHERE id = ?',
        [JobStatus.PROCESSING, job.id]
      );
      
      await dbService.logAudit(
        job.restaurant_id || 'system',
        null,
        'job_started',
        'sync_job',
        job.id,
        { type: job.job_type, attempt: (job.retry_count || 0) + 1 }
      );

      // 2. Find handler
      const handler = this.handlers.get(job.job_type);
      if (!handler) {
        throw new Error(`No handler registered for job type: ${job.job_type}`);
      }

      // 3. Execute handler
      const result = await handler(job);

      // 4. Mark as completed
      await db.run(
        'UPDATE sync_jobs SET status = ?, result = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?',
        [JobStatus.COMPLETED, JSON.stringify(result), job.id]
      );

      await dbService.logAudit(
        job.restaurant_id || 'system',
        null,
        'job_completed',
        'sync_job',
        job.id,
        { type: job.job_type, result }
      );

      logger.info(`Job ${job.id} (${job.job_type}) completed successfully`);

    } catch (error: any) {
      logger.error(`Job ${job.id} (${job.job_type}) failed:`, error.message);
      
      const nextRetryCount = job.retry_count + 1;
      const isFinalFailure = nextRetryCount >= job.max_retries;
      
      // Calculate exponential backoff: 30s, 2m, 10m, 30m...
      const backoffMinutes = Math.pow(4, nextRetryCount);
      const nextRunAt = new Date();
      nextRunAt.setMinutes(nextRunAt.getMinutes() + backoffMinutes);

      // Update job status
      await db.run(
        `UPDATE sync_jobs SET 
          status = ?, 
          error_message = ?, 
          retry_count = ?, 
          next_run_at = ? 
         WHERE id = ?`,
        [
          isFinalFailure ? JobStatus.FAILED : JobStatus.FAILED, // Keep it as FAILED but worker will check retry_count
          error.message,
          nextRetryCount,
          nextRunAt.toISOString(),
          job.id
        ]
      );

      await dbService.logAudit(
        job.restaurant_id || 'system',
        null,
        'job_failed',
        'sync_job',
        job.id,
        { 
          type: job.job_type, 
          error: error.message, 
          attempt: nextRetryCount,
          next_run_at: nextRunAt,
          is_final: isFinalFailure
        }
      );
    }
  }

  /**
   * Add a new job to the queue
   */
  public async addJob(params: {
    restaurant_id: string;
    job_type: string;
    payload: any;
    integration_id?: string;
    entity_type?: string;
    entity_id?: string;
    priority?: number;
    max_retries?: number;
    scheduled_at?: Date;
  }): Promise<string> {
    const db = DatabaseService.getInstance().getDatabase();
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const scheduledAt = params.scheduled_at || new Date();
    
    await db.run(
      `INSERT INTO sync_jobs (
        id, restaurant_id, integration_id, job_type, entity_type, entity_id, 
        status, payload, retry_count, max_retries, scheduled_at, next_run_at, priority
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
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
      ]
    );

    return jobId;
  }
}
