-- Patch 5D: Opportunity Review Learning
-- Adds review outcomes and lightweight learning scores for saved opportunities.
-- This keeps the system review-first and improves ranking without AI or sending.

CREATE TABLE IF NOT EXISTS opportunity_reviews (
  id TEXT PRIMARY KEY,
  opportunity_id TEXT NOT NULL,
  decision TEXT NOT NULL,
  reason TEXT,
  reviewer TEXT,
  value_rating INTEGER,
  fit_rating INTEGER,
  effort_rating INTEGER,
  urgency_rating INTEGER,
  notes TEXT,
  created_at_iso TEXT NOT NULL,
  FOREIGN KEY(opportunity_id) REFERENCES opportunities(id)
);

CREATE INDEX IF NOT EXISTS idx_opportunity_reviews_opportunity ON opportunity_reviews(opportunity_id, created_at_iso DESC);
CREATE INDEX IF NOT EXISTS idx_opportunity_reviews_decision ON opportunity_reviews(decision, created_at_iso DESC);

CREATE TABLE IF NOT EXISTS opportunity_strategy_scores (
  id TEXT PRIMARY KEY,
  opportunity_type TEXT NOT NULL,
  category TEXT,
  country TEXT,
  region TEXT,
  positive_count INTEGER NOT NULL DEFAULT 0,
  negative_count INTEGER NOT NULL DEFAULT 0,
  watch_count INTEGER NOT NULL DEFAULT 0,
  shortlist_count INTEGER NOT NULL DEFAULT 0,
  average_value_rating REAL NOT NULL DEFAULT 0,
  average_fit_rating REAL NOT NULL DEFAULT 0,
  average_effort_rating REAL NOT NULL DEFAULT 0,
  average_urgency_rating REAL NOT NULL DEFAULT 0,
  score INTEGER NOT NULL DEFAULT 50,
  last_decision TEXT,
  updated_at_iso TEXT NOT NULL,
  UNIQUE(opportunity_type, category, country, region)
);

CREATE INDEX IF NOT EXISTS idx_opportunity_strategy_scores_score ON opportunity_strategy_scores(score DESC, updated_at_iso DESC);
