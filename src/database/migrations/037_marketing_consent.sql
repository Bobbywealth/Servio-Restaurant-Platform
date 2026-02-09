-- Add marketing_consent field to orders table
-- Stores customer consent for receiving marketing SMS messages (required for TCPA compliance)
ALTER TABLE orders ADD COLUMN marketing_consent BOOLEAN DEFAULT FALSE;

-- Create index for filtering by consent status
CREATE INDEX IF NOT EXISTS idx_orders_marketing_consent ON orders(marketing_consent);
