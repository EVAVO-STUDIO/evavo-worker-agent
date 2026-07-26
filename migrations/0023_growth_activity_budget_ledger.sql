-- Growth activity budget ledger v1.
-- Adds one atomic daily usage row, hashed per-domain state, immutable admission claims,
-- and conservative outcome reconciliation. It does not enable AI, browser automation,
-- email, posting, forms, calendar writes, provider writes, or external execution.

CREATE TABLE IF NOT EXISTS growth_activity_budget_usage_daily (
  utc_day TEXT PRIMARY KEY,
  counters_json TEXT NOT NULL DEFAULT '{"manualResearchRuns":0,"scheduledExternalResearchRuns":0,"externalFetches":0,"distinctDomains":0,"candidateWrites":0,"proposalWrites":0,"reportsGenerated":0,"workerRequests":0,"d1RowsRead":0,"d1RowsWritten":0,"queueOperations":0,"browserMinutes":0,"aiCalls":0,"paidServiceCalls":0,"externalActions":0}',
  domain_fetches_json TEXT NOT NULL DEFAULT '{}',
  domain_failures_json TEXT NOT NULL DEFAULT '{}',
  domain_last_research_json TEXT NOT NULL DEFAULT '{}',
  created_at_iso TEXT NOT NULL,
  updated_at_iso TEXT NOT NULL,
  CHECK(length(utc_day) = 10),
  CHECK(json_valid(counters_json) AND json_type(counters_json) = 'object'),
  CHECK(json_valid(domain_fetches_json) AND json_type(domain_fetches_json) = 'object'),
  CHECK(json_valid(domain_failures_json) AND json_type(domain_failures_json) = 'object'),
  CHECK(json_valid(domain_last_research_json) AND json_type(domain_last_research_json) = 'object')
);

CREATE TABLE IF NOT EXISTS growth_activity_budget_claims (
  claim_id TEXT PRIMARY KEY,
  utc_day TEXT NOT NULL,
  action TEXT NOT NULL,
  invocation TEXT NOT NULL CHECK(invocation IN ('manual', 'scheduled')),
  profile_intensity TEXT NOT NULL CHECK(profile_intensity IN ('paused', 'light', 'balanced', 'high', 'custom')),
  requested_units INTEGER NOT NULL CHECK(requested_units BETWEEN 1 AND 1000),
  target_domain_hash TEXT,
  cost_json TEXT NOT NULL,
  limits_json TEXT NOT NULL,
  request_body_sha256 TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'admitted' CHECK(status IN ('admitted', 'completed', 'failed')),
  outcome_code TEXT,
  created_at_iso TEXT NOT NULL,
  expires_at_iso TEXT NOT NULL,
  completed_at_iso TEXT,
  CHECK(length(claim_id) BETWEEN 16 AND 160),
  CHECK(instr(claim_id, '..') = 0),
  CHECK(length(utc_day) = 10),
  CHECK(target_domain_hash IS NULL OR (
    length(target_domain_hash) = 64
    AND target_domain_hash NOT GLOB '*[^0-9a-f]*'
  )),
  CHECK(length(request_body_sha256) = 64 AND request_body_sha256 NOT GLOB '*[^0-9a-f]*'),
  CHECK(json_valid(cost_json) AND json_type(cost_json) = 'object'),
  CHECK(json_valid(limits_json) AND json_type(limits_json) = 'object'),
  CHECK(outcome_code IS NULL OR (
    length(outcome_code) BETWEEN 2 AND 80
    AND outcome_code NOT GLOB '*[^a-z0-9._:-]*'
  ))
);

CREATE INDEX IF NOT EXISTS idx_growth_activity_budget_claims_day_created
ON growth_activity_budget_claims(utc_day, created_at_iso DESC);

CREATE INDEX IF NOT EXISTS idx_growth_activity_budget_claims_status_expires
ON growth_activity_budget_claims(status, expires_at_iso);

CREATE TRIGGER IF NOT EXISTS validate_growth_activity_budget_claim
BEFORE INSERT ON growth_activity_budget_claims
BEGIN
  SELECT CASE WHEN NEW.status <> 'admitted'
    THEN RAISE(ABORT, 'GROWTH_ACTIVITY_BUDGET_CLAIM_STATUS_INVALID') END;
  SELECT CASE WHEN NEW.completed_at_iso IS NOT NULL OR NEW.outcome_code IS NOT NULL
    THEN RAISE(ABORT, 'GROWTH_ACTIVITY_BUDGET_CLAIM_OUTCOME_INVALID') END;
  SELECT CASE WHEN date(NEW.created_at_iso) IS NULL OR date(NEW.created_at_iso) <> NEW.utc_day
    THEN RAISE(ABORT, 'GROWTH_ACTIVITY_BUDGET_CLAIM_DAY_INVALID') END;
  SELECT CASE WHEN datetime(NEW.expires_at_iso) IS NULL OR NEW.expires_at_iso <= NEW.created_at_iso
    THEN RAISE(ABORT, 'GROWTH_ACTIVITY_BUDGET_CLAIM_EXPIRY_INVALID') END;
  SELECT CASE WHEN (julianday(NEW.expires_at_iso) - julianday(NEW.created_at_iso)) * 86400 > 900
    THEN RAISE(ABORT, 'GROWTH_ACTIVITY_BUDGET_CLAIM_EXPIRY_INVALID') END;

  SELECT CASE WHEN (
    SELECT COUNT(*) FROM json_each(NEW.cost_json)
  ) <> 15 OR EXISTS (
    SELECT 1 FROM json_each(NEW.cost_json)
    WHERE key NOT IN (
      'manualResearchRuns', 'scheduledExternalResearchRuns', 'externalFetches',
      'distinctDomains', 'candidateWrites', 'proposalWrites', 'reportsGenerated',
      'workerRequests', 'd1RowsRead', 'd1RowsWritten', 'queueOperations',
      'browserMinutes', 'aiCalls', 'paidServiceCalls', 'externalActions'
    ) OR type <> 'integer' OR value < 0
  ) THEN RAISE(ABORT, 'GROWTH_ACTIVITY_BUDGET_COST_INVALID') END;

  SELECT CASE WHEN (
    SELECT COUNT(*) FROM json_each(NEW.limits_json)
  ) <> 20 OR EXISTS (
    SELECT 1 FROM json_each(NEW.limits_json)
    WHERE key NOT IN (
      'manualResearchRunsPerDay', 'scheduledExternalResearchRunsPerDay',
      'externalFetchesPerDay', 'externalFetchesPerRun', 'distinctDomainsPerDay',
      'fetchesPerDomainPerDay', 'consecutiveFetchFailuresPerRun',
      'candidateWritesPerDay', 'proposalWritesPerDay', 'reportsPerDay',
      'workerRequestsPerDay', 'd1RowsReadPerDay', 'd1RowsWrittenPerDay',
      'queueOperationsPerDay', 'browserMinutesPerDay', 'aiCallsPerDay',
      'paidServiceCallsPerDay', 'externalActionsPerDay',
      'minimumResearchCooldownMinutes', 'minimumOpportunityScore'
    ) OR type <> 'integer' OR value < 0
  ) THEN RAISE(ABORT, 'GROWTH_ACTIVITY_BUDGET_LIMITS_INVALID') END;

  SELECT CASE WHEN
    json_extract(NEW.cost_json, '$.scheduledExternalResearchRuns') <> 0 OR
    json_extract(NEW.cost_json, '$.browserMinutes') <> 0 OR
    json_extract(NEW.cost_json, '$.aiCalls') <> 0 OR
    json_extract(NEW.cost_json, '$.paidServiceCalls') <> 0 OR
    json_extract(NEW.cost_json, '$.externalActions') <> 0 OR
    json_extract(NEW.limits_json, '$.scheduledExternalResearchRunsPerDay') <> 0 OR
    json_extract(NEW.limits_json, '$.browserMinutesPerDay') <> 0 OR
    json_extract(NEW.limits_json, '$.aiCallsPerDay') <> 0 OR
    json_extract(NEW.limits_json, '$.paidServiceCallsPerDay') <> 0 OR
    json_extract(NEW.limits_json, '$.externalActionsPerDay') <> 0
    THEN RAISE(ABORT, 'GROWTH_ACTIVITY_BUDGET_ZERO_COST_POSTURE_INVALID') END;

  SELECT CASE WHEN NEW.invocation = 'scheduled' AND json_extract(NEW.cost_json, '$.externalFetches') > 0
    THEN RAISE(ABORT, 'GROWTH_ACTIVITY_BUDGET_SCHEDULED_RESEARCH_FORBIDDEN') END;
  SELECT CASE WHEN json_extract(NEW.cost_json, '$.externalFetches') > 0 AND NEW.target_domain_hash IS NULL
    THEN RAISE(ABORT, 'GROWTH_ACTIVITY_BUDGET_TARGET_DOMAIN_REQUIRED') END;
  SELECT CASE WHEN json_extract(NEW.cost_json, '$.externalFetches') > json_extract(NEW.limits_json, '$.externalFetchesPerRun')
    THEN RAISE(ABORT, 'GROWTH_ACTIVITY_BUDGET_PER_RUN_LIMIT') END;

  SELECT CASE WHEN
    COALESCE((SELECT json_extract(counters_json, '$.manualResearchRuns') FROM growth_activity_budget_usage_daily WHERE utc_day = NEW.utc_day), 0)
      + json_extract(NEW.cost_json, '$.manualResearchRuns') > json_extract(NEW.limits_json, '$.manualResearchRunsPerDay') OR
    COALESCE((SELECT json_extract(counters_json, '$.scheduledExternalResearchRuns') FROM growth_activity_budget_usage_daily WHERE utc_day = NEW.utc_day), 0)
      + json_extract(NEW.cost_json, '$.scheduledExternalResearchRuns') > json_extract(NEW.limits_json, '$.scheduledExternalResearchRunsPerDay') OR
    COALESCE((SELECT json_extract(counters_json, '$.externalFetches') FROM growth_activity_budget_usage_daily WHERE utc_day = NEW.utc_day), 0)
      + json_extract(NEW.cost_json, '$.externalFetches') > json_extract(NEW.limits_json, '$.externalFetchesPerDay') OR
    COALESCE((SELECT json_extract(counters_json, '$.distinctDomains') FROM growth_activity_budget_usage_daily WHERE utc_day = NEW.utc_day), 0)
      + json_extract(NEW.cost_json, '$.distinctDomains') > json_extract(NEW.limits_json, '$.distinctDomainsPerDay') OR
    COALESCE((SELECT json_extract(counters_json, '$.candidateWrites') FROM growth_activity_budget_usage_daily WHERE utc_day = NEW.utc_day), 0)
      + json_extract(NEW.cost_json, '$.candidateWrites') > json_extract(NEW.limits_json, '$.candidateWritesPerDay') OR
    COALESCE((SELECT json_extract(counters_json, '$.proposalWrites') FROM growth_activity_budget_usage_daily WHERE utc_day = NEW.utc_day), 0)
      + json_extract(NEW.cost_json, '$.proposalWrites') > json_extract(NEW.limits_json, '$.proposalWritesPerDay') OR
    COALESCE((SELECT json_extract(counters_json, '$.reportsGenerated') FROM growth_activity_budget_usage_daily WHERE utc_day = NEW.utc_day), 0)
      + json_extract(NEW.cost_json, '$.reportsGenerated') > json_extract(NEW.limits_json, '$.reportsPerDay') OR
    COALESCE((SELECT json_extract(counters_json, '$.workerRequests') FROM growth_activity_budget_usage_daily WHERE utc_day = NEW.utc_day), 0)
      + json_extract(NEW.cost_json, '$.workerRequests') > json_extract(NEW.limits_json, '$.workerRequestsPerDay') OR
    COALESCE((SELECT json_extract(counters_json, '$.d1RowsRead') FROM growth_activity_budget_usage_daily WHERE utc_day = NEW.utc_day), 0)
      + json_extract(NEW.cost_json, '$.d1RowsRead') > json_extract(NEW.limits_json, '$.d1RowsReadPerDay') OR
    COALESCE((SELECT json_extract(counters_json, '$.d1RowsWritten') FROM growth_activity_budget_usage_daily WHERE utc_day = NEW.utc_day), 0)
      + json_extract(NEW.cost_json, '$.d1RowsWritten') > json_extract(NEW.limits_json, '$.d1RowsWrittenPerDay') OR
    COALESCE((SELECT json_extract(counters_json, '$.queueOperations') FROM growth_activity_budget_usage_daily WHERE utc_day = NEW.utc_day), 0)
      + json_extract(NEW.cost_json, '$.queueOperations') > json_extract(NEW.limits_json, '$.queueOperationsPerDay') OR
    COALESCE((SELECT json_extract(counters_json, '$.browserMinutes') FROM growth_activity_budget_usage_daily WHERE utc_day = NEW.utc_day), 0)
      + json_extract(NEW.cost_json, '$.browserMinutes') > json_extract(NEW.limits_json, '$.browserMinutesPerDay') OR
    COALESCE((SELECT json_extract(counters_json, '$.aiCalls') FROM growth_activity_budget_usage_daily WHERE utc_day = NEW.utc_day), 0)
      + json_extract(NEW.cost_json, '$.aiCalls') > json_extract(NEW.limits_json, '$.aiCallsPerDay') OR
    COALESCE((SELECT json_extract(counters_json, '$.paidServiceCalls') FROM growth_activity_budget_usage_daily WHERE utc_day = NEW.utc_day), 0)
      + json_extract(NEW.cost_json, '$.paidServiceCalls') > json_extract(NEW.limits_json, '$.paidServiceCallsPerDay') OR
    COALESCE((SELECT json_extract(counters_json, '$.externalActions') FROM growth_activity_budget_usage_daily WHERE utc_day = NEW.utc_day), 0)
      + json_extract(NEW.cost_json, '$.externalActions') > json_extract(NEW.limits_json, '$.externalActionsPerDay')
    THEN RAISE(ABORT, 'GROWTH_ACTIVITY_BUDGET_DAILY_LIMIT') END;

  SELECT CASE WHEN NEW.target_domain_hash IS NOT NULL AND
    COALESCE((SELECT json_extract(domain_fetches_json, '$."' || NEW.target_domain_hash || '"') FROM growth_activity_budget_usage_daily WHERE utc_day = NEW.utc_day), 0)
      + json_extract(NEW.cost_json, '$.externalFetches') > json_extract(NEW.limits_json, '$.fetchesPerDomainPerDay')
    THEN RAISE(ABORT, 'GROWTH_ACTIVITY_BUDGET_DOMAIN_LIMIT') END;

  SELECT CASE WHEN NEW.target_domain_hash IS NOT NULL AND
    COALESCE((SELECT json_extract(domain_failures_json, '$."' || NEW.target_domain_hash || '"') FROM growth_activity_budget_usage_daily WHERE utc_day = NEW.utc_day), 0)
      >= json_extract(NEW.limits_json, '$.consecutiveFetchFailuresPerRun')
      AND json_extract(NEW.cost_json, '$.externalFetches') > 0
    THEN RAISE(ABORT, 'GROWTH_ACTIVITY_BUDGET_FAILURE_CIRCUIT') END;

  SELECT CASE WHEN NEW.target_domain_hash IS NOT NULL AND
    (SELECT json_extract(domain_last_research_json, '$."' || NEW.target_domain_hash || '"') FROM growth_activity_budget_usage_daily WHERE utc_day = NEW.utc_day) IS NOT NULL
    AND (
      strftime('%s', NEW.created_at_iso) - strftime('%s', (
        SELECT json_extract(domain_last_research_json, '$."' || NEW.target_domain_hash || '"')
        FROM growth_activity_budget_usage_daily WHERE utc_day = NEW.utc_day
      ))
    ) < json_extract(NEW.limits_json, '$.minimumResearchCooldownMinutes') * 60
    AND json_extract(NEW.cost_json, '$.externalFetches') > 0
    THEN RAISE(ABORT, 'GROWTH_ACTIVITY_BUDGET_COOLDOWN') END;
END;

CREATE TRIGGER IF NOT EXISTS apply_growth_activity_budget_claim
AFTER INSERT ON growth_activity_budget_claims
BEGIN
  INSERT INTO growth_activity_budget_usage_daily (
    utc_day,
    counters_json,
    domain_fetches_json,
    domain_failures_json,
    domain_last_research_json,
    created_at_iso,
    updated_at_iso
  ) VALUES (
    NEW.utc_day,
    NEW.cost_json,
    CASE WHEN NEW.target_domain_hash IS NOT NULL AND json_extract(NEW.cost_json, '$.externalFetches') > 0
      THEN json_object(NEW.target_domain_hash, json_extract(NEW.cost_json, '$.externalFetches')) ELSE '{}' END,
    '{}',
    CASE WHEN NEW.target_domain_hash IS NOT NULL AND json_extract(NEW.cost_json, '$.externalFetches') > 0
      THEN json_object(NEW.target_domain_hash, NEW.created_at_iso) ELSE '{}' END,
    NEW.created_at_iso,
    NEW.created_at_iso
  )
  ON CONFLICT(utc_day) DO UPDATE SET
    counters_json = json_set(
      growth_activity_budget_usage_daily.counters_json,
      '$.manualResearchRuns', json_extract(growth_activity_budget_usage_daily.counters_json, '$.manualResearchRuns') + json_extract(NEW.cost_json, '$.manualResearchRuns'),
      '$.scheduledExternalResearchRuns', json_extract(growth_activity_budget_usage_daily.counters_json, '$.scheduledExternalResearchRuns') + json_extract(NEW.cost_json, '$.scheduledExternalResearchRuns'),
      '$.externalFetches', json_extract(growth_activity_budget_usage_daily.counters_json, '$.externalFetches') + json_extract(NEW.cost_json, '$.externalFetches'),
      '$.distinctDomains', json_extract(growth_activity_budget_usage_daily.counters_json, '$.distinctDomains') + json_extract(NEW.cost_json, '$.distinctDomains'),
      '$.candidateWrites', json_extract(growth_activity_budget_usage_daily.counters_json, '$.candidateWrites') + json_extract(NEW.cost_json, '$.candidateWrites'),
      '$.proposalWrites', json_extract(growth_activity_budget_usage_daily.counters_json, '$.proposalWrites') + json_extract(NEW.cost_json, '$.proposalWrites'),
      '$.reportsGenerated', json_extract(growth_activity_budget_usage_daily.counters_json, '$.reportsGenerated') + json_extract(NEW.cost_json, '$.reportsGenerated'),
      '$.workerRequests', json_extract(growth_activity_budget_usage_daily.counters_json, '$.workerRequests') + json_extract(NEW.cost_json, '$.workerRequests'),
      '$.d1RowsRead', json_extract(growth_activity_budget_usage_daily.counters_json, '$.d1RowsRead') + json_extract(NEW.cost_json, '$.d1RowsRead'),
      '$.d1RowsWritten', json_extract(growth_activity_budget_usage_daily.counters_json, '$.d1RowsWritten') + json_extract(NEW.cost_json, '$.d1RowsWritten'),
      '$.queueOperations', json_extract(growth_activity_budget_usage_daily.counters_json, '$.queueOperations') + json_extract(NEW.cost_json, '$.queueOperations'),
      '$.browserMinutes', json_extract(growth_activity_budget_usage_daily.counters_json, '$.browserMinutes') + json_extract(NEW.cost_json, '$.browserMinutes'),
      '$.aiCalls', json_extract(growth_activity_budget_usage_daily.counters_json, '$.aiCalls') + json_extract(NEW.cost_json, '$.aiCalls'),
      '$.paidServiceCalls', json_extract(growth_activity_budget_usage_daily.counters_json, '$.paidServiceCalls') + json_extract(NEW.cost_json, '$.paidServiceCalls'),
      '$.externalActions', json_extract(growth_activity_budget_usage_daily.counters_json, '$.externalActions') + json_extract(NEW.cost_json, '$.externalActions')
    ),
    domain_fetches_json = CASE
      WHEN NEW.target_domain_hash IS NOT NULL AND json_extract(NEW.cost_json, '$.externalFetches') > 0
      THEN json_set(
        growth_activity_budget_usage_daily.domain_fetches_json,
        '$."' || NEW.target_domain_hash || '"',
        COALESCE(json_extract(growth_activity_budget_usage_daily.domain_fetches_json, '$."' || NEW.target_domain_hash || '"'), 0)
          + json_extract(NEW.cost_json, '$.externalFetches')
      )
      ELSE growth_activity_budget_usage_daily.domain_fetches_json
    END,
    domain_last_research_json = CASE
      WHEN NEW.target_domain_hash IS NOT NULL AND json_extract(NEW.cost_json, '$.externalFetches') > 0
      THEN json_set(
        growth_activity_budget_usage_daily.domain_last_research_json,
        '$."' || NEW.target_domain_hash || '"',
        NEW.created_at_iso
      )
      ELSE growth_activity_budget_usage_daily.domain_last_research_json
    END,
    updated_at_iso = NEW.created_at_iso;
END;

CREATE TRIGGER IF NOT EXISTS protect_growth_activity_budget_claim_update
BEFORE UPDATE ON growth_activity_budget_claims
BEGIN
  SELECT CASE WHEN
    OLD.claim_id <> NEW.claim_id OR
    OLD.utc_day <> NEW.utc_day OR
    OLD.action <> NEW.action OR
    OLD.invocation <> NEW.invocation OR
    OLD.profile_intensity <> NEW.profile_intensity OR
    OLD.requested_units <> NEW.requested_units OR
    OLD.target_domain_hash IS NOT NEW.target_domain_hash OR
    OLD.cost_json <> NEW.cost_json OR
    OLD.limits_json <> NEW.limits_json OR
    OLD.request_body_sha256 <> NEW.request_body_sha256 OR
    OLD.created_at_iso <> NEW.created_at_iso OR
    OLD.expires_at_iso <> NEW.expires_at_iso
    THEN RAISE(ABORT, 'GROWTH_ACTIVITY_BUDGET_CLAIM_IMMUTABLE') END;
  SELECT CASE WHEN OLD.status <> 'admitted' OR NEW.status NOT IN ('completed', 'failed')
    THEN RAISE(ABORT, 'GROWTH_ACTIVITY_BUDGET_CLAIM_TRANSITION_INVALID') END;
  SELECT CASE WHEN NEW.completed_at_iso IS NULL OR datetime(NEW.completed_at_iso) IS NULL OR NEW.completed_at_iso < NEW.created_at_iso
    THEN RAISE(ABORT, 'GROWTH_ACTIVITY_BUDGET_CLAIM_COMPLETION_INVALID') END;
  SELECT CASE WHEN NEW.outcome_code IS NULL
    THEN RAISE(ABORT, 'GROWTH_ACTIVITY_BUDGET_CLAIM_OUTCOME_REQUIRED') END;
END;

CREATE TRIGGER IF NOT EXISTS reconcile_growth_activity_budget_claim_outcome
AFTER UPDATE OF status ON growth_activity_budget_claims
BEGIN
  UPDATE growth_activity_budget_usage_daily
  SET domain_failures_json = CASE
      WHEN NEW.target_domain_hash IS NULL OR json_extract(NEW.cost_json, '$.externalFetches') = 0
      THEN domain_failures_json
      WHEN NEW.status = 'completed'
      THEN json_set(domain_failures_json, '$."' || NEW.target_domain_hash || '"', 0)
      ELSE json_set(
        domain_failures_json,
        '$."' || NEW.target_domain_hash || '"',
        COALESCE(json_extract(domain_failures_json, '$."' || NEW.target_domain_hash || '"'), 0) + 1
      )
    END,
    updated_at_iso = NEW.completed_at_iso
  WHERE utc_day = NEW.utc_day;
END;

CREATE TRIGGER IF NOT EXISTS prevent_growth_activity_budget_claim_delete
BEFORE DELETE ON growth_activity_budget_claims
BEGIN
  SELECT RAISE(ABORT, 'GROWTH_ACTIVITY_BUDGET_CLAIM_DELETE_FORBIDDEN');
END;
