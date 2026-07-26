import { Env, nowISO, safeJsonParse, uuid } from "../db";
import {
  containsSensitiveGrowthInputKey,
  deepFreezeGrowthJson,
} from "./growthInternalWriteRequest";

export type GrowthApprovalStatus = "pending" | "approved" | "rejected" | "archived";

export interface GrowthApprovalRequestInput {
  source?: string;
  step?: string;
  route?: string;
  method?: string;
  requiresConfirm?: boolean;
  dashboardAnchor?: string | null;
  setupGap?: string | null;
  targetCampaignId?: string | null;
  targetCampaignName?: string | null;
  payloadHint?: Record<string, unknown> | null;
  payload?: Record<string, unknown> | null;
  reviewChecklist?: string[];
  explicitBlocks?: string[];
  auditReason?: string[];
  safety?: Record<string, unknown> | null;
}

export interface GrowthApprovalRequestRow {
  id: string;
  created_at: string;
  updated_at: string;
  status: GrowthApprovalStatus;
  source: string;
  step: string;
  route: string;
  method: string;
  requires_confirm: number;
  dashboard_anchor: string | null;
  setup_gap: string | null;
  target_campaign_id: string | null;
  target_campaign_name: string | null;
  payload_json: string;
  review_checklist_json: string;
  explicit_blocks_json: string;
  audit_reason_json: string;
  safety_json: string;
  reviewer: string | null;
  decision_note: string | null;
  reviewed_at: string | null;
}

export type GrowthApprovalRequest = ReturnType<typeof hydrateGrowthApprovalRequest>;
export type GrowthApprovalRequestSummary = Readonly<{
  id: string;
  createdAt: string;
  updatedAt: string;
  status: GrowthApprovalStatus;
  source: string;
  step: string;
  route: string;
  method: string;
  requiresConfirm: boolean;
  dashboardAnchor: string | null;
  hasSetupGap: boolean;
  targetCampaignId: string | null;
  targetCampaignName: string | null;
  hasPayloadHint: boolean;
  payloadHintKeyCount: number;
  reviewChecklist: readonly string[];
  explicitBlocks: readonly string[];
  auditReason: readonly string[];
  reviewer: string | null;
  hasDecisionNote: boolean;
  reviewedAt: string | null;
  externalStateChange: false;
  callsAI: false;
  callsNetwork: false;
  canSendEmail: false;
  canPostSocial: false;
  canSubmitForms: false;
}>;

const DEFAULT_EXPLICIT_BLOCKS = Object.freeze([
  "send_email",
  "post_social",
  "submit_form",
  "browser_execution",
  "paid_spend",
  "crm_write",
  "external_delivery",
  "ai_drafting",
]);
const SAFE_APPROVAL_SAFETY = Object.freeze({
  internalMetadataOnly: true,
  externalStateChange: false,
  callsAI: false,
  callsNetwork: false,
  canSendEmail: false,
  canPostSocial: false,
  canSubmitForms: false,
});
const MAX_PAYLOAD_BYTES = 12_000;

function stringify(value: unknown) {
  return JSON.stringify(value ?? null);
}

function sanitizeString(value: unknown, fallback: string, max = 512) {
  const text = typeof value === "string" ? value.trim() : "";
  const result = text || fallback;
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(result)) {
    throw new Error("growth_approval_request_text_invalid");
  }
  return result.slice(0, max);
}

function nullableString(value: unknown, max: number): string | null {
  if (value === null || value === undefined || value === "") return null;
  return sanitizeString(value, "", max) || null;
}

function stringList(value: unknown, fallback: readonly string[], maximumItems: number, maximumLength: number): string[] {
  if (!Array.isArray(value)) return [...fallback];
  return value.slice(0, maximumItems).map((item) => sanitizeString(item, "review_required", maximumLength));
}

function boundedPayload(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  if (containsSensitiveGrowthInputKey(value)) {
    throw new Error("growth_approval_request_sensitive_input");
  }
  const serialised = JSON.stringify(value);
  if (new TextEncoder().encode(serialised).byteLength > MAX_PAYLOAD_BYTES) {
    throw new Error("growth_approval_request_payload_too_large");
  }
  return deepFreezeGrowthJson(JSON.parse(serialised) as Record<string, unknown>);
}

function normalizeStatus(status: unknown, fallback: GrowthApprovalStatus = "pending"): GrowthApprovalStatus {
  const text = String(status || fallback).toLowerCase();
  return ["pending", "approved", "rejected", "archived"].includes(text)
    ? text as GrowthApprovalStatus
    : fallback;
}

function normalizeMethod(method: unknown) {
  const text = String(method || "POST").toUpperCase();
  return text === "GET" ? "GET" : "POST";
}

function fixedSafety() {
  return { ...SAFE_APPROVAL_SAFETY };
}

export function hydrateGrowthApprovalRequest(row: GrowthApprovalRequestRow) {
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    status: row.status,
    source: row.source,
    step: row.step,
    route: row.route,
    method: row.method,
    requiresConfirm: Boolean(row.requires_confirm),
    dashboardAnchor: row.dashboard_anchor,
    setupGap: row.setup_gap,
    targetCampaignId: row.target_campaign_id,
    targetCampaignName: row.target_campaign_name,
    payloadHint: safeJsonParse<Record<string, unknown>>(row.payload_json) || {},
    reviewChecklist: safeJsonParse<string[]>(row.review_checklist_json) || [],
    explicitBlocks: safeJsonParse<string[]>(row.explicit_blocks_json) || [],
    auditReason: safeJsonParse<string[]>(row.audit_reason_json) || [],
    safety: safeJsonParse<Record<string, unknown>>(row.safety_json) || fixedSafety(),
    reviewer: row.reviewer,
    decisionNote: row.decision_note,
    reviewedAt: row.reviewed_at,
  };
}

export function toGrowthApprovalRequestSummary(
  request: GrowthApprovalRequest,
): GrowthApprovalRequestSummary {
  const payloadHint = request.payloadHint && typeof request.payloadHint === "object"
    ? request.payloadHint
    : {};
  return Object.freeze({
    id: request.id,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
    status: request.status,
    source: request.source,
    step: request.step,
    route: request.route,
    method: request.method,
    requiresConfirm: request.requiresConfirm,
    dashboardAnchor: request.dashboardAnchor,
    hasSetupGap: Boolean(request.setupGap),
    targetCampaignId: request.targetCampaignId,
    targetCampaignName: request.targetCampaignName,
    hasPayloadHint: Object.keys(payloadHint).length > 0,
    payloadHintKeyCount: Object.keys(payloadHint).length,
    reviewChecklist: Object.freeze(request.reviewChecklist.slice(0, 8)),
    explicitBlocks: Object.freeze(request.explicitBlocks.slice(0, 12)),
    auditReason: Object.freeze(request.auditReason.slice(0, 8)),
    reviewer: request.reviewer,
    hasDecisionNote: Boolean(request.decisionNote),
    reviewedAt: request.reviewedAt,
    externalStateChange: false,
    callsAI: false,
    callsNetwork: false,
    canSendEmail: false,
    canPostSocial: false,
    canSubmitForms: false,
  });
}

export async function listGrowthApprovalRequests(env: Env, limit = 25, status?: string) {
  const safeLimit = Math.max(1, Math.min(100, Math.round(limit)));
  const params: unknown[] = [];
  let where = "";
  if (status) {
    where = "WHERE status = ?";
    params.push(normalizeStatus(status));
  }
  params.push(safeLimit);
  const rows = await env.DB.prepare(
    `SELECT * FROM growth_approval_requests ${where} ORDER BY created_at DESC LIMIT ?`,
  ).bind(...params).all<GrowthApprovalRequestRow>();
  return (rows.results || []).map(hydrateGrowthApprovalRequest);
}

export async function listGrowthApprovalRequestSummaries(
  env: Env,
  limit = 25,
  status?: string,
): Promise<GrowthApprovalRequestSummary[]> {
  const requests = await listGrowthApprovalRequests(env, limit, status);
  return requests.map(toGrowthApprovalRequestSummary);
}

export async function saveGrowthApprovalRequest(env: Env, input: GrowthApprovalRequestInput, id?: string) {
  const now = nowISO();
  const requestId = sanitizeString(id || uuid(), uuid(), 128);
  const step = sanitizeString(input.step, "unknown_step", 128);
  const route = sanitizeString(input.route, "/admin/growth/unknown", 512);
  const method = normalizeMethod(input.method);
  const payload = boundedPayload(input.payloadHint || input.payload || {});
  const reviewChecklist = stringList(input.reviewChecklist, [], 8, 300);
  const explicitBlocks = stringList(
    input.explicitBlocks,
    DEFAULT_EXPLICIT_BLOCKS,
    12,
    100,
  );
  const auditReason = stringList(input.auditReason, [], 8, 300);
  const safety = fixedSafety();

  await env.DB.prepare(`
    INSERT INTO growth_approval_requests (
      id, created_at, updated_at, status, source, step, route, method, requires_confirm,
      dashboard_anchor, setup_gap, target_campaign_id, target_campaign_name,
      payload_json, review_checklist_json, explicit_blocks_json, audit_reason_json, safety_json
    ) VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      updated_at = excluded.updated_at,
      source = excluded.source,
      step = excluded.step,
      route = excluded.route,
      method = excluded.method,
      requires_confirm = 1,
      dashboard_anchor = excluded.dashboard_anchor,
      setup_gap = excluded.setup_gap,
      target_campaign_id = excluded.target_campaign_id,
      target_campaign_name = excluded.target_campaign_name,
      payload_json = excluded.payload_json,
      review_checklist_json = excluded.review_checklist_json,
      explicit_blocks_json = excluded.explicit_blocks_json,
      audit_reason_json = excluded.audit_reason_json,
      safety_json = excluded.safety_json
  `).bind(
    requestId,
    now,
    now,
    sanitizeString(input.source, "growth_operator", 128),
    step,
    route,
    method,
    nullableString(input.dashboardAnchor, 256),
    nullableString(input.setupGap, 1_000),
    nullableString(input.targetCampaignId, 128),
    nullableString(input.targetCampaignName, 256),
    stringify(payload),
    stringify(reviewChecklist),
    stringify(explicitBlocks),
    stringify(auditReason),
    stringify(safety),
  ).run();

  const row = await env.DB.prepare(
    "SELECT * FROM growth_approval_requests WHERE id = ?",
  ).bind(requestId).first<GrowthApprovalRequestRow>();
  if (!row) throw new Error("growth_approval_request_not_saved");
  return hydrateGrowthApprovalRequest(row);
}

export async function updateGrowthApprovalRequestStatus(
  env: Env,
  id: string,
  status: string,
  reviewer?: string,
  decisionNote?: string,
) {
  const normalizedStatus = normalizeStatus(status);
  const now = nowISO();
  await env.DB.prepare(`
    UPDATE growth_approval_requests
    SET status = ?, updated_at = ?, reviewer = ?, decision_note = ?, reviewed_at = ?
    WHERE id = ?
  `).bind(
    normalizedStatus,
    now,
    sanitizeString(reviewer, "admin", 128),
    nullableString(decisionNote, 2_000),
    normalizedStatus === "pending" ? null : now,
    sanitizeString(id, "", 128),
  ).run();

  const row = await env.DB.prepare(
    "SELECT * FROM growth_approval_requests WHERE id = ?",
  ).bind(id).first<GrowthApprovalRequestRow>();
  if (!row) throw new Error("growth_approval_request_not_found");
  return hydrateGrowthApprovalRequest(row);
}
