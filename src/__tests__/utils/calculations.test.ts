/**
 * Calculation Utilities Tests
 * 
 * Tests for order total calculations, time entry calculations, and other utility functions.
 */

describe('Calculation Utilities', () => {
  describe('Order Total Calculations', () => {
    it('should calculate order subtotal', async () => {
      const { calculateOrderSubtotal } = await import('./utils/calculations.ts');
      
      const items = [
        { name: 'Burger', quantity: 2, price: 9.99 },
        { name: 'Fries', quantity: 1, price: 4.99 },
      ];
      
      const subtotal = calculateOrderSubtotal(items);
      expect(subtotal).toBe(24.97);
    });

    it('should calculate tax', async () => {
      const { calculateTax } = await import('./utils/calculations.ts');
      
      const subtotal = 25.00;
      const taxRate = 0.0825; // 8.25%
      
      const tax = calculateTax(subtotal, taxRate);
      expect(tax).toBe(2.06);
    });

    it('should calculate order total with tax', async () => {
      const { calculateOrderTotal } = await import('./utils/calculations.ts');
      
      const items = [
        { quantity: 1, price: 10.00 },
        { quantity: 2, price: 5.00 },
      ];
      const taxRate = 0.08;
      
      const total = calculateOrderTotal(items, taxRate);
      expect(total).toBe(21.60);
    });
  });

  describe('Time Entry Calculations', () => {
    it('should calculate hours worked from clock in/out', async () => {
      const { calculateHoursWorked } = await import('./utils/calculations.ts');
      
      const clockIn = new Date('2024-01-15T09:00:00Z');
      const clockOut = new Date('2024-01-15T17:00:00Z');
      
      const hours = calculateHoursWorked(clockIn, clockOut);
      expect(hours).toBe(8);
    });

    it('should account for break time', async () => {
      const { calculateHoursWorked } = await import('./utils/calculations.ts');
      
      const clockIn = new Date('2024-01-15T09:00:00Z');
      const clockOut = new Date('2024-01-15T17:30:00Z');
      const breakMinutes = 30;
      
      const hours = calculateHoursWorked(clockIn, clockOut, breakMinutes);
      expect(hours).toBe(8);
    });

    it('should calculate weekly hours', async () => {
      const { calculateWeeklyHours } = await import('./utils/calculations.ts');
      
      const timeEntries = [
        { clockIn: new Date('2024-01-15T09:00:00Z'), clockOut: new Date('2024-01-15T17:00:00Z'), breakMinutes: 30 },
        { clockIn: new Date('2024-01-16T09:00:00Z'), clockOut: new Date('2024-01-16T17:00:00Z'), breakMinutes: 30 },
        { clockIn: new Date('2024-01-17T09:00:00Z'), clockOut: new Date('2024-01-17T17:00:00Z'), breakMinutes: 30 },
      ];
      
      const weeklyHours = calculateWeeklyHours(timeEntries);
      expect(weeklyHours).toBe(24);
    });
  });

  describe('Inventory Calculations', () => {
    it('should calculate stock value', async () => {
      const { calculateStockValue } = await import('./utils/calculations.ts');
      
      const items = [
        { name: 'Tomatoes', quantity: 10, unitCost: 2.00 },
        { name: 'Onions', quantity: 5, unitCost: 1.50 },
      ];
      
      const value = calculateStockValue(items);
      expect(value).toBe(27.50);
    });

    it('should determine reorder needed', async () => {
      const { needsReorder } = await import('./utils/calculations.ts');
      
      expect(needsReorder(5, 10)).toBe(true);
      expect(needsReorder(10, 10)).toBe(true);
      expect(needsReorder(15, 10)).toBe(false);
    });

    it('should calculate reorder quantity', async () => {
      const { calculateReorderQuantity } = await import('./utils/calculations.ts');
      
      const quantity = calculateReorderQuantity(5, 20, 50);
      expect(quantity).toBe(45);
    });
  });

  describe('Order Status Calculations', () => {
    it('should determine if order can be cancelled', async () => {
      const { canCancelOrder } = await import('./utils/calculations.ts');
      
      expect(canCancelOrder('pending')).toBe(true);
      expect(canCancelOrder('preparing')).toBe(false);
      expect(canCancelOrder('ready')).toBe(false);
      expect(canCancelOrder('completed')).toBe(false);
    });

    it('should calculate order progress', async () => {
      const { calculateOrderProgress } = await import('./utils/calculations.ts');
      
      const status = 'preparing';
      const statusOrder = ['pending', 'preparing', 'ready', 'completed'];
      
      const progress = calculateOrderProgress(status, statusOrder);
      expect(progress).toBe(33);
    });
  });
});
