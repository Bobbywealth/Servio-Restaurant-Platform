-- Receipt-Inventory Linking Migration
-- Version: 1.3.0
-- Date: 2026-01-20

-- Refine receipt_line_items for manual matching and v1 workflow
-- We use description as raw_description (unit_cost already exists)
ALTER TABLE receipt_line_items ADD COLUMN metadata TEXT DEFAULT '{}';

-- Ensure inventory_transactions has the correct types
-- Already has transaction_type: receive, adjust, waste, etc.

-- Add index for matching lookups
CREATE INDEX IF NOT EXISTS idx_receipt_line_items_receipt_id ON receipt_line_items (receipt_id);
CREATE INDEX IF NOT EXISTS idx_receipt_line_items_matched_item ON receipt_line_items (inventory_item_id);
