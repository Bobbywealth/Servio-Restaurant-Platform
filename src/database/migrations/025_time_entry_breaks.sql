-- Migration: Create time_entry_breaks table
-- This table tracks breaks taken during time entries

CREATE TABLE IF NOT EXISTS time_entry_breaks (
    id TEXT PRIMARY KEY,
    time_entry_id TEXT NOT NULL REFERENCES time_entries(id) ON DELETE CASCADE,
    break_start TIMESTAMP NOT NULL,
    break_end TIMESTAMP,
    duration_minutes INTEGER,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster lookups by time entry
CREATE INDEX IF NOT EXISTS idx_time_entry_breaks_time_entry
ON time_entry_breaks(time_entry_id);

-- Index for finding active breaks
CREATE INDEX IF NOT EXISTS idx_time_entry_breaks_active
ON time_entry_breaks(time_entry_id, break_end)
WHERE break_end IS NULL;
