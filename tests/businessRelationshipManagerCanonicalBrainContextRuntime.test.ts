import assert from "node:assert/strict";
import test from "node:test";

import type { BrainMemoryContextPort } from "../src/core/businessBrainMemoryContextPort";
import { runCanonicalRelationshipManagerCycleWithBrainContext } from "../src/core/businessRelationshipManagerCanonicalBrainContextRuntime";

const DECISION_AT = "2026-09-04T12:01:00.000Z";

function input(brain: BrainMemoryContextPort) {
  return {
    brain,
    cycle: {
      cycleId: "cycle-brain-context-1",
      observedAt: "2026-09-04T12:00:30.000Z",
      decisionAt: DECISION_AT,
      scenario: "general" as const,
      objective: "Answer the client's current status question safely.",
      gmail: {
        threadId: "thread-brain-context-1",
        relationshipId: "relationship-brain-context-1",
        personId: "person-brain-context-1",
        messages: [{
          id: "m1",
          threadId: "thread-brain-context-1",
          sentAt: "2026-09-04T12:00:00.000Z",
          from: { name: "Client", address: "client@example.com" },
          to: [{ name: "Greg", address: "greg@evavo.com.au" }],
          subject: "Status",
          body: "Could you confirm the current status?",
        }],
      },
      identity: {
        contract: "business_relationship_identity_resolver_v2" as const,
        status: "verified" as const,
        selected: {
          personId: "person-brain-context-1",
          name: "Client",
          addresses: ["client@example.com"],
          evidence: [{ source: "gmail" as const, ref: "gmail:message:m1", confidence: 100 }],
        },
        confidence: 100,
        exactAddressMatch: true,
        reasons: ["Exact evidence-backed address match."],
        competingPersonIds: [],
      },
      channel: { currentChannel: "email" as const, canResolveInWriting: true },
      evidenceConfidence: 98,
      additionalEvidenceIds: ["operations:project-status"],
    },
    context: {
      identitySummary: "Client <client@example.com> verified from the current Gmail thread.",
      communicationSummary: "One current client question asks for project status.",
      evidenceItems: [
        {
          id: "identity-current",
          domain: "identity" as const,
          summary: "Exact sender identity verified.",
          status: "current" as const,
          authority: "authoritative" as const,
          observedAt: "2026-09-04T12:00:30.000Z",
          sourceRefs: ["gmail:message:m1"],
        },
        {
          id: "gmail-current",
          domain: "gmail" as const,
          summary: "Current Gmail thread read.",
          status: "current" as const,
          authority: "canonical" as const,
          observedAt: "2026-09-04T12:00:30.000Z",
          sourceRefs: ["gmail:thread:thread-brain-context-1"],
        },
      ],
    },
  };
}

function port(mode: "records" | "empty" | "unavailable" | "wrong_as_of" | "integrity_error"): BrainMemoryContextPort {
  return {
    contract: "business_brain_memory_context_port_v1",
    async read(request) {
      assert.equal(request.intent, "communication");
      assert.ok(request.entityRefs.some((entity) => entity.kind === "relationship" && entity.id === "relationship-brain-context-1"));
      assert.equal(request.asOf, DECISION_AT);
      if (mode === "unavailable") throw new Error("BRAIN_MEMORY_CONTEXT_READ_UNAVAILABLE");
      if (mode === "integrity_error") throw new Error("BRAIN_MEMORY_CONTEXT_UNSOURCED_RECORD");
      const records = mode === "records" ? [{
        id: "mem2_previous_decision",
        kind: "decision",
        summary: "Keep this relationship asynchronous unless a meeting adds clear value.",
        occurredAt: "2026-09-01T03:00:00.000Z",
        confidence: "verified",
        status: "current",
        canonicalOwner: "evavo-worker-agent",
        sourceRefs: ["gmail:message:prior-1"],
        score: 97,
        whyIncluded: ["exact relationship match", "authoritative source"],
      }] : [];
      return {
        contract: "business_brain_memory_context_port_v1",
        context: {
          protocol: "evavo-memory-fabric-v2",
          generatedAt: "2026-09-04T12:00:45.000Z",
          asOf: mode === "wrong_as_of" ? "2026-09-04T12:00:59.000Z" : DECISION_AT,
          summary: records.length ? "Prior relationship decision found." : "No durable EVAVO memory matched this context request.",
          records,
          omittedRecordCount: 0,
        },
        queryEvidenceRef: `brain:memory-context-query:${"a".repeat(64)}`,
        restrictedRecordsExcluded: 0,
      };
    },
  };
}

test("prior durable Brain memory is injected into the canonical decision cycle", async () => {
  const result = await runCanonicalRelationshipManagerCycleWithBrainContext(input(port("records")));
  assert.equal(result.contract, "business_relationship_manager_canonical_brain_context_runtime_v1");
  assert.equal(result.brainState, "verified");
  assert.equal(result.memoryRecordCount, 1);
  assert.equal(result.canonicalCycle.cycle.decision.memoryContextUsed, true);
  assert.deepEqual(result.canonicalCycle.cycle.decision.memoryRecordIds, ["mem2_previous_decision"]);
  assert.ok(result.canonicalCycle.decisionContext.evidenceRefs.includes(result.queryEvidenceRef!));
  assert.equal(result.canonicalCycle.approvalGradeReady, true);
});

test("successful empty Brain query is evidence-backed not_found and does not invent history", async () => {
  const result = await runCanonicalRelationshipManagerCycleWithBrainContext(input(port("empty")));
  assert.equal(result.brainState, "not_found");
  assert.equal(result.memoryRecordCount, 0);
  assert.equal(result.canonicalCycle.cycle.decision.memoryContextUsed, false);
  assert.ok(result.queryEvidenceRef);
  assert.ok(result.canonicalCycle.decisionContext.evidenceRefs.includes(result.queryEvidenceRef!));
  assert.equal(result.canonicalCycle.approvalGradeReady, true);
});

test("Brain outage becomes provider_unavailable and blocks approval-grade readiness", async () => {
  const result = await runCanonicalRelationshipManagerCycleWithBrainContext(input(port("unavailable")));
  assert.equal(result.brainState, "provider_unavailable");
  assert.equal(result.queryEvidenceRef, null);
  assert.equal(result.canonicalCycle.approvalGradeReady, false);
  assert.equal(result.canonicalCycle.cycle.decision.disposition, "escalate");
  assert.ok(result.canonicalCycle.decisionContext.sourceReadiness?.blockingDomains.includes("memory"));
  assert.ok(result.canonicalCycle.cycle.decision.nextContextSources.includes("memory"));
});

test("caller cannot pre-assert Brain source readiness on the hydrated canonical path", async () => {
  const current = input(port("empty"));
  await assert.rejects(
    () => runCanonicalRelationshipManagerCycleWithBrainContext({
      ...current,
      context: {
        ...current.context,
        sourceReadiness: [{
          domain: "memory",
          state: "verified",
          required: true,
          observedAt: "2026-09-04T12:00:30.000Z",
          sourceRefs: ["forged:memory"],
        }],
      },
    }),
    /CALLER_MEMORY_READINESS_FORBIDDEN/,
  );
});

test("Brain response must be bound to the exact deterministic decision asOf", async () => {
  await assert.rejects(
    () => runCanonicalRelationshipManagerCycleWithBrainContext(input(port("wrong_as_of"))),
    /BRAIN_AS_OF_MISMATCH/,
  );
});

test("Brain integrity failures remain fatal instead of being mislabeled provider unavailable", async () => {
  await assert.rejects(
    () => runCanonicalRelationshipManagerCycleWithBrainContext(input(port("integrity_error"))),
    /BRAIN_MEMORY_CONTEXT_UNSOURCED_RECORD/,
  );
});
