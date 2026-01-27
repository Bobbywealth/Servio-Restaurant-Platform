-- Emergency Hotfix: Manually Add Missing completed Column
-- Run this directly on the PostgreSQL database to fix the assistant immediately
-- This bypasses the migration system if it's not working

-- Add the completed column if it doesn't exist
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed TEXT;

-- Verify it was added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'tasks' AND column_name = 'completed';

-- If still missing, try explicit addition (some PostgreSQL versions don't support IF NOT EXISTS)
-- ALTER TABLE tasks ADD COLUMN completed TEXT;

-- Log success
SELECT 'completed column added/verified' as status;
