export type GrowthCapabilityCategory = "research" | "analysis" | "drafting" | "browser" | "external_delivery" | "internal_ops" | "reporting";
export type GrowthAutonomyLevel = 0 | 1 | 2 | 3 | 4 | 5;
export type GrowthRiskLevel = "none" | "low" | "medium" | "high";
export type GrowthImplementationState = "available" | "planned" | "blocked";

export type GrowthCapability = {
  id: string;
  label: string;
  description: string;
  category: GrowthCapabilityCategory;
  autonomyLevelRequired: GrowthAutonomyLevel;
  callsNetwork: boolean;
  callsAI: boolean;
  touchesExternalChannel: boolean;
  externalStateChange: boolean;
  requiresApproval: boolean;
  requiresEvidence: boolean;
  requiresContactSource: boolean;
  requiresSuppressionCheck: boolean;
  costRisk: GrowthRiskLevel;
  reputationRisk: GrowthRiskLevel;
  allowedInFreeSafeMode: boolean;
  currentImplementation: GrowthImplementationState;
  notes: string[];
};

export const growthAutonomyLevels = [
  { level: 0, id: "read_only", label: "Read-only", description: "Research, summarize, score, and report without changing internal or external state." },
  { level: 1, id: "draft_only", label: "Draft-only", description: "Prepare reviewable drafts, plans, and recommendations without external action." },
  { level: 2, id: "internal_write", label: "Internal write", description: "Write internal metadata, queues, notes, labels, and approval requests with audit records." },
  { level: 3, id: "approved_external", label: "Approved external action", description: "Prepare external actions and execute only after explicit human approval." },
  { level: 4, id: "trusted_bounded_external", label: "Trusted bounded external action", description: "Execute pre-approved low-risk external actions within strict caps and monitoring." },
  { level: 5, id: "autonomous_campaign", label: "Autonomous campaign", description: "Run monitored autonomous campaigns only after proven controls, evidence, and rollback paths exist." },
] as const;

export const growthCapabilities: GrowthCapability[] = [
  { id: "research_public_website", label: "Research public website", description: "Review public website content and capture useful evidence for Growth analysis.", category: "research", autonomyLevelRequired: 0, callsNetwork: true, callsAI: false, touchesExternalChannel: false, externalStateChange: false, requiresApproval: false, requiresEvidence: true, requiresContactSource: false, requiresSuppressionCheck: false, costRisk: "low", reputationRisk: "low", allowedInFreeSafeMode: false, currentImplementation: "planned", notes: ["Public content only.", "No private or restricted areas."] },
  { id: "score_growth_signal", label: "Score growth signal", description: "Score a saved Growth signal for EVAVO fit, urgency, channel suitability, and likely value.", category: "analysis", autonomyLevelRequired: 0, callsNetwork: false, callsAI: false, touchesExternalChannel: false, externalStateChange: false, requiresApproval: false, requiresEvidence: false, requiresContactSource: false, requiresSuppressionCheck: false, costRisk: "none", reputationRisk: "none", allowedInFreeSafeMode: true, currentImplementation: "available", notes: ["Runs from saved metadata.", "Does not contact anyone."] },
  { id: "draft_message", label: "Draft message", description: "Prepare reviewable EVAVO-quality outreach or reply copy without delivering it.", category: "drafting", autonomyLevelRequired: 1, callsNetwork: false, callsAI: true, touchesExternalChannel: false, externalStateChange: false, requiresApproval: true, requiresEvidence: true, requiresContactSource: true, requiresSuppressionCheck: true, costRisk: "medium", reputationRisk: "medium", allowedInFreeSafeMode: false, currentImplementation: "planned", notes: ["Draft-only.", "Must avoid generic copy, false familiarity, and unsupported claims."] },
  { id: "draft_owned_content", label: "Draft owned-channel content", description: "Prepare reviewable EVAVO-owned content without publishing it.", category: "drafting", autonomyLevelRequired: 1, callsNetwork: false, callsAI: true, touchesExternalChannel: false, externalStateChange: false, requiresApproval: true, requiresEvidence: false, requiresContactSource: false, requiresSuppressionCheck: false, costRisk: "medium", reputationRisk: "medium", allowedInFreeSafeMode: false, currentImplementation: "planned", notes: ["Draft-only.", "Must pass EVAVO voice and claim-safety checks."] },
  { id: "prepare_browser_step", label: "Prepare browser step", description: "Prepare a controlled browser step and capture evidence before any external state change.", category: "browser", autonomyLevelRequired: 3, callsNetwork: true, callsAI: false, touchesExternalChannel: false, externalStateChange: false, requiresApproval: true, requiresEvidence: true, requiresContactSource: true, requiresSuppressionCheck: true, costRisk: "low", reputationRisk: "medium", allowedInFreeSafeMode: false, currentImplementation: "planned", notes: ["Preparation only.", "External state changes require a separate approved capability."] },
  { id: "create_internal_task", label: "Create internal task", description: "Create or update an internal Growth task, action, or note for operator follow-up.", category: "internal_ops", autonomyLevelRequired: 2, callsNetwork: false, callsAI: false, touchesExternalChannel: false, externalStateChange: false, requiresApproval: true, requiresEvidence: false, requiresContactSource: false, requiresSuppressionCheck: false, costRisk: "none", reputationRisk: "none", allowedInFreeSafeMode: true, currentImplementation: "available", notes: ["Internal metadata only.", "Current Growth queue writes are examples of this class."] },
  { id: "request_approval", label: "Request approval", description: "Create an internal approval request for a proposed higher-risk Growth action.", category: "internal_ops", autonomyLevelRequired: 2, callsNetwork: false, callsAI: false, touchesExternalChannel: false, externalStateChange: false, requiresApproval: false, requiresEvidence: true, requiresContactSource: false, requiresSuppressionCheck: false, costRisk: "none", reputationRisk: "none", allowedInFreeSafeMode: true, currentImplementation: "planned", notes: ["Approval records are internal only.", "External execution remains separate."] },
  { id: "external_delivery_approved", label: "Approved external delivery", description: "Placeholder for future reviewed external delivery through approved EVAVO channels.", category: "external_delivery", autonomyLevelRequired: 3, callsNetwork: true, callsAI: false, touchesExternalChannel: true, externalStateChange: true, requiresApproval: true, requiresEvidence: true, requiresContactSource: true, requiresSuppressionCheck: true, costRisk: "low", reputationRisk: "high", allowedInFreeSafeMode: false, currentImplementation: "blocked", notes: ["Blocked until approval records, suppression rules, caps, and execution logging exist.", "Not active in the current Worker."] },
  { id: "record_outcome", label: "Record outcome", description: "Record response, failure, result, or learning note for later reporting.", category: "internal_ops", autonomyLevelRequired: 2, callsNetwork: false, callsAI: false, touchesExternalChannel: false, externalStateChange: false, requiresApproval: false, requiresEvidence: true, requiresContactSource: false, requiresSuppressionCheck: false, costRisk: "none", reputationRisk: "none", allowedInFreeSafeMode: true, currentImplementation: "planned", notes: ["Internal learning loop only."] },
  { id: "generate_growth_brief", label: "Generate growth brief", description: "Generate a daily or weekly Growth brief from saved strategy, budget, signals, actions, and audit events.", category: "reporting", autonomyLevelRequired: 0, callsNetwork: false, callsAI: false, touchesExternalChannel: false, externalStateChange: false, requiresApproval: false, requiresEvidence: false, requiresContactSource: false, requiresSuppressionCheck: false, costRisk: "none", reputationRisk: "none", allowedInFreeSafeMode: true, currentImplementation: "available", notes: ["Current canonical daily brief is read-only and deterministic."] },
];

export function listGrowthCapabilities() {
  const categories = growthCapabilities.reduce<Record<string, number>>((counts, capability) => {
    counts[capability.category] = (counts[capability.category] || 0) + 1;
    return counts;
  }, {});
  const implementation = growthCapabilities.reduce<Record<string, number>>((counts, capability) => {
    counts[capability.currentImplementation] = (counts[capability.currentImplementation] || 0) + 1;
    return counts;
  }, {});

  return {
    contractVersion: "growth_capabilities_v1_autonomy_execution_contract",
    autonomyLevels: growthAutonomyLevels,
    capabilities: growthCapabilities,
    count: growthCapabilities.length,
    summary: {
      categories,
      implementation,
      externalStateChangeCapabilities: growthCapabilities.filter((capability) => capability.externalStateChange).length,
      approvalRequiredCapabilities: growthCapabilities.filter((capability) => capability.requiresApproval).length,
      currentlyAvailableCapabilities: growthCapabilities.filter((capability) => capability.currentImplementation === "available").length,
      blockedCapabilities: growthCapabilities.filter((capability) => capability.currentImplementation === "blocked").length,
    },
    safety: { readOnly: true, registryOnly: true, executesCapabilities: false, callsAI: false, touchesExternalChannel: false, callsNetwork: false },
  };
}
