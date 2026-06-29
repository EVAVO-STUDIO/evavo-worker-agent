CREATE TABLE IF NOT EXISTS growth_objectives (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  priority INTEGER NOT NULL DEFAULT 50,
  success_metric TEXT,
  target_date TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS growth_key_results (
  id TEXT PRIMARY KEY,
  objective_id TEXT,
  name TEXT NOT NULL,
  metric_name TEXT,
  target_value REAL,
  current_value REAL NOT NULL DEFAULT 0,
  unit TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS growth_target_segments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  geography TEXT,
  industry TEXT,
  company_size TEXT,
  buyer_roles TEXT,
  pain_points_json TEXT NOT NULL DEFAULT '[]',
  priority INTEGER NOT NULL DEFAULT 50,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS growth_offer_profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  offer_type TEXT,
  proof_points_json TEXT NOT NULL DEFAULT '[]',
  best_for_segments_json TEXT NOT NULL DEFAULT '[]',
  risk_notes TEXT,
  priority INTEGER NOT NULL DEFAULT 50,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS growth_positioning_profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  voice_notes TEXT,
  value_prop TEXT,
  avoid_phrases_json TEXT NOT NULL DEFAULT '[]',
  preferred_angles_json TEXT NOT NULL DEFAULT '[]',
  proof_assets_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS growth_runtime_constraints (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  constraint_type TEXT NOT NULL DEFAULT 'policy',
  description TEXT,
  severity TEXT NOT NULL DEFAULT 'hard',
  rule_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_growth_objectives_status_priority ON growth_objectives(status, priority DESC);
CREATE INDEX IF NOT EXISTS idx_growth_key_results_objective ON growth_key_results(objective_id, status);
CREATE INDEX IF NOT EXISTS idx_growth_target_segments_status_priority ON growth_target_segments(status, priority DESC);
CREATE INDEX IF NOT EXISTS idx_growth_offer_profiles_status_priority ON growth_offer_profiles(status, priority DESC);
CREATE INDEX IF NOT EXISTS idx_growth_positioning_profiles_status ON growth_positioning_profiles(status);
CREATE INDEX IF NOT EXISTS idx_growth_runtime_constraints_status ON growth_runtime_constraints(status, severity);
