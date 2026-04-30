-- Migration: Team communication channels and messages
-- Date: 2026-04-28
-- Updated: 2026-04-30 - Fixed table creation order to resolve FK constraint error
-- Issue: team_messages was created AFTER team_channel_members but FK references team_messages

-- 1. Create team_messages FIRST (referenced by team_channel_members.last_read_message_id)
CREATE TABLE IF NOT EXISTS team_messages (
  id UUID PRIMARY KEY,
  channel_id UUID NOT NULL,
  restaurant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
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

-- 2. Create team_channels
CREATE TABLE IF NOT EXISTS team_channels (
  id UUID PRIMARY KEY,
  restaurant_id TEXT NOT NULL,
  name VARCHAR(80) NOT NULL,
  description VARCHAR(300),
  created_by TEXT NOT NULL,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Create team_channel_members (has FK to team_messages via last_read_message_id)
CREATE TABLE IF NOT EXISTS team_channel_members (
  channel_id UUID NOT NULL,
  user_id TEXT NOT NULL,
  restaurant_id TEXT NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_read_message_id UUID,
  last_read_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (channel_id, user_id)
);

-- 4. Now add FK constraints after all tables exist

-- FK: team_messages -> team_channels
DO $$
BEGIN
  ALTER TABLE team_messages ADD CONSTRAINT team_messages_channel_fk FOREIGN KEY (channel_id) REFERENCES team_channels(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- FK: team_messages -> users
DO $$
BEGIN
  ALTER TABLE team_messages ADD CONSTRAINT team_messages_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- FK: team_messages -> restaurants
DO $$
BEGIN
  ALTER TABLE team_messages ADD CONSTRAINT team_messages_restaurant_fk FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- FK: team_channels -> restaurants
DO $$
BEGIN
  ALTER TABLE team_channels ADD CONSTRAINT team_channels_restaurant_fk FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- FK: team_channels -> users (created_by)
DO $$
BEGIN
  ALTER TABLE team_channels ADD CONSTRAINT team_channels_created_by_fk FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- FK: team_channel_members -> team_channels
DO $$
BEGIN
  ALTER TABLE team_channel_members ADD CONSTRAINT team_channel_members_channel_fk FOREIGN KEY (channel_id) REFERENCES team_channels(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- FK: team_channel_members -> users
DO $$
BEGIN
  ALTER TABLE team_channel_members ADD CONSTRAINT team_channel_members_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- FK: team_channel_members -> restaurants
DO $$
BEGIN
  ALTER TABLE team_channel_members ADD CONSTRAINT team_channel_members_restaurant_fk FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- FK: team_channel_members.last_read_message_id -> team_messages
-- This is the key FK that was failing in the original migration
DO $$
BEGIN
  ALTER TABLE team_channel_members ADD CONSTRAINT team_channel_members_last_read_fk FOREIGN KEY (last_read_message_id) REFERENCES team_messages(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_team_channels_restaurant ON team_channels (restaurant_id, is_archived, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_channel_members_user ON team_channel_members (restaurant_id, user_id, channel_id);
CREATE INDEX IF NOT EXISTS idx_team_messages_channel_created ON team_messages (channel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_messages_restaurant ON team_messages (restaurant_id, created_at DESC);
