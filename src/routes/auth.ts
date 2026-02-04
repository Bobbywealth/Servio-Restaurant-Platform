import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../services/DatabaseService';
import { asyncHandler, ForbiddenError, UnauthorizedError } from '../middleware/errorHandler';
import { issueAccessToken, requireAuth } from '../middleware/auth';
import { logger } from '../utils/logger';

// Fast SHA-256 hash for token lookup (secure for high-entropy UUIDs)
function hashTokenForLookup(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

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

    const { email, password, stayLoggedIn } = req.body ?? {};
    const normalizedEmail = String(email ?? '').trim().toLowerCase();

    logger.info(
      `[auth.login] entry ${JSON.stringify({
        requestId,
        method: req.method,
        path: req.originalUrl,
        hasEmail: Boolean(email),
        email: normalizedEmail || null,
        hasPassword: Boolean(password),
        stayLoggedIn: Boolean(stayLoggedIn),
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
      // Postgres-safe: do not compare boolean to integer in SQL.
      const user = await db.get<any>('SELECT * FROM users WHERE LOWER(email) = ?', [normalizedEmail]);
      logger.info(
        `[auth.login] after_db_get_user ${JSON.stringify({
          requestId,
          userFound: Boolean(user),
          hasPasswordHash: Boolean(user?.password_hash),
          userId: user?.id ?? null,
          restaurantId: user?.restaurant_id ?? null,
          role: user?.role ?? null,
          isActive: user?.is_active ?? null
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
      // Fast lookup hash using SHA-256 (indexed for O(1) lookups)
      const tokenHash = hashTokenForLookup(refreshToken);

      // If stayLoggedIn is true, use full 30-day TTL; otherwise use 7-day TTL (was 1 day, too short)
      const daysUntilExpiry = stayLoggedIn ? REFRESH_TOKEN_TTL_DAYS : 7;
      const expiresAt = new Date(Date.now() + daysUntilExpiry * 24 * 60 * 60 * 1000).toISOString();

      logger.info(`[auth.login] before_db_insert_session ${JSON.stringify({ requestId, sessionId, daysUntilExpiry })}`);
      await db.run(
        'INSERT INTO auth_sessions (id, user_id, refresh_token_hash, expires_at, token_hash) VALUES (?, ?, ?, ?, ?)',
        [sessionId, user.id, refreshTokenHash, expiresAt, tokenHash]
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

    // Fast O(1) lookup using indexed token_hash instead of O(n) bcrypt comparisons
    const tokenHash = hashTokenForLookup(String(refreshToken));
    const session = await db.get<any>(
      'SELECT * FROM auth_sessions WHERE token_hash = ? AND expires_at > NOW()',
      [tokenHash]
    );

    // Fallback for sessions created before migration (without token_hash)
    if (!session) {
      // Check if there are any sessions without token_hash that might match
      const legacySessions = await db.all<any>(
        'SELECT * FROM auth_sessions WHERE token_hash IS NULL AND expires_at > NOW()'
      );

      for (const s of legacySessions) {
        const match = await bcrypt.compare(String(refreshToken), String(s.refresh_token_hash));
        if (match) {
          // Upgrade this session with the fast lookup hash
          await db.run('UPDATE auth_sessions SET token_hash = ? WHERE id = ?', [tokenHash, s.id]);

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
      }

      throw new UnauthorizedError('Invalid refresh token');
    }

    // Session found via fast lookup
    const user = await db.get<any>('SELECT * FROM users WHERE id = ? AND is_active = TRUE', [session.user_id]);
    if (!user) throw new UnauthorizedError('User not found or inactive');

    const accessToken = issueAccessToken({
      sub: user.id,
      restaurantId: user.restaurant_id,
      sid: session.id
    });
    return res.json({
      success: true,
      data: {
        user: safeUser(user),
        accessToken
      }
    });
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

    // Fast O(1) lookup and delete using indexed token_hash
    const tokenHash = hashTokenForLookup(String(refreshToken));
    const result = await db.run('DELETE FROM auth_sessions WHERE token_hash = ?', [tokenHash]);

    // Fallback for legacy sessions without token_hash
    if (result.changes === 0) {
      const legacySessions = await db.all<any>('SELECT * FROM auth_sessions WHERE token_hash IS NULL');
      for (const s of legacySessions) {
        const match = await bcrypt.compare(String(refreshToken), String(s.refresh_token_hash));
        if (match) {
          await db.run('DELETE FROM auth_sessions WHERE id = ?', [s.id]);
          break;
        }
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
    const tokenHash = hashTokenForLookup(refreshToken);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

    await db.run(
      'INSERT INTO auth_sessions (id, user_id, refresh_token_hash, expires_at, token_hash) VALUES (?, ?, ?, ?, ?)',
      [sessionId, targetUser.id, refreshTokenHash, expiresAt, tokenHash]
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

