-- Migration 049: Add checklist/template fields to tasks table (PostgreSQL)
-- Date: 2026-03-31
-- Purpose: Support daily checklists with templates, sections, and recurrence

DO $$
BEGIN
    -- task_type: 'standard' (normal task) or 'checklist' (checklist item)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'task_type') THEN
        ALTER TABLE tasks ADD COLUMN task_type TEXT NOT NULL DEFAULT 'standard';
    END IF;

    -- template_id: links a cloned checklist item back to its template row
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'template_id') THEN
        ALTER TABLE tasks ADD COLUMN template_id TEXT;
    END IF;

    -- section: grouping header for checklist items (e.g. 'Opening', 'Food Prep', 'Closing')
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'section') THEN
        ALTER TABLE tasks ADD COLUMN section TEXT;
    END IF;

    -- recurrence: 'daily', 'weekly', or 'none' (controls cron cloning)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'recurrence') THEN
        ALTER TABLE tasks ADD COLUMN recurrence TEXT NOT NULL DEFAULT 'none';
    END IF;

    -- is_template: TRUE means this row is a template, not an active task
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'is_template') THEN
        ALTER TABLE tasks ADD COLUMN is_template BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;

    -- checklist_date: the date this checklist instance was created for
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'checklist_date') THEN
        ALTER TABLE tasks ADD COLUMN checklist_date DATE;
    END IF;

    -- sort_order: ordering within a section
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'sort_order') THEN
        ALTER TABLE tasks ADD COLUMN sort_order INTEGER DEFAULT 0;
    END IF;
END
$$;

-- Index for fast template lookups
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_tasks_template') THEN
        CREATE INDEX idx_tasks_template ON tasks (restaurant_id, is_template, recurrence) WHERE is_template = TRUE;
    END IF;
END $$;

-- Index for fast checklist date lookups
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_tasks_checklist_date') THEN
        CREATE INDEX idx_tasks_checklist_date ON tasks (restaurant_id, checklist_date, task_type) WHERE task_type = 'checklist';
    END IF;
END $$;

-- Index for deduplication queries
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_tasks_dedup') THEN
        CREATE INDEX idx_tasks_dedup ON tasks (restaurant_id, template_id, checklist_date) WHERE template_id IS NOT NULL;
    END IF;
END $$;
