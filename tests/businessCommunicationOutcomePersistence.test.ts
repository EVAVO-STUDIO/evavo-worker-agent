import assert from "node:assert/strict";
import test from "node:test";

import { assessCommunicationOutcome } from "../src/core/businessCommunicationOutcome";
import {
  buildBusinessOutcomeMemoryWriteRequest,
  reconcileBusinessOutcomeMemoryReceipt,
} from "../src/core/businessCommunicationOutcomePersistence";

const NOW = "2026-09-04T13:00:00+10:00";

function positiveAssessment() {
  return assessCommunicationOutcome({
    relationshipId: "rel-1",
    communicationId: "message-1",
    assessedAt: NOW,
    signals: [
      {
        id: "reply-positive",
        kind: "positive_response",
        occurredAt: NOW,
        summary: "Recipient confirmed the response resolved the issue.",
        sourceRefs: ["gmail:reply-1"],
        confidence: 95,
      },
    ],
  });
}

test("builds a deterministic durable-memory write request for eligible outcomes", () => {
  const first = buildBusinessOutcomeMemoryWriteRequest(positiveAssessment());
  const second = buildBusinessOutcomeMemoryWriteRequest(positiveAssessment());
  assert.ok(first);
  assert.equal(first?.idempotencyKey, second?.idempotencyKey);
  assert.equal(first?.requestId, second?.requestId);
  assert.equal(first?.record.recordedAt, new Date(NOW).toISOString());
});

test("pending outcomes are not written to durable learning", () => {
  const pending = assessCommunicationOutcome({
    relationshipId: "rel-1",
    communicationId: "message-2",
    assessedAt: NOW,
    signals: [
      {
        id: "no-reply",
        kind: "no_response_observed",
        occurredAt: NOW,
        summary: "No reply observed yet.",
        sourceRefs: ["gmail:thread-2"],
        confidence: 90,
      },
    ],
  });
  const request = buildBusinessOutcomeMemoryWriteRequest(pending);
  assert.equal(request, null);
  const result = reconcileBusinessOutcomeMemoryReceipt({ assessment: pending, request });
  assert.equal(result.status, "not_eligible");
  assert.equal(result.durable, false);
});

test("idempotent replay counts as durable persistence", () => {
  const assessment = positiveAssessment();
  const request = buildBusinessOutcomeMemoryWriteRequest(assessment);
  assert.ok(request);
  const result = reconcileBusinessOutcomeMemoryReceipt({
    assessment,
    request,
    receipt: {
      protocol: "evavo-memory-write-receipt-v1",
      version: 1,
      requestId: request!.requestId,
      recordId: "mem2-outcome-1",
      idempotencyKey: request!.idempotencyKey,
      status: "idempotent_replay",
      journalPosition: 3,
      recordedAt: new Date(NOW).toISOString(),
      storageAuthority: { system: "evavo-storage", instanceId: "local-primary" },
      integrity: { recordHash: "a".repeat(64), algorithm: "sha256", immutableJournal: true },
    },
  });
  assert.equal(result.status, "persisted");
  assert.equal(result.durable, true);
  assert.equal(result.receiptStatus, "idempotent_replay");
});
