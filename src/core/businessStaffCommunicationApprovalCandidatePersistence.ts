import { businessSha256 } from "./businessSha256";
import {
  BUSINESS_STAFF_COMMUNICATION_APPROVAL_CANDIDATE_CONTRACT,
  type StaffCommunicationApprovalCandidate,
} from "./businessStaffCommunicationApprovalCandidate";

export const BUSINESS_STAFF_COMMUNICATION_APPROVAL_CANDIDATE_PERSISTENCE_CONTRACT =
  "business_staff_communication_approval_candidate_persistence_v1" as const;

export type StaffApprovalCandidateWriteRequest = Readonly<{
  protocol: "evavo-approval-candidate-write-request-v1";
  version: 1;
  requestId: string;
  idempotencyKey: string;
  requestedAt: string;
  actorId: "evavo-worker-agent";
  candidateId: string;
  candidateSha256: string;
  record: Readonly<{
    kind: "communication_approval_candidate";
    candidate: StaffCommunicationApprovalCandidate;
    candidateSha256: string;
    immutable: true;
  }>;
}>;

export type StaffApprovalCandidateWriteReceipt = Readonly<{
  protocol: "evavo-approval-candidate-write-receipt-v1";
  version: 1;
  requestId: string;
  idempotencyKey: string;
  candidateId: string;
  candidateSha256: string;
  status: "appended" | "idempotent_replay" | "rejected";
  durable: boolean;
  recordId?: string | null;
  journalPosition?: number | string | null;
  recordedAt: string;
  storageAuthority: Readonly<{ system: "evavo-storage"; instanceId: string }>;
  rejection?: Readonly<{ code: string; message: string }>;
}>;

export type StaffApprovalCandidatePersistenceResult = Readonly<{
  contract: typeof BUSINESS_STAFF_COMMUNICATION_APPROVAL_CANDIDATE_PERSISTENCE_CONTRACT;
  candidateId: string;
  candidateSha256: string;
  durable: boolean;
  status: "persisted" | "rejected";
  recordId: string | null;
  receiptStatus: StaffApprovalCandidateWriteReceipt["status"];
  approvalEvidenceRef: string | null;
  blocker: string | null;
}>;

function stableCandidatePayload(candidate: StaffCommunicationApprovalCandidate): string {
  return JSON.stringify(candidate);
}

export function staffApprovalCandidateHash(candidate: StaffCommunicationApprovalCandidate): string {
  if (candidate.contract !== BUSINESS_STAFF_COMMUNICATION_APPROVAL_CANDIDATE_CONTRACT) {
    throw new Error("STAFF_APPROVAL_CANDIDATE_PERSISTENCE_CONTRACT_INVALID");
  }
  return businessSha256(stableCandidatePayload(candidate));
}

export function buildStaffApprovalCandidateWriteRequest(
  candidate: StaffCommunicationApprovalCandidate,
): StaffApprovalCandidateWriteRequest {
  const candidateSha256 = staffApprovalCandidateHash(candidate);
  const idempotencyKey = `staff-approval-candidate:${candidate.candidateId}:${candidateSha256}`;
  const requestId = `approval-candidate-write:${businessSha256(idempotencyKey).slice(0, 32)}`;
  return Object.freeze({
    protocol: "evavo-approval-candidate-write-request-v1",
    version: 1,
    requestId,
    idempotencyKey,
    requestedAt: candidate.createdAt,
    actorId: "evavo-worker-agent",
    candidateId: candidate.candidateId,
    candidateSha256,
    record: Object.freeze({
      kind: "communication_approval_candidate",
      candidate,
      candidateSha256,
      immutable: true,
    }),
  });
}

export function approvalCandidatePersistenceEvidenceRef(input: Readonly<{
  candidateId: string;
  candidateSha256: string;
  recordId: string;
}>): string {
  const candidateId = input.candidateId.trim();
  const hash = input.candidateSha256.trim().toLowerCase();
  const recordId = input.recordId.trim();
  if (!candidateId || !recordId || !/^[a-f0-9]{64}$/.test(hash)) {
    throw new Error("STAFF_APPROVAL_CANDIDATE_PERSISTENCE_EVIDENCE_INVALID");
  }
  return `approval-candidate:${candidateId}:${hash}:${recordId}`;
}

export function reconcileStaffApprovalCandidateWriteReceipt(input: Readonly<{
  candidate: StaffCommunicationApprovalCandidate;
  request: StaffApprovalCandidateWriteRequest;
  receipt: StaffApprovalCandidateWriteReceipt;
}>): StaffApprovalCandidatePersistenceResult {
  const expectedHash = staffApprovalCandidateHash(input.candidate);
  if (input.request.protocol !== "evavo-approval-candidate-write-request-v1" || input.request.version !== 1) {
    throw new Error("STAFF_APPROVAL_CANDIDATE_PERSISTENCE_REQUEST_INVALID");
  }
  if (input.request.candidateId !== input.candidate.candidateId || input.request.candidateSha256 !== expectedHash) {
    throw new Error("STAFF_APPROVAL_CANDIDATE_PERSISTENCE_REQUEST_CANDIDATE_MISMATCH");
  }
  if (input.receipt.protocol !== "evavo-approval-candidate-write-receipt-v1" || input.receipt.version !== 1) {
    throw new Error("STAFF_APPROVAL_CANDIDATE_PERSISTENCE_RECEIPT_INVALID");
  }
  if (input.receipt.requestId !== input.request.requestId) throw new Error("STAFF_APPROVAL_CANDIDATE_PERSISTENCE_REQUEST_ID_MISMATCH");
  if (input.receipt.idempotencyKey !== input.request.idempotencyKey) throw new Error("STAFF_APPROVAL_CANDIDATE_PERSISTENCE_IDEMPOTENCY_MISMATCH");
  if (input.receipt.candidateId !== input.candidate.candidateId) throw new Error("STAFF_APPROVAL_CANDIDATE_PERSISTENCE_CANDIDATE_ID_MISMATCH");
  if (input.receipt.candidateSha256.toLowerCase() !== expectedHash) throw new Error("STAFF_APPROVAL_CANDIDATE_PERSISTENCE_HASH_MISMATCH");
  if (input.receipt.storageAuthority.system !== "evavo-storage") throw new Error("STAFF_APPROVAL_CANDIDATE_PERSISTENCE_STORAGE_AUTHORITY_INVALID");

  if (input.receipt.status === "rejected") {
    if (input.receipt.durable) throw new Error("STAFF_APPROVAL_CANDIDATE_PERSISTENCE_REJECTED_MARKED_DURABLE");
    return Object.freeze({
      contract: BUSINESS_STAFF_COMMUNICATION_APPROVAL_CANDIDATE_PERSISTENCE_CONTRACT,
      candidateId: input.candidate.candidateId,
      candidateSha256: expectedHash,
      durable: false,
      status: "rejected",
      recordId: null,
      receiptStatus: "rejected",
      approvalEvidenceRef: null,
      blocker: input.receipt.rejection?.message ?? "Approval candidate storage rejected the immutable record.",
    });
  }

  const recordId = input.receipt.recordId?.trim() ?? "";
  if (!input.receipt.durable || !recordId || input.receipt.journalPosition === null || input.receipt.journalPosition === undefined) {
    throw new Error("STAFF_APPROVAL_CANDIDATE_PERSISTENCE_DURABILITY_INVALID");
  }
  const approvalEvidenceRef = approvalCandidatePersistenceEvidenceRef({
    candidateId: input.candidate.candidateId,
    candidateSha256: expectedHash,
    recordId,
  });
  return Object.freeze({
    contract: BUSINESS_STAFF_COMMUNICATION_APPROVAL_CANDIDATE_PERSISTENCE_CONTRACT,
    candidateId: input.candidate.candidateId,
    candidateSha256: expectedHash,
    durable: true,
    status: "persisted",
    recordId,
    receiptStatus: input.receipt.status,
    approvalEvidenceRef,
    blocker: null,
  });
}
