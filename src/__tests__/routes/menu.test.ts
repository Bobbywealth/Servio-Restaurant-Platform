/**
 * Menu API Tests
 * 
 * Tests for menu management endpoints:
 * - GET /menu - List menu categories and items
 * - POST /menu/categories - Create category
 * - POST /menu/items - Create menu item
 * - PATCH /menu/items/:id - Update menu item
 * - DELETE /menu/items/:id - Delete menu item
 * - POST /menu/import - Import menu from file
 * - GET /menu/public/:slug - Public menu access
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// Mock setup file
const { 
  createMockRequest, 
  createMockResponse, 
  createMockNext,
  createMockUser,
  createMockRestaurant,
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
  },
}));

// Import after mocking
const { default: DatabaseService } = await import('../services/DatabaseService.ts');

describe('Menu API', () => {
  let mockReq: ReturnType<typeof createMockRequest>;
  let mockRes: ReturnType<typeof createMockResponse>;
  let mockNext: jest.Mock;

  beforeEach(() => {
    mockReq = createMockRequest();
    mockRes = createMockResponse();
    mockNext = createMockNext();
    jest.clearAllMocks();
  });

  describe('GET /menu', () => {
    it('should return 401 without authentication', async () => {
      // Arrange
      mockReq.user = undefined;

      const { getMenuHandler } = await import('../routes/menu.ts');
      await getMenuHandler(mockReq as any, mockRes as any, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it('should return 200 with menu structure', async () => {
      // Arrange
      const mockUser = createMockUser({ role: 'staff' });
      mockReq.user = { 
        id: mockUser.id, 
        restaurantId: mockUser.restaurantId, 
        role: mockUser.role 
      };

      const mockCategories = [
        { id: 'cat-1', name: 'Appetizers', sort_order: 1 },
        { id: 'cat-2', name: 'Main Courses', sort_order: 2 },
      ];
      
      const mockMenuItems = [
        { ...createMockMenuItem({ id: 'item-1', categoryId: 'cat-1' }), category: mockCategories[0] },
        { ...createMockMenuItem({ id: 'item-2', categoryId: 'cat-2' }), category: mockCategories[1] },
      ];

      (DatabaseService.pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: mockCategories, rowCount: 2 })
        .mockResolvedValueOnce({ rows: mockMenuItems, rowCount: 2 });

      const { getMenuHandler } = await import('../routes/menu.ts');
      await getMenuHandler(mockReq as any, mockRes as any, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            categories: expect.arrayContaining([
              expect.objectContaining({ id: 'cat-1' }),
              expect.objectContaining({ id: 'cat-2' }),
            ]),
            items: expect.any(Array),
          })
        })
      );
    });
  });

  describe('POST /menu/categories', () => {
    it('should return 400 when name is missing', async () => {
      // Arrange
      mockReq.body = { sortOrder: 1 };

      const { createCategoryHandler } = await import('../routes/menu.ts');
      await createCategoryHandler(mockReq as any, mockRes as any, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should create category successfully', async () => {
      // Arrange
      const mockUser = createMockUser({ role: 'manager' });
      mockReq.user = { 
        id: mockUser.id, 
        restaurantId: mockUser.restaurantId, 
        role: mockUser.role 
      };
      mockReq.body = { name: 'New Category', sortOrder: 3 };

      (DatabaseService.pool.query as jest.Mock).mockResolvedValue({
        rows: [{ id: 'new-cat-id', name: 'New Category', sort_order: 3 }],
        rowCount: 1
      });

      const { createCategoryHandler } = await import('../routes/menu.ts');
      await createCategoryHandler(mockReq as any, mockRes as any, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ category: expect.objectContaining({ name: 'New Category' }) })
        })
      );
    });

    it('should return 403 for non-manager', async () => {
      // Arrange
      mockReq.user = createMockUser({ role: 'staff' });
      mockReq.body = { name: 'New Category' };

      const { createCategoryHandler } = await import('../routes/menu.ts');
      await createCategoryHandler(mockReq as any, mockRes as any, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(403);
    });
  });

  describe('POST /menu/items', () => {
    it('should return 400 when name is missing', async () => {
      // Arrange
      mockReq.body = { price: 9.99, categoryId: 'cat-1' };

      const { createMenuItemHandler } = await import('../routes/menu.ts');
      await createMenuItemHandler(mockReq as any, mockRes as any, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 when price is missing', async () => {
      // Arrange
      mockReq.body = { name: 'New Item', categoryId: 'cat-1' };

      const { createMenuItemHandler } = await import('../routes/menu.ts');
      await createMenuItemHandler(mockReq as any, mockRes as any, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should create menu item successfully', async () => {
      // Arrange
      const mockUser = createMockUser({ role: 'manager' });
      mockReq.user = { 
        id: mockUser.id, 
        restaurantId: mockUser.restaurantId, 
        role: mockUser.role 
      };
      mockReq.body = {
        name: 'Delicious Burger',
        description: 'A tasty burger',
        price: 12.99,
        categoryId: 'cat-1',
        available: true,
      };

      (DatabaseService.pool.query as jest.Mock).mockResolvedValue({
        rows: [{
          id: 'new-item-id',
          name: 'Delicious Burger',
          description: 'A tasty burger',
          price: 12.99,
          category_id: 'cat-1',
          available: true,
        }],
        rowCount: 1
      });

      const { createMenuItemHandler } = await import('../routes/menu.ts');
      await createMenuItemHandler(mockReq as any, mockRes as any, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(201);
    });
  });

  describe('PATCH /menu/items/:id', () => {
    it('should return 404 when item not found', async () => {
      // Arrange
      mockReq.params = { id: 'nonexistent' };
      mockReq.body = { name: 'Updated Name' };

      (DatabaseService.pool.query as jest.Mock).mockResolvedValue({
        rows: [],
        rowCount: 0
      });

      const { updateMenuItemHandler } = await import('../routes/menu.ts');
      await updateMenuItemHandler(mockReq as any, mockRes as any, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('should update menu item successfully', async () => {
      // Arrange
      mockReq.params = { id: 'item-1' };
      mockReq.body = { name: 'Updated Name', price: 14.99 };

      (DatabaseService.pool.query as jest.Mock).mockResolvedValue({
        rows: [{
          id: 'item-1',
          name: 'Updated Name',
          price: 14.99,
        }],
        rowCount: 1
      });

      const { updateMenuItemHandler } = await import('../routes/menu.ts');
      await updateMenuItemHandler(mockReq as any, mockRes as any, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });

  describe('DELETE /menu/items/:id', () => {
    it('should return 403 for non-manager', async () => {
      // Arrange
      mockReq.user = createMockUser({ role: 'staff' });
      mockReq.params = { id: 'item-1' };

      const { deleteMenuItemHandler } = await import('../routes/menu.ts');
      await deleteMenuItemHandler(mockReq as any, mockRes as any, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    it('should delete menu item successfully', async () => {
      // Arrange
      mockReq.user = createMockUser({ role: 'manager' });
      mockReq.params = { id: 'item-1' };

      (DatabaseService.pool.query as jest.Mock).mockResolvedValue({
        rows: [],
        rowCount: 1
      });

      const { deleteMenuItemHandler } = await import('../routes/menu.ts');
      await deleteMenuItemHandler(mockReq as any, mockRes as any, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });

  describe('POST /menu/import', () => {
    it('should return 400 when file is missing', async () => {
      // Arrange
      mockReq.file = undefined;

      const { importMenuHandler } = await import('../routes/menu.ts');
      await importMenuHandler(mockReq as any, mockRes as any, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should return 403 for non-manager', async () => {
      // Arrange
      mockReq.user = createMockUser({ role: 'staff' });
      mockReq.file = { path: '/tmp/mock-file.csv' };

      const { importMenuHandler } = await import('../routes/menu.ts');
      await importMenuHandler(mockReq as any, mockRes as any, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    it('should import menu from CSV file', async () => {
      // Arrange
      mockReq.user = createMockUser({ role: 'manager' });
      mockReq.file = { path: '/tmp/mock-file.csv' };
      mockReq.body = { categoryName: 'Imported Category' };

      (DatabaseService.pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ id: 'new-cat-id' }], rowCount: 1 })
        .mockResolvedValue({ rows: [], rowCount: 0 });

      const { importMenuHandler } = await import('../routes/menu.ts');
      await importMenuHandler(mockReq as any, mockRes as any, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });

  describe('GET /menu/public/:slug', () => {
    it('should return 404 when restaurant not found', async () => {
      // Arrange
      mockReq.params = { slug: 'nonexistent' };

      (DatabaseService.pool.query as jest.Mock).mockResolvedValue({
        rows: [],
        rowCount: 0
      });

      const { publicGetMenuHandler } = await import('../routes/menu.ts');
      await publicGetMenuHandler(mockReq as any, mockRes as any, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('should return public menu for valid slug', async () => {
      // Arrange
      const mockRestaurant = createMockRestaurant();
      mockReq.params = { slug: mockRestaurant.slug };

      (DatabaseService.pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [mockRestaurant], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ id: 'cat-1', name: 'Category' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [createMockMenuItem()], rowCount: 1 });

      const { publicGetMenuHandler } = await import('../routes/menu.ts');
      await publicGetMenuHandler(mockReq as any, mockRes as any, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            restaurant: expect.objectContaining({ id: mockRestaurant.id }),
          })
        })
      );
    });
  });
});
