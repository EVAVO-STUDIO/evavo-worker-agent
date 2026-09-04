import assert from "node:assert/strict";
import test from "node:test";

import { assessProactiveRelationshipAwareness } from "../src/core/businessRelationshipProactiveAwareness";

const NOW = "2026-09-04T11:30:00+10:00";

test("prompts EVAVO to update before the client has to chase", () => {
  const result = assessProactiveRelationshipAwareness({
    now: NOW,
    relationshipType: "active_client",
    evavoOwnsNextMove: true,
    promisedUpdateDueAt: "2026-09-04T09:00:00+10:00",
    counterpartyWaitingOnEvavo: true,
    lastOutboundUpdateAt: "2026-09-01T10:00:00+10:00",
  });

  assert.equal(result.shouldActBeforeInbound, true);
  assert.ok(result.signals.some((signal) => signal.kind === "update_before_chase"));
  assert.ok(result.signals.some((signal) => signal.kind === "client_waiting_too_long"));
});

test("overdue EVAVO commitments outrank passive stale-relationship awareness", () => {
  const result = assessProactiveRelationshipAwareness({
    now: NOW,
    relationshipType: "active_client",
    evavoOwnsNextMove: true,
    evavoCommitmentDueAt: "2026-09-01T09:00:00+10:00",
    lastMeaningfulInteractionAt: "2026-06-01T09:00:00+10:00",
  });

  assert.equal(result.highestSeverity, "critical");
  assert.ok(result.signals.some((signal) => signal.kind === "evavo_commitment_overdue"));
});

test("suppression prevents proactive outbound preparation", () => {
  const result = assessProactiveRelationshipAwareness({
    now: NOW,
    suppressionActive: true,
    evavoOwnsNextMove: true,
    evavoCommitmentDueAt: "2026-09-01T09:00:00+10:00",
  });

  assert.equal(result.shouldActBeforeInbound, false);
  assert.deepEqual(result.signals.map((signal) => signal.kind), ["nothing_to_do"]);
});

test("does not invent proactive work when no evidence-backed trigger exists", () => {
  const result = assessProactiveRelationshipAwareness({ now: NOW, relationshipType: "prospective_client" });
  assert.equal(result.shouldActBeforeInbound, false);
  assert.equal(result.signals[0]?.kind, "nothing_to_do");
});
