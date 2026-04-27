-- Migration: Add procurement payment-state fields to inventory_items
-- Purpose: Track payable state and settlement metadata for inventory procurement

ALTER TABLE inventory_items ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'unpaid';
ALTER TABLE inventory_items ADD COLUMN paid_at TIMESTAMP;
ALTER TABLE inventory_items ADD COLUMN payment_reference TEXT;
ALTER TABLE inventory_items ADD COLUMN payment_method TEXT;

CREATE INDEX IF NOT EXISTS idx_inventory_items_payment_status
  ON inventory_items(restaurant_id, payment_status);

CREATE INDEX IF NOT EXISTS idx_inventory_items_vendor_payment_state
  ON inventory_items(restaurant_id, vendor_payment_date, payment_status);
