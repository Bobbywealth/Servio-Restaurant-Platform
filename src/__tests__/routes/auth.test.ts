/**
 * Authentication Routes Tests
 * 
 * Tests for authentication endpoints:
 * - POST /auth/login
 * - POST /auth/signup
 * - POST /auth/refresh
 * - POST /auth/logout
 * - POST /auth/switch-restaurant
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Mock setup file
const { 
  createMockRequest, 
  createMockResponse, 
  createMockNext,
  createMockUser,
  createMockRestaurant,
  assertApiResponse,
  assertErrorResponse
} = await import('./setup.ts');

// Mock database service
jest.unstable_mockModule('./services/DatabaseService.ts', () => ({
  default: {
    pool: {
      query: jest.fn(),
    },
    getRestaurantById: jest.fn(),
    getUserById: jest.fn(),
  },
}));

// Import after mocking
const { default: DatabaseService } = await import('./services/DatabaseService.ts');

describe('Authentication Routes', () => {
  let mockReq: ReturnType<typeof createMockRequest>;
  let mockRes: ReturnType<typeof createMockResponse>;
  let mockNext: jest.Mock;

  beforeEach(() => {
    mockReq = createMockRequest();
    mockRes = createMockResponse();
    mockNext = createMockNext();
    jest.clearAllMocks();
  });

  describe('POST /auth/login', () => {
    it('should return 400 when email is missing', async () => {
      // Arrange
      mockReq.body = { password: 'password123' };
      
      // Import and call the login handler
      const { loginHandler } = await import('./routes/auth.ts');
      await loginHandler(mockReq as any, mockRes as any, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Email is required' })
      );
    });

    it('should return 400 when password is missing', async () => {
      // Arrange
      mockReq.body = { email: 'test@example.com' };
      
      // Import and call the login handler
      const { loginHandler } = await import('./routes/auth.ts');
      await loginHandler(mockReq as any, mockRes as any, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should return 401 when credentials are invalid', async () => {
      // Arrange
      mockReq.body = { 
        email: 'test@example.com', 
        password: 'wrongpassword' 
      };

      // Mock database query to return no user
      (DatabaseService.pool.query as jest.Mock).mockResolvedValue({
        rows: [],
        rowCount: 0
      });

      const { loginHandler } = await import('./routes/auth.ts');
      await loginHandler(mockReq as any, mockRes as any, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Invalid credentials' })
      );
    });

    it('should return 200 and token when credentials are valid', async () => {
      // Arrange
      const hashedPassword = await bcrypt.hash('password123', 10);
      const mockUser = createMockUser({ 
        email: 'test@example.com',
        password: hashedPassword 
      });
      
      mockReq.body = { 
        email: 'test@example.com', 
        password: 'password123' 
      };

      // Mock database query to return user
      (DatabaseService.pool.query as jest.Mock).mockResolvedValue({
        rows: [mockUser],
        rowCount: 1
      });

      // Mock restaurant lookup
      (DatabaseService.getRestaurantById as jest.Mock).mockResolvedValue(
        createMockRestaurant({ id: mockUser.restaurantId })
      );

      const { loginHandler } = await import('./routes/auth.ts');
      await loginHandler(mockReq as any, mockRes as any, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            user: expect.objectContaining({ id: mockUser.id }),
            restaurant: expect.objectContaining({ id: mockUser.restaurantId }),
          })
        })
      );
    });
  });

  describe('POST /auth/refresh', () => {
    it('should return 400 when refresh token is missing', async () => {
      // Arrange
      mockReq.body = {};

      const { refreshHandler } = await import('./routes/auth.ts');
      await refreshHandler(mockReq as any, mockRes as any, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should return 401 when refresh token is invalid', async () => {
      // Arrange
      mockReq.body = { refreshToken: 'invalid-token' };

      const { refreshHandler } = await import('./routes/auth.ts');
      await refreshHandler(mockReq as any, mockRes as any, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it('should return 200 with new tokens when refresh token is valid', async () => {
      // Arrange
      const mockUser = createMockUser();
      const refreshToken = jwt.sign(
        { userId: mockUser.id, type: 'refresh' },
        process.env.JWT_REFRESH_SECRET!,
        { expiresIn: '30d' }
      );
      
      mockReq.body = { refreshToken };

      // Mock database query
      (DatabaseService.pool.query as jest.Mock).mockResolvedValue({
        rows: [mockUser],
        rowCount: 1
      });

      // Verify the token is valid
      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as any;
      expect(decoded.userId).toBe(mockUser.id);

      const { refreshHandler } = await import('./routes/auth.ts');
      await refreshHandler(mockReq as any, mockRes as any, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            accessToken: expect.any(String),
            refreshToken: expect.any(String),
          })
        })
      );
    });
  });

  describe('POST /auth/logout', () => {
    it('should return 200 and clear refresh token', async () => {
      // Arrange
      mockReq.body = { refreshToken: 'mock-refresh-token' };

      const { logoutHandler } = await import('./routes/auth.ts');
      await logoutHandler(mockReq as any, mockRes as any, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Logged out successfully'
        })
      );
    });
  });

  describe('POST /auth/switch-restaurant', () => {
    it('should return 400 when restaurantId is missing', async () => {
      // Arrange
      mockReq.body = {};

      const { switchRestaurantHandler } = await import('./routes/auth.ts');
      await switchRestaurantHandler(mockReq as any, mockRes as any, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should return 403 when user does not have access to restaurant', async () => {
      // Arrange
      mockReq.user = createMockUser({ id: 'user-1' });
      mockReq.body = { restaurantId: 'unauthorized-restaurant' };

      // Mock database query to return no access
      (DatabaseService.pool.query as jest.Mock).mockResolvedValue({
        rows: [],
        rowCount: 0
      });

      const { switchRestaurantHandler } = await import('./routes/auth.ts');
      await switchRestaurantHandler(mockReq as any, mockRes as any, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    it('should return 200 with new tokens when user has access', async () => {
      // Arrange
      const mockUser = createMockUser();
      const mockRestaurant = createMockRestaurant({ id: 'restaurant-2' });
      
      mockReq.user = { ...mockUser, restaurantId: 'restaurant-2' };
      mockReq.body = { restaurantId: 'restaurant-2' };

      // Mock database query for user access
      (DatabaseService.pool.query as jest.Mock).mockResolvedValue({
        rows: [{ ...mockUser, restaurant_id: 'restaurant-2' }],
        rowCount: 1
      });

      // Mock restaurant lookup
      (DatabaseService.getRestaurantById as jest.Mock).mockResolvedValue(mockRestaurant);

      const { switchRestaurantHandler } = await import('./routes/auth.ts');
      await switchRestaurantHandler(mockReq as any, mockRes as any, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            user: expect.any(Object),
            restaurant: expect.objectContaining({ id: mockRestaurant.id }),
          })
        })
      );
    });
  });
});
