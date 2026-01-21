import dotenv from 'dotenv';
dotenv.config();

import { DatabaseService } from './services/DatabaseService';
import { JobRunnerService } from './services/JobRunnerService';
import { logger } from './utils/logger';

async function startWorker() {
  logger.info('🚀 Starting Servio Background Worker...');
  
  try {
    // 1. Initialize Database
    await DatabaseService.initialize();
    logger.info('Database initialized successfully');

    // 1b. Heartbeat: write worker_last_seen_at every 30s
    const HEARTBEAT_INTERVAL_MS = 30_000;
    const writeHeartbeat = async () => {
      try {
        const db = DatabaseService.getInstance().getDatabase();
        await db.run(
          `
            INSERT INTO system_health (id, worker_last_seen_at, updated_at)
            VALUES ('global', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT (id) DO UPDATE SET
              worker_last_seen_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
          `
        );
      } catch (err) {
        logger.warn('Failed to write worker heartbeat', {
          error: err instanceof Error ? err.message : String(err)
        });
      }
    };

    // Write immediately on boot, then interval
    await writeHeartbeat();
    const heartbeatInterval = setInterval(writeHeartbeat, HEARTBEAT_INTERVAL_MS);

    // 2. Initialize Job Runner
    const jobRunner = JobRunnerService.getInstance();

    // 3. Register Handlers (Domain -> Adapter logic)
    
    // Example: Menu Sync Handler
    jobRunner.registerHandler('menu_sync', async (job) => {
      logger.info(`Executing menu sync for restaurant ${job.restaurant_id}`);
      // Here we would call the actual Adapter (e.g. DoorDashAdapter.syncMenu)
      return { synced: true, timestamp: new Date().toISOString() };
    });

    // Example: Inventory Sync Handler
    jobRunner.registerHandler('inventory_sync', async (job) => {
      logger.info(`Executing inventory sync for item ${job.entity_id}`);
      // Here we would call the actual Adapter (e.g. DeliveryAdapter.updateInventory)
      return { updated: true, itemId: job.entity_id };
    });

    // Example: Notification Handler
    jobRunner.registerHandler('send_notification', async (job) => {
      logger.info(`Sending notification: ${job.payload.type}`);
      // Here we would call the NotificationAdapter (e.g. TwilioAdapter.sendSms)
      return { sent: true };
    });

    // 4. Start polling
    const pollInterval = parseInt(process.env.WORKER_POLL_INTERVAL || '5000');
    jobRunner.start(pollInterval);

    logger.info('Worker is now polling for jobs');

    // Handle graceful shutdown
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, shutting down worker...');
      clearInterval(heartbeatInterval);
      jobRunner.stop();
      DatabaseService.close().then(() => process.exit(0));
    });

    process.on('SIGINT', () => {
      logger.info('SIGINT received, shutting down worker...');
      clearInterval(heartbeatInterval);
      jobRunner.stop();
      DatabaseService.close().then(() => process.exit(0));
    });

  } catch (error) {
    logger.error('Failed to start worker:', error);
    process.exit(1);
  }
}

startWorker();
