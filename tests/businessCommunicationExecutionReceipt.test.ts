import assert from "node:assert/strict";
import test from "node:test";

import type { AuthorizedCommunicationExecutionRequest } from "../src/core/businessCommunicationExecutionRequest";
import { reconcileAuthorizedCommunicationExecution } from "../src/core/businessCommunicationExecutionReceipt";
import { approvalCandidatePersistenceEvidenceRef } from "../src/core/businessStaffCommunicationApprovalCandidatePersistence";

const request: AuthorizedCommunicationExecutionRequest = Object.freeze({
  contract: "business_communication_execution_request_v4",
  provider: "gmail",
  requestId: "gmail-send:approval-1:abcdef",
  authorizedAt: "2026-09-04T01:30:00.000Z",
  sender: "greg@evavo.com.au",
  to: Object.freeze(["client@example.com"]),
  cc: Object.freeze([]),
  bcc: Object.freeze([]),
  threadId: "gmail-thread-1",
  replyMessageId: "gmail-message-1",
  subject: "Re: Delivery status",
  body: "Hi,\n\nThe delivery is awaiting review.\n\nKind regards,\nGreg",
  attachments: Object.freeze([]),
  authorization: Object.freeze({
    envelopeId: "approval-1",
    materialSha256: "a".repeat(64),
    approvalBindingSha256: "b".repeat(64),
    decisionPackageId: "decision-1",
    decisionOrigin: "direct",
    relationshipCycleId: null,
    decisionEvidenceIds: Object.freeze(["gmail:message:gmail-message-1"]),
    approvalEvidenceIds: Object.freeze(["operator-approval:approval-1"]),
    operatorApprovalId: "operator-approval-1",
    operatorApprovalSource: "operator_approval",
    approvedBy: "greg",
    approvedAt: "2026-09-04T01:05:00.000Z",
    expiresAt: "2026-09-04T02:05:00.000Z",
    mailboxKey: "greg",
    writingProvenance: null,
    approvalCandidate: null,
    memoryCheckpoint: null,
  }),
});

function observed(overrides: Record<string, unknown> = {}) {
  return {
    providerMessageId: "gmail-message-sent-2",
    providerThreadId: "gmail-thread-1",
    sentAt: "2026-09-04T01:31:00Z",
    sender: "greg@evavo.com.au",
    to: ["client@example.com"],
    cc: [],
    bcc: [],
    sourceEvidenceRefs: ["gmail:message:gmail-message-sent-2"],
    ...overrides,
  };
}

test("observed Gmail send reconciles to the exact authorized request", () => {
  const receipt = reconcileAuthorizedCommunicationExecution({ request, observed: observed() });
  assert.equal(receipt.contract, "business_communication_execution_receipt_v4");
  assert.equal(receipt.providerMessageId, "gmail-message-sent-2");
  assert.equal(receipt.providerThreadId, request.threadId);
  assert.equal(receipt.authorization.materialSha256, request.authorization.materialSha256);
  assert.equal(receipt.authorization.approvalBindingSha256, request.authorization.approvalBindingSha256);
  assert.equal(receipt.authorization.operatorApprovalId, "operator-approval-1");
  assert.equal(receipt.authorization.decisionOrigin, "direct");
});

test("wrong thread fails closed", () => {
  assert.throws(() => reconcileAuthorizedCommunicationExecution({ request, observed: observed({ providerThreadId: "gmail-thread-other" }) }), /THREAD_MISMATCH/);
});

test("recipient drift in provider result fails closed", () => {
  assert.throws(() => reconcileAuthorizedCommunicationExecution({ request, observed: observed({ to: ["other@example.com"] }) }), /TO_MISMATCH/);
});

test("send observed at or after approval expiry fails closed", () => {
  assert.throws(() => reconcileAuthorizedCommunicationExecution({ request, observed: observed({ sentAt: request.authorization.expiresAt }) }), /AFTER_APPROVAL_EXPIRY/);
});

test("provider message ID must be backed by returned source evidence", () => {
  assert.throws(() => reconcileAuthorizedCommunicationExecution({ request, observed: observed({ sourceEvidenceRefs: ["gmail:message:other"] }) }), /MESSAGE_EVIDENCE_MISSING/);
});

test("relationship cycle receipt requires durable memory, writing provenance and persisted approval candidate", () => {
  const candidateId = "approval-candidate-1";
  const candidateSha256 = "d".repeat(64);
  const recordId = "doc-1:ver-1";
  const candidateEvidenceRef = approvalCandidatePersistenceEvidenceRef({ candidateId, candidateSha256, recordId });
  const cycleRequest: AuthorizedCommunicationExecutionRequest = {
    ...request,
    authorization: {
      ...request.authorization,
      decisionOrigin: "relationship_manager_cycle",
      relationshipCycleId: "cycle-1",
      approvalEvidenceIds: [candidateEvidenceRef],
      writingProvenance: {
        handoffId: "handoff-1",
        writingRequestId: "writing-request-1",
        decisionOrigin: "relationship_manager_cycle",
        relationshipCycleId: "cycle-1",
      },
      approvalCandidate: { candidateId, candidateSha256, recordId, evidenceRef: candidateEvidenceRef },
      memoryCheckpoint: { cycleId: "cycle-1", recordIds: ["mem-1"] },
    },
  };
  assert.doesNotThrow(() => reconcileAuthorizedCommunicationExecution({ request: cycleRequest, observed: observed() }));

  const wrongMemory: AuthorizedCommunicationExecutionRequest = {
    ...cycleRequest,
    authorization: {
      ...cycleRequest.authorization,
      memoryCheckpoint: { cycleId: "other-cycle", recordIds: ["mem-1"] },
    },
  };
  assert.throws(() => reconcileAuthorizedCommunicationExecution({ request: wrongMemory, observed: observed() }), /MEMORY_CHECKPOINT_CYCLE_MISMATCH/);

  const missingCandidate: AuthorizedCommunicationExecutionRequest = {
    ...cycleRequest,
    authorization: { ...cycleRequest.authorization, approvalCandidate: null },
  };
  assert.throws(() => reconcileAuthorizedCommunicationExecution({ request: missingCandidate, observed: observed() }), /APPROVAL_CANDIDATE_MISSING/);

  const forgedCandidate: AuthorizedCommunicationExecutionRequest = {
    ...cycleRequest,
    authorization: {
      ...cycleRequest.authorization,
      approvalCandidate: { ...cycleRequest.authorization.approvalCandidate!, recordId: "doc-forged:ver-forged" },
    },
  };
  assert.throws(() => reconcileAuthorizedCommunicationExecution({ request: forgedCandidate, observed: observed() }), /APPROVAL_CANDIDATE_EVIDENCE_MISMATCH/);
});
