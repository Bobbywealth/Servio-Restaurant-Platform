-- Migration 023: Verify and Fix Completed Column (PostgreSQL)
-- Date: 2026-01-26
-- Purpose: Absolutely ensure the completed column exists

DO $$
DECLARE
    column_exists BOOLEAN;
BEGIN
    -- Check if the column exists
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'tasks'
        AND column_name = 'completed'
    ) INTO column_exists;

    IF NOT column_exists THEN
        -- Column doesn't exist, add it
        ALTER TABLE tasks ADD COLUMN completed TEXT;
        RAISE NOTICE 'Added missing completed column to tasks table';
    ELSE
        RAISE NOTICE 'Completed column already exists in tasks table';
    END IF;

    -- Verify it exists now
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'tasks'
        AND column_name = 'completed'
    ) INTO column_exists;

    IF column_exists THEN
        RAISE NOTICE 'VERIFIED: Completed column exists in tasks table';
    ELSE
        RAISE EXCEPTION 'CRITICAL: Failed to add completed column to tasks table';
    END IF;
END $$;
