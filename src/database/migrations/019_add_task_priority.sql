-- Add priority column to tasks table
-- Version: 1.2.0
-- Date: 2026-01-24

-- NOTE: This migration is written in a cross-dialect subset so it can run on
-- both SQLite and PostgreSQL with the same file.
ALTER TABLE tasks ADD COLUMN priority TEXT NOT NULL DEFAULT 'medium';
UPDATE tasks SET priority = 'medium' WHERE priority IS NULL;
