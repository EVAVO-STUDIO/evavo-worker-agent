import assert from "node:assert/strict";
import test from "node:test";

import { decideCareersRelationshipResponse } from "../src/core/businessCareersRelationshipPolicy";

test("replies kindly to a sincere graduate enquiry without inventing a role or meeting", () => {
  const result = decideCareersRelationshipResponse({
    senderIdentityVerified: true,
    sincereIndividualEnquiry: true,
    asksForJobOrInternship: true,
    asksForMeeting: true,
    portfolioOrCvProvided: true,
    relevantRoleConfirmed: false,
    suitableFutureInterest: false,
    roleTruth: {
      contract: "business_role_opening_truth_v1",
      status: "no_confirmed_open_role",
      maySayRoleExists: false,
      maySayNotHiring: false,
      safeExternalWording: "I don't have a confirmed current opening I can accurately point you to.",
      evidenceIds: [],
      reasons: ["No current opening is confirmed in authoritative evidence."],
    },
  });

  assert.equal(result.disposition, "reply");
  assert.equal(result.meetingRecommended, false);
  assert.equal(result.suggestedNextStep, "review_materials");
  assert.ok(result.mustNotCommunicate.some((line) => line.includes("EVAVO is hiring")));
  assert.ok(result.mustNotCommunicate.some((line) => line.includes("not hiring")));
  assert.ok(result.mustCommunicate.some((line) => /confirmed current opening/i.test(line)));
});

test("uses a confirmed role when one genuinely exists", () => {
  const result = decideCareersRelationshipResponse({
    senderIdentityVerified: true,
    sincereIndividualEnquiry: true,
    asksForJobOrInternship: true,
    portfolioOrCvProvided: false,
    relevantRoleConfirmed: true,
    roleTruth: {
      contract: "business_role_opening_truth_v1",
      status: "confirmed_open",
      maySayRoleExists: true,
      maySayNotHiring: false,
      safeExternalWording: "There is a current role I can point you to.",
      evidenceIds: ["role-evidence"],
      reasons: ["Authoritative role evidence confirms an opening."],
    },
  });

  assert.equal(result.disposition, "reply");
  assert.equal(result.suggestedNextStep, "refer_to_role");
});

test("conflicting role-state evidence escalates instead of choosing a convenient answer", () => {
  const result = decideCareersRelationshipResponse({
    senderIdentityVerified: true,
    sincereIndividualEnquiry: true,
    asksForJobOrInternship: true,
    roleTruth: {
      contract: "business_role_opening_truth_v1",
      status: "conflicting",
      maySayRoleExists: false,
      maySayNotHiring: false,
      safeExternalWording: "I don't have a confirmed current role I can accurately point you to yet.",
      evidenceIds: ["open", "closed"],
      reasons: ["Authoritative role evidence conflicts."],
    },
  });

  assert.equal(result.disposition, "escalate");
  assert.equal(result.suggestedNextStep, "request_missing_context");
});

test("employment uncertainty escalates instead of bluffing", () => {
  const result = decideCareersRelationshipResponse({
    senderIdentityVerified: true,
    sincereIndividualEnquiry: true,
    legalOrEmploymentUncertainty: true,
  });

  assert.equal(result.disposition, "escalate");
});
