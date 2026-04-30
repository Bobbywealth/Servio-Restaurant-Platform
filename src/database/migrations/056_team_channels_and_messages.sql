-- Migration: Team channels and messaging foundation
-- Date: 2026-04-28
-- Purpose: Add internal team chat/channel data model and seed a default #general channel.

CREATE TABLE IF NOT EXISTS team_channels (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('public', 'private', 'dm')),
  name TEXT NOT NULL,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (restaurant_id, type, name)
);

CREATE INDEX IF NOT EXISTS idx_team_channels_restaurant_updated_at
  ON team_channels(restaurant_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS team_channel_members (
  channel_id TEXT NOT NULL REFERENCES team_channels(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  muted_until TIMESTAMPTZ,
  notification_preferences JSONB NOT NULL DEFAULT '{"all_messages": true, "mentions": true}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (channel_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_team_channel_members_user
  ON team_channel_members(user_id, channel_id);

CREATE TABLE IF NOT EXISTS team_messages (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL REFERENCES team_channels(id) ON DELETE CASCADE,
  sender_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  body TEXT,
  message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'system')),
  reply_to_message_id TEXT REFERENCES team_messages(id) ON DELETE SET NULL,
  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (message_type = 'system' OR body IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_team_messages_channel_created_at
  ON team_messages(channel_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_team_messages_sender_created_at
  ON team_messages(sender_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS team_message_reads (
  message_id TEXT NOT NULL REFERENCES team_messages(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_team_message_reads_user_read_at
  ON team_message_reads(user_id, read_at DESC);

CREATE TABLE IF NOT EXISTS team_message_attachments (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL REFERENCES team_messages(id) ON DELETE CASCADE,
  storage_key TEXT NOT NULL,
  mime_type TEXT,
  size BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_message_attachments_message
  ON team_message_attachments(message_id);

-- Backfill a default #general channel per restaurant.
INSERT INTO team_channels (
  id,
  restaurant_id,
  type,
  name,
  created_by,
  created_at,
  updated_at
)
SELECT
  CONCAT('team-channel-general-', r.id),
  r.id,
  'public',
  'general',
  (
    SELECT u.id
    FROM users u
    WHERE u.restaurant_id = r.id
      AND u.is_active = TRUE
    ORDER BY
      CASE u.role
        WHEN 'owner' THEN 0
        WHEN 'manager' THEN 1
        WHEN 'admin' THEN 2
        WHEN 'staff' THEN 3
        ELSE 4
      END,
      u.created_at ASC
    LIMIT 1
  ),
  NOW(),
  NOW()
FROM restaurants r
WHERE NOT EXISTS (
  SELECT 1
  FROM team_channels tc
  WHERE tc.restaurant_id = r.id
    AND tc.type = 'public'
    AND tc.name = 'general'
);

-- Backfill existing active staff as members of #general.
INSERT INTO team_channel_members (
  channel_id,
  user_id,
  role,
  joined_at,
  notification_preferences,
  created_at,
  updated_at
)
SELECT
  tc.id,
  u.id,
  CASE WHEN tc.created_by = u.id THEN 'owner' ELSE 'member' END,
  NOW(),
  '{"all_messages": true, "mentions": true}'::jsonb,
  NOW(),
  NOW()
FROM team_channels tc
INNER JOIN users u
  ON u.restaurant_id = tc.restaurant_id
WHERE tc.type = 'public'
  AND tc.name = 'general'
  AND u.is_active = TRUE
ON CONFLICT (channel_id, user_id) DO NOTHING;
