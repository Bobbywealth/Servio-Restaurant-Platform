-- Migration 022: Ensure tasks.completed column exists and backfill safely
-- Date: 2026-01-26
-- Purpose: Force-add missing completed column and backfill without type errors

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed TEXT;

DO $$
DECLARE
    completed_type TEXT;
BEGIN
    SELECT data_type
      INTO completed_type
      FROM information_schema.columns
     WHERE table_name = 'tasks'
       AND column_name = 'completed';

    IF completed_type IN ('timestamp without time zone', 'timestamp with time zone') THEN
        UPDATE tasks
        SET completed = CASE
            WHEN NULLIF(completed_at::TEXT, '') IS NOT NULL
            THEN completed_at::TIMESTAMP
            ELSE NULL
        END
        WHERE status = 'completed'
          AND completed IS NULL;
    ELSE
        UPDATE tasks
        SET completed = CASE
            WHEN NULLIF(completed_at::TEXT, '') IS NOT NULL
            THEN completed_at::TEXT
            ELSE NULL
        END
        WHERE status = 'completed'
          AND (completed IS NULL OR completed::TEXT = '');
    END IF;
END $$;
