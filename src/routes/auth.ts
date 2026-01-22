import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../services/DatabaseService';
import { asyncHandler, ForbiddenError, UnauthorizedError } from '../middleware/errorHandler';
import { issueAccessToken, requireAuth } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

const REFRESH_TOKEN_TTL_DAYS = Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? 30);

function getRequestId(req: Request): string {
  const headerId = req.headers['x-request-id'];
  if (typeof headerId === 'string' && headerId.trim()) return headerId.trim();
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

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

router.post(
  '/login',
  asyncHandler(async (req: Request, res: Response) => {
    const requestId = getRequestId(req);
    const start = Date.now();

    const { email, password } = req.body ?? {};
    const normalizedEmail = String(email ?? '').trim().toLowerCase();

    logger.info(
      `[auth.login] entry ${JSON.stringify({
        requestId,
        method: req.method,
        path: req.originalUrl,
        hasEmail: Boolean(email),
        email: normalizedEmail || null,
        hasPassword: Boolean(password),
        origin: req.headers.origin ?? null,
        userAgent: req.headers['user-agent'] ?? null
      })}`
    );

    try {
      if (!email || !password) {
        throw new UnauthorizedError('Email and password are required');
      }

      logger.info(`[auth.login] before_db_get_user ${JSON.stringify({ requestId })}`);
      const db = DatabaseService.getInstance().getDatabase();
      const user = await db.get<any>(
        'SELECT * FROM users WHERE LOWER(email) = ?',
        [normalizedEmail]
      );
      logger.info(
        `[auth.login] after_db_get_user ${JSON.stringify({
          requestId,
          userFound: Boolean(user),
          hasPasswordHash: Boolean(user?.password_hash),
          userId: user?.id ?? null,
          restaurantId: user?.restaurant_id ?? null,
          role: user?.role ?? null
        })}`
      );

      if (!user || !user.password_hash) {
        throw new UnauthorizedError('Invalid email or password');
      }

      const isActive = user.is_active === true || user.is_active === 1;
      if (!isActive) {
        throw new ForbiddenError('User is inactive');
      }

      const ok = await bcrypt.compare(String(password), String(user.password_hash));
      if (!ok) throw new UnauthorizedError('Invalid email or password');

      const sessionId = uuidv4();
      const refreshToken = uuidv4();
      const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
      const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

      logger.info(`[auth.login] before_db_insert_session ${JSON.stringify({ requestId, sessionId })}`);
      await db.run(
        'INSERT INTO auth_sessions (id, user_id, refresh_token_hash, expires_at) VALUES (?, ?, ?, ?)',
        [sessionId, user.id, refreshTokenHash, expiresAt]
      );
      logger.info(`[auth.login] after_db_insert_session ${JSON.stringify({ requestId, sessionId })}`);

      logger.info(`[auth.login] before_jwt_sign ${JSON.stringify({ requestId, sessionId, userId: user.id })}`);
      const accessToken = issueAccessToken({
        sub: user.id,
        restaurantId: user.restaurant_id,
        sid: sessionId
      });

      logger.info(
        `[auth.login] before_response ${JSON.stringify({
          requestId,
          ms: Date.now() - start,
          status: 200,
          userId: user.id,
          restaurantId: user.restaurant_id
        })}`
      );

      res.json({
        success: true,
        data: {
          user: safeUser(user),
          accessToken,
          refreshToken
        }
      });
    } catch (error) {
      const err = error as any;
      logger.error(
        `[auth.login] error ${JSON.stringify({
          requestId,
          ms: Date.now() - start,
          name: err?.name ?? null,
          message: err?.message ?? String(err),
          stack: err?.stack ?? null
        })}`
      );
      throw error;
    }
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

export default router;

