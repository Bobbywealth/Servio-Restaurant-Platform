-- Migration: Add missing columns to orders table
-- Fixes: column "notes" of relation "orders" does not exist

ALTER TABLE orders ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS subtotal DOUBLE PRECISION;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tax DOUBLE PRECISION;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_type TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_time TEXT;
