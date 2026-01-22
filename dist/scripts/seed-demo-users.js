#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedDemoUsers = seedDemoUsers;
const DatabaseService_1 = require("../services/DatabaseService");
const logger_1 = require("../utils/logger");
async function seedDemoUsers() {
    if (process.env.NODE_ENV === 'production') {
        throw new Error('Refusing to seed demo users in production');
    }
    // DatabaseService.seedData() is responsible for demo users/restaurant/menu.
    logger_1.logger.info('Seeding demo data (local/dev) via DatabaseService.initialize()...');
    await DatabaseService_1.DatabaseService.initialize();
    logger_1.logger.info('Demo seed completed. Demo credentials: admin@servio.com / admin123, owner@demo.servio / password, manager@demo.servio / password, staff@demo.servio / password');
}
// Run the script
if (require.main === module) {
    seedDemoUsers()
        .then(() => {
        console.log('\n✅ Demo user seeding completed!');
        process.exit(0);
    })
        .catch((error) => {
        console.error('❌ Demo user seeding failed:', error);
        process.exit(1);
    });
}
//# sourceMappingURL=seed-demo-users.js.map