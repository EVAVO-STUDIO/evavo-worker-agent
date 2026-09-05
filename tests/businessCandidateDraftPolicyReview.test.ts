import assert from "node:assert/strict";
import test from "node:test";

import { reviewCandidateDraftAgainstPolicy } from "../src/core/businessCandidateDraftPolicyReview";

const roleTruth = {
  contract: "business_role_opening_truth_v2" as const,
  status: "no_confirmed_open_role" as const,
  maySayRoleExists: false,
  maySayNotHiring: false,
  safeExternalWording: "I don't have a confirmed current opening I can accurately point you to.",
  evidenceIds: [],
  reasons: ["No authoritative careers record confirms an opening."],
};
const careersDecision = {
  contract: "business_careers_relationship_policy_v3" as const,
  disposition: "reply" as const,
  meetingRecommended: false,
  principles: [],
  mustCommunicate: [],
  mustNotCommunicate: [],
  suggestedNextStep: "email_reply" as const,
};

function review(body: string, overrides: Record<string, unknown> = {}) {
  return reviewCandidateDraftAgainstPolicy({
    body,
    roleTruth,
    careersDecision,
    asksForJobOrInternship: true,
    asksForMeeting: false,
    portfolioOrCvProvided: false,
    materialsActuallyReviewed: false,
    suitableFutureInterest: false,
    expectedApplicationUrl: null,
    ...overrides,
  } as any);
}

test("evidence-safe candidate wording passes without creating commitments", () => {
  const result = review("Thanks for getting in touch. I don't have a confirmed current opening I can accurately point you to.");
  assert.equal(result.contract, "business_candidate_draft_policy_review_v2");
  assert.equal(result.ready, true);
  assert.deepEqual(result.blockers, []);
});

test("global not-hiring claim fails even when no specific opening was found", () => {
  const result = review("Thanks for asking. We're currently not hiring.");
  assert.equal(result.ready, false);
  assert.ok(result.blockers.includes("unsupported_global_not_hiring_claim"));
  assert.ok(result.blockers.includes("evidence_safe_role_wording_missing"));
});

test("missing evidence-safe role wording fails a job enquiry", () => {
  const result = review("Thanks for getting in touch. I appreciate your interest.");
  assert.equal(result.ready, false);
  assert.ok(result.blockers.includes("evidence_safe_role_wording_missing"));
});

test("unauthorised meeting invitation is blocked", () => {
  const result = review("I don't have a confirmed current opening I can accurately point you to. Let's schedule a call next week.");
  assert.ok(result.blockers.includes("unauthorised_meeting_invitation"));
});

test("unreviewed materials cannot be described as reviewed", () => {
  const result = review("I don't have a confirmed current opening I can accurately point you to. I reviewed your portfolio and it looks strong.", {
    portfolioOrCvProvided: true,
    materialsActuallyReviewed: false,
  });
  assert.ok(result.blockers.includes("unverified_materials_review_claim"));
});

test("future contact and employment promises fail closed", () => {
  const future = review("I don't have a confirmed current opening I can accurately point you to. We'll be in touch.");
  assert.ok(future.blockers.includes("unauthorised_future_contact_promise"));
  const interview = review("I don't have a confirmed current opening I can accurately point you to. You'll get an interview soon.");
  assert.ok(interview.blockers.includes("unauthorised_employment_or_interview_promise"));
});

test("verified application path is mandatory when Careers supplies one", () => {
  const applicationUrl = "https://evavo.com.au/careers/graduate-designer";
  const openRoleTruth = {
    ...roleTruth,
    status: "confirmed_open" as const,
    maySayRoleExists: true,
    safeExternalWording: "There is a current role I can point you to.",
  };
  const openDecision = {
    ...careersDecision,
    suggestedNextStep: "refer_to_role" as const,
  };
  const missing = review("There is a current role I can point you to. You can apply on our website.", {
    roleTruth: openRoleTruth,
    careersDecision: openDecision,
    expectedApplicationUrl: applicationUrl,
  });
  assert.equal(missing.ready, false);
  assert.ok(missing.blockers.includes("verified_application_path_missing"));

  const present = review(`There is a current role I can point you to. Apply here: ${applicationUrl}`, {
    roleTruth: openRoleTruth,
    careersDecision: openDecision,
    expectedApplicationUrl: applicationUrl,
  });
  assert.equal(present.ready, true);
  assert.ok(!present.blockers.includes("verified_application_path_missing"));
});
