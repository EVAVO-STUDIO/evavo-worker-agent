CREATE TABLE IF NOT EXISTS growth_blackboard_facts (
  id TEXT PRIMARY KEY,
  fact_type TEXT NOT NULL DEFAULT 'note',
  subject_type TEXT,
  subject_id TEXT,
  subject_name TEXT,
  predicate TEXT,
  object_type TEXT,
  object_id TEXT,
  object_name TEXT,
  summary TEXT NOT NULL,
  evidence_refs_json TEXT NOT NULL DEFAULT '[]',
  confidence_score INTEGER NOT NULL DEFAULT 50,
  source TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS growth_entities (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  name TEXT NOT NULL,
  canonical_url TEXT,
  description TEXT,
  attributes_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS growth_entity_relationships (
  id TEXT PRIMARY KEY,
  from_entity_id TEXT NOT NULL,
  to_entity_id TEXT NOT NULL,
  relationship_type TEXT NOT NULL,
  summary TEXT,
  confidence_score INTEGER NOT NULL DEFAULT 50,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS growth_market_signals (
  id TEXT PRIMARY KEY,
  signal_type TEXT NOT NULL DEFAULT 'market_note',
  segment_id TEXT,
  segment_name TEXT,
  offer_id TEXT,
  offer_name TEXT,
  summary TEXT NOT NULL,
  source_url TEXT,
  evidence_refs_json TEXT NOT NULL DEFAULT '[]',
  strength_score INTEGER NOT NULL DEFAULT 50,
  freshness_score INTEGER NOT NULL DEFAULT 50,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS growth_asset_inventory (
  id TEXT PRIMARY KEY,
  asset_type TEXT NOT NULL DEFAULT 'proof_asset',
  name TEXT NOT NULL,
  url TEXT,
  summary TEXT,
  best_for_segments_json TEXT NOT NULL DEFAULT '[]',
  best_for_offers_json TEXT NOT NULL DEFAULT '[]',
  proof_points_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_growth_blackboard_facts_subject ON growth_blackboard_facts(subject_type, subject_id, status);
CREATE INDEX IF NOT EXISTS idx_growth_blackboard_facts_type ON growth_blackboard_facts(fact_type, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_growth_entities_type ON growth_entities(entity_type, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_growth_entity_relationships_from ON growth_entity_relationships(from_entity_id, relationship_type, status);
CREATE INDEX IF NOT EXISTS idx_growth_market_signals_segment ON growth_market_signals(segment_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_growth_asset_inventory_type ON growth_asset_inventory(asset_type, status, updated_at DESC);
