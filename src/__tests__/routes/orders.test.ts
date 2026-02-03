/**
 * Orders API Tests
 * 
 * Tests for order management endpoints:
 * - GET /orders - List orders
 * - POST /orders - Create order
 * - GET /orders/:id - Get order details
 * - PATCH /orders/:id/status - Update order status
 * - DELETE /orders/:id - Delete order
 * - POST /orders/public/:slug - Public order creation
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Mock setup file
const { 
  createMockRequest, 
  createMockResponse, 
  createMockNext,
  createMockUser,
  createMockRestaurant,
  createMockOrder,
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

// Mock SocketService
jest.unstable_mockModule('../services/SocketService.ts', () => ({
  default: {
    emitToRestaurant: jest.fn(),
  },
}));

// Import after mocking
const { default: DatabaseService } = await import('../services/DatabaseService.ts');
const { default: SocketService } = await import('../services/SocketService.ts');

describe('Orders API', () => {
  let mockReq: ReturnType<typeof createMockRequest>;
  let mockRes: ReturnType<typeof createMockResponse>;
  let mockNext: jest.Mock;

  beforeEach(() => {
    mockReq = createMockRequest();
    mockRes = createMockResponse();
    mockNext = createMockNext();
    jest.clearAllMocks();
  });

  describe('GET /orders', () => {
    it('should return 401 without authentication', async () => {
      // Arrange
      mockReq.user = undefined;

      const { getOrdersHandler } = await import('../routes/orders.ts');
      await getOrdersHandler(mockReq as any, mockRes as any, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it('should return 200 with orders list', async () => {
      // Arrange
      const mockUser = createMockUser({ role: 'manager' });
      mockReq.user = { 
        id: mockUser.id, 
        restaurantId: mockUser.restaurantId, 
        role: mockUser.role 
      };
      
      const mockOrders = [
        createMockOrder({ id: 'order-1' }),
        createMockOrder({ id: 'order-2', status: 'preparing' }),
      ];

      (DatabaseService.pool.query as jest.Mock).mockResolvedValue({
        rows: mockOrders,
        rowCount: 2
      });

      const { getOrdersHandler } = await import('../routes/orders.ts');
      await getOrdersHandler(mockReq as any, mockRes as any, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            orders: expect.arrayContaining([
              expect.objectContaining({ id: 'order-1' }),
              expect.objectContaining({ id: 'order-2' }),
            ])
          })
        })
      );
    });

    it('should filter orders by status', async () => {
      // Arrange
      const mockUser = createMockUser({ role: 'manager' });
      mockReq.user = { 
        id: mockUser.id, 
        restaurantId: mockUser.restaurantId, 
        role: mockUser.role 
      };
      mockReq.query = { status: 'pending' };

      (DatabaseService.pool.query as jest.Mock).mockResolvedValue({
        rows: [createMockOrder({ status: 'pending' })],
        rowCount: 1
      });

      const { getOrdersHandler } = await import('../routes/orders.ts');
      await getOrdersHandler(mockReq as any, mockRes as any, mockNext);

      // Assert
      expect(DatabaseService.pool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE restaurant_id = $1 AND status = $2'),
        expect.any(Array)
      );
    });
  });

  describe('POST /orders', () => {
    it('should return 400 when customer name is missing', async () => {
      // Arrange
      mockReq.body = { customerPhone: '+1234567890' };

      const { createOrderHandler } = await import('../routes/orders.ts');
      await createOrderHandler(mockReq as any, mockRes as any, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 when items are missing', async () => {
      // Arrange
      mockReq.body = { 
        customerName: 'John Doe', 
        customerPhone: '+1234567890' 
      };

      const { createOrderHandler } = await import('../routes/orders.ts');
      await createOrderHandler(mockReq as any, mockRes as any, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should create order and emit socket event', async () => {
      // Arrange
      const mockUser = createMockUser({ role: 'staff' });
      mockReq.user = { 
        id: mockUser.id, 
        restaurantId: mockUser.restaurantId, 
        role: mockUser.role 
      };
      mockReq.body = {
        customerName: 'John Doe',
        customerPhone: '+1234567890',
        items: [
          { menuItemId: 'item-1', quantity: 2, price: 9.99 },
        ],
        notes: 'No onions',
      };

      (DatabaseService.pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // Begin transaction
        .mockResolvedValueOnce({ rows: [{ id: 'new-order-id' }], rowCount: 1 }) // Insert order
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // Insert items
        .mockResolvedValueOnce({ rows: [createMockOrder()], rowCount: 1 }); // Select created order

      const { createOrderHandler } = await import('../routes/orders.ts');
      await createOrderHandler(mockReq as any, mockRes as any, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(SocketService.emitToRestaurant).toHaveBeenCalledWith(
        mockUser.restaurantId,
        'order:created',
        expect.any(Object)
      );
    });
  });

  describe('GET /orders/:id', () => {
    it('should return 404 when order not found', async () => {
      // Arrange
      mockReq.params = { id: 'nonexistent-order' };

      (DatabaseService.pool.query as jest.Mock).mockResolvedValue({
        rows: [],
        rowCount: 0
      });

      const { getOrderByIdHandler } = await import('../routes/orders.ts');
      await getOrderByIdHandler(mockReq as any, mockRes as any, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('should return 200 with order details', async () => {
      // Arrange
      const mockOrder = createMockOrder();
      mockReq.params = { id: mockOrder.id };

      (DatabaseService.pool.query as jest.Mock).mockResolvedValue({
        rows: [mockOrder],
        rowCount: 1
      });

      const { getOrderByIdHandler } = await import('../routes/orders.ts');
      await getOrderByIdHandler(mockReq as any, mockRes as any, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ order: expect.objectContaining({ id: mockOrder.id }) })
        })
      );
    });
  });

  describe('PATCH /orders/:id/status', () => {
    it('should return 400 when status is invalid', async () => {
      // Arrange
      mockReq.params = { id: 'order-1' };
      mockReq.body = { status: 'invalid-status' };

      const { updateOrderStatusHandler } = await import('../routes/orders.ts');
      await updateOrderStatusHandler(mockReq as any, mockRes as any, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should update order status and emit socket event', async () => {
      // Arrange
      const mockOrder = createMockOrder();
      mockReq.params = { id: mockOrder.id };
      mockReq.body = { status: 'preparing' };

      (DatabaseService.pool.query as jest.Mock).mockResolvedValue({
        rows: [{ ...mockOrder, status: 'preparing' }],
        rowCount: 1
      });

      const { updateOrderStatusHandler } = await import('../routes/orders.ts');
      await updateOrderStatusHandler(mockReq as any, mockRes as any, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(SocketService.emitToRestaurant).toHaveBeenCalledWith(
        mockOrder.restaurantId,
        'order:updated',
        expect.any(Object)
      );
    });

    it('should emit ready event when status changes to ready', async () => {
      // Arrange
      const mockOrder = createMockOrder({ status: 'preparing' });
      mockReq.params = { id: mockOrder.id };
      mockReq.body = { status: 'ready' };

      (DatabaseService.pool.query as jest.Mock).mockResolvedValue({
        rows: [{ ...mockOrder, status: 'ready' }],
        rowCount: 1
      });

      const { updateOrderStatusHandler } = await import('../routes/orders.ts');
      await updateOrderStatusHandler(mockReq as any, mockRes as any, mockNext);

      // Assert
      expect(SocketService.emitToRestaurant).toHaveBeenCalledWith(
        mockOrder.restaurantId,
        'order:ready',
        expect.any(Object)
      );
    });
  });

  describe('DELETE /orders/:id', () => {
    it('should return 403 for non-owner trying to delete', async () => {
      // Arrange
      mockReq.user = createMockUser({ role: 'staff' });
      mockReq.params = { id: 'order-1' };

      const { deleteOrderHandler } = await import('../routes/orders.ts');
      await deleteOrderHandler(mockReq as any, mockRes as any, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    it('should delete order for owner/manager', async () => {
      // Arrange
      mockReq.user = createMockUser({ role: 'owner' });
      mockReq.params = { id: 'order-1' };

      (DatabaseService.pool.query as jest.Mock).mockResolvedValue({
        rows: [],
        rowCount: 1
      });

      const { deleteOrderHandler } = await import('../routes/orders.ts');
      await deleteOrderHandler(mockReq as any, mockRes as any, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });

  describe('POST /orders/public/:slug', () => {
    it('should return 404 when restaurant not found by slug', async () => {
      // Arrange
      mockReq.params = { slug: 'nonexistent' };
      mockReq.body = {
        customerName: 'John Doe',
        customerPhone: '+1234567890',
        items: [{ menuItemId: 'item-1', quantity: 1 }],
      };

      (DatabaseService.pool.query as jest.Mock).mockResolvedValue({
        rows: [],
        rowCount: 0
      });

      const { publicCreateOrderHandler } = await import('../routes/orders.ts');
      await publicCreateOrderHandler(mockReq as any, mockRes as any, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('should create order for valid restaurant slug', async () => {
      // Arrange
      const mockRestaurant = createMockRestaurant();
      mockReq.params = { slug: mockRestaurant.slug };
      mockReq.body = {
        customerName: 'John Doe',
        customerPhone: '+1234567890',
        items: [{ menuItemId: 'item-1', quantity: 1, price: 9.99 }],
      };

      (DatabaseService.pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [mockRestaurant], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ id: 'new-public-order' }], rowCount: 1 });

      const { publicCreateOrderHandler } = await import('../routes/orders.ts');
      await publicCreateOrderHandler(mockReq as any, mockRes as any, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(201);
    });
  });
});
