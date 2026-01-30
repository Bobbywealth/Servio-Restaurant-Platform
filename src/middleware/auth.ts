import type { Request, Response, NextFunction } from 'express';
import jwt, { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import { DatabaseService } from '../services/DatabaseService';
import { UnauthorizedError, ForbiddenError } from './errorHandler';
import type { AccessTokenPayload, AuthUser } from '../types/auth';

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set. Set it to a secure random string.');
  }
  return secret;
};
const ACCESS_TOKEN_TTL_SECONDS = Number(process.env.ACCESS_TOKEN_TTL_SECONDS ?? 60 * 60 * 24); // 24 hours default

function parsePermissions(value: any): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '*') return ['*'];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      // ignore
    }
  }
  return [];
}

export function issueAccessToken(payload: Omit<AccessTokenPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: ACCESS_TOKEN_TTL_SECONDS });
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    // Vapi webhooks/tools do NOT send JWTs. Never run jwt.verify for these requests.
    // (These routes are protected separately via Vapi-specific auth.)
    if (req.originalUrl?.startsWith('/api/vapi/')) return next();

    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing Authorization header');
    }

    const token = header.slice('Bearer '.length).trim();
    let decoded: AccessTokenPayload;
    try {
      decoded = jwt.verify(token, getJwtSecret()) as AccessTokenPayload;
    } catch (err) {
      if (err instanceof TokenExpiredError) {
        throw new UnauthorizedError('Token expired');
      }
      if (err instanceof JsonWebTokenError) {
        throw new UnauthorizedError('Invalid token');
      }
      throw err;
    }
    const userId = decoded?.sub;
    if (!userId) throw new UnauthorizedError('Invalid token payload');

    const db = DatabaseService.getInstance().getDatabase();
    const userRow = await db.get<any>('SELECT * FROM users WHERE id = ? AND is_active = TRUE', [userId]);
    if (!userRow) throw new UnauthorizedError('User not found or inactive');

    const user: AuthUser = {
      id: userRow.id,
      restaurantId: String(userRow.restaurant_id),
      name: userRow.name,
      email: userRow.email ?? null,
      role: userRow.role,
      permissions: parsePermissions(userRow.permissions)
    };

    req.user = user;
    return next();
  } catch (err) {
    return next(err);
  }
}

export function requirePermission(permission: string) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user) return next(new UnauthorizedError());
    if (user.permissions.includes('*') || user.permissions.includes(permission)) return next();
    return next(new ForbiddenError(`Missing permission: ${permission}`));
  };
}
