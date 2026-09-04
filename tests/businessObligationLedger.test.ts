import assert from "node:assert/strict";
import test from "node:test";

import { assessBusinessObligation, openEvavoObligations } from "../src/core/businessObligationLedger";

const NOW = new Date("2026-09-04T11:39:00+10:00");

test("flags overdue EVAVO commitments", () => {
  const assessment = assessBusinessObligation({
    id: "ob-1",
    owner: "evavo",
    statement: "Send the promised portfolio feedback.",
    status: "open",
    importance: "normal",
    createdAt: "2026-09-01T10:00:00+10:00",
    dueAt: "2026-09-03T17:00:00+10:00",
    sourceEvidenceIds: ["email-1"],
    satisfactionEvidenceIds: [],
  }, NOW);

  assert.equal(assessment.overdue, true);
  assert.equal(assessment.needsAttention, true);
});

test("does not treat satisfied obligations as overdue", () => {
  const assessment = assessBusinessObligation({
    id: "ob-2",
    owner: "evavo",
    statement: "Send the document.",
    status: "satisfied",
    importance: "high",
    createdAt: "2026-09-01T10:00:00+10:00",
    dueAt: "2026-09-02T10:00:00+10:00",
    sourceEvidenceIds: ["email-1"],
    satisfactionEvidenceIds: ["email-2"],
  }, NOW);

  assert.equal(assessment.overdue, false);
  assert.equal(assessment.needsAttention, false);
});

test("returns only active EVAVO-owned obligations", () => {
  const obligations = openEvavoObligations([
    { id: "a", owner: "evavo", statement: "A", status: "open", importance: "normal", createdAt: NOW.toISOString(), sourceEvidenceIds: ["e1"], satisfactionEvidenceIds: [] },
    { id: "b", owner: "counterparty", statement: "B", status: "open", importance: "normal", createdAt: NOW.toISOString(), sourceEvidenceIds: ["e2"], satisfactionEvidenceIds: [] },
    { id: "c", owner: "evavo", statement: "C", status: "satisfied", importance: "normal", createdAt: NOW.toISOString(), sourceEvidenceIds: ["e3"], satisfactionEvidenceIds: ["e4"] },
  ]);

  assert.deepEqual(obligations.map((item) => item.id), ["a"]);
});
