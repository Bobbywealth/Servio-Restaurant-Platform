import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

/**
 * Security middleware for assistant endpoints
 */

// Request size limiting for audio uploads
export const requestSizeLimit = (maxSize: number = 25 * 1024 * 1024) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = parseInt(req.headers['content-length'] || '0');
    
    if (contentLength > maxSize) {
      logger.warn('Request size limit exceeded', { 
        contentLength, 
        maxSize, 
        ip: req.ip,
        userAgent: req.headers['user-agent']
      });
      
      return res.status(413).json({
        success: false,
        error: {
          message: 'Request entity too large',
          type: 'PayloadTooLarge',
          maxSize: `${Math.round(maxSize / (1024 * 1024))}MB`
        }
      });
    }
    
    next();
  };
};

// Content type validation for audio endpoints
export const validateAudioContentType = (req: Request, res: Response, next: NextFunction) => {
  const contentType = req.headers['content-type'];
  
  if (!contentType || !contentType.includes('multipart/form-data')) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'Invalid content type. Expected multipart/form-data for audio upload.',
        type: 'InvalidContentType'
      }
    });
  }
  
  next();
};

// Content type validation for text endpoints
export const validateTextContentType = (req: Request, res: Response, next: NextFunction) => {
  const contentType = req.headers['content-type'];
  
  if (!contentType || !contentType.includes('application/json')) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'Invalid content type. Expected application/json for text input.',
        type: 'InvalidContentType'
      }
    });
  }
  
  next();
};

// Request logging for security monitoring
export const securityLogger = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  
  // Log request details
  logger.info('Assistant API request', {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    userId: req.user?.id,
    timestamp: new Date().toISOString()
  });

  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    
    logger.info('Assistant API response', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      userId: req.user?.id,
      ip: req.ip
    });

    // Log suspicious activity
    if (res.statusCode === 429) {
      logger.warn('Rate limit hit', {
        ip: req.ip,
        userId: req.user?.id,
        url: req.url
      });
    } else if (res.statusCode >= 400) {
      logger.warn('Assistant API error response', {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        ip: req.ip,
        userId: req.user?.id
      });
    }
  });

  next();
};

// IP whitelist validation (optional)
export const ipWhitelist = (allowedIPs: string[] = []) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (allowedIPs.length === 0) {
      return next(); // No whitelist configured
    }

    const clientIP = req.ip || req.socket.remoteAddress;
    
    if (!clientIP || !allowedIPs.includes(clientIP)) {
      logger.warn('IP not whitelisted', { 
        clientIP, 
        allowedIPs: allowedIPs.length,
        userId: req.user?.id 
      });
      
      return res.status(403).json({
        success: false,
        error: {
          message: 'Access denied',
          type: 'IPNotWhitelisted'
        }
      });
    }

    next();
  };
};

// User permission validation for assistant features
export const validateAssistantPermissions = (req: Request, res: Response, next: NextFunction) => {
  const user = req.user;
  
  if (!user) {
    return res.status(401).json({
      success: false,
      error: {
        message: 'Authentication required',
        type: 'Unauthorized'
      }
    });
  }

  // Check if user has assistant access
  if (user.role && !['manager', 'owner', 'admin'].includes(user.role)) {
    logger.warn('Insufficient permissions for assistant access', {
      userId: user.id,
      role: user.role,
      ip: req.ip
    });
    
    return res.status(403).json({
      success: false,
      error: {
        message: 'Insufficient permissions to access assistant features',
        type: 'InsufficientPermissions'
      }
    });
  }

  next();
};

export default {
  requestSizeLimit,
  validateAudioContentType,
  validateTextContentType,
  securityLogger,
  ipWhitelist,
  validateAssistantPermissions
};