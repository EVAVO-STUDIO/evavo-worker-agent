-- Patch 10A: Source Expansion Strategy Origin Yield
-- Persist saved-source origin breakdowns on strategy learning rows.

ALTER TABLE source_expansion_strategy_scores ADD COLUMN origin_saved_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE source_expansion_strategy_scores ADD COLUMN origin_query_hint_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE source_expansion_strategy_scores ADD COLUMN origin_public_link_graph_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE source_expansion_strategy_scores ADD COLUMN origin_sitemap_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE source_expansion_strategy_scores ADD COLUMN origin_source_expansion_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_source_expansion_strategy_scores_public_link_origin ON source_expansion_strategy_scores(origin_public_link_graph_count DESC, quality_score DESC);
