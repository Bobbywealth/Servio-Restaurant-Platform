-- Migration: Add role-based task assignment support
-- Date: 2026-04-27

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'assigned_role'
  ) THEN
    ALTER TABLE tasks ADD COLUMN assigned_role TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE indexname = 'idx_tasks_assigned_role'
  ) THEN
    CREATE INDEX idx_tasks_assigned_role ON tasks(assigned_role);
  END IF;
END $$;
