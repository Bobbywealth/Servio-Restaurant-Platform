import { useMemo } from 'react';
import { calculateTax, calculateOrderTotals, getStateTaxRate, getStateTaxInfo } from '../utils/taxRates';

/**
 * Hook for calculating sales tax based on state
 * 
 * @param subtotal - The order subtotal amount
 * @param stateCode - The customer's state code (e.g., 'CA', 'TX')
 * @returns Tax calculation results and helper functions
 */
export function useTaxCalculation(subtotal: number, stateCode: string) {
  // Get the tax rate for the state
  const taxRate = useMemo(() => {
    return getStateTaxRate(stateCode);
  }, [stateCode]);

  // Get the state tax info
  const stateInfo = useMemo(() => {
    return getStateTaxInfo(stateCode);
  }, [stateCode]);

  // Calculate the tax amount
  const taxAmount = useMemo(() => {
    return calculateTax(subtotal, stateCode);
  }, [subtotal, stateCode]);

  // Calculate all order totals
  const totals = useMemo(() => {
    return calculateOrderTotals(subtotal, stateCode);
  }, [subtotal, stateCode]);

  // Format the tax rate as a percentage string
  const formattedTaxRate = useMemo(() => {
    return `${(taxRate * 100).toFixed(2)}%`;
  }, [taxRate]);

  // Check if the state has a tax
  const hasTax = taxRate > 0;

  return {
    taxRate,
    taxAmount,
    subtotal: totals.subtotal,
    total: totals.total,
    stateInfo,
    formattedTaxRate,
    hasTax,
    stateCode,
  };
}

/**
 * Format currency amount
 */
export function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}
