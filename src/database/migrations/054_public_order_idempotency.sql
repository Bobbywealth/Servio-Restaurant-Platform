-- Migration: Public order idempotency keys
-- Purpose: Enforce idempotent order creation for POST /api/orders/public/:slug

CREATE TABLE IF NOT EXISTS public_order_idempotency_keys (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  order_id TEXT REFERENCES orders(id) ON DELETE SET NULL,
  response_payload TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (restaurant_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_public_order_idempotency_order
  ON public_order_idempotency_keys(order_id);

CREATE INDEX IF NOT EXISTS idx_public_order_idempotency_restaurant_created
  ON public_order_idempotency_keys(restaurant_id, created_at DESC);
