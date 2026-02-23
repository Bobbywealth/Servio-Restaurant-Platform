import { Request, Response, NextFunction } from 'express';

declare global {
  namespace Express {
    interface Request {
      apiVersion: string;
    }
  }
}

export type ApiVersion = 'v1' | 'v2';

/**
 * API Versioning middleware
 * Supports URL-based versioning: /api/v1/* and /api/v2/*
 * Also supports header-based versioning: Accept: application/vnd.servio.v1+json
 */
export function apiVersioning(req: Request, res: Response, next: NextFunction): void {
  // Check URL path for version
  const pathMatch = req.path.match(/^\/v(\d+)/);
  
  if (pathMatch) {
    req.apiVersion = `v${pathMatch[1]}`;
  } else {
    // Check Accept header for version
    const acceptHeader = req.headers.accept || '';
    const versionMatch = acceptHeader.match(/application\/vnd\.servio\.v(\d+)\+json/);
    
    if (versionMatch) {
      req.apiVersion = `v${versionMatch[1]}`;
    } else {
      // Default to v1 for backwards compatibility
      req.apiVersion = 'v1';
    }
  }
  
  // Add version header to response
  res.setHeader('X-API-Version', req.apiVersion);
  
  next();
}

/**
 * Get version constraints for documentation
 */
export function getVersionInfo() {
  return {
    current: 'v2',
    supported: ['v1', 'v2'],
    deprecation: {
      v1: '2026-12-31' // v1 will be deprecated end of 2026
    },
    changes: {
      v1: 'Original API version',
      v2: 'Enhanced with better pagination, filtering, and bulk operations'
    }
  };
}
