import { Env, nowISO, safeJsonParse, uuid } from "../db";
import { businessAutopilotMetadataWriteSafety, businessAutopilotReadSafety } from "./businessAutopilotSafety";
import { BusinessAuditPackInput, buildBusinessAuditPack } from "./businessAutopilotAuditPacks";
import { projectBusinessReadRecord } from "./businessReadProjection";
import {
  BUSINESS_SCORE_PROVENANCE_CONTRACT,
  readBusinessObservedScore,
} from "./businessScoreProvenance";

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

function safeLimit(limit: number, fallback = 25, max = 100) {
  if (!Number.isFinite(limit)) return fallback;
  return Math.max(1, Math.min(max, Math.round(limit)));
}

function numberValue(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function minimiseBusinessAuditPackResponse(pack: Record<string, unknown>) {
  const projected = projectBusinessReadRecord(pack);
  const metadataPresent = typeof projected.metadataPresent === "boolean"
    ? projected.metadataPresent
    : false;
  return {
    ...projected,
    metadata: {},
    metadataPresent,
    metadataRedacted: true,
    internalReviewOnly: true,
    executable: false,
    deliverable: false,
    authoritativeForExecution: false,
  };
}

export async function listBusinessAuditPacks(env: Env, limit = 25, status?: string) {
  const params: unknown[] = [];
  let where = "";
  if (status) {
    where = "WHERE status = ?";
    params.push(sanitizeString(status, "draft", 64));
  }
  params.push(safeLimit(limit));
  const rows = await env.DB.prepare(`SELECT * FROM business_audit_packs ${where} ORDER BY confidence_score_observed DESC, confidence_score DESC, created_at DESC LIMIT ?`).bind(...params).all<any>();
  return (rows.results || []).map((row) => ({
    id: row.id,
    organizationId: row.organization_id,
    opportunityId: row.opportunity_id,
    title: row.title,
    summary: row.summary,
    auditType: row.audit_type,
    findings: parse(row.findings_json, []),
    recommendations: parse(row.recommendations_json, []),
    riskFlags: parse(row.risk_flags_json, []),
    confidenceScore: readBusinessObservedScore(
      row.confidence_score,
      row.confidence_score_observed,
    ),
    status: row.status,
    metadata: parse(row.metadata_json, {}),
    scoreProvenanceContract: BUSINESS_SCORE_PROVENANCE_CONTRACT,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function saveBusinessAuditPack(env: Env, input: BusinessAuditPackInput & { id?: string; opportunityId?: string | null }) {
  const now = nowISO();
  const record = buildBusinessAuditPack(input);
  const id = sanitizeString(input.id || record.id || uuid(), uuid(), 128);
  await env.DB.prepare(`
    INSERT INTO business_audit_packs (
      id, organization_id, opportunity_id, title, summary, audit_type, findings_json,
      recommendations_json, risk_flags_json, confidence_score, status, metadata_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      summary = excluded.summary,
      audit_type = excluded.audit_type,
      findings_json = excluded.findings_json,
      recommendations_json = excluded.recommendations_json,
      risk_flags_json = excluded.risk_flags_json,
      confidence_score = excluded.confidence_score,
      status = excluded.status,
      metadata_json = excluded.metadata_json,
      updated_at = excluded.updated_at
  `).bind(
    id,
    record.organizationId,
    input.opportunityId || null,
    record.title,
    record.summary,
    record.auditType,
    stringify(record.findings),
    stringify(record.recommendations),
    stringify(record.riskFlags),
    numberValue(record.confidenceScore),
    record.status,
    stringify(record.metadata),
    now,
    now,
  ).run();
  return { ...record, id, opportunityId: input.opportunityId || null, createdAt: now, updatedAt: now, safety: businessAutopilotMetadataWriteSafety() };
}

export function businessAuditPackReadPayload(
  packs: Record<string, unknown>[],
): Readonly<Record<string, unknown>> {
  const minimizedPacks = packs.map(minimiseBusinessAuditPackResponse);
  return {
    ok: true,
    contract: "business_audit_pack_reads_v3_score_provenance",
    scoreProvenanceContract: BUSINESS_SCORE_PROVENANCE_CONTRACT,
    auditPacks: minimizedPacks,
    count: minimizedPacks.length,
    metadataRedacted: true,
    internalReviewOnly: true,
    executable: false,
    deliverable: false,
    authoritativeForExecution: false,
    safety: businessAutopilotReadSafety(),
  };
}
