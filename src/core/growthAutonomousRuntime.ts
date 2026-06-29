import { listGrowthCapabilities } from "./growthCapabilities";

export type GrowthCognitionStage =
  | "sense"
  | "interpret"
  | "prioritise"
  | "plan"
  | "govern"
  | "prepare"
  | "learn";

export type GrowthAutonomousRuntimeMode =
  | "supervised_brain_only"
  | "supervised_internal_metadata"
  | "approval_required_execution_ready"
  | "external_execution_blocked";

export interface GrowthAutonomousRuntimeInput {
  operatorCycle?: any;
  operatorOverview?: any;
  strategyMemory?: any;
}

function stage(stage: GrowthCognitionStage, label: string, description: string, status: "ready" | "blocked" | "needs_data", outputs: string[]) {
  return { stage, label, description, status, outputs };
}

function firstNames(rows: any[] = [], limit = 5): string[] {
  return rows.slice(0, limit).map((row) => String(row.name || row.subjectName || row.summary || row.id || "unnamed"));
}

export function buildGrowthAutonomousRuntime(input: GrowthAutonomousRuntimeInput = {}) {
  const capabilities = listGrowthCapabilities();
  const cycle = input.operatorCycle || null;
  const strategyMemory = input.strategyMemory || null;
  const loopPlan = cycle?.loopPlan || input.operatorOverview?.loopPlan || null;
  const readiness = cycle?.readiness || input.operatorOverview?.readiness || null;
  const blocked = Array.isArray(cycle?.blocked) ? cycle.blocked : [];
  const hasCampaigns = Boolean((cycle?.counts?.campaigns || input.operatorOverview?.counts?.campaigns || 0) > 0);
  const hasCycle = Boolean(cycle);
  const strategyCounts = strategyMemory?.counts || {};
  const blackboard = cycle?.blackboard || null;
  const blackboardCounts = blackboard?.counts || {};
  const hasObjectives = Boolean((strategyCounts.objectives || 0) > 0);
  const hasSegments = Boolean((strategyCounts.targetSegments || 0) > 0);
  const hasOffers = Boolean((strategyCounts.offerProfiles || 0) > 0);
  const hasPositioning = Boolean((strategyCounts.positioningProfiles || 0) > 0);
  const hasRuntimeConstraints = Boolean((strategyCounts.runtimeConstraints || 0) > 0);
  const hasStrategicIntent = hasObjectives && hasSegments && hasOffers && hasPositioning;
  const hasKnowledgeSubstrate = Boolean(
    (blackboardCounts.facts || 0) > 0 &&
    (blackboardCounts.entities || 0) > 0 &&
    (blackboardCounts.relationships || 0) > 0 &&
    (blackboardCounts.marketSignals || 0) > 0 &&
    (blackboardCounts.assets || 0) > 0
  );

  const cognitionStages = [
    stage(
      "sense",
      "Sense current state",
      "Read strategy memory, blackboard knowledge, campaigns, experiments, metrics, evidence, learning notes, decisions, cycle events, and capability posture.",
      hasCycle ? "ready" : "needs_data",
      ["strategy memory", "blackboard", "operator state", "campaign records", "cycle memory", "capability registry"]
    ),
    stage(
      "interpret",
      "Interpret signals",
      "Convert raw metadata into strategic fit, knowledge context, campaign health, readiness, risk, blockers, and opportunity context.",
      hasCampaigns && hasStrategicIntent && hasKnowledgeSubstrate ? "ready" : "needs_data",
      ["strategic fit", "knowledge context", "analysis scores", "risk posture", "readiness posture", "blocker list"]
    ),
    stage(
      "prioritise",
      "Prioritise next focus",
      "Pick the most important objective, segment, campaign, knowledge gap, or setup gap using deterministic priority and risk rules.",
      loopPlan && hasStrategicIntent ? "ready" : "needs_data",
      ["selected objective", "selected campaign", "selected knowledge gap", "selected step", "priority", "rationale"]
    ),
    stage(
      "plan",
      "Plan next-best action",
      "Prepare the next internal command or candidate action set without sending, posting, browsing, or calling AI.",
      loopPlan ? "ready" : "needs_data",
      ["recommended command", "candidate actions", "decision plan"]
    ),
    stage(
      "govern",
      "Govern risk and permission",
      "Apply runtime constraints, autonomy level, write confirmation, external action, cost, AI, network, and channel gates before any capability could execute.",
      hasRuntimeConstraints ? "ready" : "needs_data",
      ["runtime constraints", "safety posture", "blocked capabilities", "approval requirements"]
    ),
    stage(
      "prepare",
      "Prepare controlled work",
      "At the current phase this only prepares internal metadata. Drafting, browser work, email, posting, and CRM actions remain blocked.",
      "blocked",
      ["internal metadata only", "no external state change"]
    ),
    stage(
      "learn",
      "Learn from outcomes",
      "Record metric snapshots, evidence, learning notes, blackboard facts, decisions, and cycle events so the next loop has memory.",
      "ready",
      ["learning notes", "blackboard facts", "cycle events", "decision history", "metrics"]
    ),
  ];

  const autonomyLevels = [
    { level: 0, name: "Observe", allowed: true, description: "Read state and produce reports." },
    { level: 1, name: "Internal metadata", allowed: true, description: "Create confirmed internal records only." },
    { level: 2, name: "Draft only", allowed: false, description: "Prepare drafts for review. Currently disabled until AI drafting and approval packs are implemented." },
    { level: 3, name: "Approval-required external", allowed: false, description: "Could execute externally only after approval, caps, suppression, identity, and audit controls exist." },
    { level: 4, name: "Bounded autonomous external", allowed: false, description: "Not enabled. Requires mature governance and channel-specific controls." },
    { level: 5, name: "Unrestricted", allowed: false, description: "Never allowed for this system." },
  ];

  const hardBlocks = [
    "send_email",
    "post_social",
    "submit_form",
    "browser_execution",
    "ai_drafting",
    "paid_spend",
    "crm_write",
    "external_delivery",
    "identity_impersonation",
    "bulk_unapproved_outreach",
  ];

  const setupBlocks = [
    !hasObjectives ? "missing_objectives" : null,
    !hasSegments ? "missing_target_segments" : null,
    !hasOffers ? "missing_offer_profiles" : null,
    !hasPositioning ? "missing_positioning_profiles" : null,
    !hasRuntimeConstraints ? "missing_runtime_constraints" : null,
    !hasKnowledgeSubstrate ? "missing_knowledge_substrate" : null,
  ].filter(Boolean) as string[];

  return {
    ok: true,
    mode: "growth_autonomous_runtime",
    contractVersion: "growth_autonomous_runtime_v3_strategy_blackboard",
    runtimeMode: "supervised_internal_metadata" as GrowthAutonomousRuntimeMode,
    mission: "Continuously improve EVAVO growth operations by sensing strategic intent, blackboard knowledge, and campaign state, interpreting signals, choosing the next safest internal step, recording memory, and preparing for future governed execution.",
    strategicIntent: strategyMemory ? {
      counts: strategyCounts,
      activeObjectives: firstNames(strategyMemory.objectives),
      targetSegments: firstNames(strategyMemory.targetSegments),
      offerProfiles: firstNames(strategyMemory.offerProfiles),
      positioningProfiles: firstNames(strategyMemory.positioningProfiles),
      runtimeConstraints: firstNames(strategyMemory.runtimeConstraints),
    } : null,
    knowledgeSubstrate: blackboard ? {
      complete: blackboard.complete,
      missing: blackboard.missing || [],
      counts: blackboardCounts,
      facts: blackboard.facts || [],
      entities: blackboard.entities || [],
      marketSignals: blackboard.marketSignals || [],
      assets: blackboard.assets || [],
    } : null,
    currentFocus: loopPlan ? {
      selectedStep: loopPlan.selectedStep,
      targetCampaignId: loopPlan.targetCampaignId,
      targetCampaignName: loopPlan.targetCampaignName,
      priority: loopPlan.priority,
      recommendedCommand: loopPlan.recommendedCommand,
      rationale: loopPlan.rationale || [],
    } : null,
    readiness,
    blockers: Array.from(new Set([...setupBlocks, ...blocked, ...hardBlocks])),
    cognitionStages,
    autonomyLevels,
    capabilitySummary: capabilities.summary,
    governance: {
      maxAllowedAutonomyLevel: 1,
      requiresConfirmForWrites: true,
      externalStateChangeAllowed: false,
      callsAIAllowed: false,
      callsNetworkAllowed: false,
      canSendEmail: false,
      canPostSocial: false,
      canSubmitForms: false,
      canRunBrowser: false,
      canSpendMoney: false,
      canImpersonateHuman: false,
      hasRuntimeConstraints,
      hasKnowledgeSubstrate,
    },
    nextRuntimeMilestones: [
      "Seed objectives, target segments, offers, positioning, runtime constraints, and blackboard knowledge for EVAVO.",
      "Add evidence pack schema for every proposed external action.",
      "Add approval request records with reviewer, expiry, and action-specific payloads.",
      "Add suppression, caps, channel policy, and contact-permission gates.",
      "Add AI draft generation only after prompts, voice rules, evidence citation, and review workflows exist.",
      "Add browser/email/social connectors only after external-action governance is complete.",
    ],
    safety: {
      readOnly: true,
      internalMetadataOnly: true,
      externalStateChange: false,
      callsAI: false,
      callsNetwork: false,
    },
  };
}
