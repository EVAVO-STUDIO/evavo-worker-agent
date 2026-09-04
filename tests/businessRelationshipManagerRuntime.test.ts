import assert from "node:assert/strict";
import test from "node:test";

import { runRelationshipManagerCommunicationCycle } from "../src/core/businessRelationshipManagerRuntime";

const identity = {
  contract: "business_relationship_identity_resolver_v1" as const,
  status: "verified" as const,
  selected: {
    personId: "person-client-1",
    name: "Client One",
    addresses: ["client@example.com"],
    evidence: [{ source: "gmail" as const, ref: "gmail:message:in-1", confidence: 100 }],
  },
  confidence: 100,
  exactAddressMatch: true,
  reasons: ["Exact address match."],
  competingPersonIds: [],
};

function cycle(overrides: Record<string, unknown> = {}) {
  return runRelationshipManagerCommunicationCycle({
    cycleId: "cycle-1",
    observedAt: "2026-09-04T01:00:30Z",
    decisionAt: "2026-09-04T01:01:00Z",
    scenario: "general",
    objective: "Answer the client's delivery status question.",
    gmail: {
      threadId: "thread-1",
      relationshipId: "relationship-1",
      personId: "person-client-1",
      projectId: "project-1",
      messages: [{
        id: "in-1",
        threadId: "thread-1",
        sentAt: "2026-09-04T01:00:00Z",
        from: { name: "Client One", address: "client@example.com" },
        to: [{ name: "Greg", address: "greg@evavo.com.au" }],
        subject: "Delivery status",
        body: "Could you please confirm the current delivery status?",
      }],
    },
    identity,
    channel: { currentChannel: "email", canResolveInWriting: true },
    evidenceConfidence: 96,
    additionalEvidenceIds: ["operations:project-1:status"],
    ...overrides,
  } as Parameters<typeof runRelationshipManagerCommunicationCycle>[0]);
}

test("one canonical cycle projects Gmail, assesses evidence, decides and emits durable memory observations", () => {
  const result = cycle();
  assert.equal(result.contract, "business_relationship_manager_runtime_v1");
  assert.equal(result.externalEffectPerformed, false);
  assert.equal(result.evidenceReadiness.status, "ready_for_approval");
  assert.equal(result.decision.disposition, "reply");
  assert.equal(result.decision.replayDeterministic, true);
  assert.ok(result.projection.latestObservedThreadState.length >= 1);
  assert.ok(result.memoryObservations.some((observation) => observation.kind === "message"));
  assert.ok(result.memoryObservations.some((observation) => observation.kind === "decision"));
});

test("ambiguous identity blocks approval and escalates in the same canonical cycle", () => {
  const ambiguous = {
    ...identity,
    status: "ambiguous" as const,
    selected: undefined,
    confidence: 0,
    exactAddressMatch: false,
    competingPersonIds: ["person-a", "person-b"],
  };
  const result = cycle({ identity: ambiguous });
  assert.equal(result.evidenceReadiness.status, "blocked");
  assert.equal(result.decision.disposition, "escalate");
  assert.equal(result.decision.approvalGradeReady, false);
  assert.equal(result.externalEffectPerformed, false);
});

test("decision time cannot precede the provider observation", () => {
  assert.throws(() => cycle({ decisionAt: "2026-09-04T00:59:00Z" }), /DECISION_BEFORE_OBSERVATION/);
});
