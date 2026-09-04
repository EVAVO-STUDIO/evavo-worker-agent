import {
  runCanonicalRelationshipManagerCandidateResponse,
  type CanonicalRelationshipManagerCandidateInput,
  type CanonicalRelationshipManagerCandidateResult,
} from "./businessRelationshipManagerCanonicalCandidateRuntime";
import { assertCanonicalRelationshipManagerApprovalReadiness } from "./businessRelationshipManagerCanonicalApprovalRuntime";
import {
  prepareRelationshipManagerCommunicationForApproval,
  type RelationshipManagerApprovalPreparation,
} from "./businessRelationshipManagerApprovalRuntime";

export const BUSINESS_RELATIONSHIP_MANAGER_CANONICAL_CANDIDATE_APPROVAL_RUNTIME_CONTRACT =
  "business_relationship_manager_canonical_candidate_approval_runtime_v3" as const;

type ApprovalInput = Parameters<typeof prepareRelationshipManagerCommunicationForApproval>[0];

export type CanonicalCandidateApprovalPreparation = Readonly<{
  contract: typeof BUSINESS_RELATIONSHIP_MANAGER_CANONICAL_CANDIDATE_APPROVAL_RUNTIME_CONTRACT;
  candidateRuntimeContract: CanonicalRelationshipManagerCandidateResult["contract"];
  careersDisposition: CanonicalRelationshipManagerCandidateResult["careersDecision"]["disposition"];
  careersEvidenceRef: string;
  roleTruthStatus: NonNullable<CanonicalRelationshipManagerCandidateResult["sources"]["cycle"]["roleTruth"]>["status"];
  candidatePolicyBound: true;
  preparation: RelationshipManagerApprovalPreparation;
  externalEffectPerformed: false;
}>;

export type CanonicalCandidateApprovalInput = Readonly<{
  candidateRuntimeInput: CanonicalRelationshipManagerCandidateInput;
  approval: Omit<ApprovalInput, "cycle">;
}>;

export async function prepareCanonicalCandidateCommunicationForApproval(
  input: CanonicalCandidateApprovalInput,
): Promise<CanonicalCandidateApprovalPreparation> {
  const candidate = await runCanonicalRelationshipManagerCandidateResponse(input.candidateRuntimeInput);
  if (!candidate.approvalGradeReady) {
    throw new Error("RELATIONSHIP_MANAGER_CANDIDATE_APPROVAL_NOT_READY");
  }
  if (candidate.careersDecision.disposition !== "reply") {
    throw new Error("RELATIONSHIP_MANAGER_CANDIDATE_APPROVAL_POLICY_NOT_REPLY");
  }
  if (candidate.sources.cycle.careersState === "provider_unavailable") {
    throw new Error("RELATIONSHIP_MANAGER_CANDIDATE_APPROVAL_CAREERS_UNAVAILABLE");
  }

  const careersEvidenceRef = candidate.sources.cycle.careersEvidenceRef?.trim() ?? "";
  if (!careersEvidenceRef) {
    throw new Error("RELATIONSHIP_MANAGER_CANDIDATE_APPROVAL_CAREERS_EVIDENCE_REQUIRED");
  }
  const roleTruth = candidate.sources.cycle.roleTruth;
  if (!roleTruth) {
    throw new Error("RELATIONSHIP_MANAGER_CANDIDATE_APPROVAL_ROLE_TRUTH_REQUIRED");
  }
  if (roleTruth.status === "conflicting") {
    throw new Error("RELATIONSHIP_MANAGER_CANDIDATE_APPROVAL_ROLE_TRUTH_CONFLICTING");
  }
  if (roleTruth.maySayNotHiring) {
    throw new Error("RELATIONSHIP_MANAGER_CANDIDATE_APPROVAL_GLOBAL_NOT_HIRING_FORBIDDEN");
  }
  if (candidate.careersDecision.suggestedNextStep === "refer_to_role" && !roleTruth.maySayRoleExists) {
    throw new Error("RELATIONSHIP_MANAGER_CANDIDATE_APPROVAL_REFERRAL_WITHOUT_ROLE_TRUTH");
  }
  if (candidate.careersDecision.meetingRecommended && !roleTruth.maySayRoleExists) {
    throw new Error("RELATIONSHIP_MANAGER_CANDIDATE_APPROVAL_MEETING_WITHOUT_ROLE_TRUTH");
  }

  const canonical = candidate.sources.cycle.canonical.brain.canonicalCycle;
  assertCanonicalRelationshipManagerApprovalReadiness(canonical);
  if (canonical.cycle.decision.scenario !== "graduate_or_candidate") {
    throw new Error("RELATIONSHIP_MANAGER_CANDIDATE_APPROVAL_SCENARIO_MISMATCH");
  }
  if (!canonical.decisionContext.evidenceRefs.includes(careersEvidenceRef)) {
    throw new Error("RELATIONSHIP_MANAGER_CANDIDATE_APPROVAL_CAREERS_EVIDENCE_NOT_BOUND");
  }
  if (!canonical.cycle.decision.evidenceIds.includes(careersEvidenceRef)) {
    throw new Error("RELATIONSHIP_MANAGER_CANDIDATE_APPROVAL_DECISION_CAREERS_EVIDENCE_NOT_BOUND");
  }

  const preparation = prepareRelationshipManagerCommunicationForApproval({
    ...input.approval,
    cycle: canonical.cycle,
  });
  if (
    preparation.cycleId !== canonical.cycle.cycleId
    || preparation.decisionPackageId !== canonical.cycle.decision.packageId
  ) {
    throw new Error("RELATIONSHIP_MANAGER_CANDIDATE_APPROVAL_PREPARATION_IDENTITY_MISMATCH");
  }

  return Object.freeze({
    contract: BUSINESS_RELATIONSHIP_MANAGER_CANONICAL_CANDIDATE_APPROVAL_RUNTIME_CONTRACT,
    candidateRuntimeContract: candidate.contract,
    careersDisposition: candidate.careersDecision.disposition,
    careersEvidenceRef,
    roleTruthStatus: roleTruth.status,
    candidatePolicyBound: true,
    preparation,
    externalEffectPerformed: false,
  });
}
