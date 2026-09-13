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
  "business_relationship_manager_canonical_candidate_runtime_v6" as const;

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
  careersRoleAuthorityDerived: boolean;
  referralPathDerivedFromCareers: boolean;
  approvalGradeReady: boolean;
  externalEffectPerformed: false;
}>;

function withoutUnverifiedReferral(
  decision: CareersRelationshipDecision,
  roleOpen: boolean,
  verifiedPath: boolean,
): CareersRelationshipDecision {
  if (decision.suggestedNextStep !== "refer_to_role" || verifiedPath) return decision;
  if (!roleOpen) throw new Error("RELATIONSHIP_MANAGER_CANONICAL_CANDIDATE_REFERRAL_WITHOUT_ROLE_TRUTH");
  return Object.freeze({
    ...decision,
    meetingRecommended: false,
    mustCommunicate: Object.freeze([
      ...decision.mustCommunicate,
      "The role is confirmed open, but no unique application or referral path is currently verified; do not invent or guess one.",
    ]),
    suggestedNextStep: "email_reply",
  });
}

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
  if (!callerCandidate) throw new Error("RELATIONSHIP_MANAGER_CANONICAL_CANDIDATE_CONTEXT_REQUIRED");

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
  const careersRoleAuthorityDerived = sources.cycle.candidateRoleAuthorityDerived;
  const actualActiveProcess = canonical.cycle.decision.candidateStage === "active_process";
  const expectedActiveProcess = roleTruth?.maySayRoleExists === true;

  if (!careersRoleAuthorityDerived) {
    throw new Error("RELATIONSHIP_MANAGER_CANONICAL_CANDIDATE_ROLE_AUTHORITY_NOT_DERIVED");
  }
  if (actualActiveProcess !== expectedActiveProcess) {
    throw new Error("RELATIONSHIP_MANAGER_CANONICAL_CANDIDATE_ROLE_DERIVATION_MISMATCH");
  }

  const referralPathDerivedFromCareers = Boolean(sources.cycle.applicationUrl);
  if (referralPathDerivedFromCareers && !expectedActiveProcess) {
    throw new Error("RELATIONSHIP_MANAGER_CANONICAL_CANDIDATE_REFERRAL_PATH_WITHOUT_ROLE_AUTHORITY");
  }

  const policyDecision = decideCareersRelationshipResponse({
    senderIdentityVerified:
      input.sourceHydration.cycle.identity.status === "verified"
      && Boolean(input.sourceHydration.cycle.identity.selected?.personId),
    sincereIndividualEnquiry: input.candidate.sincereIndividualEnquiry,
    asksForJobOrInternship: input.candidate.asksForJobOrInternship,
    asksForAdvice: input.candidate.asksForAdvice,
    asksForMeeting: input.candidate.asksForMeeting,
    portfolioOrCvProvided: input.candidate.portfolioOrCvProvided,
    relevantRoleConfirmed: expectedActiveProcess,
    roleTruth,
    suitableFutureInterest: input.candidate.suitableFutureInterest,
    referralPathKnown: referralPathDerivedFromCareers,
    specificUsefulAdviceAvailable: input.candidate.specificUsefulAdviceAvailable,
    suppressionActive: input.candidate.suppressionActive,
    legalOrEmploymentUncertainty: input.candidate.legalOrEmploymentUncertainty,
  });
  const careersDecision = withoutUnverifiedReferral(
    policyDecision,
    expectedActiveProcess,
    referralPathDerivedFromCareers,
  );

  if (sources.cycle.careersState === "provider_unavailable" && careersDecision.suggestedNextStep === "refer_to_role") {
    throw new Error("RELATIONSHIP_MANAGER_CANONICAL_CANDIDATE_ROLE_AUTHORITY_WIDENED");
  }
  if (careersDecision.meetingRecommended && !expectedActiveProcess) {
    throw new Error("RELATIONSHIP_MANAGER_CANONICAL_CANDIDATE_MEETING_WITHOUT_ROLE_TRUTH");
  }
  if (careersDecision.suggestedNextStep === "refer_to_role" && !expectedActiveProcess) {
    throw new Error("RELATIONSHIP_MANAGER_CANONICAL_CANDIDATE_REFERRAL_WITHOUT_ROLE_TRUTH");
  }
  if (careersDecision.suggestedNextStep === "refer_to_role" && !referralPathDerivedFromCareers) {
    throw new Error("RELATIONSHIP_MANAGER_CANONICAL_CANDIDATE_REFERRAL_WITHOUT_VERIFIED_PATH");
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
      careersRoleAuthorityDerived,
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
    careersRoleAuthorityDerived,
    referralPathDerivedFromCareers,
    approvalGradeReady: canonical.approvalGradeReady && careersDecision.disposition === "reply",
    externalEffectPerformed: false,
  });
}
