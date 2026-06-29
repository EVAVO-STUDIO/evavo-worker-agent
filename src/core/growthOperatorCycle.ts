import { analyzeGrowthCampaign, summarizeGrowthOperatorReadiness } from "./growthCampaignAnalysis";
import { planGrowthOperatorLoop } from "./growthOperatorLoop";
import { listGrowthCapabilities } from "./growthCapabilities";

export interface GrowthOperatorCycleInput {
  campaigns: any[];
  experiments: any[];
  decisions: any[];
  metrics: any[];
  evidence: any[];
  learning: any[];
}

function latestMetricFor(metrics: any[], campaignId: string) {
  const rows = metrics.filter((metric) => metric.campaign_id === campaignId);
  rows.sort((a, b) => String(b.metric_date || b.updated_at || "").localeCompare(String(a.metric_date || a.updated_at || "")));
  return rows[0] || null;
}

function countFor(rows: any[], campaignId: string): number {
  return rows.filter((row) => row.campaign_id === campaignId).length;
}

function groupExperiments(experiments: any[], campaignId: string) {
  return experiments.filter((experiment) => experiment.campaign_id === campaignId).slice(0, 5);
}

function groupDecisions(decisions: any[], campaignId: string) {
  return decisions.filter((decision) => decision.campaign_id === campaignId).slice(0, 5);
}

export function buildGrowthOperatorCycle(input: GrowthOperatorCycleInput) {
  const analyses = input.campaigns.map((campaign) => analyzeGrowthCampaign({
    campaign,
    metrics: latestMetricFor(input.metrics, campaign.id),
    evidenceCount: countFor(input.evidence, campaign.id),
    learningCount: countFor(input.learning, campaign.id),
    decisionCount: countFor(input.decisions, campaign.id),
  }));

  const readiness = summarizeGrowthOperatorReadiness(analyses);
  const loopPlan = planGrowthOperatorLoop(input);
  const capabilityRegistry = listGrowthCapabilities();

  const campaignBriefs = input.campaigns.map((campaign) => {
    const analysis = analyses.find((item) => item.campaignId === campaign.id);
    return {
      campaignId: campaign.id,
      name: campaign.name,
      status: campaign.status,
      priority: campaign.priority,
      targetSegment: campaign.target_segment,
      primaryOffer: campaign.primary_offer,
      experiments: groupExperiments(input.experiments, campaign.id).map((experiment) => ({ id: experiment.id, name: experiment.name, status: experiment.status, confidenceScore: experiment.confidence_score })),
      latestMetric: latestMetricFor(input.metrics, campaign.id),
      latestDecisions: groupDecisions(input.decisions, campaign.id).map((decision) => ({ id: decision.id, selectedAction: decision.selected_action, utilityScore: decision.utility_score, riskScore: decision.risk_score, nextStep: decision.next_step })),
      analysis,
    };
  });

  const blocked = [] as string[];
  if (!input.campaigns.length) blocked.push("no_campaigns");
  if (loopPlan.selectedStep === "add_metric_snapshot") blocked.push("missing_metric_snapshot");
  if (loopPlan.selectedStep === "add_evidence") blocked.push("missing_evidence");
  if (loopPlan.selectedStep === "plan_decision") blocked.push("missing_reasoned_decision");

  return {
    ok: true,
    mode: "growth_operator_cycle",
    contractVersion: "growth_operator_cycle_v1_read_only",
    readiness,
    loopPlan,
    campaignBriefs,
    capabilitySummary: capabilityRegistry.summary,
    blocked,
    counts: {
      campaigns: input.campaigns.length,
      experiments: input.experiments.length,
      decisions: input.decisions.length,
      metrics: input.metrics.length,
      evidence: input.evidence.length,
      learning: input.learning.length,
      analyses: analyses.length,
    },
    safety: {
      readOnly: true,
      internalMetadataOnly: true,
      externalStateChange: false,
      callsAI: false,
      callsNetwork: false,
    },
  };
}
