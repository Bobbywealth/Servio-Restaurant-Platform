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
}) {
  const { restaurant, order, paperWidth } = args;
  const rName = (restaurant?.name || 'SERVIO').toString();
  const rPhone = formatReceiptPhone(restaurant?.phone || '');
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
          return `
            <div class="receipt-item">
              <div class="receipt-item-left">
                <div class="receipt-item-qty">${qty}x</div>
                <div class="receipt-item-name">${name}</div>
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
    <div class="receipt paper-${paperWidth}">
      <div class="receipt-header">
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
      <div class="receipt-footer">THANK YOU</div>
    </div>
  `;
}

