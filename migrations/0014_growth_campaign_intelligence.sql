CREATE TABLE IF NOT EXISTS growth_campaigns (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  goal TEXT NOT NULL,
  hypothesis TEXT,
  target_segment TEXT,
  primary_offer TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  priority INTEGER NOT NULL DEFAULT 50,
  risk_level TEXT NOT NULL DEFAULT 'medium',
  budget_profile TEXT NOT NULL DEFAULT 'free_safe',
  success_metric TEXT,
  start_date TEXT,
  end_date TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_growth_campaigns_status ON growth_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_growth_campaigns_priority ON growth_campaigns(priority DESC);

CREATE TABLE IF NOT EXISTS growth_experiments (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  name TEXT NOT NULL,
  hypothesis TEXT,
  variant_a TEXT,
  variant_b TEXT,
  variant_c TEXT,
  sample_size_target INTEGER NOT NULL DEFAULT 10,
  decision_rule TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  winner_variant TEXT,
  confidence_score INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (campaign_id) REFERENCES growth_campaigns(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_growth_experiments_campaign ON growth_experiments(campaign_id);
CREATE INDEX IF NOT EXISTS idx_growth_experiments_status ON growth_experiments(status);

CREATE TABLE IF NOT EXISTS growth_campaign_metrics (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  experiment_id TEXT,
  metric_date TEXT NOT NULL,
  prepared_count INTEGER NOT NULL DEFAULT 0,
  reviewed_count INTEGER NOT NULL DEFAULT 0,
  positive_count INTEGER NOT NULL DEFAULT 0,
  negative_count INTEGER NOT NULL DEFAULT 0,
  meeting_count INTEGER NOT NULL DEFAULT 0,
  content_count INTEGER NOT NULL DEFAULT 0,
  engagement_count INTEGER NOT NULL DEFAULT 0,
  cost_units INTEGER NOT NULL DEFAULT 0,
  health_state TEXT NOT NULL DEFAULT 'unknown',
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (campaign_id) REFERENCES growth_campaigns(id) ON DELETE CASCADE,
  FOREIGN KEY (experiment_id) REFERENCES growth_experiments(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_growth_campaign_metrics_campaign ON growth_campaign_metrics(campaign_id, metric_date DESC);
CREATE INDEX IF NOT EXISTS idx_growth_campaign_metrics_experiment ON growth_campaign_metrics(experiment_id, metric_date DESC);

CREATE TABLE IF NOT EXISTS growth_decisions (
  id TEXT PRIMARY KEY,
  campaign_id TEXT,
  experiment_id TEXT,
  decision_type TEXT NOT NULL,
  selected_action TEXT NOT NULL,
  decision_status TEXT NOT NULL DEFAULT 'planned',
  reasoning_summary_json TEXT NOT NULL DEFAULT '[]',
  constraints_json TEXT NOT NULL DEFAULT '[]',
  utility_score INTEGER NOT NULL DEFAULT 0,
  risk_score INTEGER NOT NULL DEFAULT 0,
  confidence_score INTEGER NOT NULL DEFAULT 0,
  next_step TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (campaign_id) REFERENCES growth_campaigns(id) ON DELETE SET NULL,
  FOREIGN KEY (experiment_id) REFERENCES growth_experiments(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_growth_decisions_campaign ON growth_decisions(campaign_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_growth_decisions_status ON growth_decisions(decision_status);

CREATE TABLE IF NOT EXISTS growth_candidate_actions (
  id TEXT PRIMARY KEY,
  decision_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  target_ref TEXT,
  capability_id TEXT,
  utility_score INTEGER NOT NULL DEFAULT 0,
  risk_score INTEGER NOT NULL DEFAULT 0,
  expected_value_score INTEGER NOT NULL DEFAULT 0,
  learning_value_score INTEGER NOT NULL DEFAULT 0,
  readiness_score INTEGER NOT NULL DEFAULT 0,
  rejection_reason TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (decision_id) REFERENCES growth_decisions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_growth_candidate_actions_decision ON growth_candidate_actions(decision_id);
CREATE INDEX IF NOT EXISTS idx_growth_candidate_actions_action_type ON growth_candidate_actions(action_type);

CREATE TABLE IF NOT EXISTS growth_evidence_items (
  id TEXT PRIMARY KEY,
  campaign_id TEXT,
  experiment_id TEXT,
  target_ref TEXT,
  evidence_type TEXT NOT NULL,
  source_url TEXT,
  summary TEXT NOT NULL,
  snapshot_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  FOREIGN KEY (campaign_id) REFERENCES growth_campaigns(id) ON DELETE SET NULL,
  FOREIGN KEY (experiment_id) REFERENCES growth_experiments(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_growth_evidence_campaign ON growth_evidence_items(campaign_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_growth_evidence_target ON growth_evidence_items(target_ref);

CREATE TABLE IF NOT EXISTS growth_learning_notes (
  id TEXT PRIMARY KEY,
  campaign_id TEXT,
  experiment_id TEXT,
  note_type TEXT NOT NULL,
  summary TEXT NOT NULL,
  recommendation TEXT,
  confidence_score INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (campaign_id) REFERENCES growth_campaigns(id) ON DELETE SET NULL,
  FOREIGN KEY (experiment_id) REFERENCES growth_experiments(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_growth_learning_campaign ON growth_learning_notes(campaign_id, created_at DESC);
