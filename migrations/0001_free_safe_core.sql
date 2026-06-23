CREATE TABLE IF NOT EXISTS usage_counters (
  day TEXT NOT NULL,
  key TEXT NOT NULL,
  value INTEGER NOT NULL DEFAULT 0,
  updated_at_iso TEXT NOT NULL,
  PRIMARY KEY (day, key)
);

CREATE TABLE IF NOT EXISTS budget_decisions (
  id TEXT PRIMARY KEY,
  day TEXT NOT NULL,
  action TEXT NOT NULL,
  decision TEXT NOT NULL,
  reason TEXT NOT NULL,
  usage_json TEXT NOT NULL DEFAULT '{}',
  created_at_iso TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_decisions (
  id TEXT PRIMARY KEY,
  run_id TEXT,
  decision_type TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  target_url TEXT,
  reason TEXT NOT NULL,
  confidence INTEGER NOT NULL DEFAULT 50,
  evidence_json TEXT NOT NULL DEFAULT '{}',
  created_at_iso TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_leads_status_updated
ON leads(status, updated_at_iso);

CREATE INDEX IF NOT EXISTS idx_leads_website_url
ON leads(website_url);

CREATE INDEX IF NOT EXISTS idx_drafts_status_updated
ON drafts(status, updated_at_iso);

CREATE INDEX IF NOT EXISTS idx_events_created
ON events(created_at_iso);

CREATE INDEX IF NOT EXISTS idx_events_type_created
ON events(type, created_at_iso);
