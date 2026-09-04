import assert from "node:assert/strict";
import test from "node:test";

import { buildBusinessCommunicationLearningEvent } from "../src/core/businessCommunicationLearning";

test("captures structured learning from operator edits", () => {
  const event = buildBusinessCommunicationLearningEvent({
    id: "learn-1",
    threadId: "thread-1",
    relationshipId: "relationship-1",
    channel: "email",
    originalDraft: "Hello Naomi,\n\nI hope this email finds you well. We are thrilled to provide the attached document.\n\nKind regards,",
    finalDraft: "Hi Naomi,\n\nAttached is the revised scope we discussed.\n\nThanks,\nGreg",
    reasons: ["too_formal", "too_long", "bad_opening"],
    operatorNote: "Keep it much more natural and direct.",
    createdAt: "2026-09-04T01:00:00Z",
  });

  assert.equal(event.contract, "business_communication_learning_v1");
  assert.deepEqual(event.reasons, ["too_formal", "too_long", "bad_opening"]);
  assert.equal(event.originalOpening, "Hello Naomi,");
  assert.equal(event.finalOpening, "Hi Naomi,");
  assert.ok(event.finalLength < event.originalLength);
});
