import assert from "node:assert/strict";
import test from "node:test";

import { buildCommunicationDecisionPackage } from "../src/core/businessCommunicationDecisionPackage";
import { communicationDecisionToMemoryCandidate } from "../src/core/businessCommunicationDecisionMemory";

function decision(overrides: Partial<Parameters<typeof buildCommunicationDecisionPackage>[0]> = {}) {
  return buildCommunicationDecisionPackage({
    packageId: "pkg-1",
    scenario: "graduate_or_candidate",
    objective: "Reply usefully to Ashley without implying a role exists.",
    thread: {
      threadId: "thread-ashley",
      previousState: [],
      latestObservedState: [{
        id: "q1",
        kind: "question",
        statement: "Is EVAVO hiring graduates?",
        status: "open",
        owner: "evavo",
        sourceEvidenceIds: ["gmail:message:m1"],
      }],
    },
    obligations: [],
    channel: { currentChannel: "email", canResolveInWriting: true },
    candidate: {
      relationshipId: "rel-ashley",
      explicitRoleOpen: false,
      activeRecruitmentProcess: false,
      materialsSupplied: false,
      materialsActuallyReviewed: false,
      relevantSkillsEvidence: false,
      futureRelevanceEvidence: false,
      personalizedEffort: true,
      clearFitEvidence: false,
    },
    evidenceIds: ["gmail:message:m1"],
    evidenceConfidence: 92,
    decisionAt: "2026-09-04T01:10:00Z",
    ...overrides,
  });
}

test("relationship decision becomes a material evidence-linked memory checkpoint", () => {
  const current = decision();
  const result = communicationDecisionToMemoryCandidate({
    decision: current,
    decidedAt: current.decisionAt,
    relationshipId: "rel-ashley",
    personId: "person-ashley",
    threadId: "thread-ashley",
  });
  assert.equal(result.kind, "decision");
  assert.equal(result.material, true);
  assert.equal(result.confidence, "verified");
  assert.equal(result.origin, "direct");
  assert.equal(result.relationshipCycleId, null);
  assert.ok(result.details.includes("Origin: direct"));
  assert.ok(result.details.includes("Meeting justified: no"));
  assert.ok(result.entityRefs.some((entity) => entity.kind === "communication_thread"));
  assert.deepEqual(result.evidenceRefs, ["gmail:message:m1"]);
});

test("canonical cycle provenance survives into durable decision memory", () => {
  const current = decision({
    packageId: "cycle-decision-1",
    origin: "relationship_manager_cycle",
    relationshipCycleId: "cycle-1",
  });
  const result = communicationDecisionToMemoryCandidate({
    decision: current,
    decidedAt: current.decisionAt,
    relationshipId: "rel-ashley",
  });
  assert.equal(result.origin, "relationship_manager_cycle");
  assert.equal(result.relationshipCycleId, "cycle-1");
  assert.ok(result.details.includes("Relationship cycle: cycle-1"));
});

test("lower but usable evidence confidence is retained as supported rather than verified", () => {
  const current = decision({ evidenceConfidence: 70 });
  const result = communicationDecisionToMemoryCandidate({
    decision: current,
    decidedAt: current.decisionAt,
  });
  assert.equal(result.confidence, "supported");
});
