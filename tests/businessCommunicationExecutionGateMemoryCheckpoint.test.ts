import assert from "node:assert/strict";
import test from "node:test";

import { DESIRED_EVAVO_MAILBOXES } from "../src/core/businessMailboxRegistry";
import { evaluateCommunicationExecutionGate } from "../src/core/businessCommunicationExecutionGate";
import { createCommunicationSendEnvelope } from "../src/core/businessCommunicationSendEnvelope";
import { persistRelationshipManagerCycleMemory } from "../src/core/businessRelationshipManagerMemoryPersistence";
import { runRelationshipManagerCommunicationCycle } from "../src/core/businessRelationshipManagerRuntime";

const material = {
  sender: "greg@evavo.com.au",
  to: ["client@example.com"],
  cc: [],
  bcc: [],
  threadId: "thread-cycle-1",
  replyMessageId: "m1",
  subject: "Re: Status",
  body: "Hi,\n\nThe current status is confirmed in our project record.\n\nKind regards,\nGreg",
  attachments: [],
} as const;

function cycle() {
  return runRelationshipManagerCommunicationCycle({
    cycleId: "cycle-send-1",
    observedAt: "2026-09-04T01:00:30Z",
    decisionAt: "2026-09-04T01:01:00Z",
    scenario: "general",
    objective: "Answer the current status question.",
    gmail: {
      threadId: "thread-cycle-1",
      relationshipId: "rel-cycle-1",
      personId: "person-cycle-1",
      messages: [{
        id: "m1",
        threadId: "thread-cycle-1",
        sentAt: "2026-09-04T01:00:00Z",
        from: { name: "Client", address: "client@example.com" },
        to: [{ name: "Greg", address: "greg@evavo.com.au" }],
        subject: "Status",
        body: "Could you please confirm the current status?",
      }],
    },
    identity: {
      contract: "business_relationship_identity_resolver_v1",
      status: "verified",
      selected: {
        personId: "person-cycle-1",
        name: "Client",
        addresses: ["client@example.com"],
        evidence: [{ source: "gmail", ref: "gmail:message:m1", confidence: 100 }],
      },
      confidence: 100,
      exactAddressMatch: true,
      reasons: ["Exact address match."],
      competingPersonIds: [],
    },
    channel: { currentChannel: "email", canResolveInWriting: true },
    evidenceConfidence: 96,
    additionalEvidenceIds: ["operations:project:status"],
  });
}

function approval(decisionPackageId: string, evidenceIds: readonly string[]) {
  return createCommunicationSendEnvelope({
    envelopeId: "approval-cycle-1",
    approvedAt: "2026-09-04T01:10:00Z",
    expiresAt: "2026-09-04T02:10:00Z",
    approvedBy: "greg",
    material,
    senderKey: "greg",
    mailboxKey: "greg",
    decisionPackageId,
    evidenceIds,
    approvalEvidenceIds: ["operator-approval:cycle-1"],
  });
}

async function durableCheckpoint() {
  return persistRelationshipManagerCycleMemory({
    cycle: cycle(),
    write: async (request) => ({
      contract: "evavo-memory-ingestion-receipt-v2",
      requestId: request.requestId,
      idempotencyKey: request.idempotencyKey,
      sourceRef: request.observation.sourceRef,
      status: "appended",
      durable: true,
      recordId: `mem:${request.requestId}`,
      reasons: [],
    }),
  });
}

function operatorApproval(envelope: ReturnType<typeof approval>) {
  return {
    contract: "business_communication_operator_approval_v1" as const,
    approvalId: "operator-approval-cycle-1",
    authority: "human_operator" as const,
    approverId: "greg",
    approvedAt: envelope.approvedAt,
    expiresAt: envelope.expiresAt,
    materialSha256: envelope.materialSha256,
    decisionPackageId: envelope.approvalBinding!.decisionPackageId,
    senderKey: "greg" as const,
    mailboxKey: "greg" as const,
    evidenceRefs: ["operator-approval:cycle-1"],
    sourceSystem: "operator_approval" as const,
  };
}

function review() {
  return {
    expectedRecipientAddresses: ["client@example.com"],
    prohibitedClaims: [],
    requiredPoints: ["current status"],
    referencedAttachmentNames: [],
    suppressionActive: false,
  };
}

test("canonical Relationship Manager decision cannot execute without its durable memory checkpoint", () => {
  const current = cycle();
  const envelope = approval(current.decision.packageId, current.decision.evidenceIds);
  const result = evaluateCommunicationExecutionGate({
    mailbox: DESIRED_EVAVO_MAILBOXES.greg,
    material,
    approval: envelope,
    operatorApprovalReceipt: operatorApproval(envelope),
    decisionPackage: current.decision,
    review: review(),
    runtimeSendingEnabled: true,
    now: new Date("2026-09-04T01:20:00Z"),
  });
  assert.equal(result.allowed, false);
  assert.equal(result.memoryCheckpointValid, false);
  assert.ok(result.reasons.includes("relationship_manager_memory_checkpoint_missing"));
});

test("matching durable cycle checkpoint unlocks only the memory portion of the execution gate", async () => {
  const current = cycle();
  const persistence = await durableCheckpoint();
  const envelope = approval(current.decision.packageId, current.decision.evidenceIds);
  const result = evaluateCommunicationExecutionGate({
    mailbox: DESIRED_EVAVO_MAILBOXES.greg,
    material,
    approval: envelope,
    operatorApprovalReceipt: operatorApproval(envelope),
    decisionPackage: current.decision,
    relationshipManagerMemoryPersistence: persistence,
    review: review(),
    runtimeSendingEnabled: true,
    now: new Date("2026-09-04T01:20:00Z"),
  });
  assert.equal(persistence.durable, true);
  assert.equal(result.memoryCheckpointValid, true);
  assert.equal(result.allowed, true);
});

test("wrong cycle checkpoint fails closed", async () => {
  const current = cycle();
  const persistence = { ...(await durableCheckpoint()), cycleId: "different-cycle" };
  const envelope = approval(current.decision.packageId, current.decision.evidenceIds);
  const result = evaluateCommunicationExecutionGate({
    mailbox: DESIRED_EVAVO_MAILBOXES.greg,
    material,
    approval: envelope,
    operatorApprovalReceipt: operatorApproval(envelope),
    decisionPackage: current.decision,
    relationshipManagerMemoryPersistence: persistence,
    review: review(),
    runtimeSendingEnabled: true,
    now: new Date("2026-09-04T01:20:00Z"),
  });
  assert.equal(result.allowed, false);
  assert.ok(result.reasons.includes("relationship_manager_memory_checkpoint_cycle_mismatch"));
});

test("checkpoint with blockers cannot authorize execution", async () => {
  const current = cycle();
  const durable = await durableCheckpoint();
  const persistence = { ...durable, durable: false, blockers: ["memory write rejected"] };
  const envelope = approval(current.decision.packageId, current.decision.evidenceIds);
  const result = evaluateCommunicationExecutionGate({
    mailbox: DESIRED_EVAVO_MAILBOXES.greg,
    material,
    approval: envelope,
    operatorApprovalReceipt: operatorApproval(envelope),
    decisionPackage: current.decision,
    relationshipManagerMemoryPersistence: persistence,
    review: review(),
    runtimeSendingEnabled: true,
    now: new Date("2026-09-04T01:20:00Z"),
  });
  assert.equal(result.allowed, false);
  assert.ok(result.reasons.includes("relationship_manager_memory_checkpoint_not_durable"));
  assert.ok(result.reasons.includes("relationship_manager_memory_checkpoint_has_blockers"));
});
