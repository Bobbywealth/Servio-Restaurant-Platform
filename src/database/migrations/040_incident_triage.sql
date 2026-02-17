CREATE TABLE IF NOT EXISTS incident_triage (
    error_event_id TEXT PRIMARY KEY REFERENCES audit_logs(id) ON DELETE CASCADE,
    acknowledged_at TIMESTAMP,
    owner TEXT,
    resolved_at TIMESTAMP,
    note TEXT,
    runbook_link TEXT,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_incident_triage_owner ON incident_triage(owner);
CREATE INDEX IF NOT EXISTS idx_incident_triage_resolved_at ON incident_triage(resolved_at);
