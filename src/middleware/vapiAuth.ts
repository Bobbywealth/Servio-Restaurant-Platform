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
