import assert from "node:assert/strict";
import test from "node:test";

import {
  buildRelationshipManagerMemoryIngestionRequests,
  persistRelationshipManagerCycleMemory,
} from "../src/core/businessRelationshipManagerMemoryPersistence";
import { runRelationshipManagerCommunicationCycle } from "../src/core/businessRelationshipManagerRuntime";

function cycle() {
  return runRelationshipManagerCommunicationCycle({
    cycleId: "cycle-memory-1",
    observedAt: "2026-09-04T01:00:30Z",
    decisionAt: "2026-09-04T01:01:00Z",
    scenario: "general",
    objective: "Answer the client's request.",
    gmail: {
      threadId: "thread-memory-1",
      relationshipId: "relationship-memory-1",
      personId: "person-memory-1",
      messages: [{
        id: "m1",
        threadId: "thread-memory-1",
        sentAt: "2026-09-04T01:00:00Z",
        from: { name: "Client", address: "client@example.com" },
        to: [{ name: "Greg", address: "greg@evavo.com.au" }],
        subject: "Status",
        body: "Could you please confirm the current status?",
      }],
    },
    identity: {
      contract: "business_relationship_identity_resolver_v1",
      status: "verified",
      selected: {
        personId: "person-memory-1",
        name: "Client",
        addresses: ["client@example.com"],
        evidence: [{ source: "gmail", ref: "gmail:message:m1", confidence: 100 }],
      },
      confidence: 100,
      exactAddressMatch: true,
      reasons: ["Exact address match."],
      competingPersonIds: [],
    },
    channel: { currentChannel: "email", canResolveInWriting: true },
    evidenceConfidence: 96,
    additionalEvidenceIds: ["operations:project:status"],
  });
}

function accepted(request: ReturnType<typeof buildRelationshipManagerMemoryIngestionRequests>[number], status: "appended" | "idempotent_replay" = "appended") {
  return {
    contract: "evavo-memory-ingestion-receipt-v2" as const,
    requestId: request.requestId,
    idempotencyKey: request.idempotencyKey,
    sourceRef: request.observation.sourceRef,
    status,
    durable: true,
    recordId: `mem:${request.requestId}`,
    reasons: [],
  };
}

test("all material cycle observations become durable only after matching receipts", async () => {
  const result = await persistRelationshipManagerCycleMemory({
    cycle: cycle(),
    write: async (request) => accepted(request),
  });
  assert.equal(result.durable, true);
  assert.equal(result.blockers.length, 0);
  assert.equal(result.materialObservations, result.durableObservations);
  assert.ok(result.recordIds.length >= 2);
  assert.equal(result.externalEffectPerformed, false);
});

test("idempotency keys are stable across replay of the same deterministic cycle", () => {
  const first = buildRelationshipManagerMemoryIngestionRequests(cycle());
  const second = buildRelationshipManagerMemoryIngestionRequests(cycle());
  assert.deepEqual(first.map((item) => item.idempotencyKey), second.map((item) => item.idempotencyKey));
  assert.deepEqual(first.map((item) => item.requestId), second.map((item) => item.requestId));
});

test("idempotent replay counts as durable acceptance", async () => {
  const result = await persistRelationshipManagerCycleMemory({
    cycle: cycle(),
    write: async (request) => accepted(request, "idempotent_replay"),
  });
  assert.equal(result.durable, true);
});

test("one failed material observation cannot hide behind another observation with the same Gmail source ref", async () => {
  const current = cycle();
  const sharedRefs = current.memoryObservations.filter((item) => item.sourceRef === "gmail:message:m1");
  assert.ok(sharedRefs.length >= 2, "message and extracted obligation should share provider evidence ref");

  const result = await persistRelationshipManagerCycleMemory({
    cycle: current,
    write: async (request) => {
      if (request.observation.kind === "obligation") {
        return {
          contract: "evavo-memory-ingestion-receipt-v2" as const,
          requestId: request.requestId,
          idempotencyKey: request.idempotencyKey,
          sourceRef: request.observation.sourceRef,
          status: "rejected" as const,
          durable: false,
          reasons: ["test rejection"],
        };
      }
      return accepted(request);
    },
  });

  assert.equal(result.durable, false);
  assert.ok(result.rejectedObservations >= 1);
  assert.ok(result.blockers.some((item) => /material_observation_not_durable:rejected/.test(item)));
});

test("receipt for a different request fails closed", async () => {
  const result = await persistRelationshipManagerCycleMemory({
    cycle: cycle(),
    write: async (request) => ({ ...accepted(request), requestId: "wrong-request" }),
  });
  assert.equal(result.durable, false);
  assert.ok(result.blockers.some((item) => /RECEIPT_REQUEST_MISMATCH/.test(item)));
});
