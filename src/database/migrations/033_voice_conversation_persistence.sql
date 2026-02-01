-- Migration: 033_voice_conversation_persistence.sql
-- Purpose: Add persistent storage for voice assistant conversations
-- This enables conversations to survive server restarts and persist across sessions

-- Table: voice_conversations
-- Stores voice assistant conversation metadata with restaurant tenant scoping
CREATE TABLE IF NOT EXISTS voice_conversations (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
  session_id TEXT NOT NULL,
  phone_number TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for voice_conversations
CREATE INDEX IF NOT EXISTS idx_voice_conversations_restaurant ON voice_conversations(restaurant_id, last_activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_voice_conversations_session ON voice_conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_voice_conversations_status ON voice_conversations(restaurant_id, status);
CREATE INDEX IF NOT EXISTS idx_voice_conversations_phone ON voice_conversations(restaurant_id, phone_number) WHERE phone_number IS NOT NULL;

-- Table: voice_conversation_messages
-- Stores individual messages within voice assistant conversations
CREATE TABLE IF NOT EXISTS voice_conversation_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES voice_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  audio_url TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for voice_conversation_messages
CREATE INDEX IF NOT EXISTS idx_voice_conversation_messages_conv ON voice_conversation_messages(conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_voice_conversation_messages_created ON voice_conversation_messages(created_at DESC);

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-update updated_at on voice_conversations
DROP TRIGGER IF EXISTS update_voice_conversations_updated_at ON voice_conversations;
CREATE TRIGGER update_voice_conversations_updated_at
    BEFORE UPDATE ON voice_conversations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Update last_activity_at when a message is added
CREATE OR REPLACE FUNCTION update_conversation_activity()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE voice_conversations
    SET last_activity_at = CURRENT_TIMESTAMP
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to update conversation activity when message is added
DROP TRIGGER IF EXISTS update_voice_conversation_activity ON voice_conversation_messages;
CREATE TRIGGER update_voice_conversation_activity
    AFTER INSERT ON voice_conversation_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_conversation_activity();
