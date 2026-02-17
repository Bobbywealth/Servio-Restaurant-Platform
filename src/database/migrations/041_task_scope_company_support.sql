-- Migration 041: Add task scope support for company-wide tasks

ALTER TABLE tasks
    ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'restaurant';

ALTER TABLE tasks
    ADD COLUMN IF NOT EXISTS company_id TEXT REFERENCES companies(id);

UPDATE tasks
SET scope = 'restaurant'
WHERE scope IS NULL;

ALTER TABLE tasks
    ALTER COLUMN restaurant_id DROP NOT NULL;

ALTER TABLE tasks
    DROP CONSTRAINT IF EXISTS tasks_scope_check;

ALTER TABLE tasks
    ADD CONSTRAINT tasks_scope_check CHECK (scope IN ('company', 'restaurant'));

ALTER TABLE tasks
    DROP CONSTRAINT IF EXISTS tasks_scope_target_check;

ALTER TABLE tasks
    ADD CONSTRAINT tasks_scope_target_check CHECK (
        (scope = 'restaurant' AND restaurant_id IS NOT NULL)
        OR (scope = 'company' AND company_id IS NOT NULL)
    );

CREATE INDEX IF NOT EXISTS idx_tasks_scope ON tasks(scope);
CREATE INDEX IF NOT EXISTS idx_tasks_company ON tasks(company_id);
