import assert from "node:assert/strict";
import test from "node:test";

import { buildCommunicationLifecycleReceipt } from "../src/core/businessCommunicationLifecycleReceipt";

const decision = {
  packageId: "pkg-1",
  decisionAt: "2026-09-04T01:00:00Z",
  disposition: "reply",
  evidenceIds: ["gmail:message-1", "ops:role-state-1"],
};

const approval = {
  envelopeId: "approval-1",
  approvedAt: "2026-09-04T01:10:00Z",
  materialSha256: "a".repeat(64),
};

const execution = {
  provider: "gmail",
  providerMessageId: "gmail-message-sent-1",
  sentAt: "2026-09-04T01:15:00Z",
  sender: "greg@evavo.com.au",
  recipientAddresses: ["ashley@example.com"],
};

const outcome = {
  assessedAt: "2026-09-04T02:00:00Z",
  result: "positive" as const,
  evidenceRefs: ["gmail:reply-2"],
};

test("represents the full decision to learned lifecycle", () => {
  const receipt = buildCommunicationLifecycleReceipt({
    lifecycleId: "life-1",
    relationshipId: "rel-1",
    threadId: "thread-1",
    decision,
    approval,
    execution,
    outcome,
    memory: {
      recordId: "mem2-outcome-1",
      receiptStatus: "appended",
      storageInstanceId: "local-primary",
      recordedAt: "2026-09-04T02:01:00Z",
    },
  });
  assert.equal(receipt.stage, "learned");
  assert.equal(receipt.communicationId, "gmail-message-sent-1");
});

test("cannot claim a send happened without an approval", () => {
  assert.throws(() => buildCommunicationLifecycleReceipt({
    lifecycleId: "life-2",
    relationshipId: "rel-1",
    threadId: "thread-1",
    decision,
    execution,
  }), /SEND_WITHOUT_APPROVAL/);
});

test("cannot mark a pending outcome as learned", () => {
  assert.throws(() => buildCommunicationLifecycleReceipt({
    lifecycleId: "life-3",
    relationshipId: "rel-1",
    threadId: "thread-1",
    decision,
    approval,
    execution,
    outcome: { ...outcome, result: "pending" },
    memory: {
      recordId: "mem2-pending-1",
      receiptStatus: "appended",
      storageInstanceId: "local-primary",
      recordedAt: "2026-09-04T02:01:00Z",
    },
  }), /PENDING_OUTCOME_CANNOT_BE_LEARNED/);
});

test("blockers dominate the visible lifecycle stage", () => {
  const receipt = buildCommunicationLifecycleReceipt({
    lifecycleId: "life-4",
    relationshipId: "rel-1",
    threadId: "thread-1",
    decision,
    approval,
    blockers: ["new_material_context:thread_message:message-2"],
  });
  assert.equal(receipt.stage, "blocked");
});
