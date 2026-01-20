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
      jobRunner.stop();
      DatabaseService.close().then(() => process.exit(0));
    });

    process.on('SIGINT', () => {
      logger.info('SIGINT received, shutting down worker...');
      jobRunner.stop();
      DatabaseService.close().then(() => process.exit(0));
    });

  } catch (error) {
    logger.error('Failed to start worker:', error);
    process.exit(1);
  }
}

startWorker();
