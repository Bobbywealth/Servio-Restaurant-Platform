/**
 * Menu Validation Middleware
 * Provides request validation for menu-related endpoints
 */

import { Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult, ValidationError } from 'express-validator';

/**
 * Validation error formatter
 */
const formatErrors = (errors: ValidationError[]) => {
  return errors.map(err => ({
    field: err.type === 'field' ? err.path : 'unknown',
    message: err.msg,
    value: err.type === 'field' ? err.value : undefined
  }));
};

/**
 * Middleware to check validation results
 */
export const checkValidation = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'Validation failed',
        details: formatErrors(errors.array())
      }
    });
  }
  next();
};

/**
 * Validation rules for creating a menu category
 */
export const validateCreateCategory = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Category name is required')
    .isLength({ max: 100 })
    .withMessage('Category name must be 100 characters or less'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must be 500 characters or less'),
  
  body('sort_order')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Sort order must be a non-negative integer'),
  
  body('is_active')
    .optional()
    .isBoolean()
    .withMessage('is_active must be a boolean'),
  
  checkValidation
];

/**
 * Validation rules for updating a menu category
 */
export const validateUpdateCategory = [
  param('id')
    .isUUID()
    .withMessage('Invalid category ID'),
  
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Category name cannot be empty')
    .isLength({ max: 100 })
    .withMessage('Category name must be 100 characters or less'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must be 500 characters or less'),
  
  body('sort_order')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Sort order must be a non-negative integer'),
  
  body('is_active')
    .optional()
    .isBoolean()
    .withMessage('is_active must be a boolean'),
  
  body('is_hidden')
    .optional()
    .isBoolean()
    .withMessage('is_hidden must be a boolean'),
  
  checkValidation
];

/**
 * Validation rules for creating a menu item
 */
export const validateCreateItem = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Item name is required')
    .isLength({ max: 200 })
    .withMessage('Item name must be 200 characters or less'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must be 1000 characters or less'),
  
  body('price')
    .notEmpty()
    .withMessage('Price is required')
    .isFloat({ min: 0 })
    .withMessage('Price must be a non-negative number'),
  
  body('category_id')
    .notEmpty()
    .withMessage('Category ID is required')
    .isUUID()
    .withMessage('Invalid category ID'),
  
  body('cost')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Cost must be a non-negative number'),
  
  body('preparation_time')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Preparation time must be a non-negative integer'),
  
  body('is_available')
    .optional()
    .isBoolean()
    .withMessage('is_available must be a boolean'),
  
  body('is_featured')
    .optional()
    .isBoolean()
    .withMessage('is_featured must be a boolean'),
  
  body('allergens')
    .optional()
    .isArray()
    .withMessage('Allergens must be an array'),
  
  body('dietary_info')
    .optional()
    .isArray()
    .withMessage('Dietary info must be an array'),
  
  body('sizes')
    .optional()
    .isArray()
    .withMessage('Sizes must be an array')
    .custom((sizes) => {
      if (!Array.isArray(sizes)) return true;
      for (const size of sizes) {
        if (!size.sizeName || typeof size.sizeName !== 'string') {
          throw new Error('Each size must have a valid sizeName');
        }
        if (typeof size.price !== 'number' || size.price < 0) {
          throw new Error('Each size must have a valid non-negative price');
        }
      }
      return true;
    }),
  
  body('modifier_groups')
    .optional()
    .isArray()
    .withMessage('Modifier groups must be an array'),
  
  checkValidation
];

/**
 * Validation rules for updating a menu item
 */
export const validateUpdateItem = [
  param('id')
    .isUUID()
    .withMessage('Invalid item ID'),
  
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Item name cannot be empty')
    .isLength({ max: 200 })
    .withMessage('Item name must be 200 characters or less'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must be 1000 characters or less'),
  
  body('price')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Price must be a non-negative number'),
  
  body('category_id')
    .optional()
    .isUUID()
    .withMessage('Invalid category ID'),
  
  body('cost')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Cost must be a non-negative number'),
  
  body('preparation_time')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Preparation time must be a non-negative integer'),
  
  body('is_available')
    .optional()
    .isBoolean()
    .withMessage('is_available must be a boolean'),
  
  body('is_featured')
    .optional()
    .isBoolean()
    .withMessage('is_featured must be a boolean'),
  
  body('allergens')
    .optional()
    .isArray()
    .withMessage('Allergens must be an array'),
  
  body('dietary_info')
    .optional()
    .isArray()
    .withMessage('Dietary info must be an array'),
  
  body('sizes')
    .optional()
    .isArray()
    .withMessage('Sizes must be an array'),
  
  body('modifier_groups')
    .optional()
    .isArray()
    .withMessage('Modifier groups must be an array'),
  
  checkValidation
];

/**
 * Validation rules for bulk operations
 */
export const validateBulkDelete = [
  body('itemIds')
    .isArray({ min: 1 })
    .withMessage('itemIds must be a non-empty array')
    .custom((ids) => {
      if (!Array.isArray(ids)) return true;
      for (const id of ids) {
        if (typeof id !== 'string' || !id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
          throw new Error('All item IDs must be valid UUIDs');
        }
      }
      return true;
    }),
  
  checkValidation
];

export const validateBulkAvailability = [
  body('itemIds')
    .isArray({ min: 1 })
    .withMessage('itemIds must be a non-empty array'),
  
  body('isAvailable')
    .isBoolean()
    .withMessage('isAvailable must be a boolean'),
  
  checkValidation
];

export const validateBulkCategory = [
  body('itemIds')
    .isArray({ min: 1 })
    .withMessage('itemIds must be a non-empty array'),
  
  body('categoryId')
    .isUUID()
    .withMessage('categoryId must be a valid UUID'),
  
  checkValidation
];

export const validateBulkFeatured = [
  body('itemIds')
    .isArray({ min: 1 })
    .withMessage('itemIds must be a non-empty array'),
  
  body('isFeatured')
    .isBoolean()
    .withMessage('isFeatured must be a boolean'),
  
  checkValidation
];

/**
 * Validation rules for modifier groups
 */
export const validateCreateModifierGroup = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Modifier group name is required')
    .isLength({ max: 100 })
    .withMessage('Name must be 100 characters or less'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must be 500 characters or less'),
  
  body('selectionType')
    .optional()
    .isIn(['single', 'multiple', 'quantity'])
    .withMessage('Selection type must be single, multiple, or quantity'),
  
  body('minSelections')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Min selections must be a non-negative integer'),
  
  body('maxSelections')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Max selections must be a positive integer')
    .custom((value, { req }) => {
      const minSelections = req.body.minSelections || 0;
      if (value !== null && value < minSelections) {
        throw new Error('Max selections cannot be less than min selections');
      }
      return true;
    }),
  
  body('isRequired')
    .optional()
    .isBoolean()
    .withMessage('isRequired must be a boolean'),
  
  checkValidation
];

/**
 * Validation rules for modifier options
 */
export const validateCreateModifierOption = [
  param('groupId')
    .isUUID()
    .withMessage('Invalid modifier group ID'),
  
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Option name is required')
    .isLength({ max: 100 })
    .withMessage('Name must be 100 characters or less'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must be 500 characters or less'),
  
  body('priceDelta')
    .optional()
    .isFloat()
    .withMessage('Price delta must be a number'),
  
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
  
  checkValidation
];

/**
 * Validation rules for reordering
 */
export const validateReorderItems = [
  body('itemIds')
    .isArray({ min: 1 })
    .withMessage('itemIds must be a non-empty array'),
  
  checkValidation
];

export const validateReorderCategories = [
  body('categoryIds')
    .isArray({ min: 1 })
    .withMessage('categoryIds must be a non-empty array'),
  
  checkValidation
];

/**
 * File upload validation
 */
export const validateImageUpload = (req: Request, res: Response, next: NextFunction) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: { message: 'No file uploaded' }
    });
  }

  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowedMimeTypes.includes(req.file.mimetype)) {
    return res.status(400).json({
      success: false,
      error: { 
        message: 'Invalid file type. Allowed types: JPEG, PNG, WebP, GIF' 
      }
    });
  }

  const maxSize = 10 * 1024 * 1024; // 10MB
  if (req.file.size > maxSize) {
    return res.status(400).json({
      success: false,
      error: { 
        message: 'File too large. Maximum size is 10MB' 
      }
    });
  }

  next();
};

/**
 * Menu import validation
 */
export const validateMenuImport = (req: Request, res: Response, next: NextFunction) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: { message: 'No file uploaded' }
    });
  }

  const allowedMimeTypes = [
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];
  
  const allowedExtensions = ['.csv', '.xls', '.xlsx', '.pdf', '.docx'];
  const ext = req.file.originalname.toLowerCase().slice(req.file.originalname.lastIndexOf('.'));
  
  if (!allowedMimeTypes.includes(req.file.mimetype) && !allowedExtensions.includes(ext)) {
    return res.status(400).json({
      success: false,
      error: { 
        message: 'Unsupported file type. Use CSV, XLS/XLSX, PDF, or DOCX.' 
      }
    });
  }

  const maxSize = 25 * 1024 * 1024; // 25MB
  if (req.file.size > maxSize) {
    return res.status(400).json({
      success: false,
      error: { 
        message: 'File too large. Maximum size is 25MB' 
      }
    });
  }

  next();
};

export default {
  checkValidation,
  validateCreateCategory,
  validateUpdateCategory,
  validateCreateItem,
  validateUpdateItem,
  validateBulkDelete,
  validateBulkAvailability,
  validateBulkCategory,
  validateBulkFeatured,
  validateCreateModifierGroup,
  validateCreateModifierOption,
  validateReorderItems,
  validateReorderCategories,
  validateImageUpload,
  validateMenuImport
};
