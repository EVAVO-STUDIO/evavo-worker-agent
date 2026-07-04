-- Business Autopilot foundation metadata schema.
-- This migration creates storage only. It does not enable email sending, social posting,
-- form submission, browser automation, AI calls, ad buying, or external execution.

CREATE TABLE IF NOT EXISTS business_organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  domain TEXT,
  website_url TEXT,
  industry TEXT,
  location TEXT,
  source_type TEXT NOT NULL DEFAULT 'operator',
  source_url TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  fit_score REAL NOT NULL DEFAULT 0,
  priority_score REAL NOT NULL DEFAULT 0,
  risk_score REAL NOT NULL DEFAULT 0,
  confidence_score REAL NOT NULL DEFAULT 0,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_business_organizations_domain ON business_organizations(domain);
CREATE INDEX IF NOT EXISTS idx_business_organizations_status ON business_organizations(status);
CREATE INDEX IF NOT EXISTS idx_business_organizations_priority ON business_organizations(priority_score DESC);

CREATE TABLE IF NOT EXISTS business_people (
  id TEXT PRIMARY KEY,
  organization_id TEXT,
  name TEXT NOT NULL,
  role TEXT,
  email TEXT,
  phone TEXT,
  profile_url TEXT,
  source_type TEXT NOT NULL DEFAULT 'operator',
  source_url TEXT,
  allowed_use TEXT NOT NULL DEFAULT 'unknown',
  contact_status TEXT NOT NULL DEFAULT 'new',
  confidence_score REAL NOT NULL DEFAULT 0,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES business_organizations(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_business_people_org ON business_people(organization_id);
CREATE INDEX IF NOT EXISTS idx_business_people_email ON business_people(email);
CREATE INDEX IF NOT EXISTS idx_business_people_status ON business_people(contact_status);

CREATE TABLE IF NOT EXISTS business_websites (
  id TEXT PRIMARY KEY,
  organization_id TEXT,
  url TEXT NOT NULL,
  domain TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  last_checked_at TEXT,
  robots_status TEXT NOT NULL DEFAULT 'unknown',
  crawl_allowed INTEGER NOT NULL DEFAULT 0,
  tech_hints_json TEXT NOT NULL DEFAULT '[]',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES business_organizations(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_business_websites_org ON business_websites(organization_id);
CREATE INDEX IF NOT EXISTS idx_business_websites_domain ON business_websites(domain);
CREATE INDEX IF NOT EXISTS idx_business_websites_crawl ON business_websites(crawl_allowed);

CREATE TABLE IF NOT EXISTS business_pages (
  id TEXT PRIMARY KEY,
  website_id TEXT,
  organization_id TEXT,
  url TEXT NOT NULL,
  page_type TEXT NOT NULL DEFAULT 'unknown',
  title TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  last_fetched_at TEXT,
  http_status INTEGER,
  content_hash TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (website_id) REFERENCES business_websites(id) ON DELETE SET NULL,
  FOREIGN KEY (organization_id) REFERENCES business_organizations(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_business_pages_website ON business_pages(website_id);
CREATE INDEX IF NOT EXISTS idx_business_pages_org ON business_pages(organization_id);
CREATE INDEX IF NOT EXISTS idx_business_pages_type ON business_pages(page_type);

CREATE TABLE IF NOT EXISTS business_signals (
  id TEXT PRIMARY KEY,
  organization_id TEXT,
  website_id TEXT,
  page_id TEXT,
  signal_type TEXT NOT NULL,
  signal_strength REAL NOT NULL DEFAULT 0,
  evidence_summary TEXT,
  evidence_url TEXT,
  confidence_score REAL NOT NULL DEFAULT 0,
  risk_flags_json TEXT NOT NULL DEFAULT '[]',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES business_organizations(id) ON DELETE SET NULL,
  FOREIGN KEY (website_id) REFERENCES business_websites(id) ON DELETE SET NULL,
  FOREIGN KEY (page_id) REFERENCES business_pages(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_business_signals_org ON business_signals(organization_id);
CREATE INDEX IF NOT EXISTS idx_business_signals_type ON business_signals(signal_type);
CREATE INDEX IF NOT EXISTS idx_business_signals_strength ON business_signals(signal_strength DESC);

CREATE TABLE IF NOT EXISTS business_opportunities (
  id TEXT PRIMARY KEY,
  organization_id TEXT,
  opportunity_type TEXT NOT NULL DEFAULT 'general',
  status TEXT NOT NULL DEFAULT 'new',
  priority TEXT NOT NULL DEFAULT 'C',
  fit_score REAL NOT NULL DEFAULT 0,
  need_score REAL NOT NULL DEFAULT 0,
  urgency_score REAL NOT NULL DEFAULT 0,
  budget_likelihood_score REAL NOT NULL DEFAULT 0,
  contactability_score REAL NOT NULL DEFAULT 0,
  evidence_quality_score REAL NOT NULL DEFAULT 0,
  risk_score REAL NOT NULL DEFAULT 0,
  confidence_score REAL NOT NULL DEFAULT 0,
  recommended_service TEXT,
  recommended_angle TEXT,
  next_step TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES business_organizations(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_business_opportunities_org ON business_opportunities(organization_id);
CREATE INDEX IF NOT EXISTS idx_business_opportunities_status ON business_opportunities(status);
CREATE INDEX IF NOT EXISTS idx_business_opportunities_priority ON business_opportunities(priority, fit_score DESC);

CREATE TABLE IF NOT EXISTS business_service_matches (
  id TEXT PRIMARY KEY,
  organization_id TEXT,
  opportunity_id TEXT,
  signal_id TEXT,
  service_key TEXT NOT NULL,
  match_score REAL NOT NULL DEFAULT 0,
  reason TEXT,
  evidence_json TEXT NOT NULL DEFAULT '[]',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES business_organizations(id) ON DELETE SET NULL,
  FOREIGN KEY (opportunity_id) REFERENCES business_opportunities(id) ON DELETE SET NULL,
  FOREIGN KEY (signal_id) REFERENCES business_signals(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_business_service_matches_org ON business_service_matches(organization_id);
CREATE INDEX IF NOT EXISTS idx_business_service_matches_service ON business_service_matches(service_key);
CREATE INDEX IF NOT EXISTS idx_business_service_matches_score ON business_service_matches(match_score DESC);

CREATE TABLE IF NOT EXISTS business_audit_packs (
  id TEXT PRIMARY KEY,
  organization_id TEXT,
  opportunity_id TEXT,
  title TEXT NOT NULL,
  summary TEXT,
  audit_type TEXT NOT NULL DEFAULT 'website_teardown',
  findings_json TEXT NOT NULL DEFAULT '[]',
  recommendations_json TEXT NOT NULL DEFAULT '[]',
  risk_flags_json TEXT NOT NULL DEFAULT '[]',
  confidence_score REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES business_organizations(id) ON DELETE SET NULL,
  FOREIGN KEY (opportunity_id) REFERENCES business_opportunities(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_business_audit_packs_org ON business_audit_packs(organization_id);
CREATE INDEX IF NOT EXISTS idx_business_audit_packs_status ON business_audit_packs(status);

CREATE TABLE IF NOT EXISTS business_action_drafts (
  id TEXT PRIMARY KEY,
  organization_id TEXT,
  person_id TEXT,
  opportunity_id TEXT,
  audit_pack_id TEXT,
  draft_type TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'internal',
  subject TEXT,
  body TEXT,
  payload_json TEXT NOT NULL DEFAULT '{}',
  risk_flags_json TEXT NOT NULL DEFAULT '[]',
  compliance_status TEXT NOT NULL DEFAULT 'draft_only',
  approval_status TEXT NOT NULL DEFAULT 'needs_review',
  status TEXT NOT NULL DEFAULT 'draft',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES business_organizations(id) ON DELETE SET NULL,
  FOREIGN KEY (person_id) REFERENCES business_people(id) ON DELETE SET NULL,
  FOREIGN KEY (opportunity_id) REFERENCES business_opportunities(id) ON DELETE SET NULL,
  FOREIGN KEY (audit_pack_id) REFERENCES business_audit_packs(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_business_action_drafts_org ON business_action_drafts(organization_id);
CREATE INDEX IF NOT EXISTS idx_business_action_drafts_type ON business_action_drafts(draft_type);
CREATE INDEX IF NOT EXISTS idx_business_action_drafts_status ON business_action_drafts(status, approval_status);

CREATE TABLE IF NOT EXISTS business_approval_requests (
  id TEXT PRIMARY KEY,
  action_draft_id TEXT,
  request_type TEXT NOT NULL DEFAULT 'action_draft',
  status TEXT NOT NULL DEFAULT 'needs_review',
  review_checklist_json TEXT NOT NULL DEFAULT '[]',
  risk_flags_json TEXT NOT NULL DEFAULT '[]',
  approval_reason TEXT,
  approved_by TEXT,
  approved_at TEXT,
  expires_at TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (action_draft_id) REFERENCES business_action_drafts(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_business_approval_requests_draft ON business_approval_requests(action_draft_id);
CREATE INDEX IF NOT EXISTS idx_business_approval_requests_status ON business_approval_requests(status);

CREATE TABLE IF NOT EXISTS business_execution_records (
  id TEXT PRIMARY KEY,
  action_draft_id TEXT,
  approval_request_id TEXT,
  execution_type TEXT NOT NULL,
  provider TEXT,
  status TEXT NOT NULL DEFAULT 'not_executed',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  external_reference TEXT,
  failure_reason TEXT,
  executed_at TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (action_draft_id) REFERENCES business_action_drafts(id) ON DELETE SET NULL,
  FOREIGN KEY (approval_request_id) REFERENCES business_approval_requests(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_business_execution_records_draft ON business_execution_records(action_draft_id);
CREATE INDEX IF NOT EXISTS idx_business_execution_records_status ON business_execution_records(status);

CREATE TABLE IF NOT EXISTS business_suppression_list (
  id TEXT PRIMARY KEY,
  scope_type TEXT NOT NULL,
  scope_value TEXT NOT NULL,
  reason TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'operator',
  active INTEGER NOT NULL DEFAULT 1,
  expires_at TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_business_suppression_scope ON business_suppression_list(scope_type, scope_value);
CREATE INDEX IF NOT EXISTS idx_business_suppression_active ON business_suppression_list(active);

CREATE TABLE IF NOT EXISTS business_content_ideas (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'post',
  summary TEXT,
  source_signal_ids_json TEXT NOT NULL DEFAULT '[]',
  target_segment TEXT,
  recommended_channel TEXT,
  priority_score REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_business_content_ideas_status ON business_content_ideas(status);
CREATE INDEX IF NOT EXISTS idx_business_content_ideas_priority ON business_content_ideas(priority_score DESC);

CREATE TABLE IF NOT EXISTS business_content_calendar (
  id TEXT PRIMARY KEY,
  content_idea_id TEXT,
  scheduled_for TEXT,
  channel TEXT NOT NULL DEFAULT 'internal',
  status TEXT NOT NULL DEFAULT 'planned',
  caption TEXT,
  asset_notes TEXT,
  approval_status TEXT NOT NULL DEFAULT 'needs_review',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (content_idea_id) REFERENCES business_content_ideas(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_business_content_calendar_date ON business_content_calendar(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_business_content_calendar_status ON business_content_calendar(status, approval_status);

CREATE TABLE IF NOT EXISTS business_followups (
  id TEXT PRIMARY KEY,
  organization_id TEXT,
  person_id TEXT,
  opportunity_id TEXT,
  action_draft_id TEXT,
  followup_type TEXT NOT NULL DEFAULT 'manual_review',
  due_at TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  notes TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES business_organizations(id) ON DELETE SET NULL,
  FOREIGN KEY (person_id) REFERENCES business_people(id) ON DELETE SET NULL,
  FOREIGN KEY (opportunity_id) REFERENCES business_opportunities(id) ON DELETE SET NULL,
  FOREIGN KEY (action_draft_id) REFERENCES business_action_drafts(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_business_followups_due ON business_followups(due_at);
CREATE INDEX IF NOT EXISTS idx_business_followups_status ON business_followups(status);

CREATE TABLE IF NOT EXISTS business_learning_events (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  outcome TEXT,
  score_delta REAL NOT NULL DEFAULT 0,
  notes TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_business_learning_entity ON business_learning_events(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_business_learning_event_type ON business_learning_events(event_type);
