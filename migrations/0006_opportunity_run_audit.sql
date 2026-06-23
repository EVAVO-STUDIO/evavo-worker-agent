-- Patch 6C: Opportunity Run Audit
-- Adds durable run-level and source-level audit records for opportunity discovery.

CREATE TABLE IF NOT EXISTS opportunity_runs (
  id TEXT PRIMARY KEY,
  run_type TEXT NOT NULL,
  started_at_iso TEXT NOT NULL,
  finished_at_iso TEXT,
  settings_json TEXT,
  status TEXT NOT NULL DEFAULT 'running',
  sources_checked INTEGER NOT NULL DEFAULT 0,
  candidates_found INTEGER NOT NULL DEFAULT 0,
  candidates_saved INTEGER NOT NULL DEFAULT 0,
  candidates_rejected INTEGER NOT NULL DEFAULT 0,
  duplicates INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0,
  skipped INTEGER NOT NULL DEFAULT 0,
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_opportunity_runs_started ON opportunity_runs(started_at_iso DESC);
CREATE INDEX IF NOT EXISTS idx_opportunity_runs_status ON opportunity_runs(status, started_at_iso DESC);

CREATE TABLE IF NOT EXISTS opportunity_run_source_results (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  source_id TEXT,
  source_url TEXT NOT NULL,
  fetch_status INTEGER,
  content_type TEXT,
  elapsed_ms INTEGER,
  bytes INTEGER,
  candidates_found INTEGER NOT NULL DEFAULT 0,
  candidates_saved INTEGER NOT NULL DEFAULT 0,
  candidates_rejected INTEGER NOT NULL DEFAULT 0,
  duplicates INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  created_at_iso TEXT NOT NULL,
  FOREIGN KEY(run_id) REFERENCES opportunity_runs(id)
);

CREATE INDEX IF NOT EXISTS idx_opportunity_run_source_results_run ON opportunity_run_source_results(run_id, created_at_iso DESC);
CREATE INDEX IF NOT EXISTS idx_opportunity_run_source_results_source ON opportunity_run_source_results(source_id, created_at_iso DESC);

CREATE TABLE IF NOT EXISTS opportunity_candidate_rejections (
  id TEXT PRIMARY KEY,
  run_id TEXT,
  source_id TEXT,
  source_url TEXT,
  candidate_url TEXT,
  candidate_title TEXT,
  score INTEGER,
  reason TEXT NOT NULL,
  evidence_json TEXT,
  created_at_iso TEXT NOT NULL,
  FOREIGN KEY(run_id) REFERENCES opportunity_runs(id)
);

CREATE INDEX IF NOT EXISTS idx_opportunity_candidate_rejections_run ON opportunity_candidate_rejections(run_id, created_at_iso DESC);
CREATE INDEX IF NOT EXISTS idx_opportunity_candidate_rejections_source ON opportunity_candidate_rejections(source_id, created_at_iso DESC);
CREATE INDEX IF NOT EXISTS idx_opportunity_candidate_rejections_reason ON opportunity_candidate_rejections(reason, created_at_iso DESC);
