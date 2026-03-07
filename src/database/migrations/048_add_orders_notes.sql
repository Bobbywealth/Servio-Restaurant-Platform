-- Migration: Add missing columns to orders table
-- Fixes: column "notes" of relation "orders" does not exist

ALTER TABLE orders ADD COLUMN notes TEXT;
ALTER TABLE orders ADD COLUMN subtotal DOUBLE PRECISION;
ALTER TABLE orders ADD COLUMN tax DOUBLE PRECISION;
ALTER TABLE orders ADD COLUMN order_type TEXT;
ALTER TABLE orders ADD COLUMN pickup_time TEXT;
