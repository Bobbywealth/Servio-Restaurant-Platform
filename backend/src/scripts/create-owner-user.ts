#!/usr/bin/env node
/**
 * Script to create an owner user for testing Vapi phone system
 * Run with: npm run create-owner
 */

import bcryptjs from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../services/DatabaseService';

async function createOwnerUser() {
  try {
    await DatabaseService.initialize();
    const db = DatabaseService.getInstance().getDatabase();

    const email = 'owner@demo.servio';
    
    // Check if user already exists
    const existing = await db.get('SELECT id FROM users WHERE email = ?', [email]);
    if (existing) {
      console.log('✅ Owner user already exists:', email);
      process.exit(0);
    }

    // Create password hash
    const password = 'owner123';
    const passwordHash = await bcryptjs.hash(password, 10);

    // Create user
    const userId = uuidv4();
    await db.run(`
      INSERT INTO users (id, restaurant_id, name, email, password_hash, role, permissions, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      userId,
      'demo-restaurant-1',
      'Demo Owner',
      email,
      passwordHash,
      'owner',
      JSON.stringify(['*']),
      true,
      new Date().toISOString(),
      new Date().toISOString()
    ]);

    console.log('✅ Owner user created successfully!');
    console.log('   Email:', email);
    console.log('   Password:', password);
    console.log('   Restaurant ID: demo-restaurant-1');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating owner user:', error);
    process.exit(1);
  }
}

createOwnerUser();
