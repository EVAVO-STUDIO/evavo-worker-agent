import assert from "node:assert/strict";
import test from "node:test";

import type { BrainMemoryIngestionPort } from "../src/core/businessBrainMemoryIngestionPort";
import { persistRelationshipManagerCycleToBrain } from "../src/core/businessRelationshipManagerBrainPersistenceRuntime";
import { runRelationshipManagerCommunicationCycle } from "../src/core/businessRelationshipManagerRuntime";

function cycle() {
  return runRelationshipManagerCommunicationCycle({
    cycleId: "cycle-brain-persist-1",
    observedAt: "2026-09-04T12:00:30Z",
    decisionAt: "2026-09-04T12:01:00Z",
    scenario: "general",
    objective: "Answer the current project-status question.",
    gmail: {
      threadId: "thread-brain-persist-1",
      relationshipId: "relationship-brain-persist-1",
      personId: "person-brain-persist-1",
      messages: [{
        id: "m1",
        threadId: "thread-brain-persist-1",
        sentAt: "2026-09-04T12:00:00Z",
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
        personId: "person-brain-persist-1",
        name: "Client",
        addresses: ["client@example.com"],
        evidence: [{ source: "gmail", ref: "gmail:message:m1", confidence: 100 }],
      },
      confidence: 100,
      exactAddressMatch: true,
      reasons: ["Exact evidence-backed address match."],
      competingPersonIds: [],
    },
    channel: { currentChannel: "email", canResolveInWriting: true },
    evidenceConfidence: 98,
    additionalEvidenceIds: ["operations:project-status"],
  });
}

function brainPort(statusForMaterial: "appended" | "rejected" = "appended"): BrainMemoryIngestionPort {
  return {
    contract: "business_brain_memory_ingestion_port_v2",
    write: async (request) => {
      const rejected = request.observation.material && statusForMaterial === "rejected";
      return {
        contract: "evavo-memory-ingestion-receipt-v2",
        requestId: request.requestId,
        idempotencyKey: request.idempotencyKey,
        sourceRef: request.observation.sourceRef,
        status: rejected ? "rejected" : "appended",
        durable: !rejected,
        ...(!rejected ? { recordId: `mem2:${request.requestId}` } : {}),
        reasons: rejected ? ["synthetic_storage_rejection"] : ["durable_append"],
      };
    },
  };
}

test("canonical Brain persistence reports durable only after all material observations are accepted", async () => {
  const current = cycle();
  const result = await persistRelationshipManagerCycleToBrain({
    cycle: current,
    brain: brainPort(),
  });
  assert.equal(result.contract, "business_relationship_manager_brain_persistence_runtime_v1");
  assert.equal(result.cycleId, current.cycleId);
  assert.equal(result.durable, true);
  assert.equal(result.persistence.durable, true);
  assert.ok(result.persistence.recordIds.length > 0);
  assert.equal(result.externalEffectPerformed, false);
});

test("one rejected material observation keeps the whole cycle non-durable", async () => {
  const result = await persistRelationshipManagerCycleToBrain({
    cycle: cycle(),
    brain: brainPort("rejected"),
  });
  assert.equal(result.durable, false);
  assert.equal(result.persistence.durable, false);
  assert.ok(result.persistence.blockers.some((item) => /material_observation_not_durable:rejected/i.test(item)));
});
