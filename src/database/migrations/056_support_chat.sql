-- Support chat between restaurant dashboards and platform admin customer service

CREATE TABLE IF NOT EXISTS support_chat_threads (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_chat_threads_restaurant
  ON support_chat_threads (restaurant_id, last_message_at DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_chat_threads_status
  ON support_chat_threads (status, last_message_at DESC, created_at DESC);

CREATE TABLE IF NOT EXISTS support_chat_messages (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL REFERENCES support_chat_threads(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('restaurant', 'support')),
  sender_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_chat_messages_thread
  ON support_chat_messages (thread_id, created_at ASC);

CREATE OR REPLACE FUNCTION update_support_chat_threads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS trg_support_chat_threads_updated_at ON support_chat_threads;
CREATE TRIGGER trg_support_chat_threads_updated_at
  BEFORE UPDATE ON support_chat_threads
  FOR EACH ROW
  EXECUTE FUNCTION update_support_chat_threads_updated_at();

CREATE OR REPLACE FUNCTION update_support_chat_thread_activity()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE support_chat_threads
  SET last_message_at = NEW.created_at,
      updated_at = NOW()
  WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS trg_support_chat_thread_activity ON support_chat_messages;
CREATE TRIGGER trg_support_chat_thread_activity
  AFTER INSERT ON support_chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_support_chat_thread_activity();
