/**
 * Test Utilities and Mock Helpers
 * 
 * Provides reusable mocks and utilities for backend unit and integration tests.
 */

import { Request, Response, NextFunction } from 'express';

// Mock user for authenticated requests
export const mockAdminUser = {
  id: 'admin-user-1',
  restaurantId: 'restaurant-1',
  companyId: 'company-1',
  name: 'Test Admin',
  email: 'admin@test.com',
  role: 'admin' as const,
  permissions: ['*']
};

export const mockStaffUser = {
  id: 'staff-user-1',
  restaurantId: 'restaurant-1',
  companyId: 'company-1',
  name: 'Test Staff',
  email: 'staff@test.com',
  role: 'staff' as const,
  permissions: ['orders:read', 'orders:write', 'menu:read']
};

export const mockManagerUser = {
  id: 'manager-user-1',
  restaurantId: 'restaurant-1',
  companyId: 'company-1',
  name: 'Test Manager',
  email: 'manager@test.com',
  role: 'manager' as const,
  permissions: ['*']
};

// Mock request factory
export function createMockRequest(overrides: Partial<Request> = {}): Request {
  return {
    method: 'GET',
    url: '/api/test',
    headers: {
      'content-type': 'application/json',
      'authorization': 'Bearer mock-token',
      ...overrides.headers
    },
    body: {},
    params: {},
    query: {},
    user: mockStaffUser,
    io: { emit: () => {} },
    ...overrides
  } as Request;
}

// Mock response factory
export function createMockResponse(): Partial<Response> {
  const res: Partial<Response> = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    setHeader: jest.fn().mockReturnThis(),
    end: jest.fn().mockReturnThis()
  };
  return res;
}

// Mock next function
export const mockNext = jest.fn() as NextFunction;

// Mock database service
export const mockDb = {
  all: jest.fn(),
  get: jest.fn(),
  run: jest.fn(),
  each: jest.fn()
};

// Mock database service singleton
export const mockDatabaseService = {
  getInstance: jest.fn().mockReturnValue({
    getDatabase: jest.fn().mockResolvedValue(mockDb)
  })
};

// Test data factories
export const createTestOrder = (overrides = {}) => ({
  id: `order-${Date.now()}`,
  restaurantId: 'restaurant-1',
  status: 'pending',
  customerName: 'Test Customer',
  customerPhone: '+1234567890',
  customerEmail: 'test@example.com',
  items: [
    { name: 'Burger', quantity: 2, price: 9.99 },
    { name: 'Fries', quantity: 1, price: 4.99 }
  ],
  subtotal: 24.97,
  tax: 2.06,
  total: 27.03,
  createdAt: new Date().toISOString(),
  ...overrides
});

export const createTestMenuItem = (overrides = {}) => ({
  id: `item-${Date.now()}`,
  restaurantId: 'restaurant-1',
  categoryId: 'category-1',
  name: 'Test Item',
  description: 'A test menu item',
  price: 9.99,
  available: true,
  ...overrides
});

export const createTestStaff = (overrides = {}) => ({
  id: `staff-${Date.now()}`,
  restaurantId: 'restaurant-1',
  name: 'Test Staff',
  email: 'staff@test.com',
  pin: '1234',
  role: 'staff',
  position: 'Server',
  active: true,
  ...overrides
});

export const createTestRestaurant = (overrides = {}) => ({
  id: `restaurant-${Date.now()}`,
  name: 'Test Restaurant',
  slug: 'test-restaurant',
  address: '123 Test St',
  phone: '+1234567890',
  email: 'test@restaurant.com',
  timezone: 'America/New_York',
  ...overrides
});

// JWT token helpers
export function createMockJwtToken(payload: object, secret = 'test-secret'): string {
  const jwt = require('jsonwebtoken');
  return jwt.sign(payload, secret, { expiresIn: '1h' });
}

export function createExpiredJwtToken(payload: object, secret = 'test-secret'): string {
  const jwt = require('jsonwebtoken');
  return jwt.sign(payload, secret, { expiresIn: '-1h' });
}

// Assert helpers
export function expectErrorToBeThrown(fn: () => void, errorType: string) {
  expect(fn).toThrow(errorType);
}

export function expectStatusToBe(res: Partial<Response>, status: number) {
  expect(res.status).toHaveBeenCalledWith(status);
}

export function expectJsonToBeSent(res: Partial<Response>, data: object) {
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining(data));
}
