import { Env, safeJsonParse } from "../db";

export interface GrowthSignalRow {
  id: string;
  goal_id: string | null;
  channel_id: string | null;
  source_url: string;
  source_title: string | null;
  signal_type: string;
  service_match: string;
  audience_match: string;
  evidence: string;
  urgency: number;
  fit_score: number;
  risk_score: number;
  cost_score: number;
  status: string;
  duplicate_key: string | null;
  discovered_at: string;
  created_at: string;
  updated_at: string;
}

export interface GrowthActionRow {
  id: string;
  signal_id: string | null;
  channel_id: string | null;
  action_type: string;
  recommended_mode: string;
  reason: string;
  context_evidence: string | null;
  evavo_fit_explanation: string | null;
  channel_policy_result: string;
  link_policy_result: string;
  disclosure_policy_result: string;
  cost_estimate: string;
  risk_flags: string;
  status: string;
  approved_by: string | null;
  approved_at: string | null;
  executed_at: string | null;
  blocked_reason: string | null;
  created_at: string;
  updated_at: string;
}

function parseArray(value: string | null | undefined): unknown[] {
  const parsed = safeJsonParse<unknown[]>(value || "[]");
  return Array.isArray(parsed) ? parsed : [];
}

function parseObject(value: string | null | undefined): Record<string, unknown> {
  const parsed = safeJsonParse<Record<string, unknown>>(value || "{}");
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
}

function clampLimit(limit: number, fallback: number, max: number): number {
  if (!Number.isFinite(limit)) return fallback;
  return Math.min(max, Math.max(1, Math.round(limit)));
}

export function normalizeGrowthSignal(row: GrowthSignalRow) {
  return {
    id: row.id,
    goalId: row.goal_id,
    channelId: row.channel_id,
    sourceUrl: row.source_url,
    sourceTitle: row.source_title,
    signalType: row.signal_type,
    serviceMatch: parseArray(row.service_match),
    audienceMatch: parseArray(row.audience_match),
    evidence: row.evidence,
    urgency: Number(row.urgency || 0),
    fitScore: Number(row.fit_score || 0),
    riskScore: Number(row.risk_score || 0),
    costScore: Number(row.cost_score || 0),
    status: row.status,
    duplicateKey: row.duplicate_key,
    discoveredAt: row.discovered_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function normalizeGrowthAction(row: GrowthActionRow) {
  return {
    id: row.id,
    signalId: row.signal_id,
    channelId: row.channel_id,
    actionType: row.action_type,
    recommendedMode: row.recommended_mode,
    reason: row.reason,
    contextEvidence: row.context_evidence,
    evavoFitExplanation: row.evavo_fit_explanation,
    channelPolicyResult: parseObject(row.channel_policy_result),
    linkPolicyResult: parseObject(row.link_policy_result),
    disclosurePolicyResult: parseObject(row.disclosure_policy_result),
    costEstimate: parseObject(row.cost_estimate),
    riskFlags: parseArray(row.risk_flags),
    status: row.status,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    executedAt: row.executed_at,
    blockedReason: row.blocked_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listGrowthSignals(env: Env, limit = 50, status?: string) {
  const safeLimit = clampLimit(limit, 50, 200);
  const where = status ? "WHERE status = ?" : "";
  const stmt = env.DB.prepare(
    `SELECT id, goal_id, channel_id, source_url, source_title, signal_type, service_match,
            audience_match, evidence, urgency, fit_score, risk_score, cost_score, status,
            duplicate_key, discovered_at, created_at, updated_at
     FROM growth_signals
     ${where}
     ORDER BY fit_score DESC, discovered_at DESC
     LIMIT ?`
  );
  const result = status
    ? await stmt.bind(status, safeLimit).all<GrowthSignalRow>()
    : await stmt.bind(safeLimit).all<GrowthSignalRow>();
  return (result.results || []).map(normalizeGrowthSignal);
}

export async function listGrowthActions(env: Env, limit = 50, status?: string) {
  const safeLimit = clampLimit(limit, 50, 200);
  const where = status ? "WHERE status = ?" : "";
  const stmt = env.DB.prepare(
    `SELECT id, signal_id, channel_id, action_type, recommended_mode, reason,
            context_evidence, evavo_fit_explanation, channel_policy_result, link_policy_result,
            disclosure_policy_result, cost_estimate, risk_flags, status, approved_by, approved_at,
            executed_at, blocked_reason, created_at, updated_at
     FROM growth_actions
     ${where}
     ORDER BY updated_at DESC
     LIMIT ?`
  );
  const result = status
    ? await stmt.bind(status, safeLimit).all<GrowthActionRow>()
    : await stmt.bind(safeLimit).all<GrowthActionRow>();
  return (result.results || []).map(normalizeGrowthAction);
}
