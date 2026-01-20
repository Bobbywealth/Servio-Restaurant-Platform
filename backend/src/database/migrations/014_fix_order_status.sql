-- Fix Order Status Column
-- Version: 1.1.2
-- Date: 2026-01-20
-- Adds proper status constraint to orders table

-- First, update any invalid status values to 'received'
UPDATE orders 
SET status = 'received' 
WHERE status NOT IN ('received', 'preparing', 'ready', 'completed', 'cancelled');

-- Add proper status constraint (PostgreSQL syntax)
-- Note: PostgreSQL doesn't support adding CHECK constraints to existing columns directly
-- We need to add it as a table constraint
ALTER TABLE orders 
ADD CONSTRAINT orders_status_check 
CHECK (status IN ('received', 'preparing', 'ready', 'completed', 'cancelled'));