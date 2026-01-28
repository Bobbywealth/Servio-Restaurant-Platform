-- Migration: 028_conversation_intelligence.sql
-- Purpose: Add conversation intelligence tables for call sessions, transcripts, insights, and reviews

-- Table: call_sessions
-- Stores call metadata with restaurant tenant scoping
CREATE TABLE IF NOT EXISTS call_sessions (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
  provider TEXT NOT NULL DEFAULT 'vapi',
  provider_call_id TEXT NOT NULL,
  direction TEXT CHECK (direction IN ('inbound', 'outbound')),
  from_number TEXT,
  to_number TEXT,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  status TEXT DEFAULT 'completed' CHECK (status IN ('completed', 'failed', 'no_answer', 'transcript_pending', 'analyzing', 'transcript_failed', 'analysis_failed')),
  audio_url TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for call_sessions
CREATE INDEX IF NOT EXISTS idx_call_sessions_restaurant ON call_sessions(restaurant_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_sessions_provider ON call_sessions(provider, provider_call_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_call_sessions_unique ON call_sessions(provider, provider_call_id);
CREATE INDEX IF NOT EXISTS idx_call_sessions_status ON call_sessions(restaurant_id, status);

-- Table: call_transcripts
-- Stores speaker-labeled transcript turns with timestamps
CREATE TABLE IF NOT EXISTS call_transcripts (
  id TEXT PRIMARY KEY,
  call_session_id TEXT NOT NULL REFERENCES call_sessions(id) ON DELETE CASCADE,
  transcript_text TEXT NOT NULL,
  transcript_json JSONB NOT NULL DEFAULT '{"turns": []}',
  language TEXT DEFAULT 'en',
  stt_provider TEXT DEFAULT 'vapi' CHECK (stt_provider IN ('vapi', 'whisper', 'deepgram', 'other')),
  stt_confidence NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for call_transcripts
CREATE INDEX IF NOT EXISTS idx_call_transcripts_session ON call_transcripts(call_session_id);
CREATE INDEX IF NOT EXISTS idx_call_transcripts_created ON call_transcripts(created_at DESC);

-- Table: call_insights
-- Stores AI-generated structured insights from call analysis
CREATE TABLE IF NOT EXISTS call_insights (
  id TEXT PRIMARY KEY,
  call_session_id TEXT NOT NULL REFERENCES call_sessions(id) ON DELETE CASCADE,
  summary TEXT,
  intent_primary TEXT CHECK (intent_primary IN ('order_placement', 'menu_inquiry', 'pricing', 'hours', 'complaint', 'catering', 'reservation', 'feedback', 'other')),
  intents_secondary TEXT[] DEFAULT '{}',
  outcome TEXT CHECK (outcome IN ('success', 'abandoned', 'escalated', 'unresolved')),
  sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative')),
  friction_points JSONB DEFAULT '[]',
  improvement_suggestions JSONB DEFAULT '[]',
  extracted_entities JSONB DEFAULT '{}',
  quality_score INTEGER CHECK (quality_score >= 0 AND quality_score <= 100),
  analysis_raw TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for call_insights
-- Note: call_insights is linked to call_sessions, so we filter by call_session_id which already filters by restaurant_id
CREATE INDEX IF NOT EXISTS idx_call_insights_session ON call_insights(call_session_id);
CREATE INDEX IF NOT EXISTS idx_call_insights_intent ON call_insights(intent_primary) WHERE intent_primary IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_call_insights_outcome ON call_insights(outcome) WHERE outcome IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_call_insights_sentiment ON call_insights(sentiment) WHERE sentiment IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_call_insights_created ON call_insights(created_at DESC);

-- Table: call_reviews
-- Stores internal review tracking with notes and tags
CREATE TABLE IF NOT EXISTS call_reviews (
  id TEXT PRIMARY KEY,
  call_session_id TEXT NOT NULL REFERENCES call_sessions(id) ON DELETE CASCADE,
  reviewed_by TEXT REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  internal_notes TEXT,
  tags TEXT[] DEFAULT '{}',
  follow_up_action TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for call_reviews
CREATE INDEX IF NOT EXISTS idx_call_reviews_session ON call_reviews(call_session_id);
CREATE INDEX IF NOT EXISTS idx_call_reviews_reviewed ON call_reviews(reviewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_reviews_reviewer ON call_reviews(reviewed_by, reviewed_at DESC);

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-update updated_at on call_sessions
DROP TRIGGER IF EXISTS update_call_sessions_updated_at ON call_sessions;
CREATE TRIGGER update_call_sessions_updated_at
    BEFORE UPDATE ON call_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger to auto-update updated_at on call_reviews
DROP TRIGGER IF EXISTS update_call_reviews_updated_at ON call_reviews;
CREATE TRIGGER update_call_reviews_updated_at
    BEFORE UPDATE ON call_reviews
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
