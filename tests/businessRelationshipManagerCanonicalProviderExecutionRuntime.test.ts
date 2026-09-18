import assert from "node:assert/strict";
import test from "node:test";

import type { BrainMemoryContextPort } from "../src/core/businessBrainMemoryContextPort";
import type { OperationsCoreRelationshipSnapshotPort } from "../src/core/businessOperationsCoreRelationshipSnapshotPort";
import type {
  OperationsCoreProviderExecutionSnapshot,
  OperationsCoreProviderExecutionSnapshotPort,
} from "../src/core/businessOperationsCoreProviderExecutionSnapshotPort";
import { runCanonicalRelationshipManagerCycleWithProviderExecution } from "../src/core/businessRelationshipManagerCanonicalProviderExecutionRuntime";

const OBLIGATION_ID = "obl-naomi-domain";
const HANDOFF_ID = "relationship-provider:task-naomi-vercel:ensure-project";
const DECISION_AT = "2026-09-19T01:01:00.000Z";

function brain(): BrainMemoryContextPort {
  return {
    contract: "business_brain_memory_context_port_v2",
    async read(request) {
      return {
        contract: "business_brain_memory_context_port_v2",
        context: {
          protocol: "evavo-memory-fabric-v2",
          generatedAt: "2026-09-19T01:00:45.000Z",
          asOf: request.asOf!,
          summary: "No prior durable memory matched.",
          records: [],
          omittedRecordCount: 0,
        },
        stateEvidenceRef: `brain:memory-context-state:${"a".repeat(64)}`,
        queryEvidenceRef: `brain:memory-context-query:${"b".repeat(64)}`,
        restrictedRecordsExcluded: 0,
      };
    },
  };
}

function operations(): OperationsCoreRelationshipSnapshotPort {
  return {
    contract: "business_operations_core_relationship_snapshot_port_v1",
    async read() {
      throw new Error("operations relationship read should not execute when operationsRequired=false");
    },
  };
}

function providerSnapshot(status: "queued" | "executing" | "succeeded"): OperationsCoreProviderExecutionSnapshot {
  const executing = status === "executing" || status === "succeeded";
  const succeeded = status === "succeeded";
  return {
    contract: "evavo-relationship-manager-provider-execution-snapshot-v1",
    state: "verified",
    workspaceId: "evavo",
    handoffId: HANDOFF_ID,
    observedAt: "2026-09-19T01:00:30.000Z",
    evidenceRef: `operations:provider-execution:${"c".repeat(64)}`,
    projection: {
      contract: "evavo_provider_execution_truth_v1",
      handoffId: HANDOFF_ID,
      providerKey: "vercel",
      action: "project.ensure",
      canonicalExecutionOwner: "EVAVO-STUDIO/evavo-agent-infrastructure",
      route: "vercel-provider-cloud-mcp",
      requestId: "request:naomi-vercel",
      jobId: "job:naomi-vercel",
      idempotencyKey: "naomi:vercel:project.ensure",
      status,
      observedAt: "2026-09-19T01:00:20.000Z",
      admissionEvidenceIds: executing ? ["admission:vercel:1"] : [],
      executionEvidenceIds: executing ? ["execution:vercel:1"] : [],
      postconditionEvidenceIds: succeeded ? ["vercel:project:readback:1"] : [],
      replaySafetyEvidenceIds: [],
      executionAttempted: executing,
      postconditionVerified: succeeded,
      providerReadbackVerified: succeeded,
      automaticReplayAllowed: false,
      blocker: null,
    },
    assessment: {
      contract: "evavo_provider_execution_truth_v1",
      handoffId: HANDOFF_ID,
      status,
      current: true,
      queuedOnly: status === "queued",
      activeExecutionProven: status === "executing",
      completionProven: succeeded,
      requiresReconciliation: false,
      automaticReplayAllowed: false,
      blocker: status === "queued" ? "provider_execution_not_admitted" : null,
      evidenceIds: executing
        ? succeeded
          ? ["admission:vercel:1", "execution:vercel:1", "vercel:project:readback:1"]
          : ["admission:vercel:1", "execution:vercel:1"]
        : [],
    },
    providerReads: 1,
    providerWrites: 0,
    outsideEffects: 0,
  };
}

function provider(mode: "queued" | "executing" | "succeeded" | "not_found"): OperationsCoreProviderExecutionSnapshotPort {
  return {
    contract: "business_operations_core_provider_execution_snapshot_port_v1",
    async read(input) {
      assert.equal(input.workspaceId, "evavo");
      assert.equal(input.handoffId, HANDOFF_ID);
      if (mode === "not_found") {
        return {
          contract: "evavo-relationship-manager-provider-execution-snapshot-v1",
          state: "not_found",
          workspaceId: "evavo",
          handoffId: HANDOFF_ID,
          observedAt: "2026-09-19T01:00:30.000Z",
          evidenceRef: `operations:provider-execution:${"d".repeat(64)}`,
          projection: null,
          assessment: null,
          reason: "No exact provider-execution handoff matched the supplied identity.",
          providerReads: 1,
          providerWrites: 0,
          outsideEffects: 0,
        };
      }
      return providerSnapshot(mode);
    },
  };
}

function input(mode: "queued" | "executing" | "succeeded" | "not_found") {
  return {
    brain: brain(),
    operations: operations(),
    operationsRequired: false,
    operationsIdentity: { workspaceId: "evavo" },
    providerExecution: provider(mode),
    providerExecutionBindings: [{ obligationId: OBLIGATION_ID, handoffId: HANDOFF_ID }],
    cycle: {
      cycleId: "cycle-naomi-provider-1",
      observedAt: "2026-09-19T01:00:30.000Z",
      decisionAt: DECISION_AT,
      scenario: "general" as const,
      objective: "Give Naomi an accurate status update about the birthday domain.",
      gmail: {
        threadId: "thread-naomi-provider",
        relationshipId: "relationship-naomi",
        personId: "person-naomi",
        previousObligations: [{
          id: OBLIGATION_ID,
          relationshipId: "relationship-naomi",
          personId: "person-naomi",
          owner: "evavo" as const,
          statement: "Configure the canonical Vercel project and public domains.",
          status: "open" as const,
          importance: "high" as const,
          createdAt: "2026-09-18T20:00:00.000Z",
          sourceEvidenceIds: ["operator:naomi-domain-obligation"],
          satisfactionEvidenceIds: [],
          stateEvidenceIds: [],
        }],
        messages: [{
          id: "m-naomi-provider",
          threadId: "thread-naomi-provider",
          sentAt: "2026-09-19T01:00:00.000Z",
          from: { name: "Naomi", address: "naomi@example.com" },
          to: [{ name: "Greg", address: "greg@example.com" }],
          subject: "Birthday site",
          body: "Is the birthday domain ready yet?",
        }],
      },
      identity: {
        contract: "business_relationship_identity_resolver_v2" as const,
        status: "verified" as const,
        selected: {
          personId: "person-naomi",
          name: "Naomi",
          addresses: ["naomi@example.com"],
          evidence: [{ source: "gmail" as const, ref: "gmail:message:m-naomi-provider", confidence: 100 }],
        },
        confidence: 100,
        exactAddressMatch: true,
        reasons: ["Exact evidence-backed address match."],
        competingPersonIds: [],
      },
      channel: { currentChannel: "email" as const, canResolveInWriting: true },
      evidenceConfidence: 99,
    },
    context: {
      identitySummary: "Naomi identity verified from the current Gmail message.",
      communicationSummary: "Naomi asks whether the birthday domain is ready.",
      evidenceItems: [
        {
          id: "identity-naomi-current",
          domain: "identity" as const,
          summary: "Naomi identity verified.",
          status: "current" as const,
          authority: "authoritative" as const,
          observedAt: "2026-09-19T01:00:30.000Z",
          sourceRefs: ["gmail:message:m-naomi-provider"],
        },
        {
          id: "gmail-naomi-current",
          domain: "gmail" as const,
          summary: "Current Naomi status request read.",
          status: "current" as const,
          authority: "canonical" as const,
          observedAt: "2026-09-19T01:00:30.000Z",
          sourceRefs: ["gmail:message:m-naomi-provider"],
        },
      ],
    },
  };
}

test("queued provider handoff is bound to the obligation but is not active execution or completion", async () => {
  const result = await runCanonicalRelationshipManagerCycleWithProviderExecution(input("queued"));
  assert.equal(result.providerExecutionBindings[0]?.state, "verified");
  assert.equal(result.providerExecutionBindings[0]?.executionStatus, "queued");
  const assessment = result.operations.brain.canonicalCycle.cycle.decision.obligationExecutionAssessments[0];
  assert.equal(assessment?.obligationId, OBLIGATION_ID);
  assert.equal(assessment?.mayClaimActiveExecution, false);
  assert.equal(assessment?.mayClaimCompletion, false);
  assert.ok(result.operations.brain.canonicalCycle.cycle.decision.prohibitedImplications.some((item) => /currently being completed/i.test(item)));
  assert.ok(result.operations.brain.canonicalCycle.cycle.decision.prohibitedImplications.some((item) => /done, ready or complete/i.test(item)));
});

test("fresh executing provider evidence may support progress but not completion", async () => {
  const result = await runCanonicalRelationshipManagerCycleWithProviderExecution(input("executing"));
  const assessment = result.operations.brain.canonicalCycle.cycle.decision.obligationExecutionAssessments[0];
  assert.equal(assessment?.mayClaimActiveExecution, true);
  assert.equal(assessment?.mayClaimCompletion, false);
});

test("provider-readback success may support completion", async () => {
  const result = await runCanonicalRelationshipManagerCycleWithProviderExecution(input("succeeded"));
  const assessment = result.operations.brain.canonicalCycle.cycle.decision.obligationExecutionAssessments[0];
  assert.equal(assessment?.mayClaimCompletion, true);
  assert.ok(!result.operations.brain.canonicalCycle.cycle.decision.prohibitedImplications.some((item) => /done, ready or complete/i.test(item)));
});

test("exact not_found handoff becomes unrouted evidence rather than an invented active executor", async () => {
  const result = await runCanonicalRelationshipManagerCycleWithProviderExecution(input("not_found"));
  assert.equal(result.providerExecutionBindings[0]?.state, "not_found");
  assert.equal(result.providerExecutionBindings[0]?.executionStatus, "unrouted");
  assert.equal(result.providerExecutionBindings[0]?.blocker, "operations_provider_execution_handoff_not_found");
  const assessment = result.operations.brain.canonicalCycle.cycle.decision.obligationExecutionAssessments[0];
  assert.equal(assessment?.mayClaimActiveExecution, false);
  assert.equal(assessment?.mayClaimCompletion, false);
});

test("binding an execution handoff to a non-current obligation fails closed", async () => {
  const current = input("queued");
  await assert.rejects(
    () => runCanonicalRelationshipManagerCycleWithProviderExecution({
      ...current,
      providerExecutionBindings: [{ obligationId: "obl-not-current", handoffId: HANDOFF_ID }],
    }),
    /OBLIGATION_NOT_IN_CURRENT_PROJECTION/,
  );
});
