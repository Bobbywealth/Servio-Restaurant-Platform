-- Migration: Add 86 Check System
-- Creates tables and columns for automated 86 (unavailable item) verification

-- Table to log 86 check calls
CREATE TABLE IF NOT EXISTS eighty_six_checks (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL,
  call_id TEXT,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  items_checked TEXT, -- JSON array of items that were checked
  items_confirmed TEXT, -- JSON array of staff confirmations
  items_updated TEXT, -- JSON array of items that changed status
  staff_name TEXT,
  duration_seconds INTEGER,
  notes TEXT,
  status TEXT CHECK (status IN ('in-progress', 'completed', 'failed', 'partial')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_eighty_six_checks_restaurant ON eighty_six_checks(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_eighty_six_checks_started_at ON eighty_six_checks(started_at);

-- Add schedule settings to restaurants table
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS eighty_six_check_schedule TEXT DEFAULT '{"times": ["09:00", "14:00"], "enabled": false}';
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS eighty_six_check_phone TEXT;

-- Log the migration
INSERT INTO migrations (id, name, applied_at)
VALUES (45, '045_add_86_check_system.sql', CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;
