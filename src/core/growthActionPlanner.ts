import { Env } from "../db";
import { GrowthActionRow, GrowthSignalRow } from "./growthEngagementReadModels";
import { upsertGrowthAction } from "./growthActions";

function normalizeType(value: string | null | undefined): string {
  return String(value || "").trim().toLowerCase();
}

function actionTypeForSignal(signalType: string): string {
  const type = normalizeType(signalType);
  if (type.includes("owned_content")) return "draft_blog_outline";
  if (type.includes("directory") || type.includes("listing")) return "draft_directory_profile";
  if (type.includes("procurement") || type.includes("tender") || type.includes("rfp")) return "watch_procurement_opportunity";
  if (type.includes("community")) return "draft_community_reply";
  if (type.includes("contact") || type.includes("direct")) return "draft_contact_note";
  return "save_signal_insight";
}

function recommendedModeForSignal(signal: GrowthSignalRow): string {
  const type = normalizeType(signal.signal_type);
  if (signal.risk_score >= 70) return "observe";
  if (type.includes("owned_content")) return "assist";
  if (type.includes("directory") || type.includes("listing")) return "assist";
  return "observe";
}

function statusForSignal(signal: GrowthSignalRow): string {
  if (signal.risk_score >= 80) return "blocked";
  if (signal.fit_score < 45) return "queued";
  return "needs_review";
}

async function readGrowthSignal(env: Env, signalId: string): Promise<GrowthSignalRow> {
  const row = await env.DB.prepare(
    `SELECT id, goal_id, channel_id, source_url, source_title, signal_type,
            service_match, audience_match, evidence, urgency, fit_score, risk_score,
            cost_score, status, duplicate_key, discovered_at, created_at, updated_at
     FROM growth_signals WHERE id = ? LIMIT 1`
  ).bind(signalId).first<GrowthSignalRow>();

  if (!row) throw new Error("growth_signal_not_found");
  return row;
}

export async function planGrowthActionFromSignal(env: Env, signalId: string): Promise<GrowthActionRow> {
  const signal = await readGrowthSignal(env, signalId);
  const actionType = actionTypeForSignal(signal.signal_type);
  const recommendedMode = recommendedModeForSignal(signal);
  const status = statusForSignal(signal);
  const blockedReason = status === "blocked" ? "Signal risk score is too high for queue planning." : null;

  return upsertGrowthAction(env, {
    signalId: signal.id,
    channelId: signal.channel_id || null,
    actionType,
    recommendedMode,
    reason: `Deterministic queue plan from saved Growth signal ${signal.signal_type}.`,
    contextEvidence: signal.evidence,
    evavoFitExplanation: `Fit score ${signal.fit_score}; risk score ${signal.risk_score}; cost score ${signal.cost_score}.`,
    channelPolicyResult: { source: "deterministic_planner", channelId: signal.channel_id || null, queueOnly: true },
    linkPolicyResult: { sourceUrl: signal.source_url, queueOnly: true },
    disclosurePolicyResult: { queueOnly: true, publicCommunication: false },
    costEstimate: { aiCalls: 0, networkFetches: 0, publicActions: 0, contactActions: 0 },
    riskFlags: signal.risk_score >= 70 ? ["high_signal_risk"] : [],
    status,
    blockedReason,
  });
}
