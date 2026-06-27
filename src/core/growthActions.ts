import { Env, nowISO, uuid } from "../db";
import { GrowthActionRow } from "./growthEngagementReadModels";

export interface GrowthActionInput {
  signalId?: string | null;
  channelId?: string | null;
  actionType: string;
  recommendedMode?: string;
  reason: string;
  contextEvidence?: string | null;
  evavoFitExplanation?: string | null;
  channelPolicyResult?: unknown;
  linkPolicyResult?: unknown;
  disclosurePolicyResult?: unknown;
  costEstimate?: unknown;
  riskFlags?: unknown[];
  status?: string;
  blockedReason?: string | null;
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function toJson(value: unknown): string {
  return JSON.stringify(value ?? {});
}

function toJsonArray(value: unknown): string {
  return JSON.stringify(Array.isArray(value) ? value : []);
}

export async function upsertGrowthAction(env: Env, input: GrowthActionInput, id = uuid()): Promise<GrowthActionRow> {
  const now = nowISO();
  const actionType = normalizeText(input.actionType || "");
  const reason = normalizeText(input.reason || "");

  if (!actionType) throw new Error("growth_action_type_required");
  if (!reason || reason.length < 12) throw new Error("growth_action_reason_too_short");

  await env.DB.prepare(
    `INSERT INTO growth_actions (
       id, signal_id, channel_id, action_type, recommended_mode, reason,
       context_evidence, evavo_fit_explanation, channel_policy_result,
       link_policy_result, disclosure_policy_result, cost_estimate,
       risk_flags, status, blocked_reason, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       signal_id = excluded.signal_id,
       channel_id = excluded.channel_id,
       action_type = excluded.action_type,
       recommended_mode = excluded.recommended_mode,
       reason = excluded.reason,
       context_evidence = excluded.context_evidence,
       evavo_fit_explanation = excluded.evavo_fit_explanation,
       channel_policy_result = excluded.channel_policy_result,
       link_policy_result = excluded.link_policy_result,
       disclosure_policy_result = excluded.disclosure_policy_result,
       cost_estimate = excluded.cost_estimate,
       risk_flags = excluded.risk_flags,
       status = excluded.status,
       blocked_reason = excluded.blocked_reason,
       updated_at = excluded.updated_at`
  ).bind(
    id,
    input.signalId ?? null,
    input.channelId ?? null,
    actionType,
    input.recommendedMode || "observe",
    reason,
    input.contextEvidence ?? null,
    input.evavoFitExplanation ?? null,
    toJson(input.channelPolicyResult),
    toJson(input.linkPolicyResult),
    toJson(input.disclosurePolicyResult),
    toJson(input.costEstimate),
    toJsonArray(input.riskFlags),
    input.status || "queued",
    input.blockedReason ?? null,
    now,
    now
  ).run();

  const row = await env.DB.prepare(
    `SELECT id, signal_id, channel_id, action_type, recommended_mode, reason,
            context_evidence, evavo_fit_explanation, channel_policy_result,
            link_policy_result, disclosure_policy_result, cost_estimate,
            risk_flags, status, approved_by, approved_at, executed_at,
            blocked_reason, created_at, updated_at
     FROM growth_actions WHERE id = ? LIMIT 1`
  ).bind(id).first<GrowthActionRow>();

  if (!row) throw new Error("growth_action_upsert_failed");
  return row;
}
