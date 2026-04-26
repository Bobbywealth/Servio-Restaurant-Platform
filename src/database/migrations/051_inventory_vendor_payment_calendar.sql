-- Migration: Add vendor payment calendar fields to inventory_items
-- Purpose: Track vendor name and payment date directly in inventory records

ALTER TABLE inventory_items ADD COLUMN vendor_name TEXT;
ALTER TABLE inventory_items ADD COLUMN vendor_payment_date DATE;

CREATE INDEX IF NOT EXISTS idx_inventory_items_vendor_payment_date
  ON inventory_items(restaurant_id, vendor_payment_date);
