import assert from "node:assert/strict";
import test from "node:test";

import { decideCandidateRelationship } from "../src/core/businessCandidateRelationship";

test("does not imply a role exists for an unsolicited graduate enquiry", () => {
  const decision = decideCandidateRelationship({
    relationshipId: "rel-1",
    explicitRoleOpen: false,
    activeRecruitmentProcess: false,
    materialsSupplied: true,
    materialsActuallyReviewed: false,
    relevantSkillsEvidence: false,
    futureRelevanceEvidence: false,
    personalizedEffort: true,
    clearFitEvidence: false,
  });

  assert.equal(decision.stage, "future_interest");
  assert.equal(decision.shouldReply, true);
  assert.equal(decision.maySuggestRoleExists, false);
  assert.equal(decision.maySayMaterialsReviewed, false);
  assert.equal(decision.mayPromiseFutureContact, false);
});

test("moves a genuinely relevant supplied portfolio into review warranted", () => {
  const decision = decideCandidateRelationship({
    relationshipId: "rel-2",
    explicitRoleOpen: false,
    activeRecruitmentProcess: false,
    materialsSupplied: true,
    materialsActuallyReviewed: true,
    relevantSkillsEvidence: true,
    futureRelevanceEvidence: true,
    personalizedEffort: true,
    clearFitEvidence: false,
  });

  assert.equal(decision.stage, "review_warranted");
  assert.equal(decision.shouldRetainRelationship, true);
  assert.equal(decision.maySayMaterialsReviewed, true);
});

test("suppression closes the relationship without contact", () => {
  const decision = decideCandidateRelationship({
    relationshipId: "rel-3",
    explicitRoleOpen: true,
    activeRecruitmentProcess: true,
    materialsSupplied: true,
    materialsActuallyReviewed: true,
    relevantSkillsEvidence: true,
    futureRelevanceEvidence: true,
    personalizedEffort: true,
    clearFitEvidence: true,
    suppressionActive: true,
  });

  assert.equal(decision.shouldReply, false);
  assert.equal(decision.shouldRetainRelationship, false);
});
