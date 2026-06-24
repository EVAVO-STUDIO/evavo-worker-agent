-- Patch 9F: Source Expansion Strategy Quality
-- Aggregated learning signals for expansion strategies.

CREATE TABLE IF NOT EXISTS source_expansion_strategy_scores (
  strategy TEXT PRIMARY KEY,
  candidate_count INTEGER NOT NULL DEFAULT 0,
  saved_count INTEGER NOT NULL DEFAULT 0,
  duplicate_count INTEGER NOT NULL DEFAULT 0,
  failure_count INTEGER NOT NULL DEFAULT 0,
  source_count INTEGER NOT NULL DEFAULT 0,
  source_success_count INTEGER NOT NULL DEFAULT 0,
  source_failure_count INTEGER NOT NULL DEFAULT 0,
  opportunity_count INTEGER NOT NULL DEFAULT 0,
  shortlisted_count INTEGER NOT NULL DEFAULT 0,
  rejected_count INTEGER NOT NULL DEFAULT 0,
  average_candidate_score REAL NOT NULL DEFAULT 0,
  average_source_priority REAL NOT NULL DEFAULT 0,
  quality_score INTEGER NOT NULL DEFAULT 50,
  recommendation TEXT,
  last_learned_at_iso TEXT,
  created_at_iso TEXT NOT NULL,
  updated_at_iso TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_source_expansion_strategy_scores_quality ON source_expansion_strategy_scores(quality_score DESC, updated_at_iso DESC);
