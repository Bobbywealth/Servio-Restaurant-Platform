-- Migration 017: Alert Calls System
-- Date: 2026-01-21
-- Purpose: Support automated alert calls for order failures and system issues

-- ============================================================================
-- ALERT CALLS TRACKING
-- ============================================================================

CREATE TABLE IF NOT EXISTS alert_calls (
    id TEXT PRIMARY KEY,
    restaurant_id TEXT REFERENCES restaurants(id),
    phone_number TEXT NOT NULL,
    message TEXT NOT NULL,
    call_sid TEXT,
    status TEXT NOT NULL DEFAULT 'initiated',
    metadata TEXT DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_alert_calls_restaurant ON alert_calls(restaurant_id, created_at DESC);
CREATE INDEX idx_alert_calls_status ON alert_calls(status, created_at DESC);

