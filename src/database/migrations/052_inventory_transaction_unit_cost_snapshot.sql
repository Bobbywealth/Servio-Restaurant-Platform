-- Migration: Add unit_cost_snapshot to inventory_transactions
-- Date: 2026-04-27
-- Purpose: Preserve the unit cost at transaction creation time for historical accuracy

ALTER TABLE inventory_transactions
ADD COLUMN unit_cost_snapshot DOUBLE PRECISION;

CREATE INDEX IF NOT EXISTS idx_inventory_transactions_unit_cost_snapshot
ON inventory_transactions(restaurant_id, created_at, unit_cost_snapshot);
