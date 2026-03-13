PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  company_name TEXT NOT NULL,
  website_url TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'UNK',
  region TEXT,
  category TEXT NOT NULL DEFAULT 'other',
  discovery_source TEXT,
  contact_email TEXT,
  contact_page_url TEXT,
  has_contact_form INTEGER NOT NULL DEFAULT 0,
  signals_json TEXT NOT NULL DEFAULT '[]',
  score_fit INTEGER NOT NULL DEFAULT 0,
  score_contact INTEGER NOT NULL DEFAULT 0,
  score_risk INTEGER NOT NULL DEFAULT 0,
  score_total INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'new',
  created_at_iso TEXT NOT NULL,
  updated_at_iso TEXT NOT NULL,
  lead_class TEXT DEFAULT 'low_signal',
  all_emails_json TEXT DEFAULT '[]',
  lead_brief_json TEXT DEFAULT '{}',
  score_breakdown_json TEXT DEFAULT '{}',
  last_scanned_at_iso TEXT
);

CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_score ON leads(score_total);
CREATE INDEX IF NOT EXISTS idx_leads_class ON leads(lead_class);

CREATE TABLE IF NOT EXISTS drafts (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'email',
  subject TEXT NOT NULL,
  body_text TEXT NOT NULL,
  followup_text TEXT NOT NULL DEFAULT '',
  why_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'queued',
  created_at_iso TEXT NOT NULL,
  updated_at_iso TEXT NOT NULL,
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_drafts_status ON drafts(status);
CREATE INDEX IF NOT EXISTS idx_drafts_lead ON drafts(lead_id);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  lead_id TEXT,
  created_at_iso TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at_iso);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);

CREATE TABLE IF NOT EXISTS suppressions (
  email TEXT PRIMARY KEY,
  reason TEXT NOT NULL,
  created_at_iso TEXT NOT NULL
);
