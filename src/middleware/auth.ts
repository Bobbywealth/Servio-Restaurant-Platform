import type { Request, Response, NextFunction } from 'express';
import jwt, { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import { DatabaseService } from '../services/DatabaseService';
import { UnauthorizedError, ForbiddenError } from './errorHandler';
import type { AccessTokenPayload, AuthUser } from '../types/auth';
import { logger } from '../utils/logger';
import { ApiKeyService } from '../services/ApiKeyService';

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

    // Detect API keys before attempting JWT verification.
    // API keys use the sk_ prefix or are non-JWT bearer tokens (not 3 dot-separated segments).
    const isApiKey = token.startsWith('sk_');
    const jwtSegments = token.split('.');
    const looksLikeJwt = jwtSegments.length === 3;

    if (isApiKey || !looksLikeJwt) {
      // Validate as API key
      const validation = await ApiKeyService.validateApiKey(token);
      if (validation.valid && validation.apiKey) {
        const apiKey = validation.apiKey;

        // Populate req.apiKey for API-key-aware route handlers
        req.apiKey = apiKey;
        req.apiKeyAuth = true;

        // Build a synthetic AuthUser so existing route handlers that read req.user
        // (e.g. req.user.restaurantId) continue to work seamlessly.
        const syntheticUser: AuthUser = {
          id: `apikey:${apiKey.id}`,
          restaurantId: apiKey.restaurantId || '',
          name: `API Key: ${apiKey.name}`,
          email: null,
          role: apiKey.scopes.includes('admin:full') ? 'owner' : 'staff',
          permissions: apiKey.scopes.includes('admin:full') ? ['*'] : apiKey.scopes,
        };
        req.user = syntheticUser;

        logger.info(`[auth] API key authenticated: ${apiKey.keyPrefix}`, {
          apiKeyId: apiKey.id,
          restaurantId: apiKey.restaurantId,
        });
        return next();
      }
      throw new UnauthorizedError(validation.error || 'Invalid API key');
    }

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

    // Verify user has a valid restaurant_id
    if (!userRow.restaurant_id) {
      logger.error('User found but has null restaurant_id', { userId, userRow });
      throw new UnauthorizedError('User account is not associated with a restaurant. Please contact support.');
    }

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
