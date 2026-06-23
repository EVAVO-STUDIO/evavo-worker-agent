CREATE TABLE IF NOT EXISTS draft_reviews (
  id TEXT PRIMARY KEY,
  draft_id TEXT NOT NULL,
  lead_id TEXT NOT NULL,
  decision TEXT NOT NULL,
  reason TEXT,
  notes TEXT,
  created_at_iso TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS strategy_scores (
  strategy_key TEXT PRIMARY KEY,
  approved_count INTEGER NOT NULL DEFAULT 0,
  rejected_count INTEGER NOT NULL DEFAULT 0,
  rewrite_count INTEGER NOT NULL DEFAULT 0,
  score INTEGER NOT NULL DEFAULT 50,
  updated_at_iso TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_draft_reviews_draft_created ON draft_reviews(draft_id, created_at_iso);
CREATE INDEX IF NOT EXISTS idx_draft_reviews_lead_created ON draft_reviews(lead_id, created_at_iso);
CREATE INDEX IF NOT EXISTS idx_strategy_scores_score ON strategy_scores(score, updated_at_iso);
