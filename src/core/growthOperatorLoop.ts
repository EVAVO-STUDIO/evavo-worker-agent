import { analyzeGrowthCampaign } from "./growthCampaignAnalysis";
import { GrowthCampaignMetricRow, GrowthCampaignRow } from "./growthCampaignIntelligence";

export type GrowthOperatorLoopStep =
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
}

export interface GrowthOperatorLoopPlan {
  selectedStep: GrowthOperatorLoopStep;
  targetCampaignId: string | null;
  targetCampaignName: string | null;
  priority: number;
  rationale: string[];
  blockedBy: string[];
  recommendedCommand: string;
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

export function planGrowthOperatorLoop(input: GrowthOperatorLoopInput): GrowthOperatorLoopPlan {
  if (!input.campaigns.length) {
    return {
      selectedStep: "create_campaign",
      targetCampaignId: null,
      targetCampaignName: null,
      priority: 80,
      rationale: ["No campaign records exist yet.", "The operator needs at least one campaign before it can run campaign intelligence."],
      blockedBy: [],
      recommendedCommand: "POST /admin/growth/campaigns?confirm=1",
      safety: { internalMetadataOnly: true, externalStateChange: false, callsAI: false, callsNetwork: false },
    };
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
    return {
      selectedStep: "review_risk",
      targetCampaignId: riskCandidate.campaign.id,
      targetCampaignName: riskCandidate.campaign.name,
      priority: 95,
      rationale: ["A campaign is in pause/review posture.", ...riskCandidate.analysis.reasons.slice(0, 4)],
      blockedBy: [],
      recommendedCommand: "GET /admin/growth/operator then record a learning note or pause/pivot manually.",
      safety: { internalMetadataOnly: true, externalStateChange: false, callsAI: false, callsNetwork: false },
    };
  }

  const needsMetric = campaignAnalyses.find((item) => !item.metric);
  if (needsMetric) {
    return {
      selectedStep: "add_metric_snapshot",
      targetCampaignId: needsMetric.campaign.id,
      targetCampaignName: needsMetric.campaign.name,
      priority: 82,
      rationale: ["Campaign has no metric snapshot yet.", "The operator cannot judge campaign health without measurable state."],
      blockedBy: [],
      recommendedCommand: "POST /admin/growth/metrics?confirm=1",
      safety: { internalMetadataOnly: true, externalStateChange: false, callsAI: false, callsNetwork: false },
    };
  }

  const needsEvidence = campaignAnalyses.find((item) => item.evidenceCount === 0);
  if (needsEvidence) {
    return {
      selectedStep: "add_evidence",
      targetCampaignId: needsEvidence.campaign.id,
      targetCampaignName: needsEvidence.campaign.name,
      priority: 78,
      rationale: ["Campaign has metrics but no evidence records.", "The decision planner should be grounded in evidence before recommending stronger actions."],
      blockedBy: [],
      recommendedCommand: "POST /admin/growth/evidence?confirm=1",
      safety: { internalMetadataOnly: true, externalStateChange: false, callsAI: false, callsNetwork: false },
    };
  }

  const needsDecision = campaignAnalyses.find((item) => item.decisionCount === 0);
  if (needsDecision) {
    return {
      selectedStep: "plan_decision",
      targetCampaignId: needsDecision.campaign.id,
      targetCampaignName: needsDecision.campaign.name,
      priority: 74,
      rationale: ["Campaign has measurement and evidence, but no reasoned decision yet.", "The next-best-action planner should create a candidate-action set."],
      blockedBy: [],
      recommendedCommand: "POST /admin/growth/decisions/plan?confirm=1",
      safety: { internalMetadataOnly: true, externalStateChange: false, callsAI: false, callsNetwork: false },
    };
  }

  const needsLearning = campaignAnalyses.find((item) => item.learningCount === 0 && item.analysis.counts.reviewed > 0);
  if (needsLearning) {
    return {
      selectedStep: "record_learning",
      targetCampaignId: needsLearning.campaign.id,
      targetCampaignName: needsLearning.campaign.name,
      priority: 68,
      rationale: ["Campaign has review activity but no learning note.", "Learning notes keep the strategy adaptive instead of just accumulating actions."],
      blockedBy: [],
      recommendedCommand: "POST /admin/growth/learning?confirm=1",
      safety: { internalMetadataOnly: true, externalStateChange: false, callsAI: false, callsNetwork: false },
    };
  }

  const best = campaignAnalyses.sort((a, b) => b.analysis.scores.readinessScore - a.analysis.scores.readinessScore)[0];
  return {
    selectedStep: "continue_testing",
    targetCampaignId: best?.campaign.id || null,
    targetCampaignName: best?.campaign.name || null,
    priority: 58,
    rationale: best ? ["Campaign foundation exists.", "Continue testing with a fresh metric, evidence, decision, or learning cycle as needed."] : ["No clear campaign priority found."],
    blockedBy: [],
    recommendedCommand: best ? "GET /admin/growth/operator and continue the next internal planning cycle." : "POST /admin/growth/campaigns?confirm=1",
    safety: { internalMetadataOnly: true, externalStateChange: false, callsAI: false, callsNetwork: false },
  };
}
