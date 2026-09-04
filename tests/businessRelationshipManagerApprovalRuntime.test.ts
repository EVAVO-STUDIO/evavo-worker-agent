import assert from "node:assert/strict";
import test from "node:test";

import { prepareRelationshipManagerCommunicationForApproval } from "../src/core/businessRelationshipManagerApprovalRuntime";
import { runRelationshipManagerCommunicationCycle } from "../src/core/businessRelationshipManagerRuntime";

function cycle() {
  return runRelationshipManagerCommunicationCycle({
    cycleId: "cycle-prepare-1",
    observedAt: "2026-09-04T01:00:30Z",
    decisionAt: "2026-09-04T01:01:00Z",
    scenario: "general",
    objective: "Answer the client status question.",
    gmail: {
      threadId: "thread-prepare-1",
      relationshipId: "relationship-prepare-1",
      personId: "person-prepare-1",
      messages: [{
        id: "m1",
        threadId: "thread-prepare-1",
        sentAt: "2026-09-04T01:00:00Z",
        from: { name: "Client", address: "client@example.com" },
        to: [{ name: "Greg", address: "greg@evavo.com.au" }],
        subject: "Project status",
        body: "Could you please confirm the current status?",
      }],
    },
    identity: {
      contract: "business_relationship_identity_resolver_v1",
      status: "verified",
      selected: {
        personId: "person-prepare-1",
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
    evidenceConfidence: 98,
    additionalEvidenceIds: ["operations:project-status"],
  });
}

function persistence() {
  return {
    contract: "business_relationship_manager_memory_persistence_v1" as const,
    cycleId: "cycle-prepare-1",
    durable: true,
    materialObservations: 3,
    durableObservations: 3,
    skippedObservations: 0,
    rejectedObservations: 0,
    recordIds: ["memory:message", "memory:obligation", "memory:decision"],
    receipts: [],
    blockers: [],
    externalEffectPerformed: false as const,
  };
}

function handoff() {
  const current = cycle();
  return {
    schema: "evavo-writing/staff-communication-handoff-v2" as const,
    version: 2 as const,
    protocol: "evavo-staff-communication-handoff-v2" as const,
    handoff: {
      schema: "evavo-writing/staff-communication-handoff" as const,
      version: 1 as const,
      protocol: "evavo-staff-communication-handoff-v1" as const,
      relationshipId: "relationship-prepare-1",
      handoffId: "handoff-prepare-1",
    },
    staffContext: {
      relationshipId: "relationship-prepare-1",
      generatedAt: "2026-09-04T01:02:00Z",
      decisionPackageId: current.decision.packageId,
      decisionOrigin: current.decision.origin,
      relationshipCycleId: current.cycleId,
      approvalGradeReady: true as const,
      blockingVerificationOutstanding: false as const,
      whatChanged: "The client asked for current project status.",
      materialChanges: ["New client question."],
      priorities: ["Answer the current question."],
      mustVerify: [],
      mustNotAssume: ["Do not invent progress."],
      obligationsToRespect: [],
      priorDecisionsToRespect: [],
      relationshipRisks: [],
      staleDomains: [],
      nextContextSources: [],
      sourceRefs: [...current.decision.evidenceIds],
    },
  };
}

function writingEnvelope() {
  const current = handoff();
  return {
    contract: "evavo-writing/staff-communication-writing-envelope-v2" as const,
    writingRequest: { requestId: "writing-request-prepare-1" },
    provenance: {
      relationshipId: current.staffContext.relationshipId,
      handoffId: current.handoff.handoffId,
      decisionPackageId: current.staffContext.decisionPackageId,
      decisionOrigin: current.staffContext.decisionOrigin,
      relationshipCycleId: current.staffContext.relationshipCycleId,
      staffContextGeneratedAt: current.staffContext.generatedAt,
      sourceRefs: current.staffContext.sourceRefs,
    },
  };
}

function draftPackage() {
  return {
    schema: "evavo-writing/draft-package" as const,
    version: 1 as const,
    requestId: "writing-request-prepare-1",
    packageId: "writing-package-prepare-1",
    status: "ready" as const,
    recommendedCandidateId: "draft-prepare-1",
    candidates: [{
      id: "draft-prepare-1",
      body: "Hi Client,\n\nThanks for checking in. Here is the current status.\n\nKind regards,\nGreg",
      warnings: [],
      unresolvedAssumptionIds: [],
    }],
    missingInformation: [],
    warnings: [],
  };
}

function prepare(overrides: Record<string, unknown> = {}) {
  return prepareRelationshipManagerCommunicationForApproval({
    candidateId: "approval-candidate-prepare-1",
    createdAt: "2026-09-04T01:03:00Z",
    cycle: cycle(),
    memoryPersistence: persistence(),
    handoff: handoff(),
    writingEnvelope: writingEnvelope(),
    draftPackage: draftPackage(),
    senderKey: "greg",
    mailboxKey: "greg",
    sender: "greg@evavo.com.au",
    to: ["client@example.com"],
    threadId: "thread-prepare-1",
    replyMessageId: "m1",
    canonicalSubject: "Re: Project status",
    ...overrides,
  });
}

test("canonical approval preparation stops before human approval and external execution", () => {
  const result = prepare();
  assert.equal(result.readyForHumanApproval, true);
  assert.equal(result.humanApprovalRecorded, false);
  assert.equal(result.externalExecutionAllowed, false);
  assert.equal(result.externalEffectPerformed, false);
  assert.equal(result.cycleId, "cycle-prepare-1");
  assert.equal(result.approvalCandidate.relationshipCycleId, "cycle-prepare-1");
});

test("approval preparation rejects a routing thread that does not match the canonical cycle", () => {
  assert.throws(() => prepare({ threadId: "thread-other" }), /THREAD_MISMATCH/);
});

test("approval preparation rejects durable memory from a different relationship cycle", () => {
  assert.throws(() => prepare({ memoryPersistence: { ...persistence(), cycleId: "cycle-other" } }), /MEMORY_CYCLE_MISMATCH/);
});

test("approval preparation rejects a handoff that belongs to another relationship", () => {
  const wrongHandoff = handoff();
  const crossRelationship = {
    ...wrongHandoff,
    handoff: { ...wrongHandoff.handoff, relationshipId: "relationship-other" },
    staffContext: { ...wrongHandoff.staffContext, relationshipId: "relationship-other" },
  };
  const wrongWritingEnvelope = {
    ...writingEnvelope(),
    provenance: { ...writingEnvelope().provenance, relationshipId: "relationship-other" },
  };
  assert.throws(() => prepare({
    handoff: crossRelationship,
    writingEnvelope: wrongWritingEnvelope,
  }), /RELATIONSHIP_MISMATCH/);
});
