-- API Key Management System Migration
-- Version: 044
-- Date: 2026-02-23
-- Purpose: Add comprehensive API key management for third-party integrations

-- ============================================================================
-- API_KEYS TABLE - Store API keys for authentication
-- ============================================================================

CREATE TABLE api_keys (
    id TEXT PRIMARY KEY,
    company_id TEXT REFERENCES companies(id) ON DELETE CASCADE,
    restaurant_id TEXT REFERENCES restaurants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    key_prefix TEXT NOT NULL,  -- First 8 characters for identification (e.g., "sk_live_1a2b3c4d")
    key_hash TEXT NOT NULL UNIQUE,  -- Full SHA-256 hash of the key
    scopes JSONB DEFAULT '[]',  -- Array of permission scopes (e.g., ["read:orders", "write:orders"])
    rate_limit INTEGER DEFAULT 1000,  -- Requests per hour
    is_active BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMP,
    last_used_at TIMESTAMP,
    created_by TEXT REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure at least one of company_id or restaurant_id is set
    CONSTRAINT api_keys_scope_check CHECK (
        company_id IS NOT NULL OR restaurant_id IS NOT NULL
    )
);

-- ============================================================================
-- API_KEY_USAGE TABLE - Track API key usage for analytics and rate limiting
-- ============================================================================

CREATE TABLE api_key_usage (
    id TEXT PRIMARY KEY,
    api_key_id TEXT NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,  -- The API endpoint called
    method TEXT NOT NULL,  -- HTTP method (GET, POST, PUT, DELETE)
    status_code INTEGER NOT NULL,  -- HTTP response status
    response_time_ms INTEGER,  -- Response time in milliseconds
    ip_address TEXT,
    user_agent TEXT,
    request_size_bytes INTEGER,
    response_size_bytes INTEGER,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- API_KEY_DAILY_STATS TABLE - Aggregated daily statistics
-- ============================================================================

CREATE TABLE api_key_daily_stats (
    id TEXT PRIMARY KEY,
    api_key_id TEXT NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    total_requests INTEGER DEFAULT 0,
    successful_requests INTEGER DEFAULT 0,
    failed_requests INTEGER DEFAULT 0,
    avg_response_time_ms INTEGER,
    total_bytes_sent INTEGER DEFAULT 0,
    total_bytes_received INTEGER DEFAULT 0,
    unique_ips INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(api_key_id, date)
);

-- ============================================================================
-- API_KEY_WEBHOOKS TABLE - Webhook configurations for API keys
-- ============================================================================

CREATE TABLE api_key_webhooks (
    id TEXT PRIMARY KEY,
    api_key_id TEXT NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    secret TEXT,  -- HMAC secret for webhook signature verification
    events JSONB DEFAULT '[]',  -- Array of event types to trigger webhook
    is_active BOOLEAN DEFAULT TRUE,
    last_triggered_at TIMESTAMP,
    failure_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- API_KEY_WEBHOOK_DELIVERIES TABLE - Track webhook delivery attempts
-- ============================================================================

CREATE TABLE api_key_webhook_deliveries (
    id TEXT PRIMARY KEY,
    webhook_id TEXT NOT NULL REFERENCES api_key_webhooks(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    response_status INTEGER,
    response_body TEXT,
    attempt_count INTEGER DEFAULT 1,
    delivered_at TIMESTAMP,
    next_retry_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- API Keys indexes
CREATE INDEX idx_api_keys_company ON api_keys(company_id);
CREATE INDEX idx_api_keys_restaurant ON api_keys(restaurant_id);
CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_key_prefix ON api_keys(key_prefix);
CREATE INDEX idx_api_keys_active ON api_keys(is_active);
CREATE INDEX idx_api_keys_expires ON api_keys(expires_at);

-- API Key Usage indexes
CREATE INDEX idx_api_key_usage_key ON api_key_usage(api_key_id);
CREATE INDEX idx_api_key_usage_created ON api_key_usage(created_at);
CREATE INDEX idx_api_key_usage_endpoint ON api_key_usage(endpoint);
CREATE INDEX idx_api_key_usage_status ON api_key_usage(status_code);

-- API Key Daily Stats indexes
CREATE INDEX idx_api_key_daily_stats_key ON api_key_daily_stats(api_key_id);
CREATE INDEX idx_api_key_daily_stats_date ON api_key_daily_stats(date);

-- API Key Webhooks indexes
CREATE INDEX idx_api_key_webhooks_key ON api_key_webhooks(api_key_id);
CREATE INDEX idx_api_key_webhooks_active ON api_key_webhooks(is_active);

-- API Key Webhook Deliveries indexes
CREATE INDEX idx_api_key_webhook_deliveries_webhook ON api_key_webhook_deliveries(webhook_id);
CREATE INDEX idx_api_key_webhook_deliveries_created ON api_key_webhook_deliveries(created_at);
CREATE INDEX idx_api_key_webhook_deliveries_retry ON api_key_webhook_deliveries(next_retry_at);

-- ============================================================================
-- UPDATE TIMESTAMP TRIGGERS
-- ============================================================================

DROP TRIGGER IF EXISTS api_keys_updated_at ON api_keys;
CREATE TRIGGER api_keys_updated_at
    BEFORE UPDATE ON api_keys
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS api_key_daily_stats_updated_at ON api_key_daily_stats;
CREATE TRIGGER api_key_daily_stats_updated_at
    BEFORE UPDATE ON api_key_daily_stats
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS api_key_webhooks_updated_at ON api_key_webhooks;
CREATE TRIGGER api_key_webhooks_updated_at
    BEFORE UPDATE ON api_key_webhooks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- PREDEFINED API KEY SCOPES
-- ============================================================================

-- Insert default scope definitions (as a reference table via comments)
-- Available scopes:
-- read:orders - Read order information
-- write:orders - Create and update orders
-- read:menu - Read menu items and categories
-- write:menu - Create, update, and delete menu items
-- read:customers - Read customer information
-- write:customers - Create and update customers
-- read:inventory - Read inventory levels
-- write:inventory - Update inventory levels
-- read:staff - Read staff information
-- write:staff - Manage staff records
-- read:analytics - Access analytics and reports
-- admin:full - Full administrative access
-- webhooks - Manage and receive webhooks
