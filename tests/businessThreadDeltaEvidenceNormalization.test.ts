import assert from "node:assert/strict";
import test from "node:test";

import { buildBusinessThreadDelta } from "../src/core/businessThreadDelta";

test("blank-only evidence is rejected after normalization", () => {
  assert.throws(() => buildBusinessThreadDelta({
    threadId: "thread-1",
    previousState: [],
    latestObservedState: [{
      id: "question-1",
      kind: "question",
      statement: "Can you confirm the date?",
      status: "open",
      owner: "evavo",
      sourceEvidenceIds: ["   ", ""],
    }],
  }), /THREAD_DELTA_EVIDENCE_REQUIRED/);
});

test("thread id and evidence ids are normalized without changing meaning", () => {
  const result = buildBusinessThreadDelta({
    threadId: " thread-1 ",
    previousState: [],
    latestObservedState: [{
      id: "question-1",
      kind: "question",
      statement: " Can you confirm the date? ",
      status: "open",
      owner: "evavo",
      sourceEvidenceIds: [" gmail:message:1 ", "gmail:message:1"],
    }],
  });

  assert.equal(result.threadId, "thread-1");
  assert.deepEqual(result.newItems[0]?.sourceEvidenceIds, ["gmail:message:1"]);
});
