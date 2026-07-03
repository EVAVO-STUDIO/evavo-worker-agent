CREATE TABLE IF NOT EXISTS growth_research_runs (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status TEXT NOT NULL DEFAULT 'planned',
  mode TEXT NOT NULL DEFAULT 'zero_source_discovery',
  objective TEXT NOT NULL,
  industry_focus TEXT,
  geo_focus TEXT,
  service_focus TEXT,
  candidate_limit INTEGER NOT NULL DEFAULT 25,
  crawl_budget_json TEXT NOT NULL DEFAULT '{}',
  blocked_actions_json TEXT NOT NULL DEFAULT '[]',
  scoring_rubric_json TEXT NOT NULL DEFAULT '{}',
  safety_json TEXT NOT NULL DEFAULT '{}',
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_growth_research_runs_status_created ON growth_research_runs(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_growth_research_runs_mode_created ON growth_research_runs(mode, created_at DESC);

CREATE TABLE IF NOT EXISTS growth_source_candidates (
  id TEXT PRIMARY KEY,
  research_run_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status TEXT NOT NULL DEFAULT 'planned',
  domain TEXT NOT NULL,
  url TEXT NOT NULL,
  canonical_url TEXT,
  source_type TEXT NOT NULL DEFAULT 'unknown',
  discovery_method TEXT NOT NULL DEFAULT 'planned',
  discovery_query TEXT,
  industry_hint TEXT,
  geo_hint TEXT,
  service_match_hint TEXT,
  robots_status TEXT NOT NULL DEFAULT 'unknown',
  crawl_allowed INTEGER NOT NULL DEFAULT 0,
  fit_score REAL NOT NULL DEFAULT 0,
  need_score REAL NOT NULL DEFAULT 0,
  confidence_score REAL NOT NULL DEFAULT 0,
  risk_flags_json TEXT NOT NULL DEFAULT '[]',
  evidence_summary TEXT,
  FOREIGN KEY (research_run_id) REFERENCES growth_research_runs(id)
);

CREATE INDEX IF NOT EXISTS idx_growth_source_candidates_run_status ON growth_source_candidates(research_run_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_growth_source_candidates_domain ON growth_source_candidates(domain);
CREATE INDEX IF NOT EXISTS idx_growth_source_candidates_scores ON growth_source_candidates(fit_score DESC, need_score DESC, confidence_score DESC);

CREATE TABLE IF NOT EXISTS growth_robots_cache (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  domain TEXT NOT NULL UNIQUE,
  robots_url TEXT NOT NULL,
  robots_status TEXT NOT NULL DEFAULT 'unknown',
  crawl_allowed INTEGER NOT NULL DEFAULT 0,
  crawl_delay_seconds INTEGER,
  policy_reason TEXT,
  checked_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_growth_robots_cache_domain ON growth_robots_cache(domain);
CREATE INDEX IF NOT EXISTS idx_growth_robots_cache_status ON growth_robots_cache(robots_status, checked_at DESC);

CREATE TABLE IF NOT EXISTS growth_fetch_queue (
  id TEXT PRIMARY KEY,
  candidate_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status TEXT NOT NULL DEFAULT 'queued',
  url TEXT NOT NULL,
  purpose TEXT NOT NULL DEFAULT 'research',
  max_bytes INTEGER NOT NULL DEFAULT 250000,
  max_redirects INTEGER NOT NULL DEFAULT 3,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  safety_json TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY (candidate_id) REFERENCES growth_source_candidates(id)
);

CREATE INDEX IF NOT EXISTS idx_growth_fetch_queue_status_created ON growth_fetch_queue(status, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_growth_fetch_queue_candidate ON growth_fetch_queue(candidate_id, created_at DESC);

CREATE TABLE IF NOT EXISTS growth_discovered_pages (
  id TEXT PRIMARY KEY,
  candidate_id TEXT NOT NULL,
  fetch_queue_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  url TEXT NOT NULL,
  final_url TEXT,
  status_code INTEGER,
  content_type TEXT,
  title TEXT,
  meta_description TEXT,
  canonical_url TEXT,
  extracted_text_summary TEXT,
  risk_flags_json TEXT NOT NULL DEFAULT '[]',
  safety_json TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY (candidate_id) REFERENCES growth_source_candidates(id),
  FOREIGN KEY (fetch_queue_id) REFERENCES growth_fetch_queue(id)
);

CREATE INDEX IF NOT EXISTS idx_growth_discovered_pages_candidate ON growth_discovered_pages(candidate_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_growth_discovered_pages_url ON growth_discovered_pages(url);

CREATE TABLE IF NOT EXISTS growth_extracted_signals (
  id TEXT PRIMARY KEY,
  candidate_id TEXT NOT NULL,
  page_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  signal_type TEXT NOT NULL,
  signal_value TEXT NOT NULL,
  evidence_text TEXT,
  confidence REAL NOT NULL DEFAULT 0,
  freshness_hint TEXT,
  risk_flags_json TEXT NOT NULL DEFAULT '[]',
  FOREIGN KEY (candidate_id) REFERENCES growth_source_candidates(id),
  FOREIGN KEY (page_id) REFERENCES growth_discovered_pages(id)
);

CREATE INDEX IF NOT EXISTS idx_growth_extracted_signals_candidate ON growth_extracted_signals(candidate_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_growth_extracted_signals_type ON growth_extracted_signals(signal_type, confidence DESC);

CREATE TABLE IF NOT EXISTS growth_opportunity_scores (
  id TEXT PRIMARY KEY,
  candidate_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fit_score REAL NOT NULL DEFAULT 0,
  need_score REAL NOT NULL DEFAULT 0,
  urgency_score REAL NOT NULL DEFAULT 0,
  budget_likelihood_score REAL NOT NULL DEFAULT 0,
  contactability_score REAL NOT NULL DEFAULT 0,
  website_weakness_score REAL NOT NULL DEFAULT 0,
  strategic_value_score REAL NOT NULL DEFAULT 0,
  confidence_score REAL NOT NULL DEFAULT 0,
  evidence_quality_score REAL NOT NULL DEFAULT 0,
  crawl_safety_score REAL NOT NULL DEFAULT 0,
  evidence_json TEXT NOT NULL DEFAULT '[]',
  rationale TEXT,
  FOREIGN KEY (candidate_id) REFERENCES growth_source_candidates(id)
);

CREATE INDEX IF NOT EXISTS idx_growth_opportunity_scores_candidate ON growth_opportunity_scores(candidate_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_growth_opportunity_scores_rank ON growth_opportunity_scores(strategic_value_score DESC, confidence_score DESC);

CREATE TABLE IF NOT EXISTS growth_agent_decisions (
  id TEXT PRIMARY KEY,
  candidate_id TEXT,
  research_run_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  decision_type TEXT NOT NULL,
  reason TEXT NOT NULL,
  evidence_json TEXT NOT NULL DEFAULT '[]',
  blocked_actions_json TEXT NOT NULL DEFAULT '[]',
  next_internal_step TEXT,
  confidence REAL NOT NULL DEFAULT 0,
  safety_json TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY (candidate_id) REFERENCES growth_source_candidates(id),
  FOREIGN KEY (research_run_id) REFERENCES growth_research_runs(id)
);

CREATE INDEX IF NOT EXISTS idx_growth_agent_decisions_candidate ON growth_agent_decisions(candidate_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_growth_agent_decisions_run ON growth_agent_decisions(research_run_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_growth_agent_decisions_type ON growth_agent_decisions(decision_type, confidence DESC);

CREATE TABLE IF NOT EXISTS growth_discovery_feedback (
  id TEXT PRIMARY KEY,
  candidate_id TEXT,
  research_run_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  feedback_type TEXT NOT NULL,
  feedback_note TEXT,
  reviewer TEXT,
  learning_json TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY (candidate_id) REFERENCES growth_source_candidates(id),
  FOREIGN KEY (research_run_id) REFERENCES growth_research_runs(id)
);

CREATE INDEX IF NOT EXISTS idx_growth_discovery_feedback_candidate ON growth_discovery_feedback(candidate_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_growth_discovery_feedback_type ON growth_discovery_feedback(feedback_type, created_at DESC);
