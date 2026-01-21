-- Migration 009: Fix Missing Columns (PostgreSQL)
-- Date: 2026-01-20
-- Purpose: Production deploy was failing because an older SQLite-only version
--          of this migration used "INSERT OR IGNORE" and sqlite datetime().
--          This version is PostgreSQL-safe and idempotent.

BEGIN;

-- ============================================================================
-- 1. TASKS: ensure 'completed' compatibility column exists
-- ============================================================================

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed TIMESTAMP;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;

-- ============================================================================
-- 2. ORDERS: ensure 'received' timestamp + 'items' json text exist
-- ============================================================================

ALTER TABLE orders ADD COLUMN IF NOT EXISTS received TIMESTAMP;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS items TEXT DEFAULT '[]';

-- ============================================================================
-- 3. SYNC_JOBS: ensure worker-required columns exist
-- ============================================================================

ALTER TABLE sync_jobs ADD COLUMN IF NOT EXISTS attempt_count INTEGER DEFAULT 0;
ALTER TABLE sync_jobs ADD COLUMN IF NOT EXISTS payload TEXT NOT NULL DEFAULT '{}';
ALTER TABLE sync_jobs ADD COLUMN IF NOT EXISTS metadata TEXT NOT NULL DEFAULT '{}';
ALTER TABLE sync_jobs ADD COLUMN IF NOT EXISTS next_run_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE sync_jobs ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 10;

-- ============================================================================
-- 4. INDEXES (safe to re-run)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_tasks_restaurant ON tasks(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to);

CREATE INDEX IF NOT EXISTS idx_orders_restaurant ON orders(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);

CREATE INDEX IF NOT EXISTS idx_sync_jobs_restaurant ON sync_jobs(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_status_run ON sync_jobs(status, next_run_at);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_type ON sync_jobs(job_type);

-- ============================================================================
-- 5. DATA CONSISTENCY
-- ============================================================================

-- Backfill 'received' for older NEW orders
UPDATE orders
SET status = 'received', received = created_at
WHERE status = 'NEW'
  AND created_at < (CURRENT_TIMESTAMP - INTERVAL '5 minutes');

-- Backfill completed timestamp compatibility column
UPDATE tasks
SET completed = completed_at
WHERE status = 'completed'
  AND completed IS NULL
  AND completed_at IS NOT NULL;

COMMIT;
