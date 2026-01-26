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
    -- Set completed = completed_at for tasks that are marked as completed
    -- Only copy non-empty timestamps
    UPDATE tasks
    SET completed = completed_at
    WHERE status = 'completed'
      AND (completed IS NULL OR completed = '')
      AND completed_at IS NOT NULL
      AND completed_at != '';

    RAISE NOTICE 'Backfilled completed column from completed_at';
END $$;
