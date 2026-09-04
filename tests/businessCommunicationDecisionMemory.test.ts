import assert from "node:assert/strict";
import test from "node:test";

import { communicationDecisionToMemoryCandidate } from "../src/core/businessCommunicationDecisionMemory";

const decision = {
  contract: "business_communication_decision_package_v1" as const,
  packageId: "pkg-1",
  scenario: "graduate_or_candidate" as const,
  objective: "Reply usefully to Ashley without implying a role exists.",
  disposition: "reply" as const,
  recommendedChannel: "email" as const,
  meetingJustified: false,
  conductInstructions: ["Be kind and truthful."],
  liveResponseTargets: ["Is EVAVO hiring graduates?"],
  activeEvavoObligations: [],
  candidateStage: "future_interest" as const,
  prohibitedImplications: ["Do not imply a role exists."],
  evidenceIds: ["gmail:message:m1"],
  evidenceConfidence: 92,
  reasons: ["A useful email reply is sufficient."],
};

test("relationship decision becomes a material evidence-linked memory checkpoint", () => {
  const result = communicationDecisionToMemoryCandidate({
    decision,
    decidedAt: "2026-09-04T01:10:00Z",
    relationshipId: "rel-ashley",
    personId: "person-ashley",
    threadId: "thread-ashley",
  });
  assert.equal(result.kind, "decision");
  assert.equal(result.material, true);
  assert.equal(result.confidence, "verified");
  assert.ok(result.details.includes("Meeting justified: no"));
  assert.ok(result.entityRefs.some((entity) => entity.kind === "communication_thread"));
  assert.deepEqual(result.evidenceRefs, ["gmail:message:m1"]);
});

test("lower but usable evidence confidence is retained as supported rather than verified", () => {
  const result = communicationDecisionToMemoryCandidate({
    decision: { ...decision, evidenceConfidence: 70 },
    decidedAt: "2026-09-04T01:10:00Z",
  });
  assert.equal(result.confidence, "supported");
});
