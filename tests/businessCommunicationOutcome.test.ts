import assert from "node:assert/strict";
import test from "node:test";

import { assessCommunicationOutcome } from "../src/core/businessCommunicationOutcome";

test("positive reply and obligation completion count as evidence-backed progress", () => {
  const result = assessCommunicationOutcome({
    relationshipId: "rel-1",
    communicationId: "gmail-sent-1",
    assessedAt: "2026-09-05T02:00:00Z",
    signals: [
      { id: "sig-1", kind: "reply_received", occurredAt: "2026-09-05T01:00:00Z", summary: "Recipient replied.", sourceRefs: ["gmail:reply-1"], confidence: 100 },
      { id: "sig-2", kind: "positive_response", occurredAt: "2026-09-05T01:00:00Z", summary: "Recipient responded positively.", sourceRefs: ["gmail:reply-1"], confidence: 85 },
      { id: "sig-3", kind: "obligation_satisfied", occurredAt: "2026-09-04T23:00:00Z", summary: "Requested information was supplied.", sourceRefs: ["gmail:sent-1"], confidence: 100 },
    ],
    satisfiedObligationIds: ["obl-1"],
  });
  assert.equal(result.outcome, "positive");
  assert.equal(result.communicationWorked, true);
  assert.equal(result.relationshipEffect, "improved");
  assert.equal(result.learningEligible, true);
});

test("no response is pending rather than automatically negative", () => {
  const result = assessCommunicationOutcome({
    relationshipId: "rel-2",
    communicationId: "gmail-sent-2",
    assessedAt: "2026-09-06T02:00:00Z",
    signals: [
      { id: "sig-none", kind: "no_response_observed", occurredAt: "2026-09-06T01:59:00Z", summary: "No reply observed yet.", sourceRefs: ["gmail:thread-2"], confidence: 100 },
    ],
  });
  assert.equal(result.outcome, "pending");
  assert.equal(result.communicationWorked, null);
  assert.equal(result.learningEligible, false);
});

test("mixed outcomes remain mixed instead of being forced into success or failure", () => {
  const result = assessCommunicationOutcome({
    relationshipId: "rel-3",
    communicationId: "gmail-sent-3",
    assessedAt: "2026-09-05T02:00:00Z",
    signals: [
      { id: "sig-positive", kind: "commercial_progress", occurredAt: "2026-09-05T01:00:00Z", summary: "Commercial discussion progressed.", sourceRefs: ["ops:proposal"], confidence: 90 },
      { id: "sig-negative", kind: "relationship_risk_increased", occurredAt: "2026-09-05T01:10:00Z", summary: "Recipient expressed concern about timing.", sourceRefs: ["gmail:reply-3"], confidence: 90 },
    ],
  });
  assert.equal(result.outcome, "mixed");
  assert.equal(result.learningEligible, true);
});
