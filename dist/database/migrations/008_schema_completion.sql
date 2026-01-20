-- Migration 008: Schema Completion  
-- Date: 2026-01-20
-- Completes schema to match ERD specification for existing database structure
-- Postgres & SQLite-compatible version

-- ============================================================================
-- 1. ADD MISSING COLUMNS TO SYNC_JOBS
-- ============================================================================

-- restaurant_id
-- ALTER TABLE sync_jobs ADD COLUMN restaurant_id TEXT REFERENCES restaurants(id);
-- job_type (rename entity_type if it exists, otherwise add)
-- ALTER TABLE sync_jobs ADD COLUMN job_type TEXT;
-- attempt_count
-- ALTER TABLE sync_jobs ADD COLUMN attempt_count INTEGER DEFAULT 0;
-- payload
-- ALTER TABLE sync_jobs ADD COLUMN payload TEXT DEFAULT '{}';

-- Migrate data if needed
UPDATE sync_jobs SET job_type = entity_type WHERE job_type IS NULL AND entity_type IS NOT NULL;
UPDATE sync_jobs SET job_type = 'sync' WHERE job_type IS NULL;
UPDATE sync_jobs SET payload = '{"entity_id":"' || COALESCE(entity_id, '') || '"}' WHERE payload = '{}' AND entity_id IS NOT NULL;
UPDATE sync_jobs SET restaurant_id = (SELECT id FROM restaurants LIMIT 1) WHERE restaurant_id IS NULL;

-- ============================================================================
-- 2. SYNC_JOB_RUNS TABLE
-- ============================================================================

-- Create sync_job_runs table (from ERD)
CREATE TABLE IF NOT EXISTS sync_job_runs (
    id TEXT PRIMARY KEY,
    sync_job_id TEXT NOT NULL REFERENCES sync_jobs(id),
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    status TEXT NOT NULL DEFAULT 'running',
    result TEXT,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sync_job_runs_job ON sync_job_runs(sync_job_id);
CREATE INDEX IF NOT EXISTS idx_sync_job_runs_status ON sync_job_runs(status);

-- ============================================================================
-- 3. CUSTOMERS TABLE ENHANCEMENTS (Match ERD)
-- ============================================================================

-- Add unique constraint for (restaurant_id, phone) as specified in ERD
-- Postgres specific way to add unique constraint with index
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_restaurant_phone_unique 
ON customers(restaurant_id, phone) WHERE phone IS NOT NULL AND phone != '';

-- ============================================================================
-- 4. ENSURE EXISTING TABLE RELATIONSHIPS ARE INDEXED
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_marketing_sends_campaign_id ON marketing_sends(campaign_id);
CREATE INDEX IF NOT EXISTS idx_marketing_sends_customer_id ON marketing_sends(customer_id);
CREATE INDEX IF NOT EXISTS idx_customers_restaurant_id ON customers(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_sync_status ON sync_jobs(status);
CREATE INDEX IF NOT EXISTS idx_sync_type ON sync_jobs(job_type);
CREATE INDEX IF NOT EXISTS idx_sync_created ON sync_jobs(created_at);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_restaurant ON sync_jobs(restaurant_id);

-- ============================================================================
-- 5. DATA VALIDATION FOR EXISTING TABLES
-- ============================================================================

UPDATE restaurants SET settings = '{}' WHERE settings IS NULL OR settings = '';
UPDATE users SET permissions = '[]' WHERE permissions IS NULL OR permissions = '';
