import assert from "node:assert/strict";
import test from "node:test";

import { DESIRED_EVAVO_MAILBOXES } from "../src/core/businessMailboxRegistry";
import { buildCommunicationDecisionPackage } from "../src/core/businessCommunicationDecisionPackage";
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

function decisionPackage() {
  return buildCommunicationDecisionPackage({
    packageId: "decision-package-1",
    scenario: "general",
    objective: "Answer the current graduate-opening question accurately and kindly.",
    thread: {
      threadId: "thread-1",
      previousState: [],
      latestObservedState: [{
        id: "question-1",
        kind: "question",
        statement: "Is there a confirmed current graduate opening?",
        status: "open",
        owner: "evavo",
        sourceEvidenceIds: ["gmail:message-1"],
      }],
    },
    obligations: [],
    channel: { currentChannel: "email", canResolveInWriting: true },
    evidenceIds: ["gmail:message-1"],
    evidenceConfidence: 95,
    decisionAt: "2026-09-04T00:59:00Z",
  });
}

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
    approvalEvidenceIds: ["operator-approval:approval-1"],
  });
}

const review = {
  expectedRecipientAddresses: ["ashley@example.com"],
  prohibitedClaims: ["we are hiring", "we are not hiring"],
  requiredPoints: ["confirmed current graduate opening"],
  referencedAttachmentNames: [],
  suppressionActive: false,
};

function evaluate(overrides: Record<string, unknown> = {}) {
  return evaluateCommunicationExecutionGate({
    mailbox: DESIRED_EVAVO_MAILBOXES.greg,
    material,
    approval: approval(),
    decisionPackage: decisionPackage(),
    review,
    runtimeSendingEnabled: true,
    now: new Date("2026-09-04T01:30:00Z"),
    ...overrides,
  });
}

test("exact approval-bound material and decision can pass when runtime sending is explicitly enabled", () => {
  const result = evaluate();
  assert.equal(result.allowed, true);
  assert.equal(result.approvalBindingValid, true);
  assert.equal(result.approvalContextValid, true);
  assert.equal(result.decisionValid, true);
});

test("legacy material-only approval remains inspectable but cannot execute", () => {
  const legacy = createCommunicationSendEnvelope({
    envelopeId: "legacy-approval",
    approvedAt: "2026-09-04T01:00:00Z",
    expiresAt: "2026-09-04T02:00:00Z",
    approvedBy: "greg",
    material,
  });
  const result = evaluate({ approval: legacy });
  assert.equal(result.allowed, false);
  assert.equal(result.approvalBindingValid, false);
  assert.ok(result.reasons.includes("approval_binding_missing"));
});

test("missing decision package cannot execute even with exact approved material", () => {
  const result = evaluate({ decisionPackage: null });
  assert.equal(result.allowed, false);
  assert.equal(result.decisionValid, false);
  assert.ok(result.reasons.includes("decision_package_missing"));
});

test("different decision package id cannot execute", () => {
  const different = { ...decisionPackage(), packageId: "decision-package-other" };
  const result = evaluate({ decisionPackage: different });
  assert.equal(result.allowed, false);
  assert.ok(result.reasons.includes("decision_package_id_mismatch"));
});

test("non-executable decision disposition cannot be sent", () => {
  const nonExecutable = { ...decisionPackage(), disposition: "escalate" as const, approvalGradeReady: false };
  const result = evaluate({ decisionPackage: nonExecutable });
  assert.equal(result.allowed, false);
  assert.ok(result.reasons.includes("decision_not_approval_grade_ready"));
  assert.ok(result.reasons.includes("decision_disposition_not_executable"));
});

test("runtime sending remains a distinct hard gate", () => {
  const result = evaluate({ runtimeSendingEnabled: false });
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
    decisionPackageId: "decision-package-1",
    evidenceIds: ["gmail:message-1"],
    approvalEvidenceIds: ["operator-approval:approval-eva"],
  });
  const result = evaluate({ mailbox: DESIRED_EVAVO_MAILBOXES.eva, material: evaMaterial, approval: evaApproval });
  assert.equal(result.allowed, false);
  assert.ok(result.reasons.includes("mailbox_not_fully_verified"));
});

test("post-approval body mutation blocks execution", () => {
  const result = evaluate({ material: { ...material, body: `${material.body}\nOne more thing.` } });
  assert.equal(result.allowed, false);
  assert.ok(result.reasons.includes("approved_material_changed"));
});

test("new recipient reply after approval invalidates execution even when approved material is unchanged", () => {
  const result = evaluate({
    contextChangesSinceDecision: [{
      id: "message-2",
      occurredAt: "2026-09-04T01:10:00Z",
      kind: "thread_message",
      material: true,
      summary: "Ashley sent another message with additional information.",
      evidenceIds: ["gmail:message-2"],
    }],
  });
  assert.equal(result.allowed, false);
  assert.equal(result.approvalValid, true);
  assert.equal(result.approvalContextValid, false);
  assert.ok(result.reasons.some((reason) => reason.includes("new_material_context:thread_message:message-2")));
});

test("non-material telemetry after approval does not invalidate execution", () => {
  const result = evaluate({
    contextChangesSinceDecision: [{
      id: "telemetry-1",
      occurredAt: "2026-09-04T01:10:00Z",
      kind: "other",
      material: false,
      summary: "Non-material internal telemetry changed.",
      evidenceIds: ["worker:telemetry-1"],
    }],
  });
  assert.equal(result.allowed, true);
});
