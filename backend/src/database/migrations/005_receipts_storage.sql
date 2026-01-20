-- Receipts Storage Migration
-- Version: 1.2.0
-- Date: 2026-01-20

-- Add storage fields to receipts (storage_key already exists)
ALTER TABLE receipts ADD COLUMN content_type TEXT;
ALTER TABLE receipts ADD COLUMN file_size INTEGER;
-- Note: SQLite doesn't support ALTER COLUMN operations like PostgreSQL
-- receipt_date and processing_status modifications skipped for SQLite compatibility

-- Add index for multi-tenant lookups (using status column instead of processing_status)
CREATE INDEX IF NOT EXISTS idx_receipts_restaurant_status ON receipts (restaurant_id, status);
