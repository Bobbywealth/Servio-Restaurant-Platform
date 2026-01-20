-- Demo bookings table for "Book Demo" calendar
-- Works for both SQLite and Postgres (keeps id as TEXT)

CREATE TABLE IF NOT EXISTS demo_bookings (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  restaurant_name TEXT,
  booking_date TEXT NOT NULL, -- YYYY-MM-DD
  booking_time TEXT NOT NULL, -- HH:MM (24h)
  timezone TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled', -- scheduled|cancelled|completed
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_demo_bookings_date_time
  ON demo_bookings (booking_date, booking_time);

