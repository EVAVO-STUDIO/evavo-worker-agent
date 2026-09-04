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
import type { RelationshipManagerMemoryPersistenceResult } from "../src/core/businessRelationshipManagerMemoryPersistence";

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

function approvalFor(decisionPackageId = decision.packageId, evidenceIds: readonly string[] = decision.evidenceIds) {
  return createCommunicationSendEnvelope({
    envelopeId: `approval-${decisionPackageId}`,
    approvedAt: "2026-09-04T01:05:00Z",
    expiresAt: "2026-09-04T02:05:00Z",
    approvedBy: "greg",
    material,
    senderKey: "greg",
    mailboxKey: "greg",
    decisionPackageId,
    evidenceIds,
    approvalEvidenceIds: [`operator-approval:${decisionPackageId}`],
  });
}

function operatorApprovalFor(envelope: ReturnType<typeof approvalFor>): OperatorCommunicationApprovalReceipt {
  return {
    contract: "business_communication_operator_approval_v1",
    approvalId: `operator-${envelope.envelopeId}`,
    authority: "human_operator",
    approverId: "greg",
    approvedAt: envelope.approvedAt,
    expiresAt: envelope.expiresAt,
    materialSha256: envelope.materialSha256,
    decisionPackageId: envelope.approvalBinding!.decisionPackageId,
    senderKey: "greg",
    mailboxKey: "greg",
    evidenceRefs: envelope.approvalBinding!.approvalEvidenceIds,
    sourceSystem: "operator_approval",
  };
}

const approval = approvalFor();
const operatorApproval = operatorApprovalFor(approval);
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
  assert.equal(result.request?.contract, "business_communication_execution_request_v2");
  assert.equal(result.request?.provider, "gmail");
  assert.equal(result.request?.authorization.operatorApprovalId, operatorApproval.approvalId);
  assert.equal(result.request?.authorization.operatorApprovalSource, "operator_approval");
  assert.equal(result.request?.authorization.approvalBindingSha256, approval.approvalBinding?.bindingSha256);
  assert.equal(result.request?.authorization.decisionOrigin, "direct");
  assert.equal(result.request?.authorization.memoryCheckpoint, null);
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

test("canonical relationship cycle cannot produce a provider request without durable memory", () => {
  const cycleDecision = buildCommunicationDecisionPackage({
    packageId: "decision-cycle-1",
    origin: "relationship_manager_cycle",
    relationshipCycleId: "cycle-1",
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
  const cycleApproval = approvalFor(cycleDecision.packageId, cycleDecision.evidenceIds);
  const result = authorizeCommunicationExecutionRequest({
    mailbox: DESIRED_EVAVO_MAILBOXES.greg,
    material,
    approval: cycleApproval,
    operatorApprovalReceipt: operatorApprovalFor(cycleApproval),
    decisionPackage: cycleDecision,
    review,
    runtimeSendingEnabled: true,
    now: new Date("2026-09-04T01:30:00Z"),
  });
  assert.equal(result.gate.memoryCheckpointValid, false);
  assert.equal(result.request, null);
});

test("canonical relationship cycle request carries its exact durable checkpoint", () => {
  const cycleDecision = buildCommunicationDecisionPackage({
    packageId: "decision-cycle-2",
    origin: "relationship_manager_cycle",
    relationshipCycleId: "cycle-2",
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
  const cycleApproval = approvalFor(cycleDecision.packageId, cycleDecision.evidenceIds);
  const persistence: RelationshipManagerMemoryPersistenceResult = {
    contract: "business_relationship_manager_memory_persistence_v1",
    cycleId: "cycle-2",
    durable: true,
    materialObservations: 2,
    durableObservations: 2,
    skippedObservations: 0,
    rejectedObservations: 0,
    recordIds: ["mem-1", "mem-2"],
    receipts: [],
    blockers: [],
    externalEffectPerformed: false,
  };
  const result = authorizeCommunicationExecutionRequest({
    mailbox: DESIRED_EVAVO_MAILBOXES.greg,
    material,
    approval: cycleApproval,
    operatorApprovalReceipt: operatorApprovalFor(cycleApproval),
    decisionPackage: cycleDecision,
    relationshipManagerMemoryPersistence: persistence,
    review,
    runtimeSendingEnabled: true,
    now: new Date("2026-09-04T01:30:00Z"),
  });
  assert.equal(result.gate.allowed, true);
  assert.equal(result.request?.authorization.decisionOrigin, "relationship_manager_cycle");
  assert.equal(result.request?.authorization.relationshipCycleId, "cycle-2");
  assert.deepEqual(result.request?.authorization.memoryCheckpoint?.recordIds, ["mem-1", "mem-2"]);
});
