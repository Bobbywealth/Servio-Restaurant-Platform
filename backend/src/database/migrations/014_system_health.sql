-- Migration 014: System Health + Worker Heartbeat
-- Date: 2026-01-20
-- Purpose: Support /admin/system-health + worker heartbeat

CREATE TABLE IF NOT EXISTS system_health (
  id TEXT PRIMARY KEY,
  worker_last_seen_at TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Ensure singleton row exists
INSERT INTO system_health (id)
VALUES ('global')
ON CONFLICT (id) DO NOTHING;

