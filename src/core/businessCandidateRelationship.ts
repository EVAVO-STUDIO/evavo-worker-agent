export const BUSINESS_CANDIDATE_RELATIONSHIP_CONTRACT = "business_candidate_relationship_v2" as const;

export type CandidateRelationshipStage =
  | "new_enquiry"
  | "review_warranted"
  | "future_interest"
  | "active_process"
  | "closed_respectfully";

export type CandidateRelationshipInput = Readonly<{
  relationshipId: string;
  personId?: string | null;
  explicitRoleOpen: boolean;
  activeRecruitmentProcess: boolean;
  materialsSupplied: boolean;
  materialsActuallyReviewed: boolean;
  relevantSkillsEvidence: boolean;
  futureRelevanceEvidence: boolean;
  personalizedEffort: boolean;
  clearFitEvidence: boolean;
  suppressionActive?: boolean;
}>;

export type CandidateRelationshipDecision = Readonly<{
  contract: typeof BUSINESS_CANDIDATE_RELATIONSHIP_CONTRACT;
  stage: CandidateRelationshipStage;
  shouldReply: boolean;
  shouldRetainRelationship: boolean;
  maySayMaterialsReviewed: boolean;
  maySuggestRoleExists: boolean;
  mayPromiseFutureContact: false;
  reasons: readonly string[];
  prohibitedImplications: readonly string[];
}>;

export function decideCandidateRelationship(input: CandidateRelationshipInput): CandidateRelationshipDecision {
  const reasons: string[] = [];
  const prohibitedImplications = [
    "Do not imply a role exists unless a role is explicitly open.",
    "Do not imply supplied materials were reviewed unless they were actually reviewed.",
    "Do not promise future contact, an interview, work, an internship or a referral without separate authority.",
  ];

  if (input.suppressionActive) {
    return Object.freeze({
      contract: BUSINESS_CANDIDATE_RELATIONSHIP_CONTRACT,
      stage: "closed_respectfully",
      shouldReply: false,
      shouldRetainRelationship: false,
      maySayMaterialsReviewed: false,
      maySuggestRoleExists: false,
      mayPromiseFutureContact: false,
      reasons: Object.freeze(["Suppression is active; do not create further contact."]),
      prohibitedImplications: Object.freeze(prohibitedImplications),
    });
  }

  if (input.activeRecruitmentProcess || input.explicitRoleOpen) {
    reasons.push("There is a genuine recruitment pathway that can be described truthfully.");
    return Object.freeze({
      contract: BUSINESS_CANDIDATE_RELATIONSHIP_CONTRACT,
      stage: "active_process",
      shouldReply: true,
      shouldRetainRelationship: true,
      maySayMaterialsReviewed: input.materialsActuallyReviewed,
      maySuggestRoleExists: input.explicitRoleOpen,
      mayPromiseFutureContact: false,
      reasons: Object.freeze(reasons),
      prohibitedImplications: Object.freeze(prohibitedImplications),
    });
  }

  if (input.materialsSupplied && (input.clearFitEvidence || input.relevantSkillsEvidence)) {
    reasons.push("The supplied material has enough evidence-backed relevance to justify deliberate review rather than an automatic close.");
    return Object.freeze({
      contract: BUSINESS_CANDIDATE_RELATIONSHIP_CONTRACT,
      stage: "review_warranted",
      shouldReply: true,
      shouldRetainRelationship: true,
      maySayMaterialsReviewed: input.materialsActuallyReviewed,
      maySuggestRoleExists: false,
      mayPromiseFutureContact: false,
      reasons: Object.freeze(reasons),
      prohibitedImplications: Object.freeze(prohibitedImplications),
    });
  }

  if (input.futureRelevanceEvidence) {
    reasons.push("There is specific evidence that retaining this relationship may be useful in future, without implying a current opportunity exists.");
    return Object.freeze({
      contract: BUSINESS_CANDIDATE_RELATIONSHIP_CONTRACT,
      stage: "future_interest",
      shouldReply: true,
      shouldRetainRelationship: true,
      maySayMaterialsReviewed: input.materialsActuallyReviewed,
      maySuggestRoleExists: false,
      mayPromiseFutureContact: false,
      reasons: Object.freeze(reasons),
      prohibitedImplications: Object.freeze(prohibitedImplications),
    });
  }

  if (input.personalizedEffort) {
    reasons.push("The enquiry appears sincere and personalised, so a normal human reply is appropriate; personalisation alone is not evidence for retaining an active candidate relationship.");
    return Object.freeze({
      contract: BUSINESS_CANDIDATE_RELATIONSHIP_CONTRACT,
      stage: "new_enquiry",
      shouldReply: true,
      shouldRetainRelationship: false,
      maySayMaterialsReviewed: input.materialsActuallyReviewed,
      maySuggestRoleExists: false,
      mayPromiseFutureContact: false,
      reasons: Object.freeze(reasons),
      prohibitedImplications: Object.freeze(prohibitedImplications),
    });
  }

  reasons.push("A respectful reply is appropriate, but there is no evidence-backed reason to maintain an active candidate relationship.");
  return Object.freeze({
    contract: BUSINESS_CANDIDATE_RELATIONSHIP_CONTRACT,
    stage: "closed_respectfully",
    shouldReply: true,
    shouldRetainRelationship: false,
    maySayMaterialsReviewed: input.materialsActuallyReviewed,
    maySuggestRoleExists: false,
    mayPromiseFutureContact: false,
    reasons: Object.freeze(reasons),
    prohibitedImplications: Object.freeze(prohibitedImplications),
  });
}
