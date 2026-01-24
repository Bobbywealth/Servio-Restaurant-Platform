-- Migration 020: Ensure tasks.completed column exists (PostgreSQL)
-- Date: 2026-01-24
-- Purpose: Fix missing 'completed' column that causes database errors
--
-- Background: Migration 009 tried to add both 'completed' and 'completed_at' columns,
-- but since 'completed_at' already existed from migration 001, the PostgreSQL version
-- failed in transaction, rolling back the 'completed' column addition.
--
-- This migration safely adds ONLY the 'completed' column for PostgreSQL.
-- For SQLite, migration 009 should have already added it successfully.

DO $$
BEGIN
    -- Add 'completed' column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tasks' AND column_name = 'completed'
    ) THEN
        ALTER TABLE tasks ADD COLUMN completed TEXT;

        -- Backfill with completed_at values for existing completed tasks
        UPDATE tasks
        SET completed = completed_at
        WHERE status = 'completed'
          AND completed IS NULL
          AND completed_at IS NOT NULL;
    END IF;
END $$;
