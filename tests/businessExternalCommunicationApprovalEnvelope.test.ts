import assert from "node:assert/strict";
import test from "node:test";

import { DESIRED_EVAVO_MAILBOXES } from "../src/core/businessMailboxRegistry";
import {
  approveExternalCommunicationEnvelope,
  assertApprovedExternalCommunicationExecutable,
  buildExternalCommunicationApprovalEnvelope,
  verifyApprovedExternalCommunicationForExecution,
} from "../src/core/businessExternalCommunicationApprovalEnvelope";

const BODY = "Hi Naomi,\n\nPlease find the verified contractor forecast attached.\n\nKind regards,\nGreg";
const ATTACHMENT_HASH = "a".repeat(64);

function execution() {
  return {
    senderKey: "greg" as const,
    senderAddress: "greg@evavo.com.au",
    to: ["naomi@example.com"],
    cc: [],
    bcc: [],
    threadId: "gmail-thread-123",
    inReplyToMessageId: "gmail-message-456",
    subject: "Re: Contractor forecast",
    body: BODY,
    attachments: [
      {
        attachmentId: "artifact-forecast",
        fileName: "Contractor-Forecast.xlsx",
        contentHash: ATTACHMENT_HASH,
        versionRef: "sha256:forecast-v7",
      },
    ],
    evidenceIds: ["gmail:message-456", "docs:forecast-v7"],
    decisionPackageId: "decision-pkg-123",
  };
}

function approved() {
  const envelope = buildExternalCommunicationApprovalEnvelope({
    envelopeId: "send-envelope-1",
    createdAt: "2026-09-04T02:00:00Z",
    mailbox: DESIRED_EVAVO_MAILBOXES.greg,
    execution: execution(),
  });
  const approval = approveExternalCommunicationEnvelope({
    envelope,
    approvalId: "approval-1",
    approverId: "greg",
    approvedAt: "2026-09-04T02:01:00Z",
    expiresAt: "2026-09-04T03:01:00Z",
  });
  return { envelope, approval };
}

test("exact approved envelope is executable with the same verified mailbox and content", () => {
  const { envelope, approval } = approved();
  const result = verifyApprovedExternalCommunicationForExecution({
    envelope,
    approval,
    mailbox: DESIRED_EVAVO_MAILBOXES.greg,
    execution: execution(),
    now: "2026-09-04T02:30:00Z",
  });
  assert.equal(result.valid, true);
  assert.equal(result.reasons.length, 0);
});

test("body regeneration after approval invalidates execution", () => {
  const { envelope, approval } = approved();
  const result = verifyApprovedExternalCommunicationForExecution({
    envelope,
    approval,
    mailbox: DESIRED_EVAVO_MAILBOXES.greg,
    execution: { ...execution(), body: `${BODY}\n` },
    now: "2026-09-04T02:30:00Z",
  });
  assert.equal(result.valid, false);
  assert.ok(result.reasons.some((item) => /materially differs/i.test(item)));
});

test("recipient or attachment drift invalidates approval", () => {
  const { envelope, approval } = approved();
  const recipientDrift = verifyApprovedExternalCommunicationForExecution({
    envelope,
    approval,
    mailbox: DESIRED_EVAVO_MAILBOXES.greg,
    execution: { ...execution(), to: ["other@example.com"] },
    now: "2026-09-04T02:30:00Z",
  });
  assert.equal(recipientDrift.valid, false);

  const attachmentDrift = verifyApprovedExternalCommunicationForExecution({
    envelope,
    approval,
    mailbox: DESIRED_EVAVO_MAILBOXES.greg,
    execution: {
      ...execution(),
      attachments: [{ ...execution().attachments[0], contentHash: "b".repeat(64) }],
    },
    now: "2026-09-04T02:30:00Z",
  });
  assert.equal(attachmentDrift.valid, false);
});

test("unverified Eva mailbox cannot be used to create an approval envelope", () => {
  assert.throws(() => buildExternalCommunicationApprovalEnvelope({
    envelopeId: "send-envelope-eva",
    createdAt: "2026-09-04T02:00:00Z",
    mailbox: DESIRED_EVAVO_MAILBOXES.eva,
    execution: {
      ...execution(),
      senderKey: "eva",
      senderAddress: "eva@evavo.com.au",
    },
  }), /MAILBOX_NOT_FULLY_VERIFIED/);
});

test("expired approval fails closed", () => {
  const { envelope, approval } = approved();
  assert.throws(() => assertApprovedExternalCommunicationExecutable({
    envelope,
    approval,
    mailbox: DESIRED_EVAVO_MAILBOXES.greg,
    execution: execution(),
    now: "2026-09-04T03:01:00.001Z",
  }), /EXTERNAL_SEND_APPROVAL_INVALID/);
});
