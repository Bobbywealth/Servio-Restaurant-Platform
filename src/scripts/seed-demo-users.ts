#!/usr/bin/env node

import { DatabaseService } from '../services/DatabaseService';
import { logger } from '../utils/logger';

async function seedDemoUsers() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed demo users in production');
  }

  // DatabaseService.seedData() is responsible for demo users/restaurant/menu.
  logger.info('Seeding demo data (local/dev) via DatabaseService.initialize()...');
  await DatabaseService.initialize();

  logger.info(
    'Demo seed completed. Demo credentials: admin@servio.com / admin123, owner@demo.servio / password, manager@demo.servio / password, staff@demo.servio / password'
  );
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

export { seedDemoUsers };