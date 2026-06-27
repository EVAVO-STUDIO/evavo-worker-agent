-- 0013_growth_audit_events.sql
-- Append-only audit trail for Growth Autonomy decisions, metadata writes, safety gates, budget checks, and future execution events.

CREATE TABLE IF NOT EXISTS growth_audit_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  actor TEXT NOT NULL DEFAULT 'system',
  automation_mode TEXT,
  reason TEXT,
  input_snapshot TEXT NOT NULL DEFAULT '{}',
  output_snapshot TEXT NOT NULL DEFAULT '{}',
  safety_result TEXT NOT NULL DEFAULT '{}',
  budget_result TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_growth_audit_events_type_time
  ON growth_audit_events(event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_growth_audit_events_entity
  ON growth_audit_events(entity_type, entity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_growth_audit_events_actor
  ON growth_audit_events(actor, created_at DESC);
