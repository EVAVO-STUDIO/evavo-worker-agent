import { Env, nowISO, safeJsonParse, uuid } from "../db";
import { businessAutopilotMetadataWriteSafety, businessAutopilotReadSafety } from "./businessAutopilotSafety";
import {
  BusinessActionDraftInput,
  BusinessApprovalRequestInput,
  BusinessOpportunityInput,
  BusinessOrganizationInput,
  BusinessServiceMatchInput,
  BusinessSignalInput,
  buildBusinessActionDraft,
  buildBusinessApprovalRequest,
  buildBusinessOpportunity,
  buildBusinessOrganization,
  buildBusinessServiceMatch,
  buildBusinessSignal,
} from "./businessAutopilotTypes";

function stringify(value: unknown) {
  return JSON.stringify(value ?? null);
}

function parse(value: unknown, fallback: unknown) {
  return safeJsonParse(value) ?? fallback;
}

function sanitizeString(value: unknown, fallback: string, max = 512) {
  const text = typeof value === "string" ? value.trim() : "";
  return (text || fallback).slice(0, max);
}

function nullable(value: unknown, max = 512) {
  const text = typeof value === "string" ? value.trim() : "";
  return text ? text.slice(0, max) : null;
}

function safeLimit(limit: number, fallback = 25, max = 100) {
  if (!Number.isFinite(limit)) return fallback;
  return Math.max(1, Math.min(max, Math.round(limit)));
}

function numberValue(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function booleanNumber(value: unknown) {
  return value ? 1 : 0;
}

export function businessReadPayload<T>(items: T[], key: string) {
  return {
    ok: true,
    [key]: items,
    count: items.length,
    safety: businessAutopilotReadSafety(),
  };
}

export function businessWritePayload<T>(record: T, key: string) {
  return {
    ok: true,
    [key]: record,
    safety: businessAutopilotMetadataWriteSafety(),
  };
}

export async function listBusinessOrganizations(env: Env, limit = 25, status?: string) {
  const params: unknown[] = [];
  let where = "";
  if (status) {
    where = "WHERE status = ?";
    params.push(sanitizeString(status, "new", 64));
  }
  params.push(safeLimit(limit));
  const rows = await env.DB.prepare(`SELECT * FROM business_organizations ${where} ORDER BY priority_score DESC, created_at DESC LIMIT ?`).bind(...params).all<any>();
  return (rows.results || []).map((row) => ({
    id: row.id,
    name: row.name,
    domain: row.domain,
    websiteUrl: row.website_url,
    industry: row.industry,
    location: row.location,
    sourceType: row.source_type,
    sourceUrl: row.source_url,
    status: row.status,
    fitScore: numberValue(row.fit_score),
    priorityScore: numberValue(row.priority_score),
    riskScore: numberValue(row.risk_score),
    confidenceScore: numberValue(row.confidence_score),
    metadata: parse(row.metadata_json, {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function saveBusinessOrganization(env: Env, input: BusinessOrganizationInput & { id?: string }) {
  const now = nowISO();
  const record = buildBusinessOrganization(input);
  const id = sanitizeString(input.id || record.id || uuid(), uuid(), 128);
  await env.DB.prepare(`
    INSERT INTO business_organizations (
      id, name, domain, website_url, industry, location, source_type, source_url, status,
      fit_score, priority_score, risk_score, confidence_score, metadata_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      domain = excluded.domain,
      website_url = excluded.website_url,
      industry = excluded.industry,
      location = excluded.location,
      source_type = excluded.source_type,
      source_url = excluded.source_url,
      status = excluded.status,
      metadata_json = excluded.metadata_json,
      updated_at = excluded.updated_at
  `).bind(
    id,
    record.name,
    record.domain,
    record.websiteUrl,
    record.industry,
    record.location,
    record.sourceType,
    record.sourceUrl,
    record.status,
    record.fitScore,
    record.priorityScore,
    record.riskScore,
    record.confidenceScore,
    stringify(record.metadata),
    now,
    now,
  ).run();
  return { ...record, id, createdAt: now, updatedAt: now };
}

export async function listBusinessSignals(env: Env, limit = 25, signalType?: string) {
  const params: unknown[] = [];
  let where = "";
  if (signalType) {
    where = "WHERE signal_type = ?";
    params.push(sanitizeString(signalType, "general", 128));
  }
  params.push(safeLimit(limit));
  const rows = await env.DB.prepare(`SELECT * FROM business_signals ${where} ORDER BY signal_strength DESC, created_at DESC LIMIT ?`).bind(...params).all<any>();
  return (rows.results || []).map((row) => ({
    id: row.id,
    organizationId: row.organization_id,
    websiteId: row.website_id,
    pageId: row.page_id,
    signalType: row.signal_type,
    signalStrength: numberValue(row.signal_strength),
    evidenceSummary: row.evidence_summary,
    evidenceUrl: row.evidence_url,
    confidenceScore: numberValue(row.confidence_score),
    riskFlags: parse(row.risk_flags_json, []),
    metadata: parse(row.metadata_json, {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function saveBusinessSignal(env: Env, input: BusinessSignalInput & { id?: string }) {
  const now = nowISO();
  const record = buildBusinessSignal(input);
  const id = sanitizeString(input.id || record.id || uuid(), uuid(), 128);
  await env.DB.prepare(`
    INSERT INTO business_signals (
      id, organization_id, website_id, page_id, signal_type, signal_strength, evidence_summary,
      evidence_url, confidence_score, risk_flags_json, metadata_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      signal_type = excluded.signal_type,
      signal_strength = excluded.signal_strength,
      evidence_summary = excluded.evidence_summary,
      evidence_url = excluded.evidence_url,
      confidence_score = excluded.confidence_score,
      risk_flags_json = excluded.risk_flags_json,
      metadata_json = excluded.metadata_json,
      updated_at = excluded.updated_at
  `).bind(
    id,
    record.organizationId,
    record.websiteId,
    record.pageId,
    record.signalType,
    record.signalStrength,
    record.evidenceSummary,
    record.evidenceUrl,
    record.confidenceScore,
    stringify(record.riskFlags),
    stringify(record.metadata),
    now,
    now,
  ).run();
  return { ...record, id, createdAt: now, updatedAt: now };
}

export async function listBusinessOpportunities(env: Env, limit = 25, status?: string) {
  const params: unknown[] = [];
  let where = "";
  if (status) {
    where = "WHERE status = ?";
    params.push(sanitizeString(status, "new", 64));
  }
  params.push(safeLimit(limit));
  const rows = await env.DB.prepare(`SELECT * FROM business_opportunities ${where} ORDER BY fit_score DESC, need_score DESC, created_at DESC LIMIT ?`).bind(...params).all<any>();
  return (rows.results || []).map((row) => ({
    id: row.id,
    organizationId: row.organization_id,
    opportunityType: row.opportunity_type,
    status: row.status,
    priority: row.priority,
    fitScore: numberValue(row.fit_score),
    needScore: numberValue(row.need_score),
    urgencyScore: numberValue(row.urgency_score),
    budgetLikelihoodScore: numberValue(row.budget_likelihood_score),
    contactabilityScore: numberValue(row.contactability_score),
    evidenceQualityScore: numberValue(row.evidence_quality_score),
    riskScore: numberValue(row.risk_score),
    confidenceScore: numberValue(row.confidence_score),
    recommendedService: row.recommended_service,
    recommendedAngle: row.recommended_angle,
    nextStep: row.next_step,
    metadata: parse(row.metadata_json, {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function saveBusinessOpportunity(env: Env, input: BusinessOpportunityInput & { id?: string }) {
  const now = nowISO();
  const record = buildBusinessOpportunity(input);
  const id = sanitizeString(input.id || record.id || uuid(), uuid(), 128);
  await env.DB.prepare(`
    INSERT INTO business_opportunities (
      id, organization_id, opportunity_type, status, priority, fit_score, need_score, urgency_score,
      budget_likelihood_score, contactability_score, evidence_quality_score, risk_score, confidence_score,
      recommended_service, recommended_angle, next_step, metadata_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      opportunity_type = excluded.opportunity_type,
      status = excluded.status,
      priority = excluded.priority,
      fit_score = excluded.fit_score,
      need_score = excluded.need_score,
      urgency_score = excluded.urgency_score,
      budget_likelihood_score = excluded.budget_likelihood_score,
      contactability_score = excluded.contactability_score,
      evidence_quality_score = excluded.evidence_quality_score,
      risk_score = excluded.risk_score,
      confidence_score = excluded.confidence_score,
      recommended_service = excluded.recommended_service,
      recommended_angle = excluded.recommended_angle,
      next_step = excluded.next_step,
      metadata_json = excluded.metadata_json,
      updated_at = excluded.updated_at
  `).bind(
    id,
    record.organizationId,
    record.opportunityType,
    record.status,
    record.priority,
    record.fitScore,
    record.needScore,
    record.urgencyScore,
    record.budgetLikelihoodScore,
    record.contactabilityScore,
    record.evidenceQualityScore,
    record.riskScore,
    record.confidenceScore,
    record.recommendedService,
    record.recommendedAngle,
    record.nextStep,
    stringify(record.metadata),
    now,
    now,
  ).run();
  return { ...record, id, createdAt: now, updatedAt: now };
}

export async function listBusinessServiceMatches(env: Env, limit = 25, serviceKey?: string) {
  const params: unknown[] = [];
  let where = "";
  if (serviceKey) {
    where = "WHERE service_key = ?";
    params.push(sanitizeString(serviceKey, "website_rebuild", 128));
  }
  params.push(safeLimit(limit));
  const rows = await env.DB.prepare(`SELECT * FROM business_service_matches ${where} ORDER BY match_score DESC, created_at DESC LIMIT ?`).bind(...params).all<any>();
  return (rows.results || []).map((row) => ({
    id: row.id,
    organizationId: row.organization_id,
    opportunityId: row.opportunity_id,
    signalId: row.signal_id,
    serviceKey: row.service_key,
    matchScore: numberValue(row.match_score),
    reason: row.reason,
    evidence: parse(row.evidence_json, []),
    metadata: parse(row.metadata_json, {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function saveBusinessServiceMatch(env: Env, input: BusinessServiceMatchInput & { id?: string }) {
  const now = nowISO();
  const record = buildBusinessServiceMatch(input);
  const id = sanitizeString(input.id || record.id || uuid(), uuid(), 128);
  await env.DB.prepare(`
    INSERT INTO business_service_matches (
      id, organization_id, opportunity_id, signal_id, service_key, match_score, reason, evidence_json, metadata_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      service_key = excluded.service_key,
      match_score = excluded.match_score,
      reason = excluded.reason,
      evidence_json = excluded.evidence_json,
      metadata_json = excluded.metadata_json,
      updated_at = excluded.updated_at
  `).bind(
    id,
    record.organizationId,
    record.opportunityId,
    record.signalId,
    record.serviceKey,
    record.matchScore,
    record.reason,
    stringify(record.evidence),
    stringify(record.metadata),
    now,
    now,
  ).run();
  return { ...record, id, createdAt: now, updatedAt: now };
}

export async function listBusinessActionDrafts(env: Env, limit = 25, status?: string) {
  const params: unknown[] = [];
  let where = "";
  if (status) {
    where = "WHERE status = ?";
    params.push(sanitizeString(status, "draft", 64));
  }
  params.push(safeLimit(limit));
  const rows = await env.DB.prepare(`SELECT * FROM business_action_drafts ${where} ORDER BY created_at DESC LIMIT ?`).bind(...params).all<any>();
  return (rows.results || []).map((row) => ({
    id: row.id,
    organizationId: row.organization_id,
    personId: row.person_id,
    opportunityId: row.opportunity_id,
    auditPackId: row.audit_pack_id,
    draftType: row.draft_type,
    channel: row.channel,
    subject: row.subject,
    body: row.body,
    payload: parse(row.payload_json, {}),
    riskFlags: parse(row.risk_flags_json, []),
    complianceStatus: row.compliance_status,
    approvalStatus: row.approval_status,
    status: row.status,
    metadata: parse(row.metadata_json, {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function saveBusinessActionDraft(env: Env, input: BusinessActionDraftInput & { id?: string }) {
  const now = nowISO();
  const record = buildBusinessActionDraft(input);
  const id = sanitizeString(input.id || record.id || uuid(), uuid(), 128);
  await env.DB.prepare(`
    INSERT INTO business_action_drafts (
      id, organization_id, person_id, opportunity_id, audit_pack_id, draft_type, channel, subject, body,
      payload_json, risk_flags_json, compliance_status, approval_status, status, metadata_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      draft_type = excluded.draft_type,
      channel = excluded.channel,
      subject = excluded.subject,
      body = excluded.body,
      payload_json = excluded.payload_json,
      risk_flags_json = excluded.risk_flags_json,
      compliance_status = excluded.compliance_status,
      approval_status = excluded.approval_status,
      status = excluded.status,
      metadata_json = excluded.metadata_json,
      updated_at = excluded.updated_at
  `).bind(
    id,
    record.organizationId,
    record.personId,
    record.opportunityId,
    record.auditPackId,
    record.draftType,
    record.channel,
    record.subject,
    record.body,
    stringify(record.payload),
    stringify(record.riskFlags),
    record.complianceStatus,
    record.approvalStatus,
    record.status,
    stringify(record.metadata),
    now,
    now,
  ).run();
  return { ...record, id, createdAt: now, updatedAt: now };
}

export async function listBusinessApprovalRequests(env: Env, limit = 25, status?: string) {
  const params: unknown[] = [];
  let where = "";
  if (status) {
    where = "WHERE status = ?";
    params.push(sanitizeString(status, "needs_review", 64));
  }
  params.push(safeLimit(limit));
  const rows = await env.DB.prepare(`SELECT * FROM business_approval_requests ${where} ORDER BY created_at DESC LIMIT ?`).bind(...params).all<any>();
  return (rows.results || []).map((row) => ({
    id: row.id,
    actionDraftId: row.action_draft_id,
    requestType: row.request_type,
    status: row.status,
    reviewChecklist: parse(row.review_checklist_json, []),
    riskFlags: parse(row.risk_flags_json, []),
    approvalReason: row.approval_reason,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    expiresAt: row.expires_at,
    metadata: parse(row.metadata_json, {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function saveBusinessApprovalRequest(env: Env, input: BusinessApprovalRequestInput & { id?: string }) {
  const now = nowISO();
  const record = buildBusinessApprovalRequest(input);
  const id = sanitizeString(input.id || record.id || uuid(), uuid(), 128);
  await env.DB.prepare(`
    INSERT INTO business_approval_requests (
      id, action_draft_id, request_type, status, review_checklist_json, risk_flags_json, approval_reason,
      approved_by, approved_at, expires_at, metadata_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      request_type = excluded.request_type,
      status = excluded.status,
      review_checklist_json = excluded.review_checklist_json,
      risk_flags_json = excluded.risk_flags_json,
      approval_reason = excluded.approval_reason,
      expires_at = excluded.expires_at,
      metadata_json = excluded.metadata_json,
      updated_at = excluded.updated_at
  `).bind(
    id,
    record.actionDraftId,
    record.requestType,
    record.status,
    stringify(record.reviewChecklist),
    stringify(record.riskFlags),
    record.approvalReason,
    record.approvedBy,
    record.approvedAt,
    record.expiresAt,
    stringify(record.metadata),
    now,
    now,
  ).run();
  return { ...record, id, createdAt: now, updatedAt: now };
}

export async function listBusinessSuppression(env: Env, limit = 25, activeOnly = true) {
  const where = activeOnly ? "WHERE active = 1" : "";
  const rows = await env.DB.prepare(`SELECT * FROM business_suppression_list ${where} ORDER BY created_at DESC LIMIT ?`).bind(safeLimit(limit)).all<any>();
  return (rows.results || []).map((row) => ({
    id: row.id,
    scopeType: row.scope_type,
    scopeValue: row.scope_value,
    reason: row.reason,
    source: row.source,
    active: row.active === 1,
    expiresAt: row.expires_at,
    metadata: parse(row.metadata_json, {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function saveBusinessSuppression(env: Env, input: any) {
  const now = nowISO();
  const id = sanitizeString(input.id || `suppression_${uuid()}`, `suppression_${uuid()}`, 128);
  await env.DB.prepare(`
    INSERT INTO business_suppression_list (id, scope_type, scope_value, reason, source, active, expires_at, metadata_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      scope_type = excluded.scope_type,
      scope_value = excluded.scope_value,
      reason = excluded.reason,
      source = excluded.source,
      active = excluded.active,
      expires_at = excluded.expires_at,
      metadata_json = excluded.metadata_json,
      updated_at = excluded.updated_at
  `).bind(
    id,
    sanitizeString(input.scopeType, "organization", 64),
    sanitizeString(input.scopeValue, "unknown", 512),
    sanitizeString(input.reason, "manual_do_not_contact", 256),
    sanitizeString(input.source, "operator", 128),
    booleanNumber(input.active ?? true),
    nullable(input.expiresAt, 64),
    stringify(input.metadata ?? {}),
    now,
    now,
  ).run();
  return { id, safety: businessAutopilotMetadataWriteSafety(), createdAt: now, updatedAt: now };
}

export async function listBusinessContentIdeas(env: Env, limit = 25, status?: string) {
  const params: unknown[] = [];
  let where = "";
  if (status) {
    where = "WHERE status = ?";
    params.push(sanitizeString(status, "draft", 64));
  }
  params.push(safeLimit(limit));
  const rows = await env.DB.prepare(`SELECT * FROM business_content_ideas ${where} ORDER BY priority_score DESC, created_at DESC LIMIT ?`).bind(...params).all<any>();
  return (rows.results || []).map((row) => ({
    id: row.id,
    title: row.title,
    contentType: row.content_type,
    summary: row.summary,
    sourceSignalIds: parse(row.source_signal_ids_json, []),
    targetSegment: row.target_segment,
    recommendedChannel: row.recommended_channel,
    priorityScore: numberValue(row.priority_score),
    status: row.status,
    metadata: parse(row.metadata_json, {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function saveBusinessContentIdea(env: Env, input: any) {
  const now = nowISO();
  const id = sanitizeString(input.id || `content_${uuid()}`, `content_${uuid()}`, 128);
  await env.DB.prepare(`
    INSERT INTO business_content_ideas (id, title, content_type, summary, source_signal_ids_json, target_segment, recommended_channel, priority_score, status, metadata_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      content_type = excluded.content_type,
      summary = excluded.summary,
      source_signal_ids_json = excluded.source_signal_ids_json,
      target_segment = excluded.target_segment,
      recommended_channel = excluded.recommended_channel,
      priority_score = excluded.priority_score,
      status = excluded.status,
      metadata_json = excluded.metadata_json,
      updated_at = excluded.updated_at
  `).bind(
    id,
    sanitizeString(input.title, "Untitled content idea", 256),
    sanitizeString(input.contentType, "post", 64),
    nullable(input.summary, 2000),
    stringify(input.sourceSignalIds ?? []),
    nullable(input.targetSegment, 256),
    nullable(input.recommendedChannel, 128),
    numberValue(input.priorityScore),
    sanitizeString(input.status, "draft", 64),
    stringify(input.metadata ?? {}),
    now,
    now,
  ).run();
  return { id, safety: businessAutopilotMetadataWriteSafety(), createdAt: now, updatedAt: now };
}

export async function listBusinessFollowups(env: Env, limit = 25, status?: string) {
  const params: unknown[] = [];
  let where = "";
  if (status) {
    where = "WHERE status = ?";
    params.push(sanitizeString(status, "open", 64));
  }
  params.push(safeLimit(limit));
  const rows = await env.DB.prepare(`SELECT * FROM business_followups ${where} ORDER BY due_at ASC, created_at DESC LIMIT ?`).bind(...params).all<any>();
  return (rows.results || []).map((row) => ({
    id: row.id,
    organizationId: row.organization_id,
    personId: row.person_id,
    opportunityId: row.opportunity_id,
    actionDraftId: row.action_draft_id,
    followupType: row.followup_type,
    dueAt: row.due_at,
    status: row.status,
    notes: row.notes,
    metadata: parse(row.metadata_json, {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function saveBusinessFollowup(env: Env, input: any) {
  const now = nowISO();
  const id = sanitizeString(input.id || `followup_${uuid()}`, `followup_${uuid()}`, 128);
  await env.DB.prepare(`
    INSERT INTO business_followups (id, organization_id, person_id, opportunity_id, action_draft_id, followup_type, due_at, status, notes, metadata_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      followup_type = excluded.followup_type,
      due_at = excluded.due_at,
      status = excluded.status,
      notes = excluded.notes,
      metadata_json = excluded.metadata_json,
      updated_at = excluded.updated_at
  `).bind(
    id,
    nullable(input.organizationId, 128),
    nullable(input.personId, 128),
    nullable(input.opportunityId, 128),
    nullable(input.actionDraftId, 128),
    sanitizeString(input.followupType, "manual_review", 128),
    nullable(input.dueAt, 64),
    sanitizeString(input.status, "open", 64),
    nullable(input.notes, 2000),
    stringify(input.metadata ?? {}),
    now,
    now,
  ).run();
  return { id, safety: businessAutopilotMetadataWriteSafety(), createdAt: now, updatedAt: now };
}

export async function listBusinessLearningEvents(env: Env, limit = 25, entityType?: string) {
  const params: unknown[] = [];
  let where = "";
  if (entityType) {
    where = "WHERE entity_type = ?";
    params.push(sanitizeString(entityType, "opportunity", 64));
  }
  params.push(safeLimit(limit));
  const rows = await env.DB.prepare(`SELECT * FROM business_learning_events ${where} ORDER BY created_at DESC LIMIT ?`).bind(...params).all<any>();
  return (rows.results || []).map((row) => ({
    id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    eventType: row.event_type,
    outcome: row.outcome,
    scoreDelta: numberValue(row.score_delta),
    notes: row.notes,
    metadata: parse(row.metadata_json, {}),
    createdAt: row.created_at,
  }));
}

export async function saveBusinessLearningEvent(env: Env, input: any) {
  const now = nowISO();
  const id = sanitizeString(input.id || `learning_${uuid()}`, `learning_${uuid()}`, 128);
  await env.DB.prepare(`
    INSERT INTO business_learning_events (id, entity_type, entity_id, event_type, outcome, score_delta, notes, metadata_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    sanitizeString(input.entityType, "opportunity", 64),
    sanitizeString(input.entityId, "unknown", 128),
    sanitizeString(input.eventType, "operator_feedback", 128),
    nullable(input.outcome, 256),
    numberValue(input.scoreDelta),
    nullable(input.notes, 2000),
    stringify(input.metadata ?? {}),
    now,
  ).run();
  return { id, safety: businessAutopilotMetadataWriteSafety(), createdAt: now };
}
