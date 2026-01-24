-- Migration 018: Fix sync_jobs schema mismatch
-- This migration fixes the column naming mismatch between old and new schema
-- Old schema had: type, channels, details
-- New schema has: job_type, payload, metadata

-- 1. Rename 'type' column to 'job_type' if it exists
DO $$
BEGIN
    -- Check if 'type' column exists and 'job_type' doesn't
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'sync_jobs' AND column_name = 'type'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'sync_jobs' AND column_name = 'job_type'
    ) THEN
        ALTER TABLE sync_jobs RENAME COLUMN type TO job_type;
        RAISE NOTICE 'Renamed sync_jobs.type to job_type';
    END IF;
END $$;

-- 2. Ensure job_type has NOT NULL constraint
DO $$
BEGIN
    ALTER TABLE sync_jobs ALTER COLUMN job_type SET NOT NULL;
EXCEPTION
    WHEN invalid_table_definition THEN
        -- Column might have NULL values, set a default first
        UPDATE sync_jobs SET job_type = 'full_sync' WHERE job_type IS NULL;
        ALTER TABLE sync_jobs ALTER COLUMN job_type SET NOT NULL;
        RAISE NOTICE 'Set NOT NULL constraint on job_type after fixing NULL values';
    WHEN OTHERS THEN
        RAISE NOTICE 'job_type NOT NULL constraint already exists or not applicable';
END $$;

-- 3. Migrate data from 'channels' column to 'payload' if columns exist
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'sync_jobs' AND column_name = 'channels'
    ) AND EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'sync_jobs' AND column_name = 'payload'
    ) THEN
        -- Migrate channels and details into payload
        UPDATE sync_jobs
        SET payload = jsonb_build_object(
            'channels', COALESCE(channels::jsonb, '[]'::jsonb),
            'details', COALESCE(details::jsonb, '{}'::jsonb)
        )::text
        WHERE payload = '{}' OR payload IS NULL;
        RAISE NOTICE 'Migrated channels and details to payload';
    END IF;
END $$;

-- 4. Drop old columns if they exist (after data migration)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'sync_jobs' AND column_name = 'channels'
    ) THEN
        ALTER TABLE sync_jobs DROP COLUMN channels;
        RAISE NOTICE 'Dropped sync_jobs.channels column';
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'sync_jobs' AND column_name = 'details'
    ) THEN
        ALTER TABLE sync_jobs DROP COLUMN details;
        RAISE NOTICE 'Dropped sync_jobs.details column';
    END IF;
END $$;

-- 5. Ensure all required columns exist with proper defaults
DO $$
BEGIN
    ALTER TABLE sync_jobs ADD COLUMN IF NOT EXISTS restaurant_id TEXT;
    ALTER TABLE sync_jobs ADD COLUMN IF NOT EXISTS integration_id TEXT;
    ALTER TABLE sync_jobs ADD COLUMN IF NOT EXISTS entity_type TEXT;
    ALTER TABLE sync_jobs ADD COLUMN IF NOT EXISTS entity_id TEXT;
    ALTER TABLE sync_jobs ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
    ALTER TABLE sync_jobs ADD COLUMN IF NOT EXISTS payload TEXT DEFAULT '{}';
    ALTER TABLE sync_jobs ADD COLUMN IF NOT EXISTS result TEXT;
    ALTER TABLE sync_jobs ADD COLUMN IF NOT EXISTS error_message TEXT;
    ALTER TABLE sync_jobs ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;
    ALTER TABLE sync_jobs ADD COLUMN IF NOT EXISTS max_retries INTEGER DEFAULT 3;
    ALTER TABLE sync_jobs ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    ALTER TABLE sync_jobs ADD COLUMN IF NOT EXISTS next_run_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    ALTER TABLE sync_jobs ADD COLUMN IF NOT EXISTS started_at TIMESTAMP;
    ALTER TABLE sync_jobs ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;
    ALTER TABLE sync_jobs ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 10;
    ALTER TABLE sync_jobs ADD COLUMN IF NOT EXISTS metadata TEXT DEFAULT '{}';
    ALTER TABLE sync_jobs ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    RAISE NOTICE 'Ensured all required columns exist in sync_jobs';
END $$;

-- 6. Ensure status has NOT NULL constraint
DO $$
BEGIN
    ALTER TABLE sync_jobs ALTER COLUMN status SET DEFAULT 'pending';
    UPDATE sync_jobs SET status = 'pending' WHERE status IS NULL;
    ALTER TABLE sync_jobs ALTER COLUMN status SET NOT NULL;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'status constraint already exists or not applicable';
END $$;

-- 7. Create or recreate indexes
CREATE INDEX IF NOT EXISTS idx_sync_jobs_restaurant ON sync_jobs(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_status_run ON sync_jobs(status, next_run_at);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_type ON sync_jobs(job_type);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_status ON sync_jobs(status);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_priority ON sync_jobs(priority DESC);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_created ON sync_jobs(created_at);
