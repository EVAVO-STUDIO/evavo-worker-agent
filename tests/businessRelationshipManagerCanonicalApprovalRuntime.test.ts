import assert from "node:assert/strict";
import test from "node:test";

import { prepareCanonicalRelationshipManagerCommunicationForApproval } from "../src/core/businessRelationshipManagerCanonicalApprovalRuntime";
import { runCanonicalRelationshipManagerCommunicationCycle } from "../src/core/businessRelationshipManagerCanonicalRuntime";

function canonicalCycle() {
  return runCanonicalRelationshipManagerCommunicationCycle({
    cycle: {
      cycleId: "canonical-approval-cycle-1",
      observedAt: "2026-09-04T01:00:30Z",
      decisionAt: "2026-09-04T01:01:00Z",
      scenario: "general",
      objective: "Answer the current client status question.",
      gmail: {
        threadId: "thread-canonical-approval-1",
        relationshipId: "relationship-canonical-approval-1",
        personId: "person-canonical-approval-1",
        messages: [{
          id: "message-canonical-approval-1",
          threadId: "thread-canonical-approval-1",
          sentAt: "2026-09-04T01:00:00Z",
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
          personId: "person-canonical-approval-1",
          name: "Client",
          addresses: ["client@example.com"],
          evidence: [{ source: "gmail", ref: "gmail:message:message-canonical-approval-1", confidence: 100 }],
        },
        confidence: 100,
        exactAddressMatch: true,
        reasons: ["Exact evidence-backed email match."],
        competingPersonIds: [],
      },
      channel: { currentChannel: "email", canResolveInWriting: true },
      evidenceConfidence: 98,
      additionalEvidenceIds: ["operations:status:canonical-approval-1"],
    },
    context: {
      identitySummary: "Client <client@example.com> is verified from the active Gmail thread.",
      communicationSummary: "The client has one live status question.",
      evidenceItems: [
        {
          id: "identity-canonical-approval",
          domain: "identity",
          summary: "Exact client identity verified.",
          status: "current",
          authority: "authoritative",
          observedAt: "2026-09-04T01:00:30Z",
          sourceRefs: ["gmail:message:message-canonical-approval-1"],
        },
        {
          id: "gmail-canonical-approval",
          domain: "gmail",
          summary: "Current Gmail thread read.",
          status: "current",
          authority: "canonical",
          observedAt: "2026-09-04T01:00:30Z",
          sourceRefs: ["gmail:thread:thread-canonical-approval-1"],
        },
      ],
      sourceReadiness: [
        {
          domain: "gmail",
          state: "verified",
          required: true,
          observedAt: "2026-09-04T01:00:30Z",
          sourceRefs: ["gmail:thread:thread-canonical-approval-1"],
        },
      ],
    },
  });
}

function memoryPersistence(cycleId: string) {
  return {
    contract: "business_relationship_manager_memory_persistence_v1" as const,
    cycleId,
    durable: true,
    materialObservations: 2,
    durableObservations: 2,
    skippedObservations: 0,
    rejectedObservations: 0,
    recordIds: ["memory:canonical-message", "memory:canonical-decision"],
    receipts: [],
    blockers: [],
    externalEffectPerformed: false as const,
  };
}

function approvalInputs(canonical = canonicalCycle()) {
  const decision = canonical.cycle.decision;
  const staff = canonical.decisionContext.staffBrief;
  const handoff = {
    schema: "evavo-writing/staff-communication-handoff-v2" as const,
    version: 2 as const,
    protocol: "evavo-staff-communication-handoff-v2" as const,
    handoff: {
      schema: "evavo-writing/staff-communication-handoff" as const,
      version: 1 as const,
      protocol: "evavo-staff-communication-handoff-v1" as const,
      relationshipId: staff.relationshipId,
      handoffId: "handoff-canonical-approval-1",
    },
    staffContext: {
      relationshipId: staff.relationshipId,
      generatedAt: canonical.decisionContext.generatedAt,
      decisionPackageId: decision.packageId,
      decisionOrigin: decision.origin,
      relationshipCycleId: canonical.cycle.cycleId,
      approvalGradeReady: true as const,
      blockingVerificationOutstanding: false as const,
      whatChanged: staff.whatChanged,
      materialChanges: staff.materialChanges,
      priorities: staff.priorities,
      mustVerify: staff.mustVerify,
      mustNotAssume: staff.mustNotAssume,
      obligationsToRespect: staff.obligationsToRespect,
      priorDecisionsToRespect: staff.priorDecisionsToRespect,
      relationshipRisks: staff.relationshipRisks,
      staleDomains: staff.staleDomains,
      nextContextSources: canonical.decisionContext.resolutionPlan.orderedSources,
      sourceRefs: staff.sourceRefs,
    },
  };
  const writingEnvelope = {
    contract: "evavo-writing/staff-communication-writing-envelope-v2" as const,
    writingRequest: { requestId: "writing-request-canonical-approval-1" },
    provenance: {
      relationshipId: staff.relationshipId,
      handoffId: handoff.handoff.handoffId,
      decisionPackageId: decision.packageId,
      decisionOrigin: decision.origin,
      relationshipCycleId: canonical.cycle.cycleId,
      staffContextGeneratedAt: canonical.decisionContext.generatedAt,
      sourceRefs: staff.sourceRefs,
    },
  };
  const draftPackage = {
    schema: "evavo-writing/draft-package" as const,
    version: 1 as const,
    requestId: writingEnvelope.writingRequest.requestId,
    packageId: "writing-package-canonical-approval-1",
    status: "ready" as const,
    recommendedCandidateId: "draft-canonical-approval-1",
    candidates: [{
      id: "draft-canonical-approval-1",
      body: "Hi,\n\nThanks for checking in. Here is the current status.\n\nKind regards,\nGreg",
      warnings: [],
      unresolvedAssumptionIds: [],
    }],
    missingInformation: [],
    warnings: [],
  };
  return {
    candidateId: "approval-candidate-canonical-1",
    createdAt: "2026-09-04T01:03:00Z",
    canonicalCycle: canonical,
    memoryPersistence: memoryPersistence(canonical.cycle.cycleId),
    handoff,
    writingEnvelope,
    draftPackage,
    senderKey: "greg" as const,
    mailboxKey: "greg" as const,
    sender: "greg@evavo.com.au",
    to: ["client@example.com"],
    threadId: canonical.cycle.projection.threadId,
    replyMessageId: "message-canonical-approval-1",
    canonicalSubject: "Re: Status",
  };
}

test("canonical approval path creates only a persistence-ready immutable candidate", () => {
  const canonical = canonicalCycle();
  const result = prepareCanonicalRelationshipManagerCommunicationForApproval(approvalInputs(canonical));
  assert.equal(result.contract, "business_relationship_manager_canonical_approval_runtime_v2");
  assert.equal(result.canonicalCycleId, canonical.cycle.cycleId);
  assert.equal(result.externalEffectPerformed, false);
  assert.equal(result.preparation.readyForCandidatePersistence, true);
  assert.equal(result.preparation.readyForHumanApproval, false);
  assert.equal(result.preparation.humanApprovalRecorded, false);
  assert.equal(result.preparation.externalExecutionAllowed, false);
  assert.equal(result.preparation.approvalCandidate.relationshipCycleId, canonical.cycle.cycleId);
  assert.equal(result.preparation.approvalCandidate.decisionPackageId, canonical.cycle.decision.packageId);
});

test("canonical approval path rejects unresolved source context before candidate creation", () => {
  const canonical = canonicalCycle();
  const unsafe = {
    ...canonical,
    approvalGradeReady: false,
    decisionContext: { ...canonical.decisionContext, approvalGradeReady: false },
    cycle: {
      ...canonical.cycle,
      decision: { ...canonical.cycle.decision, approvalGradeReady: false },
    },
  };
  assert.throws(() => prepareCanonicalRelationshipManagerCommunicationForApproval(
    approvalInputs(unsafe as typeof canonical),
  ), /CONTEXT_NOT_READY/);
});
