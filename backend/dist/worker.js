"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const DatabaseService_1 = require("./services/DatabaseService");
const JobRunnerService_1 = require("./services/JobRunnerService");
const logger_1 = require("./utils/logger");
async function startWorker() {
    logger_1.logger.info('🚀 Starting Servio Background Worker...');
    try {
        // 1. Initialize Database
        await DatabaseService_1.DatabaseService.initialize();
        logger_1.logger.info('Database initialized successfully');
        // 2. Initialize Job Runner
        const jobRunner = JobRunnerService_1.JobRunnerService.getInstance();
        // 3. Register Handlers (Domain -> Adapter logic)
        // Example: Menu Sync Handler
        jobRunner.registerHandler('menu_sync', async (job) => {
            logger_1.logger.info(`Executing menu sync for restaurant ${job.restaurant_id}`);
            // Here we would call the actual Adapter (e.g. DoorDashAdapter.syncMenu)
            return { synced: true, timestamp: new Date().toISOString() };
        });
        // Example: Inventory Sync Handler
        jobRunner.registerHandler('inventory_sync', async (job) => {
            logger_1.logger.info(`Executing inventory sync for item ${job.entity_id}`);
            // Here we would call the actual Adapter (e.g. DeliveryAdapter.updateInventory)
            return { updated: true, itemId: job.entity_id };
        });
        // Example: Notification Handler
        jobRunner.registerHandler('send_notification', async (job) => {
            logger_1.logger.info(`Sending notification: ${job.payload.type}`);
            // Here we would call the NotificationAdapter (e.g. TwilioAdapter.sendSms)
            return { sent: true };
        });
        // 4. Start polling
        const pollInterval = parseInt(process.env.WORKER_POLL_INTERVAL || '5000');
        jobRunner.start(pollInterval);
        logger_1.logger.info('Worker is now polling for jobs');
        // Handle graceful shutdown
        process.on('SIGTERM', () => {
            logger_1.logger.info('SIGTERM received, shutting down worker...');
            jobRunner.stop();
            DatabaseService_1.DatabaseService.close().then(() => process.exit(0));
        });
        process.on('SIGINT', () => {
            logger_1.logger.info('SIGINT received, shutting down worker...');
            jobRunner.stop();
            DatabaseService_1.DatabaseService.close().then(() => process.exit(0));
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to start worker:', error);
        process.exit(1);
    }
}
startWorker();
//# sourceMappingURL=worker.js.map