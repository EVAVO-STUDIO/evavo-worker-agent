-- Patch 9D: Source Expansion Memory
-- Durable memory for continuous, bounded, review-first source discovery.

CREATE TABLE IF NOT EXISTS source_expansion_seeds (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL UNIQUE,
  label TEXT,
  strategy TEXT NOT NULL,
  country TEXT,
  region TEXT,
  category TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  priority INTEGER NOT NULL DEFAULT 50,
  depth INTEGER NOT NULL DEFAULT 0,
  parent_seed_id TEXT,
  last_run_at_iso TEXT,
  next_run_at_iso TEXT,
  cooldown_until_iso TEXT,
  success_count INTEGER NOT NULL DEFAULT 0,
  failure_count INTEGER NOT NULL DEFAULT 0,
  candidate_count INTEGER NOT NULL DEFAULT 0,
  saved_count INTEGER NOT NULL DEFAULT 0,
  rejected_count INTEGER NOT NULL DEFAULT 0,
  duplicate_count INTEGER NOT NULL DEFAULT 0,
  quality_score INTEGER NOT NULL DEFAULT 50,
  notes TEXT,
  created_at_iso TEXT NOT NULL,
  updated_at_iso TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_source_expansion_seeds_due ON source_expansion_seeds(status, next_run_at_iso, priority DESC);
CREATE INDEX IF NOT EXISTS idx_source_expansion_seeds_strategy ON source_expansion_seeds(strategy, status, priority DESC);
CREATE INDEX IF NOT EXISTS idx_source_expansion_seeds_quality ON source_expansion_seeds(quality_score DESC, updated_at_iso DESC);

CREATE TABLE IF NOT EXISTS source_expansion_candidates (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL UNIQUE,
  domain TEXT NOT NULL,
  label TEXT,
  source_type TEXT,
  country TEXT,
  region TEXT,
  category TEXT,
  status TEXT NOT NULL DEFAULT 'candidate',
  score INTEGER NOT NULL DEFAULT 0,
  confidence TEXT NOT NULL DEFAULT 'low',
  strategy TEXT,
  seed_id TEXT,
  discovery_depth INTEGER NOT NULL DEFAULT 0,
  reasons_json TEXT,
  evidence_json TEXT,
  first_seen_at_iso TEXT NOT NULL,
  last_seen_at_iso TEXT NOT NULL,
  next_review_at_iso TEXT,
  reviewed_at_iso TEXT,
  saved_source_id TEXT,
  rejection_reason TEXT,
  seen_count INTEGER NOT NULL DEFAULT 1,
  duplicate_count INTEGER NOT NULL DEFAULT 0,
  failure_count INTEGER NOT NULL DEFAULT 0,
  quality_score INTEGER NOT NULL DEFAULT 50
);

CREATE INDEX IF NOT EXISTS idx_source_expansion_candidates_status ON source_expansion_candidates(status, score DESC, last_seen_at_iso DESC);
CREATE INDEX IF NOT EXISTS idx_source_expansion_candidates_domain ON source_expansion_candidates(domain, status);
CREATE INDEX IF NOT EXISTS idx_source_expansion_candidates_strategy ON source_expansion_candidates(strategy, status, score DESC);
CREATE INDEX IF NOT EXISTS idx_source_expansion_candidates_seed ON source_expansion_candidates(seed_id, last_seen_at_iso DESC);

CREATE TABLE IF NOT EXISTS source_expansion_runs (
  id TEXT PRIMARY KEY,
  run_type TEXT NOT NULL,
  strategy TEXT,
  started_at_iso TEXT NOT NULL,
  finished_at_iso TEXT,
  status TEXT NOT NULL DEFAULT 'running',
  seeds_checked INTEGER NOT NULL DEFAULT 0,
  pages_fetched INTEGER NOT NULL DEFAULT 0,
  links_found INTEGER NOT NULL DEFAULT 0,
  candidates_found INTEGER NOT NULL DEFAULT 0,
  candidates_new INTEGER NOT NULL DEFAULT 0,
  candidates_updated INTEGER NOT NULL DEFAULT 0,
  candidates_rejected INTEGER NOT NULL DEFAULT 0,
  skipped INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0,
  settings_json TEXT,
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_source_expansion_runs_started ON source_expansion_runs(started_at_iso DESC);
CREATE INDEX IF NOT EXISTS idx_source_expansion_runs_status ON source_expansion_runs(status, started_at_iso DESC);

CREATE TABLE IF NOT EXISTS source_expansion_attempts (
  id TEXT PRIMARY KEY,
  run_id TEXT,
  seed_id TEXT,
  seed_url TEXT,
  strategy TEXT,
  fetch_status INTEGER,
  content_type TEXT,
  elapsed_ms INTEGER,
  bytes INTEGER,
  links_found INTEGER NOT NULL DEFAULT 0,
  candidates_found INTEGER NOT NULL DEFAULT 0,
  candidates_new INTEGER NOT NULL DEFAULT 0,
  candidates_updated INTEGER NOT NULL DEFAULT 0,
  candidates_rejected INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  created_at_iso TEXT NOT NULL,
  FOREIGN KEY(run_id) REFERENCES source_expansion_runs(id)
);

CREATE INDEX IF NOT EXISTS idx_source_expansion_attempts_run ON source_expansion_attempts(run_id, created_at_iso DESC);
CREATE INDEX IF NOT EXISTS idx_source_expansion_attempts_seed ON source_expansion_attempts(seed_id, created_at_iso DESC);

CREATE TABLE IF NOT EXISTS source_expansion_rejections (
  id TEXT PRIMARY KEY,
  run_id TEXT,
  seed_id TEXT,
  source_url TEXT,
  candidate_url TEXT,
  reason TEXT NOT NULL,
  evidence_json TEXT,
  created_at_iso TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_source_expansion_rejections_reason ON source_expansion_rejections(reason, created_at_iso DESC);
CREATE INDEX IF NOT EXISTS idx_source_expansion_rejections_seed ON source_expansion_rejections(seed_id, created_at_iso DESC);
