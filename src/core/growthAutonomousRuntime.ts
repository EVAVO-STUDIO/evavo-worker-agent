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
}

function stage(stage: GrowthCognitionStage, label: string, description: string, status: "ready" | "blocked" | "needs_data", outputs: string[]) {
  return { stage, label, description, status, outputs };
}

export function buildGrowthAutonomousRuntime(input: GrowthAutonomousRuntimeInput = {}) {
  const capabilities = listGrowthCapabilities();
  const cycle = input.operatorCycle || null;
  const loopPlan = cycle?.loopPlan || input.operatorOverview?.loopPlan || null;
  const readiness = cycle?.readiness || input.operatorOverview?.readiness || null;
  const blocked = Array.isArray(cycle?.blocked) ? cycle.blocked : [];
  const hasCampaigns = Boolean((cycle?.counts?.campaigns || input.operatorOverview?.counts?.campaigns || 0) > 0);
  const hasCycle = Boolean(cycle);

  const cognitionStages = [
    stage(
      "sense",
      "Sense current state",
      "Read campaigns, experiments, metrics, evidence, learning notes, decisions, cycle events, and capability posture.",
      hasCycle ? "ready" : "needs_data",
      ["operator state", "campaign records", "cycle memory", "capability registry"]
    ),
    stage(
      "interpret",
      "Interpret signals",
      "Convert raw metadata into campaign health, readiness, risk, blockers, and opportunity context.",
      hasCampaigns ? "ready" : "needs_data",
      ["analysis scores", "risk posture", "readiness posture", "blocker list"]
    ),
    stage(
      "prioritise",
      "Prioritise next focus",
      "Pick the most important campaign or setup gap using deterministic priority and risk rules.",
      loopPlan ? "ready" : "needs_data",
      ["selected campaign", "selected step", "priority", "rationale"]
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
      "Apply autonomy level, write confirmation, external action, cost, AI, network, and channel gates before any capability could execute.",
      "ready",
      ["safety posture", "blocked capabilities", "approval requirements"]
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
      "Record metric snapshots, evidence, learning notes, decisions, and cycle events so the next loop has memory.",
      "ready",
      ["learning notes", "cycle events", "decision history", "metrics"]
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

  return {
    ok: true,
    mode: "growth_autonomous_runtime",
    contractVersion: "growth_autonomous_runtime_v1_supervised_brain_only",
    runtimeMode: "supervised_internal_metadata" as GrowthAutonomousRuntimeMode,
    mission: "Continuously improve EVAVO growth operations by sensing campaign state, interpreting signals, choosing the next safest internal step, recording memory, and preparing for future governed execution.",
    currentFocus: loopPlan ? {
      selectedStep: loopPlan.selectedStep,
      targetCampaignId: loopPlan.targetCampaignId,
      targetCampaignName: loopPlan.targetCampaignName,
      priority: loopPlan.priority,
      recommendedCommand: loopPlan.recommendedCommand,
      rationale: loopPlan.rationale || [],
    } : null,
    readiness,
    blockers: Array.from(new Set([...blocked, ...hardBlocks])),
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
    },
    nextRuntimeMilestones: [
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
