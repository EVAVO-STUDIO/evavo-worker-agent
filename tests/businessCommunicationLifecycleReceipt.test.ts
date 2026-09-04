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
  approvalBindingSha256: "b".repeat(64),
  decisionPackageId: "pkg-1",
  approvalEvidenceIds: ["operator-approval:approval-1"],
};

const execution = {
  provider: "gmail",
  providerMessageId: "gmail-message-sent-1",
  providerThreadId: "thread-1",
  requestId: "gmail-send:approval-1:abc",
  sentAt: "2026-09-04T01:15:00Z",
  sender: "greg@evavo.com.au",
  recipientAddresses: ["ashley@example.com"],
  sourceEvidenceRefs: ["gmail:message:gmail-message-sent-1"],
  materialSha256: "a".repeat(64),
  approvalBindingSha256: "b".repeat(64),
  decisionPackageId: "pkg-1",
};

const outcome = {
  assessedAt: "2026-09-04T02:00:00Z",
  result: "positive" as const,
  evidenceRefs: ["gmail:reply-2"],
};

test("represents the full verified decision to learned lifecycle", () => {
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
  assert.equal(receipt.contract, "business_communication_lifecycle_receipt_v3");
  assert.equal(receipt.stage, "learned");
  assert.equal(receipt.executionVerified, true);
  assert.equal(receipt.communicationId, "gmail-message-sent-1");
  assert.equal(receipt.decision.origin, "direct");
  assert.equal(receipt.decision.relationshipCycleId, null);
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

test("legacy unreconciled execution remains readable but is blocked rather than sent", () => {
  const receipt = buildCommunicationLifecycleReceipt({
    lifecycleId: "life-legacy",
    relationshipId: "rel-1",
    threadId: "thread-1",
    decision,
    approval: {
      envelopeId: "legacy-approval",
      approvedAt: "2026-09-04T01:10:00Z",
      materialSha256: "a".repeat(64),
    },
    execution: {
      provider: "gmail",
      providerMessageId: "legacy-message",
      sentAt: "2026-09-04T01:15:00Z",
      sender: "greg@evavo.com.au",
      recipientAddresses: ["ashley@example.com"],
    },
  });
  assert.equal(receipt.stage, "blocked");
  assert.equal(receipt.executionVerified, false);
  assert.equal(receipt.communicationId, null);
  assert.ok(receipt.blockers.includes("execution_not_reconciled_to_authorized_request"));
});

test("cannot attach an outcome to an unverified historical execution", () => {
  assert.throws(() => buildCommunicationLifecycleReceipt({
    lifecycleId: "life-unverified-outcome",
    relationshipId: "rel-1",
    threadId: "thread-1",
    decision,
    approval: {
      envelopeId: "legacy-approval",
      approvedAt: "2026-09-04T01:10:00Z",
      materialSha256: "a".repeat(64),
    },
    execution: {
      provider: "gmail",
      providerMessageId: "legacy-message",
      sentAt: "2026-09-04T01:15:00Z",
      sender: "greg@evavo.com.au",
      recipientAddresses: ["ashley@example.com"],
    },
    outcome,
  }), /OUTCOME_WITHOUT_VERIFIED_EXECUTION/);
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

test("Relationship Manager lifecycle requires both durable cycle and matching Writing Studio provenance", () => {
  const relationshipDecision = {
    ...decision,
    origin: "relationship_manager_cycle" as const,
    relationshipCycleId: "cycle-1",
  };
  const writingProvenance = {
    handoffId: "handoff-1",
    writingRequestId: "writing-request-1",
    decisionOrigin: "relationship_manager_cycle" as const,
    relationshipCycleId: "cycle-1",
  };
  const missing = buildCommunicationLifecycleReceipt({
    lifecycleId: "life-cycle-missing",
    relationshipId: "rel-1",
    threadId: "thread-1",
    decision: relationshipDecision,
    approval,
    execution: {
      ...execution,
      decisionOrigin: "relationship_manager_cycle",
      relationshipCycleId: "cycle-1",
    },
  });
  assert.equal(missing.executionVerified, false);
  assert.equal(missing.stage, "blocked");

  const verified = buildCommunicationLifecycleReceipt({
    lifecycleId: "life-cycle-verified",
    relationshipId: "rel-1",
    threadId: "thread-1",
    decision: relationshipDecision,
    approval: { ...approval, writingProvenance },
    execution: {
      ...execution,
      decisionOrigin: "relationship_manager_cycle",
      relationshipCycleId: "cycle-1",
      writingProvenance,
      memoryCheckpointCycleId: "cycle-1",
      memoryCheckpointRecordIds: ["mem-cycle-1"],
    },
  });
  assert.equal(verified.executionVerified, true);
  assert.equal(verified.stage, "sent");
  assert.equal(verified.approval?.writingProvenance?.writingRequestId, "writing-request-1");
});

test("Relationship Manager lifecycle blocks when approval and execution came from different Writing Studio requests", () => {
  const relationshipDecision = {
    ...decision,
    origin: "relationship_manager_cycle" as const,
    relationshipCycleId: "cycle-1",
  };
  const approvedWriting = {
    handoffId: "handoff-1",
    writingRequestId: "writing-request-approved",
    decisionOrigin: "relationship_manager_cycle" as const,
    relationshipCycleId: "cycle-1",
  };
  const executedWriting = { ...approvedWriting, writingRequestId: "writing-request-other" };
  const receipt = buildCommunicationLifecycleReceipt({
    lifecycleId: "life-cycle-writing-mismatch",
    relationshipId: "rel-1",
    threadId: "thread-1",
    decision: relationshipDecision,
    approval: { ...approval, writingProvenance: approvedWriting },
    execution: {
      ...execution,
      decisionOrigin: "relationship_manager_cycle",
      relationshipCycleId: "cycle-1",
      writingProvenance: executedWriting,
      memoryCheckpointCycleId: "cycle-1",
      memoryCheckpointRecordIds: ["mem-cycle-1"],
    },
  });
  assert.equal(receipt.executionVerified, false);
  assert.equal(receipt.stage, "blocked");
});
