-- Migration 011: Voice Ordering + Phone Orders
-- Date: 2026-01-20
-- Adds store hours, voice ordering fields, and call logs

-- ============================================================================
-- RESTAURANT STORE STATUS FIELDS
-- ============================================================================
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS operating_hours TEXT DEFAULT '{}';
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/New_York';
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS closed_message TEXT DEFAULT 'We’re temporarily closed right now...';

-- ============================================================================
-- MENU ITEM TAGS
-- ============================================================================
ALTER TABLE menu_items ADD COLUMN tags TEXT DEFAULT '[]';

-- ============================================================================
-- ORDER ENHANCEMENTS FOR VOICE
-- ============================================================================
ALTER TABLE orders ADD COLUMN status TEXT DEFAULT 'pending';
ALTER TABLE orders ADD COLUMN customer_name TEXT;
ALTER TABLE orders ADD COLUMN customer_phone TEXT;
ALTER TABLE orders ADD COLUMN last_initial TEXT;
ALTER TABLE orders ADD COLUMN order_type TEXT;
ALTER TABLE orders ADD COLUMN pickup_time TEXT;
ALTER TABLE orders ADD COLUMN subtotal DOUBLE PRECISION DEFAULT 0;
ALTER TABLE orders ADD COLUMN tax DOUBLE PRECISION DEFAULT 0;
ALTER TABLE orders ADD COLUMN fees DOUBLE PRECISION DEFAULT 0;
ALTER TABLE orders ADD COLUMN total DOUBLE PRECISION DEFAULT 0;
ALTER TABLE orders ADD COLUMN prep_time_minutes INTEGER;
ALTER TABLE orders ADD COLUMN accepted_at TIMESTAMP;
ALTER TABLE orders ADD COLUMN accepted_by_user_id TEXT REFERENCES users(id);
ALTER TABLE orders ADD COLUMN source TEXT;
ALTER TABLE orders ADD COLUMN call_id TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_source ON orders(source);
CREATE INDEX IF NOT EXISTS idx_orders_call_id ON orders(call_id);

-- ============================================================================
-- ORDER ITEMS ENHANCEMENTS
-- ============================================================================
ALTER TABLE order_items ADD COLUMN item_id TEXT;
ALTER TABLE order_items ADD COLUMN item_name_snapshot TEXT;
ALTER TABLE order_items ADD COLUMN qty INTEGER;
ALTER TABLE order_items ADD COLUMN unit_price_snapshot DOUBLE PRECISION;
ALTER TABLE order_items ADD COLUMN modifiers_json TEXT DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

-- ============================================================================
-- ORDER EVENTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS order_events (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  event TEXT NOT NULL,
  meta_json TEXT DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_order_events_order ON order_events(order_id);
CREATE INDEX IF NOT EXISTS idx_order_events_created ON order_events(created_at);

-- ============================================================================
-- CALL LOGS
-- ============================================================================
CREATE TABLE IF NOT EXISTS call_logs (
  id TEXT PRIMARY KEY,
  call_id TEXT NOT NULL,
  from_phone TEXT,
  transcript TEXT,
  summary_json TEXT DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_call_logs_call_id ON call_logs(call_id);
