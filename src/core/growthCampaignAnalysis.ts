import { listGrowthCapabilities } from "./growthCapabilities";
import { GrowthCampaignMetricRow, GrowthCampaignRow, assessCampaignHealth } from "./growthCampaignIntelligence";

export interface GrowthCampaignAnalysisInput {
  campaign: GrowthCampaignRow;
  metrics?: GrowthCampaignMetricRow | null;
  evidenceCount?: number;
  learningCount?: number;
  decisionCount?: number;
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(Number.isFinite(value) ? value : 0)));
}

function ratio(numerator: number, denominator: number): number {
  if (!denominator) return 0;
  return numerator / denominator;
}

export function analyzeGrowthCampaign(input: GrowthCampaignAnalysisInput) {
  const metrics = input.metrics || null;
  const health = assessCampaignHealth(input.campaign, metrics);
  const evidenceCount = input.evidenceCount || 0;
  const learningCount = input.learningCount || 0;
  const decisionCount = input.decisionCount || 0;
  const reviewed = metrics?.reviewed_count || 0;
  const prepared = metrics?.prepared_count || 0;
  const positive = metrics?.positive_count || 0;
  const negative = metrics?.negative_count || 0;
  const meetings = metrics?.meeting_count || 0;
  const engagements = metrics?.engagement_count || 0;
  const feedbackTotal = positive + negative;
  const positiveRate = clamp(ratio(positive, feedbackTotal) * 100);
  const reviewCoverage = clamp(ratio(reviewed, prepared || reviewed) * 100);
  const evidenceScore = clamp(evidenceCount * 18);
  const learningScore = clamp(learningCount * 20);
  const decisionScore = clamp(decisionCount * 15);
  const signalScore = clamp(positiveRate * 0.35 + reviewCoverage * 0.20 + evidenceScore * 0.20 + learningScore * 0.15 + decisionScore * 0.10 + meetings * 20 + engagements * 2);
  const riskScore = clamp((negative * 24) + (evidenceCount === 0 ? 20 : 0) + (health.health === "red" ? 40 : 0) + (input.campaign.status === "paused" ? 15 : 0));
  const readinessScore = clamp(evidenceScore * 0.35 + reviewCoverage * 0.25 + learningScore * 0.20 + decisionScore * 0.20);

  const reasons = [...health.reasons];
  const recommendedNextActions = [...health.recommendedFocus];

  if (evidenceCount === 0) {
    reasons.push("No evidence items are attached to this campaign yet.");
    recommendedNextActions.push("Add a public evidence item before preparing outward-facing work.");
  }
  if (!metrics) {
    reasons.push("No metric snapshot exists yet, so the campaign cannot be measured properly.");
    recommendedNextActions.push("Save a first metric snapshot for campaign monitoring.");
  }
  if (decisionCount === 0) {
    reasons.push("No reasoned decision records exist yet.");
    recommendedNextActions.push("Plan a deterministic next-best action for this campaign.");
  }
  if (learningCount === 0 && (positive > 0 || negative > 0 || reviewed > 0)) {
    recommendedNextActions.push("Record a learning note from the current campaign signals.");
  }

  const operatorState = riskScore >= 70
    ? "pause_or_review"
    : signalScore >= 65 && readinessScore >= 50
      ? "continue_or_scale_carefully"
      : readinessScore < 40
        ? "prepare_foundation"
        : "continue_testing";

  return {
    campaignId: input.campaign.id,
    campaignName: input.campaign.name,
    status: input.campaign.status,
    health: health.health,
    operatorState,
    scores: {
      signalScore,
      riskScore,
      readinessScore,
      positiveRate,
      reviewCoverage,
      evidenceScore,
      learningScore,
      decisionScore,
    },
    counts: {
      prepared,
      reviewed,
      positive,
      negative,
      meetings,
      engagements,
      evidence: evidenceCount,
      learning: learningCount,
      decisions: decisionCount,
    },
    reasons,
    recommendedNextActions: Array.from(new Set(recommendedNextActions)).slice(0, 8),
  };
}

export function summarizeGrowthOperatorReadiness(analyses: ReturnType<typeof analyzeGrowthCampaign>[]) {
  const capabilities = listGrowthCapabilities().summary;
  const active = analyses.filter((item) => ["active", "testing", "scaling"].includes(item.status || "")).length;
  const needsReview = analyses.filter((item) => item.operatorState === "pause_or_review").length;
  const readyToContinue = analyses.filter((item) => item.operatorState === "continue_or_scale_carefully" || item.operatorState === "continue_testing").length;
  const foundationNeeded = analyses.filter((item) => item.operatorState === "prepare_foundation").length;

  return {
    campaignCount: analyses.length,
    activeCampaignCount: active,
    needsReviewCount: needsReview,
    readyToContinueCount: readyToContinue,
    foundationNeededCount: foundationNeeded,
    capabilitySummary: capabilities,
    suggestedOperatorFocus: needsReview > 0
      ? "Review risk-heavy campaigns before preparing more work."
      : foundationNeeded > 0
        ? "Build evidence, metrics, and decisions for under-instrumented campaigns."
        : readyToContinue > 0
          ? "Continue testing and prepare the next internal decision cycle."
          : "Create or activate a campaign before running the operator loop.",
  };
}
