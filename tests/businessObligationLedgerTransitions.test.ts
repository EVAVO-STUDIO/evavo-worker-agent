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

test("satisfies an obligation only with evidence, records chronology and becomes idempotent", () => {
  const first = applyObligationTransition(obligation(), {
    kind: "satisfy",
    obligationId: "obl-1",
    evidenceIds: ["gmail:m2"],
    occurredAt: "2026-09-04T01:00:00Z",
  });
  assert.equal(first.status, "satisfied");
  assert.deepEqual(first.satisfactionEvidenceIds, ["gmail:m2"]);
  assert.equal(first.lastTransitionAt, "2026-09-04T01:00:00.000Z");

  const second = applyObligationTransition(first, {
    kind: "satisfy",
    obligationId: "obl-1",
    evidenceIds: ["gmail:m2"],
    occurredAt: "2026-09-04T01:05:00Z",
  });
  assert.equal(second, first);
});

test("rejects backdated state transitions", () => {
  const uncertain = applyObligationTransition(obligation(), {
    kind: "mark_uncertain",
    obligationId: "obl-1",
    evidenceIds: ["gmail:m2"],
    occurredAt: "2026-09-04T02:00:00Z",
  });
  assert.throws(() => applyObligationTransition(uncertain, {
    kind: "satisfy",
    obligationId: "obl-1",
    evidenceIds: ["gmail:m3"],
    occurredAt: "2026-09-04T01:59:59Z",
  }), /TRANSITION_OUT_OF_ORDER/);
});

test("rejects transitions before the obligation existed", () => {
  assert.throws(() => applyObligationTransition(obligation(), {
    kind: "mark_uncertain",
    obligationId: "obl-1",
    evidenceIds: ["gmail:m0"],
    occurredAt: "2026-09-03T23:59:59Z",
  }), /TRANSITION_BEFORE_CREATED/);
});

test("legacy due dates without direct evidence remain readable but are surfaced as evidence gaps", () => {
  const snapshot = buildObligationLedgerSnapshot([
    obligation({ dueAt: "2026-09-05T00:00:00Z" }),
  ], new Date("2026-09-04T00:00:00Z"));
  assert.ok(snapshot.evidenceGaps.includes("obl-1:due_at_evidence_missing"));
});

test("merge is idempotent and rejects conflicting obligation identities", () => {
  const a = obligation();
  assert.equal(mergeBusinessObligations([a], [a]).length, 1);
  assert.throws(() => mergeBusinessObligations([a], [obligation({ statement: "Different commitment." })]), /ID_CONFLICT/);
});

test("merge rejects an older state snapshot when both carry transition chronology", () => {
  const newer = obligation({
    status: "uncertain",
    stateEvidenceIds: ["gmail:m3"],
    lastTransitionAt: "2026-09-04T03:00:00Z",
  });
  const older = obligation({
    status: "open",
    lastTransitionAt: "2026-09-04T02:00:00Z",
  });
  assert.throws(() => mergeBusinessObligations([newer], [older]), /STATE_REGRESSION/);
});

test("merge rejects a state change that drops established transition chronology", () => {
  const evidenced = obligation({
    status: "uncertain",
    stateEvidenceIds: ["gmail:m3"],
    lastTransitionAt: "2026-09-04T03:00:00Z",
  });
  const legacyShapedChange = obligation({
    status: "open",
    lastTransitionAt: null,
  });
  assert.throws(() => mergeBusinessObligations([evidenced], [legacyShapedChange]), /STATE_CHRONOLOGY_MISSING/);
});

test("snapshot resolves EVAVO as next action owner when EVAVO owes work", () => {
  const snapshot = buildObligationLedgerSnapshot([
    obligation(),
    obligation({ id: "obl-2", owner: "counterparty", statement: "Client to approve scope.", sourceEvidenceIds: ["gmail:m3"] }),
  ], new Date("2026-09-04T00:00:00Z"));
  assert.equal(snapshot.nextActionOwner, "evavo");
  assert.equal(snapshot.openEvavo.length, 1);
});
