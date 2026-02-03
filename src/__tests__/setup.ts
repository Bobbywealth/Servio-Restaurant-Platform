/**
 * Test Setup and Utilities
 * 
 * This module provides mock functions and test utilities for backend tests.
 * Jest globals are available when tests run.
 */

// Mock database service
export const mockDbQuery = <T>(data: T) => ({
  rows: Array.isArray(data) ? data : [data],
  rowCount: Array.isArray(data) ? data.length : 1,
});

// Mock database query with no results
export const mockDbQueryEmpty = () => ({
  rows: [],
  rowCount: 0,
});

// Create mock request object
export function createMockRequest(overrides = {}) {
  return {
    method: 'GET',
    url: '/api/test',
    headers: {
      'content-type': 'application/json',
      'authorization': 'Bearer mock-token',
      ...overrides.headers,
    },
    body: {},
    params: {},
    query: {},
    user: {
      id: 'mock-user-id',
      restaurantId: 'mock-restaurant-id',
      role: 'staff',
      ...overrides.user,
    },
    io: {
      emit: () => {},
    },
    ...overrides,
  };
}

// Create mock response object
export function createMockResponse() {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    setHeader: jest.fn().mockReturnThis(),
    end: jest.fn().mockReturnThis(),
    locals: {},
  };
  return res;
}

// Create mock next function
export function createMockNext() {
  return jest.fn();
}

// Create mock user data
export function createMockUser(overrides = {}) {
  return {
    id: 'mock-user-id',
    email: 'test@servio.com',
    name: 'Test User',
    role: 'staff',
    restaurantId: 'mock-restaurant-id',
    pin: '1234',
    active: true,
    permissions: ['*'],
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

// Create mock restaurant data
export function createMockRestaurant(overrides = {}) {
  return {
    id: 'mock-restaurant-id',
    name: 'Test Restaurant',
    slug: 'test-restaurant',
    timezone: 'America/New_York',
    active: true,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

// Create mock order data
export function createMockOrder(overrides = {}) {
  return {
    id: 'mock-order-id',
    restaurantId: 'mock-restaurant-id',
    customerName: 'John Doe',
    customerPhone: '+1234567890',
    status: 'pending',
    total: 25.99,
    items: [
      { name: 'Burger', quantity: 1, price: 12.99 },
      { name: 'Fries', quantity: 1, price: 4.99 },
    ],
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

// Create mock staff member
export function createMockStaff(overrides = {}) {
  return {
    id: 'mock-staff-id',
    restaurantId: 'mock-restaurant-id',
    name: 'Test Staff',
    email: 'staff@test.com',
    role: 'staff',
    pin: '1234',
    active: true,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

// Create mock inventory item
export function createMockInventoryItem(overrides = {}) {
  return {
    id: 'mock-inventory-id',
    restaurantId: 'mock-restaurant-id',
    name: 'Test Inventory',
    currentStock: 100,
    unit: 'units',
    reorderLevel: 20,
    lastRestocked: new Date(),
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

// Assert API response
export function assertApiResponse(response, expectedStatus, expectedStructure) {
  expect(response.status).toHaveBeenCalledWith(expectedStatus);
  if (expectedStructure) {
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining(expectedStructure)
    );
  }
}

// Assert error response
export function assertErrorResponse(response, expectedMessage) {
  expect(response.status).toHaveBeenCalledWith(expect.any(Number));
  expect(response.json).toHaveBeenCalledWith(
    expect.objectContaining({
      success: false,
      message: expectedMessage || expect.any(String),
    })
  );
}

// Set test environment variables
beforeAll(() => {
  process.env.JWT_SECRET = 'test-jwt-secret';
  process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret';
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/servio_test';
});

// Clear mocks after all tests
afterAll(() => {
  jest.clearAllMocks();
});
