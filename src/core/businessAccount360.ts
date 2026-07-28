import type { Env } from "../db";
import {
  BUSINESS_ACCOUNT_DIMENSION_EVIDENCE_CONTRACT,
  buildBusinessAccountDimensionEvidence,
  businessAccountDimensionCoverage,
} from "./businessAccountDimensionEvidence";
import { businessAutopilotReadSafety } from "./businessAutopilotSafety";
import {
  BUSINESS_SCORE_PROVENANCE_CONTRACT,
  readBusinessObservedScore,
} from "./businessScoreProvenance";
import { validatePublicResearchUrl } from "./publicResearchFetch";

type Row = Record<string, unknown>;
type Account360Path =
  | Readonly<{ matched: false }>
  | Readonly<{ matched: true; organizationId: string | null }>;
type Coverage = Readonly<Record<string, Readonly<{
  status: string;
  matchedSignalTypes: readonly string[];
}>>>;

const PATH = /^\/admin\/business\/organizations\/([^/]+)\/account-360$/;
const IDENTIFIER = /^[A-Za-z0-9](?:[A-Za-z0-9._:-]{0,127})$/;
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return !normalized || CONTROL.test(normalized)
    ? null
    : normalized.slice(0, max);
}

function finiteNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || value.trim() !== value || !value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function httpStatusValue(value: unknown): number | null {
  const parsed = finiteNumber(value);
  return parsed !== null && Number.isInteger(parsed) && parsed >= 100 && parsed <= 599
    ? parsed
    : null;
}

function publicUrl(value: unknown): string | null {
  const candidate = text(value, 2_048);
  if (!candidate) return null;
  const decision = validatePublicResearchUrl(candidate);
  return decision.ok ? decision.url : null;
}

function stringArray(value: unknown): string[] {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed
      .filter((item): item is string => typeof item === "string")
      .map((item) => text(item, 160))
      .filter((item): item is string => Boolean(item)))].slice(0, 25);
  } catch {
    return [];
  }
}

function evidenceCount(value: unknown): number {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? Math.min(parsed.length, 100) : 0;
  } catch {
    return 0;
  }
}

function rows(result: { results?: Row[] | null }): Row[] {
  return Array.isArray(result.results) ? result.results : [];
}

function valueCounts(records: readonly Row[], field: string): Record<string, number> {
  return records.reduce<Record<string, number>>((counts, record) => {
    const value = text(record[field], 128) ?? "unknown";
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function statusCounts(records: readonly Row[]): Record<string, number> {
  return valueCounts(records, "status");
}

function timestampMilliseconds(value: unknown, observedAt: number): number | null {
  const candidate = text(value, 64);
  if (!candidate) return null;
  const parsed = Date.parse(candidate);
  return Number.isFinite(parsed) && parsed <= observedAt ? parsed : null;
}

function latestTimestamp(records: readonly Row[], observedAt: number): string | null {
  let latest: number | null = null;
  for (const record of records) {
    for (const value of [record.updatedAt, record.createdAt]) {
      const parsed = timestampMilliseconds(value, observedAt);
      if (parsed !== null && (latest === null || parsed > latest)) latest = parsed;
    }
  }
  return latest === null ? null : new Date(latest).toISOString();
}

function uncertainties(input: {
  organization: Row;
  returnedCounts: Record<string, number>;
  coverage: Coverage;
}): string[] {
  const result: string[] = [];
  if (!text(input.organization.industry, 255)) {
    result.push("Industry is not evidenced in the Worker record.");
  }
  if (!text(input.organization.location, 255)) {
    result.push("Location is not evidenced in the Worker record.");
  }
  if (!publicUrl(input.organization.websiteUrl) && !input.returnedCounts.websites) {
    result.push("No reviewed public website is linked to this organization.");
  }
  if (!input.returnedCounts.people) {
    result.push("No reviewed stakeholder records are linked to this organization.");
  }
  if (!input.returnedCounts.signals) {
    result.push("No evidence-backed account signals are stored.");
  }
  if (!input.returnedCounts.auditRuns) {
    result.push("No organization-linked website audit run is stored.");
  }
  if (!input.returnedCounts.auditObservations) {
    result.push("No reviewed website audit observations are stored for this organization.");
  }
  if (!input.returnedCounts.opportunities) {
    result.push("No internal opportunity hypothesis is stored.");
  }
  if (!input.returnedCounts.serviceMatches) {
    result.push("No evidence-linked EVAVO service match is stored.");
  }
  for (const [dimension, value] of Object.entries(input.coverage)) {
    if (value.status === "not_evidenced") {
      result.push(`${dimension} has no matching stored signal type; no conclusion is available.`);
    }
  }
  result.push(
    "Dimension evidence is built only from the bounded signals returned in this snapshot.",
    "Scores are returned only when their corresponding D1 observation flags are set.",
    "Explicit observed zero scores are preserved; legacy, missing or invalid scores are returned as null.",
    "Invalid or future-dated evidence timestamps are excluded from latest-evidence chronology.",
    "Relationship health is not computed because canonical conversations, meetings, email and project history belong to Operations Core.",
    "Budget amounts are not inferred; only stored likelihood indicators are shown.",
  );
  return result;
}

function reviewPrompts(counts: Record<string, number>, coverage: Coverage): string[] {
  const prompts: string[] = [];
  if (!counts.websites) prompts.push("Review and link a public organization website.");
  if (!counts.people) prompts.push("Research public stakeholder context for owner review.");
  if (!counts.signals) prompts.push("Run bounded public research and review the resulting evidence.");
  if (counts.websites && !counts.auditRuns) {
    prompts.push("Prepare a bounded website audit run for owner review.");
  }
  if (counts.auditRuns && !counts.auditObservations) {
    prompts.push("Review the latest audit run and record evidence-backed observations.");
  }
  if (!counts.opportunities && counts.signals) {
    prompts.push("Review stored signals before creating an internal opportunity hypothesis.");
  }
  if (!counts.serviceMatches && counts.opportunities) {
    prompts.push("Review opportunities against EVAVO services using cited evidence.");
  }
  if (!counts.followups && counts.opportunities) {
    prompts.push("Consider an internal follow-up plan; no message or meeting will be sent.");
  }
  if (
    counts.signals
    && coverage.procurement?.status === "not_evidenced"
    && coverage.buyingSignals?.status === "not_evidenced"
  ) {
    prompts.push("Review procurement and buying-signal evidence before estimating timing or budget.");
  }
  if (
    counts.signals
    && coverage.products?.status === "not_evidenced"
    && coverage.competitors?.status === "not_evidenced"
  ) {
    prompts.push("Review product and competitor evidence before finalising an account plan.");
  }
  return prompts;
}

async function readRows(
  env: Env,
  sql: string,
  organizationId: string,
  limit: number,
): Promise<Row[]> {
  return rows(await env.DB.prepare(sql).bind(organizationId, limit).all<Row>());
}

export function parseBusinessAccount360Path(pathname: string): Account360Path {
  const match = PATH.exec(pathname);
  if (!match) return { matched: false };
  try {
    const organizationId = decodeURIComponent(match[1]);
    return {
      matched: true,
      organizationId: IDENTIFIER.test(organizationId) ? organizationId : null,
    };
  } catch {
    return { matched: true, organizationId: null };
  }
}

export function parseBusinessAccount360Limit(url: URL):
  | Readonly<{ ok: true; value: number }>
  | Readonly<{ ok: false; error: string; fields: readonly string[] }> {
  const queryKeys = new Set<string>();
  url.searchParams.forEach((_value, key) => queryKeys.add(key));
  const unsupported = [...queryKeys]
    .filter((key) => key !== "limit")
    .sort();
  if (unsupported.length) {
    return { ok: false, error: "query_not_supported", fields: unsupported };
  }
  const values = url.searchParams.getAll("limit");
  if (!values.length) return { ok: true, value: 25 };
  if (values.length !== 1 || !/^[1-9]\d*$/.test(values[0])) {
    return { ok: false, error: "invalid_limit", fields: ["limit"] };
  }
  const value = Number(values[0]);
  return Number.isSafeInteger(value) && value <= 50
    ? { ok: true, value }
    : { ok: false, error: "invalid_limit", fields: ["limit"] };
}

export async function buildBusinessAccount360(
  env: Env,
  organizationId: string,
  limit: number,
  observedAt = Date.now(),
) {
  const organization = await env.DB.prepare(`
    SELECT id, name, domain, website_url AS websiteUrl, industry, location,
           source_type AS sourceType, source_url AS sourceUrl, status,
           fit_score AS fitScore, fit_score_observed AS fitScoreObserved,
           priority_score AS priorityScore, priority_score_observed AS priorityScoreObserved,
           risk_score AS riskScore, risk_score_observed AS riskScoreObserved,
           confidence_score AS confidenceScore, confidence_score_observed AS confidenceScoreObserved,
           created_at AS createdAt, updated_at AS updatedAt
    FROM business_organizations WHERE id = ? LIMIT 1
  `).bind(organizationId).first<Row>();
  if (!organization) return null;

  const [
    people,
    websites,
    pages,
    auditRuns,
    auditObservations,
    signals,
    opportunities,
    serviceMatches,
    auditPacks,
    followups,
  ] = await Promise.all([
    readRows(env, `SELECT id, name, role, source_type AS sourceType,
      allowed_use AS allowedUse, contact_status AS contactStatus,
      confidence_score AS confidenceScore,
      confidence_score_observed AS confidenceScoreObserved,
      CASE WHEN email IS NOT NULL AND trim(email) <> '' THEN 1 ELSE 0 END AS emailPresent,
      CASE WHEN phone IS NOT NULL AND trim(phone) <> '' THEN 1 ELSE 0 END AS phonePresent,
      CASE WHEN profile_url IS NOT NULL AND trim(profile_url) <> '' THEN 1 ELSE 0 END AS profileUrlPresent,
      CASE WHEN source_url IS NOT NULL AND trim(source_url) <> '' THEN 1 ELSE 0 END AS sourceUrlPresent,
      created_at AS createdAt, updated_at AS updatedAt
      FROM business_people WHERE organization_id = ?
      ORDER BY updated_at DESC, created_at DESC LIMIT ?`, organizationId, limit),
    readRows(env, `SELECT id, url, domain, status, last_checked_at AS lastCheckedAt,
      robots_status AS robotsStatus, crawl_allowed AS crawlAllowed,
      tech_hints_json AS techHintsJson, created_at AS createdAt, updated_at AS updatedAt
      FROM business_websites WHERE organization_id = ?
      ORDER BY updated_at DESC, created_at DESC LIMIT ?`, organizationId, limit),
    readRows(env, `SELECT id, website_id AS websiteId, url, page_type AS pageType,
      title, status, last_fetched_at AS lastFetchedAt, http_status AS httpStatus,
      content_hash AS contentHash, created_at AS createdAt, updated_at AS updatedAt
      FROM business_pages WHERE organization_id = ?
      ORDER BY updated_at DESC, created_at DESC LIMIT ?`, organizationId, limit),
    readRows(env, `SELECT id, website_id AS websiteId, status,
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
      ORDER BY updated_at DESC, created_at DESC LIMIT ?`, organizationId, limit),
    readRows(env, `SELECT id, audit_run_id AS auditRunId, website_id AS websiteId,
      page_id AS pageId, signal_id AS signalId, category, severity, title,
      evidence_summary AS evidenceSummary, recommendation,
      confidence_score AS confidenceScore,
      confidence_score_observed AS confidenceScoreObserved,
      created_at AS createdAt, updated_at AS updatedAt
      FROM business_audit_observations WHERE organization_id = ?
      ORDER BY CASE severity
        WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2
        WHEN 'low' THEN 3 ELSE 4 END,
        updated_at DESC, created_at DESC LIMIT ?`, organizationId, limit),
    readRows(env, `SELECT id, website_id AS websiteId, page_id AS pageId,
      signal_type AS signalType,
      signal_strength AS signalStrength,
      signal_strength_observed AS signalStrengthObserved,
      evidence_summary AS evidenceSummary, evidence_url AS evidenceUrl,
      confidence_score AS confidenceScore,
      confidence_score_observed AS confidenceScoreObserved,
      risk_flags_json AS riskFlagsJson,
      created_at AS createdAt, updated_at AS updatedAt
      FROM business_signals WHERE organization_id = ?
      ORDER BY signal_strength DESC, updated_at DESC, created_at DESC LIMIT ?`, organizationId, limit),
    readRows(env, `SELECT id, opportunity_type AS opportunityType, status, priority,
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
      ORDER BY fit_score DESC, need_score DESC, updated_at DESC LIMIT ?`, organizationId, limit),
    readRows(env, `SELECT id, opportunity_id AS opportunityId, signal_id AS signalId,
      service_key AS serviceKey, match_score AS matchScore,
      match_score_observed AS matchScoreObserved, reason,
      evidence_json AS evidenceJson, created_at AS createdAt, updated_at AS updatedAt
      FROM business_service_matches WHERE organization_id = ?
      ORDER BY match_score DESC, updated_at DESC LIMIT ?`, organizationId, limit),
    readRows(env, `SELECT id, opportunity_id AS opportunityId, title, summary,
      audit_type AS auditType, risk_flags_json AS riskFlagsJson,
      confidence_score AS confidenceScore,
      confidence_score_observed AS confidenceScoreObserved,
      status, created_at AS createdAt, updated_at AS updatedAt
      FROM business_audit_packs WHERE organization_id = ?
      ORDER BY updated_at DESC, created_at DESC LIMIT ?`, organizationId, limit),
    readRows(env, `SELECT id, person_id AS personId, opportunity_id AS opportunityId,
      followup_type AS followupType, due_at AS dueAt, status,
      CASE WHEN notes IS NOT NULL AND trim(notes) <> '' THEN 1 ELSE 0 END AS notesPresent,
      created_at AS createdAt, updated_at AS updatedAt
      FROM business_followups WHERE organization_id = ?
      ORDER BY CASE WHEN due_at IS NULL THEN 1 ELSE 0 END, due_at, updated_at DESC LIMIT ?`,
      organizationId, limit),
  ]);

  const stakeholders = people.map((row) => ({
    id: text(row.id, 128),
    name: text(row.name, 255) ?? "Unknown person",
    role: text(row.role, 255),
    sourceType: text(row.sourceType, 64),
    allowedUse: text(row.allowedUse, 64) ?? "unknown",
    contactStatus: text(row.contactStatus, 64) ?? "unknown",
    confidenceScore: readBusinessObservedScore(
      row.confidenceScore,
      row.confidenceScoreObserved,
    ),
    emailPresent: Boolean(row.emailPresent),
    phonePresent: Boolean(row.phonePresent),
    profileUrlPresent: Boolean(row.profileUrlPresent),
    sourceUrlPresent: Boolean(row.sourceUrlPresent),
    contactDetailsRedacted: true,
    sourceUrlsRedacted: true,
    createdAt: text(row.createdAt, 64),
    updatedAt: text(row.updatedAt, 64),
  }));
  const websiteEvidence = websites.map((row) => ({
    id: text(row.id, 128),
    url: publicUrl(row.url),
    domain: text(row.domain, 255),
    status: text(row.status, 64) ?? "unknown",
    lastCheckedAt: text(row.lastCheckedAt, 64),
    robotsStatus: text(row.robotsStatus, 64) ?? "unknown",
    crawlAllowed: Boolean(row.crawlAllowed),
    techHints: stringArray(row.techHintsJson),
    metadataRedacted: true,
    createdAt: text(row.createdAt, 64),
    updatedAt: text(row.updatedAt, 64),
  }));
  const pageEvidence = pages.map((row) => ({
    id: text(row.id, 128),
    websiteId: text(row.websiteId, 128),
    url: publicUrl(row.url),
    pageType: text(row.pageType, 64) ?? "unknown",
    title: text(row.title, 512),
    status: text(row.status, 64) ?? "unknown",
    lastFetchedAt: text(row.lastFetchedAt, 64),
    httpStatus: httpStatusValue(row.httpStatus),
    contentHashPresent: Boolean(text(row.contentHash, 256)),
    metadataRedacted: true,
    createdAt: text(row.createdAt, 64),
    updatedAt: text(row.updatedAt, 64),
  }));
  const auditRunEvidence = auditRuns.map((row) => ({
    id: text(row.id, 128),
    websiteId: text(row.websiteId, 128),
    status: text(row.status, 64) ?? "unknown",
    auditType: text(row.auditType, 128) ?? "website_funnel_audit",
    source: text(row.source, 128) ?? "unknown",
    requestedByPresent: Boolean(row.requestedByPresent),
    requestedByRedacted: true,
    startedAt: text(row.startedAt, 64),
    completedAt: text(row.completedAt, 64),
    readinessScore: readBusinessObservedScore(
      row.readinessScore,
      row.readinessScoreObserved,
    ),
    riskScore: readBusinessObservedScore(row.riskScore, row.riskScoreObserved),
    confidenceScore: readBusinessObservedScore(
      row.confidenceScore,
      row.confidenceScoreObserved,
    ),
    summary: text(row.summary, 2_000),
    metadataRedacted: true,
    createdAt: text(row.createdAt, 64),
    updatedAt: text(row.updatedAt, 64),
  }));
  const auditObservationEvidence = auditObservations.map((row) => ({
    id: text(row.id, 128),
    auditRunId: text(row.auditRunId, 128),
    websiteId: text(row.websiteId, 128),
    pageId: text(row.pageId, 128),
    signalId: text(row.signalId, 128),
    category: text(row.category, 128) ?? "general",
    severity: text(row.severity, 64) ?? "info",
    title: text(row.title, 512) ?? "Untitled observation",
    evidenceSummary: text(row.evidenceSummary, 2_000),
    recommendation: text(row.recommendation, 2_000),
    confidenceScore: readBusinessObservedScore(
      row.confidenceScore,
      row.confidenceScoreObserved,
    ),
    metadataRedacted: true,
    createdAt: text(row.createdAt, 64),
    updatedAt: text(row.updatedAt, 64),
  }));
  const signalEvidence = signals.map((row) => ({
    id: text(row.id, 128),
    websiteId: text(row.websiteId, 128),
    pageId: text(row.pageId, 128),
    signalType: text(row.signalType, 128) ?? "unknown",
    signalStrength: readBusinessObservedScore(
      row.signalStrength,
      row.signalStrengthObserved,
    ),
    evidenceSummary: text(row.evidenceSummary, 2_000),
    evidenceUrl: publicUrl(row.evidenceUrl),
    confidenceScore: readBusinessObservedScore(
      row.confidenceScore,
      row.confidenceScoreObserved,
    ),
    riskFlags: stringArray(row.riskFlagsJson),
    metadataRedacted: true,
    createdAt: text(row.createdAt, 64),
    updatedAt: text(row.updatedAt, 64),
  }));
  const opportunityContext = opportunities.map((row) => ({
    id: text(row.id, 128),
    opportunityType: text(row.opportunityType, 128) ?? "general",
    status: text(row.status, 64) ?? "unknown",
    priority: text(row.priority, 32) ?? "unknown",
    fitScore: readBusinessObservedScore(row.fitScore, row.fitScoreObserved),
    needScore: readBusinessObservedScore(row.needScore, row.needScoreObserved),
    urgencyScore: readBusinessObservedScore(
      row.urgencyScore,
      row.urgencyScoreObserved,
    ),
    budgetLikelihoodScore: readBusinessObservedScore(
      row.budgetLikelihoodScore,
      row.budgetLikelihoodScoreObserved,
    ),
    contactabilityScore: readBusinessObservedScore(
      row.contactabilityScore,
      row.contactabilityScoreObserved,
    ),
    evidenceQualityScore: readBusinessObservedScore(
      row.evidenceQualityScore,
      row.evidenceQualityScoreObserved,
    ),
    riskScore: readBusinessObservedScore(row.riskScore, row.riskScoreObserved),
    confidenceScore: readBusinessObservedScore(
      row.confidenceScore,
      row.confidenceScoreObserved,
    ),
    recommendedService: text(row.recommendedService, 255),
    recommendedAngle: text(row.recommendedAngle, 2_000),
    nextStep: text(row.nextStep, 2_000),
    budgetAmountKnown: false,
    metadataRedacted: true,
    createdAt: text(row.createdAt, 64),
    updatedAt: text(row.updatedAt, 64),
  }));
  const serviceMatchContext = serviceMatches.map((row) => ({
    id: text(row.id, 128),
    opportunityId: text(row.opportunityId, 128),
    signalId: text(row.signalId, 128),
    serviceKey: text(row.serviceKey, 128) ?? "unknown",
    matchScore: readBusinessObservedScore(row.matchScore, row.matchScoreObserved),
    reason: text(row.reason, 2_000),
    evidenceItemCount: evidenceCount(row.evidenceJson),
    evidencePayloadRedacted: true,
    metadataRedacted: true,
    createdAt: text(row.createdAt, 64),
    updatedAt: text(row.updatedAt, 64),
  }));
  const auditPackEvidence = auditPacks.map((row) => ({
    id: text(row.id, 128),
    opportunityId: text(row.opportunityId, 128),
    title: text(row.title, 512) ?? "Untitled audit pack",
    summary: text(row.summary, 2_000),
    auditType: text(row.auditType, 128) ?? "unknown",
    riskFlags: stringArray(row.riskFlagsJson),
    confidenceScore: readBusinessObservedScore(
      row.confidenceScore,
      row.confidenceScoreObserved,
    ),
    status: text(row.status, 64) ?? "unknown",
    findingsRedacted: true,
    recommendationsRedacted: true,
    metadataRedacted: true,
    createdAt: text(row.createdAt, 64),
    updatedAt: text(row.updatedAt, 64),
  }));
  const followupContext = followups.map((row) => ({
    id: text(row.id, 128),
    personId: text(row.personId, 128),
    opportunityId: text(row.opportunityId, 128),
    followupType: text(row.followupType, 128) ?? "manual_review",
    dueAt: text(row.dueAt, 64),
    status: text(row.status, 64) ?? "unknown",
    notesPresent: Boolean(row.notesPresent),
    notesRedacted: true,
    metadataRedacted: true,
    createdAt: text(row.createdAt, 64),
    updatedAt: text(row.updatedAt, 64),
  }));

  const returnedCounts = {
    people: stakeholders.length,
    websites: websiteEvidence.length,
    pages: pageEvidence.length,
    auditRuns: auditRunEvidence.length,
    auditObservations: auditObservationEvidence.length,
    signals: signalEvidence.length,
    opportunities: opportunityContext.length,
    serviceMatches: serviceMatchContext.length,
    auditPacks: auditPackEvidence.length,
    followups: followupContext.length,
  };
  const recordsMayBeTruncated = Object.values(returnedCounts)
    .some((returnedCount) => returnedCount >= limit);
  const signalTypes = signalEvidence.map((row) => row.signalType);
  const dimensions = buildBusinessAccountDimensionEvidence(
    signalEvidence,
    observedAt,
  );
  const coverage = businessAccountDimensionCoverage(dimensions);
  const allProjected = [
    { createdAt: text(organization.createdAt, 64), updatedAt: text(organization.updatedAt, 64) },
    ...stakeholders,
    ...websiteEvidence,
    ...pageEvidence,
    ...auditRunEvidence,
    ...auditObservationEvidence,
    ...signalEvidence,
    ...opportunityContext,
    ...serviceMatchContext,
    ...auditPackEvidence,
    ...followupContext,
  ];

  return {
    auditEvidenceContract: "business_account_360_audit_evidence_v1",
    dimensionEvidenceContract: BUSINESS_ACCOUNT_DIMENSION_EVIDENCE_CONTRACT,
    numericEvidenceContract: "business_account_360_observed_scores_v1",
    scoreProvenanceContract: BUSINESS_SCORE_PROVENANCE_CONTRACT,
    timelineEvidenceContract: "business_account_360_bounded_chronology_v1",
    organization: {
      id: text(organization.id, 128),
      name: text(organization.name, 255) ?? "Unknown organization",
      domain: text(organization.domain, 255),
      websiteUrl: publicUrl(organization.websiteUrl),
      industry: text(organization.industry, 255),
      location: text(organization.location, 255),
      sourceType: text(organization.sourceType, 64),
      sourceUrl: publicUrl(organization.sourceUrl),
      status: text(organization.status, 64) ?? "unknown",
      fitScore: readBusinessObservedScore(
        organization.fitScore,
        organization.fitScoreObserved,
      ),
      priorityScore: readBusinessObservedScore(
        organization.priorityScore,
        organization.priorityScoreObserved,
      ),
      riskScore: readBusinessObservedScore(
        organization.riskScore,
        organization.riskScoreObserved,
      ),
      confidenceScore: readBusinessObservedScore(
        organization.confidenceScore,
        organization.confidenceScoreObserved,
      ),
      metadata: {},
      metadataRedacted: true,
      createdAt: text(organization.createdAt, 64),
      updatedAt: text(organization.updatedAt, 64),
    },
    accountEvidence: {
      websites: websiteEvidence,
      pages: pageEvidence,
      auditRuns: auditRunEvidence,
      auditObservations: auditObservationEvidence,
      signals: signalEvidence,
      auditPacks: auditPackEvidence,
      dimensions,
    },
    relationshipContext: {
      stakeholders,
      followups: followupContext,
      relationshipHealth: {
        status: "not_computed",
        reason: "Canonical conversations, meetings, email, documents, proposals, invoices and project history belong to Operations Core.",
      },
    },
    commercialContext: {
      opportunities: opportunityContext,
      serviceMatches: serviceMatchContext,
      dealHealth: {
        status: "not_computed",
        reason: "Worker evidence is advisory and cannot replace canonical pipeline state.",
      },
    },
    deterministicIndicators: {
      returnedCounts,
      signalTypeCounts: signalTypes.reduce<Record<string, number>>((counts, signalType) => {
        counts[signalType] = (counts[signalType] ?? 0) + 1;
        return counts;
      }, {}),
      auditRunStatusCounts: statusCounts(auditRunEvidence),
      auditObservationSeverityCounts: valueCounts(auditObservationEvidence, "severity"),
      auditObservationCategoryCounts: valueCounts(auditObservationEvidence, "category"),
      opportunityStatusCounts: statusCounts(opportunityContext),
      followupStatusCounts: statusCounts(followupContext),
      dimensionCoverage: coverage,
      latestEvidenceAt: latestTimestamp(allProjected, observedAt),
      timelineSemantics: {
        output: "canonical_iso_8601",
        invalidTimestampsExcluded: true,
        futureTimestampsExcluded: true,
      },
      scoreSemantics: {
        range: "0_to_100",
        missingValue: null,
        observationFlagsRequired: true,
        explicitZeroPreserved: true,
        unobservedValuesReturnedAsNull: true,
      },
      dimensionSemantics: {
        source: "bounded_returned_signal_rows",
        classification: "deterministic_signal_type_keywords",
        evidenceItemsPerDimension: 5,
        missingDimensionsRemainUnknown: true,
        externalResearchTriggered: false,
      },
      countsAreReturnedRowsOnly: true,
      recordsMayBeTruncated,
      snapshotConsistency: "best_effort_bounded_multi_query",
    },
    uncertainties: uncertainties({ organization, returnedCounts, coverage }),
    reviewPrompts: reviewPrompts(returnedCounts, coverage),
  };
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function businessAccount360Failure(error: unknown) {
  const errorMessage = errorText(error);
  const missingScoreProvenance = /(?:no such column:\s*[^\s]*_observed|has no column named\s+[^\s]*_observed)/i.test(errorMessage);
  const missingAuditTable = /no such table: business_(website_audit_runs|audit_observations)/i.test(errorMessage);
  const missingFoundationTable = /no such table: business_(organizations|people|websites|pages|signals|opportunities|service_matches|audit_packs|followups)/i.test(errorMessage);
  const missingTable = missingScoreProvenance || missingAuditTable || missingFoundationTable;
  return {
    ok: false,
    mode: "business_account_360_error",
    contract: "business_account_360_read_v1",
    error: missingTable ? "business_autopilot_schema_missing" : "business_account_360_failed",
    message: missingScoreProvenance
      ? "Account 360 requires the Business score observation provenance schema."
      : missingTable
        ? "Account 360 requires the Business Autopilot foundation and website audit schemas."
        : "Account 360 failed before a safe evidence view could be returned.",
    requiredMigration: missingScoreProvenance
      ? "0024_business_score_observation_flags.sql"
      : missingAuditTable
        ? "0022_business_website_audit_records.sql"
        : missingFoundationTable
          ? "0021_business_autopilot_foundation.sql"
          : null,
    rawErrorExposed: false,
    contactDetailsExposed: false,
    metadataExposed: false,
    canonicalStateMutated: false,
    externalExecutionAllowed: false,
    safety: businessAutopilotReadSafety(),
  };
}
