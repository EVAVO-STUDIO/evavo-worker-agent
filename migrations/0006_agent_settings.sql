CREATE TABLE IF NOT EXISTS agent_settings (
  id TEXT PRIMARY KEY,
  mode TEXT NOT NULL DEFAULT 'free_safe_autonomy',
  engine_enabled INTEGER NOT NULL DEFAULT 0,
  free_safe_only INTEGER NOT NULL DEFAULT 1,
  opportunity_enabled INTEGER NOT NULL DEFAULT 1,
  lead_enabled INTEGER NOT NULL DEFAULT 0,
  draft_enabled INTEGER NOT NULL DEFAULT 0,
  send_enabled INTEGER NOT NULL DEFAULT 0,
  daily_source_limit INTEGER NOT NULL DEFAULT 10,
  max_network_calls_per_run INTEGER NOT NULL DEFAULT 20,
  min_opportunity_score INTEGER NOT NULL DEFAULT 45,
  min_lead_score INTEGER NOT NULL DEFAULT 55,
  max_saved_items_per_run INTEGER NOT NULL DEFAULT 25,
  cooldown_hours_after_failure INTEGER NOT NULL DEFAULT 6,
  review_required INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  created_at_iso TEXT NOT NULL,
  updated_at_iso TEXT NOT NULL
);

INSERT OR IGNORE INTO agent_settings (
  id, mode, engine_enabled, free_safe_only, opportunity_enabled, lead_enabled, draft_enabled, send_enabled,
  daily_source_limit, max_network_calls_per_run, min_opportunity_score, min_lead_score,
  max_saved_items_per_run, cooldown_hours_after_failure, review_required, notes, created_at_iso, updated_at_iso
) VALUES (
  'default', 'free_safe_autonomy', 0, 1, 1, 0, 0, 0,
  10, 20, 45, 55,
  25, 6, 1, 'Conservative defaults.', datetime('now'), datetime('now')
);
