import { resolveMediaUrl } from '../lib/utils';

export type ReceiptPaperWidth = '58mm' | '80mm';

export type ReceiptRestaurant = {
  name?: string | null;
  phone?: string | null;
  address?: any;
  logo_url?: string | null;
};

export type ReceiptOrderItem = {
  name?: string | null;
  quantity?: number | null;
  unit_price?: number | null;
  price?: number | null;
  modifiers?: any;
  selectedModifiers?: any;
  modifyItems?: any;
  modifications?: any;
  selections?: any;
};

export type ReceiptOrder = {
  id: string;
  external_id?: string | null;
  channel?: string | null;
  status?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
  order_type?: string | null;
  pickup_time?: string | null;
  created_at?: string | null;
  subtotal?: number | null;
  total_amount?: number | null;
  items?: ReceiptOrderItem[] | null;
  special_instructions?: string | null;
};

function escapeHtml(input: string) {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function digitsOnly(v: string) {
  return v.replace(/[^\d]/g, '');
}

export function formatReceiptPhone(phone: string | null | undefined) {
  const raw = (phone || '').trim();
  if (!raw) return '';
  const digits = digitsOnly(raw);
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return raw;
}

export function formatReceiptDate(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return d.toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return d.toISOString();
  }
}

export function calculateOrderTotals(order: ReceiptOrder) {
  const items = Array.isArray(order.items) ? order.items : [];
  const computedSubtotal = items.reduce((sum, it) => {
    const qty = typeof it.quantity === 'number' ? it.quantity : 1;
    const unit = typeof it.unit_price === 'number' ? it.unit_price : typeof it.price === 'number' ? it.price : 0;
    return sum + qty * unit;
  }, 0);

  const subtotal =
    typeof order.subtotal === 'number' && Number.isFinite(order.subtotal) ? order.subtotal : computedSubtotal;
  const total = typeof order.total_amount === 'number' && Number.isFinite(order.total_amount) ? order.total_amount : subtotal;
  const tax = Math.max(0, total - subtotal);

  return { subtotal, tax, total };
}

function extractModifierLabel(modifier: any): string {
  if (!modifier) return '';
  if (typeof modifier === 'string') return modifier.trim();
  if (typeof modifier !== 'object') return String(modifier).trim();

  const quantity = typeof modifier.quantity === 'number' && modifier.quantity > 1
    ? `${modifier.quantity}x `
    : '';

  const mainLabel = (
    modifier.optionName ||
    modifier.option_name ||
    modifier.name ||
    modifier.value ||
    modifier.label ||
    modifier.choiceName ||
    modifier.choice_name ||
    ''
  ).toString().trim();

  const groupLabel = (
    modifier.groupName ||
    modifier.group_name ||
    modifier.category ||
    ''
  ).toString().trim();

  if (mainLabel && groupLabel) return `${quantity}${groupLabel}: ${mainLabel}`;
  if (mainLabel) return `${quantity}${mainLabel}`;
  if (groupLabel) return `${quantity}${groupLabel}`;
  return '';
}

export function getReceiptItemModifiers(item: ReceiptOrderItem | any): string[] {
  const candidates = [
    item?.modifiers,
    item?.selectedModifiers,
    item?.modifyItems,
    item?.modify_items,
    item?.modifications,
    item?.selections
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;

    if (typeof candidate === 'string') {
      const parsed = candidate
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);
      if (parsed.length > 0) return parsed;
      continue;
    }

    if (Array.isArray(candidate)) {
      const parsed = candidate
        .map((entry) => extractModifierLabel(entry))
        .filter(Boolean);
      if (parsed.length > 0) return parsed;
      continue;
    }
  }

  return [];
}

export function generateReceiptHtml(args: {
  restaurant: ReceiptRestaurant | null;
  order: ReceiptOrder;
  paperWidth: ReceiptPaperWidth;
  headerText?: string;
  footerText?: string;
  fontSize?: string;
}) {
  const { restaurant, order, paperWidth, headerText, footerText, fontSize = 'medium' } = args;
  const rName = (restaurant?.name || 'SERVIO').toString();
  const rPhone = formatReceiptPhone(restaurant?.phone || '');
  const logoUrl = resolveMediaUrl(restaurant?.logo_url || '');
  const created = formatReceiptDate(order.created_at || '');
  const customerName = (order.customer_name || 'Guest').toString();
  const customerPhone = formatReceiptPhone(order.customer_phone || '');
  const customerEmail = (order.customer_email || '').toString();
  const channel = (order.channel || 'POS').toString().toLowerCase();
  const orderType = (order.order_type || 'pickup').toString().toLowerCase();
  const pickupTime = (order.pickup_time || '').toString();
  const instructions = (order.special_instructions || '').toString();

  const orderNumber =
    (order.external_id && order.external_id.trim()) ? order.external_id.trim() : order.id.slice(-6).toUpperCase();

  const items = Array.isArray(order.items) ? order.items : [];
  const totals = calculateOrderTotals(order);
  const totalItemCount = items.reduce((sum, it) => sum + (it.quantity || 1), 0);

  // Channel icon mapping
  const channelIcons: Record<string, string> = {
    doordash: '🚗',
    ubereats: '🛵',
    grubhub: '🍔',
    toast: '🍞',
    pos: '🏪',
    online: '💻',
    web: '💻',
    phone: '📞',
    call: '📞',
    vapi: '🎙️',
    voice: '🎙️',
  };
  const channelIcon = channelIcons[channel] || '📋';
  const channelDisplay = channel !== 'pos' ? `${channelIcon} ${channel.toUpperCase()}` : 'POS';

  // Order type badge styling
  // Order type badge (used in order info section)

  const itemsHtml = items.length
    ? items
        .map((it) => {
          const qty = typeof it.quantity === 'number' && it.quantity > 0 ? it.quantity : 1;
          const name = escapeHtml((it.name || 'Item').toString());
          const unit = typeof it.unit_price === 'number' ? it.unit_price : typeof it.price === 'number' ? it.price : 0;
          const lineTotal = unit * qty;
          const modifiers = (() => {
            const list = getReceiptItemModifiers(it);
            if (!list.length) return '';
            return `<div class="receipt-item-modifiers">${list.map((m) => `• ${escapeHtml(String(m))}`).join('<br/>')}</div>`;
          })();
          return `
            <div class="receipt-item">
              <div class="receipt-item-left">
                <div class="receipt-item-qty">${qty}x</div>
                <div class="receipt-item-name">${name}</div>
                ${modifiers}
              </div>
              <div class="receipt-item-right">
                <div class="receipt-item-total">$${lineTotal.toFixed(2)}</div>
              </div>
            </div>
          `;
        })
        .join('')
    : `<div class="receipt-muted">No items</div>`;

  const addressLine = (() => {
    const a = restaurant?.address;
    if (!a) return '';
    if (typeof a === 'string') return a;
    const parts = [a.line1, a.line2, a.city, a.state, a.zip].filter(Boolean).map(String);
    return parts.join(', ');
  })();

  return `
    <div class="receipt paper-${paperWidth} font-${fontSize}">
      ${headerText ? `<div class="receipt-custom-header">${escapeHtml(headerText)}</div><div class="receipt-divider"></div>` : ''}
      <div class="receipt-header">
        ${logoUrl ? `<img class="receipt-logo" src="${logoUrl}" alt="Restaurant logo" />` : ''}
        <div class="receipt-title">${escapeHtml(rName)}</div>
        ${addressLine ? `<div class="receipt-subtitle">${escapeHtml(addressLine)}</div>` : ''}
        ${rPhone ? `<div class="receipt-subtitle">${escapeHtml(rPhone)}</div>` : ''}
      </div>

      <div class="receipt-divider"></div>

      <div class="receipt-order-header">
        <div class="receipt-row receipt-row-strong">
          <div>ORDER #</div>
          <div>${escapeHtml(orderNumber.toUpperCase())}</div>
        </div>
        ${created ? `<div class="receipt-row"><div>DATE/TIME</div><div>${escapeHtml(created)}</div></div>` : ''}
        ${pickupTime ? `<div class="receipt-row"><div>PICKUP BY</div><div>${escapeHtml(pickupTime)}</div></div>` : ''}
      </div>

      <div class="receipt-divider"></div>

      <div class="receipt-customer">
        <div class="receipt-row receipt-row-strong"><div>NAME</div><div>${escapeHtml(customerName.toUpperCase())}</div></div>
        ${customerPhone ? `<div class="receipt-row"><div>PHONE</div><div>${escapeHtml(customerPhone)}</div></div>` : ''}
      </div>

      <div class="receipt-divider"></div>

      <div class="receipt-items-header">
        <div>ORDER ITEMS</div>
        <div>${totalItemCount} ${totalItemCount === 1 ? 'item' : 'items'}</div>
      </div>
      <div class="receipt-items">
        ${itemsHtml}
      </div>

      <div class="receipt-divider"></div>

      <div class="receipt-totals">
        <div class="receipt-row"><div>SUBTOTAL</div><div>$${totals.subtotal.toFixed(2)}</div></div>
        <div class="receipt-row"><div>TAX</div><div>$${totals.tax.toFixed(2)}</div></div>
        <div class="receipt-row receipt-row-strong receipt-total"><div>TOTAL</div><div>$${totals.total.toFixed(2)}</div></div>
      </div>

      ${instructions ? `
        <div class="receipt-divider"></div>
        <div class="receipt-notes">
          <div class="receipt-notes-title">NOTES</div>
          <div class="receipt-notes-body">${escapeHtml(instructions)}</div>
        </div>
      ` : ''}

      <div class="receipt-divider"></div>
      <div class="receipt-footer">${footerText ? escapeHtml(footerText) : 'THANK YOU'}</div>
    </div>
  `;
}

/**
 * Embedded receipt CSS for standalone HTML documents (e.g. RawBT HTML printing).
 * This is a subset of thermal-print.css needed for rendering the receipt outside the app.
 */
const RECEIPT_CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #fff; }

  /* Base layout */
  .receipt {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
    color: #000; background: #fff; padding: 10px 10px 14px;
  }
  .receipt.paper-80mm { width: 80mm; }
  .receipt.paper-58mm { width: 58mm; }
  .receipt-header { text-align: center; }
  .receipt-logo { display: block; margin: 0 auto 6px; object-fit: contain; }
  .receipt-title { font-weight: 900; letter-spacing: 0.04em; text-transform: uppercase; }
  .receipt-subtitle { font-weight: 700; margin-top: 2px; }
  .receipt-divider { border-top: 2px dashed #000; margin: 10px 0; }
  .receipt-row { display: flex; justify-content: space-between; gap: 10px; font-weight: 700; text-transform: uppercase; margin: 4px 0; }
  .receipt-row-strong { font-weight: 900; }
  .receipt-items { margin-top: 6px; }
  .receipt-item { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; margin: 8px 0; }
  .receipt-item-left { display: flex; gap: 8px; min-width: 0; flex: 1; }
  .receipt-item-qty { width: 34px; font-weight: 900; }
  .receipt-item-name { font-weight: 800; word-break: break-word; min-width: 0; text-transform: uppercase; }
  .receipt-item-right { flex: none; }
  .receipt-item-total { font-weight: 900; }
  .receipt-item-modifiers { font-weight: 700; margin-top: 2px; padding-left: 0; color: #333; }
  .receipt-muted { font-weight: 700; text-transform: uppercase; }
  .receipt-totals .receipt-row { margin: 3px 0; }
  .receipt-notes-title { font-weight: 900; text-transform: uppercase; margin-bottom: 4px; }
  .receipt-notes-body { font-weight: 800; white-space: pre-wrap; word-break: break-word; }
  .receipt-footer { text-align: center; font-weight: 900; text-transform: uppercase; letter-spacing: 0.08em; }
  .receipt-custom-header { text-align: center; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; padding: 4px 0; }

  /* Font size variants - standardized for readability */
  .receipt.font-small {
    --receipt-font-base: 12px; --receipt-font-lg: 14px; --receipt-font-2xl: 18px; --receipt-font-xl: 16px; --receipt-logo-size: 56px;
  }
  .receipt.font-medium {
    --receipt-font-base: 14px; --receipt-font-lg: 16px; --receipt-font-2xl: 20px; --receipt-font-xl: 18px; --receipt-logo-size: 72px;
  }
  .receipt.font-large {
    --receipt-font-base: 16px; --receipt-font-lg: 18px; --receipt-font-2xl: 24px; --receipt-font-xl: 20px; --receipt-logo-size: 88px;
  }
  .receipt.font-xlarge {
    --receipt-font-base: 18px; --receipt-font-lg: 22px; --receipt-font-2xl: 28px; --receipt-font-xl: 24px; --receipt-logo-size: 104px;
  }

  /* Apply font size variables to all elements */
  .receipt { font-size: var(--receipt-font-base, 14px); }
  .receipt-logo { width: var(--receipt-logo-size, 72px); height: var(--receipt-logo-size, 72px); }
  .receipt-title { font-size: var(--receipt-font-2xl, 20px); }
  .receipt-subtitle { font-size: var(--receipt-font-base, 14px); }
  .receipt-order-header { font-size: var(--receipt-font-xl, 18px); }
  .receipt-row { font-size: var(--receipt-font-base, 14px); }
  .receipt-row-strong { font-size: var(--receipt-font-xl, 18px); }
  .receipt-item-qty { font-size: var(--receipt-font-xl, 18px); }
  .receipt-item-name { font-size: var(--receipt-font-base, 14px); }
  .receipt-item-total { font-size: var(--receipt-font-lg, 16px); }
  .receipt-item-modifiers { font-size: var(--receipt-font-base, 14px); }
  .receipt-muted { font-size: var(--receipt-font-base, 14px); }
  .receipt-notes-title { font-size: var(--receipt-font-base, 14px); }
  .receipt-notes-body { font-size: var(--receipt-font-base, 14px); }
  .receipt-footer { font-size: var(--receipt-font-lg, 16px); }
  .receipt-custom-header { font-size: var(--receipt-font-lg, 16px); }
  .receipt-items-header { font-size: var(--receipt-font-lg, 16px); font-weight: 900; }
  .receipt-total { font-size: var(--receipt-font-2xl, 20px); }
  .receipt-customer { font-size: var(--receipt-font-base, 14px); }
`;

/**
 * Generate a fully standalone HTML document for the receipt.
 * Includes embedded CSS so the receipt renders correctly outside the app
 * (e.g. when sent to RawBT for thermal printing with logo support).
 */
export function generateStandaloneReceiptHtml(args: {
  restaurant: ReceiptRestaurant | null;
  order: ReceiptOrder;
  paperWidth: ReceiptPaperWidth;
  headerText?: string;
  footerText?: string;
  fontSize?: string;
}) {
  const receiptBody = generateReceiptHtml(args);
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${RECEIPT_CSS}</style></head>
<body>${receiptBody}</body>
</html>`;
}
