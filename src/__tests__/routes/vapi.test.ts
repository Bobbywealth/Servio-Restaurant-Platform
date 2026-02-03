/**
 * Vapi Webhook API Tests
 * 
 * Tests for Vapi voice assistant webhook endpoints:
 * - POST /vapi - Vapi webhook handler
 * - GET /vapi/status - Get Vapi status
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// Mock setup file
const { 
  createMockRequest, 
  createMockResponse, 
  createMockNext,
  createMockUser,
  createMockRestaurant,
  createMockOrder,
  createMockMenuItem,
  assertApiResponse,
  assertErrorResponse
} = await import('./setup.ts');

// Mock database service
jest.unstable_mockModule('../services/DatabaseService.ts', () => ({
  default: {
    pool: {
      query: jest.fn(),
    },
    getRestaurantById: jest.fn(),
    emitOrderEvent: jest.fn(),
  },
}));

// Mock VapiService
jest.unstable_mockModule('../services/VapiService.ts', () => ({
  default: {
    handleWebhook: jest.fn().mockResolvedValue({
      success: true,
      response: { message: 'Order created successfully' },
    }),
    getStoreStatus: jest.fn().mockResolvedValue({
      isOpen: true,
      message: 'Store is open',
    }),
    searchMenu: jest.fn().mockResolvedValue({
      items: [
        { id: 'item-1', name: 'Burger', price: 9.99 },
        { id: 'item-2', name: 'Pizza', price: 12.99 },
      ],
    }),
    createOrder: jest.fn().mockResolvedValue({
      orderId: 'order-123',
      message: 'Order created',
    }),
  },
}));

// Import after mocking
const { default: DatabaseService } = await import('../services/DatabaseService.ts');
const { default: VapiService } = await import('../services/VapiService.ts');

describe('Vapi Webhook API', () => {
  let mockReq: ReturnType<typeof createMockRequest>;
  let mockRes: ReturnType<typeof createMockResponse>;
  let mockNext: jest.Mock;

  beforeEach(() => {
    mockReq = createMockRequest();
    mockRes = createMockResponse();
    mockNext = createMockNext();
    jest.clearAllMocks();
  });

  describe('POST /vapi', () => {
    it('should return 400 when message is missing', async () => {
      // Arrange
      mockReq.body = {};

      const { vapiWebhookHandler } = await import('../routes/vapi.ts');
      await vapiWebhookHandler(mockReq as any, mockRes as any, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should return 401 without valid API key', async () => {
      // Arrange
      mockReq.headers = {};
      mockReq.body = { message: 'I want to order a pizza' };

      const { vapiWebhookHandler } = await import('../routes/vapi.ts');
      await vapiWebhookHandler(mockReq as any, mockRes as any, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it('should process voice order successfully', async () => {
      // Arrange
      mockReq.headers = { 'x-vapi-signature': 'valid-signature' };
      mockReq.body = {
        type: 'voice-order',
        message: 'I want to order a large pepperoni pizza',
        customer: {
          phone: '+1234567890',
          name: 'John Doe',
        },
        items: [
          { menuItemId: 'item-1', quantity: 1, specialInstructions: 'Extra cheese' },
        ],
      };

      (VapiService.createOrder as jest.Mock).mockResolvedValue({
        orderId: 'order-123',
        message: 'Order created successfully',
      });

      const { vapiWebhookHandler } = await import('../routes/vapi.ts');
      await vapiWebhookHandler(mockReq as any, mockRes as any, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(VapiService.createOrder).toHaveBeenCalled();
    });

    it('should handle function call from Vapi', async () => {
      // Arrange
      mockReq.body = {
        type: 'function-call',
        function: {
          name: 'getStoreStatus',
          arguments: {},
        },
      };

      (VapiService.getStoreStatus as jest.Mock).mockResolvedValue({
        isOpen: true,
        message: 'The store is currently open',
      });

      const { vapiWebhookHandler } = await import('../routes/vapi.ts');
      await vapiWebhookHandler(mockReq as any, mockRes as any, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(VapiService.getStoreStatus).toHaveBeenCalled();
    });

    it('should handle menu search request', async () => {
      // Arrange
      mockReq.body = {
        type: 'function-call',
        function: {
          name: 'searchMenu',
          arguments: { query: 'pizza' },
        },
      };

      (VapiService.searchMenu as jest.Mock).mockResolvedValue({
        items: [
          { id: 'item-1', name: 'Pepperoni Pizza', price: 14.99 },
          { id: 'item-2', name: 'Cheese Pizza', price: 12.99 },
        ],
      });

      const { vapiWebhookHandler } = await import('../routes/vapi.ts');
      await vapiWebhookHandler(mockReq as any, mockRes as any, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(VapiService.searchMenu).toHaveBeenCalledWith('pizza');
    });

    it('should handle customer lookup', async () => {
      // Arrange
      mockReq.body = {
        type: 'function-call',
        function: {
          name: 'lookupCustomer',
          arguments: { phone: '+1234567890' },
        },
      };

      const mockCustomer = {
        id: 'customer-1',
        phone: '+1234567890',
        name: 'John Doe',
        email: 'john@example.com',
        orderCount: 5,
        totalSpent: 150.00,
      };

      (DatabaseService.pool.query as jest.Mock).mockResolvedValue({
        rows: [mockCustomer],
        rowCount: 1,
      });

      const { vapiWebhookHandler } = await import('../routes/vapi.ts');
      await vapiWebhookHandler(mockReq as any, mockRes as any, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ customer: expect.objectContaining(mockCustomer) }),
        })
      );
    });

    it('should return customer not found', async () => {
      // Arrange
      mockReq.body = {
        type: 'function-call',
        function: {
          name: 'lookupCustomer',
          arguments: { phone: '+9999999999' },
        },
      };

      (DatabaseService.pool.query as jest.Mock).mockResolvedValue({
        rows: [],
        rowCount: 0,
      });

      const { vapiWebhookHandler } = await import('../routes/vapi.ts');
      await vapiWebhookHandler(mockReq as any, mockRes as any, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ customer: null }),
        })
      );
    });

    it('should handle unknown function call', async () => {
      // Arrange
      mockReq.body = {
        type: 'function-call',
        function: {
          name: 'unknownFunction',
          arguments: {},
        },
      };

      const { vapiWebhookHandler } = await import('../routes/vapi.ts');
      await vapiWebhookHandler(mockReq as any, mockRes as any, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });

  describe('GET /vapi/status', () => {
    it('should return Vapi service status', async () => {
      // Arrange
      (DatabaseService.pool.query as jest.Mock).mockResolvedValue({
        rows: [{ id: 'vapi-1', name: 'Vapi Integration', active: true }],
        rowCount: 1,
      });

      const { vapiStatusHandler } = await import('../routes/vapi.ts');
      await vapiStatusHandler(mockReq as any, mockRes as any, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            configured: true,
            active: true,
          }),
        })
      );
    });
  });

  describe('VapiService Functions', () => {
    it('should create order from voice request', async () => {
      // Arrange
      const voiceRequest = {
        restaurantId: 'rest-1',
        customer: {
          phone: '+1234567890',
          name: 'John Doe',
        },
        items: [
          { menuItemId: 'item-1', quantity: 2 },
        ],
        notes: 'Ring doorbell',
      };

      // Act
      await VapiService.createOrder(voiceRequest);

      // Assert
      expect(VapiService.createOrder).toHaveBeenCalledWith(voiceRequest);
    });

    it('should search menu by query', async () => {
      // Arrange
      const query = 'burger';

      // Act
      await VapiService.searchMenu(query);

      // Assert
      expect(VapiService.searchMenu).toHaveBeenCalledWith(query);
    });

    it('should return store status', async () => {
      // Arrange
      const restaurantId = 'rest-1';

      // Act
      const result = await VapiService.getStoreStatus(restaurantId);

      // Assert
      expect(result).toEqual({
        isOpen: true,
        message: 'Store is open',
      });
    });
  });
});
