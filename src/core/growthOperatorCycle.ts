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
  strategyMemory?: any;
  blackboard?: any;
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

function firstNames(rows: any[] = [], limit = 5): string[] {
  return rows.slice(0, limit).map((row) => String(row.name || row.subject_name || row.summary || row.id || "unnamed"));
}

function strategySetup(strategyMemory: any) {
  const counts = strategyMemory?.counts || {};
  const hasObjectives = Boolean((counts.objectives || 0) > 0);
  const hasSegments = Boolean((counts.targetSegments || 0) > 0);
  const hasOffers = Boolean((counts.offerProfiles || 0) > 0);
  const hasPositioning = Boolean((counts.positioningProfiles || 0) > 0);
  const hasRuntimeConstraints = Boolean((counts.runtimeConstraints || 0) > 0);
  const missing = [
    !hasObjectives ? "missing_objectives" : null,
    !hasSegments ? "missing_target_segments" : null,
    !hasOffers ? "missing_offer_profiles" : null,
    !hasPositioning ? "missing_positioning_profiles" : null,
    !hasRuntimeConstraints ? "missing_runtime_constraints" : null,
  ].filter(Boolean) as string[];

  return {
    complete: missing.length === 0,
    missing,
    counts,
    activeObjectives: firstNames(strategyMemory?.objectives),
    targetSegments: firstNames(strategyMemory?.targetSegments),
    offerProfiles: firstNames(strategyMemory?.offerProfiles),
    positioningProfiles: firstNames(strategyMemory?.positioningProfiles),
    runtimeConstraints: firstNames(strategyMemory?.runtimeConstraints),
  };
}

function blackboardSetup(blackboard: any) {
  const counts = blackboard?.counts || {};
  const hasFacts = Boolean((counts.facts || 0) > 0);
  const hasEntities = Boolean((counts.entities || 0) > 0);
  const hasRelationships = Boolean((counts.relationships || 0) > 0);
  const hasMarketSignals = Boolean((counts.marketSignals || 0) > 0);
  const hasAssets = Boolean((counts.assets || 0) > 0);
  const missing = [
    !hasFacts ? "missing_blackboard_facts" : null,
    !hasEntities ? "missing_growth_entities" : null,
    !hasRelationships ? "missing_entity_relationships" : null,
    !hasMarketSignals ? "missing_market_signals" : null,
    !hasAssets ? "missing_asset_inventory" : null,
  ].filter(Boolean) as string[];

  return {
    complete: missing.length === 0,
    missing,
    counts,
    facts: firstNames(blackboard?.facts, 5),
    entities: firstNames(blackboard?.entities, 5),
    marketSignals: firstNames(blackboard?.marketSignals, 5),
    assets: firstNames(blackboard?.assets, 5),
  };
}

function nextBestInternalStep(loopPlan: any, blocked: string[]) {
  return {
    step: loopPlan.selectedStep,
    priority: loopPlan.priority,
    targetCampaignId: loopPlan.targetCampaignId,
    targetCampaignName: loopPlan.targetCampaignName,
    recommendedCommand: loopPlan.recommendedCommand,
    recommendedPayloadHint: loopPlan.recommendedPayloadHint || null,
    dashboardAnchor: loopPlan.dashboardAnchor || null,
    setupGap: loopPlan.setupGap || null,
    approvalPack: loopPlan.approvalPack || null,
    rationale: loopPlan.rationale || [],
    blockedBy: Array.from(new Set([...(loopPlan.blockedBy || []), ...blocked])),
    safety: loopPlan.safety,
  };
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
  const strategy = strategySetup(input.strategyMemory);
  const blackboard = blackboardSetup(input.blackboard);

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
  if (!strategy.complete) blocked.push(...strategy.missing);
  if (!blackboard.complete) blocked.push(...blackboard.missing);
  if (loopPlan.selectedStep === "add_metric_snapshot") blocked.push("missing_metric_snapshot");
  if (loopPlan.selectedStep === "add_evidence") blocked.push("missing_evidence");
  if (loopPlan.selectedStep === "plan_decision") blocked.push("missing_reasoned_decision");

  const uniqueBlocked = Array.from(new Set(blocked));
  const nextStep = nextBestInternalStep(loopPlan, uniqueBlocked);

  return {
    ok: true,
    mode: "growth_operator_cycle",
    contractVersion: "growth_operator_cycle_v3_strategy_blackboard_read_only",
    readiness,
    strategy,
    blackboard,
    loopPlan,
    nextBestInternalStep: nextStep,
    approvalPack: nextStep.approvalPack,
    campaignBriefs,
    capabilitySummary: capabilityRegistry.summary,
    blocked: uniqueBlocked,
    counts: {
      campaigns: input.campaigns.length,
      experiments: input.experiments.length,
      decisions: input.decisions.length,
      metrics: input.metrics.length,
      evidence: input.evidence.length,
      learning: input.learning.length,
      analyses: analyses.length,
      objectives: strategy.counts.objectives || 0,
      targetSegments: strategy.counts.targetSegments || 0,
      offerProfiles: strategy.counts.offerProfiles || 0,
      positioningProfiles: strategy.counts.positioningProfiles || 0,
      runtimeConstraints: strategy.counts.runtimeConstraints || 0,
      blackboardFacts: blackboard.counts.facts || 0,
      blackboardEntities: blackboard.counts.entities || 0,
      blackboardRelationships: blackboard.counts.relationships || 0,
      marketSignals: blackboard.counts.marketSignals || 0,
      assets: blackboard.counts.assets || 0,
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
