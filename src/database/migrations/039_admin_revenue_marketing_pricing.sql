-- Platform admin billing, marketing, and pricing controls

CREATE TABLE IF NOT EXISTS admin_billing_subscriptions (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  package_name VARCHAR(100) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'active',
  billing_cycle VARCHAR(20) NOT NULL DEFAULT 'monthly',
  amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  next_billing_date TIMESTAMP,
  contact_email VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (restaurant_id)
);

CREATE INDEX IF NOT EXISTS idx_admin_billing_subscriptions_status ON admin_billing_subscriptions(status);

INSERT INTO admin_billing_subscriptions (id, restaurant_id, package_name, status, billing_cycle, amount, contact_email)
SELECT
  'sub-' || r.id,
  r.id,
  COALESCE(NULLIF(c.subscription_tier, ''), 'operations') AS package_name,
  COALESCE(NULLIF(c.subscription_status, ''), 'active') AS status,
  'monthly' AS billing_cycle,
  CASE
    WHEN LOWER(COALESCE(c.subscription_tier, '')) = 'starter' THEN 49
    WHEN LOWER(COALESCE(c.subscription_tier, '')) = 'voice' THEN 179
    WHEN LOWER(COALESCE(c.subscription_tier, '')) = 'operations' THEN 129
    ELSE 129
  END AS amount,
  c.billing_email
FROM restaurants r
LEFT JOIN companies c ON c.id = r.company_id
WHERE NOT EXISTS (
  SELECT 1 FROM admin_billing_subscriptions abs WHERE abs.restaurant_id = r.id
);

CREATE TABLE IF NOT EXISTS admin_marketing_campaigns (
  id TEXT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  channel VARCHAR(20) NOT NULL CHECK (channel IN ('sms', 'email', 'both')),
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sent')),
  message TEXT NOT NULL,
  subject VARCHAR(255),
  audience_filter VARCHAR(100) DEFAULT 'all_customers',
  total_customers INTEGER NOT NULL DEFAULT 0,
  scheduled_at TIMESTAMP,
  sent_at TIMESTAMP,
  created_by TEXT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_marketing_campaigns_status ON admin_marketing_campaigns(status);

CREATE TABLE IF NOT EXISTS pricing_structures (
  id TEXT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(120) NOT NULL UNIQUE,
  description TEXT,
  price_monthly DECIMAL(10,2) NOT NULL,
  price_yearly DECIMAL(10,2),
  is_featured BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  features TEXT DEFAULT '[]',
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pricing_structures_active ON pricing_structures(is_active, display_order);

INSERT INTO pricing_structures (id, name, slug, description, price_monthly, price_yearly, is_featured, is_active, features, display_order)
SELECT 'plan-starter', 'Starter', 'starter', 'Get control of the basics: orders, visibility, and daily execution.', 49, 490, FALSE, TRUE, '["Core order workflows","Daily operational visibility","Standard support"]', 1
WHERE NOT EXISTS (SELECT 1 FROM pricing_structures WHERE slug = 'starter');

INSERT INTO pricing_structures (id, name, slug, description, price_monthly, price_yearly, is_featured, is_active, features, display_order)
SELECT 'plan-operations', 'Operations', 'operations', 'The full dashboard: orders, menu, marketing, inventory + receipts, staff, and integrations.', 129, 1290, TRUE, TRUE, '["Advanced reporting","Inventory + receipts","Marketing campaigns","Integrations"]', 2
WHERE NOT EXISTS (SELECT 1 FROM pricing_structures WHERE slug = 'operations');

INSERT INTO pricing_structures (id, name, slug, description, price_monthly, price_yearly, is_featured, is_active, features, display_order)
SELECT 'plan-voice', 'Voice', 'voice', 'Hands-free workflows and the AI assistant that helps your team execute faster.', 179, 1790, FALSE, TRUE, '["Voice assistant","Priority onboarding","Automation workflows"]', 3
WHERE NOT EXISTS (SELECT 1 FROM pricing_structures WHERE slug = 'voice');
