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

test("direct lifecycle remains fully verified without Relationship Manager candidate provenance", () => {
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
  assert.equal(receipt.contract, "business_communication_lifecycle_receipt_v4");
  assert.equal(receipt.stage, "learned");
  assert.equal(receipt.executionVerified, true);
  assert.equal(receipt.communicationId, "gmail-message-sent-1");
  assert.equal(receipt.decision.origin, "direct");
});

test("cannot claim a send happened without an approval", () => {
  assert.throws(() => buildCommunicationLifecycleReceipt({
    lifecycleId: "life-2", relationshipId: "rel-1", threadId: "thread-1", decision, execution,
  }), /SEND_WITHOUT_APPROVAL/);
});

test("legacy unreconciled execution remains readable but blocked", () => {
  const receipt = buildCommunicationLifecycleReceipt({
    lifecycleId: "life-legacy",
    relationshipId: "rel-1",
    threadId: "thread-1",
    decision,
    approval: { envelopeId: "legacy-approval", approvedAt: "2026-09-04T01:10:00Z", materialSha256: "a".repeat(64) },
    execution: {
      provider: "gmail", providerMessageId: "legacy-message", sentAt: "2026-09-04T01:15:00Z",
      sender: "greg@evavo.com.au", recipientAddresses: ["ashley@example.com"],
    },
  });
  assert.equal(receipt.stage, "blocked");
  assert.equal(receipt.executionVerified, false);
  assert.equal(receipt.communicationId, null);
});

test("pending outcome cannot be learned", () => {
  assert.throws(() => buildCommunicationLifecycleReceipt({
    lifecycleId: "life-pending",
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

function relationshipFixture() {
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
  const approvalCandidate = {
    candidateId: "approval-candidate-1",
    candidateSha256: "d".repeat(64),
    recordId: "approval-candidate-record-1",
    evidenceRef: `approval-candidate:${"c".repeat(64)}`,
  };
  const relationshipApproval = {
    ...approval,
    approvalEvidenceIds: [approvalCandidate.evidenceRef],
    writingProvenance,
    approvalCandidate,
  };
  const relationshipExecution = {
    ...execution,
    decisionOrigin: "relationship_manager_cycle" as const,
    relationshipCycleId: "cycle-1",
    writingProvenance,
    approvalCandidate,
    memoryCheckpointCycleId: "cycle-1",
    memoryCheckpointRecordIds: ["mem-cycle-1"],
  };
  return { relationshipDecision, writingProvenance, approvalCandidate, relationshipApproval, relationshipExecution };
}

test("Relationship Manager lifecycle requires durable cycle, writing and persisted candidate provenance", () => {
  const fixture = relationshipFixture();
  const verified = buildCommunicationLifecycleReceipt({
    lifecycleId: "life-cycle-verified",
    relationshipId: "rel-1",
    threadId: "thread-1",
    decision: fixture.relationshipDecision,
    approval: fixture.relationshipApproval,
    execution: fixture.relationshipExecution,
  });
  assert.equal(verified.executionVerified, true);
  assert.equal(verified.stage, "sent");
  assert.equal(verified.approval?.approvalCandidate?.recordId, "approval-candidate-record-1");
  assert.equal(verified.execution?.approvalCandidate?.candidateSha256, "d".repeat(64));
});

test("Relationship Manager lifecycle blocks when persisted candidate differs between approval and execution", () => {
  const fixture = relationshipFixture();
  const receipt = buildCommunicationLifecycleReceipt({
    lifecycleId: "life-cycle-candidate-mismatch",
    relationshipId: "rel-1",
    threadId: "thread-1",
    decision: fixture.relationshipDecision,
    approval: fixture.relationshipApproval,
    execution: {
      ...fixture.relationshipExecution,
      approvalCandidate: { ...fixture.approvalCandidate, recordId: "approval-candidate-record-other" },
    },
  });
  assert.equal(receipt.executionVerified, false);
  assert.equal(receipt.stage, "blocked");
});

test("Relationship Manager lifecycle blocks when Writing Studio request differs", () => {
  const fixture = relationshipFixture();
  const receipt = buildCommunicationLifecycleReceipt({
    lifecycleId: "life-cycle-writing-mismatch",
    relationshipId: "rel-1",
    threadId: "thread-1",
    decision: fixture.relationshipDecision,
    approval: fixture.relationshipApproval,
    execution: {
      ...fixture.relationshipExecution,
      writingProvenance: { ...fixture.writingProvenance, writingRequestId: "writing-request-other" },
    },
  });
  assert.equal(receipt.executionVerified, false);
  assert.equal(receipt.stage, "blocked");
});
