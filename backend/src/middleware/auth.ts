import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { DatabaseService } from '../services/DatabaseService';
import { UnauthorizedError, ForbiddenError } from './errorHandler';
import type { AccessTokenPayload, AuthUser } from '../types/auth';

const getJwtSecret = () => process.env.JWT_SECRET || 'dev_insecure_jwt_secret_change_me';
const ACCESS_TOKEN_TTL_SECONDS = Number(process.env.ACCESS_TOKEN_TTL_SECONDS ?? 60 * 15); // 15m default

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
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing Authorization header');
    }

    const token = header.slice('Bearer '.length).trim();
    const decoded = jwt.verify(token, getJwtSecret()) as AccessTokenPayload;
    const userId = decoded?.sub;
    if (!userId) throw new UnauthorizedError('Invalid token payload');

    const db = DatabaseService.getInstance().getDatabase();
    const userRow = await db.get<any>('SELECT * FROM users WHERE id = ? AND (is_active = TRUE OR is_active = 1)', [userId]);
    if (!userRow) throw new UnauthorizedError('User not found or inactive');

    const user: AuthUser = {
      id: userRow.id,
      restaurantId: userRow.restaurant_id,
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

