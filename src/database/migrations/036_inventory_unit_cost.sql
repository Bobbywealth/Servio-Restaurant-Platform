-- Migration: Add unit_cost column to inventory_items
-- Date: 2026-02-09
-- Purpose: Add unit cost tracking for inventory items to enable cost tracking and inventory valuation

-- ============================================================================
-- ADD UNIT_COST COLUMN TO INVENTORY_ITEMS
-- ============================================================================

ALTER TABLE inventory_items ADD COLUMN unit_cost DECIMAL(10, 2) DEFAULT 0.00;

-- Add index for ordering by unit cost
CREATE INDEX IF NOT EXISTS idx_inventory_items_unit_cost ON inventory_items(restaurant_id, unit_cost);
