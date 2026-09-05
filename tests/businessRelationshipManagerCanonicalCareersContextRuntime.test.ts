import assert from "node:assert/strict";
import test from "node:test";

import type { BrainMemoryContextPort } from "../src/core/businessBrainMemoryContextPort";
import type { CareersRoleTruthPort } from "../src/core/businessCareersRoleTruthPort";
import type { OperationsCoreRelationshipSnapshotPort } from "../src/core/businessOperationsCoreRelationshipSnapshotPort";
import { runCanonicalRelationshipManagerCycleWithCareersContext } from "../src/core/businessRelationshipManagerCanonicalCareersContextRuntime";

const ROLE_ID = "33333333-3333-4333-8333-333333333333";
const OBSERVED_AT = "2026-09-04T22:00:00.000Z";
const CAREERS_REF = `operations:careers-snapshot:${"b".repeat(64)}`;

function brain(): BrainMemoryContextPort {
  return {
    contract: "business_brain_memory_context_port_v1",
    async read(request) {
      return {
        contract: "business_brain_memory_context_port_v1",
        context: {
          protocol: "evavo-memory-fabric-v2",
          generatedAt: request.asOf!,
          asOf: request.asOf!,
          summary: "No durable EVAVO memory matched this context request.",
          records: [],
          omittedRecordCount: 0,
        },
        queryEvidenceRef: `brain:memory-context-query:${"a".repeat(64)}`,
        restrictedRecordsExcluded: 0,
      };
    },
  };
}

function operations(): OperationsCoreRelationshipSnapshotPort {
  return {
    contract: "business_operations_core_relationship_snapshot_port_v1",
    async read() { throw new Error("operations must not be called"); },
  };
}

function careers(mode: "open" | "closed" | "not_found" | "unavailable" | "transport_error"): CareersRoleTruthPort {
  return {
    contract: "business_careers_role_truth_port_v1",
    async read(request) {
      assert.equal(request.workspaceId, "evavo");
      assert.equal(request.targetRoleId, ROLE_ID);
      if (mode === "transport_error") throw new Error("CAREERS_ROLE_TRUTH_READ_UNAVAILABLE");
      if (mode === "unavailable") {
        return {
          contract: "evavo-relationship-manager-careers-snapshot-v1",
          state: "provider_unavailable",
          workspaceId: "evavo",
          targetRoleId: ROLE_ID,
          targetRoleKey: null,
          observedAt: OBSERVED_AT,
          evidenceRef: CAREERS_REF,
          roles: [],
          reasons: ["careers:careers_read_model_query_failed"],
          providerReads: 1,
          providerWrites: 0,
          externalPublications: 0,
          candidateMessages: 0,
          interviewCalendarChanges: 0,
          employmentCommitments: 0,
          outsideEffects: 0,
        };
      }
      const found = mode !== "not_found";
      return {
        contract: "evavo-relationship-manager-careers-snapshot-v1",
        state: found ? "verified" : "not_found",
        workspaceId: "evavo",
        targetRoleId: ROLE_ID,
        targetRoleKey: null,
        observedAt: OBSERVED_AT,
        evidenceRef: CAREERS_REF,
        roles: found ? [{
          id: ROLE_ID,
          roleKey: "graduate-designer",
          title: "Graduate Designer",
          state: mode === "open" ? "open" : "closed",
          authoritative: true,
          employmentType: "graduate",
          locationLabel: "Melbourne / remote",
          locationMode: "hybrid",
          summary: "Graduate design role.",
          applicationUrl: null,
          openedAt: "2026-09-01T00:00:00.000Z",
          closesAt: null,
          roleOwnerLabel: "EVAVO",
          reviewRequired: false,
          updatedAt: "2026-09-04T21:59:00.000Z",
          stateReason: "stored_state",
        }] : [],
        reasons: [found ? "Dedicated careers truth returned one role." : "No matching role."],
        providerReads: 1,
        providerWrites: 0,
        externalPublications: 0,
        candidateMessages: 0,
        interviewCalendarChanges: 0,
        employmentCommitments: 0,
        outsideEffects: 0,
      };
    },
  };
}

function base(careersPort: CareersRoleTruthPort) {
  return {
    brain: brain(),
    operations: operations(),
    operationsRequired: false,
    operationsIdentity: null,
    careers: careersPort,
    careersRequired: true,
    careersIdentity: { workspaceId: "evavo", targetRoleId: ROLE_ID },
    cycle: {
      cycleId: "cycle-careers-1",
      observedAt: "2026-09-04T22:00:30.000Z",
      decisionAt: "2026-09-04T22:01:00.000Z",
      scenario: "graduate_or_candidate" as const,
      objective: "Respond accurately to a graduate candidate asking whether a role exists.",
      gmail: {
        threadId: "thread-careers-1",
        relationshipId: "relationship-careers-1",
        personId: "person-careers-1",
        messages: [{
          id: "m1",
          threadId: "thread-careers-1",
          sentAt: "2026-09-04T22:00:00.000Z",
          from: { name: "Candidate", address: "candidate@example.com" },
          to: [{ name: "Greg", address: "greg@evavo.com.au" }],
          subject: "Graduate opportunity",
          body: "Are there any graduate roles open at EVAVO?",
        }],
      },
      identity: {
        contract: "business_relationship_identity_resolver_v2" as const,
        status: "verified" as const,
        selected: {
          personId: "person-careers-1",
          name: "Candidate",
          addresses: ["candidate@example.com"],
          evidence: [{ source: "gmail" as const, ref: "gmail:message:m1", confidence: 100 }],
        },
        confidence: 100,
        exactAddressMatch: true,
        reasons: ["Exact evidence-backed address match."],
        competingPersonIds: [],
      },
      channel: { currentChannel: "email" as const, canResolveInWriting: true },
      candidate: {
        relationshipId: "relationship-careers-1",
        personId: "person-careers-1",
        explicitRoleOpen: false,
        activeRecruitmentProcess: false,
        materialsSupplied: false,
        materialsActuallyReviewed: false,
        relevantSkillsEvidence: false,
        futureRelevanceEvidence: false,
        personalizedEffort: true,
        clearFitEvidence: false,
      },
      evidenceConfidence: 98,
    },
    context: {
      identitySummary: "Candidate identity verified.",
      communicationSummary: "Candidate asks whether a graduate role exists.",
      evidenceItems: [
        {
          id: "identity-current",
          domain: "identity" as const,
          summary: "Exact candidate identity verified.",
          status: "current" as const,
          authority: "authoritative" as const,
          observedAt: "2026-09-04T22:00:30.000Z",
          sourceRefs: ["gmail:message:m1"],
        },
        {
          id: "gmail-current",
          domain: "gmail" as const,
          summary: "Current Gmail thread read.",
          status: "current" as const,
          authority: "canonical" as const,
          observedAt: "2026-09-04T22:00:30.000Z",
          sourceRefs: ["gmail:thread:thread-careers-1"],
        },
      ],
    },
  };
}

test("verified open careers record derives active_process and binds its receipt", async () => {
  const result = await runCanonicalRelationshipManagerCycleWithCareersContext(base(careers("open")));
  assert.equal(result.contract, "business_relationship_manager_canonical_careers_context_runtime_v4");
  assert.equal(result.careersState, "verified");
  assert.equal(result.roleTruth?.status, "confirmed_open");
  assert.equal(result.roleTruth?.maySayRoleExists, true);
  assert.equal(result.applicationUrl, null);
  assert.equal(result.canonical.brain.canonicalCycle.cycle.decision.candidateStage, "active_process");
  assert.equal(result.candidateRoleAuthorityDerived, true);
  assert.equal(result.canonical.brain.canonicalCycle.approvalGradeReady, true);
  assert.match(result.canonical.brain.canonicalCycle.decisionContext.context360.careers ?? "", /Graduate Designer: open/);
  assert.ok(result.canonical.brain.canonicalCycle.decisionContext.evidenceRefs.includes(CAREERS_REF));
  assert.ok(result.canonical.brain.canonicalCycle.cycle.decision.evidenceIds.includes(CAREERS_REF));
});

test("closed role never derives active_process or a global not-hiring claim", async () => {
  const result = await runCanonicalRelationshipManagerCycleWithCareersContext(base(careers("closed")));
  assert.equal(result.roleTruth?.status, "confirmed_not_open");
  assert.equal(result.roleTruth?.maySayNotHiring, false);
  assert.equal(result.applicationUrl, null);
  assert.notEqual(result.canonical.brain.canonicalCycle.cycle.decision.candidateStage, "active_process");
  assert.equal(result.candidateRoleAuthorityDerived, true);
  assert.match(result.roleTruth?.safeExternalWording ?? "", /isn't currently open/i);
});

test("successful no-role lookup remains approval-safe evidence of no confirmed opening", async () => {
  const result = await runCanonicalRelationshipManagerCycleWithCareersContext(base(careers("not_found")));
  assert.equal(result.careersState, "not_found");
  assert.equal(result.roleTruth?.status, "no_confirmed_open_role");
  assert.equal(result.roleTruth?.maySayNotHiring, false);
  assert.equal(result.applicationUrl, null);
  assert.notEqual(result.canonical.brain.canonicalCycle.cycle.decision.candidateStage, "active_process");
  assert.equal(result.candidateRoleAuthorityDerived, true);
  assert.equal(result.canonical.brain.canonicalCycle.approvalGradeReady, true);
  assert.match(result.canonical.brain.canonicalCycle.decisionContext.context360.careers ?? "", /does not mean EVAVO is not hiring generally/i);
  assert.ok(result.canonical.brain.canonicalCycle.decisionContext.evidenceRefs.includes(CAREERS_REF));
});

test("careers provider outage blocks approval instead of inferring hiring status", async () => {
  const result = await runCanonicalRelationshipManagerCycleWithCareersContext(base(careers("transport_error")));
  assert.equal(result.careersState, "provider_unavailable");
  assert.equal(result.roleTruth, null);
  assert.equal(result.applicationUrl, null);
  assert.equal(result.candidateRoleAuthorityDerived, true);
  assert.notEqual(result.canonical.brain.canonicalCycle.cycle.decision.candidateStage, "active_process");
  assert.equal(result.canonical.brain.canonicalCycle.approvalGradeReady, false);
  assert.ok(result.canonical.brain.canonicalCycle.decisionContext.sourceReadiness?.blockingDomains.includes("careers"));
  assert.ok(!result.canonical.brain.canonicalCycle.decisionContext.context360.currentEvidence.some((item) => item.domain === "careers"));
});
