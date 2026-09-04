import assert from "node:assert/strict";
import test from "node:test";

import { DESIRED_EVAVO_MAILBOXES } from "../src/core/businessMailboxRegistry";
import { buildCommunicationDecisionPackage } from "../src/core/businessCommunicationDecisionPackage";
import {
  assertAuthorizedCommunicationExecutionRequest,
  authorizeCommunicationExecutionRequest,
} from "../src/core/businessCommunicationExecutionRequest";
import type { OperatorCommunicationApprovalReceipt } from "../src/core/businessCommunicationOperatorApproval";
import { createCommunicationSendEnvelope } from "../src/core/businessCommunicationSendEnvelope";

const material = {
  sender: "greg@evavo.com.au",
  to: ["client@example.com"],
  cc: [],
  bcc: [],
  threadId: "gmail-thread-1",
  replyMessageId: "gmail-message-1",
  subject: "Re: Delivery status",
  body: "Hi,\n\nThe delivery is currently awaiting your review.\n\nKind regards,\nGreg",
  attachments: [],
} as const;

const decision = buildCommunicationDecisionPackage({
  packageId: "decision-exec-1",
  scenario: "general",
  objective: "Answer current delivery status.",
  thread: {
    threadId: "gmail-thread-1",
    previousState: [],
    latestObservedState: [{ id: "question-1", kind: "question", statement: "Can you confirm the delivery status?", status: "open", owner: "evavo", sourceEvidenceIds: ["gmail:message:gmail-message-1"] }],
  },
  obligations: [],
  channel: { currentChannel: "email", canResolveInWriting: true },
  evidenceIds: ["gmail:message:gmail-message-1", "operations:project-1:status"],
  evidenceConfidence: 95,
  decisionAt: "2026-09-04T01:00:00Z",
});

const approval = createCommunicationSendEnvelope({
  envelopeId: "approval-exec-1",
  approvedAt: "2026-09-04T01:05:00Z",
  expiresAt: "2026-09-04T02:05:00Z",
  approvedBy: "greg",
  material,
  senderKey: "greg",
  mailboxKey: "greg",
  decisionPackageId: decision.packageId,
  evidenceIds: decision.evidenceIds,
  approvalEvidenceIds: ["operator-approval:approval-exec-1"],
});

const operatorApproval: OperatorCommunicationApprovalReceipt = {
  contract: "business_communication_operator_approval_v1",
  approvalId: "operator-approval-exec-1",
  authority: "human_operator",
  approverId: "greg",
  approvedAt: approval.approvedAt,
  expiresAt: approval.expiresAt,
  materialSha256: approval.materialSha256,
  decisionPackageId: decision.packageId,
  senderKey: "greg",
  mailboxKey: "greg",
  evidenceRefs: ["operator-approval:approval-exec-1"],
  sourceSystem: "operator_approval",
};

const review = { expectedRecipientAddresses: ["client@example.com"], prohibitedClaims: [], requiredPoints: ["awaiting your review"], referencedAttachmentNames: [], suppressionActive: false };

function input(overrides: Record<string, unknown> = {}) {
  return {
    mailbox: DESIRED_EVAVO_MAILBOXES.greg,
    material,
    approval,
    operatorApprovalReceipt: operatorApproval,
    decisionPackage: decision,
    review,
    runtimeSendingEnabled: true,
    now: new Date("2026-09-04T01:30:00Z"),
    ...overrides,
  };
}

test("only a fully authorized gate result produces a Gmail execution request", () => {
  const result = authorizeCommunicationExecutionRequest(input());
  assert.equal(result.gate.allowed, true);
  assert.ok(result.request);
  assert.equal(result.request?.provider, "gmail");
  assert.equal(result.request?.authorization.operatorApprovalId, operatorApproval.approvalId);
  assert.equal(result.request?.authorization.operatorApprovalSource, "operator_approval");
  assert.equal(result.request?.authorization.approvalBindingSha256, approval.approvalBinding?.bindingSha256);
});

test("missing operator receipt produces no provider request", () => {
  const result = authorizeCommunicationExecutionRequest(input({ operatorApprovalReceipt: null }) as Parameters<typeof authorizeCommunicationExecutionRequest>[0]);
  assert.equal(result.gate.allowed, false);
  assert.equal(result.request, null);
});

test("blocked execution produces no provider request", () => {
  const result = authorizeCommunicationExecutionRequest(input({ material: { ...material, body: `${material.body}\nChanged after approval.` } }));
  assert.equal(result.gate.allowed, false);
  assert.equal(result.request, null);
});

test("asserting an execution request throws when runtime sending is disabled", () => {
  assert.throws(() => assertAuthorizedCommunicationExecutionRequest(input({ runtimeSendingEnabled: false })), /COMMUNICATION_EXECUTION_REQUEST_BLOCKED/);
});
