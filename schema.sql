-- LEGACY BOOTSTRAP SCHEMA ONLY.
--
-- Do not apply this file to the live or an already-migrated D1 database.
-- The production database has evolved through the ordered files under
-- migrations/, and active Worker code expects the expanded migrated schema.
--
-- This file is retained only to describe the earliest bootstrap shape for
-- historical/local recovery work. New environments must use the documented,
-- reviewed migration process in migrations/README.md. Never use this file as
-- a reset, repair, reconciliation or production migration script.

-- Historical settings table. The migrated database may contain additional
-- operational and compatibility values.
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at_iso TEXT
);

-- Historical compact leads shape. Active code expects the expanded migrated
-- leads table, including website_url, scoring, contact and classification
-- fields. This definition is not sufficient for the current Worker runtime.
CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  website TEXT NOT NULL,
  status TEXT NOT NULL,
  data TEXT,
  created_at_iso TEXT NOT NULL,
  updated_at_iso TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);

-- Historical compact drafts shape. Active code expects the expanded migrated
-- drafts table. Historical statuses such as approved, sent, failed and
-- rejected remain readable data states; they do not indicate active outbound
-- capability.
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

-- Historical compact event shape. Active code expects the migrated event
-- columns and later append-only audit tables.
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  meta TEXT,
  created_at_iso TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);

-- Historical suppression records are retained for compliance and reporting.
CREATE TABLE IF NOT EXISTS suppression (
  email TEXT PRIMARY KEY,
  reason TEXT,
  created_at_iso TEXT NOT NULL
);
