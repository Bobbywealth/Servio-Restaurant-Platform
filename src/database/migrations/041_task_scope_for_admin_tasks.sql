-- Migration 041: add task scope support for admin/company-level tasks
-- Adds scope and company_id so tasks can be company-wide or tied to one restaurant.

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'restaurant';

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS company_id TEXT REFERENCES companies(id);

ALTER TABLE tasks
  ALTER COLUMN restaurant_id DROP NOT NULL;

UPDATE tasks t
SET company_id = r.company_id
FROM restaurants r
WHERE t.restaurant_id = r.id
  AND t.company_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_scope ON tasks(scope);
CREATE INDEX IF NOT EXISTS idx_tasks_company ON tasks(company_id);
