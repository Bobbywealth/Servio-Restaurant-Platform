/**
 * Inventory API Tests
 * 
 * Tests for inventory management endpoints:
 * - GET /inventory - List inventory items
 * - POST /inventory - Create inventory item
 * - GET /inventory/:id - Get inventory details
 * - PATCH /inventory/:id - Update inventory item
 * - POST /inventory/:id/adjust - Adjust stock
 * - POST /inventory/analyze-receipt - Analyze receipt image
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// Mock setup file
const { 
  createMockRequest, 
  createMockResponse, 
  createMockNext,
  createMockUser,
  createMockRestaurant,
  createMockInventoryItem,
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
  },
}));

// Mock ReceiptImageService
jest.unstable_mockModule('../services/ReceiptImageService.ts', () => ({
  default: {
    analyzeReceipt: jest.fn().mockResolvedValue({
      items: [
        { name: 'Tomatoes', quantity: 10, unit: 'lbs', price: 2.99 },
        { name: 'Onions', quantity: 5, unit: 'lbs', price: 1.99 },
      ],
      total: 24.95,
    }),
  },
}));

// Mock OpenAI
jest.unstable_mockModule('openai', () => ({
  OpenAI: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify({
                items: [
                  { name: 'Test Item', quantity: 5, unit: 'units', price: 10.00 }
                ],
                total: 50.00
              })
            }
          }]
        }),
      },
    },
  })),
}));

// Import after mocking
const { default: DatabaseService } = await import('../services/DatabaseService.ts');
const { default: ReceiptImageService } = await import('../services/ReceiptImageService.ts');

describe('Inventory API', () => {
  let mockReq: ReturnType<typeof createMockRequest>;
  let mockRes: ReturnType<typeof createMockResponse>;
  let mockNext: jest.Mock;

  beforeEach(() => {
    mockReq = createMockRequest();
    mockRes = createMockResponse();
    mockNext = createMockNext();
    jest.clearAllMocks();
  });

  describe('GET /inventory', () => {
    it('should return 401 without authentication', async () => {
      // Arrange
      mockReq.user = undefined;

      const { getInventoryHandler } = await import('../routes/inventory.ts');
      await getInventoryHandler(mockReq as any, mockRes as any, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it('should return 200 with inventory list', async () => {
      // Arrange
      const mockUser = createMockUser({ role: 'manager' });
      mockReq.user = { 
        id: mockUser.id, 
        restaurantId: mockUser.restaurantId, 
        role: mockUser.role 
      };

      const mockInventory = [
        createMockInventoryItem({ id: 'inv-1', name: 'Tomatoes' }),
        createMockInventoryItem({ id: 'inv-2', name: 'Onions', currentStock: 50 }),
      ];

      (DatabaseService.pool.query as jest.Mock).mockResolvedValue({
        rows: mockInventory,
        rowCount: 2
      });

      const { getInventoryHandler } = await import('../routes/inventory.ts');
      await getInventoryHandler(mockReq as any, mockRes as any, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            inventory: expect.arrayContaining([
              expect.objectContaining({ id: 'inv-1' }),
              expect.objectContaining({ id: 'inv-2' }),
            ])
          })
        })
      );
    });

    it('should filter inventory by low stock', async () => {
      // Arrange
      mockReq.user = createMockUser({ role: 'manager' });
      mockReq.query = { lowStock: 'true' };

      (DatabaseService.pool.query as jest.Mock).mockResolvedValue({
        rows: [createMockInventoryItem({ currentStock: 10, reorderLevel: 20 })],
        rowCount: 1
      });

      const { getInventoryHandler } = await import('../routes/inventory.ts');
      await getInventoryHandler(mockReq as any, mockRes as any, mockNext);

      // Assert
      expect(DatabaseService.pool.query).toHaveBeenCalledWith(
        expect.stringContaining('current_stock <= reorder_level'),
        expect.any(Array)
      );
    });
  });

  describe('POST /inventory', () => {
    it('should return 400 when name is missing', async () => {
      // Arrange
      mockReq.body = { currentStock: 100, unit: 'units', reorderLevel: 20 };

      const { createInventoryHandler } = await import('../routes/inventory.ts');
      await createInventoryHandler(mockReq as any, mockRes as any, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should create inventory item successfully', async () => {
      // Arrange
      const mockUser = createMockUser({ role: 'manager' });
      mockReq.user = { 
        id: mockUser.id, 
        restaurantId: mockUser.restaurantId, 
        role: mockUser.role 
      };
      mockReq.body = { 
        name: 'New Ingredient', 
        currentStock: 100, 
        unit: 'units', 
        reorderLevel: 20 
      };

      (DatabaseService.pool.query as jest.Mock).mockResolvedValue({
        rows: [{
          id: 'new-inv-id',
          name: 'New Ingredient',
          current_stock: 100,
          unit: 'units',
          reorder_level: 20,
        }],
        rowCount: 1
      });

      const { createInventoryHandler } = await import('../routes/inventory.ts');
      await createInventoryHandler(mockReq as any, mockRes as any, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(201);
    });

    it('should return 403 for non-manager', async () => {
      // Arrange
      mockReq.user = createMockUser({ role: 'staff' });
      mockReq.body = { name: 'New Ingredient', currentStock: 100 };

      const { createInventoryHandler } = await import('../routes/inventory.ts');
      await createInventoryHandler(mockReq as any, mockRes as any, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(403);
    });
  });

  describe('GET /inventory/:id', () => {
    it('should return 404 when item not found', async () => {
      // Arrange
      mockReq.params = { id: 'nonexistent' };

      (DatabaseService.pool.query as jest.Mock).mockResolvedValue({
        rows: [],
        rowCount: 0
      });

      const { getInventoryByIdHandler } = await import('../routes/inventory.ts');
      await getInventoryByIdHandler(mockReq as any, mockRes as any, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('should return 200 with inventory details', async () => {
      // Arrange
      const mockItem = createMockInventoryItem();
      mockReq.params = { id: mockItem.id };

      (DatabaseService.pool.query as jest.Mock).mockResolvedValue({
        rows: [mockItem],
        rowCount: 1
      });

      const { getInventoryByIdHandler } = await import('../routes/inventory.ts');
      await getInventoryByIdHandler(mockReq as any, mockRes as any, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });

  describe('PATCH /inventory/:id', () => {
    it('should return 404 when item not found', async () => {
      // Arrange
      mockReq.params = { id: 'nonexistent' };
      mockReq.body = { name: 'Updated Name' };

      (DatabaseService.pool.query as jest.Mock).mockResolvedValue({
        rows: [],
        rowCount: 0
      });

      const { updateInventoryHandler } = await import('../routes/inventory.ts');
      await updateInventoryHandler(mockReq as any, mockRes as any, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('should update inventory item successfully', async () => {
      // Arrange
      mockReq.params = { id: 'inv-1' };
      mockReq.body = { name: 'Updated Name', reorderLevel: 30 };

      (DatabaseService.pool.query as jest.Mock).mockResolvedValue({
        rows: [{
          id: 'inv-1',
          name: 'Updated Name',
          reorder_level: 30,
        }],
        rowCount: 1
      });

      const { updateInventoryHandler } = await import('../routes/inventory.ts');
      await updateInventoryHandler(mockReq as any, mockRes as any, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });

  describe('POST /inventory/:id/adjust', () => {
    it('should return 400 when adjustment is missing', async () => {
      // Arrange
      mockReq.params = { id: 'inv-1' };
      mockReq.body = { reason: 'Received shipment' };

      const { adjustInventoryHandler } = await import('../routes/inventory.ts');
      await adjustInventoryHandler(mockReq as any, mockRes as any, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should adjust inventory successfully', async () => {
      // Arrange
      mockReq.user = createMockUser({ role: 'manager' });
      mockReq.params = { id: 'inv-1' };
      mockReq.body = { 
        adjustment: 50, 
        reason: 'Received shipment',
        notes: 'Weekly delivery'
      };

      (DatabaseService.pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ current_stock: 100 }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // Insert audit log
        .mockResolvedValueOnce({ rows: [{ id: 'inv-1', current_stock: 150 }], rowCount: 1 });

      const { adjustInventoryHandler } = await import('../routes/inventory.ts');
      await adjustInventoryHandler(mockReq as any, mockRes as any, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            previousStock: 100,
            newStock: 150,
          })
        })
      );
    });

    it('should not allow negative stock', async () => {
      // Arrange
      mockReq.user = createMockUser({ role: 'manager' });
      mockReq.params = { id: 'inv-1' };
      mockReq.body = { adjustment: -150, reason: 'Spoilage' };

      (DatabaseService.pool.query as jest.Mock).mockResolvedValue({
        rows: [{ current_stock: 100 }],
        rowCount: 1
      });

      const { adjustInventoryHandler } = await import('../routes/inventory.ts');
      await adjustInventoryHandler(mockReq as any, mockRes as any, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });

  describe('POST /inventory/analyze-receipt', () => {
    it('should return 400 when file is missing', async () => {
      // Arrange
      mockReq.file = undefined;

      const { analyzeReceiptHandler } = await import('../routes/inventory.ts');
      await analyzeReceiptHandler(mockReq as any, mockRes as any, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should analyze receipt and return inventory items', async () => {
      // Arrange
      mockReq.user = createMockUser({ role: 'manager' });
      mockReq.file = { path: '/tmp/mock-receipt.jpg' };

      const { analyzeReceiptHandler } = await import('../routes/inventory.ts');
      await analyzeReceiptHandler(mockReq as any, mockRes as any, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            items: expect.arrayContaining([
              expect.objectContaining({ name: 'Tomatoes' }),
              expect.objectContaining({ name: 'Onions' }),
            ]),
            total: 24.95,
          })
        })
      );
    });
  });
});
