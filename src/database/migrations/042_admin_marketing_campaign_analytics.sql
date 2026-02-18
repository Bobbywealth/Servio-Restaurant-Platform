-- Extend admin marketing campaigns with analytics and lifecycle tracking

ALTER TABLE admin_marketing_campaigns
  ADD COLUMN IF NOT EXISTS sent_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivered_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS click_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS revenue_attributed DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP;

ALTER TABLE admin_marketing_campaigns
  DROP CONSTRAINT IF EXISTS admin_marketing_campaigns_status_check;

ALTER TABLE admin_marketing_campaigns
  ADD CONSTRAINT admin_marketing_campaigns_status_check
  CHECK (status IN ('draft', 'scheduled', 'sent', 'cancelled'));

CREATE INDEX IF NOT EXISTS idx_admin_marketing_campaigns_created_at ON admin_marketing_campaigns(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_marketing_campaigns_sent_count ON admin_marketing_campaigns(sent_count DESC);
