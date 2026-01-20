-- Receipt-Inventory Linking Migration
-- Version: 1.3.0
-- Date: 2026-01-20

-- Refine receipt_items for manual matching and v1 workflow
-- We use item_name as raw_description
ALTER TABLE receipt_items ADD COLUMN IF NOT EXISTS unit_cost DECIMAL(10,4);
ALTER TABLE receipt_items ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Ensure inventory_transactions has the correct types
-- Already has transaction_type: receive, adjust, waste, etc.

-- Add index for matching lookups
CREATE INDEX IF NOT EXISTS idx_receipt_items_receipt_id ON receipt_items (receipt_id);
CREATE INDEX IF NOT EXISTS idx_receipt_items_matched_item ON receipt_items (inventory_item_id);
