import { Env, nowISO, safeJsonParse, uuid } from "../db";

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

const DEFAULT_EXPLICIT_BLOCKS = ["send_email", "post_social", "submit_form", "browser_execution", "paid_spend", "crm_write", "external_delivery", "ai_drafting"];
const SAFE_APPROVAL_SAFETY = { internalMetadataOnly: true, externalStateChange: false, callsAI: false, callsNetwork: false, canSendEmail: false, canPostSocial: false, canSubmitForms: false };

function stringify(value: unknown) {
  return JSON.stringify(value ?? null);
}

function sanitizeString(value: unknown, fallback: string, max = 512) {
  const text = typeof value === "string" ? value.trim() : "";
  return (text || fallback).slice(0, max);
}

function normalizeStatus(status: unknown, fallback: GrowthApprovalStatus = "pending"): GrowthApprovalStatus {
  const text = String(status || fallback).toLowerCase();
  return ["pending", "approved", "rejected", "archived"].includes(text) ? text as GrowthApprovalStatus : fallback;
}

function normalizeMethod(method: unknown) {
  const text = String(method || "POST").toUpperCase();
  return text === "GET" ? "GET" : "POST";
}

function mergeSafety(safety: Record<string, unknown> | null | undefined) {
  return { ...SAFE_APPROVAL_SAFETY, ...(safety || {}), externalStateChange: false, callsAI: false, callsNetwork: false, canSendEmail: false, canPostSocial: false, canSubmitForms: false };
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
    safety: safeJsonParse<Record<string, unknown>>(row.safety_json) || SAFE_APPROVAL_SAFETY,
    reviewer: row.reviewer,
    decisionNote: row.decision_note,
    reviewedAt: row.reviewed_at,
  };
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
  const rows = await env.DB.prepare(`SELECT * FROM growth_approval_requests ${where} ORDER BY created_at DESC LIMIT ?`).bind(...params).all<GrowthApprovalRequestRow>();
  return (rows.results || []).map(hydrateGrowthApprovalRequest);
}

export async function saveGrowthApprovalRequest(env: Env, input: GrowthApprovalRequestInput, id?: string) {
  const now = nowISO();
  const requestId = sanitizeString(id || uuid(), uuid(), 128);
  const step = sanitizeString(input.step, "unknown_step", 128);
  const route = sanitizeString(input.route, "/admin/growth/unknown", 512);
  const method = normalizeMethod(input.method);
  const payload = input.payloadHint || input.payload || {};
  const reviewChecklist = Array.isArray(input.reviewChecklist) ? input.reviewChecklist.map(String) : [];
  const explicitBlocks = Array.isArray(input.explicitBlocks) && input.explicitBlocks.length ? input.explicitBlocks.map(String) : DEFAULT_EXPLICIT_BLOCKS;
  const auditReason = Array.isArray(input.auditReason) ? input.auditReason.map(String) : [];
  const safety = mergeSafety(input.safety);

  await env.DB.prepare(`
    INSERT INTO growth_approval_requests (
      id, created_at, updated_at, status, source, step, route, method, requires_confirm,
      dashboard_anchor, setup_gap, target_campaign_id, target_campaign_name,
      payload_json, review_checklist_json, explicit_blocks_json, audit_reason_json, safety_json
    ) VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      updated_at = excluded.updated_at,
      source = excluded.source,
      step = excluded.step,
      route = excluded.route,
      method = excluded.method,
      requires_confirm = excluded.requires_confirm,
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
    input.requiresConfirm === false ? 0 : 1,
    input.dashboardAnchor || null,
    input.setupGap || null,
    input.targetCampaignId || null,
    input.targetCampaignName || null,
    stringify(payload),
    stringify(reviewChecklist),
    stringify(explicitBlocks),
    stringify(auditReason),
    stringify(safety),
  ).run();

  const row = await env.DB.prepare("SELECT * FROM growth_approval_requests WHERE id = ?").bind(requestId).first<GrowthApprovalRequestRow>();
  if (!row) throw new Error("growth_approval_request_not_saved");
  return hydrateGrowthApprovalRequest(row);
}

export async function updateGrowthApprovalRequestStatus(env: Env, id: string, status: string, reviewer?: string, decisionNote?: string) {
  const normalizedStatus = normalizeStatus(status);
  const now = nowISO();
  await env.DB.prepare(`
    UPDATE growth_approval_requests
    SET status = ?, updated_at = ?, reviewer = ?, decision_note = ?, reviewed_at = ?
    WHERE id = ?
  `).bind(normalizedStatus, now, reviewer || "admin", decisionNote || null, normalizedStatus === "pending" ? null : now, id).run();

  const row = await env.DB.prepare("SELECT * FROM growth_approval_requests WHERE id = ?").bind(id).first<GrowthApprovalRequestRow>();
  if (!row) throw new Error("growth_approval_request_not_found");
  return hydrateGrowthApprovalRequest(row);
}
