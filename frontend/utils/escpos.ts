/**
 * Plain text receipt generator for thermal printers
 * Used with RawBT app for direct Bluetooth printing without dialogs
 */

export interface ReceiptItem {
  name: string;
  quantity: number;
  price: number;
  modifiers?: string[];
}

export interface ReceiptData {
  restaurantName?: string;
  restaurantPhone?: string;
  restaurantAddress?: string | { line1?: string; line2?: string; city?: string; state?: string; zip?: string } | null;
  orderId: string;
  orderNumber: string;
  customerName?: string;
  customerPhone?: string;
  orderType?: string;
  items: ReceiptItem[];
  subtotal?: number;
  tax?: number;
  total: number;
  pickupTime?: string;
  createdAt?: string;
  specialInstructions?: string;
  headerText?: string;
  footerText?: string;
}

function formatAddress(address: ReceiptData['restaurantAddress']): string {
  if (!address) return '';
  if (typeof address === 'string') return address;
  const parts = [address.line1, address.line2, address.city, address.state, address.zip].filter(Boolean);
  return parts.join(', ');
}

function centerText(text: string, width: number): string {
  if (text.length >= width) return text.substring(0, width);
  const padding = Math.floor((width - text.length) / 2);
  return ' '.repeat(padding) + text;
}

function padRight(str: string, len: number): string {
  return str.length >= len ? str.substring(0, len) : str + ' '.repeat(len - str.length);
}

function padLeft(str: string, len: number): string {
  return str.length >= len ? str.substring(0, len) : ' '.repeat(len - str.length) + str;
}

function formatMoney(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

function line(char: string, width: number): string {
  return char.repeat(width);
}

/**
 * Generate a plain text receipt (no ESC/POS codes)
 * RawBT will format this as plain text for the printer
 */
export function generatePlainTextReceipt(data: ReceiptData, paperWidth: '80mm' | '58mm' = '80mm'): string {
  const charWidth = paperWidth === '80mm' ? 48 : 32;
  const divider = line('-', charWidth);
  const doubleDivider = line('=', charWidth);
  
  let receipt = '';

  // Custom header text if provided
  if (data.headerText) {
    receipt += centerText(data.headerText.toUpperCase(), charWidth) + '\n';
    receipt += divider + '\n';
  }

  // Header - Restaurant name (centered)
  receipt += centerText(data.restaurantName?.toUpperCase() || 'SERVIO RESTAURANT', charWidth) + '\n';

  // Restaurant info (centered)
  if (data.restaurantPhone) {
    receipt += centerText(data.restaurantPhone, charWidth) + '\n';
  }
  const addressStr = formatAddress(data.restaurantAddress);
  if (addressStr) {
    receipt += centerText(addressStr, charWidth) + '\n';
  }

  receipt += '\n';
  receipt += doubleDivider + '\n';
  
  // Order number (centered, prominent)
  receipt += centerText(`*** ORDER #${data.orderNumber} ***`, charWidth) + '\n';
  
  receipt += doubleDivider + '\n';
  
  // Customer info
  if (data.customerName) {
    receipt += `Customer: ${data.customerName}\n`;
  }
  if (data.customerPhone) {
    receipt += `Phone: ${data.customerPhone}\n`;
  }
  if (data.orderType) {
    receipt += `Type: ${data.orderType.toUpperCase()}\n`;
  }
  if (data.pickupTime) {
    const pickupDate = new Date(data.pickupTime);
    receipt += `Pickup: ${pickupDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}\n`;
  }
  
  receipt += divider + '\n';
  receipt += '\n';
  
  // Items header
  receipt += padRight('ITEM', charWidth - 10) + padLeft('TOTAL', 10) + '\n';
  receipt += divider + '\n';
  
  // Items
  for (const item of data.items) {
    const qty = item.quantity || 1;
    const itemTotal = item.price * qty;
    const itemLine = `${qty}x ${item.name}`;
    const priceLine = formatMoney(itemTotal);
    
    // If item name is too long, wrap it
    if (itemLine.length > charWidth - 10) {
      receipt += itemLine.substring(0, charWidth - 10) + '\n';
      receipt += padRight('', charWidth - 10) + padLeft(priceLine, 10) + '\n';
    } else {
      receipt += padRight(itemLine, charWidth - 10) + padLeft(priceLine, 10) + '\n';
    }
    
    // Modifiers
    if (item.modifiers && item.modifiers.length > 0) {
      for (const mod of item.modifiers) {
        receipt += `  - ${mod}\n`;
      }
    }
  }
  
  receipt += '\n';
  receipt += divider + '\n';
  
  // Totals
  if (data.subtotal !== undefined) {
    receipt += padRight('Subtotal:', charWidth - 10) + padLeft(formatMoney(data.subtotal), 10) + '\n';
  }
  if (data.tax !== undefined) {
    receipt += padRight('Tax:', charWidth - 10) + padLeft(formatMoney(data.tax), 10) + '\n';
  }
  
  receipt += doubleDivider + '\n';
  receipt += padRight('TOTAL:', charWidth - 10) + padLeft(formatMoney(data.total), 10) + '\n';
  receipt += doubleDivider + '\n';
  
  // Special instructions
  if (data.specialInstructions) {
    receipt += '\n';
    receipt += 'SPECIAL INSTRUCTIONS:\n';
    receipt += data.specialInstructions + '\n';
    receipt += divider + '\n';
  }
  
  // Footer (centered)
  receipt += '\n';

  // Timestamp
  const now = data.createdAt ? new Date(data.createdAt) : new Date();
  receipt += centerText(now.toLocaleString(), charWidth) + '\n';

  receipt += '\n';
  receipt += centerText(data.footerText || 'Thank you for your order!', charWidth) + '\n';
  receipt += '\n\n\n';  // Extra lines before cut

  return receipt;
}

// Keep the old function name as an alias for backward compatibility
export const generateEscPosReceipt = generatePlainTextReceipt;

// Track if we're currently printing to prevent duplicates
let isPrintingViaRawBT = false;
let lastPrintTime = 0;

/**
 * Generate RawBT URL with plain text
 * Uses URL encoding for the text content
 */
export function generateRawBTUrl(plainText: string): string {
  // URL encode the plain text receipt
  const encodedText = encodeURIComponent(plainText);
  return `rawbt:${encodedText}`;
}

/**
 * Try to print via RawBT app using plain text
 * Returns true if RawBT was triggered, false if not available
 */
export function printViaRawBT(receiptText: string): boolean {
  // Prevent duplicate prints within 2 seconds
  const now = Date.now();
  if (isPrintingViaRawBT || (now - lastPrintTime < 2000)) {
    console.log('RawBT: Ignoring duplicate print request');
    return true; // Return true to prevent error messages
  }
  
  isPrintingViaRawBT = true;
  lastPrintTime = now;
  
  try {
    // Generate URL with plain text (URL encoded)
    const url = generateRawBTUrl(receiptText);
    
    // Open via window.location - this triggers the RawBT app
    window.location.href = url;
    
    // Reset flag after delay
    setTimeout(() => {
      isPrintingViaRawBT = false;
    }, 2000);
    
    return true;
  } catch (e) {
    console.error('RawBT print failed:', e);
    isPrintingViaRawBT = false;
    return false;
  }
}
