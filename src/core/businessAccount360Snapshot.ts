import type { Env } from "../db";

type Row = Record<string, unknown>;
type BatchResult = Readonly<{ success?: boolean; results?: Row[] | null }>;

export const BUSINESS_ACCOUNT_360_SNAPSHOT_CONTRACT =
  "business_account_360_d1_batch_snapshot_v1" as const;
export const BUSINESS_ACCOUNT_360_SNAPSHOT_ORDER = Object.freeze([
  "organization",
  "people",
  "websites",
  "pages",
  "auditRuns",
  "auditObservations",
  "signals",
  "opportunities",
  "serviceMatches",
  "auditPacks",
  "followups",
] as const);
export const BUSINESS_ACCOUNT_360_SNAPSHOT_STATEMENT_COUNT =
  BUSINESS_ACCOUNT_360_SNAPSHOT_ORDER.length;

export type BusinessAccount360Snapshot = Readonly<{
  contract: typeof BUSINESS_ACCOUNT_360_SNAPSHOT_CONTRACT;
  snapshotConsistency: "d1_batch_read_transaction";
  statementCount: typeof BUSINESS_ACCOUNT_360_SNAPSHOT_STATEMENT_COUNT;
  organization: Row;
  people: readonly Row[];
  websites: readonly Row[];
  pages: readonly Row[];
  auditRuns: readonly Row[];
  auditObservations: readonly Row[];
  signals: readonly Row[];
  opportunities: readonly Row[];
  serviceMatches: readonly Row[];
  auditPacks: readonly Row[];
  followups: readonly Row[];
}>;

const SQL = Object.freeze({
  organization: `SELECT id, name, domain, website_url AS websiteUrl, industry, location,
    source_type AS sourceType, source_url AS sourceUrl, status,
    fit_score AS fitScore, fit_score_observed AS fitScoreObserved,
    priority_score AS priorityScore, priority_score_observed AS priorityScoreObserved,
    risk_score AS riskScore, risk_score_observed AS riskScoreObserved,
    confidence_score AS confidenceScore, confidence_score_observed AS confidenceScoreObserved,
    created_at AS createdAt, updated_at AS updatedAt
    FROM business_organizations WHERE id = ? LIMIT 1`,
  people: `SELECT id, name, role, source_type AS sourceType,
    allowed_use AS allowedUse, contact_status AS contactStatus,
    confidence_score AS confidenceScore,
    confidence_score_observed AS confidenceScoreObserved,
    CASE WHEN email IS NOT NULL AND trim(email) <> '' THEN 1 ELSE 0 END AS emailPresent,
    CASE WHEN phone IS NOT NULL AND trim(phone) <> '' THEN 1 ELSE 0 END AS phonePresent,
    CASE WHEN profile_url IS NOT NULL AND trim(profile_url) <> '' THEN 1 ELSE 0 END AS profileUrlPresent,
    CASE WHEN source_url IS NOT NULL AND trim(source_url) <> '' THEN 1 ELSE 0 END AS sourceUrlPresent,
    created_at AS createdAt, updated_at AS updatedAt
    FROM business_people WHERE organization_id = ?
    ORDER BY updated_at DESC, created_at DESC LIMIT ?`,
  websites: `SELECT id, url, domain, status, last_checked_at AS lastCheckedAt,
    robots_status AS robotsStatus, crawl_allowed AS crawlAllowed,
    tech_hints_json AS techHintsJson, created_at AS createdAt, updated_at AS updatedAt
    FROM business_websites WHERE organization_id = ?
    ORDER BY updated_at DESC, created_at DESC LIMIT ?`,
  pages: `SELECT id, website_id AS websiteId, url, page_type AS pageType,
    title, status, last_fetched_at AS lastFetchedAt, http_status AS httpStatus,
    content_hash AS contentHash, created_at AS createdAt, updated_at AS updatedAt
    FROM business_pages WHERE organization_id = ?
    ORDER BY updated_at DESC, created_at DESC LIMIT ?`,
  auditRuns: `SELECT id, website_id AS websiteId, status,
    audit_type AS auditType, source,
    CASE WHEN requested_by IS NOT NULL AND trim(requested_by) <> '' THEN 1 ELSE 0 END AS requestedByPresent,
    started_at AS startedAt, completed_at AS completedAt,
    readiness_score AS readinessScore,
    readiness_score_observed AS readinessScoreObserved,
    risk_score AS riskScore, risk_score_observed AS riskScoreObserved,
    confidence_score AS confidenceScore,
    confidence_score_observed AS confidenceScoreObserved,
    summary, created_at AS createdAt, updated_at AS updatedAt
    FROM business_website_audit_runs WHERE organization_id = ?
    ORDER BY updated_at DESC, created_at DESC LIMIT ?`,
  auditObservations: `SELECT id, audit_run_id AS auditRunId, website_id AS websiteId,
    page_id AS pageId, signal_id AS signalId, category, severity, title,
    evidence_summary AS evidenceSummary, recommendation,
    confidence_score AS confidenceScore,
    confidence_score_observed AS confidenceScoreObserved,
    created_at AS createdAt, updated_at AS updatedAt
    FROM business_audit_observations WHERE organization_id = ?
    ORDER BY CASE severity
      WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2
      WHEN 'low' THEN 3 ELSE 4 END,
      updated_at DESC, created_at DESC LIMIT ?`,
  signals: `SELECT id, website_id AS websiteId, page_id AS pageId,
    signal_type AS signalType,
    signal_strength AS signalStrength,
    signal_strength_observed AS signalStrengthObserved,
    evidence_summary AS evidenceSummary, evidence_url AS evidenceUrl,
    confidence_score AS confidenceScore,
    confidence_score_observed AS confidenceScoreObserved,
    risk_flags_json AS riskFlagsJson,
    created_at AS createdAt, updated_at AS updatedAt
    FROM business_signals WHERE organization_id = ?
    ORDER BY signal_strength DESC, updated_at DESC, created_at DESC LIMIT ?`,
  opportunities: `SELECT id, opportunity_type AS opportunityType, status, priority,
    fit_score AS fitScore, fit_score_observed AS fitScoreObserved,
    need_score AS needScore, need_score_observed AS needScoreObserved,
    urgency_score AS urgencyScore, urgency_score_observed AS urgencyScoreObserved,
    budget_likelihood_score AS budgetLikelihoodScore,
    budget_likelihood_score_observed AS budgetLikelihoodScoreObserved,
    contactability_score AS contactabilityScore,
    contactability_score_observed AS contactabilityScoreObserved,
    evidence_quality_score AS evidenceQualityScore,
    evidence_quality_score_observed AS evidenceQualityScoreObserved,
    risk_score AS riskScore, risk_score_observed AS riskScoreObserved,
    confidence_score AS confidenceScore,
    confidence_score_observed AS confidenceScoreObserved,
    recommended_service AS recommendedService,
    recommended_angle AS recommendedAngle, next_step AS nextStep,
    created_at AS createdAt, updated_at AS updatedAt
    FROM business_opportunities WHERE organization_id = ?
    ORDER BY fit_score DESC, need_score DESC, updated_at DESC LIMIT ?`,
  serviceMatches: `SELECT id, opportunity_id AS opportunityId, signal_id AS signalId,
    service_key AS serviceKey, match_score AS matchScore,
    match_score_observed AS matchScoreObserved, reason,
    evidence_json AS evidenceJson, created_at AS createdAt, updated_at AS updatedAt
    FROM business_service_matches WHERE organization_id = ?
    ORDER BY match_score DESC, updated_at DESC LIMIT ?`,
  auditPacks: `SELECT id, opportunity_id AS opportunityId, title, summary,
    audit_type AS auditType, risk_flags_json AS riskFlagsJson,
    confidence_score AS confidenceScore,
    confidence_score_observed AS confidenceScoreObserved,
    status, created_at AS createdAt, updated_at AS updatedAt
    FROM business_audit_packs WHERE organization_id = ?
    ORDER BY updated_at DESC, created_at DESC LIMIT ?`,
  followups: `SELECT id, person_id AS personId, opportunity_id AS opportunityId,
    followup_type AS followupType, due_at AS dueAt, status,
    CASE WHEN notes IS NOT NULL AND trim(notes) <> '' THEN 1 ELSE 0 END AS notesPresent,
    created_at AS createdAt, updated_at AS updatedAt
    FROM business_followups WHERE organization_id = ?
    ORDER BY CASE WHEN due_at IS NULL THEN 1 ELSE 0 END, due_at, updated_at DESC LIMIT ?`,
});

function resultRows(result: BatchResult, index: number): readonly Row[] {
  if (result?.success !== true || !Array.isArray(result.results)) {
    throw new Error(`BUSINESS_ACCOUNT_360_BATCH_RESULT_INVALID:${index}`);
  }
  return Object.freeze([...result.results]);
}

export async function readBusinessAccount360Snapshot(
  env: Env,
  organizationId: string,
  limit: number,
): Promise<BusinessAccount360Snapshot | null> {
  const statements = [
    env.DB.prepare(SQL.organization).bind(organizationId),
    ...BUSINESS_ACCOUNT_360_SNAPSHOT_ORDER.slice(1).map((key) =>
      env.DB.prepare(SQL[key]).bind(organizationId, limit)),
  ];
  if (statements.length !== BUSINESS_ACCOUNT_360_SNAPSHOT_STATEMENT_COUNT) {
    throw new Error("BUSINESS_ACCOUNT_360_BATCH_STATEMENT_COUNT_INVALID");
  }

  const results = await env.DB.batch<Row>(statements);
  if (!Array.isArray(results) || results.length !== BUSINESS_ACCOUNT_360_SNAPSHOT_STATEMENT_COUNT) {
    throw new Error("BUSINESS_ACCOUNT_360_BATCH_RESULT_COUNT_INVALID");
  }
  const ordered = results.map(resultRows);
  const organizationRows = ordered[0];
  if (organizationRows.length > 1) {
    throw new Error("BUSINESS_ACCOUNT_360_BATCH_ORGANIZATION_COUNT_INVALID");
  }
  if (!organizationRows.length) return null;

  return Object.freeze({
    contract: BUSINESS_ACCOUNT_360_SNAPSHOT_CONTRACT,
    snapshotConsistency: "d1_batch_read_transaction",
    statementCount: BUSINESS_ACCOUNT_360_SNAPSHOT_STATEMENT_COUNT,
    organization: Object.freeze({ ...organizationRows[0] }),
    people: ordered[1],
    websites: ordered[2],
    pages: ordered[3],
    auditRuns: ordered[4],
    auditObservations: ordered[5],
    signals: ordered[6],
    opportunities: ordered[7],
    serviceMatches: ordered[8],
    auditPacks: ordered[9],
    followups: ordered[10],
  });
}
