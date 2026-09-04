import assert from "node:assert/strict";
import test from "node:test";

import { buildCommunicationDecisionPackage, buildDeterministicCommunicationDecisionPackage } from "../src/core/businessCommunicationDecisionPackage";

const input = {
  packageId: "pkg-clock",
  scenario: "general" as const,
  objective: "Handle an owed follow-up.",
  thread: {
    threadId: "thread-clock",
    previousState: [],
    latestObservedState: [
      { id: "q1", kind: "question" as const, statement: "Can you confirm this today?", status: "open" as const, owner: "evavo" as const, sourceEvidenceIds: ["gmail:m1"] },
    ],
  },
  obligations: [
    {
      id: "obl-1",
      owner: "evavo" as const,
      statement: "Confirm the requested information.",
      status: "open" as const,
      importance: "high" as const,
      createdAt: "2026-09-04T09:00:00+10:00",
      dueAt: "2026-09-04T12:00:00+10:00",
      dueAtEvidenceId: "gmail:m1",
      sourceEvidenceIds: ["gmail:m1"],
      satisfactionEvidenceIds: [],
    },
  ],
  channel: { currentChannel: "email" as const, canResolveInWriting: true },
  evidenceIds: ["gmail:m1"],
  evidenceConfidence: 95,
};

test("explicit decision clock makes communication decisions replay deterministic", () => {
  const result = buildDeterministicCommunicationDecisionPackage({
    ...input,
    decisionAt: "2026-09-04T12:50:00+10:00",
  });
  assert.equal(result.replayDeterministic, true);
  assert.equal(result.decisionAt, "2026-09-04T02:50:00.000Z");
  assert.ok(result.activeEvavoObligations.includes("Confirm the requested information."));
});

test("legacy callers remain supported but are marked non deterministic", () => {
  const result = buildCommunicationDecisionPackage(input);
  assert.equal(result.replayDeterministic, false);
  assert.ok(result.reasons.some((item) => /legacy decision path/i.test(item)));
});
