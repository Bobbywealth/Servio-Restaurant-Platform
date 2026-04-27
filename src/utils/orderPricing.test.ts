import { calculateOrderPricing, sanitizeTaxRate } from './orderPricing';

describe('orderPricing', () => {
  it('calculates subtotal, tax, and total with proper currency rounding', () => {
    const result = calculateOrderPricing([
      { quantity: 2, price: 9.99 },
      { quantity: 1, price: 4.5 }
    ], 0.0825);

    expect(result).toEqual({
      subtotal: 24.48,
      tax: 2.02,
      total: 26.5
    });
  });

  it('sanitizes invalid tax rates', () => {
    expect(sanitizeTaxRate(-1)).toBe(0);
    expect(sanitizeTaxRate('not-a-number')).toBe(0);
    expect(sanitizeTaxRate(0.5)).toBe(0.3);
  });

  it('returns zero tax when taxRate is omitted', () => {
    const result = calculateOrderPricing([{ quantity: 1, price: 10 }], undefined);
    expect(result).toEqual({ subtotal: 10, tax: 0, total: 10 });
  });
});
