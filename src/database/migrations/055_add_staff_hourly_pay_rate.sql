-- Migration: Add hourly pay rate to users for labor budgeting
-- Date: 2026-04-27
-- Purpose: Store default pay rate on staff profile for schedule/labor cost calculations

ALTER TABLE users
ADD COLUMN IF NOT EXISTS hourly_pay_rate DOUBLE PRECISION;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_hourly_pay_rate_non_negative'
  ) THEN
    ALTER TABLE users
    ADD CONSTRAINT users_hourly_pay_rate_non_negative
    CHECK (hourly_pay_rate IS NULL OR hourly_pay_rate >= 0);
  END IF;
END $$;
