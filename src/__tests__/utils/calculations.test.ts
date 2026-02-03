/**
 * Calculation Utilities Tests
 * 
 * Tests for order total calculations, time entry calculations, and other utility functions.
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';

describe('Calculation Utilities', () => {
  describe('Order Total Calculations', () => {
    it('should calculate order subtotal', async () => {
      const { calculateOrderSubtotal } = await import('./utils/calculations.ts');
      
      const items = [
        { name: 'Burger', quantity: 2, price: 9.99 },
        { name: 'Fries', quantity: 1, price: 4.99 },
      ];
      
      const subtotal = calculateOrderSubtotal(items);
      expect(subtotal).toBe(24.97); // (2 * 9.99) + 4.99
    });

    it('should calculate tax', async () => {
      const { calculateTax } = await import('./utils/calculations.ts');
      
      const subtotal = 25.00;
      const taxRate = 0.0825; // 8.25%
      
      const tax = calculateTax(subtotal, taxRate);
      expect(tax).toBe(2.06); // Rounded to 2 decimal places
    });

    it('should calculate order total with tax', async () => {
      const { calculateOrderTotal } = await import('./utils/calculations.ts');
      
      const items = [
        { quantity: 1, price: 10.00 },
        { quantity: 2, price: 5.00 },
      ];
      const taxRate = 0.08;
      
      const total = calculateOrderTotal(items, taxRate);
      expect(total).toBe(21.60); // (10 + 10) * 1.08
    });

    it('should calculate item total with modifiers', async () => {
      const { calculateItemTotal } = await import('./utils/calculations.ts');
      
      const item = {
        basePrice: 10.00,
        quantity: 2,
        modifiers: [
          { name: 'Extra Cheese', price: 1.50 },
          { name: 'Large Size', price: 2.00 },
        ],
      };
      
      const total = calculateItemTotal(item);
      expect(total).toBe(27.00); // (10 + 1.50 + 2.00) * 2
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
      expect(hours).toBe(8); // 8.5 - 0.5 = 8
    });

    it('should handle overnight shifts', async () => {
      const { calculateHoursWorked } = await import('./utils/calculations.ts');
      
      const clockIn = new Date('2024-01-15T22:00:00Z');
      const clockOut = new Date('2024-01-16T06:00:00Z');
      
      const hours = calculateHoursWorked(clockIn, clockOut);
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
      expect(weeklyHours).toBe(24); // 8 hours * 3 days
    });
  });

  describe('Menu Item Calculations', () => {
    it('should calculate price with size multiplier', async () => {
      const { calculateSizePrice } = await import('./utils/calculations.ts');
      
      const basePrice = 10.00;
      const sizeMultiplier = 1.5;
      
      const price = calculateSizePrice(basePrice, sizeMultiplier);
      expect(price).toBe(15.00);
    });

    it('should calculate modifier total', async () => {
      const { calculateModifierTotal } = await import('./utils/calculations.ts');
      
      const modifiers = [
        { name: 'Extra Cheese', price: 1.50, quantity: 2 },
        { name: 'Bacon', price: 2.00, quantity: 1 },
      ];
      
      const total = calculateModifierTotal(modifiers);
      expect(total).toBe(5.00); // (1.50 * 2) + 2.00
    });

    it('should calculate menu item price with all options', async () => {
      const { calculateMenuItemPrice } = await import('./utils/calculations.ts');
      
      const item = {
        basePrice: 10.00,
        sizeMultiplier: 1.25,
        modifiers: [
          { price: 1.00, quantity: 1 },
          { price: 1.50, quantity: 2 },
        ],
      };
      
      const price = calculateMenuItemPrice(item);
      // (10 * 1.25) + (1 * 1) + (1.50 * 2) = 12.5 + 1 + 3 = 16.50
      expect(price).toBe(16.50);
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
      expect(value).toBe(27.50); // (10 * 2) + (5 * 1.5)
    });

    it('should determine reorder needed', async () => {
      const { needsReorder } = await import('./utils/calculations.ts');
      
      // Below reorder level
      expect(needsReorder(5, 10)).toBe(true);
      
      // At reorder level
      expect(needsReorder(10, 10)).toBe(true);
      
      // Above reorder level
      expect(needsReorder(15, 10)).toBe(false);
    });

    it('should calculate reorder quantity', async () => {
      const { calculateReorderQuantity } = await import('./utils/calculations.ts');
      
      const currentStock = 5;
      const reorderLevel = 20;
      const maxStock = 50;
      
      const quantity = calculateReorderQuantity(currentStock, reorderLevel, maxStock);
      expect(quantity).toBe(45); // 50 - 5 = 45
    });
  });

  describe('Staff Scheduling Calculations', () => {
    it('should calculate scheduled hours', async () => {
      const { calculateScheduledHours } = await import('./utils/calculations.ts');
      
      const shifts = [
        { start: '09:00', end: '17:00' },
        { start: '10:00', end: '18:00' },
      ];
      
      const hours = calculateScheduledHours(shifts);
      expect(hours).toBe(16);
    });

    it('should detect schedule conflicts', async () => {
      const { hasScheduleConflict } = await import('./utils/calculations.ts');
      
      const shifts = [
        { start: '09:00', end: '17:00', date: '2024-01-15' },
      ];
      
      const newShift = { start: '10:00', end: '18:00', date: '2024-01-15' };
      
      expect(hasScheduleConflict(shifts, newShift)).toBe(true);
    });

    it('should allow non-conflicting shifts', async () => {
      const { hasScheduleConflict } = await import('./utils/calculations.ts');
      
      const shifts = [
        { start: '09:00', end: '13:00', date: '2024-01-15' },
      ];
      
      const newShift = { start: '14:00', end: '18:00', date: '2024-01-15' };
      
      expect(hasScheduleConflict(shifts, newShift)).toBe(false);
    });
  });

  describe('Order Status Calculations', () => {
    it('should determine if order can be cancelled', async () => {
      const { canCancelOrder } = await import('./utils/calculations.ts');
      
      // Can cancel pending order
      expect(canCancelOrder('pending')).toBe(true);
      
      // Cannot cancel preparing order
      expect(canCancelOrder('preparing')).toBe(false);
      
      // Cannot cancel ready order
      expect(canCancelOrder('ready')).toBe(false);
      
      // Cannot cancel completed order
      expect(canCancelOrder('completed')).toBe(false);
    });

    it('should calculate order progress', async () => {
      const { calculateOrderProgress } = await import('./utils/calculations.ts');
      
      const status = 'preparing';
      const statusOrder = ['pending', 'preparing', 'ready', 'completed'];
      
      const progress = calculateOrderProgress(status, statusOrder);
      expect(progress).toBe(33); // Approximately 33% through
    });

    it('should estimate completion time', async () => {
      const { estimateCompletionTime } = await import('./utils/calculations.ts');
      
      const avgPrepTime = 15; // minutes per item
      const items = [
        { name: 'Burger', quantity: 2 },
        { name: 'Fries', quantity: 1 },
      ];
      
      const time = estimateCompletionTime(items, avgPrepTime);
      expect(time).toBe(45); // 3 items * 15 minutes
    });
  });
});
