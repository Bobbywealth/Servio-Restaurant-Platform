-- Worker Refinements Migration
-- Version: 1.1.0
-- Date: 2026-01-20

-- Create sync_jobs table with ALL required columns
CREATE TABLE IF NOT EXISTS sync_jobs (
    id TEXT PRIMARY KEY,
    restaurant_id TEXT,
    integration_id TEXT,
    job_type TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    payload TEXT DEFAULT '{}',
    result TEXT,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    scheduled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    next_run_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    priority INTEGER DEFAULT 10,
    metadata TEXT DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Note: No ALTER TABLE needed for sync_jobs if it was created above
-- We only keep ALTER TABLE for audit_logs which existed before

-- Add index for the worker to find jobs efficiently
CREATE INDEX IF NOT EXISTS idx_sync_jobs_worker ON sync_jobs (status, next_run_at, priority);

-- Add index for entity lookups
CREATE INDEX IF NOT EXISTS idx_sync_jobs_entity ON sync_jobs (entity_type, entity_id);

-- Update audit_logs to include metadata if not present
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS metadata TEXT DEFAULT '{}';
