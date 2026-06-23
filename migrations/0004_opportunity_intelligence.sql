-- Patch 5A: Opportunity Intelligence
-- Tracks special opportunities separately from outbound leads.
-- Examples: grants, government funding, tenders, RFPs, awards, partnership openings,
-- accelerator programs, directories, sponsorships, procurement panels, and timing triggers.

CREATE TABLE IF NOT EXISTS opportunity_sources (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL UNIQUE,
  label TEXT,
  source_type TEXT NOT NULL DEFAULT 'opportunity_directory',
  country TEXT,
  region TEXT,
  category TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  priority INTEGER NOT NULL DEFAULT 50,
  success_count INTEGER NOT NULL DEFAULT 0,
  failure_count INTEGER NOT NULL DEFAULT 0,
  last_run_at_iso TEXT,
  next_run_at_iso TEXT,
  cooldown_until_iso TEXT,
  last_error TEXT,
  notes TEXT,
  created_at_iso TEXT NOT NULL,
  updated_at_iso TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_opportunity_sources_status_priority ON opportunity_sources(status, priority, updated_at_iso);
CREATE INDEX IF NOT EXISTS idx_opportunity_sources_type ON opportunity_sources(source_type, country, region, category);

CREATE TABLE IF NOT EXISTS opportunities (
  id TEXT PRIMARY KEY,
  source_id TEXT,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  opportunity_type TEXT NOT NULL DEFAULT 'unknown',
  issuer TEXT,
  country TEXT,
  region TEXT,
  category TEXT,
  amount_text TEXT,
  estimated_value_cents INTEGER,
  currency TEXT,
  opens_at_iso TEXT,
  closes_at_iso TEXT,
  discovered_at_iso TEXT NOT NULL,
  updated_at_iso TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  fit_score INTEGER NOT NULL DEFAULT 0,
  urgency_score INTEGER NOT NULL DEFAULT 0,
  value_score INTEGER NOT NULL DEFAULT 0,
  effort_score INTEGER NOT NULL DEFAULT 0,
  risk_score INTEGER NOT NULL DEFAULT 0,
  total_score INTEGER NOT NULL DEFAULT 0,
  confidence TEXT NOT NULL DEFAULT 'low',
  summary TEXT,
  eligibility_summary TEXT,
  recommended_action TEXT,
  evidence_json TEXT,
  notes TEXT,
  UNIQUE(url, title),
  FOREIGN KEY(source_id) REFERENCES opportunity_sources(id)
);

CREATE INDEX IF NOT EXISTS idx_opportunities_status_score ON opportunities(status, total_score DESC, updated_at_iso DESC);
CREATE INDEX IF NOT EXISTS idx_opportunities_type ON opportunities(opportunity_type, country, region, category);
CREATE INDEX IF NOT EXISTS idx_opportunities_closes ON opportunities(closes_at_iso, status);
CREATE INDEX IF NOT EXISTS idx_opportunities_source ON opportunities(source_id, discovered_at_iso DESC);

CREATE TABLE IF NOT EXISTS opportunity_matches (
  id TEXT PRIMARY KEY,
  opportunity_id TEXT NOT NULL,
  target_type TEXT NOT NULL DEFAULT 'evavo',
  target_id TEXT,
  match_status TEXT NOT NULL DEFAULT 'new',
  fit_reason TEXT,
  disqualifiers_json TEXT,
  next_steps_json TEXT,
  created_at_iso TEXT NOT NULL,
  updated_at_iso TEXT NOT NULL,
  FOREIGN KEY(opportunity_id) REFERENCES opportunities(id)
);

CREATE INDEX IF NOT EXISTS idx_opportunity_matches_status ON opportunity_matches(match_status, updated_at_iso DESC);
CREATE INDEX IF NOT EXISTS idx_opportunity_matches_opportunity ON opportunity_matches(opportunity_id);
