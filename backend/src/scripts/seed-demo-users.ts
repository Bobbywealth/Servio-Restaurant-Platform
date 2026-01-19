#!/usr/bin/env node

import bcrypt from 'bcryptjs';
import { DatabaseService } from '../services/DatabaseService';

async function seedDemoUsers() {
  console.log('🌱 Seeding demo users for account switching...');
  
  // Initialize database connection
  await DatabaseService.initialize();
  const dbService = DatabaseService.getInstance();
  const db = dbService.getDatabase();
  
  // Demo passwords (same for all users for easy testing)
  const demoPassword = 'password';
  const passwordHash = await bcrypt.hash(demoPassword, 10);
  
  // Demo users for different scenarios
  const demoUsers = [
    {
      id: 'admin-1',
      email: 'admin@servio.com',
      name: 'System Admin',
      role: 'admin',
      permissions: JSON.stringify(['*']), // All permissions
      password_hash: passwordHash,
      is_active: 1
    },
    {
      id: 'admin-2', 
      email: 'superadmin@servio.com',
      name: 'Super Admin',
      role: 'admin',
      permissions: JSON.stringify(['*']),
      password_hash: passwordHash,
      is_active: 1
    },
    {
      id: 'owner-1',
      email: 'owner@demo.servio',
      name: 'Restaurant Owner',
      role: 'owner',
      permissions: JSON.stringify(['orders.*', 'inventory.*', 'menu.*', 'staff.*', 'analytics.*']),
      password_hash: passwordHash,
      is_active: 1
    },
    {
      id: 'manager-1',
      email: 'manager@demo.servio',
      name: 'Restaurant Manager',
      role: 'manager', 
      permissions: JSON.stringify(['orders.*', 'inventory.*', 'menu.read', 'staff.read']),
      password_hash: passwordHash,
      is_active: 1
    },
    {
      id: 'staff-1',
      email: 'staff@demo.servio',
      name: 'Restaurant Staff',
      role: 'staff',
      permissions: JSON.stringify(['orders.read', 'orders.update', 'inventory.read']),
      password_hash: passwordHash,
      is_active: 1
    }
  ];
  
  try {
    // Check if admin role exists in the schema constraint
    const userSchema = await db.get("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'");
    console.log('Current users table schema:', userSchema?.sql);
    
    // First, let's update the schema to include 'admin' role
    try {
      await db.exec(`
        -- Create a new temporary table with updated role constraint
        CREATE TABLE users_temp (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          role TEXT NOT NULL CHECK (role IN ('staff', 'manager', 'owner', 'admin')),
          permissions TEXT NOT NULL DEFAULT '[]',
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          email TEXT,
          password_hash TEXT,
          pin TEXT,
          is_active BOOLEAN
        );
        
        -- Copy existing data
        INSERT INTO users_temp SELECT * FROM users;
        
        -- Drop old table and rename new one
        DROP TABLE users;
        ALTER TABLE users_temp RENAME TO users;
        
        -- Recreate indexes
        CREATE INDEX idx_users_email ON users(email);
        CREATE INDEX idx_users_role ON users(role);
        CREATE INDEX idx_users_active ON users(is_active);
        CREATE INDEX idx_users_pin ON users(pin);
      `);
      console.log('✅ Updated users table schema to include admin role');
    } catch (err) {
      console.log('ℹ️  Schema update not needed or failed:', err);
    }
    
    // Insert demo users
    for (const user of demoUsers) {
      try {
        // Check if user already exists
        const existingUser = await db.get('SELECT id FROM users WHERE id = ? OR email = ?', [user.id, user.email]);
        
        if (existingUser) {
          // Update existing user
          await db.run(`
            UPDATE users 
            SET name = ?, role = ?, permissions = ?, password_hash = ?, email = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ? OR email = ?
          `, [user.name, user.role, user.permissions, user.password_hash, user.email, user.is_active, user.id, user.email]);
          console.log(`🔄 Updated user: ${user.email}`);
        } else {
          // Insert new user
          await db.run(`
            INSERT INTO users (id, email, name, role, permissions, password_hash, is_active, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `, [user.id, user.email, user.name, user.role, user.permissions, user.password_hash, user.is_active]);
          console.log(`✅ Created user: ${user.email}`);
        }
      } catch (err) {
        console.error(`❌ Failed to create/update user ${user.email}:`, err);
      }
    }
    
    // Show all users
    const allUsers = await db.all('SELECT id, email, name, role FROM users WHERE is_active = 1');
    console.log('\n📋 All active users:');
    allUsers.forEach(user => {
      console.log(`  • ${user.name} (${user.email}) - ${user.role}`);
    });
    
    console.log('\n🔑 Demo password for all accounts: "password"');
    console.log('\n🎯 Account switching test scenarios:');
    console.log('  1. Login as admin@servio.com (System Admin) - Full access');  
    console.log('  2. Switch to owner@demo.servio (Restaurant Owner) - Restaurant management');
    console.log('  3. Switch to manager@demo.servio (Restaurant Manager) - Limited access');
    console.log('  4. Switch to staff@demo.servio (Restaurant Staff) - Operational access');
    
  } catch (error) {
    console.error('❌ Error seeding demo users:', error);
    throw error;
  }
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