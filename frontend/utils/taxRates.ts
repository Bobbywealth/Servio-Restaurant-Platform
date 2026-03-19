/**
 * US State Sales Tax Rates
 * 
 * Tax rates are approximate and may not reflect local/municipal taxes.
 * For production use, consider integrating with a tax service like:
 * - TaxJar (https://www.taxjar.com/)
 * - Avalara (https://www.avalara.com/)
 * - Stripe Tax
 */

export interface StateTaxInfo {
  name: string;
  rate: number; // Base state sales tax rate (decimal)
}

/**
 * US State Sales Tax Rates (as of 2024)
 * Rates are the combined state + average local tax rates
 */
export const US_STATE_TAX_RATES: Record<string, StateTaxInfo> = {
  'AL': { name: 'Alabama', rate: 0.04 },
  'AK': { name: 'Alaska', rate: 0.00 },
  'AZ': { name: 'Arizona', rate: 0.056 },
  'AR': { name: 'Arkansas', rate: 0.065 },
  'CA': { name: 'California', rate: 0.0725 },
  'CO': { name: 'Colorado', rate: 0.029 },
  'CT': { name: 'Connecticut', rate: 0.0635 },
  'DE': { name: 'Delaware', rate: 0.00 },
  'FL': { name: 'Florida', rate: 0.06 },
  'GA': { name: 'Georgia', rate: 0.04 },
  'HI': { name: 'Hawaii', rate: 0.04 },
  'ID': { name: 'Idaho', rate: 0.06 },
  'IL': { name: 'Illinois', rate: 0.0625 },
  'IN': { name: 'Indiana', rate: 0.07 },
  'IA': { name: 'Iowa', rate: 0.06 },
  'KS': { name: 'Kansas', rate: 0.065 },
  'KY': { name: 'Kentucky', rate: 0.06 },
  'LA': { name: 'Louisiana', rate: 0.0445 },
  'ME': { name: 'Maine', rate: 0.055 },
  'MD': { name: 'Maryland', rate: 0.06 },
  'MA': { name: 'Massachusetts', rate: 0.0625 },
  'MI': { name: 'Michigan', rate: 0.06 },
  'MN': { name: 'Minnesota', rate: 0.06875 },
  'MS': { name: 'Mississippi', rate: 0.07 },
  'MO': { name: 'Missouri', rate: 0.04225 },
  'MT': { name: 'Montana', rate: 0.00 },
  'NE': { name: 'Nebraska', rate: 0.055 },
  'NV': { name: 'Nevada', rate: 0.0685 },
  'NH': { name: 'New Hampshire', rate: 0.00 },
  'NJ': { name: 'New Jersey', rate: 0.06625 },
  'NM': { name: 'New Mexico', rate: 0.05125 },
  'NY': { name: 'New York', rate: 0.08 },
  'NC': { name: 'North Carolina', rate: 0.0475 },
  'ND': { name: 'North Dakota', rate: 0.05 },
  'OH': { name: 'Ohio', rate: 0.0575 },
  'OK': { name: 'Oklahoma', rate: 0.045 },
  'OR': { name: 'Oregon', rate: 0.00 },
  'PA': { name: 'Pennsylvania', rate: 0.06 },
  'RI': { name: 'Rhode Island', rate: 0.07 },
  'SC': { name: 'South Carolina', rate: 0.06 },
  'SD': { name: 'South Dakota', rate: 0.045 },
  'TN': { name: 'Tennessee', rate: 0.07 },
  'TX': { name: 'Texas', rate: 0.0625 },
  'UT': { name: 'Utah', rate: 0.0485 },
  'VT': { name: 'Vermont', rate: 0.06 },
  'VA': { name: 'Virginia', rate: 0.053 },
  'WA': { name: 'Washington', rate: 0.065 },
  'WV': { name: 'West Virginia', rate: 0.06 },
  'WI': { name: 'Wisconsin', rate: 0.05 },
  'WY': { name: 'Wyoming', rate: 0.04 },
  'DC': { name: 'Washington D.C.', rate: 0.06 },
  'PR': { name: 'Puerto Rico', rate: 0.105 },
};

/**
 * Get tax rate for a given state code
 * @param stateCode - Two-letter state code (e.g., 'CA', 'TX')
 * @returns The tax rate as a decimal (e.g., 0.0725 for 7.25%)
 */
export function getStateTaxRate(stateCode: string): number {
  const normalized = stateCode.toUpperCase().trim();
  return US_STATE_TAX_RATES[normalized]?.rate ?? 0;
}

/**
 * Get tax info for a given state code
 * @param stateCode - Two-letter state code (e.g., 'CA', 'TX')
 * @returns StateTaxInfo object or null if not found
 */
export function getStateTaxInfo(stateCode: string): StateTaxInfo | null {
  const normalized = stateCode.toUpperCase().trim();
  return US_STATE_TAX_RATES[normalized] ?? null;
}

/**
 * Calculate tax amount for a given subtotal and state
 * @param subtotal - The order subtotal
 * @param stateCode - Two-letter state code (e.g., 'CA', 'TX')
 * @returns The calculated tax amount, rounded to 2 decimal places
 */
export function calculateTax(subtotal: number, stateCode: string): number {
  const rate = getStateTaxRate(stateCode);
  return Math.round(subtotal * rate * 100) / 100;
}

/**
 * Calculate full order totals including tax
 * @param subtotal - The order subtotal
 * @param stateCode - Two-letter state code (e.g., 'CA', 'TX')
 * @returns Object containing subtotal, tax, and total
 */
export function calculateOrderTotals(subtotal: number, stateCode: string): {
  subtotal: number;
  tax: number;
  total: number;
} {
  const tax = calculateTax(subtotal, stateCode);
  return {
    subtotal,
    tax,
    total: Math.round((subtotal + tax) * 100) / 100,
  };
}

/**
 * Get list of all states for dropdowns
 */
export function getStateOptions(): Array<{ code: string; name: string }> {
  return Object.entries(US_STATE_TAX_RATES).map(([code, info]) => ({
    code,
    name: `${info.name} (${(info.rate * 100).toFixed(2)}%)`,
  }));
}
