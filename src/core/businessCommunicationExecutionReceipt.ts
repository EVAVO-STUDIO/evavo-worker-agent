import type { AuthorizedCommunicationExecutionRequest } from "./businessCommunicationExecutionRequest";

export const BUSINESS_COMMUNICATION_EXECUTION_RECEIPT_CONTRACT = "business_communication_execution_receipt_v3" as const;

export type GmailObservedSendResult = Readonly<{
  providerMessageId: string;
  providerThreadId: string;
  sentAt: string;
  sender: string;
  to: readonly string[];
  cc?: readonly string[];
  bcc?: readonly string[];
  sourceEvidenceRefs: readonly string[];
}>;

export type CommunicationExecutionReceipt = Readonly<{
  contract: typeof BUSINESS_COMMUNICATION_EXECUTION_RECEIPT_CONTRACT;
  provider: "gmail";
  requestId: string;
  providerMessageId: string;
  providerThreadId: string;
  sentAt: string;
  sourceEvidenceRefs: readonly string[];
  authorization: AuthorizedCommunicationExecutionRequest["authorization"];
}>;

function text(value: string, field: string, max = 1000): string {
  const clean = value.trim();
  if (!clean || clean.length > max) throw new Error(`COMMUNICATION_EXECUTION_RECEIPT_${field.toUpperCase()}_INVALID`);
  return clean;
}

function iso(value: string, field: string): string {
  const parsed = new Date(value);
  if (!value || Number.isNaN(parsed.getTime())) throw new Error(`COMMUNICATION_EXECUTION_RECEIPT_${field.toUpperCase()}_INVALID`);
  return parsed.toISOString();
}

function address(value: string): string {
  const clean = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) throw new Error("COMMUNICATION_EXECUTION_RECEIPT_ADDRESS_INVALID");
  return clean;
}

function addresses(values: readonly string[] | undefined): readonly string[] {
  return Object.freeze([...new Set((values ?? []).map(address))].sort());
}

function sameAddresses(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function reconcileAuthorizedCommunicationExecution(input: Readonly<{
  request: AuthorizedCommunicationExecutionRequest;
  observed: GmailObservedSendResult;
}>): CommunicationExecutionReceipt {
  if (input.request.contract !== "business_communication_execution_request_v3" || input.request.provider !== "gmail") {
    throw new Error("COMMUNICATION_EXECUTION_RECEIPT_REQUEST_CONTRACT_INVALID");
  }
  const sentAt = iso(input.observed.sentAt, "sent_at");
  if (sentAt < input.request.authorizedAt) throw new Error("COMMUNICATION_EXECUTION_RECEIPT_BEFORE_AUTHORIZATION");
  if (sentAt >= input.request.authorization.expiresAt) throw new Error("COMMUNICATION_EXECUTION_RECEIPT_AFTER_APPROVAL_EXPIRY");

  const providerThreadId = text(input.observed.providerThreadId, "provider_thread_id", 500);
  if (providerThreadId !== input.request.threadId) throw new Error("COMMUNICATION_EXECUTION_RECEIPT_THREAD_MISMATCH");
  if (address(input.observed.sender) !== address(input.request.sender)) throw new Error("COMMUNICATION_EXECUTION_RECEIPT_SENDER_MISMATCH");
  if (!sameAddresses(addresses(input.observed.to), addresses(input.request.to))) throw new Error("COMMUNICATION_EXECUTION_RECEIPT_TO_MISMATCH");
  if (!sameAddresses(addresses(input.observed.cc), addresses(input.request.cc))) throw new Error("COMMUNICATION_EXECUTION_RECEIPT_CC_MISMATCH");
  if (!sameAddresses(addresses(input.observed.bcc), addresses(input.request.bcc))) throw new Error("COMMUNICATION_EXECUTION_RECEIPT_BCC_MISMATCH");

  const sourceEvidenceRefs = Object.freeze([...new Set(input.observed.sourceEvidenceRefs.map((item) => item.trim()).filter(Boolean))]);
  if (!sourceEvidenceRefs.length) throw new Error("COMMUNICATION_EXECUTION_RECEIPT_EVIDENCE_REQUIRED");
  const providerMessageId = text(input.observed.providerMessageId, "provider_message_id", 500);
  if (!sourceEvidenceRefs.some((ref) => ref.includes(providerMessageId))) throw new Error("COMMUNICATION_EXECUTION_RECEIPT_MESSAGE_EVIDENCE_MISSING");

  if (input.request.authorization.decisionOrigin === "relationship_manager_cycle") {
    const checkpoint = input.request.authorization.memoryCheckpoint;
    const writingProvenance = input.request.authorization.writingProvenance;
    const approvalCandidate = input.request.authorization.approvalCandidate;
    if (!checkpoint || !input.request.authorization.relationshipCycleId) {
      throw new Error("COMMUNICATION_EXECUTION_RECEIPT_MEMORY_CHECKPOINT_MISSING");
    }
    if (checkpoint.cycleId !== input.request.authorization.relationshipCycleId) {
      throw new Error("COMMUNICATION_EXECUTION_RECEIPT_MEMORY_CHECKPOINT_CYCLE_MISMATCH");
    }
    if (!writingProvenance) throw new Error("COMMUNICATION_EXECUTION_RECEIPT_WRITING_PROVENANCE_MISSING");
    if (writingProvenance.decisionOrigin !== "relationship_manager_cycle") {
      throw new Error("COMMUNICATION_EXECUTION_RECEIPT_WRITING_ORIGIN_INVALID");
    }
    if (writingProvenance.relationshipCycleId !== input.request.authorization.relationshipCycleId) {
      throw new Error("COMMUNICATION_EXECUTION_RECEIPT_WRITING_CYCLE_MISMATCH");
    }
    if (!writingProvenance.handoffId.trim() || !writingProvenance.writingRequestId.trim()) {
      throw new Error("COMMUNICATION_EXECUTION_RECEIPT_WRITING_IDENTITY_INVALID");
    }
    if (!approvalCandidate) throw new Error("COMMUNICATION_EXECUTION_RECEIPT_APPROVAL_CANDIDATE_MISSING");
    if (!approvalCandidate.candidateId.trim() || !approvalCandidate.recordId.trim()) {
      throw new Error("COMMUNICATION_EXECUTION_RECEIPT_APPROVAL_CANDIDATE_IDENTITY_INVALID");
    }
    if (!/^[a-f0-9]{64}$/.test(approvalCandidate.candidateSha256)) {
      throw new Error("COMMUNICATION_EXECUTION_RECEIPT_APPROVAL_CANDIDATE_HASH_INVALID");
    }
    if (!input.request.authorization.approvalEvidenceIds.includes(approvalCandidate.evidenceRef)) {
      throw new Error("COMMUNICATION_EXECUTION_RECEIPT_APPROVAL_CANDIDATE_EVIDENCE_MISSING");
    }
  }

  return Object.freeze({
    contract: BUSINESS_COMMUNICATION_EXECUTION_RECEIPT_CONTRACT,
    provider: "gmail",
    requestId: input.request.requestId,
    providerMessageId,
    providerThreadId,
    sentAt,
    sourceEvidenceRefs,
    authorization: input.request.authorization,
  });
}
