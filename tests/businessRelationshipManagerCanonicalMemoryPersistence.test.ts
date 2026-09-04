import assert from "node:assert/strict";
import test from "node:test";

import type { BrainMemoryIngestionPort } from "../src/core/businessBrainMemoryIngestionPort";
import { runCanonicalRelationshipManagerCommunicationCycle } from "../src/core/businessRelationshipManagerCanonicalRuntime";
import { persistCanonicalRelationshipManagerCycleMemory } from "../src/core/businessRelationshipManagerCanonicalMemoryPersistence";

function canonicalCycle() {
  return runCanonicalRelationshipManagerCommunicationCycle({
    cycle: {
      cycleId: "cycle-memory-1",
      observedAt: "2026-09-04T10:00:30Z",
      decisionAt: "2026-09-04T10:01:00Z",
      scenario: "general",
      objective: "Answer the client's current status question.",
      gmail: {
        threadId: "thread-memory-1",
        relationshipId: "relationship-memory-1",
        personId: "person-memory-1",
        messages: [{
          id: "gmail-memory-1",
          threadId: "thread-memory-1",
          sentAt: "2026-09-04T10:00:00Z",
          from: { name: "Client", address: "client@example.com" },
          to: [{ name: "Greg", address: "greg@evavo.com.au" }],
          subject: "Status",
          body: "Could you confirm the current status?",
        }],
      },
      identity: {
        contract: "business_relationship_identity_resolver_v2",
        status: "verified",
        selected: {
          personId: "person-memory-1",
          name: "Client",
          addresses: ["client@example.com"],
          relationshipIds: ["relationship-memory-1"],
          evidence: [{ source: "gmail", ref: "gmail:message:gmail-memory-1", confidence: 100 }],
        },
        confidence: 100,
        exactAddressMatch: true,
        reasons: ["Evidence-backed exact address match."],
        competingPersonIds: [],
      },
      channel: { currentChannel: "email", canResolveInWriting: true },
      evidenceConfidence: 98,
      additionalEvidenceIds: ["operations:project-status:verified"],
    },
    context: {
      identitySummary: "Client identity verified from the current Gmail sender and relationship record.",
      communicationSummary: "Client has one live status question.",
      projectSummary: "Current project status verified by Operations Core.",
      evidenceItems: [
        {
          id: "identity-memory-1",
          domain: "identity",
          summary: "Exact sender identity verified.",
          status: "current",
          authority: "authoritative",
          observedAt: "2026-09-04T10:00:30Z",
          sourceRefs: ["gmail:message:gmail-memory-1", "identity:person-memory-1"],
        },
        {
          id: "gmail-memory-context-1",
          domain: "gmail",
          summary: "Current Gmail thread read.",
          status: "current",
          authority: "canonical",
          observedAt: "2026-09-04T10:00:30Z",
          sourceRefs: ["gmail:thread:thread-memory-1"],
        },
        {
          id: "operations-memory-1",
          domain: "operations",
          summary: "Current project status retrieved.",
          status: "current",
          authority: "canonical",
          observedAt: "2026-09-04T10:00:30Z",
          sourceRefs: ["operations:project-status:verified"],
        },
      ],
      sourceReadiness: [
        { source: "identity", required: true, state: "verified", checkedAt: "2026-09-04T10:00:30Z", evidenceRefs: ["identity:person-memory-1"] },
        { source: "gmail", required: true, state: "verified", checkedAt: "2026-09-04T10:00:30Z", evidenceRefs: ["gmail:thread:thread-memory-1"] },
        { source: "operations", required: true, state: "verified", checkedAt: "2026-09-04T10:00:30Z", evidenceRefs: ["operations:project-status:verified"] },
      ],
    },
  });
}

function brainPort(status: "appended" | "idempotent_replay" = "appended"): BrainMemoryIngestionPort {
  return {
    contract: "business_brain_memory_ingestion_port_v1",
    write: async (request) => ({
      contract: "evavo-memory-ingestion-receipt-v2",
      requestId: request.requestId,
      idempotencyKey: request.idempotencyKey,
      sourceRef: request.observation.sourceRef,
      status,
      durable: true,
      recordId: `mem2_${request.requestId.replace(/[^a-z0-9]/gi, "_")}`,
      reasons: [status],
    }),
  };
}

test("canonical cycle persists every material observation through the Brain port", async () => {
  const cycle = canonicalCycle();
  const result = await persistCanonicalRelationshipManagerCycleMemory({
    canonicalCycle: cycle,
    brain: brainPort(),
  });
  assert.equal(result.contract, "business_relationship_manager_canonical_memory_persistence_v1");
  assert.equal(result.canonicalCycleId, cycle.cycle.cycleId);
  assert.equal(result.durable, true);
  assert.equal(result.persistence.durable, true);
  assert.equal(result.persistence.blockers.length, 0);
  assert.equal(result.persistence.materialObservations, result.persistence.durableObservations);
  assert.ok(result.persistence.recordIds.length > 0);
  assert.equal(result.externalEffectPerformed, false);
});

test("idempotent Brain replay remains a durable canonical checkpoint", async () => {
  const result = await persistCanonicalRelationshipManagerCycleMemory({
    canonicalCycle: canonicalCycle(),
    brain: brainPort("idempotent_replay"),
  });
  assert.equal(result.durable, true);
  assert.ok(result.persistence.receipts.every((receipt) => receipt.status === "idempotent_replay"));
});

test("one rejected material observation blocks the entire canonical checkpoint", async () => {
  let writes = 0;
  const brain: BrainMemoryIngestionPort = {
    contract: "business_brain_memory_ingestion_port_v1",
    write: async (request) => {
      writes += 1;
      if (writes === 2) {
        return {
          contract: "evavo-memory-ingestion-receipt-v2",
          requestId: request.requestId,
          idempotencyKey: request.idempotencyKey,
          sourceRef: request.observation.sourceRef,
          status: "rejected",
          durable: false,
          reasons: ["simulated_storage_rejection"],
        };
      }
      return {
        contract: "evavo-memory-ingestion-receipt-v2",
        requestId: request.requestId,
        idempotencyKey: request.idempotencyKey,
        sourceRef: request.observation.sourceRef,
        status: "appended",
        durable: true,
        recordId: `mem2_${writes}`,
        reasons: ["appended"],
      };
    },
  };

  await assert.rejects(
    () => persistCanonicalRelationshipManagerCycleMemory({ canonicalCycle: canonicalCycle(), brain }),
    /CANONICAL_MEMORY_NOT_DURABLE/,
  );
});
