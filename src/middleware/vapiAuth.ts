import { Request, Response, NextFunction } from 'express';
import { UnauthorizedError } from './errorHandler';

/**
 * Simple middleware to protect Vapi endpoints using a shared Bearer token.
 * Vapi sends: Authorization: Bearer <VAPI_API_KEY>
 */
export const requireVapiAuth = (req: Request, res: Response, next: NextFunction) => {
  const vapiKey = process.env.VAPI_API_KEY;
  
  if (!vapiKey) {
    // If no key is configured, allow for now but log warning
    console.warn('VAPI_API_KEY not configured in environment variables');
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing or invalid Authorization header');
  }

  const token = authHeader.split(' ')[1];
  if (token !== vapiKey) {
    throw new UnauthorizedError('Invalid Vapi API Key');
  }

  next();
};

/**
 * Webhook auth for Vapi -> Servio backend.
 *
 * Recommended: configure a Vapi Custom Credential (Bearer Token) that sends:
 *   X-Vapi-Secret: <VAPI_WEBHOOK_SECRET>
 *
 * This middleware intentionally does NOT use JWT.
 */
export const requireVapiWebhookAuth = (req: Request, _res: Response, next: NextFunction) => {
  const secret = process.env.VAPI_WEBHOOK_SECRET?.trim();

  const normalizeSecret = (value?: string | null) => {
    if (!value) return undefined;
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    return trimmed.replace(/^Bearer\s+/i, '');
  };

  // In dev, allow webhooks even without a configured secret (but warn).
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      return next(new UnauthorizedError('Vapi webhook secret not configured'));
    }
    console.warn('VAPI_WEBHOOK_SECRET not configured in environment variables');
    return next();
  }

  const headerSecret =
    req.headers['x-vapi-secret'] ??
    req.headers['x-vapi-webhook-secret'] ??
    req.headers['x-vapi-signature'];
  const providedRaw =
    typeof headerSecret === 'string'
      ? headerSecret
      : Array.isArray(headerSecret)
        ? headerSecret[0]
        : undefined;
  const provided = normalizeSecret(providedRaw);

  // Also allow standard Bearer token if you choose to configure it that way in Vapi.
  const authHeader = req.headers.authorization;
  const bearer = normalizeSecret(authHeader);

  if (provided === secret || bearer === secret) return next();
  return next(new UnauthorizedError('Invalid Vapi webhook secret'));
};
