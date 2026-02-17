-- Task rollout grouping support
-- Version: 041
-- Purpose: Link company-scope child tasks under a parent task group

ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS parent_task_group_id TEXT;

CREATE INDEX IF NOT EXISTS idx_tasks_parent_task_group_id ON tasks(parent_task_group_id);
