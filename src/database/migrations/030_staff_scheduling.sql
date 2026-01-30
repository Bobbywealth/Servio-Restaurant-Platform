-- Migration: Staff Scheduling System
-- Date: 2026-01-28
-- Purpose: Add comprehensive scheduling, availability, and shift template support

-- ============================================================================
-- STAFF SCHEDULES
-- ============================================================================

CREATE TABLE IF NOT EXISTS staff_schedules (
    id TEXT PRIMARY KEY,
    restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    shift_date DATE NOT NULL,
    shift_start_time TIME NOT NULL,
    shift_end_time TIME NOT NULL,
    position TEXT,
    notes TEXT,
    is_published BOOLEAN DEFAULT false,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, shift_date)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_staff_schedules_restaurant
    ON staff_schedules(restaurant_id);

CREATE INDEX IF NOT EXISTS idx_staff_schedules_user
    ON staff_schedules(user_id);

CREATE INDEX IF NOT EXISTS idx_staff_schedules_date
    ON staff_schedules(shift_date);

CREATE INDEX IF NOT EXISTS idx_staff_schedules_date_range
    ON staff_schedules(restaurant_id, shift_date);

CREATE INDEX IF NOT EXISTS idx_staff_schedules_published
    ON staff_schedules(restaurant_id, is_published, shift_date);

-- ============================================================================
-- STAFF AVAILABILITY PREFERENCES
-- ============================================================================

CREATE TABLE IF NOT EXISTS staff_availability (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL, -- 0=Sunday, 1=Monday, ..., 6=Saturday
    is_available BOOLEAN DEFAULT true,
    preferred_start_time TIME,
    preferred_end_time TIME,
    max_hours INTEGER,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, day_of_week)
);

-- Indexes for availability lookups
CREATE INDEX IF NOT EXISTS idx_staff_availability_user
    ON staff_availability(user_id);

-- ============================================================================
-- SHIFT TEMPLATES
-- ============================================================================

CREATE TABLE IF NOT EXISTS shift_templates (
    id TEXT PRIMARY KEY,
    restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    break_minutes INTEGER DEFAULT 0,
    position TEXT,
    color TEXT DEFAULT '#14B8A6',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for template lookups
CREATE INDEX IF NOT EXISTS idx_shift_templates_restaurant
    ON shift_templates(restaurant_id);

CREATE INDEX IF NOT EXISTS idx_shift_templates_active
    ON shift_templates(restaurant_id, is_active);

-- ============================================================================
-- STAFFING NOTES (for scheduling adjustments)
-- ============================================================================

CREATE TABLE IF NOT EXISTS staffing_notes (
    id TEXT PRIMARY KEY,
    restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    note_date DATE NOT NULL,
    note_type TEXT NOT NULL, -- 'request_off', 'availability_change', 'preference', etc.
    note TEXT NOT NULL,
    created_by TEXT REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for staffing notes
CREATE INDEX IF NOT EXISTS idx_staffing_notes_restaurant
    ON staffing_notes(restaurant_id, note_date);

CREATE INDEX IF NOT EXISTS idx_staffing_notes_user
    ON staffing_notes(user_id, note_date);

CREATE INDEX IF NOT EXISTS idx_staffing_notes_type
    ON staffing_notes(note_type);
