/**
 * Menu Validation Middleware
 * Provides request validation for menu-related endpoints
 */

import { Request, Response, NextFunction } from 'express';

/**
 * Validation error type
 */
interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

/**
 * Validate a string field
 */
const validateString = (
  value: any,
  field: string,
  options: { required?: boolean; minLength?: number; maxLength?: number } = {}
): ValidationError | null => {
  const { required = false, minLength, maxLength } = options;

  if (value === undefined || value === null || value === '') {
    if (required) {
      return { field, message: `${field} is required` };
    }
    return null;
  }

  if (typeof value !== 'string') {
    return { field, message: `${field} must be a string` };
  }

  const trimmed = value.trim();
  
  if (required && trimmed.length === 0) {
    return { field, message: `${field} cannot be empty` };
  }

  if (minLength !== undefined && trimmed.length < minLength) {
    return { field, message: `${field} must be at least ${minLength} characters` };
  }

  if (maxLength !== undefined && trimmed.length > maxLength) {
    return { field, message: `${field} must be at most ${maxLength} characters` };
  }

  return null;
};

/**
 * Validate a number field
 */
const validateNumber = (
  value: any,
  field: string,
  options: { required?: boolean; min?: number; max?: number } = {}
): ValidationError | null => {
  const { required = false, min, max } = options;

  if (value === undefined || value === null || value === '') {
    if (required) {
      return { field, message: `${field} is required` };
    }
    return null;
  }

  const num = Number(value);
  
  if (isNaN(num)) {
    return { field, message: `${field} must be a number` };
  }

  if (min !== undefined && num < min) {
    return { field, message: `${field} must be at least ${min}` };
  }

  if (max !== undefined && num > max) {
    return { field, message: `${field} must be at most ${max}` };
  }

  return null;
};

/**
 * Validate a boolean field
 */
const validateBoolean = (
  value: any,
  field: string,
  options: { required?: boolean } = {}
): ValidationError | null => {
  const { required = false } = options;

  if (value === undefined || value === null) {
    if (required) {
      return { field, message: `${field} is required` };
    }
    return null;
  }

  if (typeof value !== 'boolean' && !['true', 'false', '0', '1'].includes(String(value))) {
    return { field, message: `${field} must be a boolean` };
  }

  return null;
};

/**
 * Validate UUID format
 */
const validateUUID = (
  value: any,
  field: string,
  options: { required?: boolean } = {}
): ValidationError | null => {
  const { required = false } = options;

  if (value === undefined || value === null || value === '') {
    if (required) {
      return { field, message: `${field} is required` };
    }
    return null;
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  
  if (!uuidRegex.test(String(value))) {
    return { field, message: `${field} must be a valid UUID` };
  }

  return null;
};

/**
 * Validate array field
 */
const validateArray = (
  value: any,
  field: string,
  options: { required?: boolean; minLength?: number; maxLength?: number } = {}
): ValidationError | null => {
  const { required = false, minLength, maxLength } = options;

  if (value === undefined || value === null) {
    if (required) {
      return { field, message: `${field} is required` };
    }
    return null;
  }

  if (!Array.isArray(value)) {
    return { field, message: `${field} must be an array` };
  }

  if (minLength !== undefined && value.length < minLength) {
    return { field, message: `${field} must have at least ${minLength} items` };
  }

  if (maxLength !== undefined && value.length > maxLength) {
    return { field, message: `${field} must have at most ${maxLength} items` };
  }

  return null;
};

/**
 * Check validation results and send error response if invalid
 */
const checkValidation = (req: Request, res: Response, next: NextFunction) => {
  const errors = (req as any).validationErrors || [];
  
  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'Validation failed',
        details: errors
      }
    });
  }
  
  next();
};

/**
 * Add validation error to request
 */
const addError = (req: Request, error: ValidationError) => {
  if (!(req as any).validationErrors) {
    (req as any).validationErrors = [];
  }
  (req as any).validationErrors.push(error);
};

/**
 * Validation rules for creating a menu category
 */
export const validateCreateCategory = [
  (req: Request, res: Response, next: NextFunction) => {
    const errors: ValidationError[] = [];
    
    const nameError = validateString(req.body.name, 'name', { required: true, maxLength: 100 });
    if (nameError) errors.push(nameError);
    
    const descError = validateString(req.body.description, 'description', { maxLength: 500 });
    if (descError) errors.push(descError);
    
    const sortOrderError = validateNumber(req.body.sort_order, 'sort_order', { min: 0 });
    if (sortOrderError) errors.push(sortOrderError);
    
    const activeError = validateBoolean(req.body.is_active, 'is_active');
    if (activeError) errors.push(activeError);
    
    errors.forEach(e => addError(req, e));
    next();
  },
  checkValidation
];

/**
 * Validation rules for updating a menu category
 */
export const validateUpdateCategory = [
  (req: Request, res: Response, next: NextFunction) => {
    const errors: ValidationError[] = [];
    
    const idError = validateUUID(req.params.id, 'id', { required: true });
    if (idError) errors.push(idError);
    
    const nameError = validateString(req.body.name, 'name', { maxLength: 100 });
    if (nameError) errors.push(nameError);
    
    const descError = validateString(req.body.description, 'description', { maxLength: 500 });
    if (descError) errors.push(descError);
    
    const sortOrderError = validateNumber(req.body.sort_order, 'sort_order', { min: 0 });
    if (sortOrderError) errors.push(sortOrderError);
    
    const activeError = validateBoolean(req.body.is_active, 'is_active');
    if (activeError) errors.push(activeError);
    
    const hiddenError = validateBoolean(req.body.is_hidden, 'is_hidden');
    if (hiddenError) errors.push(hiddenError);
    
    errors.forEach(e => addError(req, e));
    next();
  },
  checkValidation
];

/**
 * Validation rules for creating a menu item
 */
export const validateCreateItem = [
  (req: Request, res: Response, next: NextFunction) => {
    const errors: ValidationError[] = [];
    
    const nameError = validateString(req.body.name, 'name', { required: true, maxLength: 200 });
    if (nameError) errors.push(nameError);
    
    const descError = validateString(req.body.description, 'description', { maxLength: 1000 });
    if (descError) errors.push(descError);
    
    const priceError = validateNumber(req.body.price, 'price', { required: true, min: 0 });
    if (priceError) errors.push(priceError);
    
    const categoryError = validateUUID(req.body.category_id, 'category_id', { required: true });
    if (categoryError) errors.push(categoryError);
    
    const costError = validateNumber(req.body.cost, 'cost', { min: 0 });
    if (costError) errors.push(costError);
    
    const prepError = validateNumber(req.body.preparation_time, 'preparation_time', { min: 0 });
    if (prepError) errors.push(prepError);
    
    const availableError = validateBoolean(req.body.is_available, 'is_available');
    if (availableError) errors.push(availableError);
    
    const featuredError = validateBoolean(req.body.is_featured, 'is_featured');
    if (featuredError) errors.push(featuredError);
    
    const allergensError = validateArray(req.body.allergens, 'allergens');
    if (allergensError) errors.push(allergensError);
    
    const dietaryError = validateArray(req.body.dietary_info, 'dietary_info');
    if (dietaryError) errors.push(dietaryError);
    
    // Validate sizes array
    const sizesArrayError = validateArray(req.body.sizes, 'sizes');
    if (sizesArrayError) {
      errors.push(sizesArrayError);
    } else if (Array.isArray(req.body.sizes)) {
      const sizes: any[] = req.body.sizes;
      sizes.forEach((size: any, index: number) => {
        if (!size.sizeName || typeof size.sizeName !== 'string') {
          errors.push({ field: `sizes[${index}].sizeName`, message: 'Each size must have a valid sizeName' });
        }
        if (typeof size.price !== 'number' || size.price < 0) {
          errors.push({ field: `sizes[${index}].price`, message: 'Each size must have a valid non-negative price' });
        }
      });
    }
    
    const modifiersError = validateArray(req.body.modifier_groups, 'modifier_groups');
    if (modifiersError) errors.push(modifiersError);
    
    errors.forEach(e => addError(req, e));
    next();
  },
  checkValidation
];

/**
 * Validation rules for updating a menu item
 */
export const validateUpdateItem = [
  (req: Request, res: Response, next: NextFunction) => {
    const errors: ValidationError[] = [];
    
    const idError = validateUUID(req.params.id, 'id', { required: true });
    if (idError) errors.push(idError);
    
    const nameError = validateString(req.body.name, 'name', { maxLength: 200 });
    if (nameError) errors.push(nameError);
    
    const descError = validateString(req.body.description, 'description', { maxLength: 1000 });
    if (descError) errors.push(descError);
    
    const priceError = validateNumber(req.body.price, 'price', { min: 0 });
    if (priceError) errors.push(priceError);
    
    const categoryError = validateUUID(req.body.category_id, 'category_id');
    if (categoryError) errors.push(categoryError);
    
    const costError = validateNumber(req.body.cost, 'cost', { min: 0 });
    if (costError) errors.push(costError);
    
    const prepError = validateNumber(req.body.preparation_time, 'preparation_time', { min: 0 });
    if (prepError) errors.push(prepError);
    
    const availableError = validateBoolean(req.body.is_available, 'is_available');
    if (availableError) errors.push(availableError);
    
    const featuredError = validateBoolean(req.body.is_featured, 'is_featured');
    if (featuredError) errors.push(featuredError);
    
    const allergensError = validateArray(req.body.allergens, 'allergens');
    if (allergensError) errors.push(allergensError);
    
    const dietaryError = validateArray(req.body.dietary_info, 'dietary_info');
    if (dietaryError) errors.push(dietaryError);
    
    const sizesError = validateArray(req.body.sizes, 'sizes');
    if (sizesError) errors.push(sizesError);
    
    const modifiersError = validateArray(req.body.modifier_groups, 'modifier_groups');
    if (modifiersError) errors.push(modifiersError);
    
    errors.forEach(e => addError(req, e));
    next();
  },
  checkValidation
];

/**
 * Validation rules for bulk delete
 */
export const validateBulkDelete = [
  (req: Request, res: Response, next: NextFunction) => {
    const errors: ValidationError[] = [];
    
    const arrayError = validateArray(req.body.itemIds, 'itemIds', { required: true, minLength: 1 });
    if (arrayError) {
      errors.push(arrayError);
    } else if (Array.isArray(req.body.itemIds)) {
      const ids: any[] = req.body.itemIds;
      ids.forEach((id: any, index: number) => {
        const uuidError = validateUUID(id, `itemIds[${index}]`);
        if (uuidError) errors.push(uuidError);
      });
    }
    
    errors.forEach(e => addError(req, e));
    next();
  },
  checkValidation
];

/**
 * Validation rules for bulk availability
 */
export const validateBulkAvailability = [
  (req: Request, res: Response, next: NextFunction) => {
    const errors: ValidationError[] = [];
    
    const arrayError = validateArray(req.body.itemIds, 'itemIds', { required: true, minLength: 1 });
    if (arrayError) errors.push(arrayError);
    
    const availableError = validateBoolean(req.body.isAvailable, 'isAvailable', { required: true });
    if (availableError) errors.push(availableError);
    
    errors.forEach(e => addError(req, e));
    next();
  },
  checkValidation
];

/**
 * Validation rules for bulk category change
 */
export const validateBulkCategory = [
  (req: Request, res: Response, next: NextFunction) => {
    const errors: ValidationError[] = [];
    
    const arrayError = validateArray(req.body.itemIds, 'itemIds', { required: true, minLength: 1 });
    if (arrayError) errors.push(arrayError);
    
    const categoryError = validateUUID(req.body.categoryId, 'categoryId', { required: true });
    if (categoryError) errors.push(categoryError);
    
    errors.forEach(e => addError(req, e));
    next();
  },
  checkValidation
];

/**
 * Validation rules for bulk featured
 */
export const validateBulkFeatured = [
  (req: Request, res: Response, next: NextFunction) => {
    const errors: ValidationError[] = [];
    
    const arrayError = validateArray(req.body.itemIds, 'itemIds', { required: true, minLength: 1 });
    if (arrayError) errors.push(arrayError);
    
    const featuredError = validateBoolean(req.body.isFeatured, 'isFeatured', { required: true });
    if (featuredError) errors.push(featuredError);
    
    errors.forEach(e => addError(req, e));
    next();
  },
  checkValidation
];

/**
 * Validation rules for creating a modifier group
 */
export const validateCreateModifierGroup = [
  (req: Request, res: Response, next: NextFunction) => {
    const errors: ValidationError[] = [];
    
    const nameError = validateString(req.body.name, 'name', { required: true, maxLength: 100 });
    if (nameError) errors.push(nameError);
    
    const descError = validateString(req.body.description, 'description', { maxLength: 500 });
    if (descError) errors.push(descError);
    
    // Validate selection type
    if (req.body.selectionType !== undefined) {
      const validTypes = ['single', 'multiple', 'quantity'];
      if (!validTypes.includes(req.body.selectionType)) {
        errors.push({ field: 'selectionType', message: 'Selection type must be single, multiple, or quantity' });
      }
    }
    
    const minError = validateNumber(req.body.minSelections, 'minSelections', { min: 0 });
    if (minError) errors.push(minError);
    
    // Validate max selections
    if (req.body.maxSelections !== undefined && req.body.maxSelections !== null) {
      const maxNum = Number(req.body.maxSelections);
      if (isNaN(maxNum) || maxNum < 1) {
        errors.push({ field: 'maxSelections', message: 'Max selections must be a positive integer' });
      } else if (req.body.minSelections !== undefined && maxNum < Number(req.body.minSelections)) {
        errors.push({ field: 'maxSelections', message: 'Max selections cannot be less than min selections' });
      }
    }
    
    const requiredError = validateBoolean(req.body.isRequired, 'isRequired');
    if (requiredError) errors.push(requiredError);
    
    errors.forEach(e => addError(req, e));
    next();
  },
  checkValidation
];

/**
 * Validation rules for creating a modifier option
 */
export const validateCreateModifierOption = [
  (req: Request, res: Response, next: NextFunction) => {
    const errors: ValidationError[] = [];
    
    const groupIdError = validateUUID(req.params.groupId, 'groupId', { required: true });
    if (groupIdError) errors.push(groupIdError);
    
    const nameError = validateString(req.body.name, 'name', { required: true, maxLength: 100 });
    if (nameError) errors.push(nameError);
    
    const descError = validateString(req.body.description, 'description', { maxLength: 500 });
    if (descError) errors.push(descError);
    
    const priceError = validateNumber(req.body.priceDelta, 'priceDelta');
    if (priceError) errors.push(priceError);
    
    const activeError = validateBoolean(req.body.isActive, 'isActive');
    if (activeError) errors.push(activeError);
    
    errors.forEach(e => addError(req, e));
    next();
  },
  checkValidation
];

/**
 * Validation rules for reordering items
 */
export const validateReorderItems = [
  (req: Request, res: Response, next: NextFunction) => {
    const errors: ValidationError[] = [];
    
    const arrayError = validateArray(req.body.itemIds, 'itemIds', { required: true, minLength: 1 });
    if (arrayError) errors.push(arrayError);
    
    errors.forEach(e => addError(req, e));
    next();
  },
  checkValidation
];

/**
 * Validation rules for reordering categories
 */
export const validateReorderCategories = [
  (req: Request, res: Response, next: NextFunction) => {
    const errors: ValidationError[] = [];
    
    const arrayError = validateArray(req.body.categoryIds, 'categoryIds', { required: true, minLength: 1 });
    if (arrayError) errors.push(arrayError);
    
    errors.forEach(e => addError(req, e));
    next();
  },
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
