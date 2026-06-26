-- Patch 10B: Source Expansion Strategy Origin Yield Backfill
-- Rerunnable backfill for origin-yield columns added by 0010.
-- Run after migrations/0010_source_expansion_strategy_origin_yield.sql.

UPDATE source_expansion_strategy_scores
SET
  origin_saved_count = COALESCE((
    SELECT COUNT(*)
    FROM source_expansion_candidates c
    JOIN opportunity_sources s ON s.id = c.saved_source_id
    WHERE c.strategy = source_expansion_strategy_scores.strategy
      AND s.notes LIKE '%origin=%'
  ), 0),
  origin_query_hint_count = COALESCE((
    SELECT COUNT(*)
    FROM source_expansion_candidates c
    JOIN opportunity_sources s ON s.id = c.saved_source_id
    WHERE c.strategy = source_expansion_strategy_scores.strategy
      AND s.notes LIKE '%origin=query_hint%'
  ), 0),
  origin_public_link_graph_count = COALESCE((
    SELECT COUNT(*)
    FROM source_expansion_candidates c
    JOIN opportunity_sources s ON s.id = c.saved_source_id
    WHERE c.strategy = source_expansion_strategy_scores.strategy
      AND s.notes LIKE '%origin=public_link_graph%'
  ), 0),
  origin_sitemap_count = COALESCE((
    SELECT COUNT(*)
    FROM source_expansion_candidates c
    JOIN opportunity_sources s ON s.id = c.saved_source_id
    WHERE c.strategy = source_expansion_strategy_scores.strategy
      AND s.notes LIKE '%origin=sitemap%'
  ), 0),
  origin_source_expansion_count = COALESCE((
    SELECT COUNT(*)
    FROM source_expansion_candidates c
    JOIN opportunity_sources s ON s.id = c.saved_source_id
    WHERE c.strategy = source_expansion_strategy_scores.strategy
      AND s.notes LIKE '%origin=source_expansion%'
  ), 0);
