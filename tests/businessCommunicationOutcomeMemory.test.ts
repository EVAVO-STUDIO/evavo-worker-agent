import assert from "node:assert/strict";
import test from "node:test";

import { communicationOutcomeToMemoryRecord } from "../src/core/businessCommunicationOutcomeMemory";

test("durable positive outcomes become relationship memory records", () => {
  const record = communicationOutcomeToMemoryRecord({
    contract: "business_communication_outcome_v1",
    relationshipId: "rel-1",
    communicationId: "gmail-sent-1",
    assessedAt: "2026-09-05T02:00:00Z",
    outcome: "positive",
    relationshipEffect: "improved",
    communicationWorked: true,
    obligationsSatisfied: ["obl-1"],
    newObligations: [],
    materialSignals: [
      { id: "sig-1", kind: "positive_response", occurredAt: "2026-09-05T01:00:00Z", summary: "Recipient responded positively.", sourceRefs: ["gmail:reply-1"], confidence: 90 },
    ],
    evidenceRefs: ["gmail:reply-1"],
    learningEligible: true,
    reasons: ["Evidence shows positive progress."],
  });
  assert.ok(record);
  assert.equal(record?.kind, "outcome");
  assert.ok(record?.tags.includes("positive"));
  assert.ok(record?.entities.some((entity) => entity.kind === "relationship" && entity.id === "rel-1"));
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
