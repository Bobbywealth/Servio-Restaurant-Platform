-- Migration: Team communication channels and messages
-- Date: 2026-04-28

CREATE TABLE IF NOT EXISTS team_channels (
  id UUID PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name VARCHAR(80) NOT NULL,
  description VARCHAR(300),
  created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS team_channel_members (
  channel_id UUID NOT NULL REFERENCES team_channels(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_read_message_id UUID,
  last_read_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (channel_id, user_id)
);

CREATE TABLE IF NOT EXISTS team_messages (
  id UUID PRIMARY KEY,
  channel_id UUID NOT NULL REFERENCES team_channels(id) ON DELETE CASCADE,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content VARCHAR(4000),
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  edited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT team_messages_content_or_attachments
    CHECK (
      (content IS NOT NULL AND length(btrim(content)) > 0)
      OR jsonb_array_length(attachments) > 0
    )
);

ALTER TABLE team_channel_members
  ADD CONSTRAINT team_channel_members_last_read_fk
  FOREIGN KEY (last_read_message_id)
  REFERENCES team_messages(id)
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_team_channels_restaurant ON team_channels (restaurant_id, is_archived, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_channel_members_user ON team_channel_members (restaurant_id, user_id, channel_id);
CREATE INDEX IF NOT EXISTS idx_team_messages_channel_created ON team_messages (channel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_messages_restaurant ON team_messages (restaurant_id, created_at DESC);
