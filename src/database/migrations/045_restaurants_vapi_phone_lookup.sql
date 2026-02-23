-- Add direct lookup column for Vapi phone number -> restaurant mapping
-- Improves inbound phone webhook routing performance by avoiding full-table scans.

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS vapi_phone_number_id TEXT;

-- Keep lookups fast for getRestaurantIdFromParams.
CREATE INDEX IF NOT EXISTS idx_restaurants_vapi_phone_number_id
  ON restaurants (vapi_phone_number_id)
  WHERE vapi_phone_number_id IS NOT NULL;

-- One-time backfill from legacy settings JSON path.
CREATE OR REPLACE FUNCTION safe_parse_jsonb(input_text TEXT)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN input_text::jsonb;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$;

UPDATE restaurants
SET vapi_phone_number_id = NULLIF(TRIM(safe_parse_jsonb(settings::text)->'vapi'->>'phoneNumberId'), '')
WHERE vapi_phone_number_id IS NULL
  AND settings IS NOT NULL
  AND safe_parse_jsonb(settings::text)->'vapi'->>'phoneNumberId' IS NOT NULL;

DROP FUNCTION IF EXISTS safe_parse_jsonb(TEXT);
