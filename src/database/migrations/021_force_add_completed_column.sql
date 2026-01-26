-- Migration 021: Force Add Completed Column to Tasks (PostgreSQL)
-- Date: 2026-01-26
-- Purpose: Ensure the 'completed' column exists in tasks table
-- This migration uses exception handling to safely add the column

DO $$
BEGIN
    -- Try to add the 'completed' column
    -- If it already exists, PostgreSQL will raise an exception which we'll catch
    BEGIN
        ALTER TABLE tasks ADD COLUMN completed TEXT;
        RAISE NOTICE 'Added completed column to tasks table';
    EXCEPTION
        WHEN duplicate_column THEN
            RAISE NOTICE 'Column completed already exists in tasks table, skipping';
    END;

    -- Backfill existing completed tasks
    -- Use LENGTH to safely check for non-empty values
    -- This prevents "invalid input syntax for type timestamp" errors
    UPDATE tasks
    SET completed = CASE
        WHEN NULLIF(completed_at::TEXT, '') IS NOT NULL
        THEN completed_at::TEXT
        ELSE NULL
    END
    WHERE status = 'completed'
      AND (completed IS NULL OR completed::TEXT = '');

    RAISE NOTICE 'Backfilled completed column from completed_at';
END $$;
