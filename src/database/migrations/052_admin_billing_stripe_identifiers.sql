-- Persist Stripe identifiers for subscription lifecycle reconciliation.
-- Used as fallback when webhook subscription metadata is missing.

ALTER TABLE admin_billing_subscriptions
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

ALTER TABLE admin_billing_subscriptions
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

CREATE INDEX IF NOT EXISTS idx_admin_billing_subscriptions_stripe_customer_id
  ON admin_billing_subscriptions(stripe_customer_id);

CREATE INDEX IF NOT EXISTS idx_admin_billing_subscriptions_stripe_subscription_id
  ON admin_billing_subscriptions(stripe_subscription_id);
