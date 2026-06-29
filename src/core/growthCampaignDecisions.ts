import { Env, nowISO, uuid } from "../db";
import { listGrowthCapabilities } from "./growthCapabilities";
import { GrowthCampaignRow, GrowthExperimentRow, GrowthCampaignMetricRow, assessCampaignHealth } from "./growthCampaignIntelligence";

export interface CandidateActionScore {
  actionType: string;
  capabilityId: string | null;
  targetRef?: string | null;
  utilityScore: number;
  riskScore: number;
  expectedValueScore: number;
  learningValueScore: number;
  readinessScore: number;
  rejectionReason?: string | null;
}

export interface GrowthDecisionPlan {
  decisionType: string;
  selectedAction: string;
  decisionStatus: string;
  reasoningSummary: string[];
  constraints: string[];
  utilityScore: number;
  riskScore: number;
  confidenceScore: number;
  nextStep: string;
  candidates: CandidateActionScore[];
}

export interface GrowthDecisionRow {
  id: string;
  campaign_id: string | null;
  experiment_id: string | null;
  decision_type: string;
  selected_action: string;
  decision_status: string;
  reasoning_summary_json: string;
  constraints_json: string;
  utility_score: number;
  risk_score: number;
  confidence_score: number;
  next_step: string | null;
  created_at: string;
  updated_at: string;
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(Number.isFinite(value) ? value : 0)));
}

function scoreCandidate(input: {
  actionType: string;
  capabilityId?: string | null;
  strategicFit: number;
  expectedValue: number;
  urgency: number;
  learningValue: number;
  readiness: number;
  confidence: number;
  risk: number;
  cost: number;
  repetition: number;
  fatigue: number;
  rejectionReason?: string | null;
}): CandidateActionScore {
  const utility = clamp(
    input.strategicFit * 0.22 +
    input.expectedValue * 0.24 +
    input.urgency * 0.12 +
    input.learningValue * 0.16 +
    input.readiness * 0.16 +
    input.confidence * 0.10 -
    input.risk * 0.18 -
    input.cost * 0.08 -
    input.repetition * 0.08 -
    input.fatigue * 0.08
  );

  return {
    actionType: input.actionType,
    capabilityId: input.capabilityId || null,
    utilityScore: utility,
    riskScore: clamp(input.risk),
    expectedValueScore: clamp(input.expectedValue),
    learningValueScore: clamp(input.learningValue),
    readinessScore: clamp(input.readiness),
    rejectionReason: input.rejectionReason || null,
  };
}

export function planGrowthCampaignDecision(input: {
  campaign: GrowthCampaignRow;
  experiment?: GrowthExperimentRow | null;
  metrics?: GrowthCampaignMetricRow | null;
  pendingReviewCount?: number;
  evidenceCount?: number;
}): GrowthDecisionPlan {
  const capabilities = listGrowthCapabilities().capabilities;
  const hasCapability = (id: string) => capabilities.some((capability) => capability.id === id);
  const health = assessCampaignHealth(input.campaign, input.metrics || null);
  const pendingReviewCount = input.pendingReviewCount || 0;
  const evidenceCount = input.evidenceCount || 0;
  const isActive = ["active", "testing", "scaling"].includes(input.campaign.status);
  const isPaused = ["paused", "needs_review"].includes(input.campaign.status);

  const candidates: CandidateActionScore[] = [
    scoreCandidate({ actionType: "review_campaign_health", capabilityId: "generate_growth_brief", strategicFit: 70, expectedValue: health.health === "red" ? 88 : 58, urgency: health.health === "red" ? 95 : 45, learningValue: 65, readiness: 95, confidence: 80, risk: 5, cost: 0, repetition: 10, fatigue: 0 }),
    scoreCandidate({ actionType: "gather_more_evidence", capabilityId: "research_public_website", strategicFit: 72, expectedValue: evidenceCount < 3 ? 78 : 42, urgency: evidenceCount < 3 ? 70 : 25, learningValue: 86, readiness: hasCapability("research_public_website") ? 60 : 20, confidence: 65, risk: 18, cost: 15, repetition: evidenceCount > 8 ? 35 : 5, fatigue: 0 }),
    scoreCandidate({ actionType: "prepare_reviewable_draft", capabilityId: "draft_message", strategicFit: 82, expectedValue: evidenceCount > 0 ? 82 : 45, urgency: isActive ? 65 : 25, learningValue: 70, readiness: evidenceCount > 0 ? 72 : 30, confidence: evidenceCount > 0 ? 68 : 35, risk: 35, cost: 35, repetition: pendingReviewCount > 3 ? 45 : 10, fatigue: 0, rejectionReason: evidenceCount <= 0 ? "Evidence should be gathered before drafting." : null }),
    scoreCandidate({ actionType: "prepare_owned_content", capabilityId: "draft_owned_content", strategicFit: 72, expectedValue: 66, urgency: isPaused ? 60 : 40, learningValue: 70, readiness: 65, confidence: 64, risk: 24, cost: 30, repetition: 10, fatigue: 0 }),
    scoreCandidate({ actionType: "create_internal_followup_task", capabilityId: "create_internal_task", strategicFit: 58, expectedValue: pendingReviewCount > 0 ? 76 : 44, urgency: pendingReviewCount > 0 ? 75 : 35, learningValue: 45, readiness: 95, confidence: 80, risk: 4, cost: 0, repetition: 5, fatigue: 0 }),
    scoreCandidate({ actionType: "record_learning_note", capabilityId: "record_outcome", strategicFit: 65, expectedValue: health.health !== "unknown" ? 70 : 38, urgency: health.health === "red" ? 80 : 35, learningValue: 88, readiness: 80, confidence: 70, risk: 2, cost: 0, repetition: 8, fatigue: 0 }),
  ];

  const allowedCandidates = candidates.filter((candidate) => !candidate.rejectionReason || candidate.utilityScore >= 45);
  const selected = allowedCandidates.sort((a, b) => b.utilityScore - a.utilityScore)[0] || candidates[0];
  const constraints: string[] = ["metadata_only", "no_external_execution", "approval_required_for_higher_risk_steps"];
  const reasoningSummary: string[] = [
    `Campaign status is ${input.campaign.status}.`,
    `Campaign health is ${health.health}.`,
    ...health.reasons,
  ];

  if (input.experiment) reasoningSummary.push(`Active experiment considered: ${input.experiment.name}.`);
  if (!isActive) reasoningSummary.push("Campaign is not in an active/scaling state, so internal review and planning are preferred.");
  if (pendingReviewCount > 0) reasoningSummary.push(`${pendingReviewCount} item(s) appear to need operator review.`);
  if (evidenceCount <= 0) reasoningSummary.push("Evidence is thin, so research or evidence gathering should be preferred before outward-facing preparation.");

  const nextStep = selected.actionType === "prepare_reviewable_draft"
    ? "Prepare a reviewable draft only after checking evidence and channel policy."
    : selected.actionType === "gather_more_evidence"
      ? "Gather one focused public evidence item and re-score the campaign."
      : selected.actionType === "record_learning_note"
        ? "Record what the campaign result suggests and decide whether to continue, pause, or pivot."
        : selected.actionType === "prepare_owned_content"
          ? "Prepare owned-channel content for review using the campaign hypothesis."
          : selected.actionType === "create_internal_followup_task"
            ? "Create an internal follow-up task for the operator."
            : "Review campaign health and choose the next internal step.";

  return {
    decisionType: "campaign_next_best_action",
    selectedAction: selected.actionType,
    decisionStatus: "planned",
    reasoningSummary,
    constraints,
    utilityScore: selected.utilityScore,
    riskScore: selected.riskScore,
    confidenceScore: clamp((selected.readinessScore + selected.expectedValueScore) / 2),
    nextStep,
    candidates,
  };
}

export async function saveGrowthDecision(env: Env, input: {
  campaignId?: string | null;
  experimentId?: string | null;
  plan: GrowthDecisionPlan;
}): Promise<GrowthDecisionRow> {
  const id = uuid();
  const now = nowISO();

  await env.DB.prepare(
    `INSERT INTO growth_decisions (
       id, campaign_id, experiment_id, decision_type, selected_action, decision_status,
       reasoning_summary_json, constraints_json, utility_score, risk_score, confidence_score,
       next_step, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    input.campaignId || null,
    input.experimentId || null,
    input.plan.decisionType,
    input.plan.selectedAction,
    input.plan.decisionStatus,
    JSON.stringify(input.plan.reasoningSummary),
    JSON.stringify(input.plan.constraints),
    input.plan.utilityScore,
    input.plan.riskScore,
    input.plan.confidenceScore,
    input.plan.nextStep,
    now,
    now
  ).run();

  for (const candidate of input.plan.candidates) {
    await env.DB.prepare(
      `INSERT INTO growth_candidate_actions (
         id, decision_id, action_type, target_ref, capability_id, utility_score, risk_score,
         expected_value_score, learning_value_score, readiness_score, rejection_reason, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      uuid(),
      id,
      candidate.actionType,
      candidate.targetRef || null,
      candidate.capabilityId,
      candidate.utilityScore,
      candidate.riskScore,
      candidate.expectedValueScore,
      candidate.learningValueScore,
      candidate.readinessScore,
      candidate.rejectionReason || null,
      now
    ).run();
  }

  const row = await env.DB.prepare(`SELECT * FROM growth_decisions WHERE id = ? LIMIT 1`).bind(id).first<GrowthDecisionRow>();
  if (!row) throw new Error("growth_decision_save_failed");
  return row;
}

export async function listGrowthDecisions(env: Env, limit = 25, campaignId?: string): Promise<GrowthDecisionRow[]> {
  if (campaignId) {
    const rows = await env.DB.prepare(`SELECT * FROM growth_decisions WHERE campaign_id = ? ORDER BY created_at DESC LIMIT ?`).bind(campaignId, limit).all<GrowthDecisionRow>();
    return rows.results || [];
  }
  const rows = await env.DB.prepare(`SELECT * FROM growth_decisions ORDER BY created_at DESC LIMIT ?`).bind(limit).all<GrowthDecisionRow>();
  return rows.results || [];
}
