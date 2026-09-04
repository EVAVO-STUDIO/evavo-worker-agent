import assert from "node:assert/strict";
import test from "node:test";

import { DESIRED_EVAVO_MAILBOXES } from "../src/core/businessMailboxRegistry";
import { buildCommunicationDecisionPackage } from "../src/core/businessCommunicationDecisionPackage";
import { evaluateCommunicationExecutionGate } from "../src/core/businessCommunicationExecutionGate";
import { createCommunicationSendEnvelope } from "../src/core/businessCommunicationSendEnvelope";

const cycleId = "relationship-cycle-1";
const decisionPackageId = "decision-package-cycle-1";
const material = {
  sender: "greg@evavo.com.au",
  to: ["client@example.com"],
  cc: [],
  bcc: [],
  threadId: "thread-cycle-1",
  replyMessageId: "message-cycle-1",
  subject: "Re: Status",
  body: "Hi,\n\nThanks for checking in. The current status is unchanged from the latest verified project record.\n\nKind regards,\nGreg",
  attachments: [],
} as const;

function decision() {
  return buildCommunicationDecisionPackage({
    packageId: decisionPackageId,
    scenario: "general",
    objective: "Answer the current status question from verified evidence.",
    thread: {
      threadId: material.threadId,
      previousState: [],
      latestObservedState: [{
        id: "question-cycle-1",
        kind: "question",
        statement: "What is the current status?",
        status: "open",
        owner: "evavo",
        sourceEvidenceIds: ["gmail:message-cycle-1"],
      }],
    },
    obligations: [],
    channel: { currentChannel: "email", canResolveInWriting: true },
    evidenceIds: ["gmail:message-cycle-1"],
    evidenceConfidence: 98,
    decisionAt: "2026-09-04T00:59:00Z",
    origin: "relationship_manager_cycle",
    relationshipCycleId: cycleId,
  });
}

function approval(relationshipCycleId = cycleId) {
  return createCommunicationSendEnvelope({
    envelopeId: "approval-cycle-1",
    approvedAt: "2026-09-04T01:00:00Z",
    expiresAt: "2026-09-04T02:00:00Z",
    approvedBy: "greg",
    material,
    senderKey: "greg",
    mailboxKey: "greg",
    decisionPackageId,
    evidenceIds: ["gmail:message-cycle-1"],
    approvalEvidenceIds: ["operator-approval:cycle-1"],
    writingProvenance: {
      handoffId: "handoff-cycle-1",
      writingRequestId: "writing-request-cycle-1",
      decisionOrigin: "relationship_manager_cycle",
      relationshipCycleId,
    },
  });
}

function operatorApproval(envelope = approval()) {
  return {
    contract: "business_communication_operator_approval_v1" as const,
    approvalId: "operator-approval-cycle-1",
    authority: "human_operator" as const,
    approverId: "greg",
    approvedAt: envelope.approvedAt,
    expiresAt: envelope.expiresAt,
    materialSha256: envelope.materialSha256,
    decisionPackageId,
    senderKey: "greg" as const,
    mailboxKey: "greg" as const,
    evidenceRefs: ["operator-approval:cycle-1"],
    sourceSystem: "operator_approval" as const,
  };
}

const memoryPersistence = {
  contract: "business_relationship_manager_memory_persistence_v1" as const,
  cycleId,
  durable: true,
  materialObservations: 2,
  durableObservations: 2,
  skippedObservations: 0,
  rejectedObservations: 0,
  recordIds: ["memory:cycle-1"],
  receipts: [],
  blockers: [],
  externalEffectPerformed: false as const,
};

const review = {
  expectedRecipientAddresses: ["client@example.com"],
  prohibitedClaims: [],
  requiredPoints: ["current status"],
  referencedAttachmentNames: [],
  suppressionActive: false,
};

function evaluate(envelope = approval()) {
  return evaluateCommunicationExecutionGate({
    mailbox: DESIRED_EVAVO_MAILBOXES.greg,
    material,
    approval: envelope,
    operatorApprovalReceipt: operatorApproval(envelope),
    decisionPackage: decision(),
    relationshipManagerMemoryPersistence: memoryPersistence,
    review,
    runtimeSendingEnabled: true,
    now: new Date("2026-09-04T01:30:00Z"),
  });
}

test("canonical Relationship Manager decision can execute only with matching writing provenance and durable memory", () => {
  const result = evaluate();
  assert.equal(result.allowed, true);
  assert.equal(result.decisionValid, true);
  assert.equal(result.memoryCheckpointValid, true);
});

test("canonical Relationship Manager decision is blocked when approved draft provenance is missing", () => {
  const missing = createCommunicationSendEnvelope({
    envelopeId: "approval-cycle-missing-writing",
    approvedAt: "2026-09-04T01:00:00Z",
    expiresAt: "2026-09-04T02:00:00Z",
    approvedBy: "greg",
    material,
    senderKey: "greg",
    mailboxKey: "greg",
    decisionPackageId,
    evidenceIds: ["gmail:message-cycle-1"],
    approvalEvidenceIds: ["operator-approval:cycle-1"],
  });
  const result = evaluateCommunicationExecutionGate({
    mailbox: DESIRED_EVAVO_MAILBOXES.greg,
    material,
    approval: missing,
    operatorApprovalReceipt: operatorApproval(missing),
    decisionPackage: decision(),
    relationshipManagerMemoryPersistence: memoryPersistence,
    review,
    runtimeSendingEnabled: true,
    now: new Date("2026-09-04T01:30:00Z"),
  });
  assert.equal(result.allowed, false);
  assert.ok(result.reasons.includes("decision_writing_provenance_missing"));
});

test("canonical Relationship Manager decision is blocked when writing provenance points at another cycle", () => {
  const result = evaluate(approval("relationship-cycle-other"));
  assert.equal(result.allowed, false);
  assert.ok(result.reasons.includes("decision_writing_relationship_cycle_mismatch"));
});
