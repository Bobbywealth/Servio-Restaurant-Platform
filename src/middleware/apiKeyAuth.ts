import type { Request, Response, NextFunction } from 'express';
import { ApiKeyService } from '../services/ApiKeyService';
import { UnauthorizedError, ForbiddenError, TooManyRequestsError } from './errorHandler';
import { ApiKey, ApiKeyScope } from '../types/apiKey';
import { logger } from '../utils/logger';

type ScopedApiResource = 'orders' | 'menu' | 'inventory' | 'staff';

const READ_METHODS = new Set(['GET', 'HEAD']);
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// Extend Express Request type for API key
declare global {
  namespace Express {
    interface Request {
      apiKey?: ApiKey;
      apiKeyAuth?: boolean;
    }
  }
}

export interface ApiKeyAuthOptions {
  /**
   * Required scopes for the endpoint
   */
  requiredScopes?: ApiKeyScope[];
  
  /**
   * Enable rate limiting for this endpoint
   */
  rateLimit?: boolean;
  
  /**
   * Custom rate limit (overrides key's default)
   */
  customRateLimit?: number;
  
  /**
   * Allow fallback to JWT auth if API key is not present
   */
  allowJwtFallback?: boolean;
  
  /**
   * Record usage statistics
   */
  recordUsage?: boolean;
}

/**
 * Extract API key from request
 * Supports: Authorization header (Bearer), X-API-Key header
 */
function extractApiKey(req: Request): string | null {
  const normalizeApiKeyCandidate = (value: string): string => {
    const trimmed = value.trim();

    // Tolerate accidental wrapping quotes from copied values.
    if (
      (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))
    ) {
      return trimmed.slice(1, -1).trim();
    }

    return trimmed;
  };

  // Check Authorization header (Bearer token style - case-insensitive)
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string') {
    const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
    const token = bearerMatch
      ? normalizeApiKeyCandidate(bearerMatch[1])
      : normalizeApiKeyCandidate(authHeader);

    if (!token) {
      return null;
    }

    // Standard API key prefix used by Servio
    if (token.startsWith('sk_')) {
      return token;
    }

    // Non-JWT bearer tokens should still be treated as API key candidates.
    // This avoids falling through to JWT verification and returning "Invalid token"
    // when callers provide a valid key format from integrations.
    const jwtSegments = token.split('.');
    if (jwtSegments.length !== 3) {
      return token;
    }
  }

  // Check X-API-Key header
  const apiKeyHeader = req.headers['x-api-key'];
  if (typeof apiKeyHeader === 'string') {
    const trimmed = normalizeApiKeyCandidate(apiKeyHeader);
    if (trimmed.length > 0) {
      return trimmed;
    }
  }

  return null;
}

/**
 * Middleware to require API key authentication
 */
export function requireApiKey(options: ApiKeyAuthOptions = {}) {
  const {
    requiredScopes = [],
    rateLimit = true,
    customRateLimit,
    allowJwtFallback = false,
    recordUsage = true,
  } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    
    try {
      const keyString = extractApiKey(req);

      // If no API key present
      if (!keyString) {
        if (allowJwtFallback && req.user) {
          // Fall back to JWT auth (already authenticated)
          return next();
        }
        return next(new UnauthorizedError('API key required. Provide via Authorization: Bearer <key> or X-API-Key header'));
      }

      // Validate the API key
      const validation = await ApiKeyService.validateApiKey(keyString, requiredScopes);

      if (!validation.valid) {
        return next(new UnauthorizedError(validation.error || 'Invalid API key'));
      }

      const apiKey = validation.apiKey!;
      req.apiKey = apiKey;
      req.apiKeyAuth = true;

      // Check rate limit
      if (rateLimit) {
        const rateLimitInfo = await ApiKeyService.checkRateLimit(
          apiKey.id,
          customRateLimit || apiKey.rateLimit
        );

        // Set rate limit headers
        res.set('X-RateLimit-Limit', String(rateLimitInfo.limit));
        res.set('X-RateLimit-Remaining', String(rateLimitInfo.remaining));
        res.set('X-RateLimit-Reset', rateLimitInfo.resetAt.toISOString());

        if (rateLimitInfo.remaining <= 0) {
          return next(new TooManyRequestsError('Rate limit exceeded', rateLimitInfo.resetAt));
        }
      }

      // Continue to the route handler
      const originalEnd = res.end;
      const originalJson = res.json;

      // Intercept response to record usage
      if (recordUsage) {
        const recordRequest = (statusCode: number) => {
          const responseTimeMs = Date.now() - startTime;
          
          ApiKeyService.recordUsage({
            apiKeyId: apiKey.id,
            endpoint: req.originalUrl || req.url,
            method: req.method,
            statusCode,
            responseTimeMs,
            ipAddress: req.ip || req.socket.remoteAddress,
            userAgent: req.headers['user-agent'],
            requestSizeBytes: req.headers['content-length']
              ? parseInt(req.headers['content-length'], 10)
              : undefined,
          }).catch(err => {
            logger.error('Failed to record API key usage:', err);
          });
        };

        // Override res.end
        res.end = function (this: Response, ...args: any[]): Response {
          recordRequest(res.statusCode);
          return originalEnd.apply(this, args as any);
        } as typeof res.end;

        // Override res.json
        res.json = function (this: Response, ...args: any[]): Response {
          recordRequest(res.statusCode);
          return originalJson.apply(this, args as any);
        } as typeof res.json;
      }

      return next();
    } catch (error) {
      logger.error('API key authentication error:', error);
      return next(new UnauthorizedError('API key authentication failed'));
    }
  };
}

/**
 * Middleware to optionally accept API key or JWT auth
 * If API key is present, validates it; otherwise falls back to JWT
 */
export function optionalApiKey(options: ApiKeyAuthOptions = {}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const keyString = extractApiKey(req);

    if (!keyString) {
      // No API key, continue without setting req.apiKey
      return next();
    }

    // Use requireApiKey logic
    return requireApiKey({ ...options, allowJwtFallback: true })(req, res, next);
  };
}

/**
 * Middleware to require specific API key scopes
 * Must be used after requireApiKey or optionalApiKey
 */
export function requireApiKeyScopes(scopes: ApiKeyScope[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const apiKey = req.apiKey;

    if (!apiKey) {
      return next(new UnauthorizedError('API key not authenticated'));
    }

    // Admin:full scope grants all permissions
    if (apiKey.scopes.includes('admin:full')) {
      return next();
    }

    // Check if all required scopes are present
    const hasAllScopes = scopes.every(scope => apiKey.scopes.includes(scope));

    if (!hasAllScopes) {
      const missingScopes = scopes.filter(scope => !apiKey.scopes.includes(scope));
      return next(new ForbiddenError(
        `Missing scope(s): ${missingScopes.join(', ')}. Required scope(s): ${scopes.join(', ')}`
      ));
    }

    return next();
  };
}

function getScopeForHttpMethod(resource: ScopedApiResource, method: string): ApiKeyScope | null {
  const normalizedMethod = method.toUpperCase();

  if (READ_METHODS.has(normalizedMethod)) {
    return `read:${resource}` as ApiKeyScope;
  }

  if (WRITE_METHODS.has(normalizedMethod)) {
    return `write:${resource}` as ApiKeyScope;
  }

  return null;
}

/**
 * Middleware to require per-method API key scope for a resource.
 * GET/HEAD require read scope, POST/PUT/PATCH/DELETE require write scope.
 */
export function requireApiKeyScopeByHttpMethod(resource: ScopedApiResource) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.apiKey) {
      return next();
    }

    if (req.apiKey.scopes.includes('admin:full')) {
      return next();
    }

    const requiredScope = getScopeForHttpMethod(resource, req.method);
    if (!requiredScope) {
      return next();
    }

    if (req.apiKey.scopes.includes(requiredScope)) {
      return next();
    }

    return next(new ForbiddenError(
      `Missing scope: ${requiredScope}. Required scope for ${req.method.toUpperCase()} ${req.originalUrl || req.url}: ${requiredScope}`
    ));
  };
}

/**
 * Helper to check if request is authenticated via API key
 */
export function isApiKeyAuth(req: Request): boolean {
  return !!req.apiKeyAuth && !!req.apiKey;
}

/**
 * Helper to get the effective restaurant ID from API key or user session
 */
export function getEffectiveRestaurantId(req: Request): string | null {
  if (req.apiKey) {
    return req.apiKey.restaurantId || null;
  }
  if (req.user) {
    return req.user.restaurantId;
  }
  return null;
}

/**
 * Helper to get the effective company ID from API key or user session
 */
export function getEffectiveCompanyId(req: Request): string | null {
  if (req.apiKey) {
    return req.apiKey.companyId || null;
  }
  if (req.user) {
    return req.user.companyId || null;
  }
  return null;
}

/**
 * Combined auth middleware that accepts either API key or JWT
 * Sets both req.apiKey (if API key auth) and req.user (if JWT auth)
 */
export function requireAuthOrApiKey(options: ApiKeyAuthOptions = {}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const keyString = extractApiKey(req);

    if (keyString) {
      // Use API key auth
      return requireApiKey({ ...options, allowJwtFallback: true })(req, res, next);
    }

    // Fall back to JWT auth - import requireAuth dynamically to avoid circular deps
    const { requireAuth } = await import('./auth');
    return requireAuth(req, res, next);
  };
}

export default {
  requireApiKey,
  optionalApiKey,
  requireApiKeyScopes,
  requireApiKeyScopeByHttpMethod,
  isApiKeyAuth,
  getEffectiveRestaurantId,
  getEffectiveCompanyId,
  requireAuthOrApiKey,
};
