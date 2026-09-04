import assert from "node:assert/strict";
import test from "node:test";

import {
  approvalCandidatePersistenceEvidenceRef,
  buildStaffApprovalCandidateWriteRequest,
  reconcileStaffApprovalCandidateWriteReceipt,
  staffApprovalCandidateHash,
} from "../src/core/businessStaffCommunicationApprovalCandidatePersistence";

const candidate = {
  contract: "business_staff_communication_approval_candidate_v2" as const,
  candidateId: "approval-candidate-1",
  createdAt: "2026-09-04T01:00:00Z",
  decisionPackageId: "relationship-cycle:cycle-1",
  decisionOrigin: "relationship_manager_cycle" as const,
  relationshipCycleId: "cycle-1",
  relationshipId: "relationship-1",
  handoffId: "handoff-1",
  writingRequestId: "writing-request-1",
  writingPackageId: "writing-package-1",
  writingCandidateId: "draft-1",
  senderKey: "greg" as const,
  mailboxKey: "greg" as const,
  writingProvenance: {
    handoffId: "handoff-1",
    writingRequestId: "writing-request-1",
    decisionOrigin: "relationship_manager_cycle" as const,
    relationshipCycleId: "cycle-1",
  },
  material: {
    sender: "greg@evavo.com.au",
    to: ["client@example.com"],
    cc: [],
    bcc: [],
    threadId: "thread-1",
    replyMessageId: "message-1",
    subject: "Re: Status",
    body: "Hi,\n\nHere is the current status.\n\nKind regards,\nGreg",
    attachments: [],
  },
  materialSha256: "a".repeat(64),
  evidenceIds: ["gmail:message:message-1", "memory:decision-1"],
  writingSourceRefs: ["gmail:message:message-1"],
  readyForHumanApproval: true as const,
  externalEffectPerformed: false as const,
};

function receipt(status: "appended" | "idempotent_replay" = "appended") {
  const request = buildStaffApprovalCandidateWriteRequest(candidate);
  return {
    request,
    receipt: {
      protocol: "evavo-approval-candidate-write-receipt-v1" as const,
      version: 1 as const,
      requestId: request.requestId,
      idempotencyKey: request.idempotencyKey,
      candidateId: request.candidateId,
      candidateSha256: request.candidateSha256,
      status,
      durable: true,
      recordId: "approval-candidate-record-1",
      journalPosition: 12,
      recordedAt: "2026-09-04T01:00:01Z",
      storageAuthority: { system: "evavo-storage" as const, instanceId: "local-primary" },
    },
  };
}

test("approval candidate write identity is deterministic", () => {
  const first = buildStaffApprovalCandidateWriteRequest(candidate);
  const second = buildStaffApprovalCandidateWriteRequest(candidate);
  assert.equal(first.requestId, second.requestId);
  assert.equal(first.idempotencyKey, second.idempotencyKey);
  assert.equal(first.candidateSha256, second.candidateSha256);
  assert.equal(first.candidateSha256, staffApprovalCandidateHash(candidate));
});

test("durable append produces exact human-approval evidence reference", () => {
  const current = receipt();
  const result = reconcileStaffApprovalCandidateWriteReceipt({
    candidate,
    request: current.request,
    receipt: current.receipt,
  });
  assert.equal(result.durable, true);
  assert.equal(result.status, "persisted");
  assert.equal(result.recordId, "approval-candidate-record-1");
  assert.equal(result.approvalEvidenceRef, approvalCandidatePersistenceEvidenceRef({
    candidateId: candidate.candidateId,
    candidateSha256: result.candidateSha256,
    recordId: "approval-candidate-record-1",
  }));
});

test("idempotent replay is accepted as the same durable candidate", () => {
  const current = receipt("idempotent_replay");
  const result = reconcileStaffApprovalCandidateWriteReceipt({ candidate, request: current.request, receipt: current.receipt });
  assert.equal(result.durable, true);
  assert.equal(result.receiptStatus, "idempotent_replay");
});

test("candidate hash mismatch fails closed", () => {
  const current = receipt();
  assert.throws(() => reconcileStaffApprovalCandidateWriteReceipt({
    candidate,
    request: current.request,
    receipt: { ...current.receipt, candidateSha256: "f".repeat(64) },
  }), /HASH_MISMATCH/);
});

test("storage rejection never produces an approval evidence reference", () => {
  const request = buildStaffApprovalCandidateWriteRequest(candidate);
  const result = reconcileStaffApprovalCandidateWriteReceipt({
    candidate,
    request,
    receipt: {
      protocol: "evavo-approval-candidate-write-receipt-v1",
      version: 1,
      requestId: request.requestId,
      idempotencyKey: request.idempotencyKey,
      candidateId: request.candidateId,
      candidateSha256: request.candidateSha256,
      status: "rejected",
      durable: false,
      recordedAt: "2026-09-04T01:00:01Z",
      storageAuthority: { system: "evavo-storage", instanceId: "local-primary" },
      rejection: { code: "storage_rejected", message: "candidate not persisted" },
    },
  });
  assert.equal(result.durable, false);
  assert.equal(result.status, "rejected");
  assert.equal(result.approvalEvidenceRef, null);
});
