-- Run once against an existing D1 database before deploying the updated worker.
ALTER TABLE suppression RENAME TO suppressions;
ALTER TABLE leads ADD COLUMN lead_class TEXT DEFAULT 'low_signal';
ALTER TABLE leads ADD COLUMN all_emails_json TEXT DEFAULT '[]';
ALTER TABLE leads ADD COLUMN lead_brief_json TEXT DEFAULT '{}';
ALTER TABLE leads ADD COLUMN score_breakdown_json TEXT DEFAULT '{}';
ALTER TABLE leads ADD COLUMN last_scanned_at_iso TEXT;
CREATE INDEX IF NOT EXISTS idx_leads_class ON leads(lead_class);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
