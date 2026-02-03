-- Migration: Add position column to time_entries
-- Date: 2026-02-02

DO $$
BEGIN
    ALTER TABLE time_entries ADD COLUMN position TEXT;
EXCEPTION
    WHEN duplicate_column THEN NULL;
END $$;
