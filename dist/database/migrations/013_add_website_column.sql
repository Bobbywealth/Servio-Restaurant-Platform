-- Migration 013: Add website column to restaurants table
-- Date: 2026-01-21
-- Purpose: Fix restaurant profile endpoint error - missing website column

-- Add website column to restaurants table
ALTER TABLE restaurants ADD COLUMN website TEXT;

-- Create index for better performance on website lookups
CREATE INDEX IF NOT EXISTS idx_restaurants_website ON restaurants(website);