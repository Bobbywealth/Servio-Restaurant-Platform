-- Migration: Notification channel policy preferences
-- Date: 2026-04-27

ALTER TABLE notification_preferences ADD COLUMN email_enabled INTEGER DEFAULT 1;
ALTER TABLE notification_preferences ADD COLUMN sms_enabled INTEGER DEFAULT 0;
ALTER TABLE notification_preferences ADD COLUMN in_app_enabled INTEGER DEFAULT 1;
ALTER TABLE notification_preferences ADD COLUMN task_completed_email INTEGER DEFAULT 0;
ALTER TABLE notification_preferences ADD COLUMN critical_alerts_email INTEGER DEFAULT 1;
