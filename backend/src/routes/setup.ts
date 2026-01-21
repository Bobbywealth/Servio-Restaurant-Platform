import { Router, Request, Response } from 'express';
import bcryptjs from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../services/DatabaseService';
import { asyncHandler } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const router = Router();

/**
 * TEMPORARY: Create owner user for production setup
 * Remove this route after initial setup
 */
router.post('/create-owner', asyncHandler(async (req: Request, res: Response) => {
  const db = DatabaseService.getInstance().getDatabase();
  
  const email = 'owner@demo.servio';
  
  // Check if user already exists
  const existing = await db.get('SELECT id FROM users WHERE email = ?', [email]);
  if (existing) {
    return res.json({ 
      success: true, 
      message: 'Owner user already exists',
      email 
    });
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

  logger.info('Owner user created via setup API', { userId, email });

  res.json({
    success: true,
    message: 'Owner user created successfully',
    email,
    password,
    userId
  });
}));

export default router;
