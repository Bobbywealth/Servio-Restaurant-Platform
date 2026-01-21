import bcrypt from 'bcryptjs';
import { DatabaseService } from '../services/DatabaseService';
import { logger } from '../utils/logger';

/**
 * Ensures demo accounts exist (idempotent).
 *
 * Why:
 * - Demo login buttons rely on these emails existing in the DB.
 * - Some environments (fresh DBs / redeploys) may start empty, causing "404/unauthorized" login failures.
 */
export async function ensureDemoUsers(): Promise<void> {
  // Default-on to match the frontend "Demo Access" buttons.
  // Set ENABLE_DEMO_USERS=false to disable in hardened production environments.
  const enabled = process.env.ENABLE_DEMO_USERS !== 'false';

  if (!enabled) return;

  const db = DatabaseService.getInstance().getDatabase();

  // If the key demo user exists, assume the rest are seeded too.
  const existingOwner = await db.get<{ id: string }>(
    'SELECT id FROM users WHERE LOWER(email) = ? AND is_active = TRUE',
    ['owner@demo.servio']
  );
  if (existingOwner?.id) return;

  logger.warn('Demo users missing; seeding demo accounts...');

  const demoRestaurantId = 'demo-restaurant-1';
  const demoRestaurantName = 'Demo Restaurant';
  const demoRestaurantSlug = 'demo-restaurant-1';

  // Ensure demo restaurant exists (users.restaurant_id has FK).
  const existingRestaurant = await db.get<{ id: string }>(
    'SELECT id FROM restaurants WHERE id = ?',
    [demoRestaurantId]
  );
  if (!existingRestaurant?.id) {
    await db.run(
      `INSERT INTO restaurants (id, name, slug, is_active)
       VALUES (?, ?, ?, TRUE)`,
      [demoRestaurantId, demoRestaurantName, demoRestaurantSlug]
    );
  }

  const demoPassword = 'password';
  const passwordHash = await bcrypt.hash(demoPassword, 10);

  const demoUsers = [
    {
      id: 'platform-admin-user',
      email: 'admin@servio.com',
      name: 'System Admin',
      role: 'platform-admin',
      restaurant_id: 'platform-admin-org',
      permissions: JSON.stringify(['*']),
      password_hash: passwordHash,
      is_active: true
    },
    {
      id: 'admin-2',
      email: 'superadmin@servio.com',
      name: 'Super Admin',
      role: 'platform-admin',
      restaurant_id: 'platform-admin-org',
      permissions: JSON.stringify(['*']),
      password_hash: passwordHash,
      is_active: true
    },
    {
      id: 'owner-1',
      email: 'owner@demo.servio',
      name: 'Demo Owner',
      role: 'owner',
      restaurant_id: demoRestaurantId,
      permissions: JSON.stringify(['orders.*', 'inventory.*', 'menu.*', 'staff.*', 'analytics.*']),
      password_hash: passwordHash,
      is_active: true
    },
    {
      id: 'manager-1',
      email: 'manager@demo.servio',
      name: 'Demo Manager',
      role: 'manager',
      restaurant_id: demoRestaurantId,
      permissions: JSON.stringify(['orders.*', 'inventory.*', 'menu.read', 'staff.read']),
      password_hash: passwordHash,
      is_active: true
    },
    {
      id: 'staff-1',
      email: 'staff@demo.servio',
      name: 'Demo Staff',
      role: 'staff',
      restaurant_id: demoRestaurantId,
      permissions: JSON.stringify(['inventory.read', 'timeclock.*']),
      password_hash: passwordHash,
      is_active: true
    }
  ] as const;

  // Ensure platform admin org exists too (needed for FK).
  const platformOrg = await db.get<{ id: string }>('SELECT id FROM restaurants WHERE id = ?', ['platform-admin-org']);
  if (!platformOrg?.id) {
    await db.run(
      `INSERT INTO restaurants (id, name, slug, is_active)
       VALUES (?, ?, ?, TRUE)`,
      ['platform-admin-org', 'Platform Admin Org', 'platform-admin-org']
    );
  }

  for (const user of demoUsers) {
    const existing = await db.get<{ id: string }>(
      'SELECT id FROM users WHERE id = ? OR LOWER(email) = ?',
      [user.id, String(user.email).toLowerCase()]
    );

    if (existing?.id) {
      await db.run(
        `UPDATE users
         SET name = ?,
             role = ?,
             permissions = ?,
             password_hash = ?,
             email = ?,
             is_active = ?,
             restaurant_id = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ? OR LOWER(email) = ?`,
        [
          user.name,
          user.role,
          user.permissions,
          user.password_hash,
          user.email,
          user.is_active,
          user.restaurant_id,
          user.id,
          String(user.email).toLowerCase()
        ]
      );
    } else {
      await db.run(
        `INSERT INTO users
           (id, email, name, role, permissions, password_hash, is_active, restaurant_id, created_at, updated_at)
         VALUES
           (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [
          user.id,
          user.email,
          user.name,
          user.role,
          user.permissions,
          user.password_hash,
          user.is_active,
          user.restaurant_id
        ]
      );
    }
  }

  logger.info('Demo users seeded successfully');
}

