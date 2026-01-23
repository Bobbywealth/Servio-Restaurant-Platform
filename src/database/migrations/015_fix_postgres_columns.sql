-- Migration 015: Fix missing columns for PostgreSQL
-- This migration safely adds columns that may be missing in production PostgreSQL

-- PostgreSQL-safe way to add columns if they don't exist
-- Using DO blocks with exception handling

-- 1. TASKS table columns
DO $$ 
BEGIN
    ALTER TABLE tasks ADD COLUMN completed TEXT;
EXCEPTION
    WHEN duplicate_column THEN NULL;
END $$;

DO $$ 
BEGIN
    ALTER TABLE tasks ADD COLUMN completed_at TEXT;
EXCEPTION
    WHEN duplicate_column THEN NULL;
END $$;

-- 2. ORDERS table columns
DO $$ 
BEGIN
    ALTER TABLE orders ADD COLUMN received TEXT;
EXCEPTION
    WHEN duplicate_column THEN NULL;
END $$;

DO $$ 
BEGIN
    ALTER TABLE orders ADD COLUMN items TEXT DEFAULT '[]';
EXCEPTION
    WHEN duplicate_column THEN NULL;
END $$;

DO $$ 
BEGIN
    ALTER TABLE orders ADD COLUMN order_type VARCHAR(50) DEFAULT 'pickup';
EXCEPTION
    WHEN duplicate_column THEN NULL;
END $$;

DO $$ 
BEGIN
    ALTER TABLE orders ADD COLUMN special_instructions TEXT;
EXCEPTION
    WHEN duplicate_column THEN NULL;
END $$;

DO $$ 
BEGIN
    ALTER TABLE orders ADD COLUMN payment_method VARCHAR(50) DEFAULT 'pickup';
EXCEPTION
    WHEN duplicate_column THEN NULL;
END $$;

-- 3. SYNC_JOBS table columns
DO $$ 
BEGIN
    ALTER TABLE sync_jobs ADD COLUMN attempt_count INTEGER DEFAULT 0;
EXCEPTION
    WHEN duplicate_column THEN NULL;
END $$;

DO $$ 
BEGIN
    ALTER TABLE sync_jobs ADD COLUMN payload TEXT DEFAULT '{}';
EXCEPTION
    WHEN duplicate_column THEN NULL;
END $$;

DO $$ 
BEGIN
    ALTER TABLE sync_jobs ADD COLUMN metadata TEXT DEFAULT '{}';
EXCEPTION
    WHEN duplicate_column THEN NULL;
END $$;

DO $$ 
BEGIN
    ALTER TABLE sync_jobs ADD COLUMN next_run_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
EXCEPTION
    WHEN duplicate_column THEN NULL;
END $$;

DO $$ 
BEGIN
    ALTER TABLE sync_jobs ADD COLUMN priority INTEGER DEFAULT 10;
EXCEPTION
    WHEN duplicate_column THEN NULL;
END $$;

-- 4. Create indexes (IF NOT EXISTS is supported for indexes)
CREATE INDEX IF NOT EXISTS idx_tasks_restaurant ON tasks(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to);

CREATE INDEX IF NOT EXISTS idx_orders_restaurant ON orders(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);

CREATE INDEX IF NOT EXISTS idx_sync_jobs_restaurant ON sync_jobs(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_status_run ON sync_jobs(status, next_run_at);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_type ON sync_jobs(job_type);
