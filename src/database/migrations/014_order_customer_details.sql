-- Migration: Add customer details columns to orders table
-- These columns support the new checkout flow with customer info collection

-- Add order_type column (pickup, dine-in, delivery)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_type VARCHAR(50) DEFAULT 'pickup';

-- Add special_instructions column for customer notes
ALTER TABLE orders ADD COLUMN IF NOT EXISTS special_instructions TEXT;

-- Add payment_method column to track how customer intends to pay
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT 'pickup';
