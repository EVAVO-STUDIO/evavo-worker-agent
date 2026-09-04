import assert from "node:assert/strict";
import test from "node:test";

import type { OperatorCommunicationApprovalReceipt } from "../src/core/businessCommunicationOperatorApproval";
import {
  bindRelationshipManagerApprovalCandidatePersistence,
  finalizeRelationshipManagerCommunicationApproval,
  prepareRelationshipManagerCommunicationForApproval,
} from "../src/core/businessRelationshipManagerApprovalRuntime";
import {
  approvalCandidatePersistenceEvidenceRef,
  buildStaffApprovalCandidateWriteRequest,
  reconcileStaffApprovalCandidateWriteReceipt,
} from "../src/core/businessStaffCommunicationApprovalCandidatePersistence";
import { finalizeStaffCommunicationApproval } from "../src/core/businessStaffCommunicationApprovalFinalizer";
import { runRelationshipManagerCommunicationCycle } from "../src/core/businessRelationshipManagerRuntime";

const candidateDocumentId = "doc_approval_candidate_1";
const candidateVersionId = "ver_approval_candidate_1";
const candidateRecordId = `${candidateDocumentId}:${candidateVersionId}`;

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

function memoryPersistence() {
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
    memoryPersistence: memoryPersistence(),
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

function persistenceFor(preparation = prepare()) {
  const request = buildStaffApprovalCandidateWriteRequest(preparation.approvalCandidate);
  return reconcileStaffApprovalCandidateWriteReceipt({
    candidate: preparation.approvalCandidate,
    request,
    receipt: {
      protocol: "evavo-approval-candidate-write-receipt-v1",
      version: 1,
      requestId: request.requestId,
      idempotencyKey: request.idempotencyKey,
      candidateId: request.candidateId,
      candidateSha256: request.candidateSha256,
      status: "appended",
      durable: true,
      recordId: candidateRecordId,
      journalPosition: "receipt_approval_candidate_1",
      recordedAt: "2026-09-04T01:03:10Z",
      storageAuthority: { system: "evavo-storage", instanceId: "local-primary" },
      storage: {
        model: "immutable_document_version",
        vaultId: "internal",
        logicalPath: `RelationshipManager/ApprovalCandidates/${request.candidateId}/${request.candidateSha256}.json`,
        documentId: candidateDocumentId,
        versionId: candidateVersionId,
        sha256: request.candidateSha256,
        sizeBytes: 2048,
        idempotentReplay: false,
        receiptId: "receipt_approval_candidate_1",
      },
    },
  });
}

function persist(preparation = prepare()) {
  return bindRelationshipManagerApprovalCandidatePersistence({
    preparation,
    persistence: persistenceFor(preparation),
  });
}

function operatorApproval(persisted = persist()): OperatorCommunicationApprovalReceipt {
  return {
    contract: "business_communication_operator_approval_v1",
    approvalId: "operator-approval-prepare-1",
    authority: "human_operator",
    approverId: "greg",
    approvedAt: "2026-09-04T01:04:00Z",
    expiresAt: "2026-09-04T02:04:00Z",
    materialSha256: persisted.approvalCandidate.materialSha256,
    decisionPackageId: persisted.decisionPackageId,
    senderKey: persisted.approvalCandidate.senderKey,
    mailboxKey: persisted.approvalCandidate.mailboxKey,
    evidenceRefs: [persisted.candidatePersistence.approvalEvidenceRef!],
    sourceSystem: "operator_approval",
  };
}

test("prepared candidate is not human-approvable until durably persisted", () => {
  const result = prepare();
  assert.equal(result.readyForCandidatePersistence, true);
  assert.equal(result.readyForHumanApproval, false);
  assert.equal(result.humanApprovalRecorded, false);
  assert.equal(result.externalExecutionAllowed, false);
  assert.equal(result.externalEffectPerformed, false);
  assert.equal(result.candidatePersistence, null);
});

test("durable candidate persistence unlocks human approval but not execution", () => {
  const result = persist();
  assert.equal(result.readyForCandidatePersistence, false);
  assert.equal(result.readyForHumanApproval, true);
  assert.equal(result.humanApprovalRecorded, false);
  assert.equal(result.candidatePersistence.durable, true);
  assert.ok(result.candidatePersistence.approvalEvidenceRef);
  assert.equal(result.externalExecutionAllowed, false);
});

test("persistence bind rejects a forged candidate evidence reference", () => {
  const preparation = prepare();
  const persistence = persistenceFor(preparation);
  const forged = { ...persistence, approvalEvidenceRef: `approval-candidate:${"0".repeat(64)}` };
  assert.throws(() => bindRelationshipManagerApprovalCandidatePersistence({
    preparation,
    persistence: forged,
  }), /CANDIDATE_PERSISTENCE_EVIDENCE_MISMATCH/);
});

test("finalizer independently rejects forged persisted candidate evidence", () => {
  const preparation = prepare();
  const persistence = persistenceFor(preparation);
  const forgedEvidenceRef = `approval-candidate:${"f".repeat(64)}`;
  const forgedPersistence = { ...persistence, approvalEvidenceRef: forgedEvidenceRef };
  const receipt: OperatorCommunicationApprovalReceipt = {
    contract: "business_communication_operator_approval_v1",
    approvalId: "operator-approval-forged-1",
    authority: "human_operator",
    approverId: "greg",
    approvedAt: "2026-09-04T01:04:00Z",
    expiresAt: "2026-09-04T02:04:00Z",
    materialSha256: preparation.approvalCandidate.materialSha256,
    decisionPackageId: preparation.decisionPackageId,
    senderKey: preparation.approvalCandidate.senderKey,
    mailboxKey: preparation.approvalCandidate.mailboxKey,
    evidenceRefs: [forgedEvidenceRef],
    sourceSystem: "operator_approval",
  };
  assert.notEqual(
    forgedEvidenceRef,
    approvalCandidatePersistenceEvidenceRef({
      candidateId: preparation.approvalCandidate.candidateId,
      candidateSha256: persistence.candidateSha256,
      recordId: persistence.recordId!,
    }),
  );
  assert.throws(() => finalizeStaffCommunicationApproval({
    envelopeId: "send-envelope-forged-1",
    candidate: preparation.approvalCandidate,
    candidatePersistence: forgedPersistence,
    operatorApprovalReceipt: receipt,
  }), /PERSISTED_CANDIDATE_EVIDENCE_MISMATCH/);
});

test("human approval finalization remains non-executing and binds durable candidate identity", () => {
  const persisted = persist();
  const finalized = finalizeRelationshipManagerCommunicationApproval({
    envelopeId: "send-envelope-prepare-1",
    preparation: persisted,
    operatorApprovalReceipt: operatorApproval(persisted),
  });
  assert.equal(finalized.humanApprovalRecorded, true);
  assert.equal(finalized.externalExecutionAllowed, false);
  assert.equal(finalized.approvalCandidateRecordId, candidateRecordId);
  assert.equal(finalized.approvalCandidateSha256, persisted.candidatePersistence.candidateSha256);
  assert.ok(finalized.approval.approvalBinding?.approvalEvidenceIds.includes(persisted.candidatePersistence.approvalEvidenceRef!));
});

test("human approval without the durable candidate evidence reference fails closed", () => {
  const persisted = persist();
  const receipt = { ...operatorApproval(persisted), evidenceRefs: ["operator-approval:other"] };
  assert.throws(() => finalizeRelationshipManagerCommunicationApproval({
    envelopeId: "send-envelope-prepare-1",
    preparation: persisted,
    operatorApprovalReceipt: receipt,
  }), /OPERATOR_CANDIDATE_EVIDENCE_MISSING/);
});

test("approval preparation rejects a routing thread that does not match the canonical cycle", () => {
  assert.throws(() => prepare({ threadId: "thread-other" }), /THREAD_MISMATCH/);
});

test("approval preparation rejects durable memory from a different relationship cycle", () => {
  assert.throws(() => prepare({ memoryPersistence: { ...memoryPersistence(), cycleId: "cycle-other" } }), /MEMORY_CYCLE_MISMATCH/);
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
