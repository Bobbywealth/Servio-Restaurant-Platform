-- Migration 009: Fix Missing Columns
-- Date: 2026-01-20
-- Fixes missing 'completed' and 'received' columns causing deployment failures

-- ============================================================================
-- 1. ADD MISSING COLUMNS TO EXISTING TABLES
-- ============================================================================

-- Add 'completed' column to tasks table (in case completed_at isn't working)
-- SQLite: Check if column exists before adding
-- This handles cases where the column name might be referenced differently

-- For tasks table - ensure we have both completed and completed_at
-- Create a new tasks table with all required columns
CREATE TABLE IF NOT EXISTS tasks_new (
    id TEXT PRIMARY KEY,
    restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    assigned_to TEXT REFERENCES users(id),
    due_date DATETIME,
    completed_at DATETIME,
    completed DATETIME,  -- Add this column for compatibility
    type TEXT DEFAULT 'one_time',
    priority INTEGER DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Migrate existing tasks data (if tasks table exists)
INSERT OR IGNORE INTO tasks_new (
    id, restaurant_id, title, description, status, assigned_to, due_date, 
    completed_at, completed, created_at, updated_at
)
SELECT 
    id, restaurant_id, title, description, status, assigned_to, due_date,
    completed_at, completed_at as completed, created_at, updated_at
FROM tasks;

-- Replace old tasks table
DROP TABLE IF EXISTS tasks;
ALTER TABLE tasks_new RENAME TO tasks;

-- ============================================================================
-- 2. ADD MISSING COLUMNS TO ORDERS TABLE
-- ============================================================================

-- For orders table - add 'received' column (even though status should handle this)
-- Create new orders table with all required columns
CREATE TABLE IF NOT EXISTS orders_new (
    id TEXT PRIMARY KEY,
    restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
    customer_id TEXT REFERENCES customers(id),
    external_id TEXT,
    channel TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'NEW',
    received DATETIME,  -- Add this column
    total_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
    payment_status TEXT NOT NULL DEFAULT 'unpaid',
    items TEXT DEFAULT '[]',  -- JSON field for order items
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Migrate existing orders data
INSERT OR IGNORE INTO orders_new (
    id, restaurant_id, customer_id, external_id, channel, status, 
    received, total_amount, payment_status, items, created_at, updated_at
)
SELECT 
    id, restaurant_id, customer_id, external_id, channel, status,
    CASE WHEN status = 'received' THEN created_at ELSE NULL END as received,
    total_amount, payment_status, 
    COALESCE(items, '[]') as items,
    created_at, updated_at
FROM orders;

-- Replace old orders table
DROP TABLE IF EXISTS orders;
ALTER TABLE orders_new RENAME TO orders;

-- ============================================================================
-- 3. ENSURE SYNC_JOBS HAS ALL REQUIRED COLUMNS
-- ============================================================================

-- Make sure sync_jobs table has all required columns for the worker
CREATE TABLE IF NOT EXISTS sync_jobs_complete (
    id TEXT PRIMARY KEY,
    restaurant_id TEXT REFERENCES restaurants(id),
    job_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    next_run_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    priority INTEGER DEFAULT 10,
    attempt_count INTEGER DEFAULT 0,
    payload TEXT NOT NULL DEFAULT '{}',
    metadata TEXT NOT NULL DEFAULT '{}',
    result TEXT,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Migrate any existing sync_jobs data
INSERT OR IGNORE INTO sync_jobs_complete (
    id, restaurant_id, job_type, status, payload, metadata, created_at
)
SELECT 
    id, 
    (SELECT id FROM restaurants LIMIT 1) as restaurant_id,
    COALESCE(job_type, type, 'sync') as job_type,
    status,
    COALESCE(payload, details, '{}') as payload,
    COALESCE(metadata, '{}') as metadata,
    created_at
FROM sync_jobs
WHERE id NOT IN (SELECT id FROM sync_jobs_complete);

-- Replace sync_jobs table
DROP TABLE IF EXISTS sync_jobs;
ALTER TABLE sync_jobs_complete RENAME TO sync_jobs;

-- ============================================================================
-- 4. RECREATE INDEXES
-- ============================================================================

-- Recreate indexes for tasks
CREATE INDEX IF NOT EXISTS idx_tasks_restaurant ON tasks(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to);

-- Recreate indexes for orders  
CREATE INDEX IF NOT EXISTS idx_orders_restaurant ON orders(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);

-- Recreate indexes for sync_jobs
CREATE INDEX IF NOT EXISTS idx_sync_jobs_restaurant ON sync_jobs(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_status_run ON sync_jobs(status, next_run_at);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_type ON sync_jobs(job_type);

-- ============================================================================
-- 5. DATA CONSISTENCY
-- ============================================================================

-- Update any 'NEW' status orders to 'received' if they're old enough
UPDATE orders 
SET status = 'received', received = created_at 
WHERE status = 'NEW' 
  AND created_at < datetime('now', '-5 minutes');

-- Ensure completed tasks have completed timestamp
UPDATE tasks 
SET completed = completed_at 
WHERE status = 'completed' 
  AND completed IS NULL 
  AND completed_at IS NOT NULL;

-- Schema fix completed