import {
  GROWTH_ACTIVITY_BUDGET_VERSION,
  GROWTH_ACTIVITY_HARD_LIMITS,
  listGrowthActivityProfiles,
} from "./growthActivityBudget";
import { GROWTH_ACTIVITY_BUDGET_LEDGER_VERSION } from "./growthActivityBudgetLedger";
import { growthBridgeReadiness } from "./growthBridgeReadiness";
import { listGrowthWorkerRouteInventory } from "./growthBusinessRouteInventory";
import { GROWTH_INTERNAL_OPERATOR_PACK_VERSION } from "./growthInternalOperatorPack";
import { growthZeroCostEnvelope } from "./growthZeroCostEnvelope";
import { OPPORTUNITY_SOURCE_SELECTION_VERSION } from "./opportunitySourceSelection";

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
  { level: 1, id: "draft_only", label: "Draft-only model", description: "Reserved modelling level. Draft generation is disabled in the current Worker." },
  { level: 2, id: "internal_write", label: "Internal write", description: "Write internal metadata, queues, notes, labels, and approval requests with audit records and explicit confirmation." },
  { level: 3, id: "approved_external", label: "Approved external action model", description: "Reserved modelling level. External action is blocked in the current Worker." },
  { level: 4, id: "trusted_bounded_external", label: "Trusted bounded external model", description: "Reserved modelling level. Bounded external action is blocked in the current Worker." },
  { level: 5, id: "autonomous_campaign", label: "Autonomous campaign model", description: "Reserved modelling level. Autonomous campaigns are blocked in the current Worker." },
] as const;

export const growthCapabilities: GrowthCapability[] = [
  { id: "research_public_website", label: "Research public website", description: "Review public website content and capture useful evidence for Growth analysis.", category: "research", autonomyLevelRequired: 0, callsNetwork: true, callsAI: false, touchesExternalChannel: false, externalStateChange: false, requiresApproval: true, requiresEvidence: true, requiresContactSource: false, requiresSuppressionCheck: false, costRisk: "low", reputationRisk: "low", allowedInFreeSafeMode: true, currentImplementation: "available", notes: ["Manual, authenticated and exact-confirmation-gated only.", "Every source fetch requires persistent Growth activity-budget admission.", "Adaptive selection uses bounded source history and a small exploration allowance.", "Scheduled external research is disabled.", "Public content only; no private or restricted areas."] },
  { id: "score_growth_signal", label: "Score growth signal", description: "Score a saved Growth signal for EVAVO fit, urgency, channel suitability, and likely value.", category: "analysis", autonomyLevelRequired: 0, callsNetwork: false, callsAI: false, touchesExternalChannel: false, externalStateChange: false, requiresApproval: false, requiresEvidence: false, requiresContactSource: false, requiresSuppressionCheck: false, costRisk: "none", reputationRisk: "none", allowedInFreeSafeMode: true, currentImplementation: "available", notes: ["Runs from saved metadata.", "Does not contact anyone."] },
  { id: "generate_internal_operator_pack", label: "Generate internal operator pack", description: "Generate a deterministic focus queue, signal review, meeting agenda, follow-up plan and Markdown report from saved Worker review models.", category: "reporting", autonomyLevelRequired: 0, callsNetwork: false, callsAI: false, touchesExternalChannel: false, externalStateChange: false, requiresApproval: false, requiresEvidence: false, requiresContactSource: false, requiresSuppressionCheck: false, costRisk: "none", reputationRisk: "none", allowedInFreeSafeMode: true, currentImplementation: "available", notes: ["Owner-authenticated GET route only.", "Generation requires persistent Growth activity-budget admission.", "Reads saved D1 review models and writes only budget accounting.", "No email, calendar event, post, form, provider write or canonical promotion is possible."] },
  { id: "draft_message", label: "Draft message", description: "Reserved model for reviewable outreach or reply copy. Draft generation is disabled in the current Worker.", category: "drafting", autonomyLevelRequired: 1, callsNetwork: false, callsAI: true, touchesExternalChannel: false, externalStateChange: false, requiresApproval: true, requiresEvidence: true, requiresContactSource: true, requiresSuppressionCheck: true, costRisk: "medium", reputationRisk: "medium", allowedInFreeSafeMode: false, currentImplementation: "blocked", notes: ["No active drafting implementation.", "Historical draft records may remain readable but are not executable."] },
  { id: "draft_owned_content", label: "Draft owned-channel content", description: "Reserved model for reviewable owned-channel content. Draft generation is disabled in the current Worker.", category: "drafting", autonomyLevelRequired: 1, callsNetwork: false, callsAI: true, touchesExternalChannel: false, externalStateChange: false, requiresApproval: true, requiresEvidence: false, requiresContactSource: false, requiresSuppressionCheck: false, costRisk: "medium", reputationRisk: "medium", allowedInFreeSafeMode: false, currentImplementation: "blocked", notes: ["No active drafting implementation.", "No publishing capability exists."] },
  { id: "prepare_browser_step", label: "Prepare browser step", description: "Reserved model for a controlled browser step. Browser automation is disabled in the current Worker.", category: "browser", autonomyLevelRequired: 3, callsNetwork: true, callsAI: false, touchesExternalChannel: false, externalStateChange: false, requiresApproval: true, requiresEvidence: true, requiresContactSource: true, requiresSuppressionCheck: true, costRisk: "low", reputationRisk: "medium", allowedInFreeSafeMode: false, currentImplementation: "blocked", notes: ["No browser execution or preparation runtime exists.", "External state changes remain blocked."] },
  { id: "create_internal_task", label: "Create internal task", description: "Create or update an internal Growth task, action, or note for operator follow-up.", category: "internal_ops", autonomyLevelRequired: 2, callsNetwork: false, callsAI: false, touchesExternalChannel: false, externalStateChange: false, requiresApproval: true, requiresEvidence: false, requiresContactSource: false, requiresSuppressionCheck: false, costRisk: "none", reputationRisk: "none", allowedInFreeSafeMode: true, currentImplementation: "available", notes: ["Internal metadata only.", "Writes require explicit confirmation."] },
  { id: "request_approval", label: "Request approval", description: "Create an internal approval request for operator review without enabling the proposed external action.", category: "internal_ops", autonomyLevelRequired: 2, callsNetwork: false, callsAI: false, touchesExternalChannel: false, externalStateChange: false, requiresApproval: false, requiresEvidence: true, requiresContactSource: false, requiresSuppressionCheck: false, costRisk: "none", reputationRisk: "none", allowedInFreeSafeMode: true, currentImplementation: "available", notes: ["Approval records are internal metadata only.", "Creating an approval request does not enable execution.", "Writes require explicit confirmation."] },
  { id: "external_delivery_approved", label: "Approved external delivery", description: "Reserved model for future reviewed external delivery through approved EVAVO channels.", category: "external_delivery", autonomyLevelRequired: 3, callsNetwork: true, callsAI: false, touchesExternalChannel: true, externalStateChange: true, requiresApproval: true, requiresEvidence: true, requiresContactSource: true, requiresSuppressionCheck: true, costRisk: "low", reputationRisk: "high", allowedInFreeSafeMode: false, currentImplementation: "blocked", notes: ["No execution implementation exists.", "Email, social posting, forms and external state mutation are disabled."] },
  { id: "record_outcome", label: "Record outcome", description: "Record response, failure, result, or learning note for later reporting.", category: "internal_ops", autonomyLevelRequired: 2, callsNetwork: false, callsAI: false, touchesExternalChannel: false, externalStateChange: false, requiresApproval: false, requiresEvidence: true, requiresContactSource: false, requiresSuppressionCheck: false, costRisk: "none", reputationRisk: "none", allowedInFreeSafeMode: true, currentImplementation: "available", notes: ["Internal learning metadata only.", "No external action is performed."] },
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
  const zeroCostEnvelope = growthZeroCostEnvelope();

  return {
    contractVersion: "growth_capabilities_v2_registry_only",
    runtimePosture: {
      scheduledExecutionEnabled: false,
      scheduledExternalResearchEnabled: false,
      manualResearchRequiresAuthentication: true,
      manualResearchRequiresConfirmation: true,
      manualResearchIsBounded: true,
      manualResearchSavesReviewItemsOnly: true,
      adaptiveSourceSelectionEnabled: true,
      deterministicInternalOperatorPackEnabled: true,
      deterministicInternalOperatorPackVersion: GROWTH_INTERNAL_OPERATOR_PACK_VERSION,
      internalOperatorPackCallsAI: false,
      internalOperatorPackCallsNetwork: false,
      draftingEnabled: false,
      browserExecutionEnabled: false,
      externalDeliveryEnabled: false,
      autonomousCampaignsEnabled: false,
    },
    activityBudget: {
      contractVersion: GROWTH_ACTIVITY_BUDGET_VERSION,
      ledgerContractVersion: GROWTH_ACTIVITY_BUDGET_LEDGER_VERSION,
      sourceSelectionContractVersion: OPPORTUNITY_SOURCE_SELECTION_VERSION,
      internalOperatorPackContractVersion: GROWTH_INTERNAL_OPERATOR_PACK_VERSION,
      internalOperatorPackBudgetAction: "owner_brief_generate",
      defaultIntensity: "light",
      profiles: listGrowthActivityProfiles(),
      hardLimits: GROWTH_ACTIVITY_HARD_LIMITS,
      zeroPaidServiceBudget: true,
      zeroCostEnvelope,
      persistentUsageLedgerContractImplemented: true,
      persistentUsageLedgerMigrationApplied: false,
      manualResearchAdmissionIntegrated: true,
      internalOperatorPackAdmissionIntegrated: true,
      adaptiveSourceSelectionIntegrated: true,
      accountWideCloudUsageKnown: zeroCostEnvelope.accountWideUsageKnown,
      absoluteZeroCostGuaranteed: zeroCostEnvelope.absoluteZeroCostGuaranteed,
      requiredCloudflarePlan: zeroCostEnvelope.requiredCloudflarePlan,
      reservationWithinFreeLimits: zeroCostEnvelope.reservationWithinFreeLimits,
      scheduledExternalResearchEnabled: false,
      aiEnabled: false,
      browserEnabled: false,
      externalExecutionEnabled: false,
    },
    bridgeReadiness: growthBridgeReadiness,
    routeInventory: listGrowthWorkerRouteInventory(),
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
