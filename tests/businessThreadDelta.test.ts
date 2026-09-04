import assert from "node:assert/strict";
import test from "node:test";

import { buildBusinessThreadDelta } from "../src/core/businessThreadDelta";

test("focuses response targets on the live state", () => {
  const delta = buildBusinessThreadDelta({
    threadId: "thread-1",
    previousState: [
      { id: "q1", kind: "question", statement: "Can you send the CV?", status: "open", owner: "evavo", sourceEvidenceIds: ["m1"] },
      { id: "m1", kind: "meeting", statement: "Can we have a call?", status: "open", owner: "shared", sourceEvidenceIds: ["m1"] },
    ],
    latestObservedState: [
      { id: "q1", kind: "question", statement: "Can you send the CV?", status: "resolved", owner: "evavo", sourceEvidenceIds: ["m2"] },
      { id: "m1", kind: "meeting", statement: "Can we have a call?", status: "cancelled", owner: "shared", sourceEvidenceIds: ["m2"] },
      { id: "q2", kind: "question", statement: "Would you keep my details on file?", status: "open", owner: "evavo", sourceEvidenceIds: ["m2"] },
    ],
  });

  assert.deepEqual(delta.liveResponseTargets.map((item) => item.id), ["q2"]);
  assert.deepEqual(delta.resolvedItems.map((item) => item.id), ["q1"]);
  assert.deepEqual(delta.cancelledItems.map((item) => item.id), ["m1"]);
});

test("does not infer resolution from disappearance", () => {
  const delta = buildBusinessThreadDelta({
    threadId: "thread-2",
    previousState: [
      { id: "q1", kind: "question", statement: "Question", status: "open", owner: "evavo", sourceEvidenceIds: ["m1"] },
    ],
    latestObservedState: [],
  });

  assert.equal(delta.resolvedItems.length, 0);
});
