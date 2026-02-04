-- Add fast lookup column for refresh token verification
-- Instead of loading all sessions and comparing bcrypt hashes (O(n) slow operations),
-- we store a SHA-256 hash that can be indexed and looked up directly (O(1))

-- Add token_hash column for fast indexed lookups
ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS token_hash TEXT;

-- Create index for fast token lookup
CREATE INDEX IF NOT EXISTS idx_auth_sessions_token_hash ON auth_sessions(token_hash);

-- Create index on expires_at for cleanup queries
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at ON auth_sessions(expires_at);
