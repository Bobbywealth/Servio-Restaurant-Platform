/**
 * Validation Utilities Tests
 * 
 * Tests for environment variable validation and input validation utilities.
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// Mock setup
const { createMockRequest } = await import('./setup.ts');

describe('Validation Utilities', () => {
  describe('Environment Variable Validation', () => {
    it('should validate required environment variables', async () => {
      const { validateEnv } = await import('./utils/validation.ts');
      
      // Mock process.env
      const originalEnv = process.env;
      process.env = {
        ...originalEnv,
        JWT_SECRET: 'test-secret',
        DATABASE_URL: 'postgresql://localhost:5432/db',
        PORT: '3000',
      };

      const result = validateEnv();
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);

      // Restore
      process.env = originalEnv;
    });

    it('should return errors for missing required variables', async () => {
      const { validateEnv } = await import('./utils/validation.ts');
      
      const originalEnv = process.env;
      process.env = {
        ...originalEnv,
        // Missing JWT_SECRET, DATABASE_URL
      };

      const result = validateEnv();
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors).toContain('JWT_SECRET is required');

      // Restore
      process.env = originalEnv;
    });
  });

  describe('Input Validation', () => {
    it('should validate email format', async () => {
      const { isValidEmail } = await import('./utils/validation.ts');
      
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('invalid-email')).toBe(false);
      expect(isValidEmail('')).toBe(false);
    });

    it('should validate phone number format', async () => {
      const { isValidPhone } = await import('./utils/validation.ts');
      
      expect(isValidPhone('+1234567890')).toBe(true);
      expect(isValidPhone('1234567890')).toBe(true);
      expect(isValidPhone('+1-234-567-8900')).toBe(false);
      expect(isValidPhone('')).toBe(false);
    });

    it('should validate PIN format (4 digits)', async () => {
      const { isValidPin } = await import('./utils/validation.ts');
      
      expect(isValidPin('1234')).toBe(true);
      expect(isValidPin('0000')).toBe(true);
      expect(isValidPin('12')).toBe(false);
      expect(isValidPin('12345')).toBe(false);
      expect(isValidPin('abcd')).toBe(false);
    });

    it('should validate price format (positive number with optional decimals)', async () => {
      const { isValidPrice } = await import('./utils/validation.ts');
      
      expect(isValidPrice('9.99')).toBe(true);
      expect(isValidPrice('10')).toBe(true);
      expect(isValidPrice('0.01')).toBe(true);
      expect(isValidPrice('-1.00')).toBe(false);
      expect(isValidPrice('abc')).toBe(false);
    });

    it('should validate order status', async () => {
      const { isValidOrderStatus } = await import('./utils/validation.ts');
      
      const validStatuses = ['pending', 'preparing', 'ready', 'completed', 'cancelled'];
      
      validStatuses.forEach(status => {
        expect(isValidOrderStatus(status)).toBe(true);
      });

      expect(isValidOrderStatus('invalid')).toBe(false);
      expect(isValidOrderStatus('')).toBe(false);
    });

    it('should validate staff role', async () => {
      const { isValidRole } = await import('./utils/validation.ts');
      
      const validRoles = ['owner', 'manager', 'staff'];
      
      validRoles.forEach(role => {
        expect(isValidRole(role)).toBe(true);
      });

      expect(isValidRole('admin')).toBe(false);
      expect(isValidRole('')).toBe(false);
    });
  });

  describe('Request Validation', () => {
    it('should validate login request', async () => {
      const { validateLoginRequest } = await import('./utils/validation.ts');
      
      // Valid request
      const validReq = createMockRequest();
      validReq.body = { email: 'test@example.com', password: 'password123' };
      
      let result = validateLoginRequest(validReq as any);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);

      // Missing email
      const missingEmail = createMockRequest();
      missingEmail.body = { password: 'password123' };
      
      result = validateLoginRequest(missingEmail as any);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Email is required');

      // Invalid email
      const invalidEmail = createMockRequest();
      invalidEmail.body = { email: 'invalid', password: 'password123' };
      
      result = validateLoginRequest(invalidEmail as any);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid email format');
    });

    it('should validate order creation request', async () => {
      const { validateOrderRequest } = await import('./utils/validation.ts');
      
      // Valid request
      const validReq = createMockRequest();
      validReq.body = {
        customerName: 'John Doe',
        customerPhone: '+1234567890',
        items: [{ menuItemId: 'item-1', quantity: 2, price: 9.99 }],
      };
      
      let result = validateOrderRequest(validReq as any);
      expect(result.valid).toBe(true);

      // Missing customer name
      const missingName = createMockRequest();
      missingName.body = { customerPhone: '+1234567890' };
      
      result = validateOrderRequest(missingName as any);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Customer name is required');

      // Empty items
      const emptyItems = createMockRequest();
      emptyItems.body = { customerName: 'John', customerPhone: '+1234567890', items: [] };
      
      result = validateOrderRequest(emptyItems as any);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('At least one item is required');
    });

    it('should validate staff creation request', async () => {
      const { validateStaffRequest } = await import('./utils/validation.ts');
      
      // Valid request
      const validReq = createMockRequest();
      validReq.body = {
        name: 'John Doe',
        email: 'john@example.com',
        role: 'staff',
        pin: '1234',
      };
      
      let result = validateStaffRequest(validReq as any);
      expect(result.valid).toBe(true);

      // Invalid role
      const invalidRole = createMockRequest();
      invalidRole.body = {
        name: 'John',
        email: 'john@example.com',
        role: 'invalid',
      };
      
      result = validateStaffRequest(invalidRole as any);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid role');

      // Invalid PIN
      const invalidPin = createMockRequest();
      invalidPin.body = {
        name: 'John',
        email: 'john@example.com',
        role: 'staff',
        pin: '12',
      };
      
      result = validateStaffRequest(invalidPin as any);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('PIN must be exactly 4 digits');
    });
  });
});
