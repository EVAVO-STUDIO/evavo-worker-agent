import assert from "node:assert/strict";
import test from "node:test";

import { communicationOutcomeToMemoryRecord } from "../src/core/businessCommunicationOutcomeMemory";

const positiveAssessment = {
  contract: "business_communication_outcome_v1" as const,
  relationshipId: "rel-1",
  communicationId: "gmail-sent-1",
  assessedAt: "2026-09-05T02:00:00Z",
  outcome: "positive" as const,
  relationshipEffect: "improved" as const,
  communicationWorked: true,
  obligationsSatisfied: ["obl-1"],
  newObligations: [],
  materialSignals: [
    { id: "sig-1", kind: "positive_response" as const, occurredAt: "2026-09-05T01:00:00Z", summary: "Recipient responded positively.", sourceRefs: ["gmail:reply-1"], confidence: 90 },
  ],
  evidenceRefs: ["gmail:reply-1"],
  learningEligible: true,
  reasons: ["Evidence shows positive progress."],
};

test("durable positive outcomes become relationship memory records", () => {
  const record = communicationOutcomeToMemoryRecord(positiveAssessment);
  assert.ok(record);
  assert.equal(record?.kind, "outcome");
  assert.ok(record?.tags.includes("positive"));
  assert.ok(record?.entities.some((entity) => entity.kind === "relationship" && entity.id === "rel-1"));
});

test("Relationship Manager outcomes retain decision, cycle and exact Writing Studio request lineage", () => {
  const record = communicationOutcomeToMemoryRecord(positiveAssessment, {
    decisionPackageId: "relationship-cycle:cycle-1",
    decisionOrigin: "relationship_manager_cycle",
    relationshipCycleId: "cycle-1",
    handoffId: "handoff-1",
    writingRequestId: "writing-request-1",
    providerMessageId: "gmail-sent-1",
  });
  assert.ok(record);
  assert.equal(record?.lineage.decisionPackageId, "relationship-cycle:cycle-1");
  assert.equal(record?.lineage.relationshipCycleId, "cycle-1");
  assert.equal(record?.lineage.handoffId, "handoff-1");
  assert.equal(record?.lineage.writingRequestId, "writing-request-1");
  assert.equal(record?.lineage.providerMessageId, "gmail-sent-1");
  assert.ok(record?.tags.includes("relationship-cycle:cycle-1"));
  assert.ok(record?.tags.includes("writing-request:writing-request-1"));
});

test("Relationship Manager outcome provenance cannot point at another provider message", () => {
  assert.throws(() => communicationOutcomeToMemoryRecord(positiveAssessment, {
    decisionPackageId: "relationship-cycle:cycle-1",
    decisionOrigin: "relationship_manager_cycle",
    relationshipCycleId: "cycle-1",
    handoffId: "handoff-1",
    writingRequestId: "writing-request-1",
    providerMessageId: "gmail-sent-other",
  }), /PROVIDER_MESSAGE_MISMATCH/);
});

test("pending outcomes are not written to durable learning memory", () => {
  const record = communicationOutcomeToMemoryRecord({
    contract: "business_communication_outcome_v1",
    relationshipId: "rel-2",
    communicationId: "gmail-sent-2",
    assessedAt: "2026-09-05T02:00:00Z",
    outcome: "pending",
    relationshipEffect: "unknown",
    communicationWorked: null,
    obligationsSatisfied: [],
    newObligations: [],
    materialSignals: [],
    evidenceRefs: ["gmail:thread-2"],
    learningEligible: false,
    reasons: ["Not enough evidence yet."],
  });
  assert.equal(record, null);
});
