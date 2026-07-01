CREATE TABLE IF NOT EXISTS growth_approval_requests (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status TEXT NOT NULL DEFAULT 'pending',
  source TEXT NOT NULL DEFAULT 'growth_operator',
  step TEXT NOT NULL,
  route TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT 'POST',
  requires_confirm INTEGER NOT NULL DEFAULT 1,
  dashboard_anchor TEXT,
  setup_gap TEXT,
  target_campaign_id TEXT,
  target_campaign_name TEXT,
  payload_json TEXT NOT NULL DEFAULT '{}',
  review_checklist_json TEXT NOT NULL DEFAULT '[]',
  explicit_blocks_json TEXT NOT NULL DEFAULT '[]',
  audit_reason_json TEXT NOT NULL DEFAULT '[]',
  safety_json TEXT NOT NULL DEFAULT '{}',
  reviewer TEXT,
  decision_note TEXT,
  reviewed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_growth_approval_requests_status_created ON growth_approval_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_growth_approval_requests_step_created ON growth_approval_requests(step, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_growth_approval_requests_target_campaign ON growth_approval_requests(target_campaign_id, created_at DESC);
