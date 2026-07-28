import type { Env } from "../db";
import { safeJsonParse } from "../db";
import { projectBusinessReadCollection } from "./businessReadProjection";
import {
  BUSINESS_SCORE_PROVENANCE_CONTRACT,
  readBusinessObservedScore,
} from "./businessScoreProvenance";

type Row = Record<string, unknown>;

function rows(result: { results?: Row[] | null }): Row[] {
  return Array.isArray(result.results) ? result.results : [];
}

function safeLimit(limit: number, fallback = 25, max = 100): number {
  return Number.isFinite(limit)
    ? Math.max(1, Math.min(max, Math.round(limit)))
    : fallback;
}

function filterText(value: unknown, fallback: string, max: number): string {
  const text = typeof value === "string" ? value.trim() : "";
  return (text || fallback).slice(0, max);
}

function parsedJson<T>(value: unknown, fallback: T): T {
  return safeJsonParse<T>(value) ?? fallback;
}

function score(value: unknown, observed: unknown): number | null {
  return readBusinessObservedScore(value, observed);
}

export async function listBusinessOrganizationsWithScoreProvenance(
  env: Env,
  limit = 25,
  status?: string,
) {
  const params: unknown[] = [];
  const where = status ? "WHERE status = ?" : "";
  if (status) params.push(filterText(status, "new", 64));
  params.push(safeLimit(limit));
  const result = await env.DB.prepare(`
    SELECT * FROM business_organizations ${where}
    ORDER BY priority_score_observed DESC, priority_score DESC, created_at DESC
    LIMIT ?
  `).bind(...params).all<Row>();
  return projectBusinessReadCollection(rows(result).map((row) => ({
    id: row.id,
    name: row.name,
    domain: row.domain,
    websiteUrl: row.website_url,
    industry: row.industry,
    location: row.location,
    sourceType: row.source_type,
    sourceUrl: row.source_url,
    status: row.status,
    fitScore: score(row.fit_score, row.fit_score_observed),
    priorityScore: score(row.priority_score, row.priority_score_observed),
    riskScore: score(row.risk_score, row.risk_score_observed),
    confidenceScore: score(row.confidence_score, row.confidence_score_observed),
    metadata: parsedJson(row.metadata_json, {}),
    scoreProvenanceContract: BUSINESS_SCORE_PROVENANCE_CONTRACT,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  })));
}

export async function listBusinessPeopleWithScoreProvenance(
  env: Env,
  limit = 25,
  contactStatus?: string,
) {
  const params: unknown[] = [];
  const where = contactStatus ? "WHERE contact_status = ?" : "";
  if (contactStatus) params.push(filterText(contactStatus, "new", 64));
  params.push(safeLimit(limit));
  const result = await env.DB.prepare(`
    SELECT * FROM business_people ${where}
    ORDER BY updated_at DESC, created_at DESC
    LIMIT ?
  `).bind(...params).all<Row>();
  return projectBusinessReadCollection(rows(result).map((row) => ({
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    role: row.role,
    email: row.email,
    phone: row.phone,
    profileUrl: row.profile_url,
    sourceType: row.source_type,
    sourceUrl: row.source_url,
    allowedUse: row.allowed_use,
    contactStatus: row.contact_status,
    confidenceScore: score(row.confidence_score, row.confidence_score_observed),
    metadata: parsedJson(row.metadata_json, {}),
    scoreProvenanceContract: BUSINESS_SCORE_PROVENANCE_CONTRACT,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  })), { redactContactDetails: true });
}

export async function listBusinessSignalsWithScoreProvenance(
  env: Env,
  limit = 25,
  signalType?: string,
) {
  const params: unknown[] = [];
  const where = signalType ? "WHERE signal_type = ?" : "";
  if (signalType) params.push(filterText(signalType, "general", 128));
  params.push(safeLimit(limit));
  const result = await env.DB.prepare(`
    SELECT * FROM business_signals ${where}
    ORDER BY signal_strength_observed DESC, signal_strength DESC, created_at DESC
    LIMIT ?
  `).bind(...params).all<Row>();
  return projectBusinessReadCollection(rows(result).map((row) => ({
    id: row.id,
    organizationId: row.organization_id,
    websiteId: row.website_id,
    pageId: row.page_id,
    signalType: row.signal_type,
    signalStrength: score(row.signal_strength, row.signal_strength_observed),
    evidenceSummary: row.evidence_summary,
    evidenceUrl: row.evidence_url,
    confidenceScore: score(row.confidence_score, row.confidence_score_observed),
    riskFlags: parsedJson(row.risk_flags_json, []),
    metadata: parsedJson(row.metadata_json, {}),
    scoreProvenanceContract: BUSINESS_SCORE_PROVENANCE_CONTRACT,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  })));
}

export async function listBusinessOpportunitiesWithScoreProvenance(
  env: Env,
  limit = 25,
  status?: string,
) {
  const params: unknown[] = [];
  const where = status ? "WHERE status = ?" : "";
  if (status) params.push(filterText(status, "new", 64));
  params.push(safeLimit(limit));
  const result = await env.DB.prepare(`
    SELECT * FROM business_opportunities ${where}
    ORDER BY fit_score_observed DESC, fit_score DESC,
      need_score_observed DESC, need_score DESC, created_at DESC
    LIMIT ?
  `).bind(...params).all<Row>();
  return projectBusinessReadCollection(rows(result).map((row) => ({
    id: row.id,
    organizationId: row.organization_id,
    opportunityType: row.opportunity_type,
    status: row.status,
    priority: row.priority,
    fitScore: score(row.fit_score, row.fit_score_observed),
    needScore: score(row.need_score, row.need_score_observed),
    urgencyScore: score(row.urgency_score, row.urgency_score_observed),
    budgetLikelihoodScore: score(
      row.budget_likelihood_score,
      row.budget_likelihood_score_observed,
    ),
    contactabilityScore: score(
      row.contactability_score,
      row.contactability_score_observed,
    ),
    evidenceQualityScore: score(
      row.evidence_quality_score,
      row.evidence_quality_score_observed,
    ),
    riskScore: score(row.risk_score, row.risk_score_observed),
    confidenceScore: score(row.confidence_score, row.confidence_score_observed),
    recommendedService: row.recommended_service,
    recommendedAngle: row.recommended_angle,
    nextStep: row.next_step,
    metadata: parsedJson(row.metadata_json, {}),
    scoreProvenanceContract: BUSINESS_SCORE_PROVENANCE_CONTRACT,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  })));
}

export async function listBusinessServiceMatchesWithScoreProvenance(
  env: Env,
  limit = 25,
  serviceKey?: string,
) {
  const params: unknown[] = [];
  const where = serviceKey ? "WHERE service_key = ?" : "";
  if (serviceKey) params.push(filterText(serviceKey, "website_rebuild", 128));
  params.push(safeLimit(limit));
  const result = await env.DB.prepare(`
    SELECT * FROM business_service_matches ${where}
    ORDER BY match_score_observed DESC, match_score DESC, created_at DESC
    LIMIT ?
  `).bind(...params).all<Row>();
  return projectBusinessReadCollection(rows(result).map((row) => ({
    id: row.id,
    organizationId: row.organization_id,
    opportunityId: row.opportunity_id,
    signalId: row.signal_id,
    serviceKey: row.service_key,
    matchScore: score(row.match_score, row.match_score_observed),
    reason: row.reason,
    evidence: parsedJson(row.evidence_json, []),
    metadata: parsedJson(row.metadata_json, {}),
    scoreProvenanceContract: BUSINESS_SCORE_PROVENANCE_CONTRACT,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  })));
}

export async function listBusinessAuditPacksWithScoreProvenance(
  env: Env,
  limit = 25,
  status?: string,
) {
  const params: unknown[] = [];
  const where = status ? "WHERE status = ?" : "";
  if (status) params.push(filterText(status, "draft", 64));
  params.push(safeLimit(limit));
  const result = await env.DB.prepare(`
    SELECT * FROM business_audit_packs ${where}
    ORDER BY confidence_score_observed DESC, confidence_score DESC, created_at DESC
    LIMIT ?
  `).bind(...params).all<Row>();
  return projectBusinessReadCollection(rows(result).map((row) => ({
    id: row.id,
    organizationId: row.organization_id,
    opportunityId: row.opportunity_id,
    title: row.title,
    summary: row.summary,
    auditType: row.audit_type,
    findings: parsedJson(row.findings_json, []),
    recommendations: parsedJson(row.recommendations_json, []),
    riskFlags: parsedJson(row.risk_flags_json, []),
    confidenceScore: score(row.confidence_score, row.confidence_score_observed),
    status: row.status,
    metadata: parsedJson(row.metadata_json, {}),
    scoreProvenanceContract: BUSINESS_SCORE_PROVENANCE_CONTRACT,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  })));
}

export async function listBusinessWebsiteAuditRunsWithScoreProvenance(
  env: Env,
  limit = 25,
  status?: string,
) {
  const params: unknown[] = [];
  const where = status ? "WHERE status = ?" : "";
  if (status) params.push(filterText(status, "queued", 64));
  params.push(safeLimit(limit));
  const result = await env.DB.prepare(`
    SELECT * FROM business_website_audit_runs ${where}
    ORDER BY updated_at DESC, created_at DESC
    LIMIT ?
  `).bind(...params).all<Row>();
  return projectBusinessReadCollection(rows(result).map((row) => ({
    id: row.id,
    websiteId: row.website_id,
    organizationId: row.organization_id,
    status: row.status,
    auditType: row.audit_type,
    source: row.source,
    requestedBy: row.requested_by,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    readinessScore: score(row.readiness_score, row.readiness_score_observed),
    riskScore: score(row.risk_score, row.risk_score_observed),
    confidenceScore: score(row.confidence_score, row.confidence_score_observed),
    summary: row.summary,
    metadata: parsedJson(row.metadata_json, {}),
    scoreProvenanceContract: BUSINESS_SCORE_PROVENANCE_CONTRACT,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  })));
}

export async function listBusinessAuditObservationsWithScoreProvenance(
  env: Env,
  limit = 25,
  category?: string,
) {
  const params: unknown[] = [];
  const where = category ? "WHERE category = ?" : "";
  if (category) params.push(filterText(category, "general", 128));
  params.push(safeLimit(limit));
  const result = await env.DB.prepare(`
    SELECT * FROM business_audit_observations ${where}
    ORDER BY updated_at DESC, created_at DESC
    LIMIT ?
  `).bind(...params).all<Row>();
  return projectBusinessReadCollection(rows(result).map((row) => ({
    id: row.id,
    auditRunId: row.audit_run_id,
    websiteId: row.website_id,
    organizationId: row.organization_id,
    pageId: row.page_id,
    signalId: row.signal_id,
    category: row.category,
    severity: row.severity,
    title: row.title,
    evidenceSummary: row.evidence_summary,
    recommendation: row.recommendation,
    confidenceScore: score(row.confidence_score, row.confidence_score_observed),
    metadata: parsedJson(row.metadata_json, {}),
    scoreProvenanceContract: BUSINESS_SCORE_PROVENANCE_CONTRACT,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  })));
}
