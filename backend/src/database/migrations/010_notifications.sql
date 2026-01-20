-- Notifications module schema
-- Version: 1.0.0
-- Date: 2026-01-19

CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
    type TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    metadata TEXT NOT NULL DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notification_recipients (
    id TEXT PRIMARY KEY,
    notification_id TEXT NOT NULL REFERENCES notifications(id),
    recipient_type TEXT NOT NULL CHECK (recipient_type IN ('user', 'role', 'restaurant')),
    recipient_user_id TEXT REFERENCES users(id),
    recipient_role TEXT CHECK (recipient_role IN ('owner', 'manager', 'staff', 'admin', 'platform-admin')),
    restaurant_id TEXT REFERENCES restaurants(id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notification_reads (
    notification_id TEXT NOT NULL REFERENCES notifications(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    read_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (notification_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_notifications_restaurant_created
    ON notifications (restaurant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_recipients_notification
    ON notification_recipients (notification_id);
CREATE INDEX IF NOT EXISTS idx_notification_reads_user_read
    ON notification_reads (user_id, read_at DESC);
