import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../services/DatabaseService';
import { asyncHandler, UnauthorizedError } from '../middleware/errorHandler';
import { issueAccessToken, requireAuth } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

// DEBUG: Simple test route to verify auth router mounting
router.get('/test-basic', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Auth router is working!',
    timestamp: new Date().toISOString()
  });
});

router.post('/test-post', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Auth POST endpoint is working!',
    body: req.body,
    timestamp: new Date().toISOString()
  });
});

// DEBUG: Test with asyncHandler to see if it's the issue
router.get('/test-async', asyncHandler(async (req: Request, res: Response) => {
  res.json({ 
    success: true, 
    message: 'Async handler test works!',
    timestamp: new Date().toISOString()
  });
}));

// DEBUG: Test login directly (simplified)
router.post('/login-test', (req: Request, res: Response) => {
  res.json({ 
    success: true, 
    message: 'Login test endpoint works!',
    body: req.body,
    timestamp: new Date().toISOString()
  });
});

const REFRESH_TOKEN_TTL_DAYS = Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? 30);

// Log route registration
logger.info('Auth routes: login-test registered');

function safeUser(row: any) {
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    name: row.name,
    email: row.email ?? null,
    role: row.role,
    permissions: (() => {
      try {
        return typeof row.permissions === 'string' ? JSON.parse(row.permissions) : row.permissions;
      } catch {
        return row.permissions === '*' ? ['*'] : [];
      }
    })()
  };
}

router.post(
  '/signup',
  asyncHandler(async (req: Request, res: Response) => {
    const { name, email, password, restaurantName } = req.body ?? {};
    if (!name || !email || !password || !restaurantName) {
      throw new Error('All fields are required');
    }

    const db = DatabaseService.getInstance().getDatabase();
    
    // 1. Create Restaurant
    const restaurantId = uuidv4();
    const slug = restaurantName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    await db.run(
      'INSERT INTO restaurants (id, name, slug) VALUES (?, ?, ?)',
      [restaurantId, restaurantName, slug]
    );

    // 2. Create Owner User
    const userId = uuidv4();
    const passwordHash = await bcrypt.hash(String(password), 10);
    await db.run(
      'INSERT INTO users (id, restaurant_id, name, email, password_hash, role, permissions) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [userId, restaurantId, name, email, passwordHash, 'owner', JSON.stringify(['*'])]
    );

    res.status(201).json({
      success: true,
      data: {
        restaurant: { id: restaurantId, name: restaurantName, slug },
        user: { id: userId, name, email, role: 'owner' }
      }
    });
  })
);

// DEBUG: Test route after signup
router.get('/after-signup', (req: Request, res: Response) => {
  res.json({ success: true, message: 'Route after signup works!' });
});

// DEBUG: POST with asyncHandler right after signup
router.post('/test-async-post', asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, message: 'POST async after signup works!', body: req.body });
}));

logger.info('Auth routes: after-signup registered');

router.post(
  '/login',
  asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body ?? {};
    if (!email || !password) {
      throw new UnauthorizedError('Email and password are required');
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const db = DatabaseService.getInstance().getDatabase();
    
    let user;
    try {
      user = await db.get<any>(
        'SELECT * FROM users WHERE LOWER(email) = ? AND is_active = TRUE', 
        [normalizedEmail]
      );
    } catch (err: any) {
      logger.error('Login database query failed:', err.message);
      throw new Error(`Database error during login: ${err.message}`);
    }

    if (!user || !user.password_hash) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const ok = await bcrypt.compare(String(password), String(user.password_hash));
    if (!ok) throw new UnauthorizedError('Invalid email or password');

    const sessionId = uuidv4();
    const refreshToken = uuidv4();
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

    await db.run(
      'INSERT INTO auth_sessions (id, user_id, refresh_token_hash, expires_at) VALUES (?, ?, ?, ?)',
      [sessionId, user.id, refreshTokenHash, expiresAt]
    );

    const accessToken = issueAccessToken({ 
      sub: user.id, 
      restaurantId: user.restaurant_id, 
      sid: sessionId 
    });

    res.json({
      success: true,
      data: {
        user: safeUser(user),
        accessToken,
        refreshToken
      }
    });
  })
);

// DEBUG: Test after login
router.get('/after-login', (req: Request, res: Response) => {
  res.json({ success: true, message: 'Route after login works!' });
});

// DEBUG: Duplicate login with different name
router.post('/signin', asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    throw new UnauthorizedError('Email and password are required');
  }
  const db = DatabaseService.getInstance().getDatabase();
  const user = await db.get<any>(
    'SELECT * FROM users WHERE LOWER(email) = ? AND is_active = TRUE', 
    [String(email).trim().toLowerCase()]
  );
  if (!user || !user.password_hash) {
    throw new UnauthorizedError('Invalid email or password');
  }
  const ok = await bcrypt.compare(String(password), String(user.password_hash));
  if (!ok) throw new UnauthorizedError('Invalid email or password');
  
  const sessionId = uuidv4();
  const refreshToken = uuidv4();
  const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  await db.run(
    'INSERT INTO auth_sessions (id, user_id, refresh_token_hash, expires_at) VALUES (?, ?, ?, ?)',
    [sessionId, user.id, refreshTokenHash, expiresAt]
  );
  const accessToken = issueAccessToken({ 
    sub: user.id, 
    restaurantId: user.restaurant_id, 
    sid: sessionId 
  });
  res.json({
    success: true,
    data: { user: safeUser(user), accessToken, refreshToken }
  });
}));

/**
 * POST /api/auth/pin-login
 * Tablet-friendly login via restaurant slug + user PIN.
 *
 * Notes:
 * - Pins are not globally unique, so restaurantSlug is required.
 * - Uses the same session + token flow as email/password login.
 */
router.post(
  '/pin-login',
  asyncHandler(async (req: Request, res: Response) => {
    const { restaurantSlug, pin } = req.body ?? {};
    if (!restaurantSlug || !pin) {
      throw new UnauthorizedError('restaurantSlug and pin are required');
    }

    const db = DatabaseService.getInstance().getDatabase();
    const slug = String(restaurantSlug).trim().toLowerCase();
    const normalizedPin = String(pin).trim();

    const restaurant = await db.get<any>('SELECT id FROM restaurants WHERE LOWER(slug) = ? AND is_active = TRUE', [slug]);
    if (!restaurant?.id) {
      throw new UnauthorizedError('Invalid restaurant or PIN');
    }

    const user = await db.get<any>(
      'SELECT * FROM users WHERE restaurant_id = ? AND pin = ? AND is_active = TRUE',
      [restaurant.id, normalizedPin]
    );

    if (!user) {
      throw new UnauthorizedError('Invalid restaurant or PIN');
    }

    const sessionId = uuidv4();
    const refreshToken = uuidv4();
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

    await db.run(
      'INSERT INTO auth_sessions (id, user_id, refresh_token_hash, expires_at) VALUES (?, ?, ?, ?)',
      [sessionId, user.id, refreshTokenHash, expiresAt]
    );

    const accessToken = issueAccessToken({
      sub: user.id,
      restaurantId: user.restaurant_id,
      sid: sessionId
    });

    res.json({
      success: true,
      data: {
        user: safeUser(user),
        accessToken,
        refreshToken
      }
    });
  })
);

router.post(
  '/refresh',
  asyncHandler(async (req: Request, res: Response) => {
    const { refreshToken } = req.body ?? {};
    if (!refreshToken) throw new UnauthorizedError('refreshToken is required');

    const db = DatabaseService.getInstance().getDatabase();
    const sessions = await db.all<any>('SELECT * FROM auth_sessions');

    const now = Date.now();
    for (const s of sessions) {
      const expired = new Date(s.expires_at).getTime() <= now;
      if (expired) continue;

      const match = await bcrypt.compare(String(refreshToken), String(s.refresh_token_hash));
      if (!match) continue;

      const user = await db.get<any>('SELECT * FROM users WHERE id = ? AND is_active = TRUE', [s.user_id]);
      if (!user) throw new UnauthorizedError('User not found or inactive');

      const accessToken = issueAccessToken({ 
        sub: user.id, 
        restaurantId: user.restaurant_id, 
        sid: s.id 
      });
      return res.json({
        success: true,
        data: {
          user: safeUser(user),
          accessToken
        }
      });
    }

    throw new UnauthorizedError('Invalid refresh token');
  })
);

router.post(
  '/logout',
  asyncHandler(async (req: Request, res: Response) => {
    const { refreshToken } = req.body ?? {};
    if (!refreshToken) {
      return res.json({ success: true, data: { loggedOut: true } });
    }

    const db = DatabaseService.getInstance().getDatabase();
    const sessions = await db.all<any>('SELECT * FROM auth_sessions');
    for (const s of sessions) {
      const match = await bcrypt.compare(String(refreshToken), String(s.refresh_token_hash));
      if (match) {
        await db.run('DELETE FROM auth_sessions WHERE id = ?', [s.id]);
        break;
      }
    }

    res.json({ success: true, data: { loggedOut: true } });
  })
);

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, data: { user: req.user } });
  })
);

// Account switching endpoint for testing
router.post(
  '/switch-account',
  asyncHandler(async (req: Request, res: Response) => {
    const { targetEmail } = req.body ?? {};
    
    if (!targetEmail) {
      throw new UnauthorizedError('Target email is required');
    }
    
    // In production, you'd want to add proper authorization checks here
    // For testing purposes, we'll allow switching to any active account
    const db = DatabaseService.getInstance().getDatabase();
    const targetUser = await db.get<any>(
      'SELECT * FROM users WHERE email = ? AND is_active = TRUE', 
      [targetEmail]
    );
    
    if (!targetUser) {
      throw new UnauthorizedError('Target user not found or inactive');
    }
    
    // Create new session for the target user
    const sessionId = uuidv4();
    const refreshToken = uuidv4();
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
    
    await db.run(
      'INSERT INTO auth_sessions (id, user_id, refresh_token_hash, expires_at) VALUES (?, ?, ?, ?)',
      [sessionId, targetUser.id, refreshTokenHash, expiresAt]
    );
    
    const accessToken = issueAccessToken({ 
      sub: targetUser.id, 
      restaurantId: targetUser.restaurant_id, 
      sid: sessionId 
    });
    
    res.json({
      success: true,
      data: {
        user: safeUser(targetUser),
        accessToken,
        refreshToken,
        message: `Switched to ${targetUser.name} (${targetUser.role})`
      }
    });
  })
);

// Get all available accounts for switching (testing only)
router.get(
  '/available-accounts',
  asyncHandler(async (req: Request, res: Response) => {
    const db = DatabaseService.getInstance().getDatabase();
    const users = await db.all<any>(
      'SELECT id, email, name, role FROM users WHERE is_active = TRUE ORDER BY role DESC, name ASC'
    );
    
    const accountsByRole = users.reduce((acc, user) => {
      if (!acc[user.role]) acc[user.role] = [];
      acc[user.role].push({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      });
      return acc;
    }, {} as Record<string, any[]>);
    
    res.json({
      success: true,
      data: {
        accounts: accountsByRole,
        totalCount: users.length
      }
    });
  })
);

// Log all registered routes for debugging
logger.info('Auth router routes:', {
  routes: router.stack.map((r: any) => ({
    path: r.route?.path,
    methods: r.route?.methods
  })).filter((r: any) => r.path)
});

export default router;

