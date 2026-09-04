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
    openRoleConfirmed: false,
    relevantRoleConfirmed: false,
    suitableFutureInterest: true,
  });

  assert.equal(result.disposition, "reply");
  assert.equal(result.meetingRecommended, false);
  assert.equal(result.suggestedNextStep, "keep_in_mind");
  assert.ok(result.mustNotCommunicate.some((line) => line.includes("EVAVO is hiring")));
  assert.ok(result.mustNotCommunicate.some((line) => line.includes("meeting")));
});

test("uses a confirmed role when one genuinely exists", () => {
  const result = decideCareersRelationshipResponse({
    senderIdentityVerified: true,
    sincereIndividualEnquiry: true,
    asksForJobOrInternship: true,
    portfolioOrCvProvided: false,
    openRoleConfirmed: true,
    relevantRoleConfirmed: true,
  });

  assert.equal(result.disposition, "reply");
  assert.equal(result.suggestedNextStep, "refer_to_role");
});

test("employment uncertainty escalates instead of bluffing", () => {
  const result = decideCareersRelationshipResponse({
    senderIdentityVerified: true,
    sincereIndividualEnquiry: true,
    legalOrEmploymentUncertainty: true,
  });

  assert.equal(result.disposition, "escalate");
});
