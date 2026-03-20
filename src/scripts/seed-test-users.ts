#!/usr/bin/env npx tsx

/**
 * Quick test user seed script for SQLite database
 * Creates test users for stress testing
 */

import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const DB_PATH = path.join(__dirname, '../../servio.db');

async function seedTestUsers() {
  console.log('🌱 Seeding test users for stress testing...');
  
  const db = new Database(DB_PATH);
  
  // Enable foreign keys
  db.pragma('foreign_keys = ON');
  
  // Create test company if not exists
  const companyId = '00000000-0000-0000-0000-000000000001';
  const restaurantId = '00000000-0000-0000-0000-000000000001';
  
  try {
    // Check if company exists
    const existingCompany = db.prepare('SELECT id FROM companies WHERE id = ?').get(companyId);
    
    if (!existingCompany) {
      console.log('Creating test company...');
      db.prepare(`
        INSERT INTO companies (id, name, email, phone, created_at, updated_at)
        VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
      `).run(companyId, 'Test Restaurant Company', 'test@company.com', '555-1234');
    }
    
    // Check if restaurant exists
    const existingRestaurant = db.prepare('SELECT id FROM restaurants WHERE id = ?').get(restaurantId);
    
    if (!existingRestaurant) {
      console.log('Creating test restaurant...');
      db.prepare(`
        INSERT INTO restaurants (id, company_id, name, address, city, state, zip, phone, hours, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).run(
        restaurantId,
        companyId,
        'Test Restaurant',
        '123 Test St',
        'Test City',
        'TC',
        '12345',
        '555-TEST',
        JSON.stringify({
          monday: { open: '09:00', close: '22:00' },
          tuesday: { open: '09:00', close: '22:00' },
          wednesday: { open: '09:00', close: '22:00' },
          thursday: { open: '09:00', close: '22:00' },
          friday: { open: '09:00', close: '23:00' },
          saturday: { open: '10:00', close: '23:00' },
          sunday: { open: '10:00', close: '21:00' },
        })
      );
    }
    
    // Create test users
    const testUsers = [
      { email: 'admin@test.com', password: 'Test123!', role: 'admin', name: 'Test Admin', pin: '1234' },
      { email: 'manager@test.com', password: 'Test123!', role: 'manager', name: 'Test Manager', pin: '2345' },
      { email: 'staff@test.com', password: 'Test123!', role: 'staff', name: 'Test Staff', pin: '3456' },
      { email: 'customer@test.com', password: 'Test123!', role: 'customer', name: 'Test Customer', pin: null },
    ];
    
    for (const user of testUsers) {
      const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(user.email);
      
      if (!existingUser) {
        const userId = uuidv4();
        const hashedPassword = await bcrypt.hash(user.password, 10);
        
        db.prepare(`
          INSERT INTO users (id, company_id, email, password_hash, name, role, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `).run(userId, companyId, user.email, hashedPassword, user.name, user.role);
        
        console.log(`✓ Created user: ${user.email} (${user.role})`);
        
        // Create staff record if not customer
        if (user.role !== 'customer' && user.pin) {
          const staffId = uuidv4();
          
          db.prepare(`
            INSERT INTO staff (id, restaurant_id, user_id, name, pin, role, hire_date, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, date('now'), datetime('now'), datetime('now'))
          `).run(staffId, restaurantId, userId, user.name, user.pin, user.role);
          
          console.log(`  ✓ Created staff record with PIN: ${user.pin}`);
        }
      } else {
        console.log(`✓ User already exists: ${user.email}`);
      }
    }
    
    console.log('\n✅ Test users seeded successfully!');
    console.log('\nTest credentials:');
    console.log('  Admin:   admin@test.com / Test123!');
    console.log('  Manager: manager@test.com / Test123!');
    console.log('  Staff:   staff@test.com / Test123! (PIN: 3456)');
    
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    db.close();
  }
}

seedTestUsers();
