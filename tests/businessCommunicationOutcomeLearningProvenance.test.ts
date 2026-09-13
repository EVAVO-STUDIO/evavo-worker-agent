import assert from "node:assert/strict";
import test from "node:test";

import { buildCommunicationLifecycleReceipt } from "../src/core/businessCommunicationLifecycleReceipt";
import { deriveCommunicationOutcomeLearningProvenance } from "../src/core/businessCommunicationOutcomeLearningProvenance";

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

function verifiedLifecycle() {
  return buildCommunicationLifecycleReceipt({
    lifecycleId: "life-1",
    relationshipId: "relationship-1",
    threadId: "thread-1",
    decision: {
      packageId: "relationship-cycle:cycle-1",
      origin: "relationship_manager_cycle",
      relationshipCycleId: "cycle-1",
      decisionAt: "2026-09-04T01:00:00Z",
      disposition: "reply",
      evidenceIds: ["gmail:m1"],
    },
    approval: {
      envelopeId: "approval-1",
      approvedAt: "2026-09-04T01:05:00Z",
      materialSha256: "a".repeat(64),
      approvalBindingSha256: "b".repeat(64),
      decisionPackageId: "relationship-cycle:cycle-1",
      approvalEvidenceIds: [approvalCandidate.evidenceRef],
      writingProvenance,
      approvalCandidate,
    },
    execution: {
      provider: "gmail",
      providerMessageId: "gmail-sent-1",
      providerThreadId: "thread-1",
      requestId: "gmail-send:approval-1:abc",
      sentAt: "2026-09-04T01:06:00Z",
      sender: "greg@evavo.com.au",
      recipientAddresses: ["client@example.com"],
      sourceEvidenceRefs: ["gmail:message:gmail-sent-1"],
      materialSha256: "a".repeat(64),
      approvalBindingSha256: "b".repeat(64),
      decisionPackageId: "relationship-cycle:cycle-1",
      decisionOrigin: "relationship_manager_cycle",
      relationshipCycleId: "cycle-1",
      writingProvenance,
      approvalCandidate,
      memoryCheckpointCycleId: "cycle-1",
      memoryCheckpointRecordIds: ["memory:1"],
    },
  });
}

test("derives decision, Writing Studio and persisted approval-candidate lineage only from verified execution", () => {
  const result = deriveCommunicationOutcomeLearningProvenance(verifiedLifecycle());
  assert.equal(result.contract, "business_communication_outcome_learning_provenance_v2");
  assert.equal(result.provenance.decisionPackageId, "relationship-cycle:cycle-1");
  assert.equal(result.provenance.relationshipCycleId, "cycle-1");
  assert.equal(result.provenance.handoffId, "handoff-1");
  assert.equal(result.provenance.writingRequestId, "writing-request-1");
  assert.equal(result.provenance.approvalCandidateId, "approval-candidate-1");
  assert.equal(result.provenance.approvalCandidateSha256, "d".repeat(64));
  assert.equal(result.provenance.approvalCandidateRecordId, "approval-candidate-record-1");
  assert.equal(result.provenance.providerMessageId, "gmail-sent-1");
});

test("cannot derive learning provenance from an unverified send", () => {
  const lifecycle = verifiedLifecycle();
  const unverified = { ...lifecycle, executionVerified: false };
  assert.throws(() => deriveCommunicationOutcomeLearningProvenance(unverified), /EXECUTION_NOT_VERIFIED/);
});
