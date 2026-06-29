import { Env, nowISO, uuid } from "../db";

export type CampaignStatus = "draft" | "active" | "testing" | "scaling" | "paused" | "needs_review" | "pivoting" | "completed" | "archived";
export type HealthState = "green" | "amber" | "red" | "unknown";

export interface GrowthCampaignInput {
  name: string;
  goal: string;
  hypothesis?: string | null;
  targetSegment?: string | null;
  primaryOffer?: string | null;
  status?: CampaignStatus | string;
  priority?: number;
  riskLevel?: string;
  budgetProfile?: string;
  successMetric?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  notes?: string | null;
}

export interface GrowthExperimentInput {
  campaignId: string;
  name: string;
  hypothesis?: string | null;
  variantA?: string | null;
  variantB?: string | null;
  variantC?: string | null;
  sampleSizeTarget?: number;
  decisionRule?: string | null;
  status?: string;
  winnerVariant?: string | null;
  confidenceScore?: number;
}

export interface GrowthCampaignRow {
  id: string;
  name: string;
  goal: string;
  hypothesis: string | null;
  target_segment: string | null;
  primary_offer: string | null;
  status: string;
  priority: number;
  risk_level: string;
  budget_profile: string;
  success_metric: string | null;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface GrowthExperimentRow {
  id: string;
  campaign_id: string;
  name: string;
  hypothesis: string | null;
  variant_a: string | null;
  variant_b: string | null;
  variant_c: string | null;
  sample_size_target: number;
  decision_rule: string | null;
  status: string;
  winner_variant: string | null;
  confidence_score: number;
  created_at: string;
  updated_at: string;
}

export interface GrowthCampaignMetricRow {
  id: string;
  campaign_id: string;
  experiment_id: string | null;
  metric_date: string;
  prepared_count: number;
  reviewed_count: number;
  positive_count: number;
  negative_count: number;
  meeting_count: number;
  content_count: number;
  engagement_count: number;
  cost_units: number;
  health_state: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(Number.isFinite(value) ? value : 0)));
}

function normalizeText(value: string, max = 480): string {
  return value.trim().replace(/\s+/g, " ").slice(0, max);
}

function optionalText(value: unknown, max = 1200): string | null {
  if (typeof value !== "string") return null;
  const normalized = normalizeText(value, max);
  return normalized || null;
}

export async function upsertGrowthCampaign(env: Env, input: GrowthCampaignInput, id = uuid()): Promise<GrowthCampaignRow> {
  const now = nowISO();
  const name = normalizeText(input.name || "", 160);
  const goal = normalizeText(input.goal || "", 600);
  if (!name) throw new Error("growth_campaign_name_required");
  if (goal.length < 12) throw new Error("growth_campaign_goal_too_short");

  await env.DB.prepare(
    `INSERT INTO growth_campaigns (
       id, name, goal, hypothesis, target_segment, primary_offer, status, priority,
       risk_level, budget_profile, success_metric, start_date, end_date, notes, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       goal = excluded.goal,
       hypothesis = excluded.hypothesis,
       target_segment = excluded.target_segment,
       primary_offer = excluded.primary_offer,
       status = excluded.status,
       priority = excluded.priority,
       risk_level = excluded.risk_level,
       budget_profile = excluded.budget_profile,
       success_metric = excluded.success_metric,
       start_date = excluded.start_date,
       end_date = excluded.end_date,
       notes = excluded.notes,
       updated_at = excluded.updated_at`
  ).bind(
    id,
    name,
    goal,
    optionalText(input.hypothesis, 1000),
    optionalText(input.targetSegment, 240),
    optionalText(input.primaryOffer, 240),
    input.status || "draft",
    clamp(input.priority ?? 50),
    input.riskLevel || "medium",
    input.budgetProfile || "free_safe",
    optionalText(input.successMetric, 240),
    input.startDate ?? null,
    input.endDate ?? null,
    optionalText(input.notes, 1600),
    now,
    now
  ).run();

  const row = await env.DB.prepare(`SELECT * FROM growth_campaigns WHERE id = ? LIMIT 1`).bind(id).first<GrowthCampaignRow>();
  if (!row) throw new Error("growth_campaign_upsert_failed");
  return row;
}

export async function upsertGrowthExperiment(env: Env, input: GrowthExperimentInput, id = uuid()): Promise<GrowthExperimentRow> {
  const now = nowISO();
  const name = normalizeText(input.name || "", 160);
  if (!input.campaignId) throw new Error("growth_experiment_campaign_required");
  if (!name) throw new Error("growth_experiment_name_required");

  await env.DB.prepare(
    `INSERT INTO growth_experiments (
       id, campaign_id, name, hypothesis, variant_a, variant_b, variant_c,
       sample_size_target, decision_rule, status, winner_variant, confidence_score, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       campaign_id = excluded.campaign_id,
       name = excluded.name,
       hypothesis = excluded.hypothesis,
       variant_a = excluded.variant_a,
       variant_b = excluded.variant_b,
       variant_c = excluded.variant_c,
       sample_size_target = excluded.sample_size_target,
       decision_rule = excluded.decision_rule,
       status = excluded.status,
       winner_variant = excluded.winner_variant,
       confidence_score = excluded.confidence_score,
       updated_at = excluded.updated_at`
  ).bind(
    id,
    input.campaignId,
    name,
    optionalText(input.hypothesis, 1000),
    optionalText(input.variantA, 600),
    optionalText(input.variantB, 600),
    optionalText(input.variantC, 600),
    Math.max(1, Math.min(500, Math.round(input.sampleSizeTarget ?? 10))),
    optionalText(input.decisionRule, 800),
    input.status || "draft",
    input.winnerVariant ?? null,
    clamp(input.confidenceScore ?? 0),
    now,
    now
  ).run();

  const row = await env.DB.prepare(`SELECT * FROM growth_experiments WHERE id = ? LIMIT 1`).bind(id).first<GrowthExperimentRow>();
  if (!row) throw new Error("growth_experiment_upsert_failed");
  return row;
}

export async function listGrowthCampaigns(env: Env, limit = 25, status?: string): Promise<GrowthCampaignRow[]> {
  if (status) {
    const rows = await env.DB.prepare(`SELECT * FROM growth_campaigns WHERE status = ? ORDER BY priority DESC, updated_at DESC LIMIT ?`).bind(status, limit).all<GrowthCampaignRow>();
    return rows.results || [];
  }
  const rows = await env.DB.prepare(`SELECT * FROM growth_campaigns ORDER BY priority DESC, updated_at DESC LIMIT ?`).bind(limit).all<GrowthCampaignRow>();
  return rows.results || [];
}

export async function listGrowthExperiments(env: Env, limit = 25, campaignId?: string): Promise<GrowthExperimentRow[]> {
  if (campaignId) {
    const rows = await env.DB.prepare(`SELECT * FROM growth_experiments WHERE campaign_id = ? ORDER BY updated_at DESC LIMIT ?`).bind(campaignId, limit).all<GrowthExperimentRow>();
    return rows.results || [];
  }
  const rows = await env.DB.prepare(`SELECT * FROM growth_experiments ORDER BY updated_at DESC LIMIT ?`).bind(limit).all<GrowthExperimentRow>();
  return rows.results || [];
}

export async function getLatestCampaignMetrics(env: Env, campaignId: string): Promise<GrowthCampaignMetricRow | null> {
  const row = await env.DB.prepare(`SELECT * FROM growth_campaign_metrics WHERE campaign_id = ? ORDER BY metric_date DESC, updated_at DESC LIMIT 1`).bind(campaignId).first<GrowthCampaignMetricRow>();
  return row || null;
}

export function assessCampaignHealth(campaign: GrowthCampaignRow, metrics: GrowthCampaignMetricRow | null) {
  if (campaign.status === "paused" || campaign.status === "needs_review") {
    return { health: "amber" as HealthState, reasons: ["Campaign is paused or marked for review."], recommendedFocus: ["Review blockers and decide whether to resume, pivot, or archive."] };
  }
  if (!metrics) {
    return { health: "unknown" as HealthState, reasons: ["No campaign metric snapshot exists yet."], recommendedFocus: ["Create a first metric snapshot or plan a small internal next step."] };
  }

  const totalFeedback = metrics.positive_count + metrics.negative_count;
  const positiveRate = totalFeedback > 0 ? metrics.positive_count / totalFeedback : 0;
  const negativeRate = totalFeedback > 0 ? metrics.negative_count / totalFeedback : 0;
  const reasons: string[] = [];
  const recommendedFocus: string[] = [];

  if (metrics.negative_count >= 3 || negativeRate >= 0.5) {
    reasons.push("Negative feedback is high enough to pause and review the current angle.");
    recommendedFocus.push("Pause or pivot before preparing more outward-facing work.");
    return { health: "red" as HealthState, reasons, recommendedFocus };
  }

  if (metrics.meeting_count > 0 || positiveRate >= 0.5) {
    reasons.push("Positive signal quality is strong relative to recorded feedback.");
    recommendedFocus.push("Continue the current experiment and prepare the next best internal step.");
    return { health: "green" as HealthState, reasons, recommendedFocus };
  }

  if (metrics.prepared_count < 5 || metrics.reviewed_count < metrics.prepared_count) {
    reasons.push("Sample size or review coverage is still low.");
    recommendedFocus.push("Gather more evidence, review prepared work, or plan a small next step.");
    return { health: "amber" as HealthState, reasons, recommendedFocus };
  }

  reasons.push("Campaign has activity but no strong winning signal yet.");
  recommendedFocus.push("Test an alternate angle or channel path before scaling.");
  return { health: "amber" as HealthState, reasons, recommendedFocus };
}
