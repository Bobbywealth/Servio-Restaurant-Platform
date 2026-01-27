-- Migration: Add customer phone lookup index
-- Date: 2026-01-27
-- Purpose: Improve performance for customer lookup by phone number during voice orders

-- Add index on customers(phone, restaurant_id) for fast customer lookups during phone orders
CREATE INDEX IF NOT EXISTS idx_customers_phone_restaurant ON customers(phone, restaurant_id);
