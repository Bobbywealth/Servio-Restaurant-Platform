/**
 * Validation Utilities
 * 
 * Helper functions for validating user input and environment variables.
 */

// Environment variable validation result
interface ValidateEnvResult {
  valid: boolean;
  errors: string[];
}

// Validate required environment variables
export function validateEnv(): ValidateEnvResult {
  const errors: string[] = [];
  
  const requiredVars = [
    'JWT_SECRET',
    'DATABASE_URL',
  ];
  
  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      errors.push(`${varName} is required`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

// Validate email format
export function isValidEmail(email: string): boolean {
  if (!email || email.trim() === '') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Validate phone number format
export function isValidPhone(phone: string): boolean {
  if (!phone || phone.trim() === '') return false;
  // Allow digits, spaces, dashes, parentheses, and leading +
  const phoneRegex = /^\+?[\d\s\-()]{10,}$/;
  return phoneRegex.test(phone);
}

// Validate PIN format (4 digits)
export function isValidPin(pin: string): boolean {
  if (!pin || pin.length !== 4) return false;
  return /^\d{4}$/.test(pin);
}

// Validate price format (positive number with optional decimals)
export function isValidPrice(price: string): boolean {
  if (!price || price.trim() === '') return false;
  const num = parseFloat(price);
  return !isNaN(num) && num > 0;
}

// Validate order status
export function isValidOrderStatus(status: string): boolean {
  const validStatuses = ['pending', 'preparing', 'ready', 'completed', 'cancelled'];
  return validStatuses.includes(status);
}

// Validate staff role
export function isValidRole(role: string): boolean {
  const validRoles = ['owner', 'manager', 'staff'];
  return validRoles.includes(role);
}

// Validate login request
export function validateLoginRequest(req: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!req.body?.email) {
    errors.push('Email is required');
  } else if (!isValidEmail(req.body.email)) {
    errors.push('Invalid email format');
  }
  
  if (!req.body?.password) {
    errors.push('Password is required');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

// Validate order creation request
export function validateOrderRequest(req: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!req.body?.customerName?.trim()) {
    errors.push('Customer name is required');
  }
  
  if (!req.body?.customerPhone?.trim()) {
    errors.push('Customer phone is required');
  }
  
  if (!req.body?.items || !Array.isArray(req.body.items) || req.body.items.length === 0) {
    errors.push('At least one item is required');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

// Validate staff creation request
export function validateStaffRequest(req: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!req.body?.name?.trim()) {
    errors.push('Name is required');
  }
  
  if (!req.body?.email) {
    errors.push('Email is required');
  } else if (!isValidEmail(req.body.email)) {
    errors.push('Invalid email format');
  }
  
  if (!isValidRole(req.body.role)) {
    errors.push('Invalid role');
  }
  
  if (req.body?.pin && !isValidPin(req.body.pin)) {
    errors.push('PIN must be exactly 4 digits');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}
