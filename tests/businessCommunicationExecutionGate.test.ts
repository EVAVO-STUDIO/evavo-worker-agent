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
  body: "Hi Ashley,\n\nThanks for getting in touch. I don't have a confirmed current graduate opening I can accurately point you to, but I appreciate you reaching out.\n\nKind regards,\nGreg",
  attachments: [],
} as const;

function approval() {
  return createCommunicationSendEnvelope({
    envelopeId: "approval-1",
    approvedAt: "2026-09-04T01:00:00Z",
    expiresAt: "2026-09-04T02:00:00Z",
    approvedBy: "greg",
    material,
    senderKey: "greg",
    mailboxKey: "greg",
    decisionPackageId: "decision-package-1",
    evidenceIds: ["gmail:message-1", "roles:current-openings"],
  });
}

const review = {
  expectedRecipientAddresses: ["ashley@example.com"],
  prohibitedClaims: ["we are hiring", "we are not hiring"],
  requiredPoints: ["confirmed current graduate opening"],
  referencedAttachmentNames: [],
  suppressionActive: false,
};

test("exact approval-bound material can pass when runtime sending is explicitly enabled", () => {
  const result = evaluateCommunicationExecutionGate({
    mailbox: DESIRED_EVAVO_MAILBOXES.greg,
    material,
    approval: approval(),
    review,
    runtimeSendingEnabled: true,
    now: new Date("2026-09-04T01:30:00Z"),
  });
  assert.equal(result.allowed, true);
  assert.equal(result.approvalBindingValid, true);
  assert.equal(result.approvalContextValid, true);
});

test("legacy material-only approval remains inspectable but cannot execute", () => {
  const legacy = createCommunicationSendEnvelope({
    envelopeId: "legacy-approval",
    approvedAt: "2026-09-04T01:00:00Z",
    expiresAt: "2026-09-04T02:00:00Z",
    approvedBy: "greg",
    material,
  });
  const result = evaluateCommunicationExecutionGate({
    mailbox: DESIRED_EVAVO_MAILBOXES.greg,
    material,
    approval: legacy,
    review,
    runtimeSendingEnabled: true,
    now: new Date("2026-09-04T01:30:00Z"),
  });
  assert.equal(result.allowed, false);
  assert.equal(result.approvalBindingValid, false);
  assert.ok(result.reasons.includes("approval_binding_missing"));
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

test("unverified Eva mailbox cannot be used even with an otherwise structurally valid approval", () => {
  const evaMaterial = { ...material, sender: "eva@evavo.com.au" };
  const evaApproval = createCommunicationSendEnvelope({
    envelopeId: "approval-eva",
    approvedAt: "2026-09-04T01:00:00Z",
    expiresAt: "2026-09-04T02:00:00Z",
    approvedBy: "greg",
    material: evaMaterial,
    senderKey: "eva",
    mailboxKey: "eva",
    decisionPackageId: "decision-package-eva",
    evidenceIds: ["gmail:message-1"],
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

test("new recipient reply after approval invalidates execution even when approved material is unchanged", () => {
  const result = evaluateCommunicationExecutionGate({
    mailbox: DESIRED_EVAVO_MAILBOXES.greg,
    material,
    approval: approval(),
    review,
    runtimeSendingEnabled: true,
    contextChangesSinceDecision: [
      {
        id: "message-2",
        occurredAt: "2026-09-04T01:10:00Z",
        kind: "thread_message",
        material: true,
        summary: "Ashley sent another message with additional information.",
        evidenceIds: ["gmail:message-2"],
      },
    ],
    now: new Date("2026-09-04T01:30:00Z"),
  });
  assert.equal(result.allowed, false);
  assert.equal(result.approvalValid, true);
  assert.equal(result.approvalContextValid, false);
  assert.ok(result.reasons.some((reason) => reason.includes("new_material_context:thread_message:message-2")));
});

test("non-material telemetry after approval does not invalidate execution", () => {
  const result = evaluateCommunicationExecutionGate({
    mailbox: DESIRED_EVAVO_MAILBOXES.greg,
    material,
    approval: approval(),
    review,
    runtimeSendingEnabled: true,
    contextChangesSinceDecision: [
      {
        id: "telemetry-1",
        occurredAt: "2026-09-04T01:10:00Z",
        kind: "other",
        material: false,
        summary: "Non-material internal telemetry changed.",
        evidenceIds: ["worker:telemetry-1"],
      },
    ],
    now: new Date("2026-09-04T01:30:00Z"),
  });
  assert.equal(result.allowed, true);
});
