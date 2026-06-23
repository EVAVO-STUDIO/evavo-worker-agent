CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL UNIQUE,
  source_type TEXT NOT NULL,
  label TEXT,
  country TEXT,
  region TEXT,
  category TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  quality_score INTEGER NOT NULL DEFAULT 50,
  failure_count INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  last_run_at_iso TEXT,
  next_run_at_iso TEXT,
  cooldown_until_iso TEXT,
  retired_reason TEXT,
  created_at_iso TEXT NOT NULL,
  updated_at_iso TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS source_runs (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at_iso TEXT NOT NULL,
  completed_at_iso TEXT,
  profiles_found INTEGER NOT NULL DEFAULT 0,
  external_sites_found INTEGER NOT NULL DEFAULT 0,
  leads_inserted INTEGER NOT NULL DEFAULT 0,
  duplicates_skipped INTEGER NOT NULL DEFAULT 0,
  failed_reason TEXT,
  created_at_iso TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS lead_discoveries (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL,
  source_id TEXT,
  source_run_id TEXT,
  discovered_url TEXT NOT NULL,
  created_at_iso TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS source_scores (
  source_id TEXT PRIMARY KEY,
  profile_yield REAL NOT NULL DEFAULT 0,
  website_yield REAL NOT NULL DEFAULT 0,
  qualified_yield REAL NOT NULL DEFAULT 0,
  draft_yield REAL NOT NULL DEFAULT 0,
  rejection_rate REAL NOT NULL DEFAULT 0,
  failure_rate REAL NOT NULL DEFAULT 0,
  updated_at_iso TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sources_status_next_run ON sources(status, next_run_at_iso);
CREATE INDEX IF NOT EXISTS idx_sources_url ON sources(url);
CREATE INDEX IF NOT EXISTS idx_source_runs_source_started ON source_runs(source_id, started_at_iso);
CREATE INDEX IF NOT EXISTS idx_lead_discoveries_lead ON lead_discoveries(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_discoveries_source ON lead_discoveries(source_id);
