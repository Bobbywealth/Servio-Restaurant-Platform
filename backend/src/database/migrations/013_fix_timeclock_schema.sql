-- Fix Timeclock Schema Issues
-- Version: 1.1.1
-- Date: 2026-01-20
-- Fixes missing tables and columns for timeclock functionality

-- Add missing position column to time_entries
ALTER TABLE time_entries ADD COLUMN position TEXT;

-- Create time_entry_breaks table for break tracking
CREATE TABLE IF NOT EXISTS time_entry_breaks (
    id TEXT PRIMARY KEY,
    time_entry_id TEXT NOT NULL REFERENCES time_entries(id) ON DELETE CASCADE,
    break_start TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    break_end TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_time_entry_breaks_time_entry ON time_entry_breaks(time_entry_id);
CREATE INDEX IF NOT EXISTS idx_time_entry_breaks_active ON time_entry_breaks(break_end) WHERE break_end IS NULL;