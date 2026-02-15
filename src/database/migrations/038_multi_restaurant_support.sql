-- Multi-Restaurant Support Migration
-- Version: 038
-- Date: 2026-02-15
-- Purpose: Add multi-company/restaurant organization support

-- ============================================================================
-- COMPANIES TABLE - Top-level organization entity
-- ============================================================================

CREATE TABLE companies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    logo_url TEXT,
    billing_email TEXT,
    settings JSONB DEFAULT '{}',
    subscription_tier TEXT DEFAULT 'starter' CHECK (subscription_tier IN ('starter', 'professional', 'enterprise')),
    subscription_status TEXT DEFAULT 'active',
    billing_info JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- ============================================================================
-- COMPANY_USERS TABLE - Maps users to companies with roles
-- ============================================================================

CREATE TABLE company_users (
    id TEXT PRIMARY KEY,
    company_id TEXT REFERENCES companies(id) ON DELETE CASCADE,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'viewer' CHECK (role IN ('super_admin', 'admin', 'manager', 'viewer')),
    permissions JSONB DEFAULT '[]',
    invited_by TEXT REFERENCES users(id),
    invited_at TIMESTAMP,
    accepted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(company_id, user_id)
);

-- ============================================================================
-- ALTER RESTAURANTS TABLE - Add company organization fields
-- ============================================================================

ALTER TABLE restaurants ADD COLUMN company_id TEXT REFERENCES companies(id);
ALTER TABLE restaurants ADD COLUMN is_branch BOOLEAN DEFAULT FALSE;
ALTER TABLE restaurants ADD COLUMN parent_restaurant_id TEXT REFERENCES restaurants(id);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_restaurants_company ON restaurants(company_id);
CREATE INDEX idx_company_users_company ON company_users(company_id);
CREATE INDEX idx_company_users_user ON company_users(user_id);

-- ============================================================================
-- COMPANY_BILLING_HISTORY TABLE - Track billing transactions
-- ============================================================================

CREATE TABLE company_billing_history (
    id TEXT PRIMARY KEY,
    company_id TEXT REFERENCES companies(id) ON DELETE CASCADE,
    amount_cents INTEGER NOT NULL,
    currency TEXT DEFAULT 'USD',
    status TEXT NOT NULL,
    invoice_url TEXT,
    period_start TIMESTAMP,
    period_end TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- COMPANY_FEATURE_FLAGS TABLE - Feature toggles per company
-- ============================================================================

CREATE TABLE company_feature_flags (
    id TEXT PRIMARY KEY,
    company_id TEXT REFERENCES companies(id) ON DELETE CASCADE,
    feature_key TEXT NOT NULL,
    enabled BOOLEAN DEFAULT FALSE,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(company_id, feature_key)
);

-- ============================================================================
-- UPDATE TIMESTAMP TRIGGER FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to companies table
DROP TRIGGER IF EXISTS companies_updated_at ON companies;
CREATE TRIGGER companies_updated_at
    BEFORE UPDATE ON companies
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply updated_at trigger to company_feature_flags table
DROP TRIGGER IF EXISTS company_feature_flags_updated_at ON company_feature_flags;
CREATE TRIGGER company_feature_flags_updated_at
    BEFORE UPDATE ON company_feature_flags
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
