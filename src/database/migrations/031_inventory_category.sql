-- Migration: Add category column to inventory_items
-- Date: 2026-01-30
-- Purpose: Add category support for inventory items

-- ============================================================================
-- ADD CATEGORY COLUMN TO INVENTORY_ITEMS
-- ============================================================================

ALTER TABLE inventory_items ADD COLUMN category TEXT;
-- Add index for filtering by category
CREATE INDEX IF NOT EXISTS idx_inventory_items_category ON inventory_items(restaurant_id, category);
