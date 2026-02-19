-- Migration 043: Ensure orders can persist optional customer email from public checkout

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS customer_email TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON orders(customer_email);
