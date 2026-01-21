import { body, param, query, validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';
import sanitizeHtml from 'sanitize-html';
import { logger } from '../utils/logger';

/**
 * Middleware to handle validation errors
 */
export const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorDetails = errors.array().map(err => ({
      field: err.type === 'field' ? err.path : 'unknown',
      message: err.msg,
      value: err.type === 'field' ? err.value : undefined
    }));

    logger.warn('Validation failed', {
      path: req.path,
      method: req.method,
      errors: errorDetails,
      userId: req.user?.id,
      ip: req.ip
    });

    return res.status(400).json({
      success: false,
      error: {
        message: 'Validation failed',
        type: 'ValidationError',
        details: errorDetails
      }
    });
  }
  
  next();
};

/**
 * Sanitize string input to prevent XSS attacks
 */
export const sanitizeString = (value: any): string => {
  if (typeof value !== 'string') return '';
  return sanitizeHtml(value, {
    allowedTags: [],
    allowedAttributes: {},
    disallowedTagsMode: 'recursiveEscape'
  }).trim();
};

/**
 * Sanitize HTML input (allows safe HTML tags)
 */
export const sanitizeHTML = (value: any): string => {
  if (typeof value !== 'string') return '';
  // Server-side sanitizer (avoid DOMPurify dependency / browser globals)
  return sanitizeHtml(value, {
    allowedTags: ['b', 'i', 'em', 'strong', 'p', 'br', 'ul', 'ol', 'li'],
    allowedAttributes: {}
  }).trim();
};

/**
 * Custom sanitizer for text fields
 */
export const sanitizeText = (field: string) => {
  return body(field).customSanitizer(sanitizeString);
};

/**
 * Custom sanitizer for HTML fields
 */
export const sanitizeHTMLField = (field: string) => {
  return body(field).customSanitizer(sanitizeHTML);
};

/**
 * Validation rules for common fields
 */

// Email validation
export const validateEmail = (field: string = 'email') => 
  body(field)
    .isEmail()
    .normalizeEmail()
    .withMessage('Invalid email address');

// Password validation
export const validatePassword = (field: string = 'password') =>
  body(field)
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number');

// Phone number validation
export const validatePhone = (field: string = 'phone') =>
  body(field)
    .matches(/^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/)
    .withMessage('Invalid phone number format');

// UUID validation
export const validateUUID = (field: string, location: 'param' | 'body' | 'query' = 'param') => {
  const validator = location === 'param' ? param(field) : 
                    location === 'body' ? body(field) : 
                    query(field);
  
  return validator
    .isUUID()
    .withMessage(`${field} must be a valid UUID`);
};

// Integer validation
export const validateInteger = (field: string, location: 'body' | 'query' = 'body', min?: number, max?: number) => {
  const validator = location === 'body' ? body(field) : query(field);
  
  let chain = validator.isInt();
  
  if (min !== undefined && max !== undefined) {
    chain = chain.isInt({ min, max }).withMessage(`${field} must be between ${min} and ${max}`);
  } else if (min !== undefined) {
    chain = chain.isInt({ min }).withMessage(`${field} must be at least ${min}`);
  } else if (max !== undefined) {
    chain = chain.isInt({ max }).withMessage(`${field} must be at most ${max}`);
  }
  
  return chain.toInt();
};

// Float validation
export const validateFloat = (field: string, location: 'body' | 'query' = 'body', min?: number, max?: number) => {
  const validator = location === 'body' ? body(field) : query(field);
  
  let chain = validator.isFloat();
  
  if (min !== undefined && max !== undefined) {
    chain = chain.isFloat({ min, max }).withMessage(`${field} must be between ${min} and ${max}`);
  } else if (min !== undefined) {
    chain = chain.isFloat({ min }).withMessage(`${field} must be at least ${min}`);
  } else if (max !== undefined) {
    chain = chain.isFloat({ max }).withMessage(`${field} must be at most ${max}`);
  }
  
  return chain.toFloat();
};

// Boolean validation
export const validateBoolean = (field: string, location: 'body' | 'query' = 'body') => {
  const validator = location === 'body' ? body(field) : query(field);
  return validator.isBoolean().withMessage(`${field} must be a boolean`).toBoolean();
};

// Date validation
export const validateDate = (field: string, location: 'body' | 'query' = 'body') => {
  const validator = location === 'body' ? body(field) : query(field);
  return validator.isISO8601().withMessage(`${field} must be a valid ISO 8601 date`).toDate();
};

// URL validation
export const validateURL = (field: string, location: 'body' | 'query' = 'body') => {
  const validator = location === 'body' ? body(field) : query(field);
  return validator.isURL({ protocols: ['http', 'https'] }).withMessage(`${field} must be a valid URL`);
};

// Array validation
export const validateArray = (field: string, minLength?: number, maxLength?: number) => {
  let chain = body(field).isArray().withMessage(`${field} must be an array`);
  
  if (minLength !== undefined) {
    chain = chain.isArray({ min: minLength }).withMessage(`${field} must contain at least ${minLength} items`);
  }
  
  if (maxLength !== undefined) {
    chain = chain.isArray({ max: maxLength }).withMessage(`${field} must contain at most ${maxLength} items`);
  }
  
  return chain;
};

// String length validation
export const validateStringLength = (field: string, min: number, max: number, location: 'body' | 'query' = 'body') => {
  const validator = location === 'body' ? body(field) : query(field);
  return validator
    .isString()
    .isLength({ min, max })
    .withMessage(`${field} must be between ${min} and ${max} characters`)
    .customSanitizer(sanitizeString);
};

// Enum validation
export const validateEnum = (field: string, allowedValues: string[], location: 'body' | 'query' = 'body') => {
  const validator = location === 'body' ? body(field) : query(field);
  return validator
    .isIn(allowedValues)
    .withMessage(`${field} must be one of: ${allowedValues.join(', ')}`);
};

/**
 * Common validation chains for specific entities
 */

// Order validation
export const validateOrderCreation = [
  validateUUID('restaurantId', 'body'),
  validateEnum('channel', ['online', 'phone', 'in-person', 'voice'], 'body'),
  validateEnum('type', ['dine-in', 'takeout', 'delivery'], 'body'),
  validateArray('items', 1),
  body('items.*.menuItemId').isUUID().withMessage('Each item must have a valid menuItemId'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('items.*.price').isFloat({ min: 0 }).withMessage('Price must be positive'),
  body('customerInfo.name').optional().customSanitizer(sanitizeString),
  body('customerInfo.phone').optional().matches(/^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/),
  body('customerInfo.email').optional().isEmail().normalizeEmail(),
  handleValidationErrors
];

// Inventory validation
export const validateInventoryUpdate = [
  validateUUID('id', 'param'),
  body('currentQuantity').optional().isFloat({ min: 0 }).withMessage('Quantity must be positive').toFloat(),
  body('reorderPoint').optional().isFloat({ min: 0 }).withMessage('Reorder point must be positive').toFloat(),
  body('unit').optional().isString().customSanitizer(sanitizeString),
  handleValidationErrors
];

// Menu item validation
export const validateMenuItemCreation = [
  validateUUID('restaurantId', 'body'),
  validateStringLength('name', 1, 255, 'body'),
  body('description').optional().customSanitizer(sanitizeHTML),
  validateFloat('price', 'body', 0),
  validateStringLength('category', 1, 100, 'body'),
  validateBoolean('isAvailable', 'body'),
  body('imageUrl').optional().isURL(),
  handleValidationErrors
];

// Task validation
export const validateTaskCreation = [
  validateUUID('restaurantId', 'body'),
  validateStringLength('title', 1, 255, 'body'),
  body('description').optional().customSanitizer(sanitizeHTML),
  validateEnum('status', ['pending', 'in-progress', 'completed', 'cancelled'], 'body'),
  validateEnum('priority', ['low', 'medium', 'high', 'urgent'], 'body'),
  body('assignedTo').optional().isUUID(),
  body('dueDate').optional().isISO8601().toDate(),
  handleValidationErrors
];

// User authentication validation
export const validateUserLogin = [
  validateEmail(),
  body('password').notEmpty().withMessage('Password is required'),
  handleValidationErrors
];

export const validateUserRegistration = [
  validateEmail(),
  validatePassword(),
  validateStringLength('name', 2, 255, 'body'),
  body('role').optional().isIn(['owner', 'manager', 'staff']).withMessage('Invalid role'),
  handleValidationErrors
];

// Generic SQL injection prevention
export const preventSQLInjection = (req: Request, res: Response, next: NextFunction) => {
  // Allow external webhooks / voice payloads to pass through.
  // These endpoints accept natural language (often contains apostrophes/keywords like "union"),
  // and all DB access should be parameterized.
  if (req.path.startsWith('/api/vapi') || req.path.startsWith('/api/voice')) {
    return next();
  }

  const sqlInjectionPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|DECLARE)\b)/gi,
    /(;|--|\/\*|\*\/|xp_|sp_)/gi
  ];

  const checkForInjection = (obj: any): boolean => {
    if (typeof obj === 'string') {
      return sqlInjectionPatterns.some(pattern => pattern.test(obj));
    }
    
    if (typeof obj === 'object' && obj !== null) {
      return Object.values(obj).some(value => checkForInjection(value));
    }
    
    return false;
  };

  // Check body, query, and params
  const hasInjection = checkForInjection(req.body) || 
                       checkForInjection(req.query) || 
                       checkForInjection(req.params);

  if (hasInjection) {
    logger.error('Potential SQL injection attempt detected', {
      ip: req.ip,
      path: req.path,
      method: req.method,
      body: req.body,
      query: req.query,
      params: req.params,
      userId: req.user?.id
    });

    return res.status(400).json({
      success: false,
      error: {
        message: 'Invalid input detected',
        type: 'SecurityViolation'
      }
    });
  }

  next();
};

export default {
  handleValidationErrors,
  sanitizeString,
  sanitizeHTML,
  sanitizeText,
  sanitizeHTMLField,
  validateEmail,
  validatePassword,
  validatePhone,
  validateUUID,
  validateInteger,
  validateFloat,
  validateBoolean,
  validateDate,
  validateURL,
  validateArray,
  validateStringLength,
  validateEnum,
  validateOrderCreation,
  validateInventoryUpdate,
  validateMenuItemCreation,
  validateTaskCreation,
  validateUserLogin,
  validateUserRegistration,
  preventSQLInjection
};
