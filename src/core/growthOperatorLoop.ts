import { analyzeGrowthCampaign } from "./growthCampaignAnalysis";
import { GrowthCampaignMetricRow, GrowthCampaignRow } from "./growthCampaignIntelligence";

export type GrowthOperatorLoopStep =
  | "seed_objective"
  | "seed_segment"
  | "seed_offer"
  | "seed_positioning"
  | "seed_runtime_constraint"
  | "seed_blackboard_fact"
  | "seed_entity"
  | "seed_relationship"
  | "seed_market_signal"
  | "seed_asset"
  | "create_campaign"
  | "add_metric_snapshot"
  | "add_evidence"
  | "plan_decision"
  | "record_learning"
  | "review_risk"
  | "continue_testing";

export interface GrowthOperatorLoopInput {
  campaigns: GrowthCampaignRow[];
  metrics: any[];
  evidence: any[];
  learning: any[];
  decisions: any[];
  strategyMemory?: any;
  blackboard?: any;
}

export interface GrowthOperatorLoopPlan {
  selectedStep: GrowthOperatorLoopStep;
  targetCampaignId: string | null;
  targetCampaignName: string | null;
  priority: number;
  rationale: string[];
  blockedBy: string[];
  recommendedCommand: string;
  recommendedPayloadHint?: Record<string, unknown>;
  dashboardAnchor?: string;
  setupGap?: string | null;
  safety: {
    internalMetadataOnly: boolean;
    externalStateChange: boolean;
    callsAI: boolean;
    callsNetwork: boolean;
  };
}

function latestMetricFor(metrics: any[], campaignId: string): GrowthCampaignMetricRow | null {
  const rows = metrics.filter((metric) => metric.campaign_id === campaignId);
  rows.sort((a, b) => String(b.metric_date || b.updated_at || "").localeCompare(String(a.metric_date || a.updated_at || "")));
  return rows[0] || null;
}

function countFor(rows: any[], campaignId: string): number {
  return rows.filter((row) => row.campaign_id === campaignId).length;
}

function safePlan(partial: Omit<GrowthOperatorLoopPlan, "safety">): GrowthOperatorLoopPlan {
  return {
    ...partial,
    safety: { internalMetadataOnly: true, externalStateChange: false, callsAI: false, callsNetwork: false },
  };
}

function count(source: any, key: string): number {
  const value = source?.counts?.[key];
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function setupPlan(input: GrowthOperatorLoopInput): GrowthOperatorLoopPlan | null {
  const strategyMemory = input.strategyMemory || {};
  const blackboard = input.blackboard || {};

  if (count(strategyMemory, "objectives") <= 0) {
    return safePlan({
      selectedStep: "seed_objective",
      targetCampaignId: null,
      targetCampaignName: null,
      priority: 100,
      rationale: ["No active Growth objectives exist yet.", "The operator needs a strategic objective before campaign or action planning can be meaningful."],
      blockedBy: ["missing_objectives"],
      recommendedCommand: "POST /admin/growth/objectives?confirm=1",
      recommendedPayloadHint: { name: "Primary EVAVO growth objective", status: "active", priority: 100 },
      dashboardAnchor: "#growth-strategy-memory",
      setupGap: "missing_objectives",
    });
  }

  if (count(strategyMemory, "targetSegments") <= 0) {
    return safePlan({
      selectedStep: "seed_segment",
      targetCampaignId: null,
      targetCampaignName: null,
      priority: 98,
      rationale: ["No target segments exist yet.", "Campaigns need a named audience before evidence, metrics, or decisions can be scored."],
      blockedBy: ["missing_target_segments"],
      recommendedCommand: "POST /admin/growth/segments?confirm=1",
      recommendedPayloadHint: { name: "Primary target segment", status: "active", priority: 90 },
      dashboardAnchor: "#growth-strategy-memory",
      setupGap: "missing_target_segments",
    });
  }

  if (count(strategyMemory, "offerProfiles") <= 0) {
    return safePlan({
      selectedStep: "seed_offer",
      targetCampaignId: null,
      targetCampaignName: null,
      priority: 96,
      rationale: ["No offer profiles exist yet.", "The operator needs a concrete value proposition before it can reason about campaign fit."],
      blockedBy: ["missing_offer_profiles"],
      recommendedCommand: "POST /admin/growth/offers?confirm=1",
      recommendedPayloadHint: { name: "Primary EVAVO offer", status: "active", priority: 90 },
      dashboardAnchor: "#growth-strategy-memory",
      setupGap: "missing_offer_profiles",
    });
  }

  if (count(strategyMemory, "positioningProfiles") <= 0) {
    return safePlan({
      selectedStep: "seed_positioning",
      targetCampaignId: null,
      targetCampaignName: null,
      priority: 94,
      rationale: ["No positioning profiles exist yet.", "Voice, proof and positioning should be explicit before stronger campaign planning."],
      blockedBy: ["missing_positioning_profiles"],
      recommendedCommand: "POST /admin/growth/positioning?confirm=1",
      recommendedPayloadHint: { name: "Primary positioning profile", status: "active", priority: 90 },
      dashboardAnchor: "#growth-strategy-memory",
      setupGap: "missing_positioning_profiles",
    });
  }

  if (count(strategyMemory, "runtimeConstraints") <= 0) {
    return safePlan({
      selectedStep: "seed_runtime_constraint",
      targetCampaignId: null,
      targetCampaignName: null,
      priority: 92,
      rationale: ["No runtime constraints exist yet.", "The Growth Operator needs hard safety rules before any future execution-oriented capability can be considered."],
      blockedBy: ["missing_runtime_constraints"],
      recommendedCommand: "POST /admin/growth/runtime-constraints?confirm=1",
      recommendedPayloadHint: { name: "No external action without explicit approval", severity: "hard", status: "active" },
      dashboardAnchor: "#growth-strategy-memory",
      setupGap: "missing_runtime_constraints",
    });
  }

  if (count(blackboard, "facts") <= 0) {
    return safePlan({
      selectedStep: "seed_blackboard_fact",
      targetCampaignId: null,
      targetCampaignName: null,
      priority: 90,
      rationale: ["No blackboard facts exist yet.", "The operator needs trusted internal facts before it can ground campaign decisions."],
      blockedBy: ["missing_blackboard_facts"],
      recommendedCommand: "POST /admin/growth/blackboard/facts?confirm=1",
      recommendedPayloadHint: { subjectType: "brand", confidence: 0.9, status: "active" },
      dashboardAnchor: "#growth-blackboard",
      setupGap: "missing_blackboard_facts",
    });
  }

  if (count(blackboard, "entities") <= 0) {
    return safePlan({
      selectedStep: "seed_entity",
      targetCampaignId: null,
      targetCampaignName: null,
      priority: 88,
      rationale: ["No Growth entities exist yet.", "Entities let the operator connect brands, offers, audiences, channels and assets."],
      blockedBy: ["missing_growth_entities"],
      recommendedCommand: "POST /admin/growth/blackboard/entities?confirm=1",
      recommendedPayloadHint: { entityType: "brand", name: "EVAVO", status: "active" },
      dashboardAnchor: "#growth-blackboard",
      setupGap: "missing_growth_entities",
    });
  }

  if (count(blackboard, "relationships") <= 0) {
    return safePlan({
      selectedStep: "seed_relationship",
      targetCampaignId: null,
      targetCampaignName: null,
      priority: 86,
      rationale: ["No entity relationships exist yet.", "Relationships let the operator reason across objectives, offers, segments and proof assets."],
      blockedBy: ["missing_entity_relationships"],
      recommendedCommand: "POST /admin/growth/blackboard/relationships?confirm=1",
      recommendedPayloadHint: { relationshipType: "supports", status: "active", strength: 0.8 },
      dashboardAnchor: "#growth-blackboard",
      setupGap: "missing_entity_relationships",
    });
  }

  if (count(blackboard, "marketSignals") <= 0) {
    return safePlan({
      selectedStep: "seed_market_signal",
      targetCampaignId: null,
      targetCampaignName: null,
      priority: 84,
      rationale: ["No market signals exist yet.", "The operator needs current market context before prioritising campaign pressure."],
      blockedBy: ["missing_market_signals"],
      recommendedCommand: "POST /admin/growth/blackboard/signals?confirm=1",
      recommendedPayloadHint: { signalType: "market", confidence: 0.7, status: "active" },
      dashboardAnchor: "#growth-blackboard",
      setupGap: "missing_market_signals",
    });
  }

  if (count(blackboard, "assets") <= 0) {
    return safePlan({
      selectedStep: "seed_asset",
      targetCampaignId: null,
      targetCampaignName: null,
      priority: 82,
      rationale: ["No proof assets exist yet.", "Evidence-backed assets make future campaign decisions auditable and reusable."],
      blockedBy: ["missing_asset_inventory"],
      recommendedCommand: "POST /admin/growth/blackboard/assets?confirm=1",
      recommendedPayloadHint: { assetType: "case_study", status: "active", proofStrength: 0.8 },
      dashboardAnchor: "#growth-blackboard",
      setupGap: "missing_asset_inventory",
    });
  }

  return null;
}

export function planGrowthOperatorLoop(input: GrowthOperatorLoopInput): GrowthOperatorLoopPlan {
  const setup = setupPlan(input);
  if (setup) return setup;

  if (!input.campaigns.length) {
    return safePlan({
      selectedStep: "create_campaign",
      targetCampaignId: null,
      targetCampaignName: null,
      priority: 80,
      rationale: ["No campaign records exist yet.", "The operator has enough memory substrate to create a campaign record safely."],
      blockedBy: ["no_campaigns"],
      recommendedCommand: "POST /admin/growth/campaigns?confirm=1",
      recommendedPayloadHint: { name: "Primary Growth campaign", status: "active", priority: 80 },
      dashboardAnchor: "#growth-campaign-intelligence",
      setupGap: "no_campaigns",
    });
  }

  const campaignAnalyses = input.campaigns.map((campaign) => ({
    campaign,
    metric: latestMetricFor(input.metrics, campaign.id),
    evidenceCount: countFor(input.evidence, campaign.id),
    learningCount: countFor(input.learning, campaign.id),
    decisionCount: countFor(input.decisions, campaign.id),
  })).map((item) => ({
    ...item,
    analysis: analyzeGrowthCampaign({
      campaign: item.campaign,
      metrics: item.metric,
      evidenceCount: item.evidenceCount,
      learningCount: item.learningCount,
      decisionCount: item.decisionCount,
    }),
  }));

  const riskCandidate = campaignAnalyses.find((item) => item.analysis.operatorState === "pause_or_review");
  if (riskCandidate) {
    return safePlan({
      selectedStep: "review_risk",
      targetCampaignId: riskCandidate.campaign.id,
      targetCampaignName: riskCandidate.campaign.name,
      priority: 95,
      rationale: ["A campaign is in pause/review posture.", ...riskCandidate.analysis.reasons.slice(0, 4)],
      blockedBy: [],
      recommendedCommand: "GET /admin/growth/operator then record a learning note or pause/pivot manually.",
      dashboardAnchor: "#growth-campaign-intelligence",
      setupGap: null,
    });
  }

  const needsMetric = campaignAnalyses.find((item) => !item.metric);
  if (needsMetric) {
    return safePlan({
      selectedStep: "add_metric_snapshot",
      targetCampaignId: needsMetric.campaign.id,
      targetCampaignName: needsMetric.campaign.name,
      priority: 82,
      rationale: ["Campaign has no metric snapshot yet.", "The operator cannot judge campaign health without measurable state."],
      blockedBy: ["missing_metric_snapshot"],
      recommendedCommand: "POST /admin/growth/metrics?confirm=1",
      recommendedPayloadHint: { campaignId: needsMetric.campaign.id, metricDate: "YYYY-MM-DD" },
      dashboardAnchor: "#growth-campaign-intelligence",
      setupGap: "missing_metric_snapshot",
    });
  }

  const needsEvidence = campaignAnalyses.find((item) => item.evidenceCount === 0);
  if (needsEvidence) {
    return safePlan({
      selectedStep: "add_evidence",
      targetCampaignId: needsEvidence.campaign.id,
      targetCampaignName: needsEvidence.campaign.name,
      priority: 78,
      rationale: ["Campaign has metrics but no evidence records.", "The decision planner should be grounded in evidence before recommending stronger actions."],
      blockedBy: ["missing_evidence"],
      recommendedCommand: "POST /admin/growth/evidence?confirm=1",
      recommendedPayloadHint: { campaignId: needsEvidence.campaign.id, evidenceType: "proof" },
      dashboardAnchor: "#growth-campaign-intelligence",
      setupGap: "missing_evidence",
    });
  }

  const needsDecision = campaignAnalyses.find((item) => item.decisionCount === 0);
  if (needsDecision) {
    return safePlan({
      selectedStep: "plan_decision",
      targetCampaignId: needsDecision.campaign.id,
      targetCampaignName: needsDecision.campaign.name,
      priority: 74,
      rationale: ["Campaign has measurement and evidence, but no reasoned decision yet.", "The next-best-action planner should create a candidate-action set."],
      blockedBy: ["missing_reasoned_decision"],
      recommendedCommand: "POST /admin/growth/decisions/plan?confirm=1",
      recommendedPayloadHint: { campaignId: needsDecision.campaign.id },
      dashboardAnchor: "#growth-campaign-intelligence",
      setupGap: "missing_reasoned_decision",
    });
  }

  const needsLearning = campaignAnalyses.find((item) => item.learningCount === 0 && item.analysis.counts.reviewed > 0);
  if (needsLearning) {
    return safePlan({
      selectedStep: "record_learning",
      targetCampaignId: needsLearning.campaign.id,
      targetCampaignName: needsLearning.campaign.name,
      priority: 68,
      rationale: ["Campaign has review activity but no learning note.", "Learning notes keep the strategy adaptive instead of just accumulating actions."],
      blockedBy: ["missing_learning_note"],
      recommendedCommand: "POST /admin/growth/learning?confirm=1",
      recommendedPayloadHint: { campaignId: needsLearning.campaign.id, learningType: "review_outcome" },
      dashboardAnchor: "#growth-campaign-intelligence",
      setupGap: "missing_learning_note",
    });
  }

  const best = campaignAnalyses.sort((a, b) => b.analysis.scores.readinessScore - a.analysis.scores.readinessScore)[0];
  return safePlan({
    selectedStep: "continue_testing",
    targetCampaignId: best?.campaign.id || null,
    targetCampaignName: best?.campaign.name || null,
    priority: 58,
    rationale: best ? ["Campaign foundation exists.", "Continue testing with a fresh metric, evidence, decision, or learning cycle as needed."] : ["No clear campaign priority found."],
    blockedBy: [],
    recommendedCommand: best ? "GET /admin/growth/operator and continue the next internal planning cycle." : "POST /admin/growth/campaigns?confirm=1",
    dashboardAnchor: best ? "#growth-campaign-intelligence" : "#growth-strategy-memory",
    setupGap: null,
  });
}
