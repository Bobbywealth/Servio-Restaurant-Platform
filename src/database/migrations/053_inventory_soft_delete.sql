-- Migration: Add soft-delete lifecycle fields to inventory items

ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_items_active
  ON inventory_items(restaurant_id, is_active, deleted_at);
