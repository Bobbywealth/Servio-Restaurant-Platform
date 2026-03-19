-- Migration: Add state column to orders table
-- Description: Stores the customer's state for tax calculation purposes
-- Date: 2024

-- Add state column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'state'
  ) THEN
    ALTER TABLE orders ADD COLUMN state VARCHAR(2);
  END IF;
END $$;

-- Add index for faster lookups by state
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'orders' AND indexname = 'idx_orders_state'
  ) THEN
    CREATE INDEX idx_orders_state ON orders(state);
  END IF;
END $$;

-- Migration complete
