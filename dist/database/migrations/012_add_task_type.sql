-- Add missing task type column (required by API)
-- Version: 1.1.1
-- Date: 2026-01-21

-- NOTE: This migration is written in a cross-dialect subset so it can run on
-- both SQLite and PostgreSQL with the same file.
ALTER TABLE tasks ADD COLUMN type TEXT NOT NULL DEFAULT 'one_time';
UPDATE tasks SET type = 'one_time' WHERE type IS NULL;

