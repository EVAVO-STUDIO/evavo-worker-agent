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
  to: ["client@example.com"], cc: [], bcc: [],
  threadId: "gmail-thread-1",
  replyMessageId: "gmail-message-1",
  subject: "Re: Delivery status",
  body: "Hi,\n\nThe delivery is currently awaiting your review.\n\nKind regards,\nGreg",
  attachments: [],
} as const;

function makeDecision(origin: "direct" | "relationship_manager_cycle" = "direct", cycleId?: string) {
  return buildCommunicationDecisionPackage({
    packageId: origin === "direct" ? "decision-exec-1" : `decision-${cycleId}`,
    origin,
    ...(cycleId ? { relationshipCycleId: cycleId } : {}),
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
}

const decision = makeDecision();

function approvalForDirect() {
  return createCommunicationSendEnvelope({
    envelopeId: "approval-direct",
    approvedAt: "2026-09-04T01:05:00Z",
    expiresAt: "2026-09-04T02:05:00Z",
    approvedBy: "greg",
    material,
    senderKey: "greg",
    mailboxKey: "greg",
    decisionPackageId: decision.packageId,
    evidenceIds: decision.evidenceIds,
    approvalEvidenceIds: ["operator-approval:direct"],
  });
}

function operatorApprovalFor(envelope: ReturnType<typeof createCommunicationSendEnvelope>): OperatorCommunicationApprovalReceipt {
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

const directApproval = approvalForDirect();
const directOperatorApproval = operatorApprovalFor(directApproval);
const review = { expectedRecipientAddresses: ["client@example.com"], prohibitedClaims: [], requiredPoints: ["awaiting your review"], referencedAttachmentNames: [], suppressionActive: false };

function directInput(overrides: Record<string, unknown> = {}) {
  return {
    mailbox: DESIRED_EVAVO_MAILBOXES.greg,
    material,
    approval: directApproval,
    operatorApprovalReceipt: directOperatorApproval,
    decisionPackage: decision,
    review,
    runtimeSendingEnabled: true,
    now: new Date("2026-09-04T01:30:00Z"),
    ...overrides,
  };
}

test("fully authorized direct decision produces v3 Gmail execution request", () => {
  const result = authorizeCommunicationExecutionRequest(directInput());
  assert.equal(result.gate.allowed, true);
  assert.ok(result.request);
  assert.equal(result.request?.contract, "business_communication_execution_request_v3");
  assert.equal(result.request?.authorization.decisionOrigin, "direct");
  assert.equal(result.request?.authorization.memoryCheckpoint, null);
  assert.equal(result.request?.authorization.approvalCandidate, null);
});

test("missing operator receipt produces no provider request", () => {
  const result = authorizeCommunicationExecutionRequest(directInput({ operatorApprovalReceipt: null }) as Parameters<typeof authorizeCommunicationExecutionRequest>[0]);
  assert.equal(result.gate.allowed, false);
  assert.equal(result.request, null);
});

test("changed body produces no provider request", () => {
  const result = authorizeCommunicationExecutionRequest(directInput({ material: { ...material, body: `${material.body}\nChanged after approval.` } }));
  assert.equal(result.gate.allowed, false);
  assert.equal(result.request, null);
});

test("asserting a request throws when runtime sending is disabled", () => {
  assert.throws(() => assertAuthorizedCommunicationExecutionRequest(directInput({ runtimeSendingEnabled: false })), /COMMUNICATION_EXECUTION_REQUEST_BLOCKED/);
});

function canonicalFixture(cycleId = "cycle-2") {
  const cycleDecision = makeDecision("relationship_manager_cycle", cycleId);
  const candidateEvidenceRef = `approval-candidate:${"c".repeat(64)}`;
  const approval = createCommunicationSendEnvelope({
    envelopeId: `approval-${cycleId}`,
    approvedAt: "2026-09-04T01:05:00Z",
    expiresAt: "2026-09-04T02:05:00Z",
    approvedBy: "greg",
    material,
    senderKey: "greg",
    mailboxKey: "greg",
    decisionPackageId: cycleDecision.packageId,
    evidenceIds: [...cycleDecision.evidenceIds, candidateEvidenceRef],
    approvalEvidenceIds: [candidateEvidenceRef],
    writingProvenance: {
      handoffId: `handoff-${cycleId}`,
      writingRequestId: `writing-request-${cycleId}`,
      decisionOrigin: "relationship_manager_cycle",
      relationshipCycleId: cycleId,
    },
  });
  const persistence: RelationshipManagerMemoryPersistenceResult = {
    contract: "business_relationship_manager_memory_persistence_v1",
    cycleId,
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
  const approvalCandidate = {
    candidateId: `approval-candidate-${cycleId}`,
    candidateSha256: "d".repeat(64),
    recordId: `approval-candidate-record-${cycleId}`,
    evidenceRef: candidateEvidenceRef,
  } as const;
  return { cycleDecision, approval, operatorApproval: operatorApprovalFor(approval), persistence, approvalCandidate };
}

test("canonical relationship cycle cannot produce request without durable memory", () => {
  const fixture = canonicalFixture("cycle-missing-memory");
  const result = authorizeCommunicationExecutionRequest({
    mailbox: DESIRED_EVAVO_MAILBOXES.greg,
    material,
    approval: fixture.approval,
    operatorApprovalReceipt: fixture.operatorApproval,
    decisionPackage: fixture.cycleDecision,
    approvalCandidate: fixture.approvalCandidate,
    review,
    runtimeSendingEnabled: true,
    now: new Date("2026-09-04T01:30:00Z"),
  });
  assert.equal(result.gate.memoryCheckpointValid, false);
  assert.equal(result.request, null);
});

test("canonical relationship cycle requires persisted approval candidate authorization", () => {
  const fixture = canonicalFixture();
  assert.throws(() => authorizeCommunicationExecutionRequest({
    mailbox: DESIRED_EVAVO_MAILBOXES.greg,
    material,
    approval: fixture.approval,
    operatorApprovalReceipt: fixture.operatorApproval,
    decisionPackage: fixture.cycleDecision,
    relationshipManagerMemoryPersistence: fixture.persistence,
    review,
    runtimeSendingEnabled: true,
    now: new Date("2026-09-04T01:30:00Z"),
  }), /APPROVAL_CANDIDATE_REQUIRED/);
});

test("canonical relationship cycle request carries memory, writing and persisted candidate provenance", () => {
  const fixture = canonicalFixture();
  const result = authorizeCommunicationExecutionRequest({
    mailbox: DESIRED_EVAVO_MAILBOXES.greg,
    material,
    approval: fixture.approval,
    operatorApprovalReceipt: fixture.operatorApproval,
    decisionPackage: fixture.cycleDecision,
    relationshipManagerMemoryPersistence: fixture.persistence,
    approvalCandidate: fixture.approvalCandidate,
    review,
    runtimeSendingEnabled: true,
    now: new Date("2026-09-04T01:30:00Z"),
  });
  assert.equal(result.gate.allowed, true);
  assert.equal(result.request?.authorization.decisionOrigin, "relationship_manager_cycle");
  assert.equal(result.request?.authorization.relationshipCycleId, "cycle-2");
  assert.deepEqual(result.request?.authorization.memoryCheckpoint?.recordIds, ["mem-1", "mem-2"]);
  assert.equal(result.request?.authorization.writingProvenance?.writingRequestId, "writing-request-cycle-2");
  assert.equal(result.request?.authorization.approvalCandidate?.recordId, "approval-candidate-record-cycle-2");
});
