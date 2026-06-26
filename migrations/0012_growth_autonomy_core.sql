-- 0012_growth_autonomy_core.sql
-- Adds the core data model for the EVAVO Growth Autonomy Agent.
-- This migration is additive only. It does not enable sending, posting, form submission, or public execution.

CREATE TABLE IF NOT EXISTS growth_goals (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  service_focus TEXT NOT NULL DEFAULT '[]',
  audience_focus TEXT NOT NULL DEFAULT '[]',
  region_focus TEXT NOT NULL DEFAULT '[]',
  campaign_name TEXT,
  priority INTEGER NOT NULL DEFAULT 50,
  status TEXT NOT NULL DEFAULT 'active',
  budget_profile_id TEXT NOT NULL DEFAULT 'free_safe',
  automation_mode TEXT NOT NULL DEFAULT 'observe',
  active_from TEXT,
  active_until TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_growth_goals_status_priority
  ON growth_goals(status, priority DESC, updated_at DESC);

CREATE TABLE IF NOT EXISTS growth_channels (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL,
  channel_type TEXT NOT NULL,
  channel_class TEXT NOT NULL,
  name TEXT NOT NULL,
  url TEXT,
  rules_url TEXT,
  automation_mode TEXT NOT NULL DEFAULT 'observe',
  link_policy TEXT NOT NULL DEFAULT 'approval_required',
  disclosure_policy TEXT NOT NULL DEFAULT 'required_when_promotional',
  execution_policy TEXT NOT NULL DEFAULT 'confirm_required',
  max_actions_per_day INTEGER NOT NULL DEFAULT 0,
  max_actions_per_week INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  cooldown_until TEXT,
  last_action_at TEXT,
  positive_outcome_count INTEGER NOT NULL DEFAULT 0,
  negative_outcome_count INTEGER NOT NULL DEFAULT 0,
  removal_count INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  rule_evidence TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_growth_channels_class_status
  ON growth_channels(channel_class, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_growth_channels_platform_status
  ON growth_channels(platform, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS growth_channel_rules (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  rule_type TEXT NOT NULL,
  value TEXT NOT NULL,
  source_url TEXT,
  confidence INTEGER NOT NULL DEFAULT 50,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(channel_id) REFERENCES growth_channels(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_growth_channel_rules_channel_type
  ON growth_channel_rules(channel_id, rule_type, status);

CREATE TABLE IF NOT EXISTS growth_signals (
  id TEXT PRIMARY KEY,
  goal_id TEXT,
  channel_id TEXT,
  source_url TEXT NOT NULL,
  source_title TEXT,
  signal_type TEXT NOT NULL,
  service_match TEXT NOT NULL DEFAULT '[]',
  audience_match TEXT NOT NULL DEFAULT '[]',
  evidence TEXT NOT NULL,
  urgency INTEGER NOT NULL DEFAULT 50,
  fit_score INTEGER NOT NULL DEFAULT 0,
  risk_score INTEGER NOT NULL DEFAULT 50,
  cost_score INTEGER NOT NULL DEFAULT 100,
  status TEXT NOT NULL DEFAULT 'new',
  duplicate_key TEXT,
  discovered_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(goal_id) REFERENCES growth_goals(id) ON DELETE SET NULL,
  FOREIGN KEY(channel_id) REFERENCES growth_channels(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_growth_signals_status_fit
  ON growth_signals(status, fit_score DESC, discovered_at DESC);

CREATE INDEX IF NOT EXISTS idx_growth_signals_goal_status
  ON growth_signals(goal_id, status, fit_score DESC);

CREATE INDEX IF NOT EXISTS idx_growth_signals_channel_status
  ON growth_signals(channel_id, status, discovered_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_growth_signals_duplicate_key
  ON growth_signals(duplicate_key)
  WHERE duplicate_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS growth_actions (
  id TEXT PRIMARY KEY,
  signal_id TEXT,
  channel_id TEXT,
  action_type TEXT NOT NULL,
  recommended_mode TEXT NOT NULL DEFAULT 'observe',
  reason TEXT NOT NULL,
  context_evidence TEXT,
  evavo_fit_explanation TEXT,
  channel_policy_result TEXT NOT NULL DEFAULT '{}',
  link_policy_result TEXT NOT NULL DEFAULT '{}',
  disclosure_policy_result TEXT NOT NULL DEFAULT '{}',
  cost_estimate TEXT NOT NULL DEFAULT '{}',
  risk_flags TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'queued',
  approved_by TEXT,
  approved_at TEXT,
  executed_at TEXT,
  blocked_reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(signal_id) REFERENCES growth_signals(id) ON DELETE SET NULL,
  FOREIGN KEY(channel_id) REFERENCES growth_channels(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_growth_actions_status_type
  ON growth_actions(status, action_type, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_growth_actions_signal
  ON growth_actions(signal_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_growth_actions_channel
  ON growth_actions(channel_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS growth_drafts (
  id TEXT PRIMARY KEY,
  action_id TEXT NOT NULL,
  variant TEXT NOT NULL,
  subject TEXT,
  body TEXT NOT NULL,
  specificity_score INTEGER NOT NULL DEFAULT 0,
  evavo_voice_score INTEGER NOT NULL DEFAULT 0,
  generic_risk_score INTEGER NOT NULL DEFAULT 100,
  usefulness_score INTEGER NOT NULL DEFAULT 0,
  link_risk_score INTEGER NOT NULL DEFAULT 100,
  disclosure_status TEXT NOT NULL DEFAULT 'unknown',
  banned_phrase_hits TEXT NOT NULL DEFAULT '[]',
  reusable_elsewhere INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'drafted',
  reviewer_notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(action_id) REFERENCES growth_actions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_growth_drafts_action_status
  ON growth_drafts(action_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_growth_drafts_quality
  ON growth_drafts(status, evavo_voice_score DESC, specificity_score DESC, updated_at DESC);

CREATE TABLE IF NOT EXISTS growth_outcomes (
  id TEXT PRIMARY KEY,
  action_id TEXT,
  channel_id TEXT,
  outcome_type TEXT NOT NULL,
  outcome_detail TEXT,
  reply_text TEXT,
  click_count INTEGER NOT NULL DEFAULT 0,
  lead_created INTEGER NOT NULL DEFAULT 0,
  removed_or_flagged INTEGER NOT NULL DEFAULT 0,
  negative_reaction INTEGER NOT NULL DEFAULT 0,
  occurred_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(action_id) REFERENCES growth_actions(id) ON DELETE SET NULL,
  FOREIGN KEY(channel_id) REFERENCES growth_channels(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_growth_outcomes_action
  ON growth_outcomes(action_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_growth_outcomes_channel_type
  ON growth_outcomes(channel_id, outcome_type, occurred_at DESC);

CREATE TABLE IF NOT EXISTS growth_budget_ledger (
  id TEXT PRIMARY KEY,
  budget_date TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  worker_invocations INTEGER NOT NULL DEFAULT 0,
  cpu_ms_estimate INTEGER NOT NULL DEFAULT 0,
  d1_rows_read INTEGER NOT NULL DEFAULT 0,
  d1_rows_written INTEGER NOT NULL DEFAULT 0,
  network_fetches INTEGER NOT NULL DEFAULT 0,
  ai_calls INTEGER NOT NULL DEFAULT 0,
  draft_generations INTEGER NOT NULL DEFAULT 0,
  public_actions_executed INTEGER NOT NULL DEFAULT 0,
  contact_actions_executed INTEGER NOT NULL DEFAULT 0,
  retries INTEGER NOT NULL DEFAULT 0,
  errors INTEGER NOT NULL DEFAULT 0,
  estimated_cost_cents INTEGER NOT NULL DEFAULT 0,
  hard_stop_reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_growth_budget_ledger_date_profile
  ON growth_budget_ledger(budget_date, profile_id);

CREATE TABLE IF NOT EXISTS growth_suppression_rules (
  id TEXT PRIMARY KEY,
  rule_type TEXT NOT NULL,
  value TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_growth_suppression_rules_type_status
  ON growth_suppression_rules(rule_type, status, updated_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_growth_suppression_rules_unique_active
  ON growth_suppression_rules(rule_type, value)
  WHERE status = 'active';
