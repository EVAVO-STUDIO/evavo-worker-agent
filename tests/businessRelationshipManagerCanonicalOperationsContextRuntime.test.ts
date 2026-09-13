import assert from "node:assert/strict";
import test from "node:test";

import type { BrainMemoryContextPort } from "../src/core/businessBrainMemoryContextPort";
import type { OperationsCoreRelationshipSnapshotPort } from "../src/core/businessOperationsCoreRelationshipSnapshotPort";
import { runCanonicalRelationshipManagerCycleWithOperationsContext } from "../src/core/businessRelationshipManagerCanonicalOperationsContextRuntime";

const CLIENT_ID = "11111111-1111-4111-8111-111111111111";
const PROJECT_ID = "22222222-2222-4222-8222-222222222222";
const OBSERVED_AT = "2026-09-04T12:00:45.000Z";
const BRAIN_STATE_REF = `brain:memory-context-state:${"a".repeat(64)}`;
const BRAIN_QUERY_REF = `brain:memory-context-query:${"b".repeat(64)}`;

function brain(): BrainMemoryContextPort {
  return {
    contract: "business_brain_memory_context_port_v2",
    async read(request) {
      return {
        contract: "business_brain_memory_context_port_v2",
        context: {
          protocol: "evavo-memory-fabric-v2",
          generatedAt: "2026-09-04T12:00:50.000Z",
          asOf: request.asOf!,
          summary: "No durable EVAVO memory matched this context request.",
          records: [],
          omittedRecordCount: 0,
        },
        stateEvidenceRef: BRAIN_STATE_REF,
        queryEvidenceRef: BRAIN_QUERY_REF,
        restrictedRecordsExcluded: 0,
      };
    },
  };
}

function operations(mode: "verified" | "not_found" | "provider_unavailable" | "transport_error"): OperationsCoreRelationshipSnapshotPort {
  return {
    contract: "business_operations_core_relationship_snapshot_port_v1",
    async read(request) {
      assert.equal(request.workspaceId, "evavo");
      assert.equal(request.commercialClientId, CLIENT_ID);
      assert.equal(request.projectId, PROJECT_ID);
      if (mode === "transport_error") throw new Error("OPERATIONS_RELATIONSHIP_READ_UNAVAILABLE");
      const verified = mode === "verified";
      return {
        contract: "evavo-relationship-manager-operations-snapshot-v1",
        state: mode,
        workspaceId: "evavo",
        commercialClientId: CLIENT_ID,
        projectId: PROJECT_ID,
        observedAt: OBSERVED_AT,
        evidenceRef: `operations:relationship-snapshot:${"c".repeat(64)}`,
        commercial: verified ? {
          client: {
            id: CLIENT_ID,
            name: "Example Client",
            status: "active",
            relationshipStage: "active_delivery",
            summary: "Active client with current delivery work.",
            activeProjectCount: 1,
            openBriefCount: 0,
            proposalCount: 1,
            readiness: "available",
            reviewRequired: false,
            updatedAt: "2026-09-04T11:58:00.000Z",
          },
          leadCount: 0,
          openBriefCount: 0,
          proposalCount: 1,
          acceptedProposalCount: 1,
          clientReadyProposalCount: 0,
          latestCommercialUpdatedAt: "2026-09-04T11:58:00.000Z",
        } : null,
        project: verified ? {
          id: PROJECT_ID,
          commercialClientId: CLIENT_ID,
          code: "EV-001",
          clientName: "Example Client",
          title: "Website delivery",
          status: "active",
          phase: "build",
          progressPercent: 70,
          milestoneCount: 4,
          openWorkItemCount: 3,
          blockedWorkItemCount: 1,
          linkedWorkOrderCount: 1,
          invoiceReadiness: "not_ready",
          readiness: "available",
          reviewRequired: false,
          clientVisible: true,
          updatedAt: "2026-09-04T11:59:00.000Z",
        } : null,
        reasons: [verified ? "Current exact persistent Operations Core records matched." : mode === "not_found" ? "No exact current persistent Operations Core record matched." : "commercial:commercial_read_model_query_failed"],
        providerReads: mode === "provider_unavailable" ? 4 : 6,
        providerWrites: 0,
        externalSends: 0,
        calendarChanges: 0,
        outsideEffects: 0,
      };
    },
  };
}

function base(ops: OperationsCoreRelationshipSnapshotPort, operationsRequired = true) {
  return {
    brain: brain(),
    operations: ops,
    operationsRequired,
    operationsIdentity: operationsRequired ? {
      workspaceId: "evavo",
      commercialClientId: CLIENT_ID,
      projectId: PROJECT_ID,
    } : null,
    cycle: {
      cycleId: "cycle-ops-context-1",
      observedAt: "2026-09-04T12:00:30.000Z",
      decisionAt: "2026-09-04T12:01:00.000Z",
      scenario: "general" as const,
      objective: "Answer the client about the current delivery status.",
      gmail: {
        threadId: "thread-ops-context-1",
        relationshipId: "relationship-ops-context-1",
        personId: "person-ops-context-1",
        messages: [{
          id: "m1",
          threadId: "thread-ops-context-1",
          sentAt: "2026-09-04T12:00:00.000Z",
          from: { name: "Client", address: "client@example.com" },
          to: [{ name: "Greg", address: "greg@evavo.com.au" }],
          subject: "Status",
          body: "Where is the website delivery up to?",
        }],
      },
      identity: {
        contract: "business_relationship_identity_resolver_v2" as const,
        status: "verified" as const,
        selected: {
          personId: "person-ops-context-1",
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
    },
    context: {
      identitySummary: "Client identity verified from current Gmail evidence.",
      communicationSummary: "Client asks for current delivery status.",
      evidenceItems: [
        {
          id: "identity-current",
          domain: "identity" as const,
          summary: "Exact identity verified.",
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
          sourceRefs: ["gmail:thread:thread-ops-context-1"],
        },
      ],
    },
  };
}

test("verified Operations Core project/commercial truth hydrates the canonical decision", async () => {
  const result = await runCanonicalRelationshipManagerCycleWithOperationsContext(base(operations("verified")));
  assert.equal(result.contract, "business_relationship_manager_canonical_operations_context_runtime_v1");
  assert.equal(result.operationsState, "verified");
  assert.ok(result.operationsEvidenceRef);
  assert.equal(result.brain.canonicalCycle.approvalGradeReady, true);
  assert.match(result.brain.canonicalCycle.decisionContext.context360.project ?? "", /70% progress/i);
  assert.match(result.brain.canonicalCycle.decisionContext.context360.commercial ?? "", /1 proposal/i);
  assert.ok(result.brain.canonicalCycle.decisionContext.evidenceRefs.includes(result.operationsEvidenceRef!));
  assert.ok(result.brain.canonicalCycle.decisionContext.evidenceRefs.includes(BRAIN_STATE_REF));
  assert.ok(!result.brain.canonicalCycle.decisionContext.evidenceRefs.includes(BRAIN_QUERY_REF));
});

test("exact Operations not_found remains unresolved when operational truth is required", async () => {
  const result = await runCanonicalRelationshipManagerCycleWithOperationsContext(base(operations("not_found")));
  assert.equal(result.operationsState, "not_found");
  assert.equal(result.brain.canonicalCycle.approvalGradeReady, false);
  assert.equal(result.brain.canonicalCycle.cycle.decision.disposition, "escalate");
  assert.ok(result.brain.canonicalCycle.decisionContext.sourceReadiness?.blockingDomains.includes("operations"));
});

test("Operations provider failure blocks approval-grade readiness", async () => {
  for (const mode of ["provider_unavailable", "transport_error"] as const) {
    const result = await runCanonicalRelationshipManagerCycleWithOperationsContext(base(operations(mode)));
    assert.equal(result.operationsState, "provider_unavailable");
    assert.equal(result.brain.canonicalCycle.approvalGradeReady, false);
    assert.ok(result.brain.canonicalCycle.cycle.decision.nextContextSources.includes("operations_core"));
  }
});

test("Operations provider is not queried when operational truth is explicitly not required", async () => {
  let reads = 0;
  const noRead: OperationsCoreRelationshipSnapshotPort = {
    contract: "business_operations_core_relationship_snapshot_port_v1",
    async read() { reads += 1; throw new Error("should not execute"); },
  };
  const result = await runCanonicalRelationshipManagerCycleWithOperationsContext(base(noRead, false));
  assert.equal(reads, 0);
  assert.equal(result.operationsState, "not_required");
  assert.equal(result.brain.canonicalCycle.approvalGradeReady, true);
});

test("caller cannot pre-assert Operations source readiness on the hydrated path", async () => {
  const current = base(operations("verified"));
  await assert.rejects(() => runCanonicalRelationshipManagerCycleWithOperationsContext({
    ...current,
    context: {
      ...current.context,
      sourceReadiness: [{
        domain: "operations", state: "verified", required: true,
        observedAt: OBSERVED_AT, sourceRefs: ["forged:operations"],
      }],
    },
  }), /CALLER_READINESS_FORBIDDEN/);
});
