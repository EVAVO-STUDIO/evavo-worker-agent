import assert from "node:assert/strict";
import test from "node:test";

import {
  applyObligationTransition,
  buildObligationLedgerSnapshot,
  mergeBusinessObligations,
  type BusinessObligation,
} from "../src/core/businessObligationLedger";

function obligation(overrides: Partial<BusinessObligation> = {}): BusinessObligation {
  return {
    id: "obl-1",
    relationshipId: "rel-1",
    owner: "evavo",
    statement: "Send the revised scope.",
    status: "open",
    importance: "normal",
    createdAt: "2026-09-04T00:00:00Z",
    dueAt: null,
    sourceEvidenceIds: ["gmail:m1"],
    satisfactionEvidenceIds: [],
    ...overrides,
  };
}

test("requires evidence for resolved state transitions", () => {
  assert.throws(() => applyObligationTransition(obligation(), {
    kind: "satisfy",
    obligationId: "obl-1",
    evidenceIds: [],
    occurredAt: "2026-09-04T01:00:00Z",
  }), /EVIDENCE_REQUIRED/);
});

test("satisfies an obligation only with evidence and becomes idempotent", () => {
  const first = applyObligationTransition(obligation(), {
    kind: "satisfy",
    obligationId: "obl-1",
    evidenceIds: ["gmail:m2"],
    occurredAt: "2026-09-04T01:00:00Z",
  });
  assert.equal(first.status, "satisfied");
  assert.deepEqual(first.satisfactionEvidenceIds, ["gmail:m2"]);
  const second = applyObligationTransition(first, {
    kind: "satisfy",
    obligationId: "obl-1",
    evidenceIds: ["gmail:m2"],
    occurredAt: "2026-09-04T01:05:00Z",
  });
  assert.equal(second, first);
});

test("due dates require direct evidence rather than vague prose", () => {
  assert.throws(() => buildObligationLedgerSnapshot([
    obligation({ dueAt: "2026-09-05T00:00:00Z" }),
  ], new Date("2026-09-04T00:00:00Z")), /DUE_AT_EVIDENCE_REQUIRED/);
});

test("merge is idempotent and rejects conflicting obligation identities", () => {
  const a = obligation();
  assert.equal(mergeBusinessObligations([a], [a]).length, 1);
  assert.throws(() => mergeBusinessObligations([a], [obligation({ statement: "Different commitment." })]), /ID_CONFLICT/);
});

test("snapshot resolves EVAVO as next action owner when EVAVO owes work", () => {
  const snapshot = buildObligationLedgerSnapshot([
    obligation(),
    obligation({ id: "obl-2", owner: "counterparty", statement: "Client to approve scope.", sourceEvidenceIds: ["gmail:m3"] }),
  ], new Date("2026-09-04T00:00:00Z"));
  assert.equal(snapshot.nextActionOwner, "evavo");
  assert.equal(snapshot.openEvavo.length, 1);
});
