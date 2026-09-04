import assert from "node:assert/strict";
import test from "node:test";

import { DESIRED_EVAVO_MAILBOXES } from "../src/core/businessMailboxRegistry";
import { evaluateCommunicationExecutionGate } from "../src/core/businessCommunicationExecutionGate";
import { createCommunicationSendEnvelope } from "../src/core/businessCommunicationSendEnvelope";

const material = {
  sender: "greg@evavo.com.au",
  to: ["ashley@example.com"],
  cc: [],
  bcc: [],
  threadId: "thread-1",
  replyMessageId: "message-1",
  subject: "Re: Graduate enquiry",
  body: "Hi Ashley,\n\nThanks for getting in touch. We are not advertising a graduate role at the moment, but I appreciate you reaching out.\n\nKind regards,\nGreg",
  attachments: [],
} as const;

function approval() {
  return createCommunicationSendEnvelope({
    envelopeId: "approval-1",
    approvedAt: "2026-09-04T01:00:00Z",
    expiresAt: "2026-09-04T02:00:00Z",
    approvedBy: "greg",
    material,
  });
}

const review = {
  expectedRecipientAddresses: ["ashley@example.com"],
  prohibitedClaims: ["we are hiring"],
  requiredPoints: ["not advertising a graduate role"],
  referencedAttachmentNames: [],
  suppressionActive: false,
};

test("exact approved material can pass when runtime sending is explicitly enabled", () => {
  const result = evaluateCommunicationExecutionGate({
    mailbox: DESIRED_EVAVO_MAILBOXES.greg,
    material,
    approval: approval(),
    review,
    runtimeSendingEnabled: true,
    now: new Date("2026-09-04T01:30:00Z"),
  });
  assert.equal(result.allowed, true);
});

test("runtime sending remains a distinct hard gate", () => {
  const result = evaluateCommunicationExecutionGate({
    mailbox: DESIRED_EVAVO_MAILBOXES.greg,
    material,
    approval: approval(),
    review,
    runtimeSendingEnabled: false,
    now: new Date("2026-09-04T01:30:00Z"),
  });
  assert.equal(result.allowed, false);
  assert.ok(result.reasons.includes("runtime_sending_disabled"));
});

test("unverified Eva mailbox cannot be used even with an otherwise valid approval", () => {
  const evaMaterial = { ...material, sender: "eva@evavo.com.au" };
  const evaApproval = createCommunicationSendEnvelope({
    envelopeId: "approval-eva",
    approvedAt: "2026-09-04T01:00:00Z",
    expiresAt: "2026-09-04T02:00:00Z",
    approvedBy: "greg",
    material: evaMaterial,
  });
  const result = evaluateCommunicationExecutionGate({
    mailbox: DESIRED_EVAVO_MAILBOXES.eva,
    material: evaMaterial,
    approval: evaApproval,
    review,
    runtimeSendingEnabled: true,
    now: new Date("2026-09-04T01:30:00Z"),
  });
  assert.equal(result.allowed, false);
  assert.ok(result.reasons.includes("mailbox_not_fully_verified"));
});

test("post-approval body mutation blocks execution", () => {
  const result = evaluateCommunicationExecutionGate({
    mailbox: DESIRED_EVAVO_MAILBOXES.greg,
    material: { ...material, body: `${material.body}\nOne more thing.` },
    approval: approval(),
    review,
    runtimeSendingEnabled: true,
    now: new Date("2026-09-04T01:30:00Z"),
  });
  assert.equal(result.allowed, false);
  assert.ok(result.reasons.includes("approved_material_changed"));
});
