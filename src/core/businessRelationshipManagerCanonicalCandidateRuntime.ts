import {
  decideCareersRelationshipResponse,
  type CareersRelationshipDecision,
} from "./businessCareersRelationshipPolicy";
import {
  runCanonicalRelationshipManagerCycleWithSourcesFromEnv,
  type CanonicalRelationshipManagerSourceHydrationEnvInput,
  type CanonicalRelationshipManagerSourceHydrationEnvResult,
} from "./businessRelationshipManagerCanonicalSourceHydrationEnv";

export const BUSINESS_RELATIONSHIP_MANAGER_CANONICAL_CANDIDATE_RUNTIME_CONTRACT =
  "business_relationship_manager_canonical_candidate_runtime_v4" as const;

export type CanonicalCandidatePolicyInput = Readonly<{
  sincereIndividualEnquiry: boolean;
  asksForJobOrInternship?: boolean;
  asksForAdvice?: boolean;
  asksForMeeting?: boolean;
  portfolioOrCvProvided?: boolean;
  suitableFutureInterest?: boolean;
  specificUsefulAdviceAvailable?: boolean;
  suppressionActive?: boolean;
  legalOrEmploymentUncertainty?: boolean;
}>;

export type CanonicalRelationshipManagerCandidateInput = Readonly<{
  sourceHydration: Omit<CanonicalRelationshipManagerSourceHydrationEnvInput, "careersRequired">;
  candidate: CanonicalCandidatePolicyInput;
}>;

export type CanonicalRelationshipManagerCandidateResult = Readonly<{
  contract: typeof BUSINESS_RELATIONSHIP_MANAGER_CANONICAL_CANDIDATE_RUNTIME_CONTRACT;
  sources: CanonicalRelationshipManagerSourceHydrationEnvResult;
  careersDecision: CareersRelationshipDecision;
  callerOpportunityAuthoritySuppressed: true;
  referralPathDerivedFromCareers: boolean;
  approvalGradeReady: boolean;
  externalEffectPerformed: false;
}>;

export async function runCanonicalRelationshipManagerCandidateResponse(
  input: CanonicalRelationshipManagerCandidateInput,
): Promise<CanonicalRelationshipManagerCandidateResult> {
  if (input.sourceHydration.cycle.scenario !== "graduate_or_candidate") {
    throw new Error("RELATIONSHIP_MANAGER_CANONICAL_CANDIDATE_SCENARIO_REQUIRED");
  }
  if (!input.sourceHydration.careersIdentity) {
    throw new Error("RELATIONSHIP_MANAGER_CANONICAL_CANDIDATE_CAREERS_IDENTITY_REQUIRED");
  }
  const callerCandidate = input.sourceHydration.cycle.candidate;
  if (!callerCandidate) {
    throw new Error("RELATIONSHIP_MANAGER_CANONICAL_CANDIDATE_CONTEXT_REQUIRED");
  }

  // Caller-provided opportunity flags are never authority. The careers hydration
  // layer may re-derive explicitRoleOpen from the dedicated careers registry.
  const sourceHydration = Object.freeze({
    ...input.sourceHydration,
    cycle: Object.freeze({
      ...input.sourceHydration.cycle,
      candidate: Object.freeze({
        ...callerCandidate,
        explicitRoleOpen: false,
        activeRecruitmentProcess: false,
      }),
    }),
  });
  const sources = await runCanonicalRelationshipManagerCycleWithSourcesFromEnv({
    ...sourceHydration,
    careersRequired: true,
  });
  const canonical = sources.cycle.canonical.brain.canonicalCycle;
  const roleTruth = sources.cycle.roleTruth;
  if (canonical.cycle.decision.candidateStage === "active_process" && !roleTruth?.maySayRoleExists) {
    throw new Error("RELATIONSHIP_MANAGER_CANONICAL_CANDIDATE_OPPORTUNITY_AUTHORITY_NOT_BACKED_BY_CAREERS");
  }
  if (roleTruth?.maySayRoleExists && canonical.cycle.decision.candidateStage !== "active_process") {
    throw new Error("RELATIONSHIP_MANAGER_CANONICAL_CANDIDATE_OPEN_ROLE_NOT_PROPAGATED");
  }

  const referralPathDerivedFromCareers = Boolean(sources.cycle.applicationUrl);
  if (referralPathDerivedFromCareers && !roleTruth?.maySayRoleExists) {
    throw new Error("RELATIONSHIP_MANAGER_CANONICAL_CANDIDATE_REFERRAL_PATH_WITHOUT_ROLE_AUTHORITY");
  }

  const careersDecision = decideCareersRelationshipResponse({
    senderIdentityVerified:
      input.sourceHydration.cycle.identity.status === "verified"
      && Boolean(input.sourceHydration.cycle.identity.selected?.personId),
    sincereIndividualEnquiry: input.candidate.sincereIndividualEnquiry,
    asksForJobOrInternship: input.candidate.asksForJobOrInternship,
    asksForAdvice: input.candidate.asksForAdvice,
    asksForMeeting: input.candidate.asksForMeeting,
    portfolioOrCvProvided: input.candidate.portfolioOrCvProvided,
    relevantRoleConfirmed: Boolean(roleTruth?.maySayRoleExists),
    roleTruth,
    suitableFutureInterest: input.candidate.suitableFutureInterest,
    referralPathKnown: referralPathDerivedFromCareers,
    specificUsefulAdviceAvailable: input.candidate.specificUsefulAdviceAvailable,
    suppressionActive: input.candidate.suppressionActive,
    legalOrEmploymentUncertainty: input.candidate.legalOrEmploymentUncertainty,
  });

  if (sources.cycle.careersState === "provider_unavailable" && careersDecision.suggestedNextStep === "refer_to_role") {
    throw new Error("RELATIONSHIP_MANAGER_CANONICAL_CANDIDATE_ROLE_AUTHORITY_WIDENED");
  }
  if (careersDecision.meetingRecommended && !roleTruth?.maySayRoleExists) {
    throw new Error("RELATIONSHIP_MANAGER_CANONICAL_CANDIDATE_MEETING_WITHOUT_ROLE_TRUTH");
  }
  if (careersDecision.suggestedNextStep === "refer_to_role" && !roleTruth?.maySayRoleExists) {
    throw new Error("RELATIONSHIP_MANAGER_CANONICAL_CANDIDATE_REFERRAL_WITHOUT_ROLE_TRUTH");
  }
  if (careersDecision.disposition === "reply" && !canonical.approvalGradeReady) {
    return Object.freeze({
      contract: BUSINESS_RELATIONSHIP_MANAGER_CANONICAL_CANDIDATE_RUNTIME_CONTRACT,
      sources,
      careersDecision: Object.freeze({
        ...careersDecision,
        disposition: "defer",
        meetingRecommended: false,
        mustCommunicate: Object.freeze([
          ...careersDecision.mustCommunicate,
          "Do not prepare an approval-grade external response until the canonical source blockers are resolved.",
        ]),
        suggestedNextStep: "request_missing_context",
      }),
      callerOpportunityAuthoritySuppressed: true,
      referralPathDerivedFromCareers,
      approvalGradeReady: false,
      externalEffectPerformed: false,
    });
  }

  return Object.freeze({
    contract: BUSINESS_RELATIONSHIP_MANAGER_CANONICAL_CANDIDATE_RUNTIME_CONTRACT,
    sources,
    careersDecision,
    callerOpportunityAuthoritySuppressed: true,
    referralPathDerivedFromCareers,
    approvalGradeReady: canonical.approvalGradeReady && careersDecision.disposition === "reply",
    externalEffectPerformed: false,
  });
}
