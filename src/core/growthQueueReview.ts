import { Env, nowISO } from "../db";
import { GrowthActionRow, GrowthSignalRow } from "./growthEngagementReadModels";

export type GrowthSignalReviewStatus = "new" | "triaged" | "watch" | "ignored" | "duplicate" | "converted_to_action" | "blocked";
export type GrowthActionReviewStatus = "queued" | "needs_review" | "approved" | "rejected" | "blocked" | "archived";

const allowedSignalStatuses = new Set<GrowthSignalReviewStatus>([
  "new",
  "triaged",
  "watch",
  "ignored",
  "duplicate",
  "converted_to_action",
  "blocked",
]);

const allowedActionStatuses = new Set<GrowthActionReviewStatus>([
  "queued",
  "needs_review",
  "approved",
  "rejected",
  "blocked",
  "archived",
]);

function normalizeStatus(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

function requireId(id: unknown): string {
  const safeId = String(id || "").trim();
  if (!safeId) throw new Error("growth_queue_review_id_required");
  return safeId;
}

export async function updateGrowthSignalStatus(env: Env, id: unknown, status: unknown): Promise<GrowthSignalRow> {
  const safeId = requireId(id);
  const nextStatus = normalizeStatus(status) as GrowthSignalReviewStatus;
  if (!allowedSignalStatuses.has(nextStatus)) throw new Error("growth_signal_status_not_allowed");

  await env.DB.prepare(
    `UPDATE growth_signals SET status = ?, updated_at = ? WHERE id = ?`
  ).bind(nextStatus, nowISO(), safeId).run();

  const row = await env.DB.prepare(
    `SELECT id, goal_id, channel_id, source_url, source_title, signal_type,
            service_match, audience_match, evidence, urgency, fit_score, risk_score,
            cost_score, status, duplicate_key, discovered_at, created_at, updated_at
     FROM growth_signals WHERE id = ? LIMIT 1`
  ).bind(safeId).first<GrowthSignalRow>();

  if (!row) throw new Error("growth_signal_not_found");
  return row;
}

export async function updateGrowthActionStatus(env: Env, id: unknown, status: unknown, blockedReason?: unknown): Promise<GrowthActionRow> {
  const safeId = requireId(id);
  const nextStatus = normalizeStatus(status) as GrowthActionReviewStatus;
  if (!allowedActionStatuses.has(nextStatus)) throw new Error("growth_action_status_not_allowed");

  await env.DB.prepare(
    `UPDATE growth_actions SET status = ?, blocked_reason = COALESCE(?, blocked_reason), updated_at = ? WHERE id = ?`
  ).bind(nextStatus, blockedReason ? String(blockedReason) : null, nowISO(), safeId).run();

  const row = await env.DB.prepare(
    `SELECT id, signal_id, channel_id, action_type, recommended_mode, reason,
            context_evidence, evavo_fit_explanation, channel_policy_result,
            link_policy_result, disclosure_policy_result, cost_estimate,
            risk_flags, status, approved_by, approved_at, executed_at,
            blocked_reason, created_at, updated_at
     FROM growth_actions WHERE id = ? LIMIT 1`
  ).bind(safeId).first<GrowthActionRow>();

  if (!row) throw new Error("growth_action_not_found");
  return row;
}
