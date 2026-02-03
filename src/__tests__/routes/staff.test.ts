/**
 * Staff Management API Tests
 * 
 * Tests for staff management endpoints:
 * - GET /staff - List staff members
 * - POST /staff - Create staff member
 * - GET /staff/:id - Get staff details
 * - PATCH /staff/:id - Update staff member
 * - DELETE /staff/:id - Delete staff member
 * - POST /staff/bulk - Bulk operations
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import bcrypt from 'bcryptjs';

// Mock setup file
const { 
  createMockRequest, 
  createMockResponse, 
  createMockNext,
  createMockUser,
  createMockRestaurant,
  createMockStaff,
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

describe('Staff Management API', () => {
  let mockReq: ReturnType<typeof createMockRequest>;
  let mockRes: ReturnType<typeof createMockResponse>;
  let mockNext: jest.Mock;

  beforeEach(() => {
    mockReq = createMockRequest();
    mockRes = createMockResponse();
    mockNext = createMockNext();
    jest.clearAllMocks();
  });

  describe('GET /staff', () => {
    it('should return 401 without authentication', async () => {
      // Arrange
      mockReq.user = undefined;

      const { getStaffHandler } = await import('../routes/staff.ts');
      await getStaffHandler(mockReq as any, mockRes as any, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it('should return 200 with staff list', async () => {
      // Arrange
      const mockUser = createMockUser({ role: 'manager' });
      mockReq.user = { 
        id: mockUser.id, 
        restaurantId: mockUser.restaurantId, 
        role: mockUser.role 
      };

      const mockStaff = [
        createMockStaff({ id: 'staff-1', name: 'John Doe' }),
        createMockStaff({ id: 'staff-2', name: 'Jane Smith', role: 'manager' }),
      ];

      (DatabaseService.pool.query as jest.Mock).mockResolvedValue({
        rows: mockStaff,
        rowCount: 2
      });

      const { getStaffHandler } = await import('../routes/staff.ts');
      await getStaffHandler(mockReq as any, mockRes as any, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            staff: expect.arrayContaining([
              expect.objectContaining({ id: 'staff-1' }),
              expect.objectContaining({ id: 'staff-2' }),
            ])
          })
        })
      );
    });

    it('should filter staff by role', async () => {
      // Arrange
      mockReq.user = createMockUser({ role: 'manager' });
      mockReq.query = { role: 'staff' };

      (DatabaseService.pool.query as jest.Mock).mockResolvedValue({
        rows: [createMockStaff({ role: 'staff' })],
        rowCount: 1
      });

      const { getStaffHandler } = await import('../routes/staff.ts');
      await getStaffHandler(mockReq as any, mockRes as any, mockNext);

      // Assert
      expect(DatabaseService.pool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE restaurant_id = $1 AND role = $2'),
        expect.any(Array)
      );
    });
  });

  describe('POST /staff', () => {
    it('should return 400 when name is missing', async () => {
      // Arrange
      mockReq.body = { email: 'staff@test.com', role: 'staff' };

      const { createStaffHandler } = await import('../routes/staff.ts');
      await createStaffHandler(mockReq as any, mockRes as any, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 when email is missing', async () => {
      // Arrange
      mockReq.body = { name: 'New Staff', role: 'staff' };

      const { createStaffHandler } = await import('../routes/staff.ts');
      await createStaffHandler(mockReq as any, mockRes as any, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 when role is invalid', async () => {
      // Arrange
      mockReq.body = { name: 'New Staff', email: 'staff@test.com', role: 'invalid' };

      const { createStaffHandler } = await import('../routes/staff.ts');
      await createStaffHandler(mockReq as any, mockRes as any, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should return 403 for non-manager', async () => {
      // Arrange
      mockReq.user = createMockUser({ role: 'staff' });
      mockReq.body = { 
        name: 'New Staff', 
        email: 'staff@test.com', 
        role: 'staff',
        pin: '1234' 
      };

      const { createStaffHandler } = await import('../routes/staff.ts');
      await createStaffHandler(mockReq as any, mockRes as any, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    it('should create staff member successfully', async () => {
      // Arrange
      const mockUser = createMockUser({ role: 'manager' });
      mockReq.user = { 
        id: mockUser.id, 
        restaurantId: mockUser.restaurantId, 
        role: mockUser.role 
      };
      mockReq.body = { 
        name: 'New Staff', 
        email: 'staff@test.com', 
        role: 'staff',
        pin: '1234' 
      };

      (DatabaseService.pool.query as jest.Mock).mockResolvedValue({
        rows: [{
          id: 'new-staff-id',
          name: 'New Staff',
          email: 'staff@test.com',
          role: 'staff',
          pin: '1234',
        }],
        rowCount: 1
      });

      const { createStaffHandler } = await import('../routes/staff.ts');
      await createStaffHandler(mockReq as any, mockRes as any, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            staff: expect.objectContaining({ 
              name: 'New Staff',
              email: 'staff@test.com'
            })
          })
        })
      );
    });

    it('should generate PIN when not provided for staff', async () => {
      // Arrange
      mockReq.user = createMockUser({ role: 'manager' });
      mockReq.body = { 
        name: 'New Staff', 
        email: 'staff@test.com', 
        role: 'staff' 
        // No PIN provided
      };

      (DatabaseService.pool.query as jest.Mock).mockResolvedValue({
        rows: [{
          id: 'new-staff-id',
          name: 'New Staff',
          email: 'staff@test.com',
          role: 'staff',
          pin: expect.any(String), // Should be auto-generated
        }],
        rowCount: 1
      });

      const { createStaffHandler } = await import('../routes/staff.ts');
      await createStaffHandler(mockReq as any, mockRes as any, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(201);
    });
  });

  describe('GET /staff/:id', () => {
    it('should return 404 when staff not found', async () => {
      // Arrange
      mockReq.params = { id: 'nonexistent' };

      (DatabaseService.pool.query as jest.Mock).mockResolvedValue({
        rows: [],
        rowCount: 0
      });

      const { getStaffByIdHandler } = await import('../routes/staff.ts');
      await getStaffByIdHandler(mockReq as any, mockRes as any, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('should return 200 with staff details', async () => {
      // Arrange
      const mockStaffMember = createMockStaff();
      mockReq.params = { id: mockStaffMember.id };

      (DatabaseService.pool.query as jest.Mock).mockResolvedValue({
        rows: [mockStaffMember],
        rowCount: 1
      });

      const { getStaffByIdHandler } = await import('../routes/staff.ts');
      await getStaffByIdHandler(mockReq as any, mockRes as any, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });

  describe('PATCH /staff/:id', () => {
    it('should return 403 when non-owner tries to update', async () => {
      // Arrange
      mockReq.user = createMockUser({ role: 'staff', id: 'different-user' });
      mockReq.params = { id: 'staff-1' };
      mockReq.body = { name: 'Updated Name' };

      const { updateStaffHandler } = await import('../routes/staff.ts');
      await updateStaffHandler(mockReq as any, mockRes as any, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    it('should update staff successfully', async () => {
      // Arrange
      mockReq.user = createMockUser({ role: 'owner' });
      mockReq.params = { id: 'staff-1' };
      mockReq.body = { name: 'Updated Name', role: 'manager' };

      (DatabaseService.pool.query as jest.Mock).mockResolvedValue({
        rows: [{
          id: 'staff-1',
          name: 'Updated Name',
          role: 'manager',
        }],
        rowCount: 1
      });

      const { updateStaffHandler } = await import('../routes/staff.ts');
      await updateStaffHandler(mockReq as any, mockRes as any, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });

  describe('DELETE /staff/:id', () => {
    it('should return 403 for non-owner', async () => {
      // Arrange
      mockReq.user = createMockUser({ role: 'manager' });
      mockReq.params = { id: 'staff-1' };

      const { deleteStaffHandler } = await import('../routes/staff.ts');
      await deleteStaffHandler(mockReq as any, mockRes as any, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    it('should delete staff successfully for owner', async () => {
      // Arrange
      mockReq.user = createMockUser({ role: 'owner' });
      mockReq.params = { id: 'staff-1' };

      (DatabaseService.pool.query as jest.Mock).mockResolvedValue({
        rows: [],
        rowCount: 1
      });

      const { deleteStaffHandler } = await import('../routes/staff.ts');
      await deleteStaffHandler(mockReq as any, mockRes as any, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });

  describe('POST /staff/bulk', () => {
    it('should return 400 when operations is missing', async () => {
      // Arrange
      mockReq.body = { staffIds: ['staff-1'] };

      const { bulkStaffHandler } = await import('../routes/staff.ts');
      await bulkStaffHandler(mockReq as any, mockRes as any, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should return 403 for non-manager', async () => {
      // Arrange
      mockReq.user = createMockUser({ role: 'staff' });
      mockReq.body = { operation: 'deactivate', staffIds: ['staff-1'] };

      const { bulkStaffHandler } = await import('../routes/staff.ts');
      await bulkStaffHandler(mockReq as any, mockRes as any, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    it('should perform bulk operation successfully', async () => {
      // Arrange
      mockReq.user = createMockUser({ role: 'manager' });
      mockReq.body = { 
        operation: 'deactivate', 
        staffIds: ['staff-1', 'staff-2'] 
      };

      (DatabaseService.pool.query as jest.Mock).mockResolvedValue({
        rowCount: 2
      });

      const { bulkStaffHandler } = await import('../routes/staff.ts');
      await bulkStaffHandler(mockReq as any, mockRes as any, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ updated: 2 })
        })
      );
    });
  });
});
