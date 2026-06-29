CREATE TABLE IF NOT EXISTS growth_operator_cycle_events (
  id TEXT PRIMARY KEY,
  cycle_mode TEXT NOT NULL DEFAULT 'read_only_snapshot',
  selected_step TEXT,
  target_campaign_id TEXT,
  target_campaign_name TEXT,
  priority INTEGER NOT NULL DEFAULT 0,
  rationale_json TEXT NOT NULL DEFAULT '[]',
  blocked_json TEXT NOT NULL DEFAULT '[]',
  recommended_command TEXT,
  readiness_json TEXT NOT NULL DEFAULT '{}',
  loop_plan_json TEXT NOT NULL DEFAULT '{}',
  counts_json TEXT NOT NULL DEFAULT '{}',
  safety_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_growth_operator_cycle_events_created ON growth_operator_cycle_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_growth_operator_cycle_events_step ON growth_operator_cycle_events(selected_step, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_growth_operator_cycle_events_campaign ON growth_operator_cycle_events(target_campaign_id, created_at DESC);
