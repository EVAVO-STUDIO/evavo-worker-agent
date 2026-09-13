import assert from "node:assert/strict";
import test from "node:test";

import type { BrainMemoryIngestionPort } from "../src/core/businessBrainMemoryIngestionPort";
import { persistCanonicalRelationshipManagerCycleToBrain } from "../src/core/businessRelationshipManagerBrainPersistenceRuntime";
import { runCanonicalRelationshipManagerCommunicationCycle } from "../src/core/businessRelationshipManagerCanonicalRuntime";

function canonicalCycle(options: Readonly<{ operationsUnavailable?: boolean }> = {}) {
  return runCanonicalRelationshipManagerCommunicationCycle({
    cycle: {
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
    },
    context: {
      identitySummary: "Client <client@example.com> verified from the active Gmail thread.",
      communicationSummary: "One live client question asks for current project status.",
      evidenceItems: [
        {
          id: "identity-current",
          domain: "identity",
          summary: "Exact sender identity verified.",
          status: "current",
          authority: "authoritative",
          observedAt: "2026-09-04T12:00:30Z",
          sourceRefs: ["gmail:message:m1"],
        },
        {
          id: "gmail-current",
          domain: "gmail",
          summary: "Current Gmail thread read.",
          status: "current",
          authority: "canonical",
          observedAt: "2026-09-04T12:00:30Z",
          sourceRefs: ["gmail:thread:thread-brain-persist-1"],
        },
      ],
      ...(options.operationsUnavailable ? {
        sourceReadiness: [{
          domain: "operations" as const,
          state: "provider_unavailable" as const,
          required: true,
          absenceAcceptable: false,
          observedAt: "2026-09-04T12:00:30Z",
          sourceRefs: ["operations:availability:failed"],
          detail: "Operations Core could not be queried.",
        }],
      } : {}),
    },
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
  const current = canonicalCycle();
  const result = await persistCanonicalRelationshipManagerCycleToBrain({
    canonicalCycle: current,
    brain: brainPort(),
  });
  assert.equal(result.contract, "business_relationship_manager_brain_persistence_runtime_v2");
  assert.equal(result.cycleId, current.cycle.cycleId);
  assert.equal(result.decisionPackageId, current.cycle.decision.packageId);
  assert.equal(result.decisionContextContract, "business_relationship_decision_context_v3");
  assert.equal(result.durable, true);
  assert.equal(result.persistence.durable, true);
  assert.ok(result.persistence.recordIds.length > 0);
  assert.equal(result.externalEffectPerformed, false);
});

test("one rejected material observation keeps the canonical cycle non-durable", async () => {
  const result = await persistCanonicalRelationshipManagerCycleToBrain({
    canonicalCycle: canonicalCycle(),
    brain: brainPort("rejected"),
  });
  assert.equal(result.durable, false);
  assert.equal(result.persistence.durable, false);
  assert.ok(result.persistence.blockers.some((item) => /material_observation_not_durable:rejected/i.test(item)));
});

test("non-ready canonical source state is refused before any durable write", async () => {
  let writes = 0;
  const brain: BrainMemoryIngestionPort = {
    contract: "business_brain_memory_ingestion_port_v2",
    write: async () => {
      writes += 1;
      throw new Error("should not execute");
    },
  };
  await assert.rejects(
    () => persistCanonicalRelationshipManagerCycleToBrain({
      canonicalCycle: canonicalCycle({ operationsUnavailable: true }),
      brain,
    }),
    /CANONICAL_CONTEXT_NOT_READY/,
  );
  assert.equal(writes, 0);
});
