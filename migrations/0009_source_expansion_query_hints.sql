-- Patch 9I: Source Expansion Query Hints
-- Durable, explainable search-style hints for finding new source pages without user-provided lists.

CREATE TABLE IF NOT EXISTS source_expansion_query_hints (
  id TEXT PRIMARY KEY,
  query_text TEXT NOT NULL UNIQUE,
  strategy TEXT NOT NULL,
  country TEXT,
  region TEXT,
  category TEXT,
  intent TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'candidate',
  score INTEGER NOT NULL DEFAULT 50,
  confidence TEXT NOT NULL DEFAULT 'medium',
  search_url TEXT,
  reasons_json TEXT,
  evidence_json TEXT,
  seen_count INTEGER NOT NULL DEFAULT 1,
  used_count INTEGER NOT NULL DEFAULT 0,
  result_count INTEGER NOT NULL DEFAULT 0,
  created_at_iso TEXT NOT NULL,
  updated_at_iso TEXT NOT NULL,
  last_used_at_iso TEXT,
  next_review_at_iso TEXT,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_source_expansion_query_hints_status_score ON source_expansion_query_hints(status, score DESC, updated_at_iso DESC);
CREATE INDEX IF NOT EXISTS idx_source_expansion_query_hints_strategy ON source_expansion_query_hints(strategy, score DESC);
