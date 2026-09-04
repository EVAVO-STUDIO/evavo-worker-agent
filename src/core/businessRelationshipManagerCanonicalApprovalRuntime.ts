import type { CanonicalRelationshipManagerCycle } from "./businessRelationshipManagerCanonicalRuntime";
import {
  prepareRelationshipManagerCommunicationForApproval,
  type RelationshipManagerApprovalPreparation,
} from "./businessRelationshipManagerApprovalRuntime";

export const BUSINESS_RELATIONSHIP_MANAGER_CANONICAL_APPROVAL_RUNTIME_CONTRACT =
  "business_relationship_manager_canonical_approval_runtime_v3" as const;

export const BUSINESS_CANDIDATE_POLICY_APPROVAL_BINDING_CONTRACT =
  "business_candidate_policy_approval_binding_v1" as const;

type LegacyPreparationInput = Parameters<typeof prepareRelationshipManagerCommunicationForApproval>[0];

export type CandidatePolicyApprovalBinding = Readonly<{
  contract: typeof BUSINESS_CANDIDATE_POLICY_APPROVAL_BINDING_CONTRACT;
  careersEvidenceRef: string;
  careersDisposition: "reply";
  roleTruthStatus: "confirmed_open" | "confirmed_not_open" | "no_confirmed_open_role" | "conflicting";
  maySayRoleExists: boolean;
  meetingRecommended: boolean;
  suggestedNextStep: "none" | "email_reply" | "review_materials" | "refer_to_role" | "keep_in_mind" | "request_missing_context";
}>;

export type CanonicalRelationshipManagerApprovalPreparation = Readonly<{
  contract: typeof BUSINESS_RELATIONSHIP_MANAGER_CANONICAL_APPROVAL_RUNTIME_CONTRACT;
  canonicalCycleId: string;
  candidatePolicyBound: boolean;
  preparation: RelationshipManagerApprovalPreparation;
  externalEffectPerformed: false;
}>;

function assertCandidatePolicyBinding(
  canonical: CanonicalRelationshipManagerCycle,
  binding: CandidatePolicyApprovalBinding | null | undefined,
) {
  const candidateScenario = canonical.cycle.decision.scenario === "graduate_or_candidate";
  if (!candidateScenario) {
    if (binding) throw new Error("RELATIONSHIP_MANAGER_CANONICAL_APPROVAL_UNEXPECTED_CANDIDATE_POLICY_BINDING");
    return false;
  }
  if (!binding || binding.contract !== BUSINESS_CANDIDATE_POLICY_APPROVAL_BINDING_CONTRACT) {
    throw new Error("RELATIONSHIP_MANAGER_CANONICAL_APPROVAL_CANDIDATE_POLICY_BINDING_REQUIRED");
  }
  const careersEvidenceRef = binding.careersEvidenceRef.trim();
  if (!careersEvidenceRef || !canonical.decisionContext.evidenceRefs.includes(careersEvidenceRef)) {
    throw new Error("RELATIONSHIP_MANAGER_CANONICAL_APPROVAL_CANDIDATE_CAREERS_EVIDENCE_NOT_BOUND");
  }
  if (binding.careersDisposition !== "reply") {
    throw new Error("RELATIONSHIP_MANAGER_CANONICAL_APPROVAL_CANDIDATE_POLICY_NOT_REPLY");
  }
  if (binding.roleTruthStatus === "conflicting") {
    throw new Error("RELATIONSHIP_MANAGER_CANONICAL_APPROVAL_CANDIDATE_ROLE_TRUTH_CONFLICTING");
  }
  if ((binding.suggestedNextStep === "refer_to_role" || binding.meetingRecommended) && !binding.maySayRoleExists) {
    throw new Error("RELATIONSHIP_MANAGER_CANONICAL_APPROVAL_CANDIDATE_ROLE_AUTHORITY_REQUIRED");
  }
  return true;
}

export function prepareCanonicalRelationshipManagerCommunicationForApproval(
  input: Omit<LegacyPreparationInput, "cycle"> & Readonly<{
    canonicalCycle: CanonicalRelationshipManagerCycle;
    candidatePolicyBinding?: CandidatePolicyApprovalBinding | null;
  }>,
): CanonicalRelationshipManagerApprovalPreparation {
  const canonical = input.canonicalCycle;
  if (canonical.contract !== "business_relationship_manager_canonical_runtime_v2") {
    throw new Error("RELATIONSHIP_MANAGER_CANONICAL_APPROVAL_CYCLE_CONTRACT_INVALID");
  }
  if (!canonical.approvalGradeReady || !canonical.decisionContext.approvalGradeReady || !canonical.cycle.decision.approvalGradeReady) {
    throw new Error("RELATIONSHIP_MANAGER_CANONICAL_APPROVAL_CONTEXT_NOT_READY");
  }
  if (canonical.decisionContext.relationshipId !== canonical.cycle.projection.relationshipId) {
    throw new Error("RELATIONSHIP_MANAGER_CANONICAL_APPROVAL_RELATIONSHIP_MISMATCH");
  }
  if (canonical.cycle.decision.relationshipCycleId !== canonical.cycle.cycleId) {
    throw new Error("RELATIONSHIP_MANAGER_CANONICAL_APPROVAL_CYCLE_ID_MISMATCH");
  }
  if (canonical.decisionContext.staffBrief.relationshipId !== canonical.decisionContext.relationshipId) {
    throw new Error("RELATIONSHIP_MANAGER_CANONICAL_APPROVAL_STAFF_BRIEF_RELATIONSHIP_MISMATCH");
  }
  if (!canonical.decisionContext.resolutionPlan.ready) {
    throw new Error("RELATIONSHIP_MANAGER_CANONICAL_APPROVAL_RESOLUTION_NOT_READY");
  }
  if (canonical.decisionContext.sourceReadiness && !canonical.decisionContext.sourceReadiness.ready) {
    throw new Error("RELATIONSHIP_MANAGER_CANONICAL_APPROVAL_SOURCE_READINESS_NOT_READY");
  }
  const candidatePolicyBound = assertCandidatePolicyBinding(canonical, input.candidatePolicyBinding);

  const {
    canonicalCycle: _canonicalCycle,
    candidatePolicyBinding: _candidatePolicyBinding,
    ...preparationInput
  } = input;
  const preparation = prepareRelationshipManagerCommunicationForApproval({
    ...preparationInput,
    cycle: canonical.cycle,
  });
  if (preparation.cycleId !== canonical.cycle.cycleId || preparation.decisionPackageId !== canonical.cycle.decision.packageId) {
    throw new Error("RELATIONSHIP_MANAGER_CANONICAL_APPROVAL_PREPARATION_IDENTITY_MISMATCH");
  }

  return Object.freeze({
    contract: BUSINESS_RELATIONSHIP_MANAGER_CANONICAL_APPROVAL_RUNTIME_CONTRACT,
    canonicalCycleId: canonical.cycle.cycleId,
    candidatePolicyBound,
    preparation,
    externalEffectPerformed: false,
  });
}
