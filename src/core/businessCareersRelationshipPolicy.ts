import type { RoleOpeningTruth } from "./businessRoleOpeningTruth";

export const BUSINESS_CAREERS_RELATIONSHIP_POLICY_CONTRACT = "business_careers_relationship_policy_v3" as const;

export type CareersRelationshipInput = Readonly<{
  senderIdentityVerified: boolean;
  sincereIndividualEnquiry: boolean;
  asksForJobOrInternship?: boolean;
  asksForAdvice?: boolean;
  asksForMeeting?: boolean;
  portfolioOrCvProvided?: boolean;
  /** Legacy hint only. Never sufficient to authorise a role-exists claim. */
  openRoleConfirmed?: boolean;
  relevantRoleConfirmed?: boolean;
  roleTruth?: RoleOpeningTruth | null;
  suitableFutureInterest?: boolean;
  referralPathKnown?: boolean;
  specificUsefulAdviceAvailable?: boolean;
  suppressionActive?: boolean;
  legalOrEmploymentUncertainty?: boolean;
}>;

export type CareersRelationshipDecision = Readonly<{
  contract: typeof BUSINESS_CAREERS_RELATIONSHIP_POLICY_CONTRACT;
  disposition: "reply" | "defer" | "escalate" | "do_not_reply";
  meetingRecommended: boolean;
  principles: readonly string[];
  mustCommunicate: readonly string[];
  mustNotCommunicate: readonly string[];
  suggestedNextStep: "none" | "email_reply" | "review_materials" | "refer_to_role" | "keep_in_mind" | "request_missing_context";
}>;

export function decideCareersRelationshipResponse(input: CareersRelationshipInput): CareersRelationshipDecision {
  const basePrinciples = [
    "Treat a sincere graduate, candidate or career enquiry as a person, not as inbox noise.",
    "Be kind and useful without implying that a role, interview, internship or future opportunity exists when it has not been confirmed.",
    "Prefer a clear email response over a meeting unless synchronous discussion has specific incremental value.",
    "Avoid generic HR rejection language when a brief human response can be more respectful and informative.",
  ];

  if (input.suppressionActive) {
    return { contract: BUSINESS_CAREERS_RELATIONSHIP_POLICY_CONTRACT, disposition: "do_not_reply", meetingRecommended: false, principles: basePrinciples, mustCommunicate: [], mustNotCommunicate: ["Do not initiate or continue contact while suppression is active."], suggestedNextStep: "none" };
  }
  if (!input.senderIdentityVerified) {
    return { contract: BUSINESS_CAREERS_RELATIONSHIP_POLICY_CONTRACT, disposition: "defer", meetingRecommended: false, principles: basePrinciples, mustCommunicate: [], mustNotCommunicate: ["Do not personalise or make career commitments until sender identity is sufficiently resolved."], suggestedNextStep: "request_missing_context" };
  }
  if (input.legalOrEmploymentUncertainty) {
    return { contract: BUSINESS_CAREERS_RELATIONSHIP_POLICY_CONTRACT, disposition: "escalate", meetingRecommended: false, principles: basePrinciples, mustCommunicate: [], mustNotCommunicate: ["Do not make employment, eligibility, sponsorship, compensation or contractual representations without authority."], suggestedNextStep: "none" };
  }
  if (input.roleTruth?.status === "conflicting") {
    return {
      contract: BUSINESS_CAREERS_RELATIONSHIP_POLICY_CONTRACT,
      disposition: "escalate",
      meetingRecommended: false,
      principles: basePrinciples,
      mustCommunicate: [],
      mustNotCommunicate: ["Do not state whether a role exists while authoritative role-state evidence conflicts."],
      suggestedNextStep: "request_missing_context",
    };
  }
  if (!input.sincereIndividualEnquiry) {
    return { contract: BUSINESS_CAREERS_RELATIONSHIP_POLICY_CONTRACT, disposition: "do_not_reply", meetingRecommended: false, principles: basePrinciples, mustCommunicate: [], mustNotCommunicate: ["Do not manufacture engagement for bulk, irrelevant or non-genuine outreach."], suggestedNextStep: "none" };
  }

  const mustCommunicate: string[] = [];
  const mustNotCommunicate = [
    "Do not say or imply that EVAVO is hiring unless a current role is confirmed by authoritative dedicated careers role-state evidence.",
    "Do not turn absence of a confirmed opening into the broader claim that EVAVO is not hiring.",
    "Do not promise an interview, internship, referral, paid work or future contact unless it is actually authorised.",
    "Do not ask for a meeting merely to be polite.",
    "Do not over-praise work or credentials that have not actually been reviewed.",
  ];

  if (input.openRoleConfirmed && !input.roleTruth) {
    mustNotCommunicate.push("Ignore legacy caller assertions that a role is open unless canonical role truth is attached to this decision.");
  }

  const roleConfirmedOpen = Boolean(
    input.roleTruth
    && input.roleTruth.status === "confirmed_open"
    && input.roleTruth.maySayRoleExists,
  );
  const relevantRoleConfirmed = Boolean(input.relevantRoleConfirmed);

  if (roleConfirmedOpen && relevantRoleConfirmed) {
    mustCommunicate.push("There is a relevant confirmed opportunity and the response should explain the real next step accurately.");
    return { contract: BUSINESS_CAREERS_RELATIONSHIP_POLICY_CONTRACT, disposition: "reply", meetingRecommended: false, principles: basePrinciples, mustCommunicate, mustNotCommunicate, suggestedNextStep: input.portfolioOrCvProvided ? "review_materials" : "refer_to_role" };
  }

  mustCommunicate.push("Acknowledge the enquiry and answer honestly about the current situation.");
  if (input.asksForJobOrInternship) {
    if (input.roleTruth) mustCommunicate.push(`Use the evidence-safe role wording: ${input.roleTruth.safeExternalWording}`);
    else mustCommunicate.push("If no canonical role truth is available, say only that a current opening has not been verified; do not infer a company-wide hiring position.");
  }
  if (input.specificUsefulAdviceAvailable && input.asksForAdvice) mustCommunicate.push("Offer the specific useful advice that is actually known, briefly and without turning the response into a lecture.");
  if (input.referralPathKnown) mustCommunicate.push("Provide the genuine application or referral path if one exists.");
  if (input.suitableFutureInterest) mustCommunicate.push("It is acceptable to say EVAVO can keep the person's details in mind only if that is genuinely intended, evidence-backed and operationally supportable.");

  return {
    contract: BUSINESS_CAREERS_RELATIONSHIP_POLICY_CONTRACT,
    disposition: "reply",
    meetingRecommended: Boolean(input.asksForMeeting && roleConfirmedOpen && relevantRoleConfirmed),
    principles: basePrinciples,
    mustCommunicate,
    mustNotCommunicate,
    suggestedNextStep: input.suitableFutureInterest ? "keep_in_mind" : input.portfolioOrCvProvided ? "review_materials" : "email_reply",
  };
}
