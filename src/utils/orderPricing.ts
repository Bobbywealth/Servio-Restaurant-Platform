export interface OrderLineItem {
  quantity: number;
  price: number;
}

export interface PricingBreakdown {
  subtotal: number;
  tax: number;
  total: number;
}

const roundMoney = (value: number): number => Math.round(value * 100) / 100;

export const sanitizeTaxRate = (value: unknown): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  if (parsed < 0) return 0;
  // 30% is an upper safety rail to block invalid/tampered input.
  if (parsed > 0.3) return 0.3;
  return parsed;
};

export const calculateSubtotal = (items: OrderLineItem[]): number => {
  const subtotal = items.reduce((sum, item) => {
    const safeQuantity = Number(item.quantity);
    const safePrice = Number(item.price);
    return sum + (safeQuantity * safePrice);
  }, 0);

  return roundMoney(subtotal);
};

export const calculateOrderPricing = (items: OrderLineItem[], taxRate: unknown): PricingBreakdown => {
  const subtotal = calculateSubtotal(items);
  const normalizedTaxRate = sanitizeTaxRate(taxRate);
  const tax = roundMoney(subtotal * normalizedTaxRate);
  const total = roundMoney(subtotal + tax);

  return { subtotal, tax, total };
};
