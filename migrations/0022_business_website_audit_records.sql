-- Business website/funnel audit metadata schema.
-- This migration creates internal metadata storage only. It does not crawl, fetch,
-- send email, post to social, submit forms, run browser automation, call AI,
-- buy ads, or mutate external systems.

CREATE TABLE IF NOT EXISTS business_website_audit_runs (
  id TEXT PRIMARY KEY,
  website_id TEXT,
  organization_id TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  audit_type TEXT NOT NULL DEFAULT 'website_funnel_audit',
  source TEXT NOT NULL DEFAULT 'operator',
  requested_by TEXT,
  started_at TEXT,
  completed_at TEXT,
  readiness_score REAL NOT NULL DEFAULT 0,
  risk_score REAL NOT NULL DEFAULT 0,
  confidence_score REAL NOT NULL DEFAULT 0,
  summary TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (website_id) REFERENCES business_websites(id) ON DELETE SET NULL,
  FOREIGN KEY (organization_id) REFERENCES business_organizations(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_business_website_audit_runs_website ON business_website_audit_runs(website_id);
CREATE INDEX IF NOT EXISTS idx_business_website_audit_runs_org ON business_website_audit_runs(organization_id);
CREATE INDEX IF NOT EXISTS idx_business_website_audit_runs_status ON business_website_audit_runs(status);
CREATE INDEX IF NOT EXISTS idx_business_website_audit_runs_readiness ON business_website_audit_runs(readiness_score DESC);

CREATE TABLE IF NOT EXISTS business_audit_observations (
  id TEXT PRIMARY KEY,
  audit_run_id TEXT,
  website_id TEXT,
  organization_id TEXT,
  page_id TEXT,
  signal_id TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  severity TEXT NOT NULL DEFAULT 'info',
  title TEXT NOT NULL,
  evidence_summary TEXT,
  recommendation TEXT,
  confidence_score REAL NOT NULL DEFAULT 0,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (audit_run_id) REFERENCES business_website_audit_runs(id) ON DELETE SET NULL,
  FOREIGN KEY (website_id) REFERENCES business_websites(id) ON DELETE SET NULL,
  FOREIGN KEY (organization_id) REFERENCES business_organizations(id) ON DELETE SET NULL,
  FOREIGN KEY (page_id) REFERENCES business_pages(id) ON DELETE SET NULL,
  FOREIGN KEY (signal_id) REFERENCES business_signals(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_business_audit_observations_run ON business_audit_observations(audit_run_id);
CREATE INDEX IF NOT EXISTS idx_business_audit_observations_website ON business_audit_observations(website_id);
CREATE INDEX IF NOT EXISTS idx_business_audit_observations_org ON business_audit_observations(organization_id);
CREATE INDEX IF NOT EXISTS idx_business_audit_observations_category ON business_audit_observations(category);
CREATE INDEX IF NOT EXISTS idx_business_audit_observations_severity ON business_audit_observations(severity);
