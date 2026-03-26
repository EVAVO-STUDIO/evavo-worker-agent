-- Schema for the EVAVO outbound worker
-- This file defines all tables and indexes used by the application. Run it
-- against your D1 database using `wrangler d1 execute`.

-- Settings table stores arbitrary key/value pairs. Also used to persist
-- distributed locks when the key starts with `lock:`.
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at_iso TEXT
);

-- Leads table tracks discovered websites and the pipeline status for each.
CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  website TEXT NOT NULL,
  status TEXT NOT NULL,
  data TEXT,
  created_at_iso TEXT NOT NULL,
  updated_at_iso TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);

-- Drafts table stores email drafts prepared for leads.
CREATE TABLE IF NOT EXISTS drafts (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at_iso TEXT NOT NULL,
  updated_at_iso TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_drafts_status ON drafts(status);

-- Events table logs system actions and errors for observability.
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  meta TEXT,
  created_at_iso TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);

-- Suppression list stores unsubscribed email addresses.
CREATE TABLE IF NOT EXISTS suppression (
  email TEXT PRIMARY KEY,
  reason TEXT,
  created_at_iso TEXT NOT NULL
);