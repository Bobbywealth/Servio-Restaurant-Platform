import { Request, Response, NextFunction } from 'express';
import { AuthUser } from '../types/auth';

// Extend Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/**
 * Middleware to ensure only platform admin users can access admin endpoints
 */
export const requirePlatformAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ 
      error: 'Authentication required',
      message: 'You must be logged in to access admin endpoints' 
    });
  }

  if (req.user.role !== 'platform-admin' && req.user.role !== 'admin') {
    return res.status(403).json({ 
      error: 'Platform admin access required',
      message: 'This endpoint requires platform administrator privileges',
      userRole: req.user.role
    });
  }

  next();
};

/**
 * Middleware to prevent access to tenant-specific endpoints for platform admins
 */
export const preventTenantAccess = (req: Request, res: Response, next: NextFunction) => {
  if (req.user && (req.user.role === 'platform-admin' || req.user.role === 'admin')) {
    return res.status(403).json({
      error: 'Platform admin cannot access tenant endpoints',
      message: 'Use admin-specific endpoints instead'
    });
  }

  next();
};