/**
 * Calculation Utilities
 * 
 * Helper functions for calculating totals, hours, and other numeric values.
 */

// Calculate order subtotal from items
export function calculateOrderSubtotal(items: Array<{ quantity: number; price: number }>): number {
  return items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
}

// Calculate tax amount
export function calculateTax(subtotal: number, taxRate: number): number {
  return Math.round(subtotal * taxRate * 100) / 100;
}

// Calculate order total with tax
export function calculateOrderTotal(
  items: Array<{ quantity: number; price: number }>,
  taxRate: number
): number {
  const subtotal = calculateOrderSubtotal(items);
  const tax = calculateTax(subtotal, taxRate);
  return Math.round((subtotal + tax) * 100) / 100;
}

// Calculate item total with modifiers
export function calculateItemTotal(item: {
  basePrice: number;
  quantity: number;
  modifiers?: Array<{ price: number; quantity?: number }>;
}): number {
  const modifierTotal = (item.modifiers || []).reduce(
    (sum, mod) => sum + (mod.price * (mod.quantity || 1)),
    0
  );
  return (item.basePrice + modifierTotal) * item.quantity;
}

// Calculate hours worked from clock in/out
export function calculateHoursWorked(
  clockIn: Date,
  clockOut: Date,
  breakMinutes: number = 0
): number {
  const diffMs = clockOut.getTime() - clockIn.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const workingMinutes = diffMinutes - breakMinutes;
  return Math.round(workingMinutes / 60 * 100) / 100;
}

// Calculate weekly hours from time entries
export function calculateWeeklyHours(
  timeEntries: Array<{ clockIn: Date; clockOut: Date; breakMinutes: number }>
): number {
  return timeEntries.reduce((total, entry) => {
    return total + calculateHoursWorked(entry.clockIn, entry.clockOut, entry.breakMinutes);
  }, 0);
}

// Calculate scheduled hours
export function calculateScheduledHours(
  shifts: Array<{ start: string; end: string }>
): number {
  return shifts.reduce((total, shift) => {
    const [startHour, startMin] = shift.start.split(':').map(Number);
    const [endHour, endMin] = shift.end.split(':').map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    const diffMinutes = endMinutes - startMinutes;
    return total + diffMinutes / 60;
  }, 0);
}

// Detect schedule conflict
export function hasScheduleConflict(
  existingShifts: Array<{ start: string; end: string; date: string }>,
  newShift: { start: string; end: string; date: string }
): boolean {
  return existingShifts.some(shift => {
    if (shift.date !== newShift.date) return false;
    
    const [newStart] = newShift.start.split(':').map(Number);
    const [newEnd] = newShift.end.split(':').map(Number);
    const [existStart] = shift.start.split(':').map(Number);
    const [existEnd] = shift.end.split(':').map(Number);
    
    return newStart < existEnd && newEnd > existStart;
  });
}

// Calculate stock value
export function calculateStockValue(
  items: Array<{ quantity: number; unitCost: number }>
): number {
  return items.reduce((total, item) => total + (item.quantity * item.unitCost), 0);
}

// Check if reorder is needed
export function needsReorder(currentStock: number, reorderLevel: number): boolean {
  return currentStock <= reorderLevel;
}

// Calculate reorder quantity
export function calculateReorderQuantity(
  currentStock: number,
  reorderLevel: number,
  maxStock: number
): number {
  return Math.max(0, maxStock - currentStock);
}

// Check if order can be cancelled
export function canCancelOrder(status: string): boolean {
  return status === 'pending';
}

// Calculate order progress percentage
export function calculateOrderProgress(
  status: string,
  statusOrder: string[]
): number {
  const index = statusOrder.indexOf(status);
  if (index === -1) return 0;
  return Math.round((index / (statusOrder.length - 1)) * 100);
}

// Estimate completion time based on items
export function estimateCompletionTime(
  items: Array<{ quantity: number }>,
  avgPrepTimePerItem: number = 15
): number {
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  return totalItems * avgPrepTimePerItem;
}

// Calculate size price
export function calculateSizePrice(basePrice: number, sizeMultiplier: number): number {
  return Math.round(basePrice * sizeMultiplier * 100) / 100;
}

// Calculate modifier total
export function calculateModifierTotal(
  modifiers: Array<{ price: number; quantity: number }>
): number {
  return modifiers.reduce((total, mod) => total + (mod.price * mod.quantity), 0);
}

// Calculate menu item price with all options
export function calculateMenuItemPrice(item: {
  basePrice: number;
  sizeMultiplier?: number;
  modifiers?: Array<{ price: number; quantity?: number }>;
}): number {
  const sizeMultiplier = item.sizeMultiplier || 1;
  const modifierTotal = (item.modifiers || []).reduce(
    (sum, mod) => sum + (mod.price * (mod.quantity || 1)),
    0
  );
  return Math.round((item.basePrice * sizeMultiplier + modifierTotal) * 100) / 100;
}
