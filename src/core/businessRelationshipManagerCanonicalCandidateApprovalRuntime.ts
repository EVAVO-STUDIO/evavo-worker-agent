import {
  runCanonicalRelationshipManagerCandidateResponse,
  type CanonicalRelationshipManagerCandidateInput,
  type CanonicalRelationshipManagerCandidateResult,
} from "./businessRelationshipManagerCanonicalCandidateRuntime";
import {
  reviewCandidateDraftAgainstPolicy,
  type CandidateDraftPolicyReview,
} from "./businessCandidateDraftPolicyReview";
import {
  assertCanonicalRelationshipManagerApprovalReadiness,
  assertCanonicalRelationshipManagerDraftBinding,
} from "./businessRelationshipManagerCanonicalApprovalRuntime";
import {
  prepareRelationshipManagerCommunicationForApproval,
  type RelationshipManagerApprovalPreparation,
} from "./businessRelationshipManagerApprovalRuntime";
import { businessSha256 } from "./businessSha256";

export const BUSINESS_RELATIONSHIP_MANAGER_CANONICAL_CANDIDATE_APPROVAL_RUNTIME_CONTRACT =
  "business_relationship_manager_canonical_candidate_approval_runtime_v5" as const;

type ApprovalInput = Parameters<typeof prepareRelationshipManagerCommunicationForApproval>[0];

export type CanonicalCandidateApprovalPreparation = Readonly<{
  contract: typeof BUSINESS_RELATIONSHIP_MANAGER_CANONICAL_CANDIDATE_APPROVAL_RUNTIME_CONTRACT;
  candidateRuntimeContract: CanonicalRelationshipManagerCandidateResult["contract"];
  careersDisposition: CanonicalRelationshipManagerCandidateResult["careersDecision"]["disposition"];
  careersEvidenceRef: string;
  candidatePolicyEvidenceRef: string;
  roleTruthStatus: NonNullable<CanonicalRelationshipManagerCandidateResult["sources"]["cycle"]["roleTruth"]>["status"];
  verifiedApplicationUrl: string | null;
  draftPolicyReview: CandidateDraftPolicyReview;
  candidatePolicyBound: true;
  freshDraftContextBound: true;
  preparation: RelationshipManagerApprovalPreparation;
  externalEffectPerformed: false;
}>;

export type CanonicalCandidateApprovalInput = Readonly<{
  candidateRuntimeInput: CanonicalRelationshipManagerCandidateInput;
  approval: Omit<ApprovalInput, "cycle">;
}>;

function candidatePolicyEvidenceRef(input: Readonly<{
  careersEvidenceRef: string;
  roleTruthStatus: string;
  maySayRoleExists: boolean;
  verifiedApplicationUrl: string | null;
  careersDisposition: string;
  meetingRecommended: boolean;
  suggestedNextStep: string;
}>): string {
  const canonical = JSON.stringify({
    careersEvidenceRef: input.careersEvidenceRef,
    roleTruthStatus: input.roleTruthStatus,
    maySayRoleExists: input.maySayRoleExists,
    verifiedApplicationUrl: input.verifiedApplicationUrl,
    careersDisposition: input.careersDisposition,
    meetingRecommended: input.meetingRecommended,
    suggestedNextStep: input.suggestedNextStep,
  });
  return `candidate-policy:${businessSha256(canonical)}`;
}

export async function prepareCanonicalCandidateCommunicationForApproval(
  input: CanonicalCandidateApprovalInput,
): Promise<CanonicalCandidateApprovalPreparation> {
  const candidate = await runCanonicalRelationshipManagerCandidateResponse(input.candidateRuntimeInput);
  if (!candidate.approvalGradeReady) throw new Error("RELATIONSHIP_MANAGER_CANDIDATE_APPROVAL_NOT_READY");
  if (candidate.careersDecision.disposition !== "reply") throw new Error("RELATIONSHIP_MANAGER_CANDIDATE_APPROVAL_POLICY_NOT_REPLY");
  if (candidate.sources.cycle.careersState === "provider_unavailable") {
    throw new Error("RELATIONSHIP_MANAGER_CANDIDATE_APPROVAL_CAREERS_UNAVAILABLE");
  }

  const careersEvidenceRef = candidate.sources.cycle.careersEvidenceRef?.trim() ?? "";
  if (!careersEvidenceRef) throw new Error("RELATIONSHIP_MANAGER_CANDIDATE_APPROVAL_CAREERS_EVIDENCE_REQUIRED");
  const roleTruth = candidate.sources.cycle.roleTruth;
  if (!roleTruth) throw new Error("RELATIONSHIP_MANAGER_CANDIDATE_APPROVAL_ROLE_TRUTH_REQUIRED");
  if (roleTruth.status === "conflicting") throw new Error("RELATIONSHIP_MANAGER_CANDIDATE_APPROVAL_ROLE_TRUTH_CONFLICTING");
  if (roleTruth.maySayNotHiring) throw new Error("RELATIONSHIP_MANAGER_CANDIDATE_APPROVAL_GLOBAL_NOT_HIRING_FORBIDDEN");
  if (candidate.careersDecision.suggestedNextStep === "refer_to_role" && !roleTruth.maySayRoleExists) {
    throw new Error("RELATIONSHIP_MANAGER_CANDIDATE_APPROVAL_REFERRAL_WITHOUT_ROLE_TRUTH");
  }
  if (candidate.careersDecision.meetingRecommended && !roleTruth.maySayRoleExists) {
    throw new Error("RELATIONSHIP_MANAGER_CANDIDATE_APPROVAL_MEETING_WITHOUT_ROLE_TRUTH");
  }

  const verifiedApplicationUrl = candidate.sources.cycle.applicationUrl;
  if (verifiedApplicationUrl && !roleTruth.maySayRoleExists) {
    throw new Error("RELATIONSHIP_MANAGER_CANDIDATE_APPROVAL_APPLICATION_PATH_WITHOUT_ROLE_AUTHORITY");
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
  assertCanonicalRelationshipManagerDraftBinding({ canonical, handoff: input.approval.handoff });

  const policyEvidenceRef = candidatePolicyEvidenceRef({
    careersEvidenceRef,
    roleTruthStatus: roleTruth.status,
    maySayRoleExists: roleTruth.maySayRoleExists,
    verifiedApplicationUrl,
    careersDisposition: candidate.careersDecision.disposition,
    meetingRecommended: candidate.careersDecision.meetingRecommended,
    suggestedNextStep: candidate.careersDecision.suggestedNextStep,
  });
  const supplementalEvidence = Object.freeze([...new Set([
    ...(input.approval.evidenceIds ?? canonical.cycle.decision.evidenceIds),
    policyEvidenceRef,
  ])]);
  const preparation = prepareRelationshipManagerCommunicationForApproval({
    ...input.approval,
    evidenceIds: supplementalEvidence,
    cycle: canonical.cycle,
  });
  if (preparation.cycleId !== canonical.cycle.cycleId || preparation.decisionPackageId !== canonical.cycle.decision.packageId) {
    throw new Error("RELATIONSHIP_MANAGER_CANDIDATE_APPROVAL_PREPARATION_IDENTITY_MISMATCH");
  }
  if (!preparation.approvalCandidate.evidenceIds.includes(policyEvidenceRef)) {
    throw new Error("RELATIONSHIP_MANAGER_CANDIDATE_APPROVAL_POLICY_EVIDENCE_NOT_BOUND");
  }

  const callerCandidate = input.candidateRuntimeInput.sourceHydration.cycle.candidate;
  if (!callerCandidate) throw new Error("RELATIONSHIP_MANAGER_CANDIDATE_APPROVAL_CANDIDATE_CONTEXT_REQUIRED");
  const draftPolicyReview = reviewCandidateDraftAgainstPolicy({
    body: preparation.approvalCandidate.material.body,
    roleTruth,
    careersDecision: candidate.careersDecision,
    asksForJobOrInternship: input.candidateRuntimeInput.candidate.asksForJobOrInternship === true,
    asksForMeeting: input.candidateRuntimeInput.candidate.asksForMeeting === true,
    portfolioOrCvProvided: input.candidateRuntimeInput.candidate.portfolioOrCvProvided === true,
    materialsActuallyReviewed: callerCandidate.materialsActuallyReviewed,
    suitableFutureInterest: input.candidateRuntimeInput.candidate.suitableFutureInterest === true,
    expectedApplicationUrl: verifiedApplicationUrl,
  });
  if (!draftPolicyReview.ready) {
    throw new Error(`RELATIONSHIP_MANAGER_CANDIDATE_APPROVAL_DRAFT_POLICY_BLOCKED:${draftPolicyReview.blockers.join(",")}`);
  }

  return Object.freeze({
    contract: BUSINESS_RELATIONSHIP_MANAGER_CANONICAL_CANDIDATE_APPROVAL_RUNTIME_CONTRACT,
    candidateRuntimeContract: candidate.contract,
    careersDisposition: candidate.careersDecision.disposition,
    careersEvidenceRef,
    candidatePolicyEvidenceRef: policyEvidenceRef,
    roleTruthStatus: roleTruth.status,
    verifiedApplicationUrl,
    draftPolicyReview,
    candidatePolicyBound: true,
    freshDraftContextBound: true,
    preparation,
    externalEffectPerformed: false,
  });
}
