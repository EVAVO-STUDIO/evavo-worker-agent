import assert from "node:assert/strict";
import test from "node:test";

import type { AuthorizedCommunicationExecutionRequest } from "../src/core/businessCommunicationExecutionRequest";
import { reconcileAuthorizedCommunicationExecution } from "../src/core/businessCommunicationExecutionReceipt";

const request: AuthorizedCommunicationExecutionRequest = Object.freeze({
  contract: "business_communication_execution_request_v1",
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
    decisionEvidenceIds: Object.freeze(["gmail:message:gmail-message-1"]),
    approvalEvidenceIds: Object.freeze(["operator-approval:approval-1"]),
    approvedBy: "greg",
    approvedAt: "2026-09-04T01:05:00.000Z",
    expiresAt: "2026-09-04T02:05:00.000Z",
    mailboxKey: "greg",
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
  assert.equal(receipt.providerMessageId, "gmail-message-sent-2");
  assert.equal(receipt.providerThreadId, request.threadId);
  assert.equal(receipt.authorization.materialSha256, request.authorization.materialSha256);
  assert.equal(receipt.authorization.approvalBindingSha256, request.authorization.approvalBindingSha256);
});

test("wrong thread fails closed", () => {
  assert.throws(() => reconcileAuthorizedCommunicationExecution({
    request,
    observed: observed({ providerThreadId: "gmail-thread-other" }),
  }), /COMMUNICATION_EXECUTION_RECEIPT_THREAD_MISMATCH/);
});

test("recipient drift in provider result fails closed", () => {
  assert.throws(() => reconcileAuthorizedCommunicationExecution({
    request,
    observed: observed({ to: ["other@example.com"] }),
  }), /COMMUNICATION_EXECUTION_RECEIPT_TO_MISMATCH/);
});

test("send observed at or after approval expiry fails closed", () => {
  assert.throws(() => reconcileAuthorizedCommunicationExecution({
    request,
    observed: observed({ sentAt: request.authorization.expiresAt }),
  }), /COMMUNICATION_EXECUTION_RECEIPT_AFTER_APPROVAL_EXPIRY/);
});

test("provider message ID must be backed by returned source evidence", () => {
  assert.throws(() => reconcileAuthorizedCommunicationExecution({
    request,
    observed: observed({ sourceEvidenceRefs: ["gmail:message:other"] }),
  }), /COMMUNICATION_EXECUTION_RECEIPT_MESSAGE_EVIDENCE_MISSING/);
});
