import assert from "node:assert/strict";
import test from "node:test";

import { assessCommunicationOutcome } from "../src/core/businessCommunicationOutcome";
import {
  outcomeSignalsFromReconciliation,
  reconcileCommunicationOutcome,
} from "../src/core/businessCommunicationOutcomeReconciler";

const NOW = "2026-09-04T09:00:00+10:00";

function obligation(id: string) {
  return {
    id,
    relationshipId: "rel-1",
    owner: "evavo" as const,
    statement: "Send the requested clarification.",
    status: "open" as const,
    importance: "normal" as const,
    createdAt: "2026-09-03T09:00:00+10:00",
    sourceEvidenceIds: ["gmail:request-1"],
    satisfactionEvidenceIds: [],
  };
}

function assessment() {
  return assessCommunicationOutcome({
    relationshipId: "rel-1",
    communicationId: "message-1",
    assessedAt: NOW,
    signals: [
      {
        id: "reply-1",
        kind: "reply_received",
        occurredAt: NOW,
        summary: "Recipient confirmed the clarification answered the question.",
        sourceRefs: ["gmail:reply-1"],
        confidence: 95,
      },
    ],
  });
}

test("closes an obligation only when explicit high-confidence evidence identifies it", () => {
  const result = reconcileCommunicationOutcome({
    assessment: assessment(),
    currentObligations: [obligation("obl-1")],
    satisfactionObservations: [
      {
        obligationId: "obl-1",
        evidenceIds: ["gmail:reply-1"],
        occurredAt: NOW,
        confidence: 95,
      },
    ],
  });

  assert.equal(result.transitions.length, 1);
  assert.equal(result.obligations[0]?.status, "satisfied");
  assert.deepEqual(result.obligations[0]?.satisfactionEvidenceIds, ["gmail:reply-1"]);
});

test("does not close an obligation from weak evidence", () => {
  const result = reconcileCommunicationOutcome({
    assessment: assessment(),
    currentObligations: [obligation("obl-1")],
    satisfactionObservations: [
      {
        obligationId: "obl-1",
        evidenceIds: ["gmail:reply-weak"],
        occurredAt: NOW,
        confidence: 60,
      },
    ],
  });

  assert.equal(result.transitions.length, 0);
  assert.equal(result.obligations[0]?.status, "open");
});

test("records an unresolved claim instead of inventing an obligation", () => {
  const result = reconcileCommunicationOutcome({
    assessment: assessment(),
    currentObligations: [],
    satisfactionObservations: [
      {
        obligationId: "obl-missing",
        evidenceIds: ["gmail:reply-1"],
        occurredAt: NOW,
        confidence: 95,
      },
    ],
  });

  assert.deepEqual(result.unresolvedSatisfactionClaims, ["obl-missing"]);
});

test("accepts a genuinely new evidenced obligation and emits outcome signals", () => {
  const newObligation = {
    id: "obl-2",
    relationshipId: "rel-1",
    owner: "evavo" as const,
    statement: "Send the revised document requested in the reply.",
    status: "open" as const,
    importance: "normal" as const,
    createdAt: NOW,
    sourceEvidenceIds: ["gmail:reply-2"],
    satisfactionEvidenceIds: [],
  };

  const result = reconcileCommunicationOutcome({
    assessment: assessment(),
    currentObligations: [],
    newObligationObservations: [
      {
        obligation: newObligation,
        evidenceIds: ["gmail:reply-2"],
        confidence: 95,
      },
    ],
  });

  assert.equal(result.newObligations.length, 1);
  const signals = outcomeSignalsFromReconciliation(result);
  assert.ok(signals.some((signal) => signal.kind === "obligation_created"));
});
