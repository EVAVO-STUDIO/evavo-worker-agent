import assert from "node:assert/strict";
import test from "node:test";

import {
  createEvavoStorageApprovalCandidatePort,
  type ApprovalCandidateFetch,
} from "../src/core/businessEvavoStorageApprovalCandidatePort";
import {
  approvalCandidatePersistenceEvidenceRef,
  canonicalApprovalCandidateJson,
} from "../src/core/businessStaffCommunicationApprovalCandidatePersistence";
import { businessSha256 } from "../src/core/businessSha256";
import type { StaffCommunicationApprovalCandidate } from "../src/core/businessStaffCommunicationApprovalCandidate";

function candidate(): StaffCommunicationApprovalCandidate {
  return {
    contract: "business_staff_communication_approval_candidate_v2",
    candidateId: "approval-candidate-port-1",
    createdAt: "2026-09-04T08:00:00.000Z",
    decisionPackageId: "decision-port-1",
    decisionOrigin: "relationship_manager_cycle",
    relationshipCycleId: "cycle-port-1",
    relationshipId: "relationship-port-1",
    handoffId: "handoff-port-1",
    writingRequestId: "writing-request-port-1",
    writingPackageId: "writing-package-port-1",
    writingCandidateId: "writing-candidate-port-1",
    senderKey: "greg",
    mailboxKey: "greg",
    writingProvenance: {
      schema: "evavo-writing/staff-communication-writing-envelope-v2",
      version: 2,
      relationshipId: "relationship-port-1",
      handoffId: "handoff-port-1",
      decisionPackageId: "decision-port-1",
      decisionOrigin: "relationship_manager_cycle",
      relationshipCycleId: "cycle-port-1",
      staffContextGeneratedAt: "2026-09-04T07:59:00.000Z",
      writingRequestId: "writing-request-port-1",
      writingPackageId: "writing-package-port-1",
      writingCandidateId: "writing-candidate-port-1",
      sourceRefs: ["gmail:message:port-1"],
    } as StaffCommunicationApprovalCandidate["writingProvenance"],
    material: {
      sender: "greg@evavo.com.au",
      to: ["client@example.com"],
      cc: [],
      bcc: [],
      threadId: "thread-port-1",
      replyMessageId: "message-port-1",
      subject: "Re: Project status",
      body: "Hi Client,\n\nHere is the verified current status.\n\nKind regards,\nGreg",
      attachments: [],
    },
    materialSha256: "a".repeat(64),
    evidenceIds: ["gmail:message:port-1", "operations:project:port-1"],
    writingSourceRefs: ["gmail:message:port-1"],
    readyForHumanApproval: true,
    externalEffectPerformed: false,
  };
}

function successFetch(observed: { input?: string; init?: RequestInit }): ApprovalCandidateFetch {
  return async (input, init) => {
    observed.input = input;
    observed.init = init;
    const request = JSON.parse(String(init.body)) as {
      requestId: string;
      idempotencyKey: string;
      candidateId: string;
      candidateSha256: string;
    };
    const documentId = "doc_port_1";
    const versionId = "ver_port_1";
    return {
      ok: true,
      status: 200,
      async json() {
        return {
          schemaVersion: 1,
          ok: true,
          result: {
            protocol: "evavo-approval-candidate-write-receipt-v1",
            version: 1,
            requestId: request.requestId,
            idempotencyKey: request.idempotencyKey,
            candidateId: request.candidateId,
            candidateSha256: request.candidateSha256,
            status: "appended",
            durable: true,
            recordId: `${documentId}:${versionId}`,
            journalPosition: "receipt_port_1",
            recordedAt: "2026-09-04T08:00:01.000Z",
            storageAuthority: { system: "evavo-storage", instanceId: "storage-authority-1" },
            storage: {
              model: "immutable_document_version",
              vaultId: "internal",
              logicalPath: `RelationshipManager/ApprovalCandidates/${request.candidateId}/${request.candidateSha256}.json`,
              documentId,
              versionId,
              sha256: request.candidateSha256,
              sizeBytes: 2048,
              idempotentReplay: false,
              receiptId: "receipt_port_1",
            },
          },
        };
      },
    };
  };
}

test("persists exact candidate through governed EVAVO Storage action", async () => {
  const observed: { input?: string; init?: RequestInit } = {};
  const value = candidate();
  const port = createEvavoStorageApprovalCandidatePort({
    baseUrl: "http://127.0.0.1:8040/",
    writeToken: "x".repeat(32),
    timeoutMs: 1000,
  }, successFetch(observed));

  const result = await port.persist(value);
  assert.equal(observed.input, "http://127.0.0.1:8040/v1/actions/persist_approval_candidate");
  assert.equal(observed.init?.method, "POST");
  assert.equal((observed.init?.headers as Record<string, string>).Authorization, `Bearer ${"x".repeat(32)}`);
  assert.equal((observed.init?.headers as Record<string, string>)["Content-Type"], "application/json");
  assert.equal(observed.init?.redirect, "error");
  assert.equal(observed.init?.cache, "no-store");

  const sent = JSON.parse(String(observed.init?.body));
  assert.equal(sent.protocol, "evavo-approval-candidate-write-request-v1");
  assert.equal(sent.version, 1);
  assert.equal(sent.actorId, "evavo-worker-agent");
  assert.equal(sent.candidateId, value.candidateId);
  assert.equal(sent.record.candidate.candidateId, value.candidateId);
  assert.equal(sent.candidateSha256, businessSha256(canonicalApprovalCandidateJson(value)));

  assert.equal(result.status, "persisted");
  assert.equal(result.durable, true);
  assert.equal(result.recordId, "doc_port_1:ver_port_1");
  assert.equal(result.approvalEvidenceRef, approvalCandidatePersistenceEvidenceRef({
    candidateId: value.candidateId,
    candidateSha256: result.candidateSha256,
    recordId: "doc_port_1:ver_port_1",
  }));
});

test("refuses weak write tokens before any storage call", () => {
  let calls = 0;
  const fetchFn: ApprovalCandidateFetch = async () => {
    calls += 1;
    throw new Error("should not execute");
  };
  assert.throws(() => createEvavoStorageApprovalCandidatePort({
    baseUrl: "http://127.0.0.1:8040",
    writeToken: "too-short",
  }, fetchFn), /WRITE_TOKEN_INVALID/);
  assert.equal(calls, 0);
});

test("does not surface remote error message payloads", async () => {
  const port = createEvavoStorageApprovalCandidatePort({
    baseUrl: "http://127.0.0.1:8040",
    writeToken: "x".repeat(32),
  }, async () => ({
    ok: false,
    status: 403,
    async json() {
      return {
        schemaVersion: 1,
        ok: false,
        error: {
          code: "EVAVO_STORAGE_AUTHORIZATION_ERROR",
          message: "secret provider detail that must not escape",
        },
      };
    },
  }));

  await assert.rejects(
    () => port.persist(candidate()),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /WRITE_FAILED:403:EVAVO_STORAGE_AUTHORIZATION_ERROR/);
      assert.doesNotMatch(error.message, /secret provider detail/);
      return true;
    },
  );
});

test("rejects successful response that lacks native immutable Storage binding", async () => {
  const port = createEvavoStorageApprovalCandidatePort({
    baseUrl: "http://127.0.0.1:8040",
    writeToken: "x".repeat(32),
  }, async (_input, init) => {
    const request = JSON.parse(String(init.body));
    return {
      ok: true,
      status: 200,
      async json() {
        return {
          schemaVersion: 1,
          ok: true,
          result: {
            protocol: "evavo-approval-candidate-write-receipt-v1",
            version: 1,
            requestId: request.requestId,
            idempotencyKey: request.idempotencyKey,
            candidateId: request.candidateId,
            candidateSha256: request.candidateSha256,
            status: "appended",
            durable: true,
            recordId: "legacy-record-only",
            journalPosition: "legacy-receipt",
            recordedAt: "2026-09-04T08:00:01.000Z",
            storageAuthority: { system: "evavo-storage", instanceId: "storage-authority-1" },
          },
        };
      },
    };
  });

  await assert.rejects(() => port.persist(candidate()), /NATIVE_STORAGE_REQUIRED/);
});

test("rejects malformed successful responses", async () => {
  const port = createEvavoStorageApprovalCandidatePort({
    baseUrl: "http://127.0.0.1:8040",
    writeToken: "x".repeat(32),
  }, async () => ({
    ok: true,
    status: 200,
    async json() {
      return { schemaVersion: 1, ok: true };
    },
  }));

  await assert.rejects(() => port.persist(candidate()), /WRITE_FAILED:200:EVAVO_STORAGE_ACTION_FAILED/);
});
