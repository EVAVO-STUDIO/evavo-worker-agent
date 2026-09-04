import assert from "node:assert/strict";
import test from "node:test";

import type { EvavoStorageApprovalCandidatePort } from "../src/core/businessEvavoStorageApprovalCandidatePort";
import {
  persistRelationshipManagerApprovalCandidate,
} from "../src/core/businessRelationshipManagerApprovalPersistenceRuntime";
import type { RelationshipManagerApprovalPreparation } from "../src/core/businessRelationshipManagerApprovalRuntime";
import {
  approvalCandidatePersistenceEvidenceRef,
  staffApprovalCandidateHash,
  type StaffApprovalCandidatePersistenceResult,
} from "../src/core/businessStaffCommunicationApprovalCandidatePersistence";
import type { StaffCommunicationApprovalCandidate } from "../src/core/businessStaffCommunicationApprovalCandidate";

function candidate(): StaffCommunicationApprovalCandidate {
  return {
    contract: "business_staff_communication_approval_candidate_v2",
    candidateId: "candidate-persist-runtime-1",
    createdAt: "2026-09-04T09:00:00.000Z",
    decisionPackageId: "decision-persist-runtime-1",
    decisionOrigin: "relationship_manager_cycle",
    relationshipCycleId: "cycle-persist-runtime-1",
    relationshipId: "relationship-persist-runtime-1",
    handoffId: "handoff-persist-runtime-1",
    writingRequestId: "writing-request-persist-runtime-1",
    writingPackageId: "writing-package-persist-runtime-1",
    writingCandidateId: "writing-candidate-persist-runtime-1",
    senderKey: "greg",
    mailboxKey: "greg",
    writingProvenance: {
      handoffId: "handoff-persist-runtime-1",
      writingRequestId: "writing-request-persist-runtime-1",
      decisionOrigin: "relationship_manager_cycle",
      relationshipCycleId: "cycle-persist-runtime-1",
    },
    material: {
      sender: "greg@evavo.com.au",
      to: ["client@example.com"],
      cc: [],
      bcc: [],
      threadId: "thread-persist-runtime-1",
      replyMessageId: "message-persist-runtime-1",
      subject: "Re: Status",
      body: "Hi,\n\nHere is the verified status.\n\nKind regards,\nGreg",
      attachments: [],
    },
    materialSha256: "a".repeat(64),
    evidenceIds: ["gmail:message:persist-runtime-1"],
    writingSourceRefs: ["gmail:message:persist-runtime-1"],
    readyForHumanApproval: true,
    externalEffectPerformed: false,
  };
}

function preparation(): RelationshipManagerApprovalPreparation {
  return {
    contract: "business_relationship_manager_approval_runtime_v3",
    cycleId: "cycle-persist-runtime-1",
    decisionPackageId: "decision-persist-runtime-1",
    approvalCandidate: candidate(),
    candidatePersistence: null,
    readyForCandidatePersistence: true,
    readyForHumanApproval: false,
    humanApprovalRecorded: false,
    externalExecutionAllowed: false,
    externalEffectPerformed: false,
  };
}

function durablePersistence(value: StaffCommunicationApprovalCandidate): StaffApprovalCandidatePersistenceResult {
  const candidateSha256 = staffApprovalCandidateHash(value);
  const recordId = "doc_persist_runtime_1:ver_persist_runtime_1";
  return {
    contract: "business_staff_communication_approval_candidate_persistence_v1",
    candidateId: value.candidateId,
    candidateSha256,
    durable: true,
    status: "persisted",
    recordId,
    receiptStatus: "appended",
    approvalEvidenceRef: approvalCandidatePersistenceEvidenceRef({
      candidateId: value.candidateId,
      candidateSha256,
      recordId,
    }),
    blocker: null,
  };
}

test("composed persistence transition produces approvable state without approving or executing", async () => {
  const before = preparation();
  let calls = 0;
  const storage: EvavoStorageApprovalCandidatePort = {
    contract: "business_evavo_storage_approval_candidate_port_v2",
    async persist(value) {
      calls += 1;
      assert.equal(value.candidateId, before.approvalCandidate.candidateId);
      return durablePersistence(value);
    },
  };

  const result = await persistRelationshipManagerApprovalCandidate({ preparation: before, storage });
  assert.equal(calls, 1);
  assert.equal(result.contract, "business_relationship_manager_approval_persistence_runtime_v1");
  assert.equal(result.preparation.readyForCandidatePersistence, false);
  assert.equal(result.preparation.readyForHumanApproval, true);
  assert.equal(result.preparation.humanApprovalRecorded, false);
  assert.equal(result.preparation.externalExecutionAllowed, false);
  assert.equal(result.externalEffectPerformed, false);
});

test("storage rejection cannot advance the state machine", async () => {
  const before = preparation();
  const storage: EvavoStorageApprovalCandidatePort = {
    contract: "business_evavo_storage_approval_candidate_port_v2",
    async persist(value) {
      return {
        contract: "business_staff_communication_approval_candidate_persistence_v1",
        candidateId: value.candidateId,
        candidateSha256: staffApprovalCandidateHash(value),
        durable: false,
        status: "rejected",
        recordId: null,
        receiptStatus: "rejected",
        approvalEvidenceRef: null,
        blocker: "storage rejected candidate",
      };
    },
  };

  await assert.rejects(
    () => persistRelationshipManagerApprovalCandidate({ preparation: before, storage }),
    /CANDIDATE_NOT_DURABLE/,
  );
});
