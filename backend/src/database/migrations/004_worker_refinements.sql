-- Worker Refinements Migration
-- Version: 1.1.0
-- Date: 2026-01-20

-- Add refinements to sync_jobs for the background worker
ALTER TABLE sync_jobs ADD COLUMN IF NOT EXISTS next_run_at TIMESTAMP DEFAULT NOW();
ALTER TABLE sync_jobs ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 10;
ALTER TABLE sync_jobs ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Add index for the worker to find jobs efficiently
CREATE INDEX IF NOT EXISTS idx_sync_jobs_worker ON sync_jobs (status, next_run_at, priority);

-- Add index for entity lookups
CREATE INDEX IF NOT EXISTS idx_sync_jobs_entity ON sync_jobs (entity_type, entity_id);

-- Update audit_logs to include metadata if not present
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
