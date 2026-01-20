-- Receipts Storage Migration
-- Version: 1.2.0
-- Date: 2026-01-20

-- Add storage fields to receipts
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS storage_key TEXT;
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS content_type TEXT;
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS file_size BIGINT;
ALTER TABLE receipts ALTER COLUMN receipt_date DROP NOT NULL;

-- Standardize status
-- v1 statuses: 'pending', 'uploaded', 'needs_review', 'processed', 'failed'
ALTER TABLE receipts ALTER COLUMN processing_status SET DEFAULT 'pending';

-- Add index for multi-tenant lookups
CREATE INDEX IF NOT EXISTS idx_receipts_restaurant_status ON receipts (restaurant_id, processing_status);
