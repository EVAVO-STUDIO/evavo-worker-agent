import assert from "node:assert/strict";
import test from "node:test";

import { buildCommunicationDecisionPackage } from "../src/core/businessCommunicationDecisionPackage";
import { finalizeStaffCommunicationApproval } from "../src/core/businessStaffCommunicationApprovalFinalizer";
import { prepareStaffCommunicationApprovalCandidate } from "../src/core/businessStaffCommunicationApprovalCandidate";

function decision() {
  return buildCommunicationDecisionPackage({
    packageId: "relationship-cycle:cycle-approval-1",
    origin: "relationship_manager_cycle",
    relationshipCycleId: "cycle-approval-1",
    scenario: "general",
    objective: "Answer the client's question accurately.",
    thread: {
      threadId: "thread-1",
      previousState: [],
      latestObservedState: [{
        id: "question-1",
        kind: "question",
        statement: "Can you confirm the current status?",
        status: "open",
        owner: "evavo",
        sourceEvidenceIds: ["gmail:m1"],
      }],
    },
    obligations: [],
    channel: { currentChannel: "email", canResolveInWriting: true },
    evidenceIds: ["gmail:m1"],
    evidenceConfidence: 98,
    decisionAt: "2026-09-04T01:01:00Z",
  });
}

function handoff() {
  const current = decision();
  return {
    schema: "evavo-writing/staff-communication-handoff-v2" as const,
    version: 2 as const,
    protocol: "evavo-staff-communication-handoff-v2" as const,
    handoff: {
      schema: "evavo-writing/staff-communication-handoff" as const,
      version: 1 as const,
      protocol: "evavo-staff-communication-handoff-v1" as const,
      relationshipId: "relationship-1",
      handoffId: "handoff-1",
    },
    staffContext: {
      relationshipId: "relationship-1",
      generatedAt: "2026-09-04T01:02:00Z",
      decisionPackageId: current.packageId,
      decisionOrigin: current.origin,
      relationshipCycleId: current.relationshipCycleId ?? undefined,
      approvalGradeReady: true as const,
      blockingVerificationOutstanding: false as const,
      whatChanged: "The client asked for the current status.",
      materialChanges: ["New client question."],
      priorities: ["Answer the current question directly."],
      mustVerify: [],
      mustNotAssume: ["Do not invent project progress."],
      obligationsToRespect: [],
      priorDecisionsToRespect: [],
      relationshipRisks: [],
      staleDomains: [],
      nextContextSources: [],
      sourceRefs: ["gmail:m1"],
    },
  };
}

function writingEnvelope() {
  const current = handoff();
  return {
    contract: "evavo-writing/staff-communication-writing-envelope-v2" as const,
    writingRequest: { requestId: "writing-request-1" },
    provenance: {
      relationshipId: "relationship-1",
      handoffId: "handoff-1",
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
    requestId: "writing-request-1",
    packageId: "writing-package-1",
    status: "ready" as const,
    recommendedCandidateId: "draft-1",
    candidates: [
      {
        id: "draft-1",
        subject: "Re: Current status",
        body: "Hi Client,\n\nThanks for checking in. Here is the current status.\n\nKind regards,\nGreg",
        warnings: [],
        unresolvedAssumptionIds: [],
      },
      {
        id: "draft-2",
        subject: "Re: Current status",
        body: "Hi Client,\n\nThanks for your note. I can confirm the current status below.\n\nKind regards,\nGreg",
        warnings: [],
        unresolvedAssumptionIds: [],
      },
    ],
    missingInformation: [],
    warnings: [],
  };
}

function persistence() {
  return {
    contract: "business_relationship_manager_memory_persistence_v1" as const,
    cycleId: "cycle-approval-1",
    durable: true,
    materialObservations: 2,
    durableObservations: 2,
    skippedObservations: 0,
    rejectedObservations: 0,
    recordIds: ["memory:1", "memory:2"],
    receipts: [],
    blockers: [],
    externalEffectPerformed: false as const,
  };
}

function candidate() {
  return prepareStaffCommunicationApprovalCandidate({
    candidateId: "approval-candidate-1",
    createdAt: "2026-09-04T01:03:00Z",
    handoff: handoff(),
    decisionPackage: decision(),
    relationshipManagerMemoryPersistence: persistence(),
    writingEnvelope: writingEnvelope(),
    draftPackage: draftPackage(),
    senderKey: "greg",
    mailboxKey: "greg",
    sender: "greg@evavo.com.au",
    to: ["client@example.com"],
    threadId: "thread-1",
    replyMessageId: "m1",
    canonicalSubject: "Re: Current status",
    evidenceIds: ["operations:project-status"],
  });
}

test("prepares immutable approval material without creating an approval or external effect", () => {
  const result = candidate();
  assert.equal(result.readyForHumanApproval, true);
  assert.equal(result.externalEffectPerformed, false);
  assert.equal(result.decisionOrigin, "relationship_manager_cycle");
  assert.equal(result.relationshipCycleId, "cycle-approval-1");
  assert.equal(result.writingRequestId, "writing-request-1");
  assert.equal(result.material.body, draftPackage().candidates[0]!.body);
  assert.match(result.materialSha256, /^[a-f0-9]{64}$/);
  assert.ok(result.evidenceIds.includes("memory:1"));
});

test("canonical Relationship Manager approval candidate requires durable matching memory", () => {
  assert.throws(() => prepareStaffCommunicationApprovalCandidate({
    candidateId: "approval-candidate-2",
    createdAt: "2026-09-04T01:03:00Z",
    handoff: handoff(),
    decisionPackage: decision(),
    relationshipManagerMemoryPersistence: { ...persistence(), durable: false },
    writingEnvelope: writingEnvelope(),
    draftPackage: draftPackage(),
    senderKey: "greg",
    mailboxKey: "greg",
    sender: "greg@evavo.com.au",
    to: ["client@example.com"],
    threadId: "thread-1",
    canonicalSubject: "Re: Current status",
    evidenceIds: ["gmail:m1"],
  }), /MEMORY_NOT_DURABLE/);
});

test("pre-approval candidate rejects a sender identity mismatch", () => {
  assert.throws(() => prepareStaffCommunicationApprovalCandidate({
    candidateId: "approval-candidate-3",
    createdAt: "2026-09-04T01:03:00Z",
    handoff: handoff(),
    decisionPackage: decision(),
    relationshipManagerMemoryPersistence: persistence(),
    writingEnvelope: writingEnvelope(),
    draftPackage: draftPackage(),
    senderKey: "greg",
    mailboxKey: "greg",
    sender: "eva@evavo.com.au",
    to: ["client@example.com"],
    threadId: "thread-1",
    canonicalSubject: "Re: Current status",
    evidenceIds: ["gmail:m1"],
  }), /SENDER_IDENTITY_MISMATCH/);
});

test("human approval finalizer creates the exact send envelope without sending", () => {
  const prepared = candidate();
  const result = finalizeStaffCommunicationApproval({
    envelopeId: "send-approval-1",
    candidate: prepared,
    operatorApprovalReceipt: {
      contract: "business_communication_operator_approval_v1",
      approvalId: "operator-approval-1",
      authority: "human_operator",
      approverId: "greg",
      approvedAt: "2026-09-04T01:04:00Z",
      expiresAt: "2026-09-04T02:04:00Z",
      materialSha256: prepared.materialSha256,
      decisionPackageId: prepared.decisionPackageId,
      senderKey: prepared.senderKey,
      mailboxKey: prepared.mailboxKey,
      evidenceRefs: ["operator-approval:1"],
      sourceSystem: "operator_approval",
    },
  });

  assert.equal(result.externalEffectPerformed, false);
  assert.equal(result.approval.materialSha256, prepared.materialSha256);
  assert.equal(result.approval.material.body, prepared.material.body);
  assert.equal(result.approval.approvalBinding?.writingProvenance?.writingRequestId, "writing-request-1");
});

test("human approval finalizer refuses approval for different material", () => {
  const prepared = candidate();
  assert.throws(() => finalizeStaffCommunicationApproval({
    envelopeId: "send-approval-2",
    candidate: prepared,
    operatorApprovalReceipt: {
      contract: "business_communication_operator_approval_v1",
      approvalId: "operator-approval-2",
      authority: "human_operator",
      approverId: "greg",
      approvedAt: "2026-09-04T01:04:00Z",
      expiresAt: "2026-09-04T02:04:00Z",
      materialSha256: "f".repeat(64),
      decisionPackageId: prepared.decisionPackageId,
      senderKey: prepared.senderKey,
      mailboxKey: prepared.mailboxKey,
      evidenceRefs: ["operator-approval:2"],
      sourceSystem: "operator_approval",
    },
  }), /MATERIAL_MISMATCH/);
});
