/**
 * ESC/POS command generator for thermal receipt printers
 * Used with RawBT app for direct Bluetooth printing without dialogs
 */

// ESC/POS Commands
const ESC = '\x1B';
const GS = '\x1D';
const LF = '\x0A';

// Initialize printer
const INIT = ESC + '@';

// Text alignment
const ALIGN_LEFT = ESC + 'a' + '\x00';
const ALIGN_CENTER = ESC + 'a' + '\x01';
const ALIGN_RIGHT = ESC + 'a' + '\x02';

// Text style
const BOLD_ON = ESC + 'E' + '\x01';
const BOLD_OFF = ESC + 'E' + '\x00';
const DOUBLE_HEIGHT_ON = GS + '!' + '\x11';
const DOUBLE_HEIGHT_OFF = GS + '!' + '\x00';
const NORMAL_SIZE = GS + '!' + '\x00';
const LARGE_SIZE = GS + '!' + '\x11';

// Paper cut (partial cut)
const CUT_PAPER = GS + 'V' + '\x01';

// Line feed
const FEED_LINES = (n: number) => ESC + 'd' + String.fromCharCode(n);

export interface ReceiptItem {
  name: string;
  quantity: number;
  price: number;
  modifiers?: string[];
}

export interface ReceiptData {
  restaurantName?: string;
  restaurantPhone?: string;
  restaurantAddress?: string;
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

export function generateEscPosReceipt(data: ReceiptData, paperWidth: '80mm' | '58mm' = '80mm'): string {
  const charWidth = paperWidth === '80mm' ? 48 : 32;
  const divider = line('-', charWidth);
  
  let receipt = '';
  
  // Initialize
  receipt += INIT;
  
  // Header - Restaurant name (centered, large)
  receipt += ALIGN_CENTER;
  receipt += LARGE_SIZE;
  receipt += BOLD_ON;
  receipt += (data.restaurantName || 'SERVIO RESTAURANT') + LF;
  receipt += BOLD_OFF;
  receipt += NORMAL_SIZE;
  
  // Restaurant info
  if (data.restaurantPhone) {
    receipt += data.restaurantPhone + LF;
  }
  if (data.restaurantAddress) {
    receipt += data.restaurantAddress + LF;
  }
  
  receipt += LF;
  receipt += divider + LF;
  
  // Order info (centered, bold)
  receipt += BOLD_ON;
  receipt += LARGE_SIZE;
  receipt += `ORDER #${data.orderNumber}` + LF;
  receipt += NORMAL_SIZE;
  receipt += BOLD_OFF;
  
  receipt += divider + LF;
  receipt += ALIGN_LEFT;
  
  // Customer info
  if (data.customerName) {
    receipt += `Customer: ${data.customerName}` + LF;
  }
  if (data.customerPhone) {
    receipt += `Phone: ${data.customerPhone}` + LF;
  }
  if (data.orderType) {
    receipt += `Type: ${data.orderType.toUpperCase()}` + LF;
  }
  if (data.pickupTime) {
    const pickupDate = new Date(data.pickupTime);
    receipt += `Pickup: ${pickupDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` + LF;
  }
  
  receipt += divider + LF;
  receipt += LF;
  
  // Items header
  receipt += BOLD_ON;
  receipt += padRight('ITEM', charWidth - 10) + padLeft('TOTAL', 10) + LF;
  receipt += BOLD_OFF;
  receipt += divider + LF;
  
  // Items
  for (const item of data.items) {
    const qty = item.quantity || 1;
    const itemTotal = item.price * qty;
    const itemLine = `${qty}x ${item.name}`;
    const priceLine = formatMoney(itemTotal);
    
    // If item name is too long, wrap it
    if (itemLine.length > charWidth - 10) {
      receipt += itemLine.substring(0, charWidth - 10) + LF;
      receipt += padRight('', charWidth - 10) + padLeft(priceLine, 10) + LF;
    } else {
      receipt += padRight(itemLine, charWidth - 10) + padLeft(priceLine, 10) + LF;
    }
    
    // Modifiers
    if (item.modifiers && item.modifiers.length > 0) {
      for (const mod of item.modifiers) {
        receipt += `  - ${mod}` + LF;
      }
    }
  }
  
  receipt += LF;
  receipt += divider + LF;
  
  // Totals
  if (data.subtotal !== undefined) {
    receipt += padRight('Subtotal:', charWidth - 10) + padLeft(formatMoney(data.subtotal), 10) + LF;
  }
  if (data.tax !== undefined) {
    receipt += padRight('Tax:', charWidth - 10) + padLeft(formatMoney(data.tax), 10) + LF;
  }
  
  receipt += BOLD_ON;
  receipt += LARGE_SIZE;
  receipt += padRight('TOTAL:', charWidth - 10) + padLeft(formatMoney(data.total), 10) + LF;
  receipt += NORMAL_SIZE;
  receipt += BOLD_OFF;
  
  receipt += divider + LF;
  
  // Special instructions
  if (data.specialInstructions) {
    receipt += LF;
    receipt += BOLD_ON;
    receipt += 'SPECIAL INSTRUCTIONS:' + LF;
    receipt += BOLD_OFF;
    receipt += data.specialInstructions + LF;
    receipt += divider + LF;
  }
  
  // Footer
  receipt += LF;
  receipt += ALIGN_CENTER;
  
  // Timestamp
  const now = data.createdAt ? new Date(data.createdAt) : new Date();
  receipt += now.toLocaleString() + LF;
  
  receipt += LF;
  receipt += 'Thank you for your order!' + LF;
  receipt += LF;
  
  // Feed and cut
  receipt += FEED_LINES(4);
  receipt += CUT_PAPER;
  
  return receipt;
}

/**
 * Convert ESC/POS data to base64 for RawBT URL scheme
 */
export function escPosToBase64(escPosData: string): string {
  // Convert string to bytes
  const bytes = new Uint8Array(escPosData.length);
  for (let i = 0; i < escPosData.length; i++) {
    bytes[i] = escPosData.charCodeAt(i);
  }
  
  // Convert to base64
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Generate RawBT intent URL for printing
 * RawBT app must be installed on the Android device
 */
export function generateRawBTUrl(escPosData: string): string {
  const base64Data = escPosToBase64(escPosData);
  // RawBT intent URL format
  return `intent://base64,${base64Data}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;`;
}

/**
 * Alternative RawBT URL format (simpler, works on some devices)
 */
export function generateRawBTSimpleUrl(escPosData: string): string {
  const base64Data = escPosToBase64(escPosData);
  return `rawbt:base64,${base64Data}`;
}

/**
 * Try to print via RawBT app
 * Returns true if RawBT was triggered, false if not available
 */
export function printViaRawBT(escPosData: string): boolean {
  try {
    // Try intent URL first (more reliable on Android)
    const intentUrl = generateRawBTUrl(escPosData);
    
    // Create a hidden iframe to trigger the intent
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = intentUrl;
    document.body.appendChild(iframe);
    
    // Clean up after a short delay
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 1000);
    
    return true;
  } catch (e) {
    console.error('RawBT print failed:', e);
    return false;
  }
}

/**
 * Open RawBT directly with data (alternative method)
 */
export function openRawBT(escPosData: string): void {
  const url = generateRawBTSimpleUrl(escPosData);
  window.location.href = url;
}
