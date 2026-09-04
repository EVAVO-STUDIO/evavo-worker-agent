import type { CanonicalRelationshipManagerCandidateResult } from "./businessRelationshipManagerCanonicalCandidateRuntime";
import {
  prepareCanonicalRelationshipManagerCommunicationForApproval,
  type CanonicalRelationshipManagerApprovalPreparation,
} from "./businessRelationshipManagerCanonicalApprovalRuntime";

export const BUSINESS_RELATIONSHIP_MANAGER_CANONICAL_CANDIDATE_APPROVAL_RUNTIME_CONTRACT =
  "business_relationship_manager_canonical_candidate_approval_runtime_v1" as const;

type CanonicalApprovalInput = Parameters<typeof prepareCanonicalRelationshipManagerCommunicationForApproval>[0];

export type CanonicalCandidateApprovalPreparation = Readonly<{
  contract: typeof BUSINESS_RELATIONSHIP_MANAGER_CANONICAL_CANDIDATE_APPROVAL_RUNTIME_CONTRACT;
  candidateRuntimeContract: CanonicalRelationshipManagerCandidateResult["contract"];
  careersDisposition: CanonicalRelationshipManagerCandidateResult["careersDecision"]["disposition"];
  preparation: CanonicalRelationshipManagerApprovalPreparation;
  externalEffectPerformed: false;
}>;

export function prepareCanonicalCandidateCommunicationForApproval(
  input: Omit<CanonicalApprovalInput, "canonicalCycle"> & Readonly<{
    candidateResult: CanonicalRelationshipManagerCandidateResult;
  }>,
): CanonicalCandidateApprovalPreparation {
  const candidate = input.candidateResult;
  if (candidate.contract !== "business_relationship_manager_canonical_candidate_runtime_v1") {
    throw new Error("RELATIONSHIP_MANAGER_CANDIDATE_APPROVAL_RUNTIME_CONTRACT_INVALID");
  }
  if (!candidate.approvalGradeReady) {
    throw new Error("RELATIONSHIP_MANAGER_CANDIDATE_APPROVAL_NOT_READY");
  }
  if (candidate.careersDecision.disposition !== "reply") {
    throw new Error("RELATIONSHIP_MANAGER_CANDIDATE_APPROVAL_POLICY_NOT_REPLY");
  }
  if (candidate.sources.cycle.careersState === "provider_unavailable") {
    throw new Error("RELATIONSHIP_MANAGER_CANDIDATE_APPROVAL_CAREERS_UNAVAILABLE");
  }
  if (!candidate.sources.cycle.careersEvidenceRef) {
    throw new Error("RELATIONSHIP_MANAGER_CANDIDATE_APPROVAL_CAREERS_EVIDENCE_REQUIRED");
  }
  const canonical = candidate.sources.cycle.canonical.brain.canonicalCycle;
  if (!canonical.decisionContext.evidenceRefs.includes(candidate.sources.cycle.careersEvidenceRef)) {
    throw new Error("RELATIONSHIP_MANAGER_CANDIDATE_APPROVAL_CAREERS_EVIDENCE_NOT_BOUND");
  }
  if (
    candidate.careersDecision.suggestedNextStep === "refer_to_role"
    && !candidate.sources.cycle.roleTruth?.maySayRoleExists
  ) {
    throw new Error("RELATIONSHIP_MANAGER_CANDIDATE_APPROVAL_REFERRAL_WITHOUT_ROLE_TRUTH");
  }
  if (candidate.careersDecision.meetingRecommended && !candidate.sources.cycle.roleTruth?.maySayRoleExists) {
    throw new Error("RELATIONSHIP_MANAGER_CANDIDATE_APPROVAL_MEETING_WITHOUT_ROLE_TRUTH");
  }
  if (candidate.sources.cycle.roleTruth?.maySayNotHiring) {
    throw new Error("RELATIONSHIP_MANAGER_CANDIDATE_APPROVAL_GLOBAL_NOT_HIRING_FORBIDDEN");
  }

  const { candidateResult: _candidateResult, ...approvalInput } = input;
  const preparation = prepareCanonicalRelationshipManagerCommunicationForApproval({
    ...approvalInput,
    canonicalCycle: canonical,
  });
  if (preparation.canonicalCycleId !== canonical.cycle.cycleId) {
    throw new Error("RELATIONSHIP_MANAGER_CANDIDATE_APPROVAL_CYCLE_MISMATCH");
  }

  return Object.freeze({
    contract: BUSINESS_RELATIONSHIP_MANAGER_CANONICAL_CANDIDATE_APPROVAL_RUNTIME_CONTRACT,
    candidateRuntimeContract: candidate.contract,
    careersDisposition: candidate.careersDecision.disposition,
    preparation,
    externalEffectPerformed: false,
  });
}
