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
};

export type ReceiptOrder = {
  id: string;
  external_id?: string | null;
  channel?: string | null;
  status?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
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
  const channel = (order.channel || 'POS').toString();
  const orderType = (order.order_type || '').toString();
  const pickupTime = (order.pickup_time || '').toString();
  const instructions = (order.special_instructions || '').toString();

  const orderNumber =
    (order.external_id && order.external_id.trim()) ? order.external_id.trim() : order.id.slice(-6).toUpperCase();

  const items = Array.isArray(order.items) ? order.items : [];
  const totals = calculateOrderTotals(order);

  const itemsHtml = items.length
    ? items
        .map((it) => {
          const qty = typeof it.quantity === 'number' && it.quantity > 0 ? it.quantity : 1;
          const name = escapeHtml((it.name || 'Item').toString());
          const unit = typeof it.unit_price === 'number' ? it.unit_price : typeof it.price === 'number' ? it.price : 0;
          const lineTotal = unit * qty;
          const modifiers = (() => {
            const raw = (it as any)?.modifiers;
            if (!raw) return '';
            const list = Array.isArray(raw)
              ? raw
              : typeof raw === 'string'
                ? raw.split(',').map((v) => v.trim()).filter(Boolean)
                : [];
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

      <div class="receipt-row receipt-row-strong">
        <div>ORDER</div>
        <div>#${escapeHtml(orderNumber.toUpperCase())}</div>
      </div>
      ${created ? `<div class="receipt-row"><div>TIME</div><div>${escapeHtml(created)}</div></div>` : ''}
      <div class="receipt-row"><div>CHANNEL</div><div>${escapeHtml(channel.toUpperCase())}</div></div>
      ${orderType ? `<div class="receipt-row"><div>TYPE</div><div>${escapeHtml(orderType.toUpperCase())}</div></div>` : ''}
      ${pickupTime ? `<div class="receipt-row"><div>PICKUP</div><div>${escapeHtml(pickupTime)}</div></div>` : ''}

      <div class="receipt-divider"></div>

      <div class="receipt-row"><div>CUSTOMER</div><div>${escapeHtml(customerName.toUpperCase())}</div></div>
      ${customerPhone ? `<div class="receipt-row"><div>PHONE</div><div>${escapeHtml(customerPhone)}</div></div>` : ''}

      <div class="receipt-divider"></div>

      <div class="receipt-items">
        ${itemsHtml}
      </div>

      <div class="receipt-divider"></div>

      <div class="receipt-totals">
        <div class="receipt-row"><div>SUBTOTAL</div><div>$${totals.subtotal.toFixed(2)}</div></div>
        <div class="receipt-row"><div>TAX</div><div>$${totals.tax.toFixed(2)}</div></div>
        <div class="receipt-row receipt-row-strong"><div>TOTAL</div><div>$${totals.total.toFixed(2)}</div></div>
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
  .receipt {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
    color: #000; background: #fff; padding: 10px 10px 14px;
  }
  .receipt.paper-80mm { width: 80mm; }
  .receipt.paper-58mm { width: 58mm; }
  .receipt-header { text-align: center; }
  .receipt-logo { display: block; width: 64px; height: 64px; margin: 0 auto 6px; object-fit: contain; }
  .receipt-title { font-size: 18px; font-weight: 900; letter-spacing: 0.04em; text-transform: uppercase; }
  .receipt-subtitle { font-size: 11px; font-weight: 700; margin-top: 2px; }
  .receipt-divider { border-top: 2px dashed #000; margin: 10px 0; }
  .receipt-row { display: flex; justify-content: space-between; gap: 10px; font-size: 12px; font-weight: 700; text-transform: uppercase; margin: 4px 0; }
  .receipt-row-strong { font-size: 14px; font-weight: 900; }
  .receipt-items { margin-top: 6px; }
  .receipt-item { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; margin: 8px 0; }
  .receipt-item-left { display: flex; gap: 8px; min-width: 0; flex: 1; }
  .receipt-item-qty { width: 34px; font-size: 14px; font-weight: 900; }
  .receipt-item-name { font-size: 13px; font-weight: 800; word-break: break-word; min-width: 0; text-transform: uppercase; }
  .receipt-item-right { flex: none; }
  .receipt-item-total { font-size: 13px; font-weight: 900; }
  .receipt-item-modifiers { font-size: 11px; font-weight: 700; margin-top: 2px; padding-left: 0; color: #333; }
  .receipt-muted { font-size: 12px; font-weight: 700; text-transform: uppercase; }
  .receipt-totals .receipt-row { margin: 3px 0; }
  .receipt-notes-title { font-size: 12px; font-weight: 900; text-transform: uppercase; margin-bottom: 4px; }
  .receipt-notes-body { font-size: 12px; font-weight: 800; white-space: pre-wrap; word-break: break-word; }
  .receipt-footer { text-align: center; font-size: 12px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.08em; }
  .receipt-custom-header { text-align: center; font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; padding: 4px 0; }
  /* Font size variants */
  .receipt.font-small { font-size: 10px; }
  .receipt.font-small .receipt-title { font-size: 16px; }
  .receipt.font-small .receipt-logo { width: 48px; height: 48px; }
  .receipt.font-small .receipt-row-strong, .receipt.font-small .receipt-item-qty { font-size: 12px; }
  .receipt.font-medium { font-size: 12px; }
  .receipt.font-medium .receipt-title { font-size: 18px; }
  .receipt.font-medium .receipt-logo { width: 64px; height: 64px; }
  .receipt.font-medium .receipt-row-strong, .receipt.font-medium .receipt-item-qty { font-size: 14px; }
  .receipt.font-large { font-size: 14px; }
  .receipt.font-large .receipt-title { font-size: 22px; }
  .receipt.font-large .receipt-logo { width: 80px; height: 80px; }
  .receipt.font-large .receipt-row-strong, .receipt.font-large .receipt-item-qty { font-size: 16px; }
  .receipt.font-xlarge { font-size: 16px; }
  .receipt.font-xlarge .receipt-title { font-size: 28px; }
  .receipt.font-xlarge .receipt-logo { width: 96px; height: 96px; }
  .receipt.font-xlarge .receipt-row-strong, .receipt.font-xlarge .receipt-item-qty { font-size: 18px; }
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

