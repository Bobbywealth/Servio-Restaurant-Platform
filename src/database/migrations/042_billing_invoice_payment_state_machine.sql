-- Billing invoice state machine + secure payment request tracking

ALTER TABLE company_billing_history
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE company_billing_history
  ADD COLUMN IF NOT EXISTS payment_method_status TEXT DEFAULT 'unavailable';

ALTER TABLE company_billing_history
  ADD COLUMN IF NOT EXISTS last_payment_attempt_at TIMESTAMP;

ALTER TABLE company_billing_history
  ADD COLUMN IF NOT EXISTS last_payment_attempt_status TEXT;

ALTER TABLE company_billing_history
  ADD COLUMN IF NOT EXISTS last_payment_attempt_error TEXT;

ALTER TABLE company_billing_history
  ADD COLUMN IF NOT EXISTS payment_provider_session_id TEXT;

ALTER TABLE company_billing_history
  ADD COLUMN IF NOT EXISTS payment_link_token TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_company_billing_history_status'
  ) THEN
    ALTER TABLE company_billing_history
      ADD CONSTRAINT chk_company_billing_history_status
      CHECK (status IN ('pending', 'requires_action', 'paid', 'failed', 'voided'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_company_billing_history_status ON company_billing_history(status);
CREATE INDEX IF NOT EXISTS idx_company_billing_history_last_attempt ON company_billing_history(last_payment_attempt_at DESC);

CREATE TABLE IF NOT EXISTS admin_billing_payment_requests (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL REFERENCES company_billing_history(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('collect_payment', 'send_payment_link', 'mark_paid', 'void')),
  idempotency_key TEXT NOT NULL,
  result_status TEXT NOT NULL,
  response_payload JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(invoice_id, action, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_admin_billing_payment_requests_invoice ON admin_billing_payment_requests(invoice_id, created_at DESC);
