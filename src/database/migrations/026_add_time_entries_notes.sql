-- Migration: Add notes column to time_entries
-- Date: 2026-01-27

-- Add notes column to time_entries table for clock-out notes
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS notes TEXT;
