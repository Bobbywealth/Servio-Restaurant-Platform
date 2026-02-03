/**
 * Validation Utilities Tests
 * 
 * Tests for environment variable validation and input validation utilities.
 */

describe('Validation Utilities', () => {
  describe('Environment Variable Validation', () => {
    it('should validate required environment variables', async () => {
      // Import validation function
      const { validateEnv } = await import('./utils/validation.ts');
      
      // Set required environment variables
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

    it('should validate order status', async () => {
      const { isValidOrderStatus } = await import('./utils/validation.ts');
      
      const validStatuses = ['pending', 'preparing', 'ready', 'completed', 'cancelled'];
      
      validStatuses.forEach(status => {
        expect(isValidOrderStatus(status)).toBe(true);
      });

      expect(isValidOrderStatus('invalid')).toBe(false);
    });
  });
});
