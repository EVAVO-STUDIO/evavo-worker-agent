import type { CareersRelationshipDecision } from "./businessCareersRelationshipPolicy";
import type { RoleOpeningTruth } from "./businessRoleOpeningTruth";

export const BUSINESS_CANDIDATE_DRAFT_POLICY_REVIEW_CONTRACT =
  "business_candidate_draft_policy_review_v2" as const;

export type CandidateDraftPolicyReview = Readonly<{
  contract: typeof BUSINESS_CANDIDATE_DRAFT_POLICY_REVIEW_CONTRACT;
  ready: boolean;
  blockers: readonly string[];
  checkedRules: readonly string[];
}>;

function normalized(value: string): string {
  return value.replace(/[\u2018\u2019]/g, "'").replace(/\s+/g, " ").trim().toLowerCase();
}

function includesNormalized(body: string, required: string): boolean {
  return normalized(body).includes(normalized(required));
}

export function reviewCandidateDraftAgainstPolicy(input: Readonly<{
  body: string;
  roleTruth: RoleOpeningTruth;
  careersDecision: CareersRelationshipDecision;
  asksForJobOrInternship: boolean;
  asksForMeeting: boolean;
  portfolioOrCvProvided: boolean;
  materialsActuallyReviewed: boolean;
  suitableFutureInterest: boolean;
  expectedApplicationUrl?: string | null;
}>): CandidateDraftPolicyReview {
  const body = input.body.trim();
  if (!body) throw new Error("CANDIDATE_DRAFT_POLICY_BODY_REQUIRED");
  const text = normalized(body);
  const blockers: string[] = [];
  const checkedRules = [
    "global_not_hiring_claim",
    "evidence_safe_role_wording",
    "verified_application_path",
    "meeting_invitation_authority",
    "materials_review_claim",
    "future_contact_promise",
    "interview_or_work_promise",
  ];

  if (/\b(?:we|evavo)\s+(?:are|is|'re)\s+(?:currently\s+)?not\s+hiring\b/i.test(text)
      || /\bno\s+(?:jobs|roles|positions|openings|opportunities)\s+(?:are\s+)?(?:available|open)\b/i.test(text)) {
    blockers.push("unsupported_global_not_hiring_claim");
  }

  if (input.asksForJobOrInternship && !includesNormalized(body, input.roleTruth.safeExternalWording)) {
    blockers.push("evidence_safe_role_wording_missing");
  }

  const expectedApplicationUrl = input.expectedApplicationUrl?.trim() || null;
  if (expectedApplicationUrl && !body.includes(expectedApplicationUrl)) {
    blockers.push("verified_application_path_missing");
  }

  if (!input.careersDecision.meetingRecommended
      && /\b(?:book|schedule|set up|arrange)\s+(?:a\s+)?(?:call|meeting|chat)\b|\bjump on (?:a )?(?:call|zoom)\b/i.test(text)) {
    blockers.push("unauthorised_meeting_invitation");
  }

  if (input.portfolioOrCvProvided && !input.materialsActuallyReviewed
      && /\b(?:reviewed|looked over|went through)\s+(?:your\s+)?(?:portfolio|cv|resume|résumé|work)\b/i.test(text)) {
    blockers.push("unverified_materials_review_claim");
  }

  if (!input.suitableFutureInterest
      && /\b(?:we|i)\s*(?:will|'ll)\s+(?:be in touch|contact you|reach out|keep you in mind)\b/i.test(text)) {
    blockers.push("unauthorised_future_contact_promise");
  }

  if (/\b(?:you(?:'ll| will)|we(?:'ll| will))\s+(?:get|offer|arrange|schedule|have)\s+(?:an?\s+)?(?:interview|internship|job|role|position|paid work)\b/i.test(text)) {
    blockers.push("unauthorised_employment_or_interview_promise");
  }

  if (input.roleTruth.maySayNotHiring) blockers.push("invalid_global_not_hiring_authority");
  if (input.careersDecision.disposition !== "reply") blockers.push("careers_policy_not_reply");

  return Object.freeze({
    contract: BUSINESS_CANDIDATE_DRAFT_POLICY_REVIEW_CONTRACT,
    ready: blockers.length === 0,
    blockers: Object.freeze([...new Set(blockers)]),
    checkedRules: Object.freeze(checkedRules),
  });
}
