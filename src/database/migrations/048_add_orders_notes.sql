-- Migration: Add missing columns to orders and order_items tables
-- Fixes: column "notes" of relation "orders" does not exist
-- Fixes: column "price" of relation "order_items" does not exist

ALTER TABLE orders ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS subtotal DOUBLE PRECISION;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tax DOUBLE PRECISION;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_type TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_time TEXT;

-- Add missing columns to order_items
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS price DOUBLE PRECISION;
