-- Worker Refinements Migration
-- Version: 1.1.0
-- Date: 2026-01-20

-- Create sync_jobs table if it doesn't exist
CREATE TABLE IF NOT EXISTS sync_jobs (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Add refinements to sync_jobs for the background worker
ALTER TABLE sync_jobs ADD COLUMN IF NOT EXISTS entity_type TEXT;
ALTER TABLE sync_jobs ADD COLUMN IF NOT EXISTS entity_id TEXT;
ALTER TABLE sync_jobs ADD COLUMN next_run_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE sync_jobs ADD COLUMN priority INTEGER DEFAULT 10;
ALTER TABLE sync_jobs ADD COLUMN metadata TEXT DEFAULT '{}';

-- Add index for the worker to find jobs efficiently
CREATE INDEX IF NOT EXISTS idx_sync_jobs_worker ON sync_jobs (status, next_run_at, priority);

-- Add index for entity lookups
CREATE INDEX IF NOT EXISTS idx_sync_jobs_entity ON sync_jobs (entity_type, entity_id);

-- Update audit_logs to include metadata if not present
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS metadata TEXT DEFAULT '{}';
