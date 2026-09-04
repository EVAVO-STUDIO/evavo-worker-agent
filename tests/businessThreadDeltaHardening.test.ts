import assert from "node:assert/strict";
import test from "node:test";

import { buildBusinessThreadDelta, type ThreadStateItem } from "../src/core/businessThreadDelta";

function item(overrides: Partial<ThreadStateItem> = {}): ThreadStateItem {
  return {
    id: "q1",
    kind: "question",
    statement: "Can you confirm the revised scope?",
    status: "open",
    owner: "evavo",
    sourceEvidenceIds: ["gmail:m1"],
    ...overrides,
  };
}

test("quoted history is never promoted to a new live response target", () => {
  const delta = buildBusinessThreadDelta({
    threadId: "t1",
    previousState: [],
    latestObservedState: [item({ quotedHistory: true })],
  });
  assert.equal(delta.newItems.length, 0);
  assert.equal(delta.liveResponseTargets.length, 0);
});

test("missing old open items remain unresolved rather than silently disappearing", () => {
  const delta = buildBusinessThreadDelta({
    threadId: "t2",
    previousState: [item()],
    latestObservedState: [],
  });
  assert.equal(delta.disappearedWithoutResolution.length, 1);
});

test("EVAVO-owned open work controls next action ownership", () => {
  const delta = buildBusinessThreadDelta({
    threadId: "t3",
    previousState: [],
    latestObservedState: [
      item(),
      item({ id: "q2", owner: "counterparty", statement: "Client to provide PO.", sourceEvidenceIds: ["gmail:m2"] }),
    ],
  });
  assert.equal(delta.nextActionOwner, "evavo");
});

test("duplicate state ids fail closed", () => {
  assert.throws(() => buildBusinessThreadDelta({
    threadId: "t4",
    previousState: [],
    latestObservedState: [item(), item()],
  }), /DUPLICATE_ITEM_ID/);
});
