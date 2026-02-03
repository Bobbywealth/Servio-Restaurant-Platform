/**
 * Jest Test Setup - Comprehensive Mock Configuration
 * 
 * Provides mocks for:
 * - Database service
 * - Socket.IO
 * - External APIs (OpenAI, Vapi, Twilio)
 * - Test utilities for authentication and assertions
 */

import { jest } from '@jest/globals';

// ============================================
// Mock External Services
// ============================================

// Mock Socket.IO
jest.mock('socket.io', () => {
  const mockServer = {
    on: jest.fn(),
    emit: jest.fn(),
    use: jest.fn(),
  };
  
  const mockSocket = {
    on: jest.fn(),
    emit: jest.fn(),
    disconnect: jest.fn(),
    join: jest.fn(),
    leave: jest.fn(),
    id: 'mock-socket-id',
  };
  
  const mockIo = {
    Server: jest.fn().mockImplementation(() => mockServer),
    Socket: jest.fn().mockImplementation(() => mockSocket),
  };
  
  return {
    Server: jest.fn().mockImplementation(() => mockServer),
    Socket: mockSocket,
  };
});

// Mock winston logger
jest.mock('winston', () => ({
  createLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    printf: jest.fn(),
    json: jest.fn(),
    colorize: jest.fn(),
  },
  transports: {
    Console: jest.fn(),
    File: jest.fn(),
  },
}));

// Mock axios for external API calls
jest.mock('axios', () => ({
  create: jest.fn().mockReturnThis(),
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  patch: jest.fn(),
  delete: jest.fn(),
}));

// Mock OpenAI
jest.mock('openai', () => ({
  OpenAI: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{ message: { content: 'Mock AI response' } }],
        }),
      },
    },
    images: {
      generate: jest.fn().mockResolvedValue({
        data: [{ url: 'https://mock-image-url.com/image.png' }],
      }),
    },
  })),
}));

// Mock Twilio
jest.mock('twilio', () => {
  return jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn().mockResolvedValue({
        sid: 'mock-message-sid',
        status: 'sent',
      }),
    },
    calls: {
      create: jest.fn().mockResolvedValue({
        sid: 'mock-call-sid',
        status: 'initiated',
      }),
    },
  }));
});

// Mock web-push
jest.mock('web-push', () => ({
  setVapidDetails: jest.fn(),
  generateVAPIDKeys: jest.fn().mockReturnValue({
    publicKey: 'mock-public-key',
    privateKey: 'mock-private-key',
  }),
  sendNotification: jest.fn().mockResolvedValue({ statusCode: 201 }),
  getSubscription: jest.fn(),
}));

// ============================================
// Test Utilities
// ============================================

/**
 * Create a mock JWT token for testing
 */
export function createMockJwtToken(payload: {
  userId: string;
  restaurantId: string;
  role: string;
  permissions?: string[];
  exp?: number;
}): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: payload.exp || Math.floor(Date.now() / 1000) + 86400, // 24 hours
  })).toString('base64url');
  const signature = 'mock-signature';
  return `${header}.${body}.${signature}`;
}

/**
 * Create mock user data for testing
 */
export function createMockUser(overrides: Partial<{
  id: string;
  email: string;
  name: string;
  role: string;
  restaurantId: string;
  pin: string | null;
  active: boolean;
  permissions: string[];
}> = {}): {
  id: string;
  email: string;
  name: string;
  role: string;
  restaurantId: string;
  pin: string | null;
  active: boolean;
  permissions: string[];
  createdAt: Date;
  updatedAt: Date;
} {
  return {
    id: 'mock-user-id',
    email: 'test@servio.com',
    name: 'Test User',
    role: 'staff',
    restaurantId: 'mock-restaurant-id',
    pin: '1234',
    active: true,
    permissions: ['*'],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Create mock restaurant data for testing
 */
export function createMockRestaurant(overrides: Partial<{
  id: string;
  name: string;
  slug: string;
  timezone: string;
  active: boolean;
}> = {}): {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
} {
  return {
    id: 'mock-restaurant-id',
    name: 'Test Restaurant',
    slug: 'test-restaurant',
    timezone: 'America/New_York',
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Create mock order data for testing
 */
export function createMockOrder(overrides: Partial<{
  id: string;
  restaurantId: string;
  customerName: string;
  customerPhone: string;
  status: string;
  total: number;
  items: Array<{ name: string; quantity: number; price: number }>;
}> = {}): {
  id: string;
  restaurantId: string;
  customerName: string;
  customerPhone: string;
  status: string;
  total: number;
  items: Array<{ name: string; quantity: number; price: number }>;
  createdAt: Date;
  updatedAt: Date;
} {
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
      { name: 'Soda', quantity: 1, price: 2.99 },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Create mock menu item for testing
 */
export function createMockMenuItem(overrides: Partial<{
  id: string;
  restaurantId: string;
  name: string;
  description: string;
  price: number;
  categoryId: string;
  active: boolean;
  available: boolean;
}> = {}): {
  id: string;
  restaurantId: string;
  name: string;
  description: string;
  price: number;
  categoryId: string;
  active: boolean;
  available: boolean;
  imageUrl: string | null;
  allergens: string[];
  createdAt: Date;
  updatedAt: Date;
} {
  return {
    id: 'mock-menu-item-id',
    restaurantId: 'mock-restaurant-id',
    name: 'Test Item',
    description: 'A delicious test item',
    price: 9.99,
    categoryId: 'mock-category-id',
    active: true,
    available: true,
    imageUrl: null,
    allergens: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Create mock staff member for testing
 */
export function createMockStaff(overrides: Partial<{
  id: string;
  restaurantId: string;
  name: string;
  email: string;
  role: string;
  pin: string | null;
  active: boolean;
}> = {}): {
  id: string;
  restaurantId: string;
  name: string;
  email: string;
  role: string;
  pin: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
} {
  return {
    id: 'mock-staff-id',
    restaurantId: 'mock-restaurant-id',
    name: 'Test Staff',
    email: 'staff@test.com',
    role: 'staff',
    pin: '1234',
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Create mock inventory item for testing
 */
export function createMockInventoryItem(overrides: Partial<{
  id: string;
  restaurantId: string;
  name: string;
  currentStock: number;
  unit: string;
  reorderLevel: number;
}> = {}): {
  id: string;
  restaurantId: string;
  name: string;
  currentStock: number;
  unit: string;
  reorderLevel: number;
  lastRestocked: Date | null;
  createdAt: Date;
  updatedAt: Date;
} {
  return {
    id: 'mock-inventory-id',
    restaurantId: 'mock-restaurant-id',
    name: 'Test Inventory',
    currentStock: 100,
    unit: 'units',
    reorderLevel: 20,
    lastRestocked: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Create mock time entry for staff clock in/out
 */
export function createMockTimeEntry(overrides: Partial<{
  id: string;
  staffId: string;
  restaurantId: string;
  clockIn: Date;
  clockOut: Date | null;
  breakMinutes: number;
}> = {}): {
  id: string;
  staffId: string;
  restaurantId: string;
  clockIn: Date;
  clockOut: Date | null;
  breakMinutes: number;
  createdAt: Date;
  updatedAt: Date;
} {
  return {
    id: 'mock-time-entry-id',
    staffId: 'mock-staff-id',
    restaurantId: 'mock-restaurant-id',
    clockIn: new Date(),
    clockOut: null,
    breakMinutes: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Create mock request object for testing routes
 */
export function createMockRequest(overrides: Partial<{
  method: string;
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
  params: Record<string, string>;
  query: Record<string, string>;
  user: { id: string; restaurantId: string; role: string };
}> = {}): Partial<import('express').Request> & { io?: any } {
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
      emit: jest.fn(),
    },
    ...overrides,
  };
}

/**
 * Create mock response object for testing routes
 */
export function createMockResponse(): {
  status: jest.Mock;
  json: jest.Mock;
  send: jest.Mock;
  setHeader: jest.Mock;
  end: jest.Mock;
  locals: Record<string, unknown>;
} {
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

/**
 * Create mock next function for testing middleware
 */
export function createMockNext(): jest.Mock {
  return jest.fn();
}

/**
 * Assert API response structure
 */
export function assertApiResponse(
  response: any,
  expectedStatus: number,
  expectedStructure?: object
): void {
  expect(response.status).toHaveBeenCalledWith(expectedStatus);
  if (expectedStructure) {
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining(expectedStructure)
    );
  }
}

/**
 * Assert error response format
 */
export function assertErrorResponse(
  response: any,
  expectedMessage?: string
): void {
  expect(response.status).toHaveBeenCalledWith(expect.any(Number));
  expect(response.json).toHaveBeenCalledWith(
    expect.objectContaining({
      success: false,
      message: expectedMessage || expect.any(String),
    })
  );
}

/**
 * Mock database query results
 */
export function mockDbQuery<T>(data: T): { rows: T[]; rowCount: number } {
  return {
    rows: Array.isArray(data) ? data : [data],
    rowCount: Array.isArray(data) ? data.length : 1,
  };
}

/**
 * Mock database query with no results
 */
export function mockDbQueryEmpty(): { rows: never[]; rowCount: 0 } {
  return {
    rows: [],
    rowCount: 0,
  };
}

// ============================================
// Global Test Setup
// ============================================

// Set test environment variables
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/servio_test';
process.env.OPENAI_API_KEY = 'test-openai-key';
process.env.VAPI_API_KEY = 'test-vapi-key';
process.env.VAPI_WEBHOOK_SECRET = 'test-webhook-secret';
process.env.TWILIO_ACCOUNT_SID = 'test-twilio-sid';
process.env.TWILIO_AUTH_TOKEN = 'test-twilio-token';

// Increase timeout for async operations
jest.setTimeout(10000);

// Clean up after all tests
afterAll(() => {
  jest.clearAllMocks();
});
