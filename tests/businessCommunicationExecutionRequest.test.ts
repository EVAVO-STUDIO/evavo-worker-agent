import assert from "node:assert/strict";
import test from "node:test";

import { DESIRED_EVAVO_MAILBOXES } from "../src/core/businessMailboxRegistry";
import { buildCommunicationDecisionPackage } from "../src/core/businessCommunicationDecisionPackage";
import {
  assertAuthorizedCommunicationExecutionRequest,
  authorizeCommunicationExecutionRequest,
} from "../src/core/businessCommunicationExecutionRequest";
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
    latestObservedState: [{
      id: "question-1",
      kind: "question",
      statement: "Can you confirm the delivery status?",
      status: "open",
      owner: "evavo",
      sourceEvidenceIds: ["gmail:message:gmail-message-1"],
    }],
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

const review = {
  expectedRecipientAddresses: ["client@example.com"],
  prohibitedClaims: [],
  requiredPoints: ["awaiting your review"],
  referencedAttachmentNames: [],
  suppressionActive: false,
};

test("only a fully authorized gate result produces a Gmail execution request", () => {
  const result = authorizeCommunicationExecutionRequest({
    mailbox: DESIRED_EVAVO_MAILBOXES.greg,
    material,
    approval,
    decisionPackage: decision,
    review,
    runtimeSendingEnabled: true,
    now: new Date("2026-09-04T01:30:00Z"),
  });

  assert.equal(result.gate.allowed, true);
  assert.ok(result.request);
  assert.equal(result.request?.provider, "gmail");
  assert.equal(result.request?.authorization.envelopeId, approval.envelopeId);
  assert.equal(result.request?.authorization.materialSha256, approval.materialSha256);
  assert.equal(result.request?.authorization.approvalBindingSha256, approval.approvalBinding?.bindingSha256);
  assert.deepEqual(result.request?.authorization.approvalEvidenceIds, ["operator-approval:approval-exec-1"]);
});

test("blocked execution produces no provider request", () => {
  const result = authorizeCommunicationExecutionRequest({
    mailbox: DESIRED_EVAVO_MAILBOXES.greg,
    material: { ...material, body: `${material.body}\nChanged after approval.` },
    approval,
    decisionPackage: decision,
    review,
    runtimeSendingEnabled: true,
    now: new Date("2026-09-04T01:30:00Z"),
  });
  assert.equal(result.gate.allowed, false);
  assert.equal(result.request, null);
});

test("asserting an execution request throws when runtime sending is disabled", () => {
  assert.throws(() => assertAuthorizedCommunicationExecutionRequest({
    mailbox: DESIRED_EVAVO_MAILBOXES.greg,
    material,
    approval,
    decisionPackage: decision,
    review,
    runtimeSendingEnabled: false,
    now: new Date("2026-09-04T01:30:00Z"),
  }), /COMMUNICATION_EXECUTION_REQUEST_BLOCKED/);
});
