import assert from "node:assert/strict";
import test from "node:test";

import { assessBusinessObligation, buildObligationLedgerSnapshot } from "../src/core/businessObligationLedger";

const NOW = new Date("2026-09-04T12:00:00Z");

test("legacy due date without explicit due evidence remains readable but is flagged", () => {
  const assessment = assessBusinessObligation({
    id: "obl-legacy-due",
    owner: "evavo",
    statement: "Send the revised estimate.",
    status: "open",
    importance: "high",
    createdAt: "2026-09-01T00:00:00Z",
    dueAt: "2026-09-05T00:00:00Z",
    sourceEvidenceIds: ["gmail:message:1"],
    satisfactionEvidenceIds: [],
  }, NOW);

  assert.equal(assessment.dueAtEvidenceVerified, false);
  assert.equal(assessment.needsAttention, true);
  assert.match(assessment.attentionReason ?? "", /due date without direct due-date evidence/i);
});

test("legacy terminal state remains readable but cannot masquerade as fully evidenced", () => {
  const assessment = assessBusinessObligation({
    id: "obl-legacy-satisfied",
    owner: "evavo",
    statement: "Send the file.",
    status: "satisfied",
    importance: "normal",
    createdAt: "2026-09-01T00:00:00Z",
    sourceEvidenceIds: ["gmail:message:1"],
    satisfactionEvidenceIds: [],
  }, NOW);

  assert.equal(assessment.stateEvidenceVerified, false);
  assert.equal(assessment.needsAttention, true);
});

test("snapshot reports evidence gaps and validates its decision clock", () => {
  const snapshot = buildObligationLedgerSnapshot([{
    id: "obl-gap",
    owner: "counterparty",
    statement: "Provide PO.",
    status: "uncertain",
    importance: "normal",
    createdAt: "2026-09-01T00:00:00Z",
    sourceEvidenceIds: ["gmail:message:2"],
    satisfactionEvidenceIds: [],
  }], NOW);

  assert.ok(snapshot.evidenceGaps.includes("obl-gap:state_evidence_missing"));
  assert.throws(() => buildObligationLedgerSnapshot([], new Date("invalid")), /OBLIGATION_NOW_INVALID/);
});
