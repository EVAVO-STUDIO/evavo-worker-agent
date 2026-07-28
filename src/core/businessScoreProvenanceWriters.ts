import { nowISO, uuid, type Env } from "../db";
import {
  buildBusinessAuditPack,
  type BusinessAuditPackInput,
} from "./businessAutopilotAuditPacks";
import type { BusinessPersonInput } from "./businessAutopilotPeopleRecords";
import {
  buildBusinessOpportunity,
  buildBusinessOrganization,
  buildBusinessServiceMatch,
  buildBusinessSignal,
  type BusinessOpportunityInput,
  type BusinessOrganizationInput,
  type BusinessServiceMatchInput,
  type BusinessSignalInput,
} from "./businessAutopilotTypes";
import type {
  BusinessAuditObservationInput,
  BusinessWebsiteAuditRunInput,
} from "./businessAutopilotWebsiteRecords";
import {
  BUSINESS_SCORE_PROVENANCE_CONTRACT,
  buildBusinessScoreWrite,
  businessOpportunityPriorityFromScores,
  businessScoreObserved,
  readBusinessObservedScore,
  type BusinessScoreWrite,
} from "./businessScoreProvenance";

type Row = Record<string, unknown>;

type BusinessOrganizationScoreInput = BusinessOrganizationInput & {
  id?: string;
  fitScore?: number | null;
  priorityScore?: number | null;
  riskScore?: number | null;
  confidenceScore?: number | null;
};

function stringify(value: unknown): string {
  return JSON.stringify(value ?? null);
}

function sanitizeString(value: unknown, fallback: string, max = 512): string {
  const text = typeof value === "string" ? value.trim() : "";
  return (text || fallback).slice(0, max);
}

function nullable(value: unknown, max = 512): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  return text ? text.slice(0, max) : null;
}

function observed(state: BusinessScoreWrite): boolean {
  return state.observed === 1;
}

function scoreResult(state: BusinessScoreWrite): number | null {
  return readBusinessObservedScore(state.value, state.observed);
}

export async function saveBusinessOrganization(
  env: Env,
  input: BusinessOrganizationScoreInput,
) {
  const now = nowISO();
  const base = buildBusinessOrganization(input);
  const id = sanitizeString(input.id || base.id || uuid(), uuid(), 128);
  const fit = buildBusinessScoreWrite(input.fitScore);
  const priority = buildBusinessScoreWrite(input.priorityScore);
  const risk = buildBusinessScoreWrite(input.riskScore);
  const confidence = buildBusinessScoreWrite(input.confidenceScore);

  await env.DB.prepare(`
    INSERT INTO business_organizations (
      id, name, domain, website_url, industry, location, source_type, source_url, status,
      fit_score, fit_score_observed, priority_score, priority_score_observed,
      risk_score, risk_score_observed, confidence_score, confidence_score_observed,
      metadata_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      domain = excluded.domain,
      website_url = excluded.website_url,
      industry = excluded.industry,
      location = excluded.location,
      source_type = excluded.source_type,
      source_url = excluded.source_url,
      status = excluded.status,
      fit_score = CASE WHEN ? = 1 THEN excluded.fit_score ELSE business_organizations.fit_score END,
      fit_score_observed = CASE WHEN ? = 1 THEN excluded.fit_score_observed ELSE business_organizations.fit_score_observed END,
      priority_score = CASE WHEN ? = 1 THEN excluded.priority_score ELSE business_organizations.priority_score END,
      priority_score_observed = CASE WHEN ? = 1 THEN excluded.priority_score_observed ELSE business_organizations.priority_score_observed END,
      risk_score = CASE WHEN ? = 1 THEN excluded.risk_score ELSE business_organizations.risk_score END,
      risk_score_observed = CASE WHEN ? = 1 THEN excluded.risk_score_observed ELSE business_organizations.risk_score_observed END,
      confidence_score = CASE WHEN ? = 1 THEN excluded.confidence_score ELSE business_organizations.confidence_score END,
      confidence_score_observed = CASE WHEN ? = 1 THEN excluded.confidence_score_observed ELSE business_organizations.confidence_score_observed END,
      metadata_json = excluded.metadata_json,
      updated_at = excluded.updated_at
  `).bind(
    id,
    base.name,
    base.domain,
    base.websiteUrl,
    base.industry,
    base.location,
    base.sourceType,
    base.sourceUrl,
    base.status,
    fit.value,
    fit.observed,
    priority.value,
    priority.observed,
    risk.value,
    risk.observed,
    confidence.value,
    confidence.observed,
    stringify(base.metadata),
    now,
    now,
    Number(fit.supplied),
    Number(fit.supplied),
    Number(priority.supplied),
    Number(priority.supplied),
    Number(risk.supplied),
    Number(risk.supplied),
    Number(confidence.supplied),
    Number(confidence.supplied),
  ).run();

  const row = await env.DB.prepare(`
    SELECT fit_score AS fitScore, fit_score_observed AS fitScoreObserved,
      priority_score AS priorityScore, priority_score_observed AS priorityScoreObserved,
      risk_score AS riskScore, risk_score_observed AS riskScoreObserved,
      confidence_score AS confidenceScore, confidence_score_observed AS confidenceScoreObserved,
      created_at AS createdAt, updated_at AS updatedAt
    FROM business_organizations WHERE id = ? LIMIT 1
  `).bind(id).first<Row>();

  return {
    ...base,
    id,
    fitScore: readBusinessObservedScore(row?.fitScore, row?.fitScoreObserved),
    priorityScore: readBusinessObservedScore(row?.priorityScore, row?.priorityScoreObserved),
    riskScore: readBusinessObservedScore(row?.riskScore, row?.riskScoreObserved),
    confidenceScore: readBusinessObservedScore(
      row?.confidenceScore,
      row?.confidenceScoreObserved,
    ),
    fitScoreObserved: businessScoreObserved(row?.fitScoreObserved),
    priorityScoreObserved: businessScoreObserved(row?.priorityScoreObserved),
    riskScoreObserved: businessScoreObserved(row?.riskScoreObserved),
    confidenceScoreObserved: businessScoreObserved(row?.confidenceScoreObserved),
    scoreProvenanceContract: BUSINESS_SCORE_PROVENANCE_CONTRACT,
    createdAt: nullable(row?.createdAt, 64) ?? now,
    updatedAt: nullable(row?.updatedAt, 64) ?? now,
  };
}

export async function saveBusinessSignal(
  env: Env,
  input: BusinessSignalInput & { id?: string },
) {
  const now = nowISO();
  const base = buildBusinessSignal(input);
  const id = sanitizeString(input.id || base.id || uuid(), uuid(), 128);
  const strength = buildBusinessScoreWrite(input.signalStrength);
  const confidence = buildBusinessScoreWrite(input.confidenceScore);

  await env.DB.prepare(`
    INSERT INTO business_signals (
      id, organization_id, website_id, page_id, signal_type,
      signal_strength, signal_strength_observed, evidence_summary, evidence_url,
      confidence_score, confidence_score_observed, risk_flags_json, metadata_json,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      signal_type = excluded.signal_type,
      signal_strength = excluded.signal_strength,
      signal_strength_observed = excluded.signal_strength_observed,
      evidence_summary = excluded.evidence_summary,
      evidence_url = excluded.evidence_url,
      confidence_score = excluded.confidence_score,
      confidence_score_observed = excluded.confidence_score_observed,
      risk_flags_json = excluded.risk_flags_json,
      metadata_json = excluded.metadata_json,
      updated_at = excluded.updated_at
  `).bind(
    id,
    base.organizationId,
    base.websiteId,
    base.pageId,
    base.signalType,
    strength.value,
    strength.observed,
    base.evidenceSummary,
    base.evidenceUrl,
    confidence.value,
    confidence.observed,
    stringify(base.riskFlags),
    stringify(base.metadata),
    now,
    now,
  ).run();

  return {
    ...base,
    id,
    signalStrength: scoreResult(strength),
    confidenceScore: scoreResult(confidence),
    signalStrengthObserved: observed(strength),
    confidenceScoreObserved: observed(confidence),
    scoreProvenanceContract: BUSINESS_SCORE_PROVENANCE_CONTRACT,
    createdAt: now,
    updatedAt: now,
  };
}

export async function saveBusinessOpportunity(
  env: Env,
  input: BusinessOpportunityInput & { id?: string },
) {
  const now = nowISO();
  const base = buildBusinessOpportunity(input);
  const id = sanitizeString(input.id || base.id || uuid(), uuid(), 128);
  const fit = buildBusinessScoreWrite(input.fitScore);
  const need = buildBusinessScoreWrite(input.needScore);
  const urgency = buildBusinessScoreWrite(input.urgencyScore);
  const budget = buildBusinessScoreWrite(input.budgetLikelihoodScore);
  const contactability = buildBusinessScoreWrite(input.contactabilityScore);
  const evidence = buildBusinessScoreWrite(input.evidenceQualityScore);
  const risk = buildBusinessScoreWrite(input.riskScore);
  const confidence = buildBusinessScoreWrite(input.confidenceScore);
  const priority = businessOpportunityPriorityFromScores(input);

  await env.DB.prepare(`
    INSERT INTO business_opportunities (
      id, organization_id, opportunity_type, status, priority,
      fit_score, fit_score_observed, need_score, need_score_observed,
      urgency_score, urgency_score_observed,
      budget_likelihood_score, budget_likelihood_score_observed,
      contactability_score, contactability_score_observed,
      evidence_quality_score, evidence_quality_score_observed,
      risk_score, risk_score_observed, confidence_score, confidence_score_observed,
      recommended_service, recommended_angle, next_step, metadata_json,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      opportunity_type = excluded.opportunity_type,
      status = excluded.status,
      priority = excluded.priority,
      fit_score = excluded.fit_score,
      fit_score_observed = excluded.fit_score_observed,
      need_score = excluded.need_score,
      need_score_observed = excluded.need_score_observed,
      urgency_score = excluded.urgency_score,
      urgency_score_observed = excluded.urgency_score_observed,
      budget_likelihood_score = excluded.budget_likelihood_score,
      budget_likelihood_score_observed = excluded.budget_likelihood_score_observed,
      contactability_score = excluded.contactability_score,
      contactability_score_observed = excluded.contactability_score_observed,
      evidence_quality_score = excluded.evidence_quality_score,
      evidence_quality_score_observed = excluded.evidence_quality_score_observed,
      risk_score = excluded.risk_score,
      risk_score_observed = excluded.risk_score_observed,
      confidence_score = excluded.confidence_score,
      confidence_score_observed = excluded.confidence_score_observed,
      recommended_service = excluded.recommended_service,
      recommended_angle = excluded.recommended_angle,
      next_step = excluded.next_step,
      metadata_json = excluded.metadata_json,
      updated_at = excluded.updated_at
  `).bind(
    id,
    base.organizationId,
    base.opportunityType,
    base.status,
    priority,
    fit.value,
    fit.observed,
    need.value,
    need.observed,
    urgency.value,
    urgency.observed,
    budget.value,
    budget.observed,
    contactability.value,
    contactability.observed,
    evidence.value,
    evidence.observed,
    risk.value,
    risk.observed,
    confidence.value,
    confidence.observed,
    base.recommendedService,
    base.recommendedAngle,
    base.nextStep,
    stringify(base.metadata),
    now,
    now,
  ).run();

  return {
    ...base,
    id,
    priority,
    fitScore: scoreResult(fit),
    needScore: scoreResult(need),
    urgencyScore: scoreResult(urgency),
    budgetLikelihoodScore: scoreResult(budget),
    contactabilityScore: scoreResult(contactability),
    evidenceQualityScore: scoreResult(evidence),
    riskScore: scoreResult(risk),
    confidenceScore: scoreResult(confidence),
    fitScoreObserved: observed(fit),
    needScoreObserved: observed(need),
    urgencyScoreObserved: observed(urgency),
    budgetLikelihoodScoreObserved: observed(budget),
    contactabilityScoreObserved: observed(contactability),
    evidenceQualityScoreObserved: observed(evidence),
    riskScoreObserved: observed(risk),
    confidenceScoreObserved: observed(confidence),
    scoreProvenanceContract: BUSINESS_SCORE_PROVENANCE_CONTRACT,
    createdAt: now,
    updatedAt: now,
  };
}

export async function saveBusinessServiceMatch(
  env: Env,
  input: BusinessServiceMatchInput & { id?: string },
) {
  const now = nowISO();
  const base = buildBusinessServiceMatch(input);
  const id = sanitizeString(input.id || base.id || uuid(), uuid(), 128);
  const match = buildBusinessScoreWrite(input.matchScore);

  await env.DB.prepare(`
    INSERT INTO business_service_matches (
      id, organization_id, opportunity_id, signal_id, service_key,
      match_score, match_score_observed, reason, evidence_json, metadata_json,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      service_key = excluded.service_key,
      match_score = excluded.match_score,
      match_score_observed = excluded.match_score_observed,
      reason = excluded.reason,
      evidence_json = excluded.evidence_json,
      metadata_json = excluded.metadata_json,
      updated_at = excluded.updated_at
  `).bind(
    id,
    base.organizationId,
    base.opportunityId,
    base.signalId,
    base.serviceKey,
    match.value,
    match.observed,
    base.reason,
    stringify(base.evidence),
    stringify(base.metadata),
    now,
    now,
  ).run();

  return {
    ...base,
    id,
    matchScore: scoreResult(match),
    matchScoreObserved: observed(match),
    scoreProvenanceContract: BUSINESS_SCORE_PROVENANCE_CONTRACT,
    createdAt: now,
    updatedAt: now,
  };
}

export async function saveBusinessAuditPack(
  env: Env,
  input: BusinessAuditPackInput & { id?: string; opportunityId?: string | null },
) {
  const now = nowISO();
  const base = buildBusinessAuditPack(input);
  const id = sanitizeString(input.id || base.id || uuid(), uuid(), 128);
  const confidence = buildBusinessScoreWrite(base.confidenceScore);

  await env.DB.prepare(`
    INSERT INTO business_audit_packs (
      id, organization_id, opportunity_id, title, summary, audit_type,
      findings_json, recommendations_json, risk_flags_json,
      confidence_score, confidence_score_observed, status, metadata_json,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      summary = excluded.summary,
      audit_type = excluded.audit_type,
      findings_json = excluded.findings_json,
      recommendations_json = excluded.recommendations_json,
      risk_flags_json = excluded.risk_flags_json,
      confidence_score = excluded.confidence_score,
      confidence_score_observed = excluded.confidence_score_observed,
      status = excluded.status,
      metadata_json = excluded.metadata_json,
      updated_at = excluded.updated_at
  `).bind(
    id,
    base.organizationId,
    input.opportunityId || null,
    base.title,
    base.summary,
    base.auditType,
    stringify(base.findings),
    stringify(base.recommendations),
    stringify(base.riskFlags),
    confidence.value,
    confidence.observed,
    base.status,
    stringify(base.metadata),
    now,
    now,
  ).run();

  return {
    ...base,
    id,
    opportunityId: input.opportunityId || null,
    confidenceScore: scoreResult(confidence),
    confidenceScoreObserved: observed(confidence),
    scoreProvenanceContract: BUSINESS_SCORE_PROVENANCE_CONTRACT,
    createdAt: now,
    updatedAt: now,
  };
}

export async function saveBusinessPerson(
  env: Env,
  input: BusinessPersonInput,
) {
  const now = nowISO();
  const id = sanitizeString(input.id || uuid(), uuid(), 128);
  const confidence = buildBusinessScoreWrite(input.confidenceScore);
  const record = {
    id,
    organizationId: nullable(input.organizationId, 128),
    name: sanitizeString(input.name, "Unknown person", 255),
    role: nullable(input.role, 255),
    email: nullable(input.email, 255),
    phone: nullable(input.phone, 64),
    profileUrl: nullable(input.profileUrl, 2_048),
    sourceType: sanitizeString(input.sourceType, "operator", 64),
    sourceUrl: nullable(input.sourceUrl, 2_048),
    allowedUse: sanitizeString(input.allowedUse, "unknown", 64),
    contactStatus: sanitizeString(input.contactStatus, "new", 64),
    metadata: input.metadata || {},
  };

  await env.DB.prepare(`
    INSERT INTO business_people (
      id, organization_id, name, role, email, phone, profile_url, source_type,
      source_url, allowed_use, contact_status,
      confidence_score, confidence_score_observed, metadata_json,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      organization_id = excluded.organization_id,
      name = excluded.name,
      role = excluded.role,
      email = excluded.email,
      phone = excluded.phone,
      profile_url = excluded.profile_url,
      source_type = excluded.source_type,
      source_url = excluded.source_url,
      allowed_use = excluded.allowed_use,
      contact_status = excluded.contact_status,
      confidence_score = excluded.confidence_score,
      confidence_score_observed = excluded.confidence_score_observed,
      metadata_json = excluded.metadata_json,
      updated_at = excluded.updated_at
  `).bind(
    id,
    record.organizationId,
    record.name,
    record.role,
    record.email,
    record.phone,
    record.profileUrl,
    record.sourceType,
    record.sourceUrl,
    record.allowedUse,
    record.contactStatus,
    confidence.value,
    confidence.observed,
    stringify(record.metadata),
    now,
    now,
  ).run();

  return {
    ...record,
    confidenceScore: scoreResult(confidence),
    confidenceScoreObserved: observed(confidence),
    scoreProvenanceContract: BUSINESS_SCORE_PROVENANCE_CONTRACT,
    createdAt: now,
    updatedAt: now,
  };
}

export async function saveBusinessWebsiteAuditRun(
  env: Env,
  input: BusinessWebsiteAuditRunInput,
) {
  const now = nowISO();
  const id = sanitizeString(input.id || uuid(), uuid(), 128);
  const readiness = buildBusinessScoreWrite(input.readinessScore);
  const risk = buildBusinessScoreWrite(input.riskScore);
  const confidence = buildBusinessScoreWrite(input.confidenceScore);
  const record = {
    id,
    websiteId: nullable(input.websiteId, 128),
    organizationId: nullable(input.organizationId, 128),
    status: sanitizeString(input.status, "queued", 64),
    auditType: sanitizeString(input.auditType, "website_funnel_audit", 128),
    source: sanitizeString(input.source, "operator", 128),
    requestedBy: nullable(input.requestedBy, 256),
    startedAt: nullable(input.startedAt, 64),
    completedAt: nullable(input.completedAt, 64),
    summary: nullable(input.summary, 2_048),
    metadata: input.metadata || {},
  };

  await env.DB.prepare(`
    INSERT INTO business_website_audit_runs (
      id, website_id, organization_id, status, audit_type, source, requested_by,
      started_at, completed_at,
      readiness_score, readiness_score_observed,
      risk_score, risk_score_observed,
      confidence_score, confidence_score_observed,
      summary, metadata_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      website_id = excluded.website_id,
      organization_id = excluded.organization_id,
      status = excluded.status,
      audit_type = excluded.audit_type,
      source = excluded.source,
      requested_by = excluded.requested_by,
      started_at = excluded.started_at,
      completed_at = excluded.completed_at,
      readiness_score = excluded.readiness_score,
      readiness_score_observed = excluded.readiness_score_observed,
      risk_score = excluded.risk_score,
      risk_score_observed = excluded.risk_score_observed,
      confidence_score = excluded.confidence_score,
      confidence_score_observed = excluded.confidence_score_observed,
      summary = excluded.summary,
      metadata_json = excluded.metadata_json,
      updated_at = excluded.updated_at
  `).bind(
    id,
    record.websiteId,
    record.organizationId,
    record.status,
    record.auditType,
    record.source,
    record.requestedBy,
    record.startedAt,
    record.completedAt,
    readiness.value,
    readiness.observed,
    risk.value,
    risk.observed,
    confidence.value,
    confidence.observed,
    record.summary,
    stringify(record.metadata),
    now,
    now,
  ).run();

  return {
    ...record,
    readinessScore: scoreResult(readiness),
    riskScore: scoreResult(risk),
    confidenceScore: scoreResult(confidence),
    readinessScoreObserved: observed(readiness),
    riskScoreObserved: observed(risk),
    confidenceScoreObserved: observed(confidence),
    scoreProvenanceContract: BUSINESS_SCORE_PROVENANCE_CONTRACT,
    createdAt: now,
    updatedAt: now,
  };
}

export async function saveBusinessAuditObservation(
  env: Env,
  input: BusinessAuditObservationInput,
) {
  const now = nowISO();
  const id = sanitizeString(input.id || uuid(), uuid(), 128);
  const confidence = buildBusinessScoreWrite(input.confidenceScore);
  const record = {
    id,
    auditRunId: nullable(input.auditRunId, 128),
    websiteId: nullable(input.websiteId, 128),
    organizationId: nullable(input.organizationId, 128),
    pageId: nullable(input.pageId, 128),
    signalId: nullable(input.signalId, 128),
    category: sanitizeString(input.category, "general", 128),
    severity: sanitizeString(input.severity, "info", 64),
    title: sanitizeString(input.title, "Untitled observation", 512),
    evidenceSummary: nullable(input.evidenceSummary, 2_048),
    recommendation: nullable(input.recommendation, 2_048),
    metadata: input.metadata || {},
  };

  await env.DB.prepare(`
    INSERT INTO business_audit_observations (
      id, audit_run_id, website_id, organization_id, page_id, signal_id,
      category, severity, title, evidence_summary, recommendation,
      confidence_score, confidence_score_observed, metadata_json,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      audit_run_id = excluded.audit_run_id,
      website_id = excluded.website_id,
      organization_id = excluded.organization_id,
      page_id = excluded.page_id,
      signal_id = excluded.signal_id,
      category = excluded.category,
      severity = excluded.severity,
      title = excluded.title,
      evidence_summary = excluded.evidence_summary,
      recommendation = excluded.recommendation,
      confidence_score = excluded.confidence_score,
      confidence_score_observed = excluded.confidence_score_observed,
      metadata_json = excluded.metadata_json,
      updated_at = excluded.updated_at
  `).bind(
    id,
    record.auditRunId,
    record.websiteId,
    record.organizationId,
    record.pageId,
    record.signalId,
    record.category,
    record.severity,
    record.title,
    record.evidenceSummary,
    record.recommendation,
    confidence.value,
    confidence.observed,
    stringify(record.metadata),
    now,
    now,
  ).run();

  return {
    ...record,
    confidenceScore: scoreResult(confidence),
    confidenceScoreObserved: observed(confidence),
    scoreProvenanceContract: BUSINESS_SCORE_PROVENANCE_CONTRACT,
    createdAt: now,
    updatedAt: now,
  };
}
